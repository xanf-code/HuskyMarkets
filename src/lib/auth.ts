const NEU_DOMAIN = "northeastern.edu";

export function isNeuEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return false;
  return trimmed.slice(at + 1) === NEU_DOMAIN;
}

const PUBLIC_EXACT = new Set(["/login", "/tos"]);
// `/auth/` covers the magic-link callback (`/auth/callback`): the code is
// exchanged for a session there, so the request must reach the route handler
// while the visitor is still unauthenticated instead of being bounced to /login.
const PUBLIC_PREFIXES = ["/auth/", "/share/", "/api/og/"];

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
    if (PUBLIC_EXACT.has(pathname)) return null;
    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return null;
    }
    return ONBOARDING_PATH;
  }
  if (PUBLIC_EXACT.has(pathname)) return null;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  return "/login";
}
