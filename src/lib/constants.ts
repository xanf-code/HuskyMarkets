// Economic constants. The SQL functions are the source of truth for money
// math; these mirror them for UI copy and client-side estimates, so keep the
// two in lockstep when tuning.

export const CAP_PER_MARKET = 500;
export const VIG_BPS = 500;
export const HOUSE_SEED = 100;
/** Outcome-count bounds per market, catch-all inclusive (C-1, C-2). */
export const MIN_OUTCOMES = 2;
export const MAX_OUTCOMES = 6;
/** Label of the optional creator catch-all outcome (appended last). */
export const CATCH_ALL_LABEL = "None of the above";
export const DAILY_BONUS = 50;
export const BAILOUT = 200;
export const BAILOUT_THRESHOLD = 100;

export const CATEGORIES = [
  { value: "campus", label: "Campus" },
  { value: "transit", label: "Transit" },
  { value: "weather", label: "Weather" },
  { value: "sports", label: "Sports" },
  { value: "academics", label: "Academics" },
  { value: "dining", label: "Dining" },
  { value: "wildcard", label: "Wildcard" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export const MARKET_SORTS = ["closing", "volume", "newest"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];

/**
 * Client-side window sizes for infinite scroll. Server still ships the
 * full campus-scale list; the UI reveals pages as the user scrolls.
 */
export const LIST_PAGE_SIZE = 12;
/** ~2 screens of cards on a phone before the next page loads. */
export const MARKET_PAGE_SIZE = 6;
export const LEADERBOARD_PAGE_SIZE = 15;
export const ACTIVITY_PAGE_SIZE = 10;
/** How many recent bets to ship for the market activity feed. */
export const ACTIVITY_FEED_LIMIT = 100;

/** Hard content rule - rendered verbatim on /create above the form. */
export const CONTENT_RULE =
  "No markets targeting named individual students or private individuals' personal lives, relationships, health, or conduct.";
