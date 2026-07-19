"use client";

// One realtime channel per market detail page (`market:{id}`). Postgres
// changes flow through the pure reducers in live-state.ts; the RPC return
// from place_bet stays the primary write path (applyFill) — realtime only
// reconciles and augments, so nothing breaks if the socket drops.

import { useCallback, useEffect, useState } from "react";
import type { Tables } from "@/lib/database.types";
import type { ActivityItem } from "@/lib/queries/markets";
import { createClient } from "@/lib/supabase/client";
import {
  appendHistoryPoint,
  applyMarketUpdate,
  prependActivity,
  type HistoryPoint,
  type LiveMarketState,
} from "./live-state";

const ACTIVITY_LIMIT = 30;

export interface MarketChannelInitial {
  yesPool: number;
  noPool: number;
  status: Tables<"markets">["status"];
  history: HistoryPoint[];
  activity: ActivityItem[];
}

interface UseMarketChannelArgs {
  marketId: string;
  initial: MarketChannelInitial;
}

export function useMarketChannel({ marketId, initial }: UseMarketChannelArgs) {
  const [market, setMarket] = useState<LiveMarketState>({
    yesPool: initial.yesPool,
    noPool: initial.noPool,
    status: initial.status,
  });
  const [history, setHistory] = useState<HistoryPoint[]>(initial.history);
  const [activity, setActivity] = useState<ActivityItem[]>(initial.activity);

  /** Optimistic pool update from the order panel's place_bet fill. */
  const applyFill = useCallback((fill: { yesPool: number; noPool: number }) => {
    setMarket((current) => ({ ...current, ...fill }));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`market:${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "markets",
          filter: `id=eq.${marketId}`,
        },
        (payload) => {
          setMarket((current) =>
            applyMarketUpdate(current, payload.new as Partial<Tables<"markets">>),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bets",
          filter: `market_id=eq.${marketId}`,
        },
        async (payload) => {
          const bet = payload.new as Tables<"bets">;
          // Display names live behind public_profiles (display-mode aware);
          // resolve on arrival rather than shipping names over the wire.
          const { data } = await supabase
            .from("public_profiles")
            .select("display_name")
            .eq("id", bet.user_id)
            .maybeSingle();
          setActivity((current) =>
            prependActivity(
              current,
              {
                id: bet.id,
                displayName: data?.display_name ?? "Unknown Husky",
                side: bet.side,
                amount: bet.amount,
                price: bet.price_at_bet,
                createdAt: bet.created_at,
              },
              ACTIVITY_LIMIT,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
          filter: `market_id=eq.${marketId}`,
        },
        (payload) => {
          setHistory((current) =>
            appendHistoryPoint(current, payload.new as Tables<"price_history">),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  return { market, history, activity, applyFill };
}
