"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

function mapStaffError(message: string): string {
  if (message.includes("conflict of interest: you created")) {
    return "You created this market — hand it to another staff member.";
  }
  if (message.includes("conflict of interest: you bet")) {
    return "You bet on this market — hand it to another staff member.";
  }
  if (message.includes("admin only")) {
    return "Only admins can do that.";
  }
  if (message.includes("staff only")) {
    return "Staff only.";
  }
  return message;
}

function revalidateStaff() {
  revalidatePath("/admin/resolve");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/markets");
  revalidatePath("/admin/mods");
  revalidatePath("/admin/semesters");
  revalidatePath("/admin/log");
  revalidatePath("/mod");
  revalidatePath("/");
}

const resolveSchema = z.object({
  marketId: z.uuid(),
  outcome: z.enum(["yes", "no", "void"]),
});

export async function resolveMarketAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_market", {
    p_market_id: parsed.data.marketId,
    p_outcome: parsed.data.outcome,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidateStaff();
  revalidatePath(`/market/${parsed.data.marketId}`);
  return { ok: true };
}

const lockSchema = z.object({ marketId: z.uuid() });

export async function lockMarketAction(input: unknown): Promise<ActionResult> {
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_market", {
    p_market_id: parsed.data.marketId,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidateStaff();
  revalidatePath(`/market/${parsed.data.marketId}`);
  return { ok: true };
}

const reportSchema = z.object({
  reportId: z.uuid(),
  action: z.enum(["dismiss", "action"]),
  note: z.string().trim().max(500).optional(),
});

export async function handleReportAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("handle_report", {
    p_report_id: parsed.data.reportId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidateStaff();
  return { ok: true };
}

const hideSchema = z.object({
  marketId: z.uuid(),
  hidden: z.boolean(),
});

export async function setMarketHidden(input: unknown): Promise<ActionResult> {
  const parsed = hideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_market_hidden", {
    p_market_id: parsed.data.marketId,
    p_hidden: parsed.data.hidden,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidateStaff();
  revalidatePath(`/market/${parsed.data.marketId}`);
  return { ok: true };
}

const reviewSchema = z.object({
  applicationId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function reviewModApplication(
  input: unknown,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_mod_application", {
    p_application_id: parsed.data.applicationId,
    p_decision: parsed.data.decision,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidatePath("/admin/mods");
  return { ok: true };
}

const revokeSchema = z.object({ userId: z.uuid() });

export async function revokeModerator(input: unknown): Promise<ActionResult> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_moderator", {
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidatePath("/admin/mods");
  return { ok: true };
}

const semesterSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
});

export async function upsertSemester(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = semesterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return { ok: false, error: "End must be after start." };
  }

  const supabase = await createClient();
  const id = parsed.data.id;

  if (id) {
    const { error } = await supabase
      .from("semesters")
      .update({
        name: parsed.data.name,
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/semesters");
    revalidatePath("/leaderboard");
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("semesters")
    .insert({
      name: parsed.data.name,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/semesters");
  revalidatePath("/leaderboard");
  return { ok: true, id: data.id };
}

const snapshotSchema = z.object({ semesterId: z.uuid() });

export async function closeSemester(input: unknown): Promise<ActionResult> {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("snapshot_semester", {
    p_semester_id: parsed.data.semesterId,
  });
  if (error) return { ok: false, error: mapStaffError(error.message) };
  revalidatePath("/admin/semesters");
  revalidatePath("/leaderboard");
  return { ok: true };
}
