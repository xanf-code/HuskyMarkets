"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { flagContent } from "@/lib/content-flags";
import { sendResolutionEmails } from "@/lib/email/send-resolution-emails";
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
        message: `"${CATCH_ALL_LABEL}" is added by the catch-all toggle - remove the duplicate label.`,
      },
    );
}

export async function createMarket(
  input: unknown,
): Promise<ActionResult<{ marketId: string; status: "open" | "pending" }>> {
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

  // Outcome labels go through the same content rule as the title - a clean
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

  if (error) {
    if (error.message.startsWith("rate_limited:")) {
      return {
        ok: false,
        error: "You're creating markets too fast — try again later.",
      };
    }
    return { ok: false, error: error.message };
  }

  const { market_id: marketId, status } = data as {
    market_id: string;
    status: "open" | "pending";
  };

  // Auto-report only when the market actually went live; flagged-pending
  // markets are already in the staff queue.
  if (screening.flagged && status === "open") {
    await supabase.from("reports").insert({
      market_id: marketId,
      reporter_id: session.userId,
      reason: "auto: possible targeting of an individual",
    });
  }

  revalidatePath("/");
  return { ok: true, marketId, status };
}

function buildUpdateMarketSchema(maxOutcomes: number) {
  return buildCreateMarketSchema(maxOutcomes).and(
    z.object({ marketId: z.uuid() }),
  );
}

function mapUpdateError(message: string): string {
  if (message.includes("market has bets")) {
    return "This market has bets and can no longer be edited.";
  }
  if (message.includes("not allowed")) {
    return "You don't have permission to edit this market.";
  }
  if (message.includes("market not editable")) {
    return "This market is no longer editable.";
  }
  return message;
}

export async function updateMarket(
  input: unknown,
): Promise<ActionResult<{ marketId: string }>> {
  const supabase = await createClient();

  const { data: cfg } = await supabase
    .from("app_config")
    .select("int_val")
    .eq("key", "max_outcomes")
    .single();
  const maxOutcomes = cfg?.int_val ?? MAX_OUTCOMES;

  const updateMarketSchema = buildUpdateMarketSchema(maxOutcomes);
  const parsed = updateMarketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const {
    marketId,
    title,
    description,
    category,
    closeAt,
    resolveAt,
    resolutionCriteria,
    outcomes,
    catchAll,
  } = parsed.data;

  const screening = flagContent(
    title,
    description ?? "",
    [resolutionCriteria, ...outcomes].join("\n"),
  );
  if (screening.blocked) {
    return {
      ok: false,
      error: "This market violates community standards and can't be saved.",
    };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.rpc("update_market", {
    p_market_id: marketId,
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

  if (error) return { ok: false, error: mapUpdateError(error.message) };

  revalidatePath(`/market/${marketId}`);
  revalidatePath("/");
  return { ok: true, marketId };
}

const ownMarketSchema = z.object({ marketId: z.uuid() });

export async function deleteOwnMarket(input: unknown): Promise<ActionResult> {
  const parsed = ownMarketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_market", {
    p_market_id: parsed.data.marketId,
    p_action: "void",
  });
  if (error) return { ok: false, error: error.message };
  const deletedMarketId = parsed.data.marketId;
  after(async () => {
    await sendResolutionEmails(deletedMarketId);
  });
  revalidatePath(`/market/${parsed.data.marketId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function lockOwnMarket(input: unknown): Promise<ActionResult> {
  const parsed = ownMarketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_market", {
    p_market_id: parsed.data.marketId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/market/${parsed.data.marketId}`);
  revalidatePath("/");
  return { ok: true };
}
