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
    id: "m1",
    title: "Will it snow before finals?",
    category: "weather",
    status: "open",
    close_at: "2026-07-20T00:00:00Z",
    outcomes: [
      { id: "o1", label: "Yes", sort_order: 0, pool: 450, implied: 60 },
      { id: "o2", label: "No", sort_order: 1, pool: 300, implied: 40 },
    ],
    leading: { label: "Yes", implied: 60 },
  };

  it("maps the RPC payload, deriving volume from the outcome pools", async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    const card = await getMarketCard("m1");
    expect(rpc).toHaveBeenCalledWith("get_market_card", { p_market_id: "m1" });
    expect(card).toEqual({
      title: "Will it snow before finals?",
      category: "weather",
      leading: { label: "Yes", price: 60 },
      volume: 550,
      status: "open",
      closeAt: "2026-07-20T00:00:00Z",
    });
  });

  it("returns null when the market is missing or hidden", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getMarketCard("hidden")).toBeNull();
  });

  it("returns null on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getMarketCard("m1")).toBeNull();
  });
});

describe("getShareCard", () => {
  const row = {
    bet_id: "b1",
    market_id: "m1",
    market_title: "Will it snow before finals?",
    outcome_label: "No",
    price_at_bet: 22,
    amount: 250,
    payout: 396,
    display_name: "QuietHusky42",
  };

  it("maps the RPC payload with the outcome label", async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    const card = await getShareCard("b1");
    expect(rpc).toHaveBeenCalledWith("get_share_card", { p_bet_id: "b1" });
    expect(card).toEqual({
      marketId: "m1",
      marketTitle: "Will it snow before finals?",
      outcomeLabel: "No",
      priceAtBet: 22,
      stake: 250,
      payout: 396,
      displayName: "QuietHusky42",
    });
  });

  it("returns null for losing or unresolved bets", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getShareCard("loser")).toBeNull();
  });

  it("returns null on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getShareCard("b1")).toBeNull();
  });
});
