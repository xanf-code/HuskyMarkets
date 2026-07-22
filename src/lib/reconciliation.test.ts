// E-6 / S6-2 - REC-17 reconciliation: pre-migration snapshot vs post-migration
// re-run. Zero-diff is required (FR-32, NFR-8); any delta fails loudly.

import { describe, expect, it } from "vitest";
import { diffSnapshots, type BoardSnapshot } from "./reconciliation";

function snapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    capturedAt: "2026-07-19T00:00:00Z",
    accuracy: [
      { userRef: "user-001", rank: 1, wins: 8, losses: 2, winRate: 0.8, volume: 500 },
      { userRef: "user-002", rank: 2, wins: 5, losses: 5, winRate: 0.5, volume: 400 },
    ],
    semester: [
      { userRef: "user-001", rank: 1, score: 1250 },
      { userRef: "user-002", rank: 2, score: 900 },
    ],
    profileStats: {
      "user-001": { biggestWin: 300, worstLoss: 120, currentStreak: 2 },
      "user-002": { biggestWin: 150, worstLoss: 200, currentStreak: -1 },
    },
    ...overrides,
  };
}

describe("diffSnapshots (REC-17)", () => {
  it("returns an empty diff for identical snapshots (timestamps ignored)", () => {
    const before = snapshot();
    const after = snapshot({ capturedAt: "2026-07-20T00:00:00Z" });
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("flags a changed accuracy win rate", () => {
    const after = snapshot();
    after.accuracy[0] = { ...after.accuracy[0], wins: 7, winRate: 0.7 };
    const diff = diffSnapshots(snapshot(), after);
    expect(diff).toHaveLength(2);
    expect(diff.every((d) => d.includes("accuracy") && d.includes("user-001"))).toBe(true);
  });

  it("flags a missing board entry and an added board entry", () => {
    const after = snapshot();
    after.semester = [
      { userRef: "user-002", rank: 1, score: 900 },
      { userRef: "user-003", rank: 2, score: 800 },
    ];
    const diff = diffSnapshots(snapshot(), after);
    expect(diff.some((d) => d.includes("semester") && d.includes("user-001") && d.includes("missing"))).toBe(true);
    expect(diff.some((d) => d.includes("semester") && d.includes("user-003") && d.includes("added"))).toBe(true);
  });

  it("flags changed profile stats", () => {
    const after = snapshot();
    after.profileStats["user-001"] = { biggestWin: 300, worstLoss: 90, currentStreak: 2 };
    const diff = diffSnapshots(snapshot(), after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toContain("profileStats");
    expect(diff[0]).toContain("worstLoss");
  });

  it("reports multiple deltas deterministically ordered", () => {
    const after = snapshot();
    after.accuracy[1] = { ...after.accuracy[1], volume: 401 };
    after.semester[0] = { ...after.semester[0], score: 1249 };
    after.profileStats["user-002"] = { biggestWin: 150, worstLoss: 200, currentStreak: 1 };
    const diff = diffSnapshots(snapshot(), after);
    expect(diff).toHaveLength(3);
    expect(diff).toEqual([...diff].sort());
  });

  it("treats two empty snapshots as clean", () => {
    expect(
      diffSnapshots(
        { capturedAt: "a", accuracy: [], semester: [], profileStats: {} },
        { capturedAt: "b", accuracy: [], semester: [], profileStats: {} },
      ),
    ).toEqual([]);
  });
});
