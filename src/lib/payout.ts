// Client-side mirrors of the SQL money math in place_bet / resolve_market.
// The database is the source of truth; these exist so order-panel estimates
// match eventual settlement to the HC. Keep in lockstep with
// supabase/migrations/0006_market_engine.sql.

/**
 * Implied YES probability in cents, clamped to 1–99.
 * Mirrors `least(greatest(round(100.0*yes/(yes+no))::int, 1), 99)`.
 */
export function impliedYes(yesPool: number, noPool: number): number {
  return Math.min(Math.max(Math.round((100 * yesPool) / (yesPool + noPool)), 1), 99);
}

/**
 * Estimated payout if this bet wins, assuming pools freeze after it.
 * Mirrors resolve_market with the bet added to the pools: the vig is floored
 * on the total first (`v_total*5/100` in integer SQL), then the pro-rata
 * share is floored — two separate floors, not a single ×0.95.
 */
export function estimatePayout(
  amount: number,
  sidePool: number,
  totalPool: number,
): number {
  if (amount <= 0) return 0;
  const total = totalPool + amount;
  const vig = Math.floor((total * 5) / 100);
  const afterVig = total - vig;
  return Math.floor((amount * afterVig) / (sidePool + amount));
}
