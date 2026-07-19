// Economic constants. The SQL functions are the source of truth for money
// math; these mirror them for UI copy and client-side estimates, so keep the
// two in lockstep when tuning.

export const CAP_PER_MARKET = 500;
export const VIG_BPS = 500;
export const HOUSE_SEED = 100;
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

/** Hard content rule — rendered verbatim on /create above the form. */
export const CONTENT_RULE =
  "No markets targeting named individual students or private individuals' personal lives, relationships, health, or conduct.";
