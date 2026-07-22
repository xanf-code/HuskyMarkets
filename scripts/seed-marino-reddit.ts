#!/usr/bin/env node
/**
 * One-off: Marino rant count on r/Northeastern (wildcard).
 *
 * - Opens Jul 1, 2026 · closes / resolves Spring 2027
 * - ~95–105 seed predictors, bets spread Jul 1 → now
 * - Densified price_history (12h) -no live-tip cliffs / empty stretches
 *
 * Usage:
 *   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-marino-reddit.ts
 */
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing: set SEED_ENV=dev");
  process.exit(1);
}

import { CAP_PER_MARKET } from "../src/lib/constants";
import {
  densifyPriceHistory,
  replayPriceHistory,
} from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const SR = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
} as const;

const SEED_PASSWORD = "HuskyM4rkets!Seed2026";
const TITLE = "How many Marino rant posts hit r/Northeastern by Spring 2027?";
const OPEN_AT = "2026-07-01T15:00:00.000Z";
const CLOSE_AT = "2027-03-01T04:00:00.000Z"; // Spring 2027
const RESOLVE_AT = "2027-03-08T04:00:00.000Z";
const PREDICTOR_TARGET = 95 + Math.floor(Math.random() * 11); // 95–105
const DAY = 24 * 3600 * 1000;
const STEP = 12 * 60 * 60 * 1000;

const SPEC = {
  category: "wildcard" as const,
  title: TITLE,
  description:
    "Marino Center lore never dies. We’re counting distinct Reddit posts on r/Northeastern where someone is clearly ranting about Marino or describing a bad experience there -broken machines, sketchy vibes, “never again,” the usual. Memes that dunk on Marino count if the post is mainly about a bad Marino experience; offhand one-liners in unrelated threads don’t. Window: posts dated July 1, 2026 through the Spring 2027 close date.",
  resolution_criteria:
    "Resolves by a manual count of qualifying posts on reddit.com/r/Northeastern with created dates from 2026-07-01 through market close. Qualifying = primary topic is a negative Marino experience or rant (title or body). Comments-only don’t count; crossposts/reposts of the same incident count once.",
  outcomes: ["0–2", "3–5", "6–10", "11–20", "21+"],
};

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

