import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { OutcomeState } from "@/lib/outcomes";
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

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const YES: OutcomeState = { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 };
const NO: OutcomeState = { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 };

const activity: ActivityItem[] = [
  {
    id: "b1",
    outcomeId: "o-yes",
    outcomeLabel: "Yes",
    amount: 50,
    price: 67,
    createdAt: new Date().toISOString(),
  },
];

const initial = {
  outcomes: [YES, NO],
  status: "open" as const,
  winningOutcomeId: null,
  history: [],
  activity: [],
};

function setChannelState(
  market: { outcomes: OutcomeState[]; status: string; winningOutcomeId: string | null },
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
  setChannelState({ outcomes: [YES, NO], status: "open", winningOutcomeId: null });
});

describe("MarketLive", () => {
  it("renders the hero probability of the leading outcome", () => {
    renderLive(<LivePrice />);

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders live pools and volume in the stats", () => {
    setChannelState({
      outcomes: [
        { ...YES, pool: 300, implied: 67 },
        { ...NO, pool: 150, implied: 33 },
      ],
      status: "open",
      winningOutcomeId: null,
    });
    renderLive(<LiveStats bettorCount={4} />);

    // volume = 450 − 200 seed
    expect(screen.getByLabelText("250 HC")).toBeInTheDocument();
    expect(screen.getByText("Yes 300 / No 150")).toBeInTheDocument();
  });

  it("renders the live activity feed", () => {
    renderLive(<LiveActivity />);

    expect(screen.getByText("Bought")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("shows the winning label and disables the order panel when the market resolves", () => {
    setChannelState({
      outcomes: [YES, NO],
      status: "resolved",
      winningOutcomeId: "o-yes",
    });
    renderLive(
      <>
        <LiveStatusBanner />
        <LiveOrderPanel
          marketId="m1"
          closeAt={new Date(Date.now() + 86_400_000).toISOString()}
          position={[]}
          balance={400}
        />
      </>,
    );

    expect(screen.getByText(/Resolved — Yes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  it("shows no banner while the market is open", () => {
    renderLive(<LiveStatusBanner />);

    expect(screen.queryByText(/Resolved|Closed|Voided/)).not.toBeInTheDocument();
  });
});
