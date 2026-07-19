import { createClient } from "@/lib/supabase/server";
import { LiveBalance } from "./LiveBalance";

// Server component: reads the derived balance straight from the ledger via
// the get_my_balance() RPC, then hands off to the client LiveBalance chip,
// which keeps it fresh over the user's realtime transactions channel.
export async function BalanceChip() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("get_my_balance")]);
  const balance = typeof data === "number" ? data : 0;

  return <LiveBalance initialBalance={balance} userId={user?.id ?? null} />;
}
