// Portfolio queries: open positions, resolved history, and the full ledger.
// Positions group by market + outcome (FR-20); a win is the bet's outcome
// matching the market's winning outcome (FR-19) - no yes/no branching.

import { positionValue } from "@/lib/payout";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type MarketStatus = Database["public"]["Enums"]["market_status"];
type TxType = Database["public"]["Enums"]["tx_type"];

export interface BetRow {
  id: string;
  market_id: string;
  outcome_id: string;
  amount: number;
  price_at_bet: number;
  created_at: string;
}

export interface OutcomeRow {
  id: string;
  label: string;
  sort_order: number;
  pool: number;
}

export interface MarketRow {
  id: string;
  title: string;
  status: MarketStatus;
  close_at: string;
  resolved_at: string | null;
  winning_outcome_id: string | null;
  outcomes: OutcomeRow[];
}

export interface PayoutRow {
  market_id: string;
  type: "bet_payout" | "market_refund";
  amount: number;
}

export interface OpenPosition {
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeLabel: string;
  stake: number;
  avgPrice: number;
  impliedValue: number;
  closeAt: string;
}

export interface ResolvedPosition {
  marketId: string;
  marketTitle: string;
  /** Winning outcome's label, or "Void" for refunded markets. */
  outcomeLabel: string;
  stake: number;
  payout: number;
  /**
   * Estimate at bet time, derived from the recorded per-outcome bet price
   * (FR-21): Σ round(amount × 100 / price_at_bet) over the user's bets on the
   * winning outcome. Null for lost or voided positions.
   */
  estimatedPayout: number | null;
  pnl: number;
  won: boolean;
  /** Best-call winning bet (lowest price, earliest first); null unless won. */
  shareBetId: string | null;
  resolvedAt: string;
}

export interface LedgerEntry {
  id: string;
  type: TxType;
  amount: number;
  marketId: string | null;
  marketTitle: string | null;
  createdAt: string;
}

export interface CreatedMarket {
  id: string;
  title: string;
  status: MarketStatus;
  category: string;
  createdAt: string;
  closeAt: string;
}

export interface BetHistoryRow {
  betId: string;
  marketId: string;
  marketTitle: string;
  outcomeLabel: string;
  amount: number;
  priceAtBet: number;
  createdAt: string;
  marketStatus: MarketStatus;
}

const OPEN_STATUSES: MarketStatus[] = ["open", "closed"];

function outcomeLabel(market: MarketRow, outcomeId: string | null): string {
  if (!outcomeId) return "Void";
  return (
    market.outcomes.find((o) => o.id === outcomeId)?.label ?? "-"
  );
}

export function aggregateOpenPositions(
  bets: readonly BetRow[],
  markets: readonly MarketRow[],
): OpenPosition[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const buckets = new Map<
    string,
    { marketId: string; outcomeId: string; stake: number; priceSum: number }
  >();

  for (const bet of bets) {
    const market = byId.get(bet.market_id);
    if (!market || !OPEN_STATUSES.includes(market.status)) continue;
    const key = `${bet.market_id}:${bet.outcome_id}`;
    const bucket = buckets.get(key) ?? {
      marketId: bet.market_id,
      outcomeId: bet.outcome_id,
      stake: 0,
      priceSum: 0,
    };
    bucket.stake += bet.amount;
    bucket.priceSum += bet.amount * bet.price_at_bet;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].map((b) => {
    const market = byId.get(b.marketId)!;
    const outcomePool =
      market.outcomes.find((o) => o.id === b.outcomeId)?.pool ?? 0;
    const totalPool = market.outcomes.reduce((sum, o) => sum + o.pool, 0);
    return {
      marketId: b.marketId,
      marketTitle: market.title,
      outcomeId: b.outcomeId,
      outcomeLabel: outcomeLabel(market, b.outcomeId),
      stake: b.stake,
      avgPrice: Math.round(b.priceSum / b.stake),
      impliedValue: positionValue(b.stake, outcomePool, totalPool),
      closeAt: market.close_at,
    };
  });
}

