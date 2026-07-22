#!/usr/bin/env node
// Seed realistic bets across existing open markets (E-6 / S6-1).
//
// Strategy:
//   1. Create 4 seed auth users via Supabase Auth Admin API (if they don't
//      already exist). The handle_new_user() trigger auto-creates their
//      public.profiles rows and credits each a 1000 HC signup_grant.
//   2. Top each user up via a direct transaction insert so multi-market
//      betting doesn't overdraft them.
//   3. Sign each user in (password grant) and place bets through the
//      place_bet engine RPC - bets reference outcome_id, the FR-9 aggregate
//      cap is engine-enforced, and price_history snapshots are written by the
//      engine (FR-12). Each bet is then backdated via secsAgo so charts span
//      multi-day price paths instead of a 1-second burst. Waves are
//      pre-validated against the cap with the same helper the unit tests cover.
//   4. Assert verify_ledger_invariant() is balanced at the end.
//
// Re-runnable / idempotent: seed users are only created when absent.
// Default mode only touches markets with 0 bets. Boost mode
// (SEED_MODE=boost) randomly adds more predictors + bets to every open
// market while respecting the FR-9 500 HC per-user aggregate cap.
//
// Usage from repo root:
//   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-bets.ts
//   SEED_ENV=dev SEED_MODE=boost npx tsx --env-file=.env.local scripts/seed-bets.ts

// Non-prod guard (S6-1): refuse to run unless explicitly marked as a dev seed.
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

import { CAP_PER_MARKET } from "../src/lib/constants";
import { capViolations, staggerWave, type SeedBet } from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
/** `boost` = add random predictors/bets to every open market; default = empty markets only. */
const SEED_MODE = process.env.SEED_MODE === "boost" ? "boost" : "fresh";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;
const HEADERS: Record<string, string> = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function pgPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
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

async function pgPatch(path: string, params: Record<string, string>, body: unknown): Promise<void> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sign-in ${email} → ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function placeBet(
  jwt: string,
  marketId: string,
  outcomeId: string,
  amount: number,
): Promise<{ bet_id: string; new_balance: number }> {
  const res = await fetch(`${BASE}/rpc/place_bet`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_market_id: marketId,
      p_outcome_id: outcomeId,
      p_amount: amount,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`place_bet ${marketId} → ${res.status}: ${text}`);
  }
  return (await res.json()) as { bet_id: string; new_balance: number };
}

/**
 * Backdate the bet + its post-bet price_history snapshot so charts span
 * real wall-clock time. Transactions stay at now() (append-only ledger).
 */
async function backdateBet(
  marketId: string,
  betId: string,
  secsAgo: number,
): Promise<void> {
  if (secsAgo <= 0) return;
  const ts = new Date(Date.now() - secsAgo * 1000).toISOString();

  await pgPatch("/bets", { id: `eq.${betId}` }, { created_at: ts });

  // The engine just wrote one snapshot row per outcome under a shared now().
  const latest = await pgGet<{ recorded_at: string }[]>("/price_history", {
    select: "recorded_at",
    market_id: `eq.${marketId}`,
    order: "recorded_at.desc",
    limit: "1",
  });
  if (latest.length === 0) return;

  await pgPatch(
    "/price_history",
    {
      market_id: `eq.${marketId}`,
      recorded_at: `eq.${latest[0].recorded_at}`,
    },
    { recorded_at: ts },
  );
}

// ── Seed user definitions ─────────────────────────────────────────────────────

