import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth";
import {
  ONBOARDED_COOKIE,
  ONBOARDED_COOKIE_OPTIONS,
  decideOnboardedCookie,
} from "@/lib/onboarded-cookie";
import type { Database } from "@/lib/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Optimistic, local-only auth: getClaims verifies the JWT locally (falling
  // back to one network verify only while legacy HS256 keys are in use) and
  // refreshes the session through the setAll adapter above.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;
  const isAuthenticated = Boolean(userId);

  const hasCookie = Boolean(request.cookies.get(ONBOARDED_COOKIE)?.value);

  // One-time backfill: only query when we genuinely don't know (authenticated
  // but no stamp yet). Steady state after the key migration: zero db calls.
  let dbOnboarded: boolean | undefined;
  if (isAuthenticated && !hasCookie) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId!)
      .maybeSingle();
    dbOnboarded = Boolean(profile?.onboarded);
  }

  const isOnboarded = hasCookie || dbOnboarded === true;

  // All cookie mutations happen AFTER the last supabase call - the setAll
  // adapter reassigns `response`, which would otherwise drop these writes.
  const decision = decideOnboardedCookie({
    isAuthenticated,
    hasCookie,
    dbOnboarded,
  });
  if (decision === "set") {
    response.cookies.set(ONBOARDED_COOKIE, "1", ONBOARDED_COOKIE_OPTIONS);
  } else if (decision === "clear") {
    response.cookies.delete(ONBOARDED_COOKIE);
  }

  const redirectTo = getAuthRedirect(
    request.nextUrl.pathname,
    isAuthenticated,
    isOnboarded,
  );
  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    const redirectResponse = NextResponse.redirect(url);
    // Bug fix: NextResponse.redirect() starts a fresh response, so copy every
    // cookie written above (refreshed session cookies + the onboarding stamp)
    // onto it, otherwise they are silently dropped.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next static assets and metadata icons. `/icon` and `/apple-icon`
    // are App Router file-convention routes (often without a file extension),
    // so they must be listed explicitly - otherwise auth gating sends them to
    // /login and browsers fall back to a generic letter favicon.
    "/((?!_next/static|_next/image|favicon.ico|icon(?:\\.(?:ico|png|jpg|jpeg|svg))?$|apple-icon(?:\\.(?:png|jpg|jpeg))?$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
