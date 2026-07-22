// E-6 / S6-1 - pure planning helpers for the seed scripts. The scripts
// themselves hit a live Supabase REST API; everything money- or shape-relevant
// is tested here (FR-9 aggregate cap, C-1/C-2 outcome bounds, D-7 mix).

import { describe, expect, it } from "vitest";
import {
  applyBetToPools,
  capViolations,
  densifyPriceHistory,
  impliedFromPools,
  OUTCOME_LABEL_POOL,
  replayPriceHistory,
  seedOutcomeSets,
  staggerWave,
  type SeedBet,
} from "./seed-plan";
import { CAP_PER_MARKET, HOUSE_SEED, MAX_OUTCOMES, MIN_OUTCOMES } from "./constants";

describe("seedOutcomeSets (D-7)", () => {
  it("produces a mix spanning every outcome count from 2 to 6", () => {
    const sets = seedOutcomeSets();
    const counts = new Set(sets.map((s) => s.length));
    for (let n = MIN_OUTCOMES; n <= MAX_OUTCOMES; n++) {
      expect(counts.has(n)).toBe(true);
    }
  });

  it("keeps every set within the 2–6 bounds with unique labels", () => {
    for (const set of seedOutcomeSets()) {
      expect(set.length).toBeGreaterThanOrEqual(MIN_OUTCOMES);
      expect(set.length).toBeLessThanOrEqual(MAX_OUTCOMES);
      expect(new Set(set.map((l) => l.toLowerCase())).size).toBe(set.length);
      for (const label of set) {
        expect(label.trim().length).toBeGreaterThanOrEqual(1);
        expect(label.length).toBeLessThanOrEqual(40);
        expect(OUTCOME_LABEL_POOL).toContain(label);
      }
    }
  });

  it("labels multi-outcome sets generically (no Yes/No on 3+ markets)", () => {
    for (const set of seedOutcomeSets()) {
      if (set.length > 2) {
        expect(set).not.toContain("Yes");
        expect(set).not.toContain("No");
      }
    }
  });
});

describe("applyBetToPools", () => {
  it("adds the stake to the chosen outcome's pool only", () => {
    expect(applyBetToPools([100, 100, 100], 2, 50)).toEqual([100, 100, 150]);
  });

  it("does not mutate the input", () => {
    const pools = [100, 200];
    applyBetToPools(pools, 0, 10);
    expect(pools).toEqual([100, 200]);
  });
});

describe("capViolations (FR-9 aggregate cap)", () => {
  const bet = (userIdx: number, outcomeIdx: number, amount: number): SeedBet => ({
    userIdx,
    outcomeIdx,
    amount,
    secsAgo: 60,
  });

  it("accepts hedged stakes whose aggregate stays at or under the cap", () => {
    const wave = [bet(0, 0, 300), bet(0, 1, 200), bet(1, 0, 500)];
    expect(capViolations(wave)).toEqual([]);
  });

  it("flags a user whose stakes across outcomes exceed the cap", () => {
    const wave = [bet(0, 0, 300), bet(0, 2, 201), bet(1, 0, 10)];
    expect(capViolations(wave)).toEqual([
      { userIdx: 0, total: 501, cap: CAP_PER_MARKET },
    ]);
  });

  it("aggregates across ALL outcomes, not per outcome", () => {
    // Three separate 200 HC stakes on three outcomes: 600 total - over cap.
    const wave = [bet(2, 0, 200), bet(2, 1, 200), bet(2, 2, 200)];
    expect(capViolations(wave)).toHaveLength(1);
  });
});

describe("staggerWave", () => {
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const bet = (userIdx: number, outcomeIdx: number, amount: number): SeedBet => ({
    userIdx,
    outcomeIdx,
    amount,
    secsAgo: 0,
  });

  it("spreads oldest→newest across the span", () => {
    const wave = [bet(0, 0, 10), bet(1, 0, 10), bet(2, 0, 10)];
    const staggered = staggerWave(wave, 3 * DAY);
    expect(staggered[0].secsAgo).toBe(3 * DAY);
    expect(staggered[staggered.length - 1].secsAgo).toBe(0);
    for (let i = 1; i < staggered.length; i++) {
      expect(staggered[i - 1].secsAgo).toBeGreaterThan(staggered[i].secsAgo);
    }
  });

  it("preserves stake fields", () => {
    const wave = [bet(0, 1, 80), bet(3, 2, 40)];
    const staggered = staggerWave(wave, DAY);
    expect(staggered[0]).toMatchObject({
      userIdx: 0,
      outcomeIdx: 1,
      amount: 80,
    });
    expect(staggered[1]).toMatchObject({
      userIdx: 3,
      outcomeIdx: 2,
      amount: 40,
    });
  });

  it("handles a single-bet wave", () => {
    expect(staggerWave([bet(0, 0, 10)], DAY)).toEqual([
      { userIdx: 0, outcomeIdx: 0, amount: 10, secsAgo: DAY },
    ]);
  });
});

