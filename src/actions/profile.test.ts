import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboarding, rerollAnonHandle } from "./profile";

const { getUser, update, eq, rpc, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ update }),
    rpc,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  update.mockReturnValue({ eq });
  eq.mockResolvedValue({ error: null });
});

describe("completeOnboarding", () => {
  it("stores an anonymous choice and flips onboarded", async () => {
    const result = await completeOnboarding({ displayMode: "anon" });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      display_mode: "anon",
      real_name: null,
      onboarded: true,
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("stores the real name when the real display mode is chosen", async () => {
    const result = await completeOnboarding({
      displayMode: "real",
      realName: "  Dana Husky  ",
    });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      display_mode: "real",
      real_name: "Dana Husky",
      onboarded: true,
    });
  });

  it("rejects the real display mode without a name, before any write", async () => {
    const result = await completeOnboarding({ displayMode: "real" });

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("fails when there is no signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await completeOnboarding({ displayMode: "anon" });

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("surfaces a database error", async () => {
    eq.mockResolvedValue({ error: { message: "boom" } });

    const result = await completeOnboarding({ displayMode: "anon" });

    expect(result).toEqual({ ok: false, error: "boom" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rerollAnonHandle", () => {
  it("returns the freshly generated handle from the RPC", async () => {
    rpc.mockResolvedValue({ data: "FrostyHusky42", error: null });

    const result = await rerollAnonHandle();

    expect(rpc).toHaveBeenCalledWith("reroll_anon_handle");
    expect(result).toEqual({ ok: true, handle: "FrostyHusky42" });
  });

  it("surfaces an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });

    const result = await rerollAnonHandle();

    expect(result).toEqual({ ok: false, error: "nope" });
  });
});
