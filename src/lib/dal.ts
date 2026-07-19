import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SessionClaims {
  userId: string;
  email: string | null;
}

/** Nullable; never redirects (root layout renders for signed-out visitors). */
export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { userId: data.claims.sub, email: data.claims.email ?? null };
});

/** Auth boundary for protected pages: redirects to /login when unauthenticated. */
export async function verifySession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
