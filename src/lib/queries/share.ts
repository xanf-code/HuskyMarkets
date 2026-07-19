// Public share-card queries. Backed by the anon-granted security-definer
// RPCs from 0010_share_cards.sql; safe for unauthenticated OG/share traffic.

import type { Category } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { marketVolume } from "@/lib/format";
import { impliedYes } from "@/lib/payout";
import { createClient } from "@/lib/supabase/anon";

type MarketStatus = Database["public"]["Enums"]["market_status"];
type BetSide = Database["public"]["Enums"]["bet_side"];

export interface MarketCard {
  title: string;
  category: Category;
  yesPrice: number;
  volume: number;
  status: MarketStatus;
  closeAt: string;
}

export interface ShareCard {
  marketId: string;
  marketTitle: string;
  side: BetSide;
  priceAtBet: number;
  stake: number;
  payout: number;
  displayName: string;
}

export async function getMarketCard(
  marketId: string,
): Promise<MarketCard | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_market_card", {
    p_market_id: marketId,
  });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    title: row.title,
    category: row.category,
    yesPrice: impliedYes(row.yes_pool, row.no_pool),
    volume: marketVolume(row.yes_pool, row.no_pool),
    status: row.status,
    closeAt: row.close_at,
  };
}

export async function getShareCard(betId: string): Promise<ShareCard | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_share_card", {
    p_bet_id: betId,
  });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    marketId: row.market_id,
    marketTitle: row.market_title,
    side: row.side,
    priceAtBet: row.price_at_bet,
    stake: row.stake,
    payout: row.payout,
    displayName: row.display_name,
  };
}
