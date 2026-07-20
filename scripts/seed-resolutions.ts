#!/usr/bin/env node
// Resolve/void a sample of seeded markets so portfolio + resolved history
// have data for E2E. Temporarily promotes alice.seed to admin.
//
// Usage:
//   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-resolutions.ts

if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

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

async function main() {
  const aliceRes = await fetch(
    `${BASE}/profiles?email=eq.${encodeURIComponent("alice.seed@northeastern.edu")}&select=id`,
    { headers: HEADERS },
  );
  const aliceRows = (await aliceRes.json()) as { id: string }[];
  if (!aliceRows[0]) throw new Error("alice.seed profile not found — run seed-bets first");
  const aliceId = aliceRows[0].id;

  await fetch(`${BASE}/profiles?id=eq.${aliceId}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ role: "admin" }),
  });
  console.log("Promoted alice.seed → admin");

  const signInRes = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice.seed@northeastern.edu",
      password: "HuskyM4rkets!Alice",
    }),
  });
  if (!signInRes.ok) throw new Error(`sign-in failed: ${await signInRes.text()}`);
  const { access_token: jwt } = (await signInRes.json()) as { access_token: string };

  const marketsRes = await fetch(
    `${BASE}/markets?status=eq.open&select=id,title,category,market_outcomes!market_outcomes_market_id_fkey(id,sort_order)&order=created_at.asc&limit=70`,
    { headers: HEADERS },
  );
  const markets = (await marketsRes.json()) as {
    id: string;
    title: string;
    category: string;
    market_outcomes: { id: string; sort_order: number }[];
  }[];

  const withBets: typeof markets = [];
  for (const m of markets) {
    const cr = await fetch(`${BASE}/bets?market_id=eq.${m.id}&select=id`, {
      headers: { ...HEADERS, Prefer: "count=exact" },
    });
    const n = parseInt(cr.headers.get("content-range")?.split("/")[1] ?? "0", 10);
    if (n >= 5) withBets.push(m);
  }

  const picked = new Map<string, (typeof markets)[number]>();
  for (const m of withBets) {
    if (!picked.has(m.category)) picked.set(m.category, m);
  }

  console.log(`Resolving ${picked.size} markets (one per category)…`);
  for (const [cat, m] of picked) {
    const outcomes = [...m.market_outcomes].sort((a, b) => a.sort_order - b.sort_order);
    const res = await fetch(`${BASE}/rpc/resolve_market`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_market_id: m.id,
        p_action: "resolve",
        p_winning_outcome_id: outcomes[0].id,
      }),
    });
    if (!res.ok) throw new Error(`resolve ${cat}: ${res.status} ${await res.text()}`);
    console.log(`  ${cat}: ${m.title.slice(0, 55)}`);
  }

  const remaining = withBets.filter((m) => ![...picked.values()].some((p) => p.id === m.id));
  if (remaining.length) {
    const m = remaining[0];
    const res = await fetch(`${BASE}/rpc/resolve_market`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_market_id: m.id, p_action: "void" }),
    });
    if (!res.ok) throw new Error(`void: ${res.status} ${await res.text()}`);
    console.log(`  voided (${m.category}): ${m.title.slice(0, 55)}`);
  }

  await fetch(`${BASE}/profiles?id=eq.${aliceId}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ role: "user" }),
  });
  console.log("Demoted alice.seed → user");

  const invRes = await fetch(`${BASE}/rpc/verify_ledger_invariant`, {
    method: "POST",
    headers: HEADERS,
    body: "{}",
  });
  console.log("Ledger:", await invRes.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
