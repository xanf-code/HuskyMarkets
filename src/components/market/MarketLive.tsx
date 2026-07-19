"use client";

// Client shell for the market detail page. The provider owns the single
// realtime channel (via useMarketChannel) and the Live* consumers render the
// parts of the page that move: hero price, chart, order panel, stats,
// activity, status banner. Static content (title, rules) stays server-side.

import { createContext, useContext, type ReactNode } from "react";
import { formatCents, marketVolume } from "@/lib/format";
import { impliedYes } from "@/lib/payout";
import {
  useMarketChannel,
  type MarketChannelInitial,
} from "@/lib/realtime/useMarketChannel";
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
  return (
    <p className="num text-4xl font-medium text-red-bright sm:text-5xl">
      YES {formatCents(impliedYes(market.yesPool, market.noPool))}
    </p>
  );
}

export function LiveChart() {
  const { history } = useMarketLive();
  return <ProbabilityChart history={history} />;
}

const STATUS_BANNERS: Record<string, string> = {
  closed: "Closed — awaiting resolution",
  resolved_yes: "Resolved YES",
  resolved_no: "Resolved NO",
  voided: "Voided — all stakes refunded",
};

export function LiveStatusBanner() {
  const { market } = useMarketLive();
  const banner = STATUS_BANNERS[market.status];
  if (!banner) return null;
  return (
    <p className="num border border-hairline border-l-2 border-l-red px-4 py-3 text-sm text-text">
      &gt; {banner}
    </p>
  );
}

export function LiveStats({ bettorCount }: { bettorCount: number }) {
  const { market } = useMarketLive();
  return (
    <MarketStats
      yesPool={market.yesPool}
      noPool={market.noPool}
      volume={marketVolume(market.yesPool, market.noPool)}
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
  position: { yes: number; no: number };
  balance: number;
}

export function LiveOrderPanel(props: LiveOrderPanelProps) {
  const { market, applyFill } = useMarketLive();
  return (
    <OrderPanel
      marketId={props.marketId}
      status={market.status}
      closeAt={props.closeAt}
      yesPool={market.yesPool}
      noPool={market.noPool}
      position={props.position}
      balance={props.balance}
      onFill={applyFill}
    />
  );
}
