import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { LiveBalance } from "./LiveBalance";

type Handler = (payload: { new: Record<string, unknown> }) => void;

const { supabase, channel, handlers, maybeSingle } = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();
  const maybeSingle = vi.fn();
  const channel = {
    on: vi.fn(
      (
        _type: string,
        config: { table: string; event: string },
        callback: Handler,
      ) => {
        handlers.set(`${config.table}:${config.event}`, callback);
        return channel;
      },
    ),
    subscribe: vi.fn(() => channel),
  };
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  };
  return { supabase, channel, handlers, maybeSingle };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));

function renderChip(userId: string | null = "u1") {
  return render(
    <ToastProvider>
      <LiveBalance initialBalance={1050} userId={userId} />
    </ToastProvider>,
  );
}

async function emitTransaction(tx: Record<string, unknown>) {
  await act(async () => {
    handlers.get("transactions:INSERT")!({ new: tx });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  supabase.rpc.mockResolvedValue({ data: 1208, error: null });
  maybeSingle.mockResolvedValue({
    data: { title: "Will it snow?", status: "resolved", winning_outcome_id: "o-yes" },
  });
});

describe("LiveBalance", () => {
  it("renders the initial balance and subscribes to the user's transactions", () => {
    renderChip();

    expect(screen.getByLabelText("1,050 HC")).toBeInTheDocument();
    expect(supabase.channel).toHaveBeenCalledWith("transactions:u1");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        table: "transactions",
        filter: "user_id=eq.u1",
      }),
      expect.any(Function),
    );
  });

  it("refetches the ledger balance on any transaction insert", async () => {
    renderChip();

    await emitTransaction({ type: "bet_place", amount: -50, market_id: "m1" });

    expect(supabase.rpc).toHaveBeenCalledWith("get_my_balance");
    expect(screen.getByLabelText("1,208 HC")).toBeInTheDocument();
    // ordinary spends do not toast
    expect(screen.queryByText(/resolved/)).not.toBeInTheDocument();
  });

  it("toasts payouts with the winning outcome's label", async () => {
    maybeSingle
      .mockResolvedValueOnce({
        data: {
          title: "Will it snow?",
          status: "resolved",
          winning_outcome_id: "o-yes",
        },
      })
      .mockResolvedValueOnce({ data: { label: "Yes" } });
    renderChip();

    await emitTransaction({ type: "bet_payout", amount: 158, market_id: "m1" });

    expect(
      screen.getByText('+158 HC — "Will it snow?" resolved Yes'),
    ).toBeInTheDocument();
  });

  it("does not subscribe when signed out", () => {
    renderChip(null);

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderChip();

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
