import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReport } from "./reports";

const { getSession, from, revalidatePath } = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({ getSession }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

const MARKET_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ userId: "user-1", email: null });
});

describe("submitReport", () => {
  it("rejects empty reasons before any network call", async () => {
    const result = await submitReport({ marketId: MARKET_ID, reason: "  " });
    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts an open report for the signed-in user", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    const result = await submitReport({
      marketId: MARKET_ID,
      reason: "Looks like it targets a student by name.",
    });

    expect(result).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("reports");
    expect(insert).toHaveBeenCalledWith({
      market_id: MARKET_ID,
      reporter_id: "user-1",
      reason: "Looks like it targets a student by name.",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/market/${MARKET_ID}`);
  });

  it("maps the unique open-report conflict to a friendly message", async () => {
    from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key" },
      }),
    });

    const result = await submitReport({
      marketId: MARKET_ID,
      reason: "Already reported this one.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already have an open report/i);
  });
});
