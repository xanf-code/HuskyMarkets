import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ActivityItem } from "@/lib/queries/markets";
import {
  LiveActivity,
  LiveOrderPanel,
  LivePrice,
  LiveStats,
  LiveStatusBanner,
  MarketLiveProvider,
} from "./MarketLive";

const { useMarketChannel } = vi.hoisted(() => ({
  useMarketChannel: vi.fn(),
}));

vi.mock("@/lib/realtime/useMarketChannel", () => ({ useMarketChannel }));

const activity: ActivityItem[] = [
  {
    id: "b1",
    displayName: "CunningHusky42",
    side: "yes",
    amount: 50,
    price: 67,
    createdAt: new Date().toISOString(),
  },
];

const initial = {
  yesPool: 200,
  noPool: 100,
  status: "open" as const,
  history: [],
  activity: [],
};

function setChannelState(
  market: { yesPool: number; noPool: number; status: string },
  overrides: Record<string, unknown> = {},
) {
  useMarketChannel.mockReturnValue({
    market,
    history: [],
    activity,
    applyFill: vi.fn(),
    ...overrides,
  });
}

function renderLive(children: React.ReactNode) {
  return render(
    <ToastProvider>
      <MarketLiveProvider marketId="m1" initial={initial}>
        {children}
      </MarketLiveProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setChannelState({ yesPool: 200, noPool: 100, status: "open" });
});

describe("MarketLive", () => {
  it("renders the hero price from live pools", () => {
    renderLive(<LivePrice />);

    expect(screen.getByText("YES 67¢")).toBeInTheDocument();
  });

  it("renders live pools and volume in the stats", () => {
    setChannelState({ yesPool: 300, noPool: 150, status: "open" });
    renderLive(<LiveStats bettorCount={4} />);

    // volume = 450 − 200 seed
    expect(screen.getByText("250 HC")).toBeInTheDocument();
    expect(screen.getByText("300 / 150")).toBeInTheDocument();
  });

  it("renders the live activity feed", () => {
    renderLive(<LiveActivity />);

    expect(screen.getByText("CunningHusky42")).toBeInTheDocument();
  });

  it("shows the status banner and disables the order panel when the market resolves", () => {
    setChannelState({ yesPool: 200, noPool: 100, status: "resolved_yes" });
    renderLive(
      <>
        <LiveStatusBanner />
        <LiveOrderPanel
          marketId="m1"
          closeAt={new Date(Date.now() + 86_400_000).toISOString()}
          position={{ yes: 0, no: 0 }}
          balance={400}
        />
      </>,
    );

    expect(screen.getByText(/Resolved YES/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  it("shows no banner while the market is open", () => {
    renderLive(<LiveStatusBanner />);

    expect(screen.queryByText(/Resolved|Closed|Voided/)).not.toBeInTheDocument();
  });
});