async function rpc<T>(name: string, body: unknown, jwt?: string): Promise<T> {
  const res = await fetch(`${BASE}/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${jwt ?? SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`rpc ${name} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted outcome pick -mid buckets a bit more popular than extremes. */
function pickOutcomeIdx(n: number): number {
  // weights for 5 outcomes: lean 3–5 and 6–10
  const weights = [0.12, 0.28, 0.3, 0.2, 0.1];
  const w = weights.slice(0, n);
  const sum = w.reduce((s, x) => s + x, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return n - 1;
}

let signInGate: Promise<void> = Promise.resolve();
const jwtCache = new Map<string, string>();

async function signIn(email: string): Promise<string> {
  let last = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`${AUTH}/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: SEED_PASSWORD }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token: string };
      return data.access_token;
    }
    last = await res.text();
    if (res.status === 429 || /rate.?limit/i.test(last)) {
      const wait = Math.min(30_000, 2000 * 2 ** attempt) + randInt(0, 1000);
      console.warn(`  rate-limited ${email}, wait ${Math.round(wait / 1000)}s…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`sign-in ${email}: ${last}`);
  }
  throw new Error(`sign-in ${email}: ${last}`);
}

async function getJwt(email: string): Promise<string> {
  const hit = jwtCache.get(email);
  if (hit) return hit;
  let token = "";
  const run = signInGate.then(async () => {
    await new Promise((r) => setTimeout(r, 1100));
    token = await signIn(email);
    jwtCache.set(email, token);
  });
  signInGate = run.then(
    () => undefined,
    () => undefined,
  );
  await run;
  return token;
}

async function topUp(userId: string, minBalance: number): Promise<void> {
  const txns = await rest<{ amount: number }[]>(
    "GET",
    `/transactions?user_id=eq.${userId}&select=amount`,
  );
  const bal = txns.reduce((s, t) => s + t.amount, 0);
  if (bal < minBalance) {
    await rest("POST", "/transactions", {
      user_id: userId,
      type: "signup_grant",
      amount: minBalance - bal,
    });
  }
}

async function placeBet(
  email: string,
  marketId: string,
  outcomeId: string,
  amount: number,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = await getJwt(email);
    try {
      const res = await rpc<{ bet_id: string }>(
        "place_bet",
        {
          p_market_id: marketId,
          p_outcome_id: outcomeId,
          p_amount: amount,
        },
        token,
      );
      return res.bet_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/401|jwt|expired|not authenticated/i.test(msg)) {
        jwtCache.delete(email);
        continue;
      }
      if (/429|rate.?limit/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("place_bet failed after retries");
}

async function backdateBet(marketId: string, betId: string, atIso: string) {
  await rest(
    "PATCH",
    `/bets?id=eq.${betId}`,
    { created_at: atIso },
    { Prefer: "return=minimal" },
  );
  const latest = await rest<{ recorded_at: string }[]>(
    "GET",
    `/price_history?market_id=eq.${marketId}&select=recorded_at&order=recorded_at.desc&limit=1`,
  );
  if (latest[0]) {
    await rest(
      "PATCH",
      `/price_history?market_id=eq.${marketId}&recorded_at=eq.${encodeURIComponent(latest[0].recorded_at)}`,
      { recorded_at: atIso },
      { Prefer: "return=minimal" },
    );
  }
}

async function removeExistingIfAny(): Promise<void> {
  const rows = await rest<{ id: string }[]>(
    "GET",
    `/markets?title=eq.${encodeURIComponent(TITLE)}&select=id`,
  );
  if (rows.length === 0) return;
  console.log(`Removing prior Marino market (${rows.length})…`);
  for (const m of rows) {
    await rest("DELETE", `/price_history?market_id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
    await rest("DELETE", `/notifications?market_id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
    await rest("DELETE", `/reports?market_id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
    await rest("DELETE", `/mod_actions?market_id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
    // bets blocked by append-only txs -wipe txs for this market first via note
    try {
      await rest("DELETE", `/bets?market_id=eq.${m.id}`, undefined, {
        Prefer: "return=minimal",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot delete prior Marino bets (likely append-only txs). Wipe txs for market ${m.id} in SQL, then re-run.\n${msg}`,
      );
    }
    await rest("DELETE", `/markets?id=eq.${m.id}`, undefined, {
      Prefer: "return=minimal",
    });
  }
}

async function rebuildPriceHistory(marketId: string): Promise<number> {
  const markets = await rest<
    {
      id: string;
      created_at: string;
      market_outcomes: { id: string; sort_order: number; pool: number }[];
    }[]
  >(
    "GET",
    `/markets?id=eq.${marketId}&select=id,created_at,market_outcomes!market_outcomes_market_id_fkey(id,sort_order,pool)`,
  );
  const m = markets[0];
  if (!m) throw new Error("market missing for PH rebuild");
  const outcomes = [...m.market_outcomes].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const bets = await rest<
    { outcome_id: string; amount: number; created_at: string }[]
  >(
    "GET",
    `/bets?market_id=eq.${marketId}&select=outcome_id,amount,created_at&order=created_at.asc&limit=5000`,
  );
  if (bets.length === 0) return 0;

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
  const openAt = Math.min(first, new Date(OPEN_AT).getTime());
  let rows = replayPriceHistory(outcomes.length, replay, { openAtMs: openAt });

  // Extend to ~now with SAME last prices (no divergent live tip → no cliff)
  const endMs = Math.max(last, Date.now() - 60_000);
  const lastSnap = rows.filter((r) => r.recordedAtMs === last);
  if (endMs > last + STEP / 2) {
    for (const r of lastSnap) {
      rows.push({ ...r, recordedAtMs: endMs });
    }
  }
  rows = densifyPriceHistory(rows, STEP);

  await rest("DELETE", `/price_history?market_id=eq.${marketId}`, undefined, {
    Prefer: "return=minimal",
  });
  const payload = rows.map((r) => ({
    market_id: marketId,
    outcome_id: outcomes[r.outcomeIdx].id,
    implied: r.implied,
    pool: r.pool,
    recorded_at: new Date(r.recordedAtMs).toISOString(),
  }));
  for (let i = 0; i < payload.length; i += 200) {
    await rest("POST", "/price_history", payload.slice(i, i + 200), {
      Prefer: "return=minimal",
    });
  }
  return payload.length;
}

async function main() {
  console.log(`Marino Reddit market seed`);
  console.log(`  predictors target: ${PREDICTOR_TARGET}`);
  console.log(`  open ${OPEN_AT} → close ${CLOSE_AT} → resolve ${RESOLVE_AT}`);

  await removeExistingIfAny();

  // Creators + predictors already provisioned by full catalog seed
  const creatorEmail = "creator01.seed@northeastern.edu";
  const predictors = await rest<{ id: string; email: string }[]>(
    "GET",
    `/profiles?email=like.*predictor*.seed@northeastern.edu&select=id,email&order=email.asc&limit=200`,
  );
  if (predictors.length < PREDICTOR_TARGET) {
    throw new Error(
      `Need ≥${PREDICTOR_TARGET} predictor profiles, found ${predictors.length}. Run seed-full-catalog first.`,
    );
  }

  console.log("Topping up creator + predictors…");
  const creatorRows = await rest<{ id: string }[]>(
    "GET",
    `/profiles?email=eq.${encodeURIComponent(creatorEmail)}&select=id&limit=1`,
  );
  if (!creatorRows[0]) throw new Error(`missing ${creatorEmail}`);
  await topUp(creatorRows[0].id, 80_000);
  const chosen = shuffle(predictors).slice(0, PREDICTOR_TARGET);
  for (const p of chosen) {
    await topUp(p.id, 5_000);
  }

  console.log("Creating market…");
  jwtCache.clear();
  const creatorJwt = await getJwt(creatorEmail);
  const created = await rpc<{
    market_id: string;
    outcomes: { id: string; label: string }[];
  }>(
    "create_market",
    {
      p_title: SPEC.title,
      p_description: SPEC.description,
      p_category: SPEC.category,
      p_resolution_criteria: SPEC.resolution_criteria,
      p_close_at: CLOSE_AT,
      p_resolve_at: RESOLVE_AT,
      p_outcomes: SPEC.outcomes,
      p_catch_all: false,
      p_auto_flagged: false,
    },
    creatorJwt,
  );

  const byLabel = new Map(
    created.outcomes.map((o) => [o.label.toLowerCase(), o.id]),
  );
  const outcomeIds = SPEC.outcomes.map((label) => {
    const id = byLabel.get(label.toLowerCase());
    if (!id) throw new Error(`missing outcome ${label}`);
    return id;
  });

  await rest(
    "PATCH",
    `/markets?id=eq.${created.market_id}`,
    { created_at: OPEN_AT, close_at: CLOSE_AT, resolve_at: RESOLVE_AT },
    { Prefer: "return=minimal" },
  );
  console.log(`  market ${created.market_id}`);

  const spanStart = Date.parse(OPEN_AT);
  const spanEnd = Date.now() - 2 * 60 * 60 * 1000;

  console.log(`\nSeeding bets (${chosen.length} predictors)…`);
  const spent = new Map<string, number>();
  const jobs: {
    user: { id: string; email: string };
    outcomeId: string;
    amount: number;
    atMs: number;
  }[] = [];

  for (let i = 0; i < chosen.length; i++) {
    const user = chosen[i];
    // Mostly one bet; ~20% place a second touch for organic motion
    const touches = Math.random() < 0.2 ? 2 : 1;
    for (let t = 0; t < touches; t++) {
      const headroom = CAP_PER_MARKET - (spent.get(user.id) ?? 0);
      if (headroom < 15) break;
      const amount = Math.min(headroom, randInt(18, 70));
      const oi = pickOutcomeIdx(outcomeIds.length);
      const tFrac = (i + t * 0.41) / Math.max(chosen.length, 1);
      const jitter = Math.sin(i * 1.7 + t * 3) * 0.06;
      const atMs = Math.round(
        spanStart +
          (spanEnd - spanStart) * Math.min(1, Math.max(0, tFrac + jitter)),
      );
      jobs.push({
        user,
        outcomeId: outcomeIds[oi],
        amount,
        atMs,
      });
      spent.set(user.id, (spent.get(user.id) ?? 0) + amount);
    }
  }
  jobs.sort((a, b) => a.atMs - b.atMs);

  let placed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const betId = await placeBet(
        job.user.email,
        created.market_id,
        job.outcomeId,
        job.amount,
      );
      await backdateBet(
        created.market_id,
        betId,
        new Date(job.atMs).toISOString(),
      );
      placed++;
      if (placed % 25 === 0) {
        console.log(`  ${placed}/${jobs.length} bets…`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cap|insufficient|balance/i.test(msg)) {
        console.warn(`  bet skip: ${msg.slice(0, 140)}`);
      }
    }
  }
  console.log(`  placed ${placed} bets`);

  console.log("\nRebuilding densified price_history…");
  const phRows = await rebuildPriceHistory(created.market_id);
  console.log(`  ${phRows} PH rows`);

  const check = await rest<
    {
      id: string;
      status: string;
      created_at: string;
      close_at: string;
      resolve_at: string;
    }[]
  >(
    "GET",
    `/markets?id=eq.${created.market_id}&select=id,status,created_at,close_at,resolve_at`,
  );
  const betCount = await rest<{ id: string }[]>(
    "GET",
    `/bets?market_id=eq.${created.market_id}&select=id`,
  );
  const ph = await rest<{ recorded_at: string }[]>(
    "GET",
    `/price_history?market_id=eq.${created.market_id}&select=recorded_at&order=recorded_at.asc&limit=1`,
  );
  const phLast = await rest<{ recorded_at: string }[]>(
    "GET",
    `/price_history?market_id=eq.${created.market_id}&select=recorded_at&order=recorded_at.desc&limit=1`,
  );

  console.log("\n── Done ──────────────────────────────────────────────");
  console.log(`Title:     ${TITLE}`);
  console.log(`Status:    ${check[0]?.status}`);
  console.log(`Created:   ${check[0]?.created_at}`);
  console.log(`Close:     ${check[0]?.close_at}`);
  console.log(`Resolve:   ${check[0]?.resolve_at}`);
  console.log(`Predictors:${chosen.length}`);
  console.log(`Bets:      ${betCount.length}`);
  console.log(`PH span:   ${ph[0]?.recorded_at} → ${phLast[0]?.recorded_at}`);
  console.log(
    `\n⚠ bet_place txs still have “now” timestamps (append-only). Optional SQL:\n` +
      `ALTER TABLE public.transactions DISABLE TRIGGER transactions_append_only;\n` +
      `UPDATE public.transactions t SET created_at = b.created_at\n` +
      `FROM public.bets b WHERE t.bet_id = b.id AND t.type = 'bet_place'\n` +
      `AND t.market_id = '${created.market_id}';\n` +
      `ALTER TABLE public.transactions ENABLE TRIGGER transactions_append_only;`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
