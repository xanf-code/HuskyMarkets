"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const applySchema = z.object({
  statement: z
    .string()
    .trim()
    .min(20, "Tell us a bit more (at least 20 characters).")
    .max(2000),
});

export async function applyForModerator(
  input: unknown,
): Promise<ActionResult> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("mod_applications").insert({
    user_id: user.id,
    statement: parsed.data.statement,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "You already have a pending moderator application.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  return { ok: true };
}
