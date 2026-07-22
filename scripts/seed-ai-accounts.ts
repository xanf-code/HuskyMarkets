#!/usr/bin/env node
// One-time idempotent provisioning of AI accounts:
//   • 1 AI market creator (AI_CREATOR_EMAIL / AI_CREATOR_PASSWORD)
//   • N bot traders   (AI_BOT_EMAIL_PREFIX + index + AI_BOT_EMAIL_DOMAIN,
//                       all sharing AI_BOT_PASSWORD)
//
// After creating each bot the script tops up their balance to
// AI_BOT_INITIAL_GRANT HC (default 5000) so they can seed volume.
// Re-running is safe — existing users are left untouched and top-ups
// are skipped if the user is already at or above the target grant.
//
// Usage:
//   ALLOW_AI_SEED=1 npx tsx --env-file=.env.local scripts/seed-ai-accounts.ts
export {};

if (!process.env.ALLOW_AI_SEED) {
  console.error("Set ALLOW_AI_SEED=1 to run this script.");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BOT_COUNT = parseInt(process.env.AI_BOT_COUNT ?? "10", 10);
const BOT_EMAIL_PREFIX = process.env.AI_BOT_EMAIL_PREFIX ?? "husky.bot.";
const BOT_EMAIL_DOMAIN = process.env.AI_BOT_EMAIL_DOMAIN ?? "@northeastern.edu";
const BOT_PASSWORD = process.env.AI_BOT_PASSWORD ?? "";
const BOT_INITIAL_GRANT = parseInt(process.env.AI_BOT_INITIAL_GRANT ?? "5000", 10);

if (!BOT_PASSWORD) {
  console.error("AI_BOT_PASSWORD is not set");
  process.exit(1);
}

if (!process.env.AI_CREATOR_EMAIL || !process.env.AI_CREATOR_PASSWORD) {
  console.error("AI_CREATOR_EMAIL or AI_CREATOR_PASSWORD is not set");
  process.exit(1);
}

const HEADERS: Record<string, string> = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function createAuthUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/admin/users`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await res.json() as { id?: string; msg?: string; error?: string };

  if (!res.ok) {
    const msg = (body.msg ?? body.error ?? "unknown").toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      // Resolve existing user's id from profiles table.
      const profileRes = await fetch(
        `${REST_BASE}/profiles?email=eq.${encodeURIComponent(email)}&select=id`,
        { headers: HEADERS },
      );
      const rows = await profileRes.json() as { id: string }[];
      if (rows[0]?.id) return rows[0].id;
      throw new Error(`User ${email} already exists but profile not found`);
    }
    throw new Error(`Failed to create ${email}: ${body.msg ?? body.error}`);
  }
  return body.id!;
}

async function patchProfile(
  userId: string,
  realName: string,
  displayMode: "real" | "anon",
): Promise<void> {
  const res = await fetch(`${REST_BASE}/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({ real_name: realName, display_mode: displayMode }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  Warning: could not patch profile for ${userId}: ${text}`);
  }
}

// ── Balance helpers ───────────────────────────────────────────────────────────

async function getBalance(userId: string): Promise<number> {
  const res = await fetch(
    `${REST_BASE}/transactions?user_id=eq.${userId}&select=amount`,
    { headers: HEADERS },
  );
  const rows = await res.json() as { amount: number }[];
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0);
}

async function topUpToGrant(userId: string, targetGrant: number): Promise<void> {
  const current = await getBalance(userId);
  const topUp = targetGrant - current;
  if (topUp <= 0) {
    console.log(`  Balance already ${current} HC — no top-up needed`);
    return;
  }

  const res = await fetch(`${REST_BASE}/transactions`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      type: "signup_grant",
      amount: topUp,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  Warning: top-up failed for ${userId}: ${text}`);
  } else {
    console.log(`  Topped up ${topUp} HC → total ${targetGrant} HC`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. AI market creator account.
  console.log("\n── AI Market Creator ──");
  console.log(`  Email: ${process.env.AI_CREATOR_EMAIL}`);
  const creatorId = await createAuthUser(
    process.env.AI_CREATOR_EMAIL!,
    process.env.AI_CREATOR_PASSWORD!,
  );
  console.log(`  User ID: ${creatorId}`);
  await patchProfile(creatorId, "HuskyAI Markets", "real");
  console.log("  Profile: HuskyAI Markets (real mode)");

  // 2. Bot trader accounts.
  console.log(`\n── Bot Traders (${BOT_COUNT} bots, target ${BOT_INITIAL_GRANT} HC each) ──`);
  for (let i = 1; i <= BOT_COUNT; i++) {
    const email = `${BOT_EMAIL_PREFIX}${i}${BOT_EMAIL_DOMAIN}`;
    const realName = `Husky Bot ${i}`;
    console.log(`\n  Bot ${i}: ${email}`);

    const userId = await createAuthUser(email, BOT_PASSWORD);
    console.log(`  User ID: ${userId}`);
    await patchProfile(userId, realName, "real");
    await topUpToGrant(userId, BOT_INITIAL_GRANT);
  }

  console.log("\n✓ All AI accounts provisioned.");
  console.log(`\nSummary:`);
  console.log(`  Creator:  ${process.env.AI_CREATOR_EMAIL}`);
  console.log(`  Bots:     ${BOT_EMAIL_PREFIX}1–${BOT_COUNT}${BOT_EMAIL_DOMAIN}`);
  console.log(`  Password: (shared AI_BOT_PASSWORD)`);
  console.log(`  Balance:  ${BOT_INITIAL_GRANT} HC each`);
  console.log(`\nNew env vars needed:`);
  console.log(`  AI_BOT_EMAIL_PREFIX=${BOT_EMAIL_PREFIX}`);
  console.log(`  AI_BOT_EMAIL_DOMAIN=${BOT_EMAIL_DOMAIN}`);
  console.log(`  AI_BOT_PASSWORD=<your_password>`);
  console.log(`  AI_BOT_COUNT=${BOT_COUNT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
