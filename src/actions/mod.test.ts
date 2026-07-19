import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyForModerator } from "./mod";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("applyForModerator", () => {
  it("rejects short statements before any network call", async () => {
    const result = await applyForModerator({ statement: "hi" });
    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a pending application", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    const result = await applyForModerator({
      statement: "I want to help keep campus markets fair and well-sourced.",
    });

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      statement: "I want to help keep campus markets fair and well-sourced.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("maps duplicate pending applications to a friendly message", async () => {
    from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key" },
      }),
    });

    const result = await applyForModerator({
      statement: "I already applied once this semester and still care.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already have a pending/i);
  });
});
