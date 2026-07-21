// Market list & detail queries. One batched fetch per page: the server
// component calls these, the pure helpers below do the in-memory shaping
// (campus-scale data — dozens of open markets, not thousands).
//
// ORDERING CONTRACT: outcome `sort_order` is the canonical display order on
// every surface (order panel, resolve queue, cards, charts, OG images,
// portfolio). Queries fetch it and helpers preserve it; no surface may
// invent its own order.

import {
  ACTIVITY_FEED_LIMIT,
  type Category,
  type MarketSort,
} from "@/lib/constants";
import { getSession } from "@/lib/dal";
import { marketVolume } from "@/lib/format";
import {
  leadingOutcome,
  sortByOutcomeOrder,
  totalPool,
  type OutcomeState,
} from "@/lib/outcomes";
import { impliedOutcome } from "@/lib/payout";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export interface MarketListFilters {
  category?: Category;
  sort?: MarketSort;
  q?: string;
}

export interface MarketListItem {
  id: string;
  title: string;
  category: Category;
  closeAt: string;
  createdAt: string;
  /** Every outcome, in canonical sort_order. Binary markets are N = 2. */
  outcomes: OutcomeState[];
  volume: number;
  /** Distinct users who have placed at least one bet on this market. */
  bettorCount: number;
  /**
   * Recent implied-price points of the leading outcome (A-2), oldest →
   * newest, for the trending sparkline. Multi-outcome series land with the
   * realtime cut-over; the sparkline always tracks the leader.
   */
  spark: number[];
}

/** A single price-history sample for one outcome of one market. */
export interface HistoryPoint {
  recordedAt: string;
  outcomeId: string;
  price: number;
}

const SPARK_POINTS = 20;

export function filterAndSortMarkets(
  markets: readonly MarketListItem[],
  filters: MarketListFilters,
): MarketListItem[] {
  const q = filters.q?.trim().toLowerCase();
  const filtered = markets.filter(
    (m) =>
      (!filters.category || m.category === filters.category) &&
      (!q || m.title.toLowerCase().includes(q)),
  );

  const sorted = [...filtered];
  switch (filters.sort ?? "closing") {
    case "volume":
      sorted.sort((a, b) => b.volume - a.volume);
      break;
    case "newest":
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    default:
      sorted.sort(
        (a, b) => new Date(a.closeAt).getTime() - new Date(b.closeAt).getTime(),
      );
  }
  return sorted;
}

/**
 * Rows arrive newest-first (as fetched); keep up to `perMarket` per
 * market+outcome and flip to chronological order for drawing. Keyed
 * `${market_id}:${outcome_id}` — outcome identity is part of the key (AR-1).
 */
