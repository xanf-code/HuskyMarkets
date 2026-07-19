// Leaderboard + hall-of-fame queries. RPCs do the heavy lifting; this layer
// shapes camelCase DTOs for the page.

import { createClient } from "@/lib/supabase/server";

export interface SemesterInfo {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface SemesterEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}

export interface AccuracyEntry {
  rank: number;
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  winRate: number;
  volume: number;
}

export interface HallOfFameEntry {
  semesterId: string;
  semesterName: string;
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}

export interface ProfileStats {
  biggestWin: number;
  worstLoss: number;
  currentStreak: number;
}

export async function getCurrentSemester(): Promise<SemesterInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_current_semester");
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export async function getSemesterBoard(
  semesterId: string,
  limit = 50,
): Promise<SemesterEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_semester_leaderboard", {
    p_semester_id: semesterId,
    p_limit: limit,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    displayName: row.display_name ?? "Unknown",
    score: row.score,
  }));
}

export async function getAccuracyBoard(
  semesterId: string,
): Promise<AccuracyEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accuracy_leaderboard", {
    p_semester_id: semesterId,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    displayName: row.display_name ?? "Unknown",
    wins: row.wins,
    losses: row.losses,
    winRate: Number(row.win_rate),
    volume: row.volume,
  }));
}

export async function getHallOfFame(): Promise<HallOfFameEntry[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("hall_of_fame")
    .select("semester_id, rank, user_id, display_name_snapshot, score")
    .order("rank", { ascending: true });

  if (error || !rows || rows.length === 0) return [];

  const semesterIds = [...new Set(rows.map((r) => r.semester_id))];
  const { data: semesters } = await supabase
    .from("semesters")
    .select("id, name, ends_at")
    .in("id", semesterIds)
    .order("ends_at", { ascending: false });

  const nameById = new Map((semesters ?? []).map((s) => [s.id, s.name]));
  const order = (semesters ?? []).map((s) => s.id);

  return rows
    .map((r) => ({
      semesterId: r.semester_id,
      semesterName: nameById.get(r.semester_id) ?? "Semester",
      rank: r.rank,
      userId: r.user_id,
      displayName: r.display_name_snapshot,
      score: r.score,
    }))
    .sort((a, b) => {
      const ai = order.indexOf(a.semesterId);
      const bi = order.indexOf(b.semesterId);
      if (ai !== bi) return ai - bi;
      return a.rank - b.rank;
    });
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_profile_stats", {
    p_user: userId,
  });
  if (error || !data || typeof data !== "object") {
    return { biggestWin: 0, worstLoss: 0, currentStreak: 0 };
  }
  const row = data as {
    biggest_win?: number;
    worst_loss?: number;
    current_streak?: number;
  };
  return {
    biggestWin: row.biggest_win ?? 0,
    worstLoss: row.worst_loss ?? 0,
    currentStreak: row.current_streak ?? 0,
  };
}
