#!/usr/bin/env node
// Rebuild price_history from existing bets so charts span real wall-clock
// time (E-6 / S6-1). Demo markets often have backdated bets but only a single
// cron snapshot at "now", which collapses every chart to one day (or empty).
//
// Strategy:
//   1. For each open market with ≥1 bet, delete existing price_history rows.
//   2. Replay bets chronologically from the 100 HC house seed, writing one
//      snapshot per outcome after each bet (same formula as place_bet / cron).
//   3. Append a final "now" snapshot from live pools so the right edge matches
//      the Buy panel odds even when seed/bet math drifted.
//
// Idempotent: safe to re-run; always rebuilds from bets + live pools.
//
// Usage from repo root:
//   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-price-history.ts

if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

import {
  impliedFromPools,
  replayPriceHistory,
} from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS: Record<string, string> = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const DAY = 24 * 3600 * 1000;

async function pgGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

async function pgDelete(path: string, params: Record<string, string>): Promise<void> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...HEADERS, Prefer: "return=minimal" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} → ${res.status}: ${text}`);
  }
}

async function pgPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
}

async function countRows(path: string, params?: Record<string, string>): Promise<number> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { ...HEADERS, Prefer: "count=exact" },
  });
  const header = res.headers.get("content-range");
  return parseInt(header?.split("/")[1] ?? "0", 10);
}

type Outcome = { id: string; sort_order: number; pool: number };
type Bet = { outcome_id: string; amount: number; created_at: string };
type Market = {
  id: string;
  title: string;
  created_at: string;
  market_outcomes: Outcome[];
};

async function rebuildMarket(market: Market): Promise<number> {
  const outcomes = [...market.market_outcomes].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (outcomes.length < 2) return 0;

  const bets = await pgGet<Bet[]>("/bets", {
    select: "outcome_id,amount,created_at",
    market_id: `eq.${market.id}`,
    order: "created_at.asc",
  });
  if (bets.length === 0) return 0;

  const outcomeIndex = new Map(outcomes.map((o, i) => [o.id, i]));
  const replayBets = bets
    .map((b) => {
      const idx = outcomeIndex.get(b.outcome_id);
      if (idx === undefined) return null;
      return {
        outcomeIdx: idx,
        amount: b.amount,
        atMs: new Date(b.created_at).getTime(),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const createdMs = new Date(market.created_at).getTime();
  const firstBetMs = replayBets[0].atMs;
  // Open at most one day before the first trade so charts don't sit flat at
  // 50/50 for weeks when the market was created long before any bets.
  const openAtMs = Math.max(createdMs, firstBetMs - DAY);

  // Replay bets only — Recharts monotone curves connect the trade stamps.
  // Skip carry-forward densify: long flat plateaus read as fake seed data.
  const rows = replayPriceHistory(outcomes.length, replayBets, { openAtMs });

  // Final live-pool snapshot so the chart right edge matches the Buy panel.
  const nowMs = Date.now();
  const liveTotal = outcomes.reduce((s, o) => s + o.pool, 0);
  if (liveTotal > 0) {
    const lastMs = rows.length > 0 ? rows[rows.length - 1].recordedAtMs : 0;
    const finalMs = nowMs > lastMs + 60_000 ? nowMs : lastMs + 60_000;
    for (let i = 0; i < outcomes.length; i++) {
      rows.push({
        outcomeIdx: i,
        implied: impliedFromPools(outcomes[i].pool, liveTotal),
        pool: outcomes[i].pool,
        recordedAtMs: finalMs,
      });
    }
  }

  await pgDelete("/price_history", { market_id: `eq.${market.id}` });

  // PostgREST accepts bulk inserts; chunk to stay under payload limits.
  const payload = rows.map((r) => ({
    market_id: market.id,
    outcome_id: outcomes[r.outcomeIdx].id,
    implied: r.implied,
    pool: r.pool,
    recorded_at: new Date(r.recordedAtMs).toISOString(),
  }));
  const CHUNK = 200;
  for (let i = 0; i < payload.length; i += CHUNK) {
    await pgPost("/price_history", payload.slice(i, i + CHUNK));
  }

  return payload.length;
}

async function main() {
  const markets = await pgGet<Market[]>("/markets", {
    select:
      "id,title,created_at,market_outcomes!market_outcomes_market_id_fkey(id,sort_order,pool)",
    status: "eq.open",
    order: "created_at.asc",
    limit: "100",
  });

  console.log(`Rebuilding price_history for ${markets.length} open markets…\n`);

  let totalRows = 0;
  let touched = 0;

  for (const market of markets) {
    const n = await rebuildMarket(market);
    if (n === 0) {
      console.log(`  skip  ${market.title.substring(0, 60)} (no bets)`);
      continue;
    }
    touched++;
    totalRows += n;
    const span = await pgGet<{ recorded_at: string }[]>("/price_history", {
      select: "recorded_at",
      market_id: `eq.${market.id}`,
      order: "recorded_at.asc",
      limit: "1",
    });
    const newest = await pgGet<{ recorded_at: string }[]>("/price_history", {
      select: "recorded_at",
      market_id: `eq.${market.id}`,
      order: "recorded_at.desc",
      limit: "1",
    });
    const from = span[0]?.recorded_at?.slice(0, 10) ?? "?";
    const to = newest[0]?.recorded_at?.slice(0, 10) ?? "?";
    console.log(
      `  ok    ${market.title.substring(0, 52).padEnd(52)} ${n} rows  ${from} → ${to}`,
    );
  }

  const totalPH = await countRows("/price_history", { select: "id" });
  console.log(`\nTouched ${touched} markets, wrote ${totalRows} snapshot rows.`);
  console.log(`Total price_history rows now: ${totalPH}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
