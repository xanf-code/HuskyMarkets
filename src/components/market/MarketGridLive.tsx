"use client";

// Home grid enhancement: one unfiltered `markets:list` channel patches the
// visible cards — `markets` UPDATEs remove closed/hidden cards, and
// `market_outcomes` UPDATEs move prices (REC-13). The server-fetched list is
// the source of truth — filter navigation reseeds via props.

import { useEffect, useState } from "react";
import type { Tables } from "@/lib/database.types";
import type { MarketListItem } from "@/lib/queries/markets";
import {
  patchMarketList,
  patchMarketListOutcome,
} from "@/lib/realtime/live-state";
import { createClient } from "@/lib/supabase/client";
import { MarketGrid } from "./MarketGrid";

export function MarketGridLive({ initial }: { initial: MarketListItem[] }) {
  const [markets, setMarkets] = useState(initial);

  // Server navigation (filter/sort change) reseeds the list — guarded
  // setState during render, per React's "adjust state when props change".
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setMarkets(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("markets:list")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => {
          setMarkets((current) =>
            patchMarketList(current, payload.new as Partial<Tables<"markets">>),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "market_outcomes" },
        (payload) => {
          setMarkets((current) =>
            patchMarketListOutcome(
              current,
              payload.new as Partial<Tables<"market_outcomes">>,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return <MarketGrid markets={markets} />;
}
