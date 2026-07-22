// Volume seeding pass — runs after regular edge-based trading.
// Finds open markets whose total outcome pool is below the target and
// distributes bets across all available bots using a round-robin outcome
// strategy (no Claude call required: bets cycle through outcomes so prices
// stay roughly balanced while volume fills in).

import { createAdminClient } from "@/lib/supabase/admin";
import { signInBot } from "./bot-auth";
import type { AiConfig, BotCredential } from "./config";

export interface SeedingMarketResult {
  marketId: string;
  marketTitle: string;
  poolBefore: number;
  poolAfter: number;
  betsPlaced: number;
  errors: number;
}

export interface SeedingRunResult {
  markets: SeedingMarketResult[];
  totalBetsPlaced: number;
  totalErrors: number;
}

export async function seedMarketVolume(
  bots: BotCredential[],
  cfg: AiConfig,
  budgetMs = 200_000,
): Promise<SeedingRunResult> {
  const admin = createAdminClient();
  const runResult: SeedingRunResult = { markets: [], totalBetsPlaced: 0, totalErrors: 0 };
  const startMs = Date.now();

  // Find open markets whose total pool is below the target.
  const { data: markets } = await admin
    .from("markets")
    .select(
      "id, title, close_at, market_outcomes!market_outcomes_market_id_fkey(id, label, sort_order, pool)",
    )
    .eq("status", "open")
    .gt("close_at", new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  if (!markets || markets.length === 0) return runResult;

  // Filter to under-target markets, sorted by largest deficit first.
  const underTarget = markets
    .map((m) => {
      const outcomes = (m.market_outcomes ?? []) as {
        id: string;
        label: string;
        sort_order: number;
        pool: number;
      }[];
      const totalPool = outcomes.reduce((s, o) => s + o.pool, 0);
      return { ...m, outcomes, totalPool };
    })
    .filter((m) => m.totalPool < cfg.seedingTargetVolume)
    .sort((a, b) => a.totalPool - b.totalPool);

  // Pre-load all bot staking data (bets per market) and balances in one query.
  const botIds: string[] = [];
  const botSessions: Map<string, { client: Awaited<ReturnType<typeof signInBot>>["client"]; userId: string; balance: number }> = new Map();

  for (const bot of bots) {
    if (Date.now() - startMs > budgetMs * 0.2) break; // reserve 80% for bets
    try {
      const session = await signInBot(bot.email, bot.password);
      // Get balance via transactions sum.
      const { data: txRows } = await admin
        .from("transactions")
        .select("amount")
        .eq("user_id", session.userId);
      const balance = (txRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      if (balance > 50) {
        botIds.push(session.userId);
        botSessions.set(session.userId, { ...session, balance });
      }
    } catch {
      // Bot sign-in failed — skip silently.
    }
  }

  if (botSessions.size === 0) return runResult;

  // Per-bot per-market existing stake.
  const { data: existingBets } = await admin
    .from("bets")
    .select("user_id, market_id, amount")
    .in("user_id", botIds);

  const stakeKey = (userId: string, marketId: string) => `${userId}:${marketId}`;
  const stakeMap = new Map<string, number>();
  for (const b of existingBets ?? []) {
    const k = stakeKey(b.user_id, b.market_id);
    stakeMap.set(k, (stakeMap.get(k) ?? 0) + b.amount);
  }

  for (const market of underTarget) {
    if (Date.now() - startMs > budgetMs) break;

    const needed = cfg.seedingTargetVolume - market.totalPool;
    if (needed <= 0) continue;

    const outcomes = [...market.outcomes].sort((a, b) => a.sort_order - b.sort_order);
    if (outcomes.length < 2) continue;

    const marketResult: SeedingMarketResult = {
      marketId: market.id,
      marketTitle: market.title,
      poolBefore: market.totalPool,
      poolAfter: market.totalPool,
      betsPlaced: 0,
      errors: 0,
    };

    // How much each bot should contribute to reach the target.
    const availableBots = [...botSessions.entries()].filter(([userId]) => {
      const existing = stakeMap.get(stakeKey(userId, market.id)) ?? 0;
      return existing < 500;
    });

    if (availableBots.length === 0) {
      runResult.markets.push(marketResult);
      continue;
    }

    const perBotTarget = Math.ceil(needed / availableBots.length);

    let outcomeIndex = 0;
    for (const [userId, session] of availableBots) {
      if (Date.now() - startMs > budgetMs) break;

      const existingStake = stakeMap.get(stakeKey(userId, market.id)) ?? 0;
      const remainingCap = 500 - existingStake;
      const reserveGuard = session.balance - 50;
      const amount = Math.min(perBotTarget, remainingCap, reserveGuard, cfg.maxBet);

      if (amount < 10) continue; // not worth placing

      // Round-robin across outcomes so volume distributes evenly.
      const targetOutcome = outcomes[outcomeIndex % outcomes.length];
      outcomeIndex++;

      const { error: betError } = await session.client.rpc("place_bet", {
        p_market_id: market.id,
        p_outcome_id: targetOutcome.id,
        p_amount: amount,
      });

      if (betError) {
        marketResult.errors++;
        runResult.totalErrors++;
        await admin.from("ai_trade_log").insert({
          bot_user_id: userId,
          market_id: market.id,
          outcome_id: targetOutcome.id,
          action: "error",
          amount,
          reasoning: `seeding: ${betError.message}`,
        });
      } else {
        session.balance -= amount;
        stakeMap.set(stakeKey(userId, market.id), existingStake + amount);
        marketResult.poolAfter += amount;
        marketResult.betsPlaced++;
        runResult.totalBetsPlaced++;

        await admin.from("ai_trade_log").insert({
          bot_user_id: userId,
          market_id: market.id,
          outcome_id: targetOutcome.id,
          action: "bet",
          amount,
          reasoning: `volume seeding — target ${cfg.seedingTargetVolume} HC`,
        });
      }
    }

    runResult.markets.push(marketResult);
  }

  return runResult;
}