export function groupSparklines(
  rows: readonly { market_id: string; outcome_id: string; implied: number }[],
  perMarket: number = SPARK_POINTS,
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.market_id}:${row.outcome_id}`;
    const points = grouped.get(key) ?? [];
    if (points.length < perMarket) {
      grouped.set(key, [row.implied, ...points]);
    }
  }
  return grouped;
}

interface OutcomeRow {
  id: string;
  label: string;
  sort_order: number;
  pool: number;
}

function toOutcomeStates(rows: readonly OutcomeRow[]): OutcomeState[] {
  const total = rows.reduce((sum, o) => sum + o.pool, 0);
  return sortByOutcomeOrder(
    rows.map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sort_order,
      pool: o.pool,
      implied: impliedOutcome(o.pool, total),
    })),
  );
}

export async function getMarketList(
  filters: MarketListFilters,
): Promise<MarketListItem[]> {
  const supabase = await createClient();

  const { data: markets, error } = await supabase
    .from("markets")
    .select(
      "id, title, category, close_at, created_at, market_outcomes!market_outcomes_market_id_fkey(id, label, sort_order, pool)",
    )
    .eq("status", "open")
    .eq("hidden", false);

  if (error || !markets || markets.length === 0) return [];

  const ids = markets.map((m) => m.id);
  const [{ data: points }, { data: bets }] = await Promise.all([
    supabase
      .from("price_history")
      .select("market_id, outcome_id, implied")
      .in("market_id", ids)
      .order("recorded_at", { ascending: false })
      .limit(ids.length * SPARK_POINTS * 6),
    supabase.from("bets").select("market_id, user_id").in("market_id", ids),
  ]);

  const sparks = groupSparklines(points ?? []);
  const bettorsByMarket = new Map<string, Set<string>>();
  for (const bet of bets ?? []) {
    const set = bettorsByMarket.get(bet.market_id) ?? new Set<string>();
    set.add(bet.user_id);
    bettorsByMarket.set(bet.market_id, set);
  }

  const items = markets.map((m) => {
    const outcomes = toOutcomeStates(m.market_outcomes ?? []);
    const total = totalPool(outcomes);
    const leader = leadingOutcome(outcomes);
    return {
      id: m.id,
      title: m.title,
      category: m.category as Category,
      closeAt: m.close_at,
      createdAt: m.created_at,
      outcomes,
      volume: marketVolume(total, outcomes.length),
      bettorCount: bettorsByMarket.get(m.id)?.size ?? 0,
      spark: leader
        ? (sparks.get(`${m.id}:${leader.id}`) ?? [leader.implied])
        : [],
    };
  });

  return filterAndSortMarkets(items, filters);
}

// ── Detail page ──────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  outcomeId: string;
  outcomeLabel: string;
  amount: number;
  price: number;
  createdAt: string;
}

export interface PositionEntry {
  outcomeId: string;
  label: string;
  stake: number;
}

export interface MarketDetail {
  market: Tables<"markets">;
  /** Every outcome, in canonical sort_order. */
  outcomes: OutcomeState[];
  creatorName: string;
  /** Full per-outcome price history, oldest → newest. */
  history: HistoryPoint[];
  /** Latest bets, newest first — anonymous (no trader identity). Empty for guests. */
  activity: ActivityItem[];
  /** Null for guests: the count is locked with the rest of the activity data. */
  bettorCount: number | null;
  /** Signed-in user's stake on this market, per outcome (hedging allowed). */
  position: PositionEntry[];
  balance: number;
  /** True when the viewer has no session — activity/position/balance are locked. */
  isGuest: boolean;
}

const ACTIVITY_LIMIT = ACTIVITY_FEED_LIMIT;

export async function getMarketDetail(
  id: string,
): Promise<MarketDetail | null> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("markets")
    .select("*, market_outcomes!market_outcomes_market_id_fkey(id, label, sort_order, pool)")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const { market_outcomes, ...market } = row;
  const outcomes = toOutcomeStates(market_outcomes ?? []);
  const labelById = new Map(outcomes.map((o) => [o.id, o.label]));

  // Guests get the market, outcomes and price history — but never bets,
  // positions or balances. Skipping the queries server-side (not just hiding
  // the UI) keeps locked data out of the RSC payload entirely.
  const session = await getSession();
  const isGuest = !session;

  const [{ data: history }, betsResponse, balanceResponse] =
    await Promise.all([
      supabase
        .from("price_history")
        .select("implied, recorded_at, outcome_id")
        .eq("market_id", id)
        .order("recorded_at", { ascending: true }),
      isGuest
        ? Promise.resolve(null)
        : supabase
            .from("bets")
            .select("id, user_id, outcome_id, amount, price_at_bet, created_at")
            .eq("market_id", id)
            .order("created_at", { ascending: false }),
      isGuest
        ? Promise.resolve(null)
        : supabase.rpc("get_my_balance"),
    ]);

  const allBets = betsResponse?.data ?? [];
  const { data: creatorProfile } = await supabase
    .from("public_profiles")
    .select("display_name")
    .eq("id", market.creator_id)
    .maybeSingle();

  const stakeByOutcome = new Map<string, number>();
  if (session) {
    for (const bet of allBets) {
      if (bet.user_id === session.userId) {
        stakeByOutcome.set(
          bet.outcome_id,
          (stakeByOutcome.get(bet.outcome_id) ?? 0) + bet.amount,
        );
      }
    }
  }

  return {
    market,
    outcomes,
    creatorName: creatorProfile?.display_name ?? "Unknown Husky",
    history: (history ?? []).map((p) => ({
      recordedAt: p.recorded_at,
      outcomeId: p.outcome_id,
      price: p.implied,
    })),
    activity: allBets.slice(0, ACTIVITY_LIMIT).map((b) => ({
      id: b.id,
      outcomeId: b.outcome_id,
      outcomeLabel: labelById.get(b.outcome_id) ?? "—",
      amount: b.amount,
      price: b.price_at_bet,
      createdAt: b.created_at,
    })),
    bettorCount: isGuest ? null : new Set(allBets.map((b) => b.user_id)).size,
    position: outcomes
      .filter((o) => stakeByOutcome.has(o.id))
      .map((o) => ({
        outcomeId: o.id,
        label: o.label,
        stake: stakeByOutcome.get(o.id)!,
      })),
    balance: balanceResponse?.data ?? 0,
    isGuest,
  };
}
