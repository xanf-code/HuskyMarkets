import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeSemester,
  handleReportAction,
  reopenSemester,
  resolveMarketAction,
  reviewModApplication,
  setMarketHidden,
} from "./admin";

const { rpc, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

const MARKET_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const REPORT_ID = "7f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const APP_ID = "8f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const SEMESTER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

const WINNING_OUTCOME_ID = "9f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("resolveMarketAction", () => {
  it("resolves with an explicit action + winning outcome and revalidates queues", async () => {
    const result = await resolveMarketAction({
      marketId: MARKET_ID,
      action: "resolve",
      winningOutcomeId: WINNING_OUTCOME_ID,
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("resolve_market", {
      p_market_id: MARKET_ID,
      p_action: "resolve",
      p_winning_outcome_id: WINNING_OUTCOME_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/resolve");
    expect(revalidatePath).toHaveBeenCalledWith("/mod");
  });

  it("voids without a winning outcome", async () => {
    const result = await resolveMarketAction({
      marketId: MARKET_ID,
      action: "void",
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("resolve_market", {
      p_market_id: MARKET_ID,
      p_action: "void",
      p_winning_outcome_id: undefined,
    });
  });

  it("requires a winning outcome when resolving", async () => {
    const result = await resolveMarketAction({
      marketId: MARKET_ID,
      action: "resolve",
    });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown action", async () => {
    const result = await resolveMarketAction({
      marketId: MARKET_ID,
      action: "yes",
      winningOutcomeId: WINNING_OUTCOME_ID,
    });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps conflict-of-interest errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "conflict of interest: you created this market" },
    });
    const result = await resolveMarketAction({
      marketId: MARKET_ID,
      action: "resolve",
      winningOutcomeId: WINNING_OUTCOME_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/created this market/i);
  });
});

describe("handleReportAction", () => {
  it("calls handle_report with dismiss or action", async () => {
    await handleReportAction({ reportId: REPORT_ID, action: "dismiss" });
    expect(rpc).toHaveBeenCalledWith("handle_report", {
      p_report_id: REPORT_ID,
      p_action: "dismiss",
      p_note: undefined,
    });
  });
});

describe("reviewModApplication", () => {
  it("calls review_mod_application", async () => {
    const result = await reviewModApplication({
      applicationId: APP_ID,
      decision: "approve",
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("review_mod_application", {
      p_application_id: APP_ID,
      p_decision: "approve",
    });
  });

  it("surfaces admin-only rejection", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "admin only" },
    });
    const result = await reviewModApplication({
      applicationId: APP_ID,
      decision: "reject",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/admins/i);
  });
});

describe("setMarketHidden", () => {
  it("calls set_market_hidden", async () => {
    await setMarketHidden({ marketId: MARKET_ID, hidden: true });
    expect(rpc).toHaveBeenCalledWith("set_market_hidden", {
      p_market_id: MARKET_ID,
      p_hidden: true,
    });
  });
});

describe("closeSemester", () => {
  it("calls snapshot_semester and revalidates", async () => {
    const result = await closeSemester({ semesterId: SEMESTER_ID });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("snapshot_semester", {
      p_semester_id: SEMESTER_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/semesters");
    expect(revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });
});

describe("reopenSemester", () => {
  it("calls reopen_semester and revalidates", async () => {
    const result = await reopenSemester({ semesterId: SEMESTER_ID });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("reopen_semester", {
      p_semester_id: SEMESTER_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/semesters");
    expect(revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });

  it("surfaces admin-only rejection", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "admin only" },
    });
    const result = await reopenSemester({ semesterId: SEMESTER_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/admins/i);
  });
});
