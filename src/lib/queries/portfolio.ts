// Portfolio queries: open positions, resolved history, and the full ledger.

import { positionValue } from "@/lib/payout";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type MarketStatus = Database["public"]["Enums"]["market_status"];
type BetSide = Database["public"]["Enums"]["bet_side"];
type TxType = Database["public"]["Enums"]["tx_type"];

export interface BetRow {
  id: string;
  market_id: string;
  side: BetSide;
  amount: number;
  price_at_bet: number;
  created_at: string;
}

export interface MarketRow {
  id: string;
  title: string;
  status: MarketStatus;
  close_at: string;
  yes_pool: number;
  no_pool: number;
  resolved_at: string | null;
}

export interface PayoutRow {
  market_id: string;
  type: "bet_payout" | "market_refund";
  amount: number;
}

export interface OpenPosition {
  marketId: string;
  marketTitle: string;
  side: BetSide;
  stake: number;
  avgPrice: number;
  impliedValue: number;
  closeAt: string;
}

export interface ResolvedPosition {
  marketId: string;
  marketTitle: string;
  side: BetSide;
  outcome: "yes" | "no" | "void";
  stake: number;
  payout: number;
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

const OPEN_STATUSES: MarketStatus[] = ["open", "closed"];

function outcomeFromStatus(
  status: MarketStatus,
): "yes" | "no" | "void" | null {
  if (status === "resolved_yes") return "yes";
  if (status === "resolved_no") return "no";
  if (status === "voided") return "void";
  return null;
}

export function aggregateOpenPositions(
  bets: readonly BetRow[],
  markets: readonly MarketRow[],
): OpenPosition[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const buckets = new Map<
    string,
    { marketId: string; side: BetSide; stake: number; priceSum: number }
  >();

  for (const bet of bets) {
    const market = byId.get(bet.market_id);
    if (!market || !OPEN_STATUSES.includes(market.status)) continue;
    const key = `${bet.market_id}:${bet.side}`;
    const bucket = buckets.get(key) ?? {
      marketId: bet.market_id,
      side: bet.side,
      stake: 0,
      priceSum: 0,
    };
    bucket.stake += bet.amount;
    bucket.priceSum += bet.amount * bet.price_at_bet;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].map((b) => {
    const market = byId.get(b.marketId)!;
    const sidePool = b.side === "yes" ? market.yes_pool : market.no_pool;
    return {
      marketId: b.marketId,
      marketTitle: market.title,
      side: b.side,
      stake: b.stake,
      avgPrice: Math.round(b.priceSum / b.stake),
      impliedValue: positionValue(
        b.stake,
        sidePool,
        market.yes_pool + market.no_pool,
      ),
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

  // Aggregate total stake + dominant side per resolved market, and remember
  // the best-call bet on the winning side for share cards.
  const stakes = new Map<
    string,
    {
      yes: number;
      no: number;
      yesPrice: number;
      noPrice: number;
      best: { id: string; price: number; createdAt: string } | null;
    }
  >();
  for (const bet of bets) {
    const market = byId.get(bet.market_id);
    if (!market || !outcomeFromStatus(market.status)) continue;
    const bucket = stakes.get(bet.market_id) ?? {
      yes: 0,
      no: 0,
      yesPrice: 0,
      noPrice: 0,
      best: null,
    };
    if (bet.side === "yes") {
      bucket.yes += bet.amount;
      bucket.yesPrice += bet.amount * bet.price_at_bet;
    } else {
      bucket.no += bet.amount;
      bucket.noPrice += bet.amount * bet.price_at_bet;
    }
    const outcome = outcomeFromStatus(market.status);
    if (outcome !== "void" && bet.side === outcome) {
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
    const outcome = outcomeFromStatus(market.status)!;
    const totalStake = stake.yes + stake.no;
    // Prefer the side that won if present; else the only side bet; else YES.
    const side: BetSide =
      outcome === "yes" && stake.yes > 0
        ? "yes"
        : outcome === "no" && stake.no > 0
          ? "no"
          : stake.yes >= stake.no
            ? "yes"
            : "no";
    const payout = payoutByMarket.get(marketId) ?? 0;
    const won =
      outcome !== "void" &&
      ((outcome === "yes" && stake.yes > 0) ||
        (outcome === "no" && stake.no > 0));
    rows.push({
      marketId,
      marketTitle: market.title,
      side,
      outcome,
      stake: totalStake,
      payout,
      pnl: payout - totalStake,
      won,
      shareBetId: won ? (stake.best?.id ?? null) : null,
      resolvedAt: market.resolved_at ?? market.close_at,
    });
  }

  rows.sort(
    (a, b) =>
      new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime(),
  );
  return rows;
}

export async function getPortfolio(userId: string): Promise<{
  open: OpenPosition[];
  resolved: ResolvedPosition[];
  ledger: LedgerEntry[];
}> {
  const supabase = await createClient();

  const [{ data: bets }, { data: txs }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, market_id, side, amount, price_at_bet, created_at")
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
              "id, title, status, close_at, yes_pool, no_pool, resolved_at",
            )
            .in("id", marketIds)
        ).data ?? []);

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
