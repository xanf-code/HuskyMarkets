import { createAdminClient } from "@/lib/supabase/admin";

export interface AiConfig {
  marketsEnabled: boolean;
  tradingEnabled: boolean;
  edgeThreshold: number;
  minBet: number;
  maxBet: number;
  marketsPerBotRun: number;
  seedingEnabled: boolean;
  seedingTargetVolume: number;
  botCount: number;
  botInitialGrant: number;
}

export async function getAiConfig(): Promise<AiConfig> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_config")
    .select("key, int_val")
    .in("key", [
      "ai_markets_enabled",
      "ai_trading_enabled",
      "ai_trade_edge_threshold",
      "ai_trade_min_bet",
      "ai_trade_max_bet",
      "ai_trade_markets_per_bot_run",
      "ai_seeding_enabled",
      "ai_seeding_target_volume",
      "ai_bot_count",
      "ai_bot_initial_grant",
    ]);

  if (error) throw new Error(`Failed to read ai config: ${error.message}`);

  const row = (key: string, fallback: number): number => {
    const found = (data ?? []).find((r) => r.key === key);
    return found?.int_val ?? fallback;
  };

  return {
    marketsEnabled: row("ai_markets_enabled", 1) === 1,
    tradingEnabled: row("ai_trading_enabled", 1) === 1,
    edgeThreshold: row("ai_trade_edge_threshold", 15),
    minBet: row("ai_trade_min_bet", 25),
    maxBet: row("ai_trade_max_bet", 150),
    marketsPerBotRun: row("ai_trade_markets_per_bot_run", 3),
    seedingEnabled: row("ai_seeding_enabled", 1) === 1,
    seedingTargetVolume: row("ai_seeding_target_volume", 2500),
    botCount: row("ai_bot_count", 10),
    botInitialGrant: row("ai_bot_initial_grant", 5000),
  };
}

/** Returns all bot credentials derived from env vars. */
export interface BotCredential {
  email: string;
  password: string;
  index: number;
}

export function getBotCredentials(count?: number): BotCredential[] {
  const prefix = process.env.AI_BOT_EMAIL_PREFIX ?? "husky.bot.";
  const domain = process.env.AI_BOT_EMAIL_DOMAIN ?? "@northeastern.edu";
  const password = process.env.AI_BOT_PASSWORD ?? "";
  const n = count ?? parseInt(process.env.AI_BOT_COUNT ?? "10", 10);

  if (!password) throw new Error("AI_BOT_PASSWORD is not set");

  return Array.from({ length: n }, (_, i) => ({
    email: `${prefix}${i + 1}${domain}`,
    password,
    index: i + 1,
  }));
}
