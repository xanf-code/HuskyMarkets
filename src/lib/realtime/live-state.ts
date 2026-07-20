// Pure reducers for realtime events. The hooks in this directory subscribe
// to postgres_changes and feed payloads through these; components never see
// raw payloads. Everything returns new objects (or the same reference when
// the event is a no-op, so React can skip the re-render).
//
// Post-migration event contract (REC-13): pool movements flow through
// `market_outcomes` rows — `markets` row UPDATEs carry status/resolution
// only, never prices. History-point identity is (outcomeId, recordedAt):
// one bet snapshots all N outcomes under a single transaction timestamp
// (AR-1).

import type { Tables } from "@/lib/database.types";
import { marketVolume } from "@/lib/format";
import {
  leadingOutcome,
  totalPool,
  type OutcomeState,
} from "@/lib/outcomes";
import { impliedOutcome } from "@/lib/payout";
import type {
  ActivityItem,
  HistoryPoint,
  MarketListItem,
} from "@/lib/queries/markets";

type MarketRow = Tables<"markets">;
type MarketUpdate = Partial<MarketRow> & { id?: string };

export interface LiveMarketState {
  outcomes: OutcomeState[];
  status: MarketRow["status"];
  winningOutcomeId: string | null;
}

export type { HistoryPoint };

const SPARK_POINTS = 20;

/** Markets-row UPDATE: status/resolution only — never prices (REC-13). */
export function applyMarketUpdate(
  state: LiveMarketState,
  row: MarketUpdate,
): LiveMarketState {
  return {
    outcomes: state.outcomes,
    status: row.status ?? state.status,
    winningOutcomeId: row.winning_outcome_id ?? state.winningOutcomeId,
  };
}

function withPool(
  outcomes: readonly OutcomeState[],
  outcomeId: string,
  pool: number,
): OutcomeState[] | null {
  const current = outcomes.find((o) => o.id === outcomeId);
  if (!current || current.pool === pool) return null;
  const pools = outcomes.map((o) => (o.id === outcomeId ? pool : o.pool));
  const total = pools.reduce((sum, p) => sum + p, 0);
  return outcomes.map((o, i) => ({
    ...o,
    pool: pools[i],
    implied: impliedOutcome(pools[i], total),
  }));
}

/** market_outcomes UPDATE: one outcome's pool moved; recompute all prices. */
export function applyOutcomeUpdate(
  state: LiveMarketState,
  row: { id?: string; pool?: number },
): LiveMarketState {
  if (!row.id || row.pool == null) return state;
  const outcomes = withPool(state.outcomes, row.id, row.pool);
  if (!outcomes) return state;
  return { ...state, outcomes };
}

export function appendHistoryPoint(
  history: readonly HistoryPoint[],
  row: { recorded_at: string; outcome_id: string; implied: number },
): HistoryPoint[] {
  // Realtime may redeliver on reconnect; (outcome_id, recorded_at) is the
  // identity of a snapshot point — recorded_at alone would collapse all N
  // outcomes of one snapshot into a single point (AR-1).
  if (
    history.some(
      (point) =>
        point.recordedAt === row.recorded_at &&
        point.outcomeId === row.outcome_id,
    )
  ) {
    return history as HistoryPoint[];
  }
  return [
    ...history,
    { recordedAt: row.recorded_at, outcomeId: row.outcome_id, price: row.implied },
  ];
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

/**
 * Markets-row UPDATE on the list: cards only ever leave the grid from this
 * event (hidden / no longer open). Prices arrive via patchMarketListOutcome.
 */
export function patchMarketList(
  items: readonly MarketListItem[],
  row: MarketUpdate,
): MarketListItem[] {
  const index = items.findIndex((item) => item.id === row.id);
  if (index === -1) return items as MarketListItem[];

  if (row.hidden === true || (row.status && row.status !== "open")) {
    return items.filter((item) => item.id !== row.id);
  }

  return items as MarketListItem[];
}

/**
 * market_outcomes UPDATE on the list: patch the outcome pool, recompute
 * prices/volume, and extend the spark — which always tracks the leading
 * outcome (A-2). When the lead flips the spark re-anchors to the new leader;
 * its older series isn't available client-side (AR-8, accepted).
 */
export function patchMarketListOutcome(
  items: readonly MarketListItem[],
  row: { id?: string; market_id?: string; pool?: number },
): MarketListItem[] {
  if (!row.id || !row.market_id || row.pool == null) {
    return items as MarketListItem[];
  }
  const current = items.find((item) => item.id === row.market_id);
  if (!current) return items as MarketListItem[];

  const outcomes = withPool(current.outcomes, row.id, row.pool);
  if (!outcomes) return items as MarketListItem[];

  const leader = leadingOutcome(outcomes);
  const previousLeader = leadingOutcome(current.outcomes);
  const spark =
    leader && previousLeader && leader.id === previousLeader.id
      ? [...current.spark, leader.implied].slice(-SPARK_POINTS)
      : leader
        ? [leader.implied]
        : current.spark;

  const patched: MarketListItem = {
    ...current,
    outcomes,
    volume: marketVolume(totalPool(outcomes), outcomes.length),
    spark,
  };
  return items.map((item) => (item.id === row.market_id ? patched : item));
}

export function describePayout(
  tx: { type: Tables<"transactions">["type"]; amount: number },
  market: {
    title: string;
    status: MarketRow["status"];
    winningLabel?: string | null;
  } | null,
): string | null {
  switch (tx.type) {
    case "bet_payout":
      if (!market) return `+${tx.amount} HC — market resolved`;
      return market.winningLabel
        ? `+${tx.amount} HC — "${market.title}" resolved ${market.winningLabel}`
        : `+${tx.amount} HC — "${market.title}" resolved`;
    case "market_refund":
      return market
        ? `+${tx.amount} HC — stake refunded on "${market.title}"`
        : `+${tx.amount} HC — stake refunded`;
    default:
      return null;
  }
}
