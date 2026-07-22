import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatformVolume } from "./platform-volume";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPlatformVolume", () => {
  it("returns the all-time sum of bet amounts from the RPC", async () => {
    rpc.mockResolvedValue({ data: 12_450, error: null });

    await expect(getPlatformVolume()).resolves.toBe(12_450);
    expect(rpc).toHaveBeenCalledWith("get_platform_volume");
  });

  it("returns 0 when the platform has no bets yet", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    await expect(getPlatformVolume()).resolves.toBe(0);
  });

  it("returns 0 on RPC error so the home page still renders", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getPlatformVolume()).resolves.toBe(0);
  });

  it("coerces a null payload to 0", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getPlatformVolume()).resolves.toBe(0);
  });
});
