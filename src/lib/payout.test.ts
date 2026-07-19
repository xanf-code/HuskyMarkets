import { describe, expect, it } from "vitest";
import { estimatePayout, impliedYes } from "./payout";

describe("impliedYes", () => {
  it("prices a balanced market at 50", () => {
    expect(impliedYes(100, 100)).toBe(50);
  });

  it("rounds to the nearest cent like the SQL snapshot formula", () => {
    // round(100 * 170 / 270) = round(62.96) = 63
    expect(impliedYes(170, 100)).toBe(63);
  });

  it("clamps a lopsided YES market to 99", () => {
    expect(impliedYes(100_000, 100)).toBe(99);
  });

  it("clamps a lopsided NO market to 1", () => {
    expect(impliedYes(100, 100_000)).toBe(1);
  });
});

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
});
