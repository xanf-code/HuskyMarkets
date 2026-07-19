"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CAP_PER_MARKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./profile";

const placeBetSchema = z.object({
  marketId: z.uuid(),
  side: z.enum(["yes", "no"]),
  amount: z
    .number()
    .int("Whole HC only.")
    .min(1, "Minimum bet is 1 HC.")
    .max(CAP_PER_MARKET, `Maximum bet is ${CAP_PER_MARKET} HC.`),
});

export interface BetFill {
  betId: string;
  yesPool: number;
  noPool: number;
  impliedYes: number;
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
    return `You can stake at most ${CAP_PER_MARKET} HC per market, across both sides.`;
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

  const { marketId, side, amount } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bet", {
    p_market_id: marketId,
    p_side: side,
    p_amount: amount,
  });

  if (error) return { ok: false, error: friendlyBetError(error.message) };

  const fill = data as {
    bet_id: string;
    yes_pool: number;
    no_pool: number;
    implied_yes: number;
    new_balance: number;
  };

  revalidatePath(`/market/${marketId}`);
  revalidatePath("/", "layout");

  return {
    ok: true,
    betId: fill.bet_id,
    yesPool: fill.yes_pool,
    noPool: fill.no_pool,
    impliedYes: fill.implied_yes,
    newBalance: fill.new_balance,
  };
}
