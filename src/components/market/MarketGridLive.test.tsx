import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketGridLive } from "./MarketGridLive";

type Handler = (payload: { new: Record<string, unknown> }) => void;

const { supabase, channel, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();
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
  };
  return { supabase, channel, handlers };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const market = (id: string, title: string): MarketListItem => ({
  id,
  title,
  category: "weather",
  closeAt: new Date(Date.now() + 86_400_000).toISOString(),
  createdAt: "2026-07-10T00:00:00Z",
  outcomes: [
    { id: `${id}-yes`, label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
    { id: `${id}-no`, label: "No", sortOrder: 1, pool: 100, implied: 33 },
  ],
  volume: 100,
  bettorCount: 2,
  spark: [50, 67],
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
});

describe("MarketGridLive", () => {
  it("subscribes once to markets and market_outcomes UPDATE channels", () => {
    render(<MarketGridLive initial={[market("m1", "Snow before finals?")]} />);

    expect(supabase.channel).toHaveBeenCalledWith("markets:list");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "markets" }),
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "market_outcomes" }),
      expect.any(Function),
    );
  });

  it("patches the matching card's price and volume on an outcome UPDATE", () => {
    render(<MarketGridLive initial={[market("m1", "Snow before finals?")]} />);
    expect(screen.getAllByText("67%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /yes.+67%/i })).toBeInTheDocument();

    act(() => {
      handlers.get("market_outcomes:UPDATE")!({
        new: { id: "m1-no", market_id: "m1", pool: 300 },
      });
    });

    // No now leads 300/500 → 60%; Yes 40%
    expect(screen.getAllByText("60%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /yes.+40%/i })).toBeInTheDocument();
    expect(screen.getByLabelText("300 HC")).toBeInTheDocument();
  });

  it("drops a card when its market closes", () => {
    render(
      <MarketGridLive
        initial={[
          market("m1", "Snow before finals?"),
          market("m2", "Beanpot final?"),
        ]}
      />,
    );

    act(() => {
      handlers.get("markets:UPDATE")!({ new: { id: "m1", status: "closed" } });
    });

    expect(screen.queryByText("Snow before finals?")).not.toBeInTheDocument();
    expect(screen.getByText("Beanpot final?")).toBeInTheDocument();
  });

  it("windows a long list behind a scroll sentinel", () => {
    const initial = Array.from({ length: 10 }, (_, i) =>
      market(`m${i}`, `Market ${i}`),
    );
    render(<MarketGridLive initial={initial} />);

    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent("4 more");
  });

  it("removes the channel on unmount", () => {
    const { unmount } = render(<MarketGridLive initial={[]} />);

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
