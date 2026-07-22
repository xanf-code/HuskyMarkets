#!/usr/bin/env node
/**
 * Repair price_history so charts have no empty Apr→Jul cliffs.
 *
 * Strategy:
 *  1. Replay bets chronologically (engine formula).
 *  2. Extend the series to an end time with the SAME final prices (no live jump).
 *  3. Densify every 12h so Recharts never stretches across a multi-month void.
 *
 * Spring-era markets (first bet before May, last bet before May 15) end at
 * last bet -they must not stretch the x-axis into July.
 * Open summer/fall markets extend to now with carry-forward of the last
 * replayed price (matches buy panel when all bets are included).
 *
 * Usage:
 *   SEED_ENV=dev npx tsx --env-file=.env.local scripts/repair-price-history.ts
 */
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing: set SEED_ENV=dev");
  process.exit(1);
}

import {
  densifyPriceHistory,
  impliedFromPools,
  replayPriceHistory,
} from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = `${SUPABASE_URL}/rest/v1`;
const SR = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
} as const;

const DAY = 24 * 3600 * 1000;
const STEP = 12 * 60 * 60 * 1000; // 12h -enough points, not cron spam

async function rest<T>(
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...SR, Prefer: "return=representation", ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

function isSpringEra(firstBetMs: number, lastBetMs: number): boolean {
  const may15 = Date.parse("2026-05-15T00:00:00Z");
  return firstBetMs < Date.parse("2026-05-01T00:00:00Z") && lastBetMs < may15;
}

async function repairMarket(m: {
  id: string;
  title: string;
  created_at: string;
  status: string;
  market_outcomes: { id: string; sort_order: number; pool: number }[];
}): Promise<number> {
  const outcomes = [...m.market_outcomes].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (outcomes.length < 2) return 0;

  const bets = await rest<
    { outcome_id: string; amount: number; created_at: string }[]
  >(
    "GET",
    `/bets?market_id=eq.${m.id}&select=outcome_id,amount,created_at&order=created_at.asc&limit=5000`,
  );
  if (bets.length === 0) {
    // No bets -leave a single equal-odds open snapshot at created_at only
    await rest("DELETE", `/price_history?market_id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
    return 0;
  }

  const idx = new Map(outcomes.map((o, i) => [o.id, i]));
  const replay = bets
    .map((b) => {
      const i = idx.get(b.outcome_id);
      if (i === undefined) return null;
      return {
        outcomeIdx: i,
        amount: b.amount,
        atMs: new Date(b.created_at).getTime(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const first = replay[0].atMs;
  const last = replay[replay.length - 1].atMs;
  const openAt = Math.min(
    first,
    Math.max(new Date(m.created_at).getTime(), first - DAY),
  );

  let rows = replayPriceHistory(outcomes.length, replay, { openAtMs: openAt });

  // End time: spring-era clips at last bet (no July stretch). Others → now.
  const spring = isSpringEra(first, last);
  const endMs = spring
    ? last
    : Math.max(last, Date.now() - 60_000);

  // Anchor end with SAME prices as last replay snap -never a divergent live jump.
  const lastSnap = rows.filter((r) => r.recordedAtMs === last);
  if (endMs > last + STEP / 2) {
    for (const r of lastSnap) {
      rows.push({ ...r, recordedAtMs: endMs });
    }
  }

  rows = densifyPriceHistory(rows, STEP);

  // For open non-spring markets, optionally refresh the tip to live pools ONLY
  // when it matches the replay tip (avoids cliffs). Otherwise keep replay tip.
  if (!spring && m.status === "open") {
    const liveTotal = outcomes.reduce((s, o) => s + o.pool, 0);
    let matches = true;
    const tipPools = new Map<number, number>();
    for (const r of lastSnap) tipPools.set(r.outcomeIdx, r.pool);
    for (let i = 0; i < outcomes.length; i++) {
      if (tipPools.get(i) !== outcomes[i].pool) {
        matches = false;
        break;
      }
    }
    if (matches && liveTotal > 0) {
      // already aligned -ensure tip timestamp is ~now
      const nowMs = Date.now();
      rows = rows.filter((r) => r.recordedAtMs < endMs - 1000);
      for (let i = 0; i < outcomes.length; i++) {
        rows.push({
          outcomeIdx: i,
          implied: impliedFromPools(outcomes[i].pool, liveTotal),
          pool: outcomes[i].pool,
          recordedAtMs: nowMs,
        });
      }
      // densify again from previous last to now with same prices already done
    }
  }

  await rest("DELETE", `/price_history?market_id=eq.${m.id}`, undefined, {
    Prefer: "return=minimal",
  });

  const payload = rows.map((r) => ({
    market_id: m.id,
    outcome_id: outcomes[r.outcomeIdx].id,
    implied: r.implied,
    pool: r.pool,
    recorded_at: new Date(r.recordedAtMs).toISOString(),
  }));

  for (let i = 0; i < payload.length; i += 250) {
    await rest("POST", "/price_history", payload.slice(i, i + 250), {
      Prefer: "return=minimal",
    });
  }

  // Clip spring market close so the UI chart domain isn't "now"
  if (spring && m.status === "open") {
    const closeAt = new Date(last + 2 * DAY).toISOString();
    const resolveAt = new Date(last + 5 * DAY).toISOString();
    await rest(
      "PATCH",
      `/markets?id=eq.${m.id}`,
      { close_at: closeAt, resolve_at: resolveAt },
      { Prefer: "return=minimal" },
    );
  }

  return payload.length;
}

async function main() {
  const markets = await rest<
    {
      id: string;
      title: string;
      created_at: string;
      status: string;
      market_outcomes: { id: string; sort_order: number; pool: number }[];
    }[]
  >(
    "GET",
    "/markets?select=id,title,created_at,status,market_outcomes!market_outcomes_market_id_fkey(id,sort_order,pool)&limit=100",
  );

  console.log(`Repairing price_history for ${markets.length} markets…\n`);
  let touched = 0;
  for (const m of markets) {
    const n = await repairMarket(m);
    if (n === 0) {
      console.log(`  skip  ${m.title.slice(0, 60)} (no bets)`);
      continue;
    }
    touched++;
    console.log(`  ok    ${String(n).padStart(4)} rows · ${m.title.slice(0, 55)}`);
  }
  console.log(`\nRepaired ${touched} markets.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
