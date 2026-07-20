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
  outcomes: [
    { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
    { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 },
  ],
  status: "open" as const,
  winningOutcomeId: null,
  history: [{ recordedAt: "2026-07-18T10:00:00Z", outcomeId: "o-yes", price: 67 }],
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
  it("opens one market:{id} channel with the four scoped listeners", () => {
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
        event: "UPDATE",
        table: "market_outcomes",
        filter: "market_id=eq.m1",
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

  it("applies markets UPDATE payloads to status and winning outcome only", () => {
    const { result } = renderChannel();

    act(() => {
      handlers.get("markets:UPDATE")!({
        new: { status: "resolved", winning_outcome_id: "o-yes" },
      });
    });

    expect(result.current.market.status).toBe("resolved");
    expect(result.current.market.winningOutcomeId).toBe("o-yes");
    expect(result.current.market.outcomes).toEqual(initial.outcomes);
  });

  it("applies market_outcomes UPDATE payloads to pools and prices", () => {
    const { result } = renderChannel();

    act(() => {
      handlers.get("market_outcomes:UPDATE")!({
        new: { id: "o-yes", market_id: "m1", pool: 300 },
      });
    });

    expect(result.current.market.outcomes).toEqual([
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 300, implied: 75 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 25 },
    ]);
  });

  it("prepends bets INSERTs to activity with the outcome label resolved client-side", async () => {
    const { result } = renderChannel();

    await act(async () => {
      handlers.get("bets:INSERT")!({
        new: {
          id: "b9",
          user_id: "u1",
          outcome_id: "o-no",
          amount: 75,
          price_at_bet: 33,
          created_at: "2026-07-18T11:00:00Z",
        },
      });
    });

    expect(result.current.activity[0]).toEqual({
      id: "b9",
      displayName: "CunningHusky42",
      outcomeId: "o-no",
      outcomeLabel: "No",
      amount: 75,
      price: 33,
      createdAt: "2026-07-18T11:00:00Z",
    });
  });

  it("appends price_history INSERTs to the chart series", () => {
    const { result } = renderChannel();

    act(() => {
      handlers.get("price_history:INSERT")!({
        new: {
          recorded_at: "2026-07-18T10:15:00Z",
          outcome_id: "o-no",
          implied: 44,
        },
      });
    });

    expect(result.current.history).toEqual([
      { recordedAt: "2026-07-18T10:00:00Z", outcomeId: "o-yes", price: 67 },
      { recordedAt: "2026-07-18T10:15:00Z", outcomeId: "o-no", price: 44 },
    ]);
  });

  it("applies optimistic fills from the order panel", () => {
    const { result } = renderChannel();
    const filled = [
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 300, implied: 75 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 25 },
    ];

    act(() => {
      result.current.applyFill({ outcomes: filled });
    });

    expect(result.current.market.outcomes).toEqual(filled);
    expect(result.current.market.status).toBe("open");
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderChannel();

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
