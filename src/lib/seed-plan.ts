// Pure planning helpers for scripts/seed-markets.ts and scripts/seed-bets.ts.
// Kept free of I/O so the seed shape (D-7's 2–6 outcome mix) and the FR-9
// aggregate cap are unit-testable without a live database.

import { CAP_PER_MARKET, HOUSE_SEED } from "./constants";

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

/**
 * Spread a wave's timestamps across `spanSecs` so charts show stepped
 * price paths instead of a 1-second burst. Oldest bet first (largest
 * secsAgo); the newest lands near "now". Small deterministic jitter keeps
 * gaps from looking perfectly even.
 */
export function staggerWave(
  wave: readonly SeedBet[],
  spanSecs: number,
): SeedBet[] {
  const n = wave.length;
  if (n === 0) return [];
  if (n === 1) return [{ ...wave[0], secsAgo: Math.max(0, Math.round(spanSecs)) }];

  return wave.map((bet, i) => {
    const t = i / (n - 1); // 0 = oldest, 1 = newest
    const base = spanSecs * (1 - t);
    // ±20 min wobble, zero at endpoints so the span stays exact.
    const jitter =
      i === 0 || i === n - 1
        ? 0
        : Math.round(Math.sin(i * 2.7) * 20 * 60);
    return { ...bet, secsAgo: Math.max(0, Math.round(base + jitter)) };
  });
}

/**
 * Engine implied-price clamp: round(100 * pool / total) into [1, 99].
 * Matches place_bet / snapshot-price-history cron.
 */
export function impliedFromPools(pool: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(99, Math.max(1, Math.round((100 * pool) / total)));
}

export interface ReplayBet {
  /** Index into the outcomes/pools array. */
  outcomeIdx: number;
  amount: number;
  /** Unix ms timestamp for the post-bet snapshot. */
  atMs: number;
}

export interface PriceHistoryRow {
  outcomeIdx: number;
  implied: number;
  pool: number;
  recordedAtMs: number;
}

/**
 * Replay bets chronologically into per-outcome price_history rows (FR-12).
 * Starts from house seed pools, writes one snapshot per outcome after each
 * bet (and an optional opening snapshot at `openAtMs`).
 */
export function replayPriceHistory(
  outcomeCount: number,
  bets: readonly ReplayBet[],
  options: {
    seedPool?: number;
    openAtMs?: number;
  } = {},
): PriceHistoryRow[] {
  const seed = options.seedPool ?? HOUSE_SEED;
  let pools = Array.from({ length: outcomeCount }, () => seed);
  const rows: PriceHistoryRow[] = [];

  const snapshot = (atMs: number) => {
    const total = pools.reduce((s, p) => s + p, 0);
    for (let i = 0; i < pools.length; i++) {
      rows.push({
        outcomeIdx: i,
        implied: impliedFromPools(pools[i], total),
        pool: pools[i],
        recordedAtMs: atMs,
      });
    }
  };

  if (options.openAtMs !== undefined) {
    snapshot(options.openAtMs);
  }

  const ordered = [...bets].sort((a, b) => a.atMs - b.atMs);
  for (const bet of ordered) {
    const idx = ((bet.outcomeIdx % outcomeCount) + outcomeCount) % outcomeCount;
    pools = applyBetToPools(pools, idx, bet.amount);
    snapshot(bet.atMs);
  }

  return rows;
}

/**
 * Fill long gaps between bet snapshots with carry-forward points so charts
 * span calendar days instead of looking like a handful of dots. Step is in
 * ms (default 12h). Does not invent price moves - only holds the last pools.
 */
export function densifyPriceHistory(
  rows: readonly PriceHistoryRow[],
  stepMs: number = 12 * 60 * 60 * 1000,
): PriceHistoryRow[] {
  if (rows.length === 0 || stepMs <= 0) return [...rows];

  const byTime = new Map<number, PriceHistoryRow[]>();
  for (const row of rows) {
    const bucket = byTime.get(row.recordedAtMs) ?? [];
    bucket.push(row);
    byTime.set(row.recordedAtMs, bucket);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  if (times.length < 2) return [...rows];

  const out: PriceHistoryRow[] = [];
  for (let i = 0; i < times.length; i++) {
    const snap = byTime.get(times[i])!;
    out.push(...snap);
    if (i === times.length - 1) break;

    const next = times[i + 1];
    let cursor = times[i] + stepMs;
    while (cursor < next - stepMs / 2) {
      for (const row of snap) {
        out.push({ ...row, recordedAtMs: cursor });
      }
      cursor += stepMs;
    }
  }
  return out;
}
