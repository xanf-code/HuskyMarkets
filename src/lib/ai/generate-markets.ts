import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { flagContent } from "@/lib/content-flags";
import { CATEGORIES, CONTENT_RULE } from "@/lib/constants";
import { getAnthropicClient, makeWebSearchTool, MODEL, type AiTool } from "./client";
import {
  marketProposalSchema,
  proposeMarketToolDef,
  skipCategoryToolDef,
  type MarketProposal,
} from "./schemas";

// Category-specific research prompts to guide web search.
const CATEGORY_BRIEFS: Record<string, string> = {
  wildcard:
    "Unusual, viral, or off-beat Northeastern/Boston news that doesn't fit other categories.",
  campus:
    "NU administration decisions, campus events, construction projects, policy changes.",
  transit:
    "MBTA Orange/Green lines, Northeastern shuttle service, commuter rail affecting NU.",
  weather:
    "Boston/campus weather forecasts, storm alerts, temperature records for the coming days.",
  sports:
    "Northeastern Huskies athletics — basketball, hockey, soccer, track, rankings, match results.",
  academics:
    "NU academic calendar, tuition, rankings, research announcements, co-op news.",
  dining:
    "NU Dining halls (Stetson East/West, Outtakes, Rebecca's), hours, menu changes, closures.",
};

export interface GenerationResult {
  category: string;
  status: "proposed" | "skipped" | "blocked" | "error";
  marketId?: string;
  reason?: string;
}

export async function generateMarketsForAllCategories(
  budgetMs = 230_000,
): Promise<GenerationResult[]> {
  const admin = createAdminClient();
  const anthropic = getAnthropicClient();

  // Fetch existing open/pending market titles for duplicate avoidance.
  const { data: existingMarkets } = await admin
    .from("markets")
    .select("id, title, category")
    .in("status", ["open", "pending"])
    .order("created_at", { ascending: false })
    .limit(100);

  // Resolve AI creator account id.
  const creatorEmail = process.env.AI_CREATOR_EMAIL;
  if (!creatorEmail) throw new Error("AI_CREATOR_EMAIL is not set");

  const { data: creatorProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", creatorEmail)
    .single();

  if (!creatorProfile?.id) {
    throw new Error(
      `AI creator profile not found for ${creatorEmail}. Run seed-ai-accounts.ts first.`,
    );
  }

  const results: GenerationResult[] = [];
  const startMs = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (const cat of CATEGORIES) {
    if (Date.now() - startMs > budgetMs) {
      results.push({ category: cat.value, status: "skipped", reason: "time budget exhausted" });
      continue;
    }

    const existing = (existingMarkets ?? [])
      .filter((m) => m.category === cat.value)
      .map((m) => `- ${m.title}`)
      .join("\n");

    const systemPrompt = [
      `You are HuskyMarkets AI — an automated market maker for Northeastern University's campus prediction platform.`,
      `Today is ${today} (Eastern Time). You are generating a market for the "${cat.label}" category.`,
      `Category brief: ${CATEGORY_BRIEFS[cat.value] ?? cat.label}`,
      ``,
      `CONTENT RULES:`,
      `• ${CONTENT_RULE}`,
      `• Resolution criteria must cite an objectively checkable public source (e.g. official NU website, MBTA alerts, verified news outlet).`,
      `• Outcomes must be mutually exclusive and collectively exhaustive (they cover all plausible results).`,
      `• The market horizon must be 3–30 days from today.`,
      `• Only propose a market if it is genuinely newsworthy AND cleanly resolvable. If in doubt, skip.`,
      ``,
      `EXISTING MARKETS IN THIS CATEGORY (do not duplicate):`,
      existing || "(none)",
      ``,
      `TASK:`,
      `1. Use web_search to research recent (last ~7 days) Northeastern University and Boston news relevant to "${cat.label}".`,
      `2. Identify the single most interesting, clearly resolvable topic.`,
      `3. Call propose_market with a complete market definition, OR call skip_category if nothing qualifies.`,
      `4. You MUST finish by calling exactly one of: propose_market, skip_category.`,
    ].join("\n");

    try {
      const result = await runGenerationCall(anthropic, systemPrompt, cat.value);
      if (result.type === "skip") {
        results.push({ category: cat.value, status: "skipped", reason: result.reason });
        continue;
      }

      const proposal = result.proposal;
      const flagResult = flagContent(
        proposal.title,
        proposal.description ?? "",
        proposal.resolution_criteria,
      );

      if (flagResult.blocked) {
        results.push({ category: cat.value, status: "blocked", reason: "content blocked" });
        continue;
      }

      const { data: rpcResult, error: rpcError } = await admin.rpc(
        "create_market_ai",
        {
          p_creator_id: creatorProfile.id,
          p_title: proposal.title,
          p_description: proposal.description ?? "",
          p_category: cat.value,
          p_resolution_criteria: proposal.resolution_criteria,
          p_close_at: proposal.close_at,
          p_resolve_at: proposal.resolve_at,
          p_outcomes: JSON.stringify(proposal.outcomes),
          p_auto_flagged: flagResult.flagged,
        },
      );

      if (rpcError) {
        results.push({ category: cat.value, status: "error", reason: rpcError.message });
        continue;
      }

      const marketId = (rpcResult as { market_id: string }).market_id;

      // Store reviewer-facing research citations.
      await admin.from("ai_market_proposals").insert({
        market_id: marketId,
        sources: proposal.sources ?? [],
        research_summary: proposal.research_summary ?? "",
        model: MODEL,
      });

      results.push({ category: cat.value, status: "proposed", marketId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ category: cat.value, status: "error", reason: msg });
    }
  }

  return results;
}

type GenerationCallResult =
  | { type: "propose"; proposal: MarketProposal }
  | { type: "skip"; reason: string };

async function runGenerationCall(
  anthropic: ReturnType<typeof getAnthropicClient>,
  systemPrompt: string,
  category: string,
): Promise<GenerationCallResult> {
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Research and propose a prediction market for the "${category}" category, or skip if nothing qualifies.`,
    },
  ];

  // Handle the server-tool (web_search) pause_turn loop, up to 3 continuations.
  for (let round = 0; round < 4; round++) {
    const tools: AiTool[] = [
      makeWebSearchTool(5),
      proposeMarketToolDef as unknown as AiTool,
      skipCategoryToolDef as unknown as AiTool,
    ];
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect tool_use blocks.
    const toolUses = response.content.filter((b) => b.type === "tool_use");

    for (const tu of toolUses) {
      if (tu.type !== "tool_use") continue;
      if (tu.name === "propose_market") {
        const parsed = marketProposalSchema.safeParse(tu.input);
        if (!parsed.success) {
          throw new Error(
            `Invalid proposal from model: ${parsed.error.message}`,
          );
        }
        return { type: "propose", proposal: parsed.data };
      }
      if (tu.name === "skip_category") {
        const input = tu.input as { reason?: string };
        return { type: "skip", reason: input.reason ?? "model chose to skip" };
      }
    }

    if (response.stop_reason !== "pause_turn") break;

    // Continue the conversation for server-tool results.
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

  return { type: "skip", reason: "model did not call a decision tool" };
}
