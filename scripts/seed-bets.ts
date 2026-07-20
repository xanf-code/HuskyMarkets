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
//      place_bet engine RPC — bets reference outcome_id, the FR-9 aggregate
//      cap is engine-enforced, and price_history snapshots are written by the
//      engine (FR-12). Waves are pre-validated against the cap with the same
//      helper the unit tests cover.
//   4. Assert verify_ledger_invariant() is balanced at the end.
//
// Re-runnable / idempotent: seed users are only created when absent, and only
// markets with < 10 bets are touched.
//
// Usage from repo root:
//   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-bets.ts

// Non-prod guard (S6-1): refuse to run unless explicitly marked as a dev seed.
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

import { capViolations, type SeedBet } from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
): Promise<{ new_balance: number }> {
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
  return (await res.json()) as { new_balance: number };
}

// ── Seed user definitions ─────────────────────────────────────────────────────

// Emails are @northeastern.edu so the handle_new_user() trigger accepts them.
const SEED_USERS = [
  { email: "alice.seed@northeastern.edu", password: "HuskyM4rkets!Alice" },
  { email: "bob.seed@northeastern.edu",   password: "HuskyM4rkets!Bob" },
  { email: "carol.seed@northeastern.edu", password: "HuskyM4rkets!Carol" },
  { email: "dan.seed@northeastern.edu",   password: "HuskyM4rkets!Dan" },
];

// ── Bet wave templates ────────────────────────────────────────────────────────
// outcomeIdx is taken modulo the market's outcome count, so the same waves
// cover 2–6-outcome markets. Per-user aggregates stay within the 500 HC cap
// (asserted by capViolations before anything is sent).

const BET_WAVES: SeedBet[][] = [
  // Wave 1 — outcome-0 heavy (strong consensus)
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
  // Wave 2 — contested 50/50
  [
    { userIdx: 2, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 60,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 70,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 80,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 40,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 35,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 55,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 45,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 30,  secsAgo: 0 },
  ],
  // Wave 3 — outcome-1 heavy
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
  // Wave 4 — volatile (money swings between outcomes)
  [
    { userIdx: 3, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 120, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 90,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 110, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 70,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 85,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 60,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 95,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 40,  secsAgo: 0 },
  ],
  // Wave 5 — small stakes, casual bettors
  [
    { userIdx: 0, outcomeIdx: 0, amount: 15,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 20,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 10,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 12,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 18,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 22,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 30,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 10,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 15,  secsAgo: 0 },
  ],
  // Wave 6 — late outcome-0 surge
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
  // Wave 7 — moderate volume, mixed sentiment
  [
    { userIdx: 1, outcomeIdx: 0, amount: 45,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 55,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 35,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 65,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 40,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 30,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 25,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 15,  secsAgo: 0 },
  ],
  // Wave 8 — high-volume, big stakes
  [
    { userIdx: 0, outcomeIdx: 0, amount: 300, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 250, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 0, amount: 200, secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 150, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 0, amount: 100, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 80,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 60,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 40,  secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 1, amount: 30,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 20,  secsAgo: 0 },
  ],
  // Wave 9 — hedged across 3 outcomes (exercises 3+-outcome markets, FR-8)
  [
    { userIdx: 0, outcomeIdx: 0, amount: 120, secsAgo: 0 },
    { userIdx: 0, outcomeIdx: 2, amount: 60,  secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 1, amount: 140, secsAgo: 0 },
    { userIdx: 1, outcomeIdx: 0, amount: 50,  secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 2, amount: 110, secsAgo: 0 },
    { userIdx: 2, outcomeIdx: 1, amount: 70,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 0, amount: 90,  secsAgo: 0 },
    { userIdx: 3, outcomeIdx: 1, amount: 80,  secsAgo: 0 },
  ],
  // Wave 10 — spread across up to 5 outcomes
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
      console.log(`  ${seedUser.email} — already exists (${existing[0].id.substring(0, 8)}…)`);
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
    console.log(`  ${seedUser.email} — created (${data.id.substring(0, 8)}…)`);
  }

  // ── 1b. Top up balances so multi-market betting doesn't overdraft. ───────
  // ~3 markets/category × 7 categories × ~500 HC aggregate cap ≈ 10k+ headroom.
  const MIN_BALANCE = 20000;
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

  // ── 2. Find open markets with fewer than 10 bets ──────────────────────────

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

  console.log(`\nFound ${allMarkets.length} open markets total.`);

  const withCounts = await Promise.all(
    allMarkets.map(async (m) => {
      const count = await countRows("/bets", { market_id: `eq.${m.id}`, select: "id" });
      return { market: m, betCount: count };
    }),
  );

  // Spread bets across every category (up to 3 under-seeded markets each).
  const PER_CATEGORY = 3;
  const eligible = withCounts.filter(
    ({ betCount, market }) => betCount < 10 && market.market_outcomes.length >= 2,
  );
  const byCategory = new Map<string, (typeof eligible)[number]["market"][]>();
  for (const { market } of eligible) {
    const list = byCategory.get(market.category) ?? [];
    if (list.length < PER_CATEGORY) {
      list.push(market);
      byCategory.set(market.category, list);
    }
  }
  const targets = [...byCategory.values()].flat();
  console.log(
    `Category coverage: ${[...byCategory.entries()]
      .map(([c, ms]) => `${c}=${ms.length}`)
      .join(", ")}`,
  );

  if (targets.length === 0) {
    console.log("All markets already have 10+ bets — nothing to seed.");
    process.exit(0);
  }

  console.log(`Seeding bets into ${targets.length} markets…\n`);

  // ── 3. Place bets through the engine RPC ─────────────────────────────────

  let totalBetsInserted = 0;

  for (let mi = 0; mi < targets.length; mi++) {
    const market = targets[mi];
    const wave = BET_WAVES[mi % BET_WAVES.length];
    const outcomes = [...market.market_outcomes].sort(
      (a, b) => a.sort_order - b.sort_order,
    );

    console.log(
      `[${mi + 1}/${targets.length}] ${market.title.substring(0, 60)} (${outcomes.length} outcomes)`,
    );

    for (const tmpl of wave) {
      const outcome = outcomes[tmpl.outcomeIdx % outcomes.length];
      await placeBet(jwts[tmpl.userIdx], market.id, outcome.id, tmpl.amount);
      totalBetsInserted++;
    }

    console.log(`  Bets placed: ${wave.length}`);
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
  // pools, so delta equals Σ(bet_place) until those markets resolve/void.
  const invariant = await pgPost<{ balanced: boolean; delta: number }>(
    "/rpc/verify_ledger_invariant",
    {},
  );
  const betPlaceRows = await pgGet<{ amount: number }[]>("/transactions", {
    select: "amount",
    type: "eq.bet_place",
  });
  const openFloat = betPlaceRows.reduce((s, t) => s + t.amount, 0);
  console.log(`\nLedger invariant: balanced=${invariant.balanced} delta=${invariant.delta}`);
  console.log(`Open bet_place float:       ${openFloat}`);
  if (invariant.balanced) {
    // fully settled economy
  } else if (invariant.delta === openFloat) {
    console.log("Open-market float matches REC-1 expectation (delta == Σ bet_place).");
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
