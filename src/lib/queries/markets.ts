// Market list & detail queries. One batched fetch per page: the server
// component calls these, the pure helpers below do the in-memory shaping
// (campus-scale data — dozens of open markets, not thousands).

import type { Category, MarketSort } from "@/lib/constants";
import { getSession } from "@/lib/dal";
import { marketVolume } from "@/lib/format";
import { impliedYes } from "@/lib/payout";
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
  yesPool: number;
  noPool: number;
  impliedYes: number;
  volume: number;
  /** Recent implied-YES points, oldest → newest, for the card sparkline. */
  spark: number[];
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
 * Rows arrive newest-first (as fetched); keep up to `perMarket` per market
 * and flip to chronological order for drawing.
 */
export function groupSparklines(
  rows: readonly { market_id: string; implied_yes: number }[],
  perMarket: number = SPARK_POINTS,
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const points = grouped.get(row.market_id) ?? [];
    if (points.length < perMarket) {
      grouped.set(row.market_id, [row.implied_yes, ...points]);
    }
  }
  return grouped;
}

export async function getMarketList(
  filters: MarketListFilters,
): Promise<MarketListItem[]> {
  const supabase = await createClient();

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id, title, category, close_at, created_at, yes_pool, no_pool")
    .eq("status", "open")
    .eq("hidden", false);

  if (error || !markets || markets.length === 0) return [];

  const ids = markets.map((m) => m.id);
  const { data: points } = await supabase
    .from("price_history")
    .select("market_id, implied_yes")
    .in("market_id", ids)
    .order("recorded_at", { ascending: false })
    .limit(ids.length * SPARK_POINTS);

  const sparks = groupSparklines(points ?? []);

  const items = markets.map((m) => {
    const price = impliedYes(m.yes_pool, m.no_pool);
    return {
      id: m.id,
      title: m.title,
      category: m.category as Category,
      closeAt: m.close_at,
      createdAt: m.created_at,
      yesPool: m.yes_pool,
      noPool: m.no_pool,
      impliedYes: price,
      volume: marketVolume(m.yes_pool, m.no_pool),
      spark: sparks.get(m.id) ?? [price],
    };
  });

  return filterAndSortMarkets(items, filters);
}

// ── Detail page ──────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  displayName: string;
  side: "yes" | "no";
  amount: number;
  price: number;
  createdAt: string;
}

export interface MarketDetail {
  market: Tables<"markets">;
  creatorName: string;
  /** Full price history, oldest → newest. */
  history: { recordedAt: string; price: number }[];
  /** Latest bets, newest first, display-mode respected via public_profiles. */
  activity: ActivityItem[];
  bettorCount: number;
  /** Signed-in user's stake on this market, per side. */
  position: { yes: number; no: number };
  balance: number;
}

const ACTIVITY_LIMIT = 30;

export async function getMarketDetail(
  id: string,
): Promise<MarketDetail | null> {
  const supabase = await createClient();

  const { data: market } = await supabase
    .from("markets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!market) return null;

  const [{ data: history }, { data: bets }, session, { data: balance }] =
    await Promise.all([
      supabase
        .from("price_history")
        .select("implied_yes, recorded_at")
        .eq("market_id", id)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("bets")
        .select("id, user_id, side, amount, price_at_bet, created_at")
        .eq("market_id", id)
        .order("created_at", { ascending: false }),
      getSession(),
      supabase.rpc("get_my_balance"),
    ]);

  const allBets = bets ?? [];
  const nameIds = [
    ...new Set([
      market.creator_id,
      ...allBets.slice(0, ACTIVITY_LIMIT).map((b) => b.user_id),
    ]),
  ];
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", nameIds);

  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "Unknown Husky"]),
  );

  const position = { yes: 0, no: 0 };
  if (session) {
    for (const bet of allBets) {
      if (bet.user_id === session.userId) position[bet.side] += bet.amount;
    }
  }

  return {
    market,
    creatorName: names.get(market.creator_id) ?? "Unknown Husky",
    history: (history ?? []).map((p) => ({
      recordedAt: p.recorded_at,
      price: p.implied_yes,
    })),
    activity: allBets.slice(0, ACTIVITY_LIMIT).map((b) => ({
      id: b.id,
      displayName: names.get(b.user_id) ?? "Unknown Husky",
      side: b.side,
      amount: b.amount,
      price: b.price_at_bet,
      createdAt: b.created_at,
    })),
    bettorCount: new Set(allBets.map((b) => b.user_id)).size,
    position,
    balance: balance ?? 0,
  };
}
