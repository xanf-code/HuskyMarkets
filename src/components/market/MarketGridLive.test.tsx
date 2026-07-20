import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketGridLive } from "./MarketGridLive";

vi.mock("./Sparkline", () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

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
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /yes\s+67¢/i })).toBeInTheDocument();

    act(() => {
      handlers.get("market_outcomes:UPDATE")!({
        new: { id: "m1-no", market_id: "m1", pool: 300 },
      });
    });

    // No now leads 300/500 → 60%; Yes 40¢
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /yes\s+40¢/i })).toBeInTheDocument();
    expect(screen.getByText(/300 HC vol/)).toBeInTheDocument();
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

  it("removes the channel on unmount", () => {
    const { unmount } = render(<MarketGridLive initial={[]} />);

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
