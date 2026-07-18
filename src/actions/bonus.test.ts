import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimBailout, claimDailyBonus } from "./bonus";

const { rpc, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimDailyBonus", () => {
  it("reports a fresh claim and refreshes the layout balance", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const result = await claimDailyBonus();

    expect(rpc).toHaveBeenCalledWith("claim_daily_bonus");
    expect(result).toEqual({ ok: true, claimed: true });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports an already-claimed day without refreshing anything", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const result = await claimDailyBonus();

    expect(result).toEqual({ ok: true, claimed: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await claimDailyBonus();

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});

describe("claimBailout", () => {
  it("reports a fresh bailout and refreshes the layout balance", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const result = await claimBailout();

    expect(rpc).toHaveBeenCalledWith("claim_bailout");
    expect(result).toEqual({ ok: true, claimed: true });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports an already-claimed week", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const result = await claimBailout();

    expect(result).toEqual({ ok: true, claimed: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps the balance-too-high SQL error to a friendly message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "bailout requires balance below 100 HC" },
    });

    const result = await claimBailout();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/below 100 HC/);
      expect(result.error).not.toMatch(/^bailout requires/);
    }
  });
});
