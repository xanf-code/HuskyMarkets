// Client-only first-run flags. Presence means the cue is still active;
// clearing the key dismisses it. Deliberately not cookies - these are
// UX tips, not auth gates.

export const FIRST_RUN_KEY = "hm-first-run";
export const FIRST_BET_DONE_KEY = "hm-first-bet-done";
export const ODDS_TIP_KEY = "hm-odds-tip-seen";
export const PROMO_FALL_2026_KEY = "promo-fall-2026-dismissed";
/** Fired in-tab when the guest promo banner is dismissed. */
export const PROMO_DISMISSED_EVENT = "hm-promo-dismissed";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable - cues may reappear; acceptable.
  }
}

/** Set when onboarding completes so home can show the first-run banner. */
export function markFirstRunPending(): void {
  write(FIRST_RUN_KEY, true);
}

export function isFirstRunPending(): boolean {
  return read(FIRST_RUN_KEY);
}

export function clearFirstRun(): void {
  write(FIRST_RUN_KEY, false);
}

/** True after the user has placed (and celebrated) their first bet. */
export function hasCompletedFirstBet(): boolean {
  return read(FIRST_BET_DONE_KEY);
}

export function markFirstBetDone(): void {
  write(FIRST_BET_DONE_KEY, true);
  clearFirstRun();
}

export function hasSeenOddsTip(): boolean {
  return read(ODDS_TIP_KEY);
}

export function markOddsTipSeen(): void {
  write(ODDS_TIP_KEY, true);
}

export function isPromoBannerDismissed(): boolean {
  return read(PROMO_FALL_2026_KEY);
}

export function dismissPromoBanner(): void {
  write(PROMO_FALL_2026_KEY, true);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROMO_DISMISSED_EVENT));
  }
}
