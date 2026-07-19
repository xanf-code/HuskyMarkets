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
  yesPool: 200,
  noPool: 100,
  impliedYes: 67,
  volume: 100,
  spark: [50, 67],
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
});

describe("MarketGridLive", () => {
  it("subscribes once to an unfiltered markets:list UPDATE channel", () => {
    render(<MarketGridLive initial={[market("m1", "Snow before finals?")]} />);

    expect(supabase.channel).toHaveBeenCalledWith("markets:list");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "markets" }),
      expect.any(Function),
    );
  });

  it("patches the matching card's price and volume on UPDATE", () => {
    render(<MarketGridLive initial={[market("m1", "Snow before finals?")]} />);
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /yes\s+67¢/i })).toBeInTheDocument();

    act(() => {
      handlers.get("markets:UPDATE")!({
        new: { id: "m1", yes_pool: 100, no_pool: 300, status: "open" },
      });
    });

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /yes\s+25¢/i })).toBeInTheDocument();
    expect(screen.getByText(/200 HC vol/)).toBeInTheDocument();
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
