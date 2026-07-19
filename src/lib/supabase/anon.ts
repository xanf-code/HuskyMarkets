// Cookieless anon client for public surfaces (OG image routes, /share pages).
// Runs in the edge runtime and for unauthenticated visitors; only able to call
// the RPCs explicitly granted to anon (see 0010_share_cards.sql).

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
