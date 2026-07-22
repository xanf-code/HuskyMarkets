import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveVolumeCounter } from "./LiveVolumeCounter";

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
    rpc: vi.fn(),
  };
  return { supabase, channel, handlers };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));

function renderCounter(
  initialVolume = 1_050,
  durationMs = 400,
) {
  return render(
    <LiveVolumeCounter initialVolume={initialVolume} durationMs={durationMs} />,
  );
}

async function emitOutcomeUpdate() {
  await act(async () => {
    handlers.get("market_outcomes:UPDATE")!({
      new: { id: "o1", pool: 200 },
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "requestAnimationFrame", "cancelAnimationFrame"] });
  supabase.rpc.mockResolvedValue({ data: 1_250, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LiveVolumeCounter", () => {
  it("renders the initial platform volume with a live label", () => {
    renderCounter();

    expect(screen.getByText(/volume traded/i)).toBeInTheDocument();
    expect(screen.getByLabelText("1,050 HC")).toBeInTheDocument();
  });

  it("subscribes to market_outcomes updates so guests see live volume", () => {
    renderCounter();

    expect(supabase.channel).toHaveBeenCalledWith("platform:volume");
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        table: "market_outcomes",
      }),
      expect.any(Function),
    );
  });

  it("refetches platform volume and counts up over durationMs", async () => {
    renderCounter(1_050, 400);

    await emitOutcomeUpdate();
    expect(supabase.rpc).toHaveBeenCalledWith("get_platform_volume");

    // Mid-animation: past the start, not yet at the target (visual digits).
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("1,050")).not.toBeInTheDocument();
    expect(screen.queryByText("1,250")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText("1,250")).toBeInTheDocument();
    // Settled target is what assistive tech hears — not every tick.
    expect(screen.getByLabelText("1,250 HC")).toBeInTheDocument();
  });

  it("reserves slot width for the wider of displayed and target amounts", () => {
    renderCounter(999);

    const slot = screen.getByTestId("volume-slot");
    // "1,000" is 5 chars once a later tick could cross the comma boundary;
    // initial 999 is 3 — slot uses the displayed amount at least.
    expect(slot.style.minWidth).toBe("3ch");
  });

  it("widens the slot to the target when a larger volume arrives", async () => {
    renderCounter(999, 400);
    supabase.rpc.mockResolvedValue({ data: 1_000, error: null });

    await emitOutcomeUpdate();
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId("volume-slot").style.minWidth).toBe("5ch");
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderCounter();
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
