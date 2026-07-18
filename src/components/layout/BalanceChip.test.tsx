import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BalanceChip } from "./BalanceChip";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

beforeEach(() => {
  rpc.mockReset();
});

describe("BalanceChip", () => {
  it("shows the ledger balance with thousands separators", async () => {
    rpc.mockResolvedValue({ data: 1050, error: null });

    render(await BalanceChip());

    expect(rpc).toHaveBeenCalledWith("get_my_balance");
    expect(screen.getByText("1,050 HC")).toBeInTheDocument();
  });

  it("falls back to 0 HC when the balance cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    render(await BalanceChip());

    expect(screen.getByText("0 HC")).toBeInTheDocument();
  });
});
