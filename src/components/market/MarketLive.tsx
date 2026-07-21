"use client";

// Client shell for the market detail page. The provider owns the single
// realtime channel (via useMarketChannel) and the Live* consumers render the
// parts of the page that move: hero price, chart, order panel, stats,
// activity, status banner. Static content (title, rules) stays server-side.

import { createContext, useContext, type ReactNode } from "react";
import { marketVolume } from "@/lib/format";
import { leadingOutcome, totalPool } from "@/lib/outcomes";
import {
  useMarketChannel,
  type MarketChannelInitial,
} from "@/lib/realtime/useMarketChannel";
import type { PositionEntry } from "@/lib/queries/markets";
import { ActivityFeed } from "./ActivityFeed";
import { MarketStats } from "./MarketStats";
import { OrderPanel } from "./OrderPanel";
import { ProbabilityChart } from "./ProbabilityChart";

type MarketLiveValue = ReturnType<typeof useMarketChannel>;

const MarketLiveContext = createContext<MarketLiveValue | null>(null);

function useMarketLive(): MarketLiveValue {
  const ctx = useContext(MarketLiveContext);
  if (!ctx) {
    throw new Error("Live components must be used within <MarketLiveProvider>");
  }
  return ctx;
}

interface MarketLiveProviderProps {
  marketId: string;
  initial: MarketChannelInitial;
  children: ReactNode;
}

export function MarketLiveProvider({
  marketId,
  initial,
  children,
}: MarketLiveProviderProps) {
  const value = useMarketChannel({ marketId, initial });
  return (
    <MarketLiveContext.Provider value={value}>
      {children}
    </MarketLiveContext.Provider>
  );
}

export function LivePrice() {
  const { market } = useMarketLive();
  const leader = leadingOutcome(market.outcomes);
  if (!leader) return null;
  return (
    <div className="flex items-baseline gap-3">
      <p className="num text-4xl font-semibold text-text sm:text-5xl">
        {leader.implied}%
      </p>
      <p className="num text-lg text-text-muted sm:text-xl">{leader.label}</p>
    </div>
  );
}

export function LiveChart() {
  const { history, market } = useMarketLive();
  return <ProbabilityChart history={history} outcomes={market.outcomes} />;
}

export function LiveStatusBanner() {
  const { market } = useMarketLive();
  let banner: string | null = null;
  if (market.status === "closed") {
    banner = "Closed — awaiting resolution";
  } else if (market.status === "resolved") {
    const label = market.outcomes.find(
      (o) => o.id === market.winningOutcomeId,
    )?.label;
    banner = label ? `Resolved — ${label}` : "Resolved";
  } else if (market.status === "voided") {
    banner = "Voided — all stakes refunded";
  }
  if (!banner) return null;
  return (
    <p className="rounded-md border border-hairline border-l-4 border-l-red bg-card px-4 py-3 text-sm text-text">
      {banner}
    </p>
  );
}

export function LiveStats({ bettorCount }: { bettorCount: number | null }) {
  const { market } = useMarketLive();
  return (
    <MarketStats
      outcomes={market.outcomes}
      volume={marketVolume(totalPool(market.outcomes), market.outcomes.length)}
      bettorCount={bettorCount}
    />
  );
}

export function LiveActivity() {
  const { activity } = useMarketLive();
  return <ActivityFeed activity={activity} />;
}

interface LiveOrderPanelProps {
  marketId: string;
  closeAt: string;
  position: PositionEntry[];
  balance: number;
  question?: string;
  /** Guest browsing: the panel renders but every interaction prompts sign-in. */
  guest?: boolean;
}

export function LiveOrderPanel(props: LiveOrderPanelProps) {
  const { market, applyFill } = useMarketLive();
  return (
    <OrderPanel
      marketId={props.marketId}
      status={market.status}
      closeAt={props.closeAt}
      outcomes={market.outcomes}
      position={props.position}
      balance={props.balance}
      question={props.question}
      guest={props.guest}
      onFill={applyFill}
    />
  );
}
