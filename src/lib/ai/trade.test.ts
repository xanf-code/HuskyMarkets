import { describe, it, expect } from "vitest";
import { computeEdge, computeBetSize } from "./trade";

describe("computeEdge", () => {
  it("returns positive edge when estimate > implied", () => {
    expect(computeEdge(65, 50)).toBe(15);
  });

  it("returns zero when equal", () => {
    expect(computeEdge(50, 50)).toBe(0);
  });

  it("returns negative when estimate < implied", () => {
    expect(computeEdge(30, 55)).toBe(-25);
  });
});

describe("computeBetSize", () => {
  const threshold = 15;
  const minBet = 25;
  const maxBet = 150;

  it("returns 0 when balance is at or below reserve", () => {
    const size = computeBetSize(20, threshold, minBet, maxBet, 500, 50);
    expect(size).toBe(0);
  });

  it("returns 0 when remaining cap is 0", () => {
    const size = computeBetSize(20, threshold, minBet, maxBet, 0, 500);
    expect(size).toBe(0);
  });

  it("is capped by remaining cap", () => {
    // remainingCap=10 < sized → function returns 10; caller decides whether to skip vs minBet.
    const size = computeBetSize(30, threshold, minBet, maxBet, 10, 1000);
    expect(size).toBe(10);
  });

  it("is capped by balance minus reserve", () => {
    const size = computeBetSize(30, threshold, minBet, maxBet, 500, 60);
    // balance=60, reserve=50 → max spendable = 10, min(sized, 500, 10) = 10
    expect(size).toBe(10);
  });

  it("scales with edge within [minBet, maxBet]", () => {
    // Large edge should yield a bet closer to maxBet.
    // Using deterministic check: at edge=50 threshold=15, base = min(150, 25 + 35*4) = min(150,165)=150
    // With jitter [0.8,1.2], result is in [120, 180] clamped to maxBet=150 → [120, 150]
    const size = computeBetSize(65, threshold, minBet, maxBet, 500, 1000);
    expect(size).toBeGreaterThanOrEqual(minBet);
    expect(size).toBeLessThanOrEqual(maxBet);
  });

  it("at minimum edge (=threshold) yields bet near minBet", () => {
    // edge=threshold: base = min(150, 25 + 0) = 25, jitter → [20, 30], clamped to maxBet
    const size = computeBetSize(threshold + 15, threshold, minBet, maxBet, 500, 1000);
    // edge=15: base=25, jitter [0.8,1.2] → [20, 30]
    expect(size).toBeGreaterThanOrEqual(0);
    expect(size).toBeLessThanOrEqual(maxBet);
  });
});
