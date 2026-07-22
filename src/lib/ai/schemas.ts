import { z } from "zod";

// ── Market proposal ───────────────────────────────────────────────────────────

export const marketProposalSchema = z.object({
  title: z.string().min(10).max(120),
  description: z.string().optional().default(""),
  resolution_criteria: z.string().min(20),
  close_at: z
    .string()
    .datetime()
    .refine(
      (v) => new Date(v) > new Date(Date.now() + 24 * 60 * 60 * 1000),
      "close_at must be at least 24 h from now",
    ),
  resolve_at: z.string().datetime(),
  outcomes: z
    .array(z.string().min(1).max(40))
    .min(2)
    .max(6),
  sources: z
    .array(
      z.object({
        url: z
          .string()
          .url()
          .refine(
            (u) => { const p = new URL(u).protocol; return p === "https:" || p === "http:"; },
            "Only http(s) URLs allowed",
          ),
        title: z.string(),
      }),
    )
    .max(6)
    .default([]),
  research_summary: z.string().default(""),
});

export type MarketProposal = z.infer<typeof marketProposalSchema>;

export const skipSchema = z.object({
  reason: z.string(),
});

// JSON Schema for the Claude client tool (strict mode).
export const proposeMarketToolDef = {
  name: "propose_market",
  description:
    "Call this when you have found a genuinely newsworthy, resolvable topic for a prediction market.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "10–120 character market question.",
      },
      description: {
        type: "string",
        description: "Optional context for bettors (shown on the market page).",
      },
      resolution_criteria: {
        type: "string",
        description:
          "At least 20 characters. Must cite an objectively checkable public source.",
      },
      close_at: {
        type: "string",
        description:
          "ISO 8601 UTC timestamp when betting closes. Must be ≥24 h from now, ≤30 days.",
      },
      resolve_at: {
        type: "string",
        description:
          "ISO 8601 UTC timestamp when the market can be resolved. Must be ≥ close_at.",
      },
      outcomes: {
        type: "array",
        items: { type: "string" },
        description: "2–6 mutually exclusive outcome labels, each ≤40 chars.",
        minItems: 2,
        maxItems: 6,
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
          },
          required: ["url", "title"],
        },
        description: "Up to 6 URLs you consulted. Shown only to the admin reviewer.",
      },
      research_summary: {
        type: "string",
        description: "1–3 sentence summary of what you found. Reviewer-facing only.",
      },
    },
    required: [
      "title",
      "resolution_criteria",
      "close_at",
      "resolve_at",
      "outcomes",
    ],
    additionalProperties: false,
  },
};

export const skipCategoryToolDef = {
  name: "skip_category",
  description:
    "Call this when there is nothing genuinely newsworthy or cleanly resolvable in this category right now.",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string",
        description: "Brief internal reason for skipping.",
      },
    },
    required: ["reason"],
    additionalProperties: false,
  },
};

// ── Trade estimate ────────────────────────────────────────────────────────────

export const tradeEstimateSchema = z.object({
  probabilities: z
    .array(
      z.object({
        label: z.string(),
        probability: z.number().int().min(1).max(99),
      }),
    )
    .min(2)
    .max(6),
  reasoning: z.string(),
});

export type TradeEstimate = z.infer<typeof tradeEstimateSchema>;

export const submitEstimateToolDef = {
  name: "submit_estimate",
  description: "Submit your probability estimate for each outcome in the market.",
  input_schema: {
    type: "object" as const,
    properties: {
      probabilities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            probability: {
              type: "integer",
              minimum: 1,
              maximum: 99,
              description: "Estimated probability (1–99). All values should sum to ~100.",
            },
          },
          required: ["label", "probability"],
        },
        description: "One entry per outcome.",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of your probability estimates.",
      },
    },
    required: ["probabilities", "reasoning"],
    additionalProperties: false,
  },
};
