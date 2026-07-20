// Shared capture for the REC-17 reconciliation pair. Queries the public
// boards and a sample of profile stats, pseudonymizes user ids (stable
// user-NNN refs), and returns the machine-diffable snapshot shape defined in
// src/lib/reconciliation.ts. Artifacts stay inside the ops boundary.

import type { BoardSnapshot } from "../../src/lib/reconciliation";

const PROFILE_SAMPLE_LIMIT = 25;

interface SemesterRow {
  id: string;
}
interface AccuracyRow {
  rank: number;
  user_id: string;
  wins: number;
  losses: number;
  win_rate: number;
  volume: number;
}
interface SemesterBoardRow {
  rank: number;
  user_id: string;
  score: number;
}

async function rpc<T>(
  base: string,
  key: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`rpc ${fn} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// resolvedBefore: when set, the accuracy and profile-stats RPCs only count
// markets resolved strictly before this timestamp (W2 / REC-17). Pass the
// pre-migration snapshot's capturedAt on the post-migration re-run so any
// market that resolved in the gap between snapshot and deploy is excluded by
// construction, making all remaining diffs "unexplained" and unambiguously
// attributable to the migration.
export async function captureSnapshot(
  supabaseUrl: string,
  serviceRoleKey: string,
  resolvedBefore?: string,
): Promise<BoardSnapshot> {
  const base = supabaseUrl.replace(/\/$/, "");

  const semesters = await rpc<SemesterRow[]>(base, serviceRoleKey, "get_current_semester", {});
  if (!semesters.length) throw new Error("No current semester — cannot snapshot boards.");
  const semesterId = semesters[0].id;

  const accuracyParams: Record<string, unknown> = { p_semester_id: semesterId };
  if (resolvedBefore) accuracyParams.p_resolved_before = resolvedBefore;

  const accuracy = await rpc<AccuracyRow[]>(base, serviceRoleKey, "get_accuracy_leaderboard", accuracyParams);
  const semester = await rpc<SemesterBoardRow[]>(base, serviceRoleKey, "get_semester_leaderboard", {
    p_semester_id: semesterId,
    p_limit: 50,
  });

  // Stable pseudonyms: sort real ids, assign user-NNN in order.
  const userIds = [
    ...new Set([...accuracy.map((r) => r.user_id), ...semester.map((r) => r.user_id)]),
  ].sort();
  const refByUserId = new Map(
    userIds.map((id, i) => [id, `user-${String(i + 1).padStart(3, "0")}`]),
  );
  const ref = (id: string) => refByUserId.get(id) ?? "user-unknown";

  const profileStats: BoardSnapshot["profileStats"] = {};
  for (const userId of userIds.slice(0, PROFILE_SAMPLE_LIMIT)) {
    const statsParams: Record<string, unknown> = { p_user: userId };
    if (resolvedBefore) statsParams.p_resolved_before = resolvedBefore;
    const stats = await rpc<{
      biggest_win?: number;
      worst_loss?: number;
      current_streak?: number;
    }>(base, serviceRoleKey, "get_profile_stats", statsParams);
    profileStats[ref(userId)] = {
      biggestWin: stats.biggest_win ?? 0,
      worstLoss: stats.worst_loss ?? 0,
      currentStreak: stats.current_streak ?? 0,
    };
  }

  return {
    capturedAt: new Date().toISOString(),
    accuracy: accuracy.map((r) => ({
      userRef: ref(r.user_id),
      rank: r.rank,
      wins: r.wins,
      losses: r.losses,
      winRate: Number(r.win_rate),
      volume: r.volume,
    })),
    semester: semester.map((r) => ({
      userRef: ref(r.user_id),
      rank: r.rank,
      score: r.score,
    })),
    profileStats,
  };
}
