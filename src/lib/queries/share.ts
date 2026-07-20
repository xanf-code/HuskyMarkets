// Public share-card queries. Backed by the anon-granted security-definer
// RPCs from 0010_share_card_rpcs.sql (bodies rewritten N-outcome-aware in
// 0011); safe for unauthenticated OG/share traffic.

import type { Category } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { marketVolume } from "@/lib/format";
import { outcomeStateFromRpc, totalPool } from "@/lib/outcomes";
import { createClient } from "@/lib/supabase/anon";

type MarketStatus = Database["public"]["Enums"]["market_status"];

export interface MarketCard {
  title: string;
  category: Category;
  /** Leading outcome (highest pool) and its current price (A-2, FR-29). */
  leading: { label: string; price: number };
  volume: number;
  status: MarketStatus;
  closeAt: string;
}

export interface ShareCard {
  marketId: string;
  marketTitle: string;
  outcomeLabel: string;
  priceAtBet: number;
  stake: number;
  payout: number;
  displayName: string;
}

interface MarketCardRow {
  title: string;
  category: Category;
  status: MarketStatus;
  close_at: string;
  outcomes: unknown;
  leading: { label: string; implied: number } | null;
}

interface ShareCardRow {
  market_id: string;
  market_title: string;
  outcome_label: string;
  price_at_bet: number;
  amount: number;
  payout: number;
  display_name: string;
}

export async function getMarketCard(
  marketId: string,
): Promise<MarketCard | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_market_card", {
    p_market_id: marketId,
  });
  const row = data as MarketCardRow | null;
  if (error || !row) return null;
  const outcomes = outcomeStateFromRpc(row.outcomes);
  return {
    title: row.title,
    category: row.category,
    leading: {
      label: row.leading?.label ?? "—",
      price: row.leading?.implied ?? 0,
    },
    volume: marketVolume(totalPool(outcomes), outcomes.length),
    status: row.status,
    closeAt: row.close_at,
  };
}

export async function getShareCard(betId: string): Promise<ShareCard | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_share_card", {
    p_bet_id: betId,
  });
  const row = data as ShareCardRow | null;
  if (error || !row) return null;
  return {
    marketId: row.market_id,
    marketTitle: row.market_title,
    outcomeLabel: row.outcome_label,
    priceAtBet: row.price_at_bet,
    stake: row.amount,
    payout: row.payout,
    displayName: row.display_name,
  };
}
