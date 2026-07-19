import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeBet } from "./bets";

const { rpc, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

const MARKET_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({
    data: {
      bet_id: "bet-1",
      yes_pool: 200,
      no_pool: 100,
      implied_yes: 67,
      new_balance: 900,
    },
    error: null,
  });
});

describe("placeBet", () => {
  it("calls the place_bet RPC and returns the fill for optimistic UI", async () => {
    const result = await placeBet({
      marketId: MARKET_ID,
      side: "yes",
      amount: 100,
    });

    expect(rpc).toHaveBeenCalledWith("place_bet", {
      p_market_id: MARKET_ID,
      p_side: "yes",
      p_amount: 100,
    });
    expect(result).toEqual({
      ok: true,
      betId: "bet-1",
      yesPool: 200,
      noPool: 100,
      impliedYes: 67,
      newBalance: 900,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/market/${MARKET_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid stakes before any network call", async () => {
    for (const amount of [0, -5, 501, 2.5]) {
      const result = await placeBet({ marketId: MARKET_ID, side: "no", amount });
      expect(result.ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 'market closed' to a friendly message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "market closed" } });

    const result = await placeBet({ marketId: MARKET_ID, side: "yes", amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/closed to new bets/i);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps 'insufficient balance' to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient balance" },
    });

    const result = await placeBet({ marketId: MARKET_ID, side: "yes", amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/enough HC/i);
  });

  it("maps the per-market cap to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "per-market cap of 500 HC exceeded" },
    });

    const result = await placeBet({ marketId: MARKET_ID, side: "yes", amount: 400 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/500 HC per market/i);
  });

  it("surfaces unknown RPC errors as-is", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await placeBet({ marketId: MARKET_ID, side: "yes", amount: 10 });

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
