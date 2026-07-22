import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient, makeWebSearchTool, MODEL, type AiTool } from "./client";
import { signInBot } from "./bot-auth";
import {
  tradeEstimateSchema,
  submitEstimateToolDef,
  type TradeEstimate,
} from "./schemas";
import type { AiConfig, BotCredential } from "./config";

export interface TradingResult {
  botEmail: string;
  marketsConsidered: number;
  bets: number;
  skips: number;
  errors: number;
}

// ── Pure edge/sizing helpers (exported for unit tests) ───────────────────────

export function computeEdge(estProb: number, implied: number): number {
  return estProb - implied;
}

export function computeBetSize(
  edge: number,
  threshold: number,
  minBet: number,
  maxBet: number,
  remainingCap: number,
  balance: number,
): number {
  const base = Math.min(maxBet, minBet + (edge - threshold) * 4);
  const jitter = 0.8 + Math.random() * 0.4; // ±20%
  const sized = Math.round(base * jitter);
  const reserve = 50;
  const capped = Math.min(sized, remainingCap, balance - reserve);
  return Math.max(0, capped);
}

// ── Per-bot trading run ───────────────────────────────────────────────────────

export async function runBotTradingSession(
  botEmail: string,
  botPassword: string,
  cfg: AiConfig,
): Promise<TradingResult> {
  const admin = createAdminClient();
  const anthropic = getAnthropicClient();
  const result: TradingResult = {
    botEmail,
    marketsConsidered: 0,
    bets: 0,
    skips: 0,
    errors: 0,
  };

  const { client: botClient, userId: botId } = await signInBot(
    botEmail,
    botPassword,
  );

  // Claim daily bonus and bailout (both are idempotent / gracefully fail).
  await botClient.rpc("claim_daily_bonus");
  await botClient.rpc("claim_bailout");

  // Get bot's current balance via transactions sum.
  const { data: txRows } = await admin
    .from("transactions")
    .select("amount")
    .eq("user_id", botId);
  let balance = (txRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  if (balance <= 50) {
    // Not enough to bet even at minimum; bail.
    return result;
  }

  // Find candidate markets.
  const cutoff = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

  // Markets the bot has already logged today.
  const { data: recentLog } = await admin
    .from("ai_trade_log")
    .select("market_id")
    .eq("bot_user_id", botId)
    .gte("created_at", yesterday);
  const loggedMarketIds = new Set((recentLog ?? []).map((r) => r.market_id));

  // Markets where the bot has already hit the 500 HC aggregate cap.
  const { data: capRows } = await admin
    .from("bets")
    .select("market_id, amount")
    .eq("user_id", botId);
  const stakeByMarket = new Map<string, number>();
  for (const row of capRows ?? []) {
    stakeByMarket.set(
      row.market_id,
      (stakeByMarket.get(row.market_id) ?? 0) + row.amount,
    );
  }

  const { data: markets } = await admin
    .from("markets")
    .select("id, title, description, resolution_criteria, close_at, market_outcomes!market_outcomes_market_id_fkey(id, label, pool)")
    .eq("status", "open")
    .neq("creator_id", botId)
    .gt("close_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(20);

  const candidates = (markets ?? [])
    .filter((m) => !loggedMarketIds.has(m.id))
    .filter((m) => (stakeByMarket.get(m.id) ?? 0) < 500)
    .slice(0, cfg.marketsPerBotRun);

  result.marketsConsidered = candidates.length;

  for (const market of candidates) {
    const outcomes = (market.market_outcomes ?? []) as {
      id: string;
      label: string;
      pool: number;
    }[];
    const totalPool = outcomes.reduce((s, o) => s + o.pool, 0);

    if (outcomes.length < 2 || totalPool === 0) {
      result.skips++;
      continue;
    }

    const outcomeSummary = outcomes
      .map((o) => `${o.label} (implied ${Math.round((100 * o.pool) / totalPool)}%)`)
      .join(", ");

    let estimate: TradeEstimate;
    try {
      estimate = await runEstimateCall(anthropic, market, outcomeSummary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logTrade(admin, {
        bot_user_id: botId,
        market_id: market.id,
        action: "error",
        reasoning: msg,
      });
      result.errors++;
      continue;
    }

    // Find the outcome with maximum edge.
    let bestEdge = 0;
    let bestOutcomeId: string | null = null;
    let bestEstProb = 0;
    let bestImplied = 0;

    for (const est of estimate.probabilities) {
      const outcome = outcomes.find(
        (o) => o.label.toLowerCase() === est.label.toLowerCase(),
      );
      if (!outcome) continue;
      const implied = Math.round((100 * outcome.pool) / totalPool);
      const edge = computeEdge(est.probability, implied);
      if (edge > bestEdge) {
        bestEdge = edge;
        bestOutcomeId = outcome.id;
        bestEstProb = est.probability;
        bestImplied = implied;
      }
    }

    if (bestEdge < cfg.edgeThreshold || !bestOutcomeId) {
      await logTrade(admin, {
        bot_user_id: botId,
        market_id: market.id,
        action: "skip",
        est_prob: bestEstProb,
        implied: bestImplied,
        edge: bestEdge,
        reasoning: estimate.reasoning,
      });
      result.skips++;
      continue;
    }

    const remainingCap = 500 - (stakeByMarket.get(market.id) ?? 0);
    const amount = computeBetSize(
      bestEdge,
      cfg.edgeThreshold,
      cfg.minBet,
      cfg.maxBet,
      remainingCap,
      balance,
    );

    if (amount < cfg.minBet) {
      result.skips++;
      continue;
    }

    const { error: betError } = await botClient.rpc("place_bet", {
      p_market_id: market.id,
      p_outcome_id: bestOutcomeId,
      p_amount: amount,
    });

    if (betError) {
      await logTrade(admin, {
        bot_user_id: botId,
        market_id: market.id,
        outcome_id: bestOutcomeId,
        action: "error",
        est_prob: bestEstProb,
        implied: bestImplied,
        edge: bestEdge,
        amount,
        reasoning: betError.message,
      });
      result.errors++;
    } else {
      balance -= amount;
      stakeByMarket.set(market.id, (stakeByMarket.get(market.id) ?? 0) + amount);

      await logTrade(admin, {
        bot_user_id: botId,
        market_id: market.id,
        outcome_id: bestOutcomeId,
        action: "bet",
        est_prob: bestEstProb,
        implied: bestImplied,
        edge: bestEdge,
        amount,
        reasoning: estimate.reasoning,
      });
      result.bets++;
    }
  }

  return result;
}

// ── Run all bots ──────────────────────────────────────────────────────────────

export async function runAllBots(
  cfg: AiConfig,
  bots: BotCredential[],
): Promise<TradingResult[]> {
  // Smart trading only runs on the first 2 bots (Claude calls are expensive).
  const tradingBots = bots.slice(0, 2).filter((b) => b.email && b.password);

  const results: TradingResult[] = [];
  for (const bot of tradingBots) {
    try {
      const r = await runBotTradingSession(bot.email, bot.password, cfg);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        botEmail: bot.email,
        marketsConsidered: 0,
        bets: 0,
        skips: 0,
        errors: 1,
      });
      console.error(`[ai-trading] bot ${bot.email} session failed: ${msg}`);
    }
  }
  return results;
}

// ── Claude call ───────────────────────────────────────────────────────────────

async function runEstimateCall(
  anthropic: ReturnType<typeof getAnthropicClient>,
  market: { title: string; description: string | null; resolution_criteria: string | null; close_at: string },
  outcomeSummary: string,
): Promise<TradeEstimate> {
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = [
    `You are a calibrated probability estimator for HuskyMarkets, a Northeastern University prediction platform.`,
    `Today is ${today}. Your task: use web_search to research current information, then submit calibrated probability estimates for the following prediction market.`,
    ``,
    `The market uses parimutuel pricing: implied probability = outcome_pool / total_pool. Your edge is: your_estimate − implied_probability.`,
    ``,
    `Submit estimates by calling submit_estimate. Probabilities should sum to approximately 100. Be calibrated — do not force extreme confidence.`,
  ].join("\n");

  const userMessage = [
    `Market: "${market.title}"`,
    market.description ? `Description: ${market.description}` : "",
    market.resolution_criteria ? `Resolution: ${market.resolution_criteria}` : "",
    `Closes: ${market.close_at}`,
    `Current implied prices: ${outcomeSummary}`,
    ``,
    `Research current information and submit your probability estimates.`,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: MessageParam[] = [{ role: "user", content: userMessage }];

  for (let round = 0; round < 4; round++) {
    const tools: AiTool[] = [
      makeWebSearchTool(3),
      submitEstimateToolDef as unknown as AiTool,
    ];
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "submit_estimate") {
        const parsed = tradeEstimateSchema.safeParse(block.input);
        if (!parsed.success) throw new Error(`Invalid estimate: ${parsed.error.message}`);
        return parsed.data;
      }
    }

    if (response.stop_reason !== "pause_turn") break;

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUses[0]?.id ?? "",
          content: "Continue.",
        },
      ],
    });
  }

  throw new Error("Model did not call submit_estimate");
}

// ── Logging helper ────────────────────────────────────────────────────────────

async function logTrade(
  admin: ReturnType<typeof createAdminClient>,
  entry: {
    bot_user_id: string;
    market_id: string;
    outcome_id?: string | null;
    action: "bet" | "skip" | "error";
    est_prob?: number;
    implied?: number;
    edge?: number;
    amount?: number;
    reasoning?: string;
  },
): Promise<void> {
  const { error: logErr } = await admin.from("ai_trade_log").insert(entry);
  if (logErr) console.error("[ai-trading] log insert failed:", logErr.message);
}
