"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { flagContent } from "@/lib/content-flags";
import {
  CATCH_ALL_LABEL,
  CATEGORIES,
  MAX_OUTCOMES,
  MIN_OUTCOMES,
} from "@/lib/constants";
import { getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  (typeof CATEGORIES)[number]["value"],
  ...(typeof CATEGORIES)[number]["value"][],
];

function buildCreateMarketSchema(maxOutcomes: number) {
  const outcomeLabels = z
    .array(
      z
        .string()
        .trim()
        .min(1, "Outcome labels can't be blank.")
        .max(40, "Outcome labels are capped at 40 characters."),
    )
    .min(MIN_OUTCOMES, `A market needs at least ${MIN_OUTCOMES} outcomes.`)
    .max(maxOutcomes, `A market can have at most ${maxOutcomes} outcomes.`);

  return z
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
      outcomes: outcomeLabels,
      catchAll: z.boolean(),
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
    )
    .refine(
      // Label uniqueness is case-insensitive after trimming (A-1).
      (input) =>
        new Set(input.outcomes.map((label) => label.toLowerCase())).size ===
        input.outcomes.length,
      { message: "Outcome labels must be unique." },
    )
    .refine(
      // One decided UX for the catch-all/label collision, shared by form and
      // RPC: the toggle plus an identical creator label is rejected inline.
      (input) =>
        !input.catchAll ||
        !input.outcomes.some(
          (label) => label.toLowerCase() === CATCH_ALL_LABEL.toLowerCase(),
        ),
      {
        message: `"${CATCH_ALL_LABEL}" is added by the catch-all toggle — remove the duplicate label.`,
      },
    );
}

export async function createMarket(
  input: unknown,
): Promise<ActionResult<{ marketId: string }>> {
  const supabase = await createClient();

  const { data: cfg } = await supabase
    .from("app_config")
    .select("int_val")
    .eq("key", "max_outcomes")
    .single();
  const maxOutcomes = cfg?.int_val ?? MAX_OUTCOMES;

  const createMarketSchema = buildCreateMarketSchema(maxOutcomes);
  const parsed = createMarketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const {
    title,
    description,
    category,
    closeAt,
    resolveAt,
    resolutionCriteria,
    outcomes,
    catchAll,
  } = parsed.data;

  // Outcome labels go through the same content rule as the title — a clean
  // title must not smuggle a profane or person-targeting label (REC-15).
  const screening = flagContent(
    title,
    description ?? "",
    [resolutionCriteria, ...outcomes].join("\n"),
  );
  if (screening.blocked) {
    return {
      ok: false,
      error:
        "This market violates community standards and can't be created.",
    };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("create_market", {
    p_title: title,
    p_description: description ?? "",
    p_category: category,
    p_resolution_criteria: resolutionCriteria,
    p_close_at: closeAt,
    p_resolve_at: resolveAt,
    p_outcomes: outcomes,
    p_catch_all: catchAll,
    p_auto_flagged: screening.flagged,
  });

  if (error) return { ok: false, error: error.message };

  const { market_id: marketId } = data as { market_id: string };

  if (screening.flagged) {
    // Auto-report into the admin queue; filed under the creator since the
    // system has no identity of its own and reports RLS requires self.
    await supabase.from("reports").insert({
      market_id: marketId,
      reporter_id: session.userId,
      reason: "auto: possible targeting of an individual",
    });
  }

  revalidatePath("/");
  return { ok: true, marketId };
}