// Emails are @northeastern.edu so the handle_new_user() trigger accepts them.
const SEED_USERS = [
  { email: "alice.seed@northeastern.edu", password: "HuskyM4rkets!Alice" },
  { email: "bob.seed@northeastern.edu",   password: "HuskyM4rkets!Bob" },
  { email: "carol.seed@northeastern.edu", password: "HuskyM4rkets!Carol" },
  { email: "dan.seed@northeastern.edu",   password: "HuskyM4rkets!Dan" },
  // Extra predictors for boost runs / denser bettor counts
  { email: "eve.seed@northeastern.edu",   password: "HuskyM4rkets!Eve" },
  { email: "frank.seed@northeastern.edu", password: "HuskyM4rkets!Frank" },
  { email: "grace.seed@northeastern.edu", password: "HuskyM4rkets!Grace" },
  { email: "hank.seed@northeastern.edu",  password: "HuskyM4rkets!Hank" },
  { email: "ivy.seed@northeastern.edu",   password: "HuskyM4rkets!Ivy" },
  { email: "jake.seed@northeastern.edu",  password: "HuskyM4rkets!Jake" },
  { email: "kate.seed@northeastern.edu",  password: "HuskyM4rkets!Kate" },
  { email: "leo.seed@northeastern.edu",   password: "HuskyM4rkets!Leo" },
];

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ── Bet wave templates ────────────────────────────────────────────────────────
// outcomeIdx is taken modulo the market's outcome count, so the same waves
// cover 2–6-outcome markets. Per-user aggregates stay within the 500 HC cap
// (asserted by capViolations before anything is sent).
// secsAgo placeholders are overwritten by staggerWave at placement time.

const DAY = 24 * 3600;
/** Chart span per wave index - 3–7 days so price paths look lived-in. */
const WAVE_SPANS_SECS = [
  5 * DAY,
  3 * DAY,
  6 * DAY,
  4 * DAY,
  7 * DAY,
  5 * DAY,
  3 * DAY,
  6 * DAY,
  4 * DAY,
  5 * DAY,
  // Waves 11–15 (multi-option markets)
  4 * DAY,
  6 * DAY,
  5 * DAY,
  3 * DAY,
  7 * DAY,
];

