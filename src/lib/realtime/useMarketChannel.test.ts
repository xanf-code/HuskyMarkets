import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMarketChannel } from "./useMarketChannel";

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
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  };
  return { supabase, channel, handlers, maybeSingle };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));

const initial = {
  yesPool: 200,
  noPool: 100,
  status: "open" as const,
  history: [{ recordedAt: "2026-07-18T10:00:00Z", price: 67 }],
  activity: [],
};

function renderChannel() {
  return renderHook(() => useMarketChannel({ marketId: "m1", initial }));
}

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  maybeSingle.mockResolvedValue({ data: { display_name: "CunningHusky42" } });
});

describe("useMarketChannel", () => {
  it("opens one market:{id} channel with the three scoped listeners", () => {
    renderChannel();

    expect(supabase.channel).toHaveBeenCalledWith("market:m1");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        table: "markets",
        filter: "id=eq.m1",
      }),
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        table: "bets",
        filter: "market_id=eq.m1",
      }),
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        table: "price_history",
        filter: "market_id=eq.m1",
      }),
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it("applies markets UPDATE payloads to pools and status", () => {
    const { result } = renderChannel();

    act(() => {
      handlers.get("markets:UPDATE")!({
        new: { yes_pool: 300, no_pool: 150, status: "closed" },
      });
    });

    expect(result.current.market).toEqual({
      yesPool: 300,
      noPool: 150,
      status: "closed",
    });
  });

  it("prepends bets INSERTs to activity with the resolved display name", async () => {
    const { result } = renderChannel();

    await act(async () => {
      handlers.get("bets:INSERT")!({
        new: {
          id: "b9",
          user_id: "u1",
          side: "no",
          amount: 75,
          price_at_bet: 33,
          created_at: "2026-07-18T11:00:00Z",
        },
      });
    });

    expect(result.current.activity[0]).toEqual({
      id: "b9",
      displayName: "CunningHusky42",
      side: "no",
      amount: 75,
      price: 33,
      createdAt: "2026-07-18T11:00:00Z",
    });
  });

  it("appends price_history INSERTs to the chart series", () => {
    const { result } = renderChannel();

    act(() => {
      handlers.get("price_history:INSERT")!({
        new: { recorded_at: "2026-07-18T10:15:00Z", implied_yes: 44 },
      });
    });

    expect(result.current.history).toEqual([
      { recordedAt: "2026-07-18T10:00:00Z", price: 67 },
      { recordedAt: "2026-07-18T10:15:00Z", price: 44 },
    ]);
  });

  it("applies optimistic fills from the order panel", () => {
    const { result } = renderChannel();

    act(() => {
      result.current.applyFill({ yesPool: 300, noPool: 100 });
    });

    expect(result.current.market).toEqual({
      yesPool: 300,
      noPool: 100,
      status: "open",
    });
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderChannel();

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
