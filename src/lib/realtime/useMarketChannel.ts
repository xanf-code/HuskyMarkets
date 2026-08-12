"use client";

// One realtime channel per market detail page (`market:{id}`). Postgres
// changes flow through the pure reducers in live-state.ts; the RPC return
// from place_bet stays the primary write path (applyFill) - realtime only
// reconciles and augments, so nothing breaks if the socket drops.
//
// Event contract (REC-13): pool movements arrive as market_outcomes UPDATEs;
// the markets row carries status/resolution only. A pool movement also
// refreshes the redacted activity RPC; raw bets rows are never subscribed to
// because they contain bettor identity and share-link bearer UUIDs.

import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVITY_FEED_LIMIT } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import type { OutcomeState } from "@/lib/outcomes";
import type { ActivityItem, HistoryPoint } from "@/lib/queries/markets";
import { createClient } from "@/lib/supabase/client";
import {
  appendHistoryPoint,
  applyMarketUpdate,
  applyOutcomeUpdate,
  type LiveMarketState,
} from "./live-state";

const ACTIVITY_LIMIT = ACTIVITY_FEED_LIMIT;

export interface MarketChannelInitial {
  outcomes: OutcomeState[];
  status: Tables<"markets">["status"];
  winningOutcomeId: string | null;
  history: HistoryPoint[];
  activity: ActivityItem[];
}

interface UseMarketChannelArgs {
  marketId: string;
  initial: MarketChannelInitial;
}

export function useMarketChannel({ marketId, initial }: UseMarketChannelArgs) {
  const [market, setMarket] = useState<LiveMarketState>({
    outcomes: initial.outcomes,
    status: initial.status,
    winningOutcomeId: initial.winningOutcomeId,
  });
  const [history, setHistory] = useState<HistoryPoint[]>(initial.history);
  const [activity, setActivity] = useState<ActivityItem[]>(initial.activity);

  // Bet INSERT payloads carry outcome_id only; the label lookup reads the
  // latest outcome map through a ref so the subscription effect stays
  // marketId-scoped.
  const outcomesRef = useRef(market.outcomes);
  useEffect(() => {
    outcomesRef.current = market.outcomes;
  }, [market.outcomes]);

  /** Optimistic outcome-map update from the order panel's place_bet fill. */
  const applyFill = useCallback((fill: { outcomes: OutcomeState[] }) => {
    setMarket((current) => ({ ...current, outcomes: fill.outcomes }));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let activityRequestId = 0;
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
          event: "UPDATE",
          schema: "public",
          table: "market_outcomes",
          filter: `market_id=eq.${marketId}`,
        },
        async (payload) => {
          setMarket((current) =>
            applyOutcomeUpdate(
              current,
              payload.new as Partial<Tables<"market_outcomes">>,
            ),
          );
          const requestId = ++activityRequestId;
          const { data } = await supabase.rpc("get_market_activity", {
            p_market_id: marketId,
            p_limit: ACTIVITY_LIMIT,
          });
          if (!active || requestId !== activityRequestId || !data) return;
          setActivity(
            data.map((bet) => ({
              id: bet.activity_id,
              outcomeId: bet.outcome_id,
              outcomeLabel:
                outcomesRef.current.find((o) => o.id === bet.outcome_id)
                  ?.label ?? "-",
              amount: bet.amount,
              price: bet.price_at_bet,
              createdAt: bet.created_at,
            })),
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
      active = false;
      activityRequestId++;
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  return { market, history, activity, applyFill };
}
