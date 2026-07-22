import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMarket, updateMarket, deleteOwnMarket, lockOwnMarket } from "./markets";

const { getSession, rpc, from, revalidatePath } = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({ getSession }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

const reportInsert = vi.fn();

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Will it snow in Boston before finals week?",
    description: "First measurable snowfall on campus.",
    category: "weather",
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    resolveAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    resolutionCriteria:
      "Resolves YES if NWS Boston records at least 0.1in of snow.",
    outcomes: ["Yes", "No"],
    catchAll: false,
    agreeRules: true,
    ...overrides,
  };
}

function mockConfigCap(cap: number) {
  from.mockImplementation((table: string) => {
    if (table === "app_config") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { int_val: cap }, error: null }),
          }),
        }),
      };
    }
    return { insert: reportInsert };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ userId: "user-1", email: null });
  rpc.mockResolvedValue({
    data: { market_id: "market-1", outcomes: [] },
    error: null,
  });
  reportInsert.mockResolvedValue({ error: null });
  // Default: app_config returns max_outcomes=6 (the seed value).
  mockConfigCap(6);
});

describe("createMarket", () => {
  it("creates via the create_market RPC with the outcome labels", async () => {
    const result = await createMarket(validInput());

    expect(result).toEqual({ ok: true, marketId: "market-1" });
    expect(rpc).toHaveBeenCalledWith(
      "create_market",
      expect.objectContaining({
        p_title: "Will it snow in Boston before finals week?",
        p_category: "weather",
        p_outcomes: ["Yes", "No"],
        p_catch_all: false,
        p_auto_flagged: false,
      }),
    );
    expect(reportInsert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("passes the catch-all toggle through to the RPC", async () => {
    await createMarket(
      validInput({ outcomes: ["A", "B", "C", "D", "E"], catchAll: true }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_market",
      expect.objectContaining({ p_catch_all: true }),
    );
  });

  it("rejects fewer than 2 or more than 6 outcomes before any network call", async () => {
    expect((await createMarket(validInput({ outcomes: ["Only"] }))).ok).toBe(false);
    expect(
      (await createMarket(validInput({ outcomes: ["1", "2", "3", "4", "5", "6", "7"] }))).ok,
    ).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects blank and over-long labels before any network call", async () => {
    expect((await createMarket(validInput({ outcomes: ["Yes", "   "] }))).ok).toBe(false);
    expect(
      (await createMarket(validInput({ outcomes: ["Yes", "x".repeat(41)] }))).ok,
    ).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects case-insensitively duplicated labels", async () => {
    const result = await createMarket(validInput({ outcomes: ["Yes", "yes"] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unique/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a creator label that collides with the catch-all", async () => {
    const result = await createMarket(
      validInput({ outcomes: ["Yes", "None of the above"], catchAll: true }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/catch-all/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects before any network call when the rules box is unchecked", async () => {
    const result = await createMarket(validInput({ agreeRules: false }));

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a close time in the past", async () => {
    const result = await createMarket(
      validInput({ closeAt: new Date(Date.now() - 1000).toISOString() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/future/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a resolve time before the close time", async () => {
    const result = await createMarket(
      validInput({
        resolveAt: new Date(Date.now() + 3_600_000).toISOString(),
        closeAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hard-blocks slur content with a message and no RPC call", async () => {
    const result = await createMarket(
      validInput({ title: "Will the retard in my lecture fail the midterm?" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/community standards/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hard-blocks slur content in an outcome label", async () => {
    const result = await createMarket(
      validInput({ outcomes: ["Yes", "The retard wins"] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/community standards/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates flagged-but-allowed content with auto_flagged and an auto-report", async () => {
    const result = await createMarket(
      validInput({
        title: "Will Jake Thompson hook up with anyone at the formal?",
      }),
    );

    expect(result).toEqual({ ok: true, marketId: "market-1" });
    expect(rpc).toHaveBeenCalledWith(
      "create_market",
      expect.objectContaining({ p_auto_flagged: true }),
    );
    expect(reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        market_id: "market-1",
        reporter_id: "user-1",
        reason: "auto: possible targeting of an individual",
      }),
    );
  });

  it("flags on a person-targeting outcome label even when the title is clean", async () => {
    const result = await createMarket(
      validInput({ outcomes: ["Jake Thompson hooks up", "He does not"] }),
    );

    expect(result).toEqual({ ok: true, marketId: "market-1" });
    expect(rpc).toHaveBeenCalledWith(
      "create_market",
      expect.objectContaining({ p_auto_flagged: true }),
    );
  });

  it("requires a session", async () => {
    getSession.mockResolvedValue(null);

    const result = await createMarket(validInput());

    expect(result).toEqual({ ok: false, error: "Not signed in." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await createMarket(validInput());

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});

describe("createMarket - runtime cap from app_config (W1 / S7-3)", () => {
  it("enforces cap=2 - 3 outcomes are rejected before any RPC call", async () => {
    mockConfigCap(2);

    const result = await createMarket(validInput({ outcomes: ["A", "B", "C"] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at most 2/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts exactly 2 outcomes when cap=2", async () => {
    mockConfigCap(2);

    const result = await createMarket(validInput({ outcomes: ["A", "B"] }));

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalled();
  });

  it("falls back to MAX_OUTCOMES when app_config query returns no row", async () => {
    from.mockImplementation((table: string) => {
      if (table === "app_config") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { message: "no rows" } }),
            }),
          }),
        };
      }
      return { insert: reportInsert };
    });

    // 7 outcomes still rejected under the fallback cap of 6.
    const over = await createMarket(
      validInput({ outcomes: ["1", "2", "3", "4", "5", "6", "7"] }),
    );
    expect(over.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();

    // 6 outcomes succeed under the fallback cap.
    const at = await createMarket(
      validInput({ outcomes: ["1", "2", "3", "4", "5", "6"] }),
    );
    expect(at.ok).toBe(true);
  });
});

// ── updateMarket ─────────────────────────────────────────────────────────

function validUpdateInput(overrides: Record<string, unknown> = {}) {
  return {
    marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    title: "Will it snow in Boston before finals week?",
    description: "First measurable snowfall on campus.",
    category: "weather",
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    resolveAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    resolutionCriteria:
      "Resolves YES if NWS Boston records at least 0.1in of snow.",
    outcomes: ["Yes", "No"],
    catchAll: false,
    agreeRules: true,
    ...overrides,
  };
}

describe("updateMarket", () => {
  it("calls update_market RPC with the market id and fields", async () => {
    const result = await updateMarket(validUpdateInput());

    expect(result).toEqual({
      ok: true,
      marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });
    expect(rpc).toHaveBeenCalledWith(
      "update_market",
      expect.objectContaining({
        p_market_id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
        p_title: "Will it snow in Boston before finals week?",
        p_outcomes: ["Yes", "No"],
        p_catch_all: false,
        p_auto_flagged: false,
      }),
    );
  });

  it("maps 'market has bets' RPC error to a friendly message", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "market has bets" } });

    const result = await updateMarket(validUpdateInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/bets/i);
  });

  it("maps 'not allowed' RPC error to a friendly message", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "not allowed" } });

    const result = await updateMarket(validUpdateInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
  });

  it("rejects without a valid marketId", async () => {
    const result = await updateMarket(validUpdateInput({ marketId: "not-a-uuid" }));

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSession.mockResolvedValueOnce(null);

    const result = await updateMarket(validUpdateInput());

    expect(result).toEqual({ ok: false, error: "Not signed in." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ── deleteOwnMarket ──────────────────────────────────────────────────────

describe("deleteOwnMarket", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("calls resolve_market with action=void", async () => {
    const result = await deleteOwnMarket({
      marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("resolve_market", {
      p_market_id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
      p_action: "void",
    });
  });

  it("surfaces RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "staff only" } });

    const result = await deleteOwnMarket({
      marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("staff only");
  });

  it("rejects an invalid market id", async () => {
    const result = await deleteOwnMarket({ marketId: "bad" });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ── lockOwnMarket ────────────────────────────────────────────────────────

describe("lockOwnMarket", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("calls lock_market with the market id", async () => {
    const result = await lockOwnMarket({
      marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("lock_market", {
      p_market_id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });
  });

  it("surfaces RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "market is not open" } });

    const result = await lockOwnMarket({
      marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("market is not open");
  });

  it("rejects an invalid market id", async () => {
    const result = await lockOwnMarket({ marketId: "" });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
