import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FIRST_BET_DONE_KEY,
  FIRST_RUN_KEY,
  ODDS_TIP_KEY,
  PROMO_DISMISSED_EVENT,
  PROMO_FALL_2026_KEY,
  clearFirstRun,
  dismissPromoBanner,
  hasCompletedFirstBet,
  hasSeenOddsTip,
  isFirstRunPending,
  isPromoBannerDismissed,
  markFirstBetDone,
  markFirstRunPending,
  markOddsTipSeen,
} from "./onboarding-flags";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("onboarding-flags", () => {
  it("tracks first-run pending until cleared", () => {
    expect(isFirstRunPending()).toBe(false);
    markFirstRunPending();
    expect(isFirstRunPending()).toBe(true);
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe("1");
    clearFirstRun();
    expect(isFirstRunPending()).toBe(false);
  });

  it("marks first bet done and clears the first-run banner", () => {
    markFirstRunPending();
    markFirstBetDone();
    expect(hasCompletedFirstBet()).toBe(true);
    expect(isFirstRunPending()).toBe(false);
    expect(localStorage.getItem(FIRST_BET_DONE_KEY)).toBe("1");
  });

  it("tracks the odds tip dismissal", () => {
    expect(hasSeenOddsTip()).toBe(false);
    markOddsTipSeen();
    expect(hasSeenOddsTip()).toBe(true);
    expect(localStorage.getItem(ODDS_TIP_KEY)).toBe("1");
  });

  it("persists promo dismissal and notifies listeners", () => {
    let heard = false;
    window.addEventListener(PROMO_DISMISSED_EVENT, () => {
      heard = true;
    });

    expect(isPromoBannerDismissed()).toBe(false);
    dismissPromoBanner();
    expect(isPromoBannerDismissed()).toBe(true);
    expect(localStorage.getItem(PROMO_FALL_2026_KEY)).toBe("1");
    expect(heard).toBe(true);
  });
});
