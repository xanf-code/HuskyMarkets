// All-time platform volume: sum of every bet amount ever placed.
// Backed by a security-definer RPC so guests (anon) can read the aggregate
// without SELECT on bets (0014 deliberately withheld bet rows from anon).

import { createClient } from "@/lib/supabase/server";

export async function getPlatformVolume(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_volume");
  if (error || typeof data !== "number") return 0;
  return data;
}
