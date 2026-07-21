import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Return path from the sign-in funnel (/login?next=… → emailRedirectTo).
  // Validated against open redirects; un-onboarded users landing on a guest
  // path still get bounced to /onboarding by the proxy.
  const next = safeReturnPath(searchParams.get("next")) ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