export function aggregateResolved(
  bets: readonly BetRow[],
  markets: readonly MarketRow[],
  payouts: readonly PayoutRow[],
): ResolvedPosition[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const payoutByMarket = new Map<string, number>();
  for (const p of payouts) {
    payoutByMarket.set(
      p.market_id,
      (payoutByMarket.get(p.market_id) ?? 0) + p.amount,
    );
  }

  // Aggregate total stake per resolved market and remember the best-call bet
  // on the winning outcome for share cards.
  const stakes = new Map<
    string,
    {
      total: number;
      won: boolean;
      estPayout: number;
      best: { id: string; price: number; createdAt: string } | null;
    }
  >();
  for (const bet of bets) {
    const market = byId.get(bet.market_id);
    if (!market || (market.status !== "resolved" && market.status !== "voided"))
      continue;
    const bucket = stakes.get(bet.market_id) ?? {
      total: 0,
      won: false,
      estPayout: 0,
      best: null,
    };
    bucket.total += bet.amount;
    if (
      market.status === "resolved" &&
      bet.outcome_id === market.winning_outcome_id
    ) {
      bucket.won = true;
      bucket.estPayout += Math.round((bet.amount * 100) / bet.price_at_bet);
      const best = bucket.best;
      if (
        !best ||
        bet.price_at_bet < best.price ||
        (bet.price_at_bet === best.price && bet.created_at < best.createdAt)
      ) {
        bucket.best = {
          id: bet.id,
          price: bet.price_at_bet,
          createdAt: bet.created_at,
        };
      }
    }
    stakes.set(bet.market_id, bucket);
  }

  const rows: ResolvedPosition[] = [];
  for (const [marketId, stake] of stakes) {
    const market = byId.get(marketId)!;
    const payout = payoutByMarket.get(marketId) ?? 0;
    rows.push({
      marketId,
      marketTitle: market.title,
      outcomeLabel:
        market.status === "voided"
          ? "Void"
          : outcomeLabel(market, market.winning_outcome_id),
      stake: stake.total,
      payout,
      estimatedPayout: stake.won ? stake.estPayout : null,
      pnl: payout - stake.total,
      won: stake.won,
      shareBetId: stake.won ? (stake.best?.id ?? null) : null,
      resolvedAt: market.resolved_at ?? market.close_at,
    });
  }

  rows.sort(
    (a, b) =>
      new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime(),
  );
  return rows;
}

export function aggregateBetHistory(
  bets: readonly BetRow[],
  markets: readonly MarketRow[],
): BetHistoryRow[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const rows: BetHistoryRow[] = [];

  for (const bet of bets) {
    const market = byId.get(bet.market_id);
    if (!market) continue;
    const outcome = market.outcomes.find((o) => o.id === bet.outcome_id);
    rows.push({
      betId: bet.id,
      marketId: bet.market_id,
      marketTitle: market.title,
      outcomeLabel: outcome?.label ?? "—",
      amount: bet.amount,
      priceAtBet: bet.price_at_bet,
      createdAt: bet.created_at,
      marketStatus: market.status,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getUserCreatedMarkets(
  userId: string,
): Promise<CreatedMarket[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, title, status, category, created_at, close_at")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    category: m.category,
    createdAt: m.created_at,
    closeAt: m.close_at,
  }));
}

export async function getPortfolio(userId: string): Promise<{
  open: OpenPosition[];
  resolved: ResolvedPosition[];
  ledger: LedgerEntry[];
  betHistory: BetHistoryRow[];
}> {
  const supabase = await createClient();

  const [{ data: bets }, { data: txs }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, market_id, outcome_id, amount, price_at_bet, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("id, type, amount, market_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const marketIds = [
    ...new Set([
      ...(bets ?? []).map((b) => b.market_id),
      ...(txs ?? []).flatMap((t) => (t.market_id ? [t.market_id] : [])),
    ]),
  ];

  const markets: MarketRow[] =
    marketIds.length === 0
      ? []
      : ((
          await supabase
            .from("markets")
            .select(
              "id, title, status, close_at, resolved_at, winning_outcome_id, market_outcomes!market_outcomes_market_id_fkey(id, label, sort_order, pool)",
            )
            .in("id", marketIds)
        ).data ?? []).map(({ market_outcomes, ...m }) => ({
          ...m,
          outcomes: market_outcomes ?? [],
        }));

  const payoutTypes = ["bet_payout", "market_refund"] as const;
  const payouts: PayoutRow[] = (txs ?? [])
    .filter(
      (t): t is typeof t & { market_id: string } =>
        t.market_id != null &&
        (payoutTypes as readonly string[]).includes(t.type),
    )
    .map((t) => ({
      market_id: t.market_id,
      type: t.type as PayoutRow["type"],
      amount: t.amount,
    }));

  const titleById = new Map(markets.map((m) => [m.id, m.title]));

  return {
    open: aggregateOpenPositions(bets ?? [], markets),
    resolved: aggregateResolved(bets ?? [], markets, payouts),
    betHistory: aggregateBetHistory(bets ?? [], markets),
    ledger: (txs ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      marketId: t.market_id,
      marketTitle: t.market_id ? (titleById.get(t.market_id) ?? null) : null,
      createdAt: t.created_at,
    })),
  };
}
