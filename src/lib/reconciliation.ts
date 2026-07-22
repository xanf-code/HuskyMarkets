// REC-17 reconciliation primitives: the pre-migration snapshot and the
// post-migration re-run are plain JSON; diffing them must produce an empty
// result (FR-32 "must reconcile") or fail loudly (NFR-8). Kept I/O-free so
// the diff is unit-testable; scripts/ do the fetching and file handling.
//
// Entries are keyed by `userRef` - a pseudonym assigned at capture time - so
// artifacts carry no real user ids beyond the ops boundary.

export interface AccuracySnapshotEntry {
  userRef: string;
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  volume: number;
}

export interface SemesterSnapshotEntry {
  userRef: string;
  rank: number;
  score: number;
}

export interface ProfileStatSnapshot {
  biggestWin: number;
  worstLoss: number;
  currentStreak: number;
}

export interface BoardSnapshot {
  capturedAt: string;
  accuracy: AccuracySnapshotEntry[];
  semester: SemesterSnapshotEntry[];
  profileStats: Record<string, ProfileStatSnapshot>;
}

function diffEntries<T extends { userRef: string }>(
  board: string,
  before: readonly T[],
  after: readonly T[],
  fields: readonly (keyof T)[],
  out: string[],
): void {
  const beforeByRef = new Map(before.map((e) => [e.userRef, e]));
  const afterByRef = new Map(after.map((e) => [e.userRef, e]));

  for (const [ref, b] of beforeByRef) {
    const a = afterByRef.get(ref);
    if (!a) {
      out.push(`${board}: ${ref} missing after migration`);
      continue;
    }
    for (const f of fields) {
      if (a[f] !== b[f]) {
        out.push(`${board}: ${ref} ${String(f)} changed ${String(b[f])} → ${String(a[f])}`);
      }
    }
  }
  for (const ref of afterByRef.keys()) {
    if (!beforeByRef.has(ref)) {
      out.push(`${board}: ${ref} added after migration`);
    }
  }
}

/**
 * Human-readable deltas between two snapshots, sorted for deterministic
 * output. Empty array = reconciliation clean.
 */
export function diffSnapshots(
  before: BoardSnapshot,
  after: BoardSnapshot,
): string[] {
  const out: string[] = [];

  diffEntries(
    "accuracy",
    before.accuracy,
    after.accuracy,
    ["rank", "wins", "losses", "winRate", "volume"],
    out,
  );
  diffEntries(
    "semester",
    before.semester,
    after.semester,
    ["rank", "score"],
    out,
  );

  const refs = new Set([
    ...Object.keys(before.profileStats),
    ...Object.keys(after.profileStats),
  ]);
  for (const ref of refs) {
    const b = before.profileStats[ref];
    const a = after.profileStats[ref];
    if (!b) {
      out.push(`profileStats: ${ref} added after migration`);
      continue;
    }
    if (!a) {
      out.push(`profileStats: ${ref} missing after migration`);
      continue;
    }
    for (const f of ["biggestWin", "worstLoss", "currentStreak"] as const) {
      if (a[f] !== b[f]) {
        out.push(`profileStats: ${ref} ${f} changed ${b[f]} → ${a[f]}`);
      }
    }
  }

  return out.sort();
}
