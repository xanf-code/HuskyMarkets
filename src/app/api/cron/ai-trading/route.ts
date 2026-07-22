import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, getBotCredentials } from "@/lib/ai/config";
import { runAllBots } from "@/lib/ai/trade";
import { seedMarketVolume } from "@/lib/ai/seed-market-volume";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const cfg = await getAiConfig();
    if (!cfg.tradingEnabled) {
      return NextResponse.json({ skipped: "ai_trading_enabled=0" });
    }

    const bots = getBotCredentials(cfg.botCount);

    // 1. Edge-based smart trading (first 2 bots, uses Claude).
    const tradingResults = await runAllBots(cfg, bots);

    // 2. Volume seeding pass (all bots, no Claude, round-robin outcomes).
    let seedingResult = null;
    if (cfg.seedingEnabled) {
      seedingResult = await seedMarketVolume(bots, cfg);
    }

    const summary = {
      trading: {
        bots: tradingResults.length,
        totalBets: tradingResults.reduce((s, r) => s + r.bets, 0),
        totalSkips: tradingResults.reduce((s, r) => s + r.skips, 0),
        totalErrors: tradingResults.reduce((s, r) => s + r.errors, 0),
        details: tradingResults,
      },
      seeding: seedingResult
        ? {
            marketsSeeded: seedingResult.markets.filter((m) => m.betsPlaced > 0).length,
            totalBets: seedingResult.totalBetsPlaced,
            totalErrors: seedingResult.totalErrors,
            details: seedingResult.markets,
          }
        : null,
    };

    console.log("[ai-trading] run complete:", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-trading] fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
