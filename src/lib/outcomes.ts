// Shared N-outcome contract. `OutcomeState` mirrors the `_outcome_map` jsonb
// payload returned by the engine RPCs (create_market / place_bet) and is the
// canonical shape every surface consumes - binary markets are simply the
// N = 2 case (C-5, no dual path).
//
// ORDERING CONTRACT: `sortOrder` is the canonical display order for outcomes
// on every surface - order panel, resolve queue, cards, charts, OG images,
// and portfolio. Never re-derive display order from pool or label.

export interface OutcomeState {
  id: string;
  label: string;
  sortOrder: number;
  pool: number;
  /** Implied price as a percent point (1–99), as of the last pool movement. */
  implied: number;
}

/** Canonical display order (see module docstring). Returns a new array. */
export function sortByOutcomeOrder<T extends { sortOrder: number }>(
  outcomes: readonly T[],
): T[] {
  return [...outcomes].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function totalPool(outcomes: readonly { pool: number }[]): number {
  return outcomes.reduce((sum, o) => sum + o.pool, 0);
}

/**
 * The "leading outcome" shown on cards, sparklines, and OG images: highest
 * current pool, ties broken by lowest sortOrder so equal pools never flap
 * between renders (A-2, AR-8).
 */
export function leadingOutcome<T extends { pool: number; sortOrder: number }>(
  outcomes: readonly T[],
): T | null {
  let leader: T | null = null;
  for (const outcome of outcomes) {
    if (
      !leader ||
      outcome.pool > leader.pool ||
      (outcome.pool === leader.pool && outcome.sortOrder < leader.sortOrder)
    ) {
      leader = outcome;
    }
  }
  return leader;
}

interface RpcOutcomeRow {
  id: string;
  label: string;
  sort_order: number;
  pool: number;
  implied: number;
}

/** Parse the `_outcome_map` jsonb payload into ordered OutcomeState[]. */
export function outcomeStateFromRpc(json: unknown): OutcomeState[] {
  if (!Array.isArray(json)) return [];
  return sortByOutcomeOrder(
    (json as RpcOutcomeRow[]).map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sort_order,
      pool: row.pool,
      implied: row.implied,
    })),
  );
}
