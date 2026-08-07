import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES } from "@/lib/constants";
import { generateMarketsForAllCategories } from "./generate-markets";

const { anthropicCreate, from, rpc } = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from, rpc }),
}));

vi.mock("./client", () => ({
  getAnthropicClient: () => ({ messages: { create: anthropicCreate } }),
  makeWebSearchTool: () => ({ type: "web_search_20250305", name: "web_search" }),
  MODEL: "test-model",
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_CREATOR_EMAIL", "ai-markets@northeastern.edu");

  from.mockImplementation((table: string) => {
    if (table === "markets") {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: "ai-creator" }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  anthropicCreate.mockImplementation(async () => ({
    content: [
      {
        type: "tool_use",
        name: "propose_market",
        input: {
          title: "Will the Green Line run normally tomorrow?",
          description: "A transit service prediction.",
          resolution_criteria:
            "Resolves from the official MBTA service alerts page.",
          close_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          resolve_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          outcomes: ["Normal service", "The retard wins"],
          sources: [],
          research_summary: "Service alerts were reviewed.",
        },
      },
    ],
    stop_reason: "tool_use",
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateMarketsForAllCategories", () => {
  it("blocks prohibited content contained only in an outcome label", async () => {
    const results = await generateMarketsForAllCategories();

    expect(results).toHaveLength(CATEGORIES.length);
    expect(results.every((result) => result.status === "blocked")).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