const BET_WAVES: SeedBet[][] = [
  // Wave 1 - 4 predictors, outcome-0 heavy (strong consensus)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 30,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 60,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 90,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 30,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
  ],
  // Wave 2 - 2 predictors, contested 50/50 (alice vs bob only)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 90,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 60,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 75,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 55,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 30,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 45,  secsAgo: 0 },
  ],
  // Wave 3 - 4 predictors, outcome-1 heavy
  [
    { userIdx: 1, outcomeIdx: 1, amount: 150, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 40,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 200, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 100, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 80,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 30,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 50,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 20,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 45,  secsAgo: 0 },
  ],
  // Wave 4 - 1 predictor, solo whale (carol dominates)
  [
    { userIdx: 2, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 150, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 100, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
  ],
  // Wave 5 - 3 predictors, small stakes, casual (alice, bob, carol)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 30,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 18,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 35,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 22,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 28,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 15,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 12,  secsAgo: 0 },
  ],
  // Wave 6 - 4 predictors, late outcome-0 surge
  [
    { userIdx: 2, outcomeIdx: 1, amount: 150, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 130, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 180, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 50,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 60,  secsAgo: 0 },
  ],
  // Wave 7 - 2 predictors, volatile swing (bob vs dan)
  [
    { userIdx: 1, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 140, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 90,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 70,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 80,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 40,  secsAgo: 0 },
  ],
  // Wave 8 - 3 predictors, high-volume (alice, bob, dan)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 300, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 250, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 60,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 30,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
  ],
  // Wave 9 - 3 predictors, hedged across 3 outcomes (alice, bob, carol; FR-8)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 2, amount: 60,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 140, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 2, amount: 110, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 70,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 80,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 2, amount: 60,  secsAgo: 0 },
  ],
  // Wave 10 - 4 predictors, spread across up to 5 outcomes
  [
    { userIdx: 0, outcomeIdx: 3, amount: 100, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 4, amount: 90,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 2, amount: 85,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 75,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 60,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 55,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 3, amount: 45,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 4, amount: 40,  secsAgo: 0 },
  ],
  // Wave 11 - 4 predictors, 4-outcome market; outcome-2 is the crowd favourite
  [
    { userIdx: 0, outcomeIdx: 2, amount: 160, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 2, amount: 140, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 55,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 3, amount: 30,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 2, amount: 80,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 2, amount: 70,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 35,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 3, amount: 20,  secsAgo: 0 },
  ],
  // Wave 12 - 3 predictors, 3-outcome market with contrarian minority on outcome-2
  [
    { userIdx: 0, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 175, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 60,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 2, amount: 45,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 90,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 2, amount: 30,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 70,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
  ],
  // Wave 13 - 4 predictors, 5-outcome market; all outcomes get real money, no clear leader
  [
    { userIdx: 0, outcomeIdx: 1, amount: 130, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 3, amount: 115, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 2, amount: 90,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 4, amount: 75,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 60,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 3, amount: 50,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 2, amount: 20,  secsAgo: 0 },
  ],
  // Wave 14 - 2 predictors whale duel on a 4-outcome market; outcome-0 vs outcome-3
  [
    { userIdx: 0, outcomeIdx: 0, amount: 300, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 3, amount: 280, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 45,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 2, amount: 35,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 3, amount: 90,  secsAgo: 0 },
  ],
  // Wave 15 - late-breaking consensus flip: starts on outcome-1, swings to outcome-0
  [
    { userIdx: 2, outcomeIdx: 1, amount: 180, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 150, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 2, amount: 40,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 250, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 2, amount: 30,  secsAgo: 0 },
  ],
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Every wave must respect the FR-9 aggregate cap before we send anything.
  for (let i = 0; i < BET_WAVES.length; i++) {
    const violations = capViolations(BET_WAVES[i]);
    if (violations.length > 0) {
      throw new Error(
        `Wave ${i + 1} breaches the aggregate cap: ${JSON.stringify(violations)}`,
      );
    }
  }

  // ── 1. Ensure seed auth users exist ──────────────────────────────────────

  console.log("Ensuring seed auth users exist...");

  const resolvedUserIds: string[] = [];

  for (const seedUser of SEED_USERS) {
    const existing = await pgGet<{ id: string }[]>(
      "/profiles",
      { select: "id", email: `eq.${seedUser.email}`, limit: "1" },
    );

    if (existing.length > 0) {
      console.log(`  ${seedUser.email} - already exists (${existing[0].id.substring(0, 8)}…)`);
      resolvedUserIds.push(existing[0].id);
      continue;
    }

    const res = await fetch(`${AUTH_BASE}/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: seedUser.email,
        password: seedUser.password,
        email_confirm: true,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Auth create ${seedUser.email} → ${res.status}: ${txt}`);
    }

    const data = (await res.json()) as { id: string };
    resolvedUserIds.push(data.id);
    console.log(`  ${seedUser.email} - created (${data.id.substring(0, 8)}…)`);
  }

  // ── 1b. Top up balances so multi-market betting doesn't overdraft. ───────
  // ~all open markets × ~500 HC aggregate cap ≈ 30k+ headroom per seed user.
  const MIN_BALANCE = 50000;
  for (let i = 0; i < SEED_USERS.length; i++) {
    const uid = resolvedUserIds[i];
    const txns = await pgGet<{ amount: number }[]>(
      "/transactions",
      { select: "amount", user_id: `eq.${uid}` },
    );
    const balance = txns.reduce((s, t) => s + t.amount, 0);
    if (balance < MIN_BALANCE) {
      const topup = MIN_BALANCE - balance;
      await pgPost("/transactions", {
        user_id: uid,
        type: "signup_grant",
        amount: topup,
      });
      console.log(`  Topped up ${SEED_USERS[i].email} by ${topup} HC (balance was ${balance})`);
    }
  }

  // ── 1c. Sign each user in; place_bet runs as auth.uid(). ─────────────────
  const jwts: string[] = [];
  for (const u of SEED_USERS) {
    jwts.push(await signIn(u.email, u.password));
  }

  // ── 2. Place bets ─────────────────────────────────────────────────────────

  const allMarkets = await pgGet<
    {
      id: string;
      title: string;
      category: string;
      market_outcomes: { id: string; sort_order: number }[];
    }[]
  >("/markets", {
    // Disambiguate: markets also has markets_winning_outcome_fk → market_outcomes.
    select:
      "id,title,category,market_outcomes!market_outcomes_market_id_fkey(id,sort_order)",
    status: "eq.open",
    order: "created_at.asc",
    limit: "70",
  });

  console.log(`\nFound ${allMarkets.length} open markets total. Mode=${SEED_MODE}`);

  let totalBetsInserted = 0;

  if (SEED_MODE === "boost") {
    // Random top-up: more predictors + bets on every open market, respecting
    // the per-user 500 HC aggregate cap (FR-9).
    const NEW_PREDICTORS_PER_MARKET = { min: 4, max: 8 };
    const BETS_PER_NEW_PREDICTOR = { min: 1, max: 2 };
    const AMOUNT = { min: 20, max: 80 };
    const SPAN_SECS = 4 * DAY;

    for (let mi = 0; mi < allMarkets.length; mi++) {
      const market = allMarkets[mi];
      const outcomes = [...market.market_outcomes].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      if (outcomes.length < 2) continue;

      const existing = await pgGet<{ user_id: string; amount: number }[]>(
        "/bets",
        {
          select: "user_id,amount",
          market_id: `eq.${market.id}`,
        },
      );
      const spent = new Map<string, number>();
      const alreadyOn = new Set<string>();
      for (const b of existing) {
        spent.set(b.user_id, (spent.get(b.user_id) ?? 0) + b.amount);
        alreadyOn.add(b.user_id);
      }

      // Prefer users not yet on this market; fall back to anyone with headroom.
      const freshIdx = resolvedUserIds
        .map((id, idx) => ({ id, idx }))
        .filter(
          ({ id }) =>
            !alreadyOn.has(id) &&
            CAP_PER_MARKET - (spent.get(id) ?? 0) >= AMOUNT.min,
        );
      const roomyIdx = resolvedUserIds
        .map((id, idx) => ({ id, idx }))
        .filter(
          ({ id }) => CAP_PER_MARKET - (spent.get(id) ?? 0) >= AMOUNT.min,
        );
      const pool = shuffle(freshIdx.length >= NEW_PREDICTORS_PER_MARKET.min ? freshIdx : roomyIdx);
      const take = Math.min(
        pool.length,
        randInt(NEW_PREDICTORS_PER_MARKET.min, NEW_PREDICTORS_PER_MARKET.max),
      );
      const chosen = pool.slice(0, take);

      let placedHere = 0;
      const planned: { userIdx: number; outcomeIdx: number; amount: number; secsAgo: number }[] = [];
      for (const { id, idx } of chosen) {
        const betsForUser = randInt(BETS_PER_NEW_PREDICTOR.min, BETS_PER_NEW_PREDICTOR.max);
        for (let b = 0; b < betsForUser; b++) {
          const headroom = CAP_PER_MARKET - (spent.get(id) ?? 0);
          if (headroom < AMOUNT.min) break;
          const amount = Math.min(headroom, randInt(AMOUNT.min, AMOUNT.max));
          planned.push({
            userIdx: idx,
            outcomeIdx: randInt(0, outcomes.length - 1),
            amount,
            secsAgo: 0,
          });
          spent.set(id, (spent.get(id) ?? 0) + amount);
        }
      }

      const wave = staggerWave(planned, SPAN_SECS);
      console.log(
        `[${mi + 1}/${allMarkets.length}] ${market.title.substring(0, 55)} (+${chosen.length} predictors, ${wave.length} bets)`,
      );

      for (const tmpl of wave) {
        const outcome = outcomes[tmpl.outcomeIdx % outcomes.length];
        const placed = await placeBet(
          jwts[tmpl.userIdx],
          market.id,
          outcome.id,
          tmpl.amount,
        );
        await backdateBet(market.id, placed.bet_id, tmpl.secsAgo);
        totalBetsInserted++;
        placedHere++;
      }
      console.log(`  Placed ${placedHere} bets`);
    }
  } else {
    const withCounts = await Promise.all(
      allMarkets.map(async (m) => {
        const count = await countRows("/bets", { market_id: `eq.${m.id}`, select: "id" });
        return { market: m, betCount: count };
      }),
    );

    // Only untouched markets - partial waves must not get a second wave
    // or the FR-9 aggregate cap will fire on re-runs.
    const eligible = withCounts.filter(
      ({ betCount, market }) => betCount === 0 && market.market_outcomes.length >= 2,
    );
    const byCategory = new Map<string, number>();
    const targets = eligible.map(({ market }) => {
      byCategory.set(market.category, (byCategory.get(market.category) ?? 0) + 1);
      return market;
    });
    console.log(
      `Category coverage: ${[...byCategory.entries()]
        .map(([c, n]) => `${c}=${n}`)
        .join(", ")}`,
    );

    if (targets.length === 0) {
      console.log("All markets already have bets - nothing to seed (use SEED_MODE=boost).");
      process.exit(0);
    }

    console.log(`Seeding bets into ${targets.length} markets…\n`);

    for (let mi = 0; mi < targets.length; mi++) {
      const market = targets[mi];
      const waveIdx = mi % BET_WAVES.length;
      const wave = staggerWave(BET_WAVES[waveIdx], WAVE_SPANS_SECS[waveIdx]);
      const outcomes = [...market.market_outcomes].sort(
        (a, b) => a.sort_order - b.sort_order,
      );

      console.log(
        `[${mi + 1}/${targets.length}] ${market.title.substring(0, 60)} (${outcomes.length} outcomes, span ${Math.round(WAVE_SPANS_SECS[waveIdx] / DAY)}d)`,
      );

      for (const tmpl of wave) {
        const outcome = outcomes[tmpl.outcomeIdx % outcomes.length];
        const placed = await placeBet(
          jwts[tmpl.userIdx],
          market.id,
          outcome.id,
          tmpl.amount,
        );
        await backdateBet(market.id, placed.bet_id, tmpl.secsAgo);
        totalBetsInserted++;
      }

      console.log(`  Bets placed: ${wave.length}`);
    }
  }

  // ── 4. Verification ───────────────────────────────────────────────────────

  console.log("\n── Verification ──────────────────────────────────────────────");

  const totalBets = await countRows("/bets", { select: "id" });
  const totalPH = await countRows("/price_history", { select: "id" });
  const totalTxBets = await countRows("/transactions", { select: "id", type: "eq.bet_place" });

  console.log(`Total bets in DB:           ${totalBets}`);
  console.log(`Total price_history rows:   ${totalPH}`);
  console.log(`Total bet_place tx rows:    ${totalTxBets}`);
  console.log(`Bets placed this run:       ${totalBetsInserted}`);

  console.log("\nSeed user balances (HC):");
  for (let i = 0; i < SEED_USERS.length; i++) {
    const uid = resolvedUserIds[i];
    const txns = await pgGet<{ amount: number }[]>(
      "/transactions",
      { select: "amount", user_id: `eq.${uid}` },
    );
    const balance = txns.reduce((s, t) => s + t.amount, 0);
    console.log(`  ${SEED_USERS[i].email.padEnd(38)} ${balance} HC`);
  }

  // REC-1 balances after settlement (vig_burn / seed). Open bets lock HC in
  // pools, so delta equals Σ(open bet_place) until those markets resolve/void.
  // Resolved/voided markets already net out via payouts / vig / refunds.
  const invariant = await pgPost<{ balanced: boolean; delta: number }>(
    "/rpc/verify_ledger_invariant",
    {},
  );
  const openMarkets = await pgGet<{ id: string }[]>("/markets", {
    select: "id",
    status: "eq.open",
  });
  const openIds = new Set(openMarkets.map((m) => m.id));
  const betPlaceRows = await pgGet<{ amount: number; market_id: string | null }[]>(
    "/transactions",
    { select: "amount,market_id", type: "eq.bet_place" },
  );
  const openFloat = betPlaceRows
    .filter((t) => t.market_id && openIds.has(t.market_id))
    .reduce((s, t) => s + t.amount, 0);
  console.log(`\nLedger invariant: balanced=${invariant.balanced} delta=${invariant.delta}`);
  console.log(`Open bet_place float:       ${openFloat}`);
  if (invariant.balanced) {
    // fully settled economy
  } else if (invariant.delta === openFloat) {
    console.log("Open-market float matches REC-1 expectation (delta == Σ open bet_place).");
  } else {
    console.error(
      `Ledger invariant unexpected: delta=${invariant.delta} openFloat=${openFloat}`,
    );
    process.exit(1);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
