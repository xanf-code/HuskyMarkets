"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const onboardingSchema = z
  .object({
    displayMode: z.enum(["real", "anon"]),
    realName: z
      .string()
      .trim()
      .min(1, "Enter your name to use real-name mode.")
      .max(80, "That name is too long.")
      .optional(),
  })
  .refine((input) => input.displayMode === "anon" || Boolean(input.realName), {
    message: "Enter your name to use real-name mode.",
  });

export async function completeOnboarding(
  input: unknown,
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_mode: parsed.data.displayMode,
      real_name: parsed.data.realName ?? null,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rerollAnonHandle(): Promise<
  ActionResult<{ handle: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reroll_anon_handle");

  if (error) return { ok: false, error: error.message };
  return { ok: true, handle: data as string };
}
