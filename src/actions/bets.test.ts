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
const OUTCOME_ID = "7f9619ff-8b86-4d01-b42d-00cf4fc964ff";

const RPC_OUTCOMES = [
  { id: OUTCOME_ID, label: "Yes", sort_order: 0, pool: 300, implied: 67 },
  { id: "8f9619ff-8b86-4d01-b42d-00cf4fc964ff", label: "No", sort_order: 1, pool: 150, implied: 33 },
];

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({
    data: {
      bet_id: "bet-1",
      new_balance: 900,
      outcomes: RPC_OUTCOMES,
    },
    error: null,
  });
});

describe("placeBet", () => {
  it("calls the place_bet RPC with the outcome id and returns the full outcome map", async () => {
    const result = await placeBet({
      marketId: MARKET_ID,
      outcomeId: OUTCOME_ID,
      amount: 100,
    });

    expect(rpc).toHaveBeenCalledWith("place_bet", {
      p_market_id: MARKET_ID,
      p_outcome_id: OUTCOME_ID,
      p_amount: 100,
    });
    expect(result).toEqual({
      ok: true,
      outcomes: [
        { id: OUTCOME_ID, label: "Yes", sortOrder: 0, pool: 300, implied: 67 },
        {
          id: "8f9619ff-8b86-4d01-b42d-00cf4fc964ff",
          label: "No",
          sortOrder: 1,
          pool: 150,
          implied: 33,
        },
      ],
      newBalance: 900,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/market/${MARKET_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid stakes before any network call", async () => {
    for (const amount of [0, -5, 501, 2.5]) {
      const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount });
      expect(result.ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty outcome id before any network call", async () => {
    const result = await placeBet({ marketId: MARKET_ID, outcomeId: "", amount: 10 });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 'market closed' to a friendly message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "market closed" } });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/closed to new bets/i);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps 'insufficient balance' to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient balance" },
    });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/enough HC/i);
  });

  it("maps the per-market cap to a friendly 'across all outcomes' message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "per-market cap of 500 HC exceeded" },
    });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 400 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/500 HC per market/i);
      expect(result.error).toMatch(/across all outcomes/i);
    }
  });

  it("maps an out-of-market outcome to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "outcome does not belong to this market" },
    });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/doesn't belong to this market/i);
  });

  it("maps 'creator cannot bet' to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "creator cannot bet on own market" },
    });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/can't bet on a market you created/i);
  });

  it("surfaces unknown RPC errors as-is", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await placeBet({ marketId: MARKET_ID, outcomeId: OUTCOME_ID, amount: 10 });

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
