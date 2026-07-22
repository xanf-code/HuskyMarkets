"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { APPEARANCE_COOKIE, APPEARANCE_COOKIE_OPTIONS } from "@/lib/appearance";
import { getSession } from "@/lib/dal";
import {
  ONBOARDED_COOKIE,
  ONBOARDED_COOKIE_OPTIONS,
} from "@/lib/onboarded-cookie";
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
    appearance: z.enum(["light", "dark"]).optional().default("light"),
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

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_mode: parsed.data.displayMode,
      real_name: parsed.data.realName ?? null,
      onboarded: true,
    })
    .eq("id", session.userId);

  if (error) return { ok: false, error: error.message };

  // Stamp the presence-based onboarding cookie so future requests skip the
  // per-request profiles.onboarded lookup in the proxy, and persist the
  // chosen appearance so the very next render (the redirect to "/") is
  // already in the right theme.
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDED_COOKIE, "1", ONBOARDED_COOKIE_OPTIONS);
  cookieStore.set(
    APPEARANCE_COOKIE,
    parsed.data.appearance,
    APPEARANCE_COOKIE_OPTIONS,
  );

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

const emailNotificationsSchema = z.object({ enabled: z.boolean() });

/**
 * Flips the caller's `profiles.email_notifications` preference. The column
 * grant permits the update; RLS scopes it to the caller's own row.
 */
export async function setEmailNotifications(
  input: unknown,
): Promise<ActionResult<{ enabled: boolean }>> {
  const parsed = emailNotificationsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid preference." };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  // `profiles.email_notifications` is added by a migration applied in
  // parallel; cast the update payload until database.types picks it up.
  const { error } = await supabase
    .from("profiles")
    .update({
      email_notifications: parsed.data.enabled,
    } as never)
    .eq("id", session.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true, enabled: parsed.data.enabled };
}
