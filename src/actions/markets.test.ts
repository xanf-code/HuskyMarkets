import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMarket } from "./markets";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

const marketInsert = vi.fn();
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
    agreeRules: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  marketInsert.mockReturnValue({
    select: () => ({
      single: async () => ({ data: { id: "market-1" }, error: null }),
    }),
  });
  reportInsert.mockResolvedValue({ error: null });
  from.mockImplementation((table: string) =>
    table === "markets" ? { insert: marketInsert } : { insert: reportInsert },
  );
});

describe("createMarket", () => {
  it("inserts a clean market unflagged and revalidates the grid", async () => {
    const result = await createMarket(validInput());

    expect(result).toEqual({ ok: true, marketId: "market-1" });
    expect(marketInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: "user-1",
        auto_flagged: false,
        category: "weather",
      }),
    );
    expect(reportInsert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("rejects before any network call when the rules box is unchecked", async () => {
    const result = await createMarket(validInput({ agreeRules: false }));

    expect(result.ok).toBe(false);
    expect(marketInsert).not.toHaveBeenCalled();
  });

  it("rejects a close time in the past", async () => {
    const result = await createMarket(
      validInput({ closeAt: new Date(Date.now() - 1000).toISOString() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/future/i);
    expect(marketInsert).not.toHaveBeenCalled();
  });

  it("rejects a resolve time before the close time", async () => {
    const result = await createMarket(
      validInput({
        resolveAt: new Date(Date.now() + 3_600_000).toISOString(),
        closeAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );

    expect(result.ok).toBe(false);
    expect(marketInsert).not.toHaveBeenCalled();
  });

  it("hard-blocks slur content with a message and no insert", async () => {
    const result = await createMarket(
      validInput({ title: "Will the retard in my lecture fail the midterm?" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/community standards/i);
    expect(marketInsert).not.toHaveBeenCalled();
  });

  it("creates flagged-but-allowed content with auto_flagged and an auto-report", async () => {
    const result = await createMarket(
      validInput({
        title: "Will Jake Thompson hook up with anyone at the formal?",
      }),
    );

    expect(result).toEqual({ ok: true, marketId: "market-1" });
    expect(marketInsert).toHaveBeenCalledWith(
      expect.objectContaining({ auto_flagged: true }),
    );
    expect(reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        market_id: "market-1",
        reporter_id: "user-1",
        reason: "auto: possible targeting of an individual",
      }),
    );
  });

  it("surfaces a database error", async () => {
    marketInsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: null, error: { message: "boom" } }),
      }),
    });

    const result = await createMarket(validInput());

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
