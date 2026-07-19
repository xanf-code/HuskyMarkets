import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BalanceChip } from "./BalanceChip";

const { rpc, getSession, liveBalance } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  liveBalance: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({ getSession }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

vi.mock("./LiveBalance", () => ({
  LiveBalance: (props: { initialBalance: number; userId: string | null }) => {
    liveBalance(props);
    return <div data-testid="live-balance" />;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ userId: "u1", email: null });
});

describe("BalanceChip", () => {
  it("seeds the live chip with the ledger balance and user id", async () => {
    rpc.mockResolvedValue({ data: 1050, error: null });

    render(await BalanceChip());

    expect(rpc).toHaveBeenCalledWith("get_my_balance");
    expect(liveBalance).toHaveBeenCalledWith({
      initialBalance: 1050,
      userId: "u1",
    });
  });

  it("falls back to 0 when the balance cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    render(await BalanceChip());

    expect(liveBalance).toHaveBeenCalledWith({
      initialBalance: 0,
      userId: "u1",
    });
  });
});
