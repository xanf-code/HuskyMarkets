#!/usr/bin/env node
// Seed realistic bets across existing open markets.
//
// Strategy:
//   1. Create 4 seed auth users via Supabase Auth Admin API (if they don't
//      already exist). The handle_new_user() trigger auto-creates their
//      public.profiles rows and credits each a 1000 HC signup_grant.
//   2. Pick up to 8 open markets (those with fewer than 10 existing bets).
//   3. For every bet in the wave templates:
//        a. Compute price_at_bet from the current in-memory pools — same clamp
//           formula as place_bet() in 0006_market_engine.sql.
//        b. INSERT into public.bets with a back-dated created_at.
//        c. INSERT a bet_place transaction (negative amount = debit).
//        d. INSERT a price_history snapshot with the updated pools.
//   4. PATCH markets.yes_pool / no_pool to reflect all seeded bets.
//   5. Re-runnable / idempotent: seed users are only created when absent,
//      and only markets with < 10 bets are touched.
//
// Usage from repo root:
//   npx tsx --env-file=.env.local scripts/seed-bets.ts

// Module scope: seed-markets.ts is also an import-less script, so without this
// both files share the global scope and their identical const names collide.
export {};

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
const AUTH_HEADERS: Record<string, string> = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
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

/** Implied YES probability clamped 1–99 — mirrors 0006_market_engine.sql. */
function impliedYes(yesPool: number, noPool: number): number {
  return Math.min(Math.max(Math.round((100 * yesPool) / (yesPool + noPool)), 1), 99);
}

/** ISO timestamp N seconds before now. */
function secsAgoIso(s: number): string {
  return new Date(Date.now() - s * 1000).toISOString();
}

// ── Seed user definitions ─────────────────────────────────────────────────────

// Emails are @northeastern.edu so the handle_new_user() trigger accepts them.
// The Auth Admin API creates the auth.users row; the trigger then creates the
// public.profiles row and inserts a 1000 HC signup_grant automatically.
const SEED_USERS = [
  { email: "alice.seed@northeastern.edu", password: "HuskyM4rkets!Alice" },
  { email: "bob.seed@northeastern.edu",   password: "HuskyM4rkets!Bob" },
  { email: "carol.seed@northeastern.edu", password: "HuskyM4rkets!Carol" },
  { email: "dan.seed@northeastern.edu",   password: "HuskyM4rkets!Dan" },
];

// ── Bet wave templates ────────────────────────────────────────────────────────

type BetTemplate = {
  userIdx: number;   // index into resolved SEED_USERS profile ids
  side: "yes" | "no";
  amount: number;
  secsAgo: number;   // how far in the past to back-date the bet
};

