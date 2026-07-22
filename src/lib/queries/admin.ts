// Admin / moderator queue queries. When `excludeUserId` is set (moderator
// dashboard), markets the user created or bet on are filtered out - mirrors
// assert_can_moderate_market on the server.

import { createClient } from "@/lib/supabase/server";

/** Pure conflict filter - UI mirror of assert_can_moderate_market. */
export function filterConflictMarkets<
  T extends { id: string; creatorId: string },
>(
  items: readonly T[],
  excludeUserId: string | undefined,
  betMarketIds: ReadonlySet<string>,
): T[] {
  if (!excludeUserId) return [...items];
  return items.filter(
    (m) => m.creatorId !== excludeUserId && !betMarketIds.has(m.id),
  );
}

export interface ResolveQueueItem {
  id: string;
  title: string;
  status: string;
  closeAt: string;
  reportCount: number;
  autoFlagged: boolean;
  creatorId: string;
  /** Selectable winning outcomes, in canonical sort_order (FR-28). */
  outcomes: { id: string; label: string }[];
}

export interface ReportQueueItem {
  id: string;
  marketId: string;
  marketTitle: string;
  reason: string;
  createdAt: string;
  reporterName: string;
}

export interface AdminMarketRow {
  id: string;
  title: string;
  status: string;
  hidden: boolean;
  autoFlagged: boolean;
  closeAt: string;
  createdAt: string;
}

export interface PendingMarketItem {
  id: string;
  title: string;
  category: string;
  closeAt: string;
  createdAt: string;
  autoFlagged: boolean;
  creatorId: string;
  creatorName: string;
}

export interface ModApplicationRow {
  id: string;
  userId: string;
  displayName: string;
  statement: string;
  createdAt: string;
}

export interface ModeratorRow {
  id: string;
  displayName: string;
  email: string;
}

export interface ActionLogRow {
  id: string;
  action: string;
  moderatorName: string;
  marketTitle: string | null;
  note: string | null;
  createdAt: string;
}

export interface SemesterRow {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** True when a Hall of Fame snapshot exists for this semester. */
  isClosed: boolean;
}

export async function getResolveQueue(
  excludeUserId?: string,
): Promise<ResolveQueueItem[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: markets } = await supabase
    .from("markets")
    .select(
      "id, title, status, close_at, auto_flagged, creator_id, hidden, market_outcomes!market_outcomes_market_id_fkey(id, label, sort_order)",
    )
    .in("status", ["open", "closed"])
    .eq("hidden", false)
    .order("close_at", { ascending: true });

  if (!markets || markets.length === 0) return [];

  const { data: openReports } = await supabase
    .from("reports")
    .select("market_id")
    .eq("status", "open");

  const reportCounts = new Map<string, number>();
  for (const r of openReports ?? []) {
    reportCounts.set(r.market_id, (reportCounts.get(r.market_id) ?? 0) + 1);
  }

  let conflictIds = new Set<string>();
  if (excludeUserId) {
    const { data: bets } = await supabase
      .from("bets")
      .select("market_id")
      .eq("user_id", excludeUserId);
    conflictIds = new Set((bets ?? []).map((b) => b.market_id));
  }

  const queued = markets
    .filter((m) => {
      const pastClose = m.close_at <= now || m.status === "closed";
      const reported = (reportCounts.get(m.id) ?? 0) > 0 || m.auto_flagged;
      return pastClose || reported;
    })
    .map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      closeAt: m.close_at,
      reportCount: reportCounts.get(m.id) ?? 0,
      autoFlagged: m.auto_flagged,
      creatorId: m.creator_id,
      outcomes: [...(m.market_outcomes ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({ id: o.id, label: o.label })),
    }));

  return filterConflictMarkets(queued, excludeUserId, conflictIds);
}

export async function getReportQueue(
  excludeUserId?: string,
): Promise<ReportQueueItem[]> {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, market_id, reason, created_at, reporter_id")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (!reports || reports.length === 0) return [];

  const marketIds = [...new Set(reports.map((r) => r.market_id))];
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];

  const [{ data: markets }, { data: profiles }] = await Promise.all([
    supabase.from("markets").select("id, title, creator_id").in("id", marketIds),
    supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", reporterIds),
  ]);

  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id!, p.display_name ?? "Unknown"]),
  );

  let conflictIds = new Set<string>();
  if (excludeUserId) {
    const { data: bets } = await supabase
      .from("bets")
      .select("market_id")
      .eq("user_id", excludeUserId);
    conflictIds = new Set((bets ?? []).map((b) => b.market_id));
  }

  return reports
    .filter((r) => {
      if (!excludeUserId) return true;
      const m = marketById.get(r.market_id);
      if (!m) return false;
      if (m.creator_id === excludeUserId) return false;
      if (conflictIds.has(r.market_id)) return false;
      return true;
    })
    .map((r) => ({
      id: r.id,
      marketId: r.market_id,
      marketTitle: marketById.get(r.market_id)?.title ?? "Market",
      reason: r.reason,
      createdAt: r.created_at,
      reporterName: nameById.get(r.reporter_id) ?? "Unknown",
    }));
}

