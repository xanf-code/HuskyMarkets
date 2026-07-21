import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

function req(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects home after exchanging the code when no next param is present", async () => {
    const res = await GET(req("/auth/callback?code=abc"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects to the validated next return path", async () => {
    const res = await GET(
      req("/auth/callback?code=abc&next=%2Fmarket%2Fabc-123"),
    );

    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/market/abc-123",
    );
  });

  it("rejects a protocol-relative next path (open-redirect guard)", async () => {
    const res = await GET(req("/auth/callback?code=abc&next=%2F%2Fevil.com"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("returns to /login when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "expired" },
    });
    const res = await GET(req("/auth/callback?code=abc&next=%2Fmarket%2Fabc"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("returns to /login when no code is present", async () => {
    const res = await GET(req("/auth/callback"));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
