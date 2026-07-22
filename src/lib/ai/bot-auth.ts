import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type BotClient = ReturnType<typeof createClient<Database>>;

export async function signInBot(
  email: string,
  password: string,
): Promise<{ client: BotClient; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase URL or anon key missing");

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Bot sign-in failed for ${email}: ${error.message}`);
  if (!data.user?.id) throw new Error(`No user returned for ${email}`);

  return { client, userId: data.user.id };
}
