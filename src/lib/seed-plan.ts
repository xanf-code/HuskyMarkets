// Pure planning helpers for scripts/seed-markets.ts and scripts/seed-bets.ts.
// Kept free of I/O so the seed shape (D-7's 2–6 outcome mix) and the FR-9
// aggregate cap are unit-testable without a live database.

import { CAP_PER_MARKET } from "./constants";

/** Labels the seed scripts draw from for 3+-outcome markets. */
export const OUTCOME_LABEL_POOL = [
  "Yes",
  "No",
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
] as const;

export interface SeedBet {
  userIdx: number;
  outcomeIdx: number;
  amount: number;
  secsAgo: number;
}

/**
 * Outcome-label sets for the seed market mix: one set per outcome count from
 * 2 through 6 (D-7). Binary markets get Yes/No; larger sets draw from the
 * generic label pool. Cycled over the seed catalog by index.
 */
export function seedOutcomeSets(): string[][] {
  return [
    ["Yes", "No"],
    ["Alpha", "Beta", "Gamma"],
    ["Alpha", "Beta", "Gamma", "Delta"],
    ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
    ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"],
  ];
}

/** Pools after a bet lands on `outcomeIdx` (immutable). */
export function applyBetToPools(
  pools: readonly number[],
  outcomeIdx: number,
  amount: number,
): number[] {
  return pools.map((p, i) => (i === outcomeIdx ? p + amount : p));
}

export interface CapViolation {
  userIdx: number;
  total: number;
  cap: number;
}

/**
 * Per-user aggregate stake across all outcomes of one market must stay within
 * the 500 HC cap (FR-9). Returns one violation per over-cap user; empty when
 * the wave is seedable.
 */
export function capViolations(
  wave: readonly SeedBet[],
  cap: number = CAP_PER_MARKET,
): CapViolation[] {
  const totals = new Map<number, number>();
  for (const b of wave) {
    totals.set(b.userIdx, (totals.get(b.userIdx) ?? 0) + b.amount);
  }
  return [...totals.entries()]
    .filter(([, total]) => total > cap)
    .map(([userIdx, total]) => ({ userIdx, total, cap }));
}
