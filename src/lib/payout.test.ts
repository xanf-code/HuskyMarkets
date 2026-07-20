import { describe, expect, it } from "vitest";
import {
  estimatePayout,
  impliedOutcome,
  positionValue,
} from "./payout";

describe("estimatePayout", () => {
  // Mirrors resolve_market's integer math with this bet added to the pools:
  //   total  = totalPool + amount
  //   vig    = floor(total * 5 / 100)
  //   after  = total - vig
  //   payout = floor(amount * after / (sidePool + amount))
  it("estimates a 100 HC bet into a fresh 100/100 market", () => {
    // total 300, vig 15, after 285 → floor(100 * 285 / 200) = 142
    expect(estimatePayout(100, 100, 200)).toBe(142);
  });

  it("floors the vig before the pro-rata split, exactly like SQL", () => {
    // total 210 → vig floor(10.5) = 10, after 200
    // floor(10 * 200 / 110) = 18
    expect(estimatePayout(10, 100, 200)).toBe(18);
  });

  it("floors the final pro-rata share", () => {
    // total 450, vig 22, after 428 → floor(250 * 428 / 350) = floor(305.71) = 305
    expect(estimatePayout(250, 100, 200)).toBe(305);
  });

  it("handles a bet joining an existing one-sided pool", () => {
    // pools 400/100 → bet 50 on NO: total 550, vig 27, after 523
    // floor(50 * 523 / 150) = floor(174.33) = 174
    expect(estimatePayout(50, 100, 500)).toBe(174);
  });

  it("returns 0 for a non-positive amount", () => {
    expect(estimatePayout(0, 100, 200)).toBe(0);
    expect(estimatePayout(-5, 100, 200)).toBe(0);
  });

  // N-outcome market tests (S0-1)
  it("handles a 3-outcome market (outcome1 pool=$200, total=$450)", () => {
    // 3-outcome pools: [200, 150, 100]
    // Bet 50 on outcome1: total=500, vig=25, after=475
    // floor(50 * 475 / 250) = floor(95) = 95
    expect(estimatePayout(50, 200, 450)).toBe(95);
  });

  it("handles a 4-outcome market with equal pools", () => {
    // 4-outcome pools: [100, 100, 100, 100]
    // Bet 100 on one outcome: total=500, vig=25, after=475
    // floor(100 * 475 / 200) = floor(237.5) = 237
    expect(estimatePayout(100, 100, 400)).toBe(237);
  });

  it("handles a large N-outcome bet with fractional vig", () => {
    // 6-outcome pools totaling 3000, one pool at 500
    // Bet 1000: total=4000, vig=200, after=3800
    // floor(1000 * 3800 / 1500) = floor(2533.33) = 2533
    expect(estimatePayout(1000, 500, 3000)).toBe(2533);
  });
});

describe("positionValue", () => {
  // Stake is already inside the pools (unlike estimatePayout which adds it).
  // Mirrors resolve_market: vig = floor(total*5/100), payout = floor(stake*after/side).
  it("values an existing 100 stake in a 450/300 market at settlement math", () => {
    // total 750, vig 37, after 713 → floor(100 * 713 / 450) = 158
    expect(positionValue(100, 450, 750)).toBe(158);
  });

  it("matches estimatePayout for a fresh bet once that bet is in the pools", () => {
    // Order panel before: estimatePayout(100, 100, 200) = 142
    // After fill pools are 200/100; positionValue(100, 200, 300) = 142
    expect(estimatePayout(100, 100, 200)).toBe(142);
    expect(positionValue(100, 200, 300)).toBe(142);
  });

  it("returns 0 when stake or side pool is non-positive", () => {
    expect(positionValue(0, 200, 300)).toBe(0);
    expect(positionValue(100, 0, 300)).toBe(0);
  });

  // N-outcome market tests (S0-1)
  it("values a stake in a 3-outcome market [200, 150, 100]", () => {
    // 3-outcome pools: [200, 150, 100]
    // Stake 150 in the first pool, total 450
    // vig = 22, after = 428 → floor(150 * 428 / 200) = floor(321) = 321
    expect(positionValue(150, 200, 450)).toBe(321);
  });

  it("values a small stake in a large 4-outcome market", () => {
    // 4-outcome pools: [500, 400, 300, 200] = 1400 total
    // Stake 50 in first pool: vig = 70, after = 1330
    // floor(50 * 1330 / 500) = floor(133) = 133
    expect(positionValue(50, 500, 1400)).toBe(133);
  });

  it("values a majority stake in a 6-outcome market", () => {
    // 6-outcome pools totaling 3000, with 1500 in one pool
    // Stake 1500, vig = 150, after = 2850
    // floor(1500 * 2850 / 1500) = 2850
    expect(positionValue(1500, 1500, 3000)).toBe(2850);
  });
});

// ---------------------------------------------------------------------------
// S0-1: N-outcome generalization
// ---------------------------------------------------------------------------

describe("impliedOutcome", () => {
  it("prices a balanced 2-outcome market at 50", () => {
    expect(impliedOutcome(100, 200)).toBe(50);
  });

  it("3-outcome [200,150,100] → 150/450 = 33", () => {
    // round(100 * 150 / 450) = round(33.33) = 33
    expect(impliedOutcome(150, 450)).toBe(33);
  });

  it("4-outcome equal pools → 25% each", () => {
    // round(100 * 100 / 400) = 25
    expect(impliedOutcome(100, 400)).toBe(25);
  });

  it("clamps to a minimum of 1", () => {
    expect(impliedOutcome(1, 100_000)).toBe(1);
  });

  it("clamps to a maximum of 99", () => {
    expect(impliedOutcome(99_999, 100_000)).toBe(99);
  });

  it("sum of all N implied prices is ~100 (within rounding) for equal pools", () => {
    for (let n = 2; n <= 6; n++) {
      const total = n * 100;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += impliedOutcome(100, total);
      }
      // Rounding means sum can be off by at most n cents; with equal pools it's exact
      expect(sum).toBe(n * Math.round(100 / n));
    }
  });

  it("matches binary-market hand-calc values (regression)", () => {
    expect(impliedOutcome(170, 270)).toBe(63);
    expect(impliedOutcome(100, 200)).toBe(50);
    expect(impliedOutcome(100_000, 100_100)).toBe(99);
  });
});
