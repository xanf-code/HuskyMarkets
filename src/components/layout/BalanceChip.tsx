import { getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LiveBalance } from "./LiveBalance";

// Server component: reads the derived balance straight from the ledger via
// the get_my_balance() RPC, then hands off to the client LiveBalance chip,
// which keeps it fresh over the user's realtime transactions channel.
// getSession is memoized per request, so pairing it here is effectively free.
export async function BalanceChip() {
  const supabase = await createClient();
  const [session, { data }] = await Promise.all([
    getSession(),
    supabase.rpc("get_my_balance"),
  ]);
  const balance = typeof data === "number" ? data : 0;

  return <LiveBalance initialBalance={balance} userId={session?.userId ?? null} />;
}