describe("impliedFromPools", () => {
  it("matches the engine clamp into [1, 99]", () => {
    expect(impliedFromPools(100, 200)).toBe(50);
    expect(impliedFromPools(800, 1080)).toBe(74);
    expect(impliedFromPools(1, 10_000)).toBe(1);
    expect(impliedFromPools(9999, 10_000)).toBe(99);
  });

  it("guards a zero total", () => {
    expect(impliedFromPools(0, 0)).toBe(1);
  });
});

describe("replayPriceHistory", () => {
  const HOUR = 3600_000;

  it("writes an opening equal-odds snapshot then post-bet rows", () => {
    const rows = replayPriceHistory(
      2,
      [{ outcomeIdx: 0, amount: 100, atMs: 2 * HOUR }],
      { openAtMs: HOUR },
    );
    // open: 2 outcomes; after bet: 2 more
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      outcomeIdx: 0,
      pool: HOUSE_SEED,
      implied: 50,
      recordedAtMs: HOUR,
    });
    expect(rows[2]).toMatchObject({
      outcomeIdx: 0,
      pool: HOUSE_SEED + 100,
      recordedAtMs: 2 * HOUR,
    });
    expect(rows[3]).toMatchObject({
      outcomeIdx: 1,
      pool: HOUSE_SEED,
      recordedAtMs: 2 * HOUR,
    });
  });

  it("replays bets in chronological order regardless of input order", () => {
    const rows = replayPriceHistory(2, [
      { outcomeIdx: 1, amount: 50, atMs: 3 * HOUR },
      { outcomeIdx: 0, amount: 100, atMs: 1 * HOUR },
    ]);
    expect(rows[0].recordedAtMs).toBe(HOUR);
    expect(rows[0].outcomeIdx).toBe(0);
    expect(rows[0].pool).toBe(HOUSE_SEED + 100);
    expect(rows[2].recordedAtMs).toBe(3 * HOUR);
    expect(rows[3].pool).toBe(HOUSE_SEED + 50);
  });

  it("covers multi-outcome markets", () => {
    const rows = replayPriceHistory(4, [
      { outcomeIdx: 2, amount: 200, atMs: HOUR },
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.pool)).toEqual([
      HOUSE_SEED,
      HOUSE_SEED,
      HOUSE_SEED + 200,
      HOUSE_SEED,
    ]);
    const total = 4 * HOUSE_SEED + 200;
    expect(rows[2].implied).toBe(impliedFromPools(HOUSE_SEED + 200, total));
  });
});

describe("densifyPriceHistory", () => {
  const DAY = 24 * 3600_000;

  it("inserts carry-forward points between sparse snapshots", () => {
    const sparse = [
      { outcomeIdx: 0, implied: 50, pool: 100, recordedAtMs: 0 },
      { outcomeIdx: 1, implied: 50, pool: 100, recordedAtMs: 0 },
      { outcomeIdx: 0, implied: 60, pool: 150, recordedAtMs: 2 * DAY },
      { outcomeIdx: 1, implied: 40, pool: 100, recordedAtMs: 2 * DAY },
    ];
    const dense = densifyPriceHistory(sparse, DAY);
    const times = [...new Set(dense.map((r) => r.recordedAtMs))].sort(
      (a, b) => a - b,
    );
    expect(times).toEqual([0, DAY, 2 * DAY]);
    // Midday hold copies the opening pools.
    expect(dense.filter((r) => r.recordedAtMs === DAY)).toEqual([
      { outcomeIdx: 0, implied: 50, pool: 100, recordedAtMs: DAY },
      { outcomeIdx: 1, implied: 50, pool: 100, recordedAtMs: DAY },
    ]);
  });

  it("is a no-op for a single timestamp", () => {
    const rows = [
      { outcomeIdx: 0, implied: 50, pool: 100, recordedAtMs: 0 },
      { outcomeIdx: 1, implied: 50, pool: 100, recordedAtMs: 0 },
    ];
    expect(densifyPriceHistory(rows)).toEqual(rows);
  });
});
