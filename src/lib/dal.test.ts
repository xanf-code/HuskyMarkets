import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, redirect } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

// `cache()` is identity outside an RSC render, so mock it as a passthrough.
// We do not assert memoization counts (see plan: Tests section).
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

// Imported after the mocks are registered.
const { getSession, verifySession } = await import("./dal");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("maps verified claims to a session", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "husky@northeastern.edu" } },
      error: null,
    });

    expect(await getSession()).toEqual({
      userId: "user-1",
      email: "husky@northeastern.edu",
    });
  });

  it("defaults a missing email claim to null", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });

    expect(await getSession()).toEqual({ userId: "user-1", email: null });
  });

  it("returns null for the no-session case ({ data: null, error: null })", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    expect(await getSession()).toBeNull();
  });

  it("returns null when getClaims errors", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: { message: "bad jwt" },
    });

    expect(await getSession()).toBeNull();
  });

  it("returns null when the claims carry no subject", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { email: "husky@northeastern.edu" } },
      error: null,
    });

    expect(await getSession()).toBeNull();
  });
});

describe("verifySession", () => {
  it("returns the session for an authenticated request", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: null } },
      error: null,
    });

    expect(await verifySession()).toEqual({ userId: "user-1", email: null });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    await verifySession();

    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
