"use client";

// Client half of the balance chip: seeded with the server-derived ledger
// balance, then kept fresh by an RLS-scoped subscription to the user's own
// transactions rows. Every insert triggers an authoritative get_my_balance
// refetch (never client-side arithmetic); payouts and refunds also toast.

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Tables } from "@/lib/database.types";
import { formatHC } from "@/lib/format";
import { describePayout } from "@/lib/realtime/live-state";
import { createClient } from "@/lib/supabase/client";

interface LiveBalanceProps {
  initialBalance: number;
  /** null when signed out — renders statically, no subscription. */
  userId: string | null;
}

export function LiveBalance({ initialBalance, userId }: LiveBalanceProps) {
  const toast = useToast();
  const [balance, setBalance] = useState(initialBalance);

  // Toast context identity changes as toasts come and go; keep the latest
  // api in a ref so the subscription effect only depends on userId.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Server re-renders (revalidatePath after grants/bets) reseed the chip —
  // guarded setState during render, per React's "adjust state when props
  // change" pattern.
  const [syncedInitial, setSyncedInitial] = useState(initialBalance);
  if (initialBalance !== syncedInitial) {
    setSyncedInitial(initialBalance);
    setBalance(initialBalance);
  }

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const tx = payload.new as Tables<"transactions">;

          const { data } = await supabase.rpc("get_my_balance");
          if (typeof data === "number") setBalance(data);

          if (tx.type !== "bet_payout" && tx.type !== "market_refund") return;
          let market: {
            title: string;
            status: Tables<"markets">["status"];
            winningLabel?: string | null;
          } | null = null;
          if (tx.market_id) {
            const { data: row } = await supabase
              .from("markets")
              .select("title, status, winning_outcome_id")
              .eq("id", tx.market_id)
              .maybeSingle();
            if (row) {
              // The resolution toast names the winning outcome; one lookup
              // against the outcomes table (labels aren't denormalized onto
              // the markets row, D-5).
              let winningLabel: string | null = null;
              if (row.winning_outcome_id) {
                const { data: outcome } = await supabase
                  .from("market_outcomes")
                  .select("label")
                  .eq("id", row.winning_outcome_id)
                  .maybeSingle();
                winningLabel = outcome?.label ?? null;
              }
              market = { ...row, winningLabel };
            }
          }
          const message = describePayout(tx, market);
          if (message) toastRef.current.push(message);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <div className="num rounded-pill bg-muted px-3 py-1.5 text-sm font-medium text-text">
      {formatHC(balance)}
    </div>
  );
}
