// Pure reducers for realtime events. The hooks in this directory subscribe
// to postgres_changes and feed payloads through these; components never see
// raw payloads. Everything returns new objects (or the same reference when
// the event is a no-op, so React can skip the re-render).

import type { Tables } from "@/lib/database.types";
import { marketVolume } from "@/lib/format";
import { impliedYes } from "@/lib/payout";
import type { ActivityItem, MarketListItem } from "@/lib/queries/markets";

type MarketRow = Tables<"markets">;
type MarketUpdate = Partial<MarketRow> & { id?: string };

export interface LiveMarketState {
  yesPool: number;
  noPool: number;
  status: MarketRow["status"];
}

export interface HistoryPoint {
  recordedAt: string;
  price: number;
}

const SPARK_POINTS = 20;

export function applyMarketUpdate(
  state: LiveMarketState,
  row: MarketUpdate,
): LiveMarketState {
  return {
    yesPool: row.yes_pool ?? state.yesPool,
    noPool: row.no_pool ?? state.noPool,
    status: row.status ?? state.status,
  };
}

export function appendHistoryPoint(
  history: readonly HistoryPoint[],
  row: { recorded_at: string; implied_yes: number },
): HistoryPoint[] {
  // Realtime may redeliver on reconnect; recorded_at is µs-precise, so it
  // doubles as the identity of a snapshot.
  if (history.some((point) => point.recordedAt === row.recorded_at)) {
    return history as HistoryPoint[];
  }
  return [...history, { recordedAt: row.recorded_at, price: row.implied_yes }];
}

export function prependActivity(
  activity: readonly ActivityItem[],
  item: ActivityItem,
  limit: number,
): ActivityItem[] {
  if (activity.some((bet) => bet.id === item.id)) {
    return activity as ActivityItem[];
  }
  return [item, ...activity].slice(0, limit);
}

export function patchMarketList(
  items: readonly MarketListItem[],
  row: MarketUpdate,
): MarketListItem[] {
  const index = items.findIndex((item) => item.id === row.id);
  if (index === -1) return items as MarketListItem[];

  if (row.hidden === true || (row.status && row.status !== "open")) {
    return items.filter((item) => item.id !== row.id);
  }

  const current = items[index];
  const yesPool = row.yes_pool ?? current.yesPool;
  const noPool = row.no_pool ?? current.noPool;
  const price = impliedYes(yesPool, noPool);
  const patched: MarketListItem = {
    ...current,
    yesPool,
    noPool,
    impliedYes: price,
    volume: marketVolume(yesPool, noPool),
    spark: [...current.spark, price].slice(-SPARK_POINTS),
  };
  return items.map((item) => (item.id === row.id ? patched : item));
}

export function describePayout(
  tx: { type: Tables<"transactions">["type"]; amount: number },
  market: { title: string; status: MarketRow["status"] } | null,
): string | null {
  switch (tx.type) {
    case "bet_payout":
      return market
        ? `+${tx.amount} HC — "${market.title}" resolved ${
            market.status === "resolved_no" ? "NO" : "YES"
          }`
        : `+${tx.amount} HC — market resolved`;
    case "market_refund":
      return market
        ? `+${tx.amount} HC — stake refunded on "${market.title}"`
        : `+${tx.amount} HC — stake refunded`;
    default:
      return null;
  }
}
