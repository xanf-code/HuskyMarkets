"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BAILOUT_THRESHOLD } from "@/lib/constants";
import type { ActionResult } from "./profile";

export async function claimDailyBonus(): Promise<
  ActionResult<{ claimed: boolean }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_daily_bonus");

  if (error) return { ok: false, error: error.message };

  const claimed = Boolean(data);
  if (claimed) revalidatePath("/", "layout");
  return { ok: true, claimed };
}

export async function claimBailout(): Promise<
  ActionResult<{ claimed: boolean }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_bailout");

  if (error) {
    if (error.message.includes("balance below 100")) {
      return {
        ok: false,
        error: `Bailouts are for when you're broke — your balance must be below ${BAILOUT_THRESHOLD} HC.`,
      };
    }
    return { ok: false, error: error.message };
  }

  const claimed = Boolean(data);
  if (claimed) revalidatePath("/", "layout");
  return { ok: true, claimed };
}