// 8 wave patterns, one applied to each target market.
const BET_WAVES: BetTemplate[][] = [
  // Wave 1 — YES-heavy (strong bullish consensus)
  [
    { userIdx: 0, side: "yes", amount: 80,  secsAgo: 86400 * 6 },
    { userIdx: 1, side: "yes", amount: 120, secsAgo: 86400 * 5 },
    { userIdx: 2, side: "no",  amount: 30,  secsAgo: 86400 * 4 },
    { userIdx: 3, side: "yes", amount: 200, secsAgo: 86400 * 3 },
    { userIdx: 0, side: "yes", amount: 50,  secsAgo: 86400 * 2 + 3600 },
    { userIdx: 1, side: "no",  amount: 60,  secsAgo: 86400 * 2 },
    { userIdx: 2, side: "yes", amount: 90,  secsAgo: 86400 },
    { userIdx: 3, side: "no",  amount: 40,  secsAgo: 3600 * 12 },
    { userIdx: 0, side: "yes", amount: 30,  secsAgo: 3600 * 6 },
    { userIdx: 1, side: "no",  amount: 20,  secsAgo: 3600 * 2 },
  ],
  // Wave 2 — contested 50/50
  [
    { userIdx: 2, side: "yes", amount: 50,  secsAgo: 86400 * 5 },
    { userIdx: 3, side: "no",  amount: 60,  secsAgo: 86400 * 4 + 7200 },
    { userIdx: 0, side: "yes", amount: 70,  secsAgo: 86400 * 4 },
    { userIdx: 1, side: "no",  amount: 80,  secsAgo: 86400 * 3 },
    { userIdx: 2, side: "yes", amount: 40,  secsAgo: 86400 * 2 },
    { userIdx: 3, side: "no",  amount: 35,  secsAgo: 86400 },
    { userIdx: 0, side: "yes", amount: 55,  secsAgo: 3600 * 18 },
    { userIdx: 1, side: "no",  amount: 45,  secsAgo: 3600 * 10 },
    { userIdx: 2, side: "yes", amount: 25,  secsAgo: 3600 * 4 },
    { userIdx: 3, side: "no",  amount: 30,  secsAgo: 3600 },
  ],
  // Wave 3 — NO-heavy (majority betting it resolves NO)
  [
    { userIdx: 1, side: "no",  amount: 150, secsAgo: 86400 * 7 },
    { userIdx: 0, side: "yes", amount: 40,  secsAgo: 86400 * 6 },
    { userIdx: 2, side: "no",  amount: 200, secsAgo: 86400 * 5 },
    { userIdx: 3, side: "yes", amount: 25,  secsAgo: 86400 * 4 },
    { userIdx: 1, side: "no",  amount: 100, secsAgo: 86400 * 3 },
    { userIdx: 0, side: "no",  amount: 80,  secsAgo: 86400 * 2 },
    { userIdx: 2, side: "yes", amount: 30,  secsAgo: 86400 },
    { userIdx: 3, side: "no",  amount: 50,  secsAgo: 3600 * 14 },
    { userIdx: 0, side: "yes", amount: 20,  secsAgo: 3600 * 7 },
    { userIdx: 1, side: "no",  amount: 45,  secsAgo: 3600 * 2 },
  ],
  // Wave 4 — volatile (probability swings back and forth)
  [
    { userIdx: 3, side: "yes", amount: 100, secsAgo: 86400 * 6 },
    { userIdx: 0, side: "no",  amount: 120, secsAgo: 86400 * 5 + 3600 },
    { userIdx: 1, side: "yes", amount: 90,  secsAgo: 86400 * 5 },
    { userIdx: 2, side: "no",  amount: 110, secsAgo: 86400 * 4 },
    { userIdx: 3, side: "yes", amount: 70,  secsAgo: 86400 * 3 },
    { userIdx: 0, side: "no",  amount: 85,  secsAgo: 86400 * 2 },
    { userIdx: 1, side: "yes", amount: 60,  secsAgo: 86400 },
    { userIdx: 2, side: "no",  amount: 95,  secsAgo: 3600 * 16 },
    { userIdx: 3, side: "yes", amount: 50,  secsAgo: 3600 * 8 },
    { userIdx: 0, side: "no",  amount: 40,  secsAgo: 3600 * 3 },
  ],
  // Wave 5 — small stakes, casual bettors
  [
    { userIdx: 0, side: "yes", amount: 15,  secsAgo: 86400 * 4 },
    { userIdx: 1, side: "yes", amount: 20,  secsAgo: 86400 * 3 + 7200 },
    { userIdx: 2, side: "no",  amount: 10,  secsAgo: 86400 * 3 },
    { userIdx: 3, side: "yes", amount: 25,  secsAgo: 86400 * 2 + 3600 },
    { userIdx: 0, side: "no",  amount: 12,  secsAgo: 86400 * 2 },
    { userIdx: 1, side: "yes", amount: 18,  secsAgo: 86400 },
    { userIdx: 2, side: "no",  amount: 22,  secsAgo: 3600 * 20 },
    { userIdx: 3, side: "yes", amount: 30,  secsAgo: 3600 * 12 },
    { userIdx: 0, side: "yes", amount: 10,  secsAgo: 3600 * 5 },
    { userIdx: 1, side: "no",  amount: 15,  secsAgo: 3600 * 1 },
  ],
  // Wave 6 — late YES surge (NO early, YES takes over)
  [
    { userIdx: 2, side: "no",  amount: 150, secsAgo: 86400 * 5 },
    { userIdx: 3, side: "no",  amount: 130, secsAgo: 86400 * 4 },
    { userIdx: 0, side: "yes", amount: 200, secsAgo: 86400 * 3 },
    { userIdx: 1, side: "yes", amount: 180, secsAgo: 86400 * 2 },
    { userIdx: 2, side: "yes", amount: 120, secsAgo: 86400 },
    { userIdx: 3, side: "yes", amount: 100, secsAgo: 3600 * 18 },
    { userIdx: 0, side: "no",  amount: 50,  secsAgo: 3600 * 10 },
    { userIdx: 1, side: "yes", amount: 80,  secsAgo: 3600 * 5 },
    { userIdx: 2, side: "no",  amount: 40,  secsAgo: 3600 * 2 },
    { userIdx: 3, side: "yes", amount: 60,  secsAgo: 1800 },
  ],
  // Wave 7 — moderate volume, mixed sentiment
  [
    { userIdx: 1, side: "yes", amount: 45,  secsAgo: 86400 * 3 },
    { userIdx: 2, side: "no",  amount: 55,  secsAgo: 86400 * 2 + 7200 },
    { userIdx: 3, side: "yes", amount: 35,  secsAgo: 86400 * 2 },
    { userIdx: 0, side: "no",  amount: 65,  secsAgo: 86400 },
    { userIdx: 1, side: "yes", amount: 40,  secsAgo: 3600 * 22 },
    { userIdx: 2, side: "no",  amount: 30,  secsAgo: 3600 * 15 },
    { userIdx: 3, side: "yes", amount: 50,  secsAgo: 3600 * 9 },
    { userIdx: 0, side: "yes", amount: 25,  secsAgo: 3600 * 5 },
    { userIdx: 1, side: "no",  amount: 20,  secsAgo: 3600 * 2 },
    { userIdx: 2, side: "yes", amount: 15,  secsAgo: 900 },
  ],
  // Wave 8 — high-volume, big stakes (sports/weather feel)
  [
    { userIdx: 0, side: "yes", amount: 300, secsAgo: 86400 * 4 },
    { userIdx: 1, side: "no",  amount: 250, secsAgo: 86400 * 3 },
    { userIdx: 2, side: "yes", amount: 200, secsAgo: 86400 * 2 },
    { userIdx: 3, side: "no",  amount: 150, secsAgo: 86400 },
    { userIdx: 0, side: "yes", amount: 100, secsAgo: 3600 * 20 },
    { userIdx: 1, side: "yes", amount: 80,  secsAgo: 3600 * 14 },
    { userIdx: 2, side: "no",  amount: 60,  secsAgo: 3600 * 8 },
    { userIdx: 3, side: "yes", amount: 40,  secsAgo: 3600 * 4 },
    { userIdx: 0, side: "no",  amount: 30,  secsAgo: 3600 * 1 },
    { userIdx: 1, side: "no",  amount: 20,  secsAgo: 600 },
  ],
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Ensure seed auth users exist ──────────────────────────────────────
  // Use Auth Admin API; handle_new_user() trigger auto-creates profiles + grants.

  console.log("Ensuring seed auth users exist...");

  const resolvedUserIds: string[] = [];

  for (const seedUser of SEED_USERS) {
    // Check if profile already exists (profile created by trigger on user creation).
    const existing = await pgGet<{ id: string }[]>(
      "/profiles",
      { select: "id", email: `eq.${seedUser.email}`, limit: "1" },
    );

    if (existing.length > 0) {
      console.log(`  ${seedUser.email} — already exists (${existing[0].id.substring(0, 8)}…)`);
      resolvedUserIds.push(existing[0].id);
      continue;
    }

    // Create via Auth Admin API — trigger handles profile + grant.
    const res = await fetch(`${AUTH_BASE}/admin/users`, {
      method: "POST",
      headers: AUTH_HEADERS,
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

  // ── 1b. Ensure each seed user has at least 2000 HC so multi-market betting
  //         doesn't overdraft them. We compute a top-up and add a signup_grant
  //         if their balance is below the threshold.
  const MIN_BALANCE = 2000;
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

  // ── 2. Find open markets with fewer than 10 bets ──────────────────────────

  const allMarkets = await pgGet<
    { id: string; title: string; status: string; yes_pool: number; no_pool: number }[]
  >("/markets", {
    select: "id,title,status,yes_pool,no_pool",
    status: "eq.open",
    order: "created_at.asc",
    limit: "70",
  });

  console.log(`\nFound ${allMarkets.length} open markets total.`);

  // Check bet counts in parallel to keep things fast.
  const withCounts = await Promise.all(
    allMarkets.map(async (m) => {
      const count = await countRows("/bets", { market_id: `eq.${m.id}`, select: "id" });
      return { market: m, betCount: count };
    }),
  );

  const targets = withCounts
    .filter(({ betCount }) => betCount < 10)
    .map(({ market }) => market)
    .slice(0, 8);

  if (targets.length === 0) {
    console.log("All markets already have 10+ bets — nothing to seed.");
    process.exit(0);
  }

  console.log(`Seeding bets into ${targets.length} markets…\n`);

  // ── 3. Insert bets, transactions, price_history ───────────────────────────

  let totalBetsInserted = 0;

  for (let mi = 0; mi < targets.length; mi++) {
    const market = targets[mi];
    const wave = BET_WAVES[mi % BET_WAVES.length];

    // Track pool sizes in memory to compute prices and snapshots correctly.
    let yesPool = market.yes_pool;
    let noPool = market.no_pool;

    console.log(`[${mi + 1}/${targets.length}] ${market.title.substring(0, 70)}`);
    console.log(`  Initial pools: YES=${yesPool}  NO=${noPool}  (implied YES=${impliedYes(yesPool, noPool)}%)`);

    for (const tmpl of wave) {
      const userId = resolvedUserIds[tmpl.userIdx];
      const priceAtBet = impliedYes(yesPool, noPool); // price BEFORE this bet
      const createdAt = secsAgoIso(tmpl.secsAgo);

      // Insert bet row.
      const [betRow] = await pgPost<{ id: string }[]>("/bets?select=id", {
        market_id: market.id,
        user_id: userId,
        side: tmpl.side,
        amount: tmpl.amount,
        price_at_bet: priceAtBet,
        created_at: createdAt,
      });

      // Insert matching ledger debit.
      await pgPost("/transactions", {
        user_id: userId,
        type: "bet_place",
        amount: -tmpl.amount,
        market_id: market.id,
        bet_id: betRow.id,
        created_at: createdAt,
      });

      // Advance pools.
      if (tmpl.side === "yes") {
        yesPool += tmpl.amount;
      } else {
        noPool += tmpl.amount;
      }

      // Price history snapshot with post-bet pools.
      await pgPost("/price_history", {
        market_id: market.id,
        implied_yes: impliedYes(yesPool, noPool),
        yes_pool: yesPool,
        no_pool: noPool,
        recorded_at: createdAt,
      });

      totalBetsInserted++;
    }

    // Persist the final pool totals back to the market row.
    await pgPatch("/markets", { id: `eq.${market.id}` }, {
      yes_pool: yesPool,
      no_pool: noPool,
    });

    console.log(`  Final   pools: YES=${yesPool}  NO=${noPool}  (implied YES=${impliedYes(yesPool, noPool)}%)`);
    console.log(`  Bets inserted: ${wave.length}`);
  }

  // ── 4. Verification queries ───────────────────────────────────────────────

  console.log("\n── Verification ──────────────────────────────────────────────");

  const totalBets   = await countRows("/bets", { select: "id" });
  const totalPH     = await countRows("/price_history", { select: "id" });
  const totalTxBets = await countRows("/transactions", { select: "id", type: "eq.bet_place" });

  console.log(`Total bets in DB:           ${totalBets}`);
  console.log(`Total price_history rows:   ${totalPH}`);
  console.log(`Total bet_place tx rows:    ${totalTxBets}`);
  console.log(`Bets inserted this run:     ${totalBetsInserted}`);

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

  console.log("\nSeeded markets (final pools):");
  for (const m of targets) {
    const updated = await pgGet<{ yes_pool: number; no_pool: number }[]>(
      "/markets",
      { select: "yes_pool,no_pool", id: `eq.${m.id}` },
    );
    const { yes_pool, no_pool } = updated[0];
    console.log(
      `  ${m.title.substring(0, 55).padEnd(55)} YES=${yes_pool}  NO=${no_pool}  p=${impliedYes(yes_pool, no_pool)}%`,
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
