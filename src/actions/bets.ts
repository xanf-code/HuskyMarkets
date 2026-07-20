"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CAP_PER_MARKET } from "@/lib/constants";
import {
  outcomeStateFromRpc,
  type OutcomeState,
} from "@/lib/outcomes";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const placeBetSchema = z.object({
  marketId: z.uuid(),
  outcomeId: z.uuid(),
  amount: z
    .number()
    .int("Whole HC only.")
    .min(1, "Minimum bet is 1 HC.")
    .max(CAP_PER_MARKET, `Maximum bet is ${CAP_PER_MARKET} HC.`),
});

export interface BetFill {
  /** Full per-outcome pool/price map, ordered by sort_order (REC-12). */
  outcomes: OutcomeState[];
  newBalance: number;
}

/** SQL exception → user-facing message. Unknown errors pass through raw. */
function friendlyBetError(message: string): string {
  if (message.includes("market closed")) {
    return "This market is closed to new bets.";
  }
  if (message.includes("insufficient balance")) {
    return "You don't have enough HC for that bet.";
  }
  if (message.includes("per-market cap")) {
    return `You can stake at most ${CAP_PER_MARKET} HC per market, across all outcomes.`;
  }
  if (message.includes("outcome does not belong to this market")) {
    return "That outcome doesn't belong to this market.";
  }
  if (message.includes("bet amount")) {
    return `Bets must be between 1 and ${CAP_PER_MARKET} HC.`;
  }
  return message;
}

export async function placeBet(
  input: unknown,
): Promise<ActionResult<BetFill>> {
  const parsed = placeBetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { marketId, outcomeId, amount } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bet", {
    p_market_id: marketId,
    p_outcome_id: outcomeId,
    p_amount: amount,
  });

  if (error) return { ok: false, error: friendlyBetError(error.message) };

  const fill = data as {
    new_balance: number;
    outcomes: unknown;
  };

  revalidatePath(`/market/${marketId}`);
  revalidatePath("/", "layout");

  return {
    ok: true,
    outcomes: outcomeStateFromRpc(fill.outcomes),
    newBalance: fill.new_balance,
  };
}