export async function getPendingMarketsQueue(
  excludeUserId?: string,
): Promise<PendingMarketItem[]> {
  const supabase = await createClient();

  const { data: markets } = await supabase
    .from("markets")
    .select("id, title, category, close_at, created_at, auto_flagged, creator_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!markets || markets.length === 0) return [];

  const creatorIds = [...new Set(markets.map((m) => m.creator_id))];
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", creatorIds);

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id!, p.display_name ?? "Unknown"]),
  );

  let conflictIds = new Set<string>();
  if (excludeUserId) {
    const { data: created } = await supabase
      .from("markets")
      .select("id")
      .eq("creator_id", excludeUserId)
      .eq("status", "pending");
    conflictIds = new Set((created ?? []).map((m) => m.id));
  }

  return markets
    .filter((m) => !conflictIds.has(m.id))
    .map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      closeAt: m.close_at,
      createdAt: m.created_at,
      autoFlagged: m.auto_flagged,
      creatorId: m.creator_id,
      creatorName: nameById.get(m.creator_id) ?? "Unknown",
    }));
}

export async function getAdminMarkets(): Promise<AdminMarketRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, title, status, hidden, auto_flagged, close_at, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    hidden: m.hidden,
    autoFlagged: m.auto_flagged,
    closeAt: m.close_at,
    createdAt: m.created_at,
  }));
}

export async function getPendingApplications(): Promise<ModApplicationRow[]> {
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("mod_applications")
    .select("id, user_id, statement, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!apps || apps.length === 0) return [];

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in(
      "id",
      apps.map((a) => a.user_id),
    );

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id!, p.display_name ?? "Unknown"]),
  );

  return apps.map((a) => ({
    id: a.id,
    userId: a.user_id,
    displayName: nameById.get(a.user_id) ?? "Unknown",
    statement: a.statement,
    createdAt: a.created_at,
  }));
}

export async function getModerators(): Promise<ModeratorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, anon_handle, real_name, display_mode")
    .eq("role", "moderator")
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    displayName:
      p.display_mode === "real"
        ? (p.real_name ?? p.anon_handle)
        : p.anon_handle,
  }));
}

export async function getActionLog(limit = 100): Promise<ActionLogRow[]> {
  const supabase = await createClient();
  const { data: actions } = await supabase
    .from("mod_actions")
    .select("id, action, moderator_id, market_id, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!actions || actions.length === 0) return [];

  const modIds = [...new Set(actions.map((a) => a.moderator_id))];
  const marketIds = [
    ...new Set(actions.flatMap((a) => (a.market_id ? [a.market_id] : []))),
  ];

  const [{ data: profiles }, { data: markets }] = await Promise.all([
    supabase.from("public_profiles").select("id, display_name").in("id", modIds),
    marketIds.length
      ? supabase.from("markets").select("id, title").in("id", marketIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id!, p.display_name ?? "Unknown"]),
  );
  const titleById = new Map((markets ?? []).map((m) => [m.id, m.title]));

  return actions.map((a) => ({
    id: a.id,
    action: a.action,
    moderatorName: nameById.get(a.moderator_id) ?? "Unknown",
    marketTitle: a.market_id ? (titleById.get(a.market_id) ?? null) : null,
    note: a.note,
    createdAt: a.created_at,
  }));
}

export async function getSemesters(): Promise<SemesterRow[]> {
  const supabase = await createClient();
  const [{ data }, { data: hof }] = await Promise.all([
    supabase
      .from("semesters")
      .select("id, name, starts_at, ends_at")
      .order("starts_at", { ascending: false }),
    supabase.from("hall_of_fame").select("semester_id"),
  ]);

  const closedIds = new Set((hof ?? []).map((row) => row.semester_id));

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    isClosed: closedIds.has(s.id),
  }));
}
