const NEU_DOMAIN = "northeastern.edu";

export function isNeuEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return false;
  return trimmed.slice(at + 1) === NEU_DOMAIN;
}

/**
 * Validates a `?next=` return path from the sign-in funnel. Only in-app
 * paths survive; protocol-relative ("//evil.com") and absolute URLs are
 * rejected to prevent open redirects.
 */
export function safeReturnPath(next: string | null): string | null {
  // Reject protocol-relative ("//evil"), backslash-relative ("/\evil"), and
  // anything that doesn't start with "/" — all potential open-redirect vectors.
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

// Paths that never require a session, before or after onboarding.
const AUTH_EXEMPT_EXACT = new Set(["/login", "/tos"]);
// `/auth/` covers the magic-link callback (`/auth/callback`): the code is
// exchanged for a session there, so the request must reach the route handler
// while the visitor is still unauthenticated instead of being bounced to /login.
const AUTH_EXEMPT_PREFIXES = ["/auth/", "/share/", "/api/og/"];

// Paths guests may browse signed-out. Authenticated-but-not-onboarded users
// do NOT get these — they are still pushed to /onboarding, so onboarding
// cannot be bypassed via the guest funnel.
const GUEST_EXACT = new Set(["/", "/leaderboard"]);
const GUEST_PREFIXES = ["/market/"];

const ONBOARDING_PATH = "/onboarding";

export function getAuthRedirect(
  pathname: string,
  isAuthenticated: boolean,
  isOnboarded: boolean,
): string | null {
  if (isAuthenticated) {
    // Once onboarded there is nothing left to do on /onboarding.
    if (isOnboarded) return pathname === ONBOARDING_PATH ? "/" : null;
    if (pathname === ONBOARDING_PATH) return null;
    if (AUTH_EXEMPT_EXACT.has(pathname)) return null;
    if (AUTH_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return null;
    }
    return ONBOARDING_PATH;
  }
  if (AUTH_EXEMPT_EXACT.has(pathname)) return null;
  if (AUTH_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  if (GUEST_EXACT.has(pathname)) return null;
  if (GUEST_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  return "/login";
}
