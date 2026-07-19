"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { flagContent } from "@/lib/content-flags";
import { CATEGORIES } from "@/lib/constants";
import { getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  (typeof CATEGORIES)[number]["value"],
  ...(typeof CATEGORIES)[number]["value"][],
];

const createMarketSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(10, "Titles need at least 10 characters.")
      .max(120, "Titles are capped at 120 characters."),
    description: z.string().trim().max(2000).optional(),
    category: z.enum(CATEGORY_VALUES),
    closeAt: z.iso.datetime({ offset: true }),
    resolveAt: z.iso.datetime({ offset: true }),
    resolutionCriteria: z
      .string()
      .trim()
      .min(20, "Spell out the resolution criteria (at least 20 characters)."),
    agreeRules: z.literal(true, {
      error: "You must agree to the market rules.",
    }),
  })
  .refine((input) => new Date(input.closeAt).getTime() > Date.now(), {
    message: "Close time must be in the future.",
  })
  .refine(
    (input) => new Date(input.resolveAt) >= new Date(input.closeAt),
    { message: "Resolve time must be at or after the close time." },
  );

export async function createMarket(
  input: unknown,
): Promise<ActionResult<{ marketId: string }>> {
  const parsed = createMarketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { title, description, category, closeAt, resolveAt, resolutionCriteria } =
    parsed.data;

  const screening = flagContent(title, description ?? "", resolutionCriteria);
  if (screening.blocked) {
    return {
      ok: false,
      error:
        "This market violates community standards and can't be created.",
    };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data: market, error } = await supabase
    .from("markets")
    .insert({
      creator_id: session.userId,
      title,
      description: description || null,
      category,
      close_at: closeAt,
      resolve_at: resolveAt,
      resolution_criteria: resolutionCriteria,
      auto_flagged: screening.flagged,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (screening.flagged) {
    // Auto-report into the admin queue; filed under the creator since the
    // system has no identity of its own and reports RLS requires self.
    await supabase.from("reports").insert({
      market_id: market.id,
      reporter_id: session.userId,
      reason: "auto: possible targeting of an individual",
    });
  }

  revalidatePath("/");
  return { ok: true, marketId: market.id };
}
