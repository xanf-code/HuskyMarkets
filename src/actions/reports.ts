"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const reportSchema = z.object({
  marketId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(10, "Give a bit more detail (at least 10 characters).")
    .max(1000),
});

export async function submitReport(input: unknown): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    market_id: parsed.data.marketId,
    reporter_id: session.userId,
    reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "You already have an open report on this market.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/market/${parsed.data.marketId}`);
  return { ok: true };
}
