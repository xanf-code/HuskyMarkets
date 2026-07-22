import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { generateMarketsForAllCategories } from "@/lib/ai/generate-markets";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const cfg = await getAiConfig();
    if (!cfg.marketsEnabled) {
      return NextResponse.json({ skipped: "ai_markets_enabled=0" });
    }

    const results = await generateMarketsForAllCategories();

    const summary = {
      proposed: results.filter((r) => r.status === "proposed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      blocked: results.filter((r) => r.status === "blocked").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    };

    console.log("[ai-markets] run complete:", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-markets] fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
