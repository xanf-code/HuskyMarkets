import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMarketCard, getShareCard } from "./share";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/anon", () => ({
  createClient: () => ({ rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMarketCard", () => {
  const row = {
    title: "Will it snow before finals?",
    category: "weather" as const,
    yes_pool: 450,
    no_pool: 300,
    status: "open" as const,
    close_at: "2026-07-20T00:00:00Z",
  };

  it("maps the RPC row and derives price and volume", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const card = await getMarketCard("m1");
    expect(rpc).toHaveBeenCalledWith("get_market_card", { p_market_id: "m1" });
    expect(card).toEqual({
      title: "Will it snow before finals?",
      category: "weather",
      yesPrice: 60,
      volume: 550,
      status: "open",
      closeAt: "2026-07-20T00:00:00Z",
    });
  });

  it("returns null when the market is missing or hidden", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getMarketCard("hidden")).toBeNull();
  });

  it("returns null on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getMarketCard("m1")).toBeNull();
  });
});

describe("getShareCard", () => {
  const row = {
    market_id: "m1",
    market_title: "Will it snow before finals?",
    side: "no" as const,
    price_at_bet: 22,
    stake: 250,
    payout: 396,
    display_name: "QuietHusky42",
  };

  it("maps the RPC row", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const card = await getShareCard("b1");
    expect(rpc).toHaveBeenCalledWith("get_share_card", { p_bet_id: "b1" });
    expect(card).toEqual({
      marketId: "m1",
      marketTitle: "Will it snow before finals?",
      side: "no",
      priceAtBet: 22,
      stake: 250,
      payout: 396,
      displayName: "QuietHusky42",
    });
  });

  it("returns null for losing or unresolved bets", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getShareCard("loser")).toBeNull();
  });

  it("returns null on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getShareCard("b1")).toBeNull();
  });
});
