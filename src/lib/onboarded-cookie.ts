// Presence-based onboarding stamp. The cookie's mere existence means "this
// user has completed onboarding"; its value is always "1". Absence means
// "unknown", which triggers a one-time backfill lookup in the proxy. We never
// write "0" — a not-onboarded user simply has no cookie.
//
// UX-only guarantee: spoofing this cookie just skips an onboarding redirect;
// RLS still protects all data.
//
// IMPORTANT: Any future sign-out action added to the codebase MUST delete
// ONBOARDED_COOKIE, otherwise a signed-out visitor keeps a stale stamp.

export const ONBOARDED_COOKIE = "hm-onboarded";

export const ONBOARDED_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export interface OnboardedDecisionInput {
  isAuthenticated: boolean;
  hasCookie: boolean;
  /** Only meaningful (and only looked up) when authenticated without a stamp. */
  dbOnboarded?: boolean;
}

export type OnboardedDecision = "keep" | "set" | "clear";

/**
 * Decides what to do with the onboarding stamp for the current request.
 * Pure: all I/O (cookie reads, the backfill query) happens in the proxy.
 */
export function decideOnboardedCookie({
  isAuthenticated,
  hasCookie,
  dbOnboarded,
}: OnboardedDecisionInput): OnboardedDecision {
  if (!isAuthenticated) {
    // Cleanup path: a signed-out visitor should not carry a stamp.
    return hasCookie ? "clear" : "keep";
  }
  if (hasCookie) return "keep";
  // No stamp yet: backfill from the one-time db lookup, but never write "0".
  return dbOnboarded ? "set" : "keep";
}
