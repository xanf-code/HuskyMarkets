import { createClient } from "@/lib/supabase/server";

export function formatHC(amount: number): string {
  return `${amount.toLocaleString("en-US")} HC`;
}

// Server component: reads the derived balance straight from the ledger via
// the get_my_balance() RPC on every render (revalidatePath after any grant
// keeps it fresh).
export async function BalanceChip() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_balance");
  const balance = typeof data === "number" ? data : 0;

  return (
    <div className="num border border-hairline px-3 py-1.5 text-sm text-text">
      {formatHC(balance)}
    </div>
  );
}
