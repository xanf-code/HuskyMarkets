// Client-side mirrors of the SQL money math in place_bet / resolve_market.
// The database is the source of truth; these exist so order-panel estimates
// match eventual settlement to the HC. Keep in lockstep with
// supabase/migrations/0006_market_engine.sql (and its N-outcome successor).
//
// Ledger invariant (generalized from the binary form):
//   Σ(user tx) + Σ(vig_burn) − Σ_{m ∈ resolved}(100 × outcome_count(m)) = Σ(grants)

/**
 * Implied probability for one outcome (1–99 percent points), clamped.
 * Mirrors `least(greatest(round(100.0*outcome/total)::int, 1), 99)`.
 *
 * N-outcome generalisation of the binary formula. Binary markets are the N=2
 * case: `impliedOutcome(yesPool, yesPool + noPool)`.
 */
export function impliedOutcome(outcomePool: number, totalPool: number): number {
  return Math.min(
    Math.max(Math.round((100 * outcomePool) / totalPool), 1),
    99,
  );
}

/**
 * Estimated payout if this bet wins, assuming pools freeze after it.
 * Mirrors resolve_market with the bet added to the pools: the vig is floored
 * on the total first (`v_total*5/100` in integer SQL), then the pro-rata
 * share is floored - two separate floors, not a single ×0.95.
 *
 * Works for any outcome in an N-outcome market: pass the chosen outcome's
 * current pool as `sidePool` and the sum of all outcome pools as `totalPool`.
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

/**
 * Current implied value of an *existing* open stake already inside the pools.
 * Same integer floors as resolve_market (no re-adding the stake).
 *
 * Works for any outcome in an N-outcome market: pass the chosen outcome's
 * pool as `sidePool` and the sum of all outcome pools as `totalPool`.
 */
export function positionValue(
  stake: number,
  sidePool: number,
  totalPool: number,
): number {
  if (stake <= 0 || sidePool <= 0) return 0;
  const vig = Math.floor((totalPool * 5) / 100);
  const afterVig = totalPool - vig;
  return Math.floor((stake * afterVig) / sidePool);
}
