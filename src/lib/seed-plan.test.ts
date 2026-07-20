// E-6 / S6-1 — pure planning helpers for the seed scripts. The scripts
// themselves hit a live Supabase REST API; everything money- or shape-relevant
// is tested here (FR-9 aggregate cap, C-1/C-2 outcome bounds, D-7 mix).

import { describe, expect, it } from "vitest";
import {
  applyBetToPools,
  capViolations,
  OUTCOME_LABEL_POOL,
  seedOutcomeSets,
  type SeedBet,
} from "./seed-plan";
import { CAP_PER_MARKET, MAX_OUTCOMES, MIN_OUTCOMES } from "./constants";

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
    // Three separate 200 HC stakes on three outcomes: 600 total — over cap.
    const wave = [bet(2, 0, 200), bet(2, 1, 200), bet(2, 2, 200)];
    expect(capViolations(wave)).toHaveLength(1);
  });
});
