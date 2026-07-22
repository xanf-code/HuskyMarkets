// 0018 · Notifications — exhaustive test suite
// Covers: notification shape on resolve/void, winner/loser/creator/refund paths,
// creator-is-bettor deduplication, handle_report void path, double-resolve guard,
// RLS policy existence, and column-grant discipline.
//
// pglite runs as superuser → RLS is NOT enforced at runtime. All RLS coverage
// is done via pg_policies / information_schema queries (tests 11–12).

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, createAdmin, setUid } from "./harness";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Outcome {
  id: string;
  label: string;
  sort_order: number;
  pool: number;
  implied: number;
}

interface CreateResult {
  market_id: string;
  outcomes: Outcome[];
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  market_id: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  email_status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createMarket(
  db: PGlite,
  uid: string,
  outcomes: string[] = ["Yes", "No"],
): Promise<CreateResult> {
  await setUid(db, uid);
  const r = await db.query<{ m: CreateResult }>(
    `select public.create_market(
       $1, $2, $3::public.market_category, $4,
       $5::timestamptz, $6::timestamptz, $7::jsonb, $8) as m`,
    [
      "Will something happen on campus?",
      null,
      "campus",
      "Resolves when the thing is officially confirmed.",
      future(1),
      future(2),
      JSON.stringify(outcomes),
      false,
    ],
  );
  return r.rows[0].m;
}

/** Insert a bet directly, bypassing the RPC guard (so the creator can also bet). */
async function insertBetDirect(
  db: PGlite,
  marketId: string,
  userId: string,
  outcomeId: string,
  amount: number,
): Promise<void> {
  // price_at_bet is arbitrary (50) — only the amount matters for payout math.
  await db.query(
    `INSERT INTO public.bets (market_id, user_id, outcome_id, amount, price_at_bet)
     VALUES ($1, $2, $3, $4, 50)`,
    [marketId, userId, outcomeId, amount],
  );
  // Record the debit so get_balance() stays consistent.
  await db.query(
    `INSERT INTO public.transactions (user_id, type, amount, market_id)
     VALUES ($1, 'bet_place', $2, $3)`,
    [userId, -amount, marketId],
  );
}

async function resolveMarket(
  db: PGlite,
  uid: string,
  marketId: string,
  action: "resolve" | "void",
  winningOutcomeId?: string,
): Promise<void> {
  await setUid(db, uid);
  await db.query(
    "select public.resolve_market($1, $2, $3)",
    [marketId, action, winningOutcomeId ?? null],
  );
}

async function notificationsFor(
  db: PGlite,
  userId: string,
  marketId: string,
): Promise<Notification[]> {
  const r = await db.query<Notification>(
    `SELECT id, user_id, type, market_id, payload, read_at, email_status
       FROM public.notifications
      WHERE user_id = $1 AND market_id = $2
      ORDER BY created_at`,
    [userId, marketId],
  );
  return r.rows;
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("0018 notifications: resolve → winner path", () => {
  let db: PGlite;
  let admin: string;
  let creator: string;
  let winner1: string;
  let winner2: string;
  let loser: string;
  let marketId: string;
  let outcomeA: string; // winning
  let outcomeB: string; // losing

  beforeEach(async () => {
    db = await bootTestDb(18);
    admin = await createAdmin(db);
    creator = await createUser(db);
    winner1 = await createUser(db);
    winner2 = await createUser(db);
    loser = await createUser(db);

    // Market is created by `creator` (not admin) so creator_id = creator.
    const m = await createMarket(db, creator, ["Alpha", "Beta"]);
    marketId = m.market_id;
    outcomeA = m.outcomes[0].id; // Alpha (winning)
    outcomeB = m.outcomes[1].id; // Beta  (losing)

    // Two winners on outcome A, one loser on outcome B.
    await insertBetDirect(db, marketId, winner1, outcomeA, 100);
    await insertBetDirect(db, marketId, winner2, outcomeA, 50);
    await insertBetDirect(db, marketId, loser, outcomeB, 80);

    await resolveMarket(db, admin, marketId, "resolve", outcomeA);
  });

  it("test 1: winners receive market_resolved with result=won and matching payout amount", async () => {
    for (const uid of [winner1, winner2]) {
      const notes = await notificationsFor(db, uid, marketId);
      expect(notes).toHaveLength(1);
      const n = notes[0];
      expect(n.type).toBe("market_resolved");
      expect(n.payload.result).toBe("won");

      // Cross-reference against the bet_payout transaction.
      const tx = await db.query<{ amount: number }>(
        `SELECT amount FROM public.transactions
          WHERE user_id = $1 AND market_id = $2 AND type = 'bet_payout'`,
        [uid, marketId],
      );
      expect(tx.rows).toHaveLength(1);
      expect(n.payload.amount).toBe(tx.rows[0].amount);
    }
  });

  it("test 2: loser receives market_resolved with result=lost and amount matching total stake", async () => {
    const notes = await notificationsFor(db, loser, marketId);
    expect(notes).toHaveLength(1);
    const n = notes[0];
    expect(n.type).toBe("market_resolved");
    expect(n.payload.result).toBe("lost");

    const totalBet = await db.query<{ total: number }>(
      `SELECT coalesce(sum(amount), 0)::int AS total
         FROM public.bets
        WHERE user_id = $1 AND market_id = $2`,
      [loser, marketId],
    );
    expect(n.payload.amount).toBe(totalBet.rows[0].total);
  });

  it("test 3: creator (non-bettor) receives market_resolved with role=creator and no result field", async () => {
    const notes = await notificationsFor(db, creator, marketId);
    expect(notes).toHaveLength(1);
    const n = notes[0];
    expect(n.type).toBe("market_resolved");
    expect(n.payload.role).toBe("creator");
    expect(n.payload.result).toBeUndefined();
  });
});

describe("0018 notifications: creator-is-bettor deduplication", () => {
  let db: PGlite;
  let admin: string;
  let creator: string;
  let marketId: string;
  let outcomeA: string;
  let outcomeB: string;

  beforeEach(async () => {
    db = await bootTestDb(18);
    admin = await createAdmin(db);
    creator = await createUser(db);

    const m = await createMarket(db, creator, ["Win", "Lose"]);
    marketId = m.market_id;
    outcomeA = m.outcomes[0].id; // Win — winning outcome
    outcomeB = m.outcomes[1].id;

    // Creator bets on the winning outcome directly (bypasses the RPC guard).
    await insertBetDirect(db, marketId, creator, outcomeA, 100);

    // A second bettor on the other outcome so the market is non-trivial.
    const other = await createUser(db);
    await insertBetDirect(db, marketId, other, outcomeB, 50);

    // Admin resolves to outcome A (creator's bet wins).
    await resolveMarket(db, admin, marketId, "resolve", outcomeA);
  });

  it("test 4: creator-who-is-winner gets exactly ONE notification (won), no creator row", async () => {
    const notes = await notificationsFor(db, creator, marketId);
    expect(notes).toHaveLength(1);
    expect(notes[0].payload.result).toBe("won");
    // Must not have a duplicate creator-role notification.
    const creatorRoleNotes = notes.filter((n) => n.payload.role === "creator");
    expect(creatorRoleNotes).toHaveLength(0);
  });
});

describe("0018 notifications: void path", () => {
  let db: PGlite;
  let admin: string;
  let creator: string;
  let bettor1: string;
  let bettor2: string;
  let marketId: string;
  let outcomeA: string;

  beforeEach(async () => {
    db = await bootTestDb(18);
    admin = await createAdmin(db);
    creator = await createUser(db);
    bettor1 = await createUser(db);
    bettor2 = await createUser(db);

    const m = await createMarket(db, creator, ["Yes", "No"]);
    marketId = m.market_id;
    outcomeA = m.outcomes[0].id;

    await insertBetDirect(db, marketId, bettor1, outcomeA, 100);
    await insertBetDirect(db, marketId, bettor2, m.outcomes[1].id, 60);
  });

  it("test 5: void → each bettor gets market_voided with role=bettor and refund matching their market_refund tx", async () => {
    await resolveMarket(db, admin, marketId, "void");

    for (const uid of [bettor1, bettor2]) {
      const notes = await notificationsFor(db, uid, marketId);
      expect(notes).toHaveLength(1);
      const n = notes[0];
      expect(n.type).toBe("market_voided");
      expect(n.payload.role).toBe("bettor");

      const tx = await db.query<{ amount: number }>(
        `SELECT amount FROM public.transactions
          WHERE user_id = $1 AND market_id = $2 AND type = 'market_refund'`,
        [uid, marketId],
      );
      expect(tx.rows).toHaveLength(1);
      expect(n.payload.refund).toBe(tx.rows[0].amount);
    }
  });

  it("test 6: void by admin (who is not the creator) → creator also gets market_voided with role=creator", async () => {
    await resolveMarket(db, admin, marketId, "void");

    // admin ≠ creator, so creator should get a notification.
    const notes = await notificationsFor(db, creator, marketId);
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("market_voided");
    expect(notes[0].payload.role).toBe("creator");
  });

  it("test 7: creator voids own market → no creator notification row (voider == creator)", async () => {
    // creator_id == v_uid so the 'where creator_id <> v_uid' guard skips insertion.
    await resolveMarket(db, creator, marketId, "void");

    const creatorNotes = await notificationsFor(db, creator, marketId);
    // Creator is not a bettor, so they should have NO notifications.
    expect(creatorNotes).toHaveLength(0);

    // Bettor notifications must still exist.
    const b1Notes = await notificationsFor(db, bettor1, marketId);
    expect(b1Notes).toHaveLength(1);
    expect(b1Notes[0].type).toBe("market_voided");
  });
});

describe("0018 notifications: empty-winner refund path", () => {
  let db: PGlite;
  let admin: string;
  let bettorA: string;
  let bettorB: string;
  let marketId: string;
  let outcomeA: string;
  let outcomeB: string;

  beforeEach(async () => {
    db = await bootTestDb(18);
    admin = await createAdmin(db);
    const creator = await createUser(db);
    bettorA = await createUser(db);
    bettorB = await createUser(db);

    const m = await createMarket(db, creator, ["Yes", "No"]);
    marketId = m.market_id;
    outcomeA = m.outcomes[0].id;
    outcomeB = m.outcomes[1].id;

    // Only outcome A is backed; resolve to outcome B (empty winner).
    await insertBetDirect(db, marketId, bettorA, outcomeA, 100);
    await insertBetDirect(db, marketId, bettorB, outcomeA, 75);
  });

  it("test 8: empty-winner resolve → all bettors get market_resolved with result=refunded and matching refund amount", async () => {
    // Resolve to outcome B — nobody backed it → refund path.
    await resolveMarket(db, admin, marketId, "resolve", outcomeB);

    for (const uid of [bettorA, bettorB]) {
      const notes = await notificationsFor(db, uid, marketId);
      expect(notes).toHaveLength(1);
      const n = notes[0];
      expect(n.type).toBe("market_resolved");
      expect(n.payload.result).toBe("refunded");

      const tx = await db.query<{ amount: number }>(
        `SELECT amount FROM public.transactions
          WHERE user_id = $1 AND market_id = $2 AND type = 'market_refund'`,
        [uid, marketId],
      );
      expect(tx.rows).toHaveLength(1);
      expect(n.payload.refund).toBe(tx.rows[0].amount);
    }
  });
});

describe("0018 notifications: handle_report void path", () => {
  it("test 9: handle_report 'action' on a reported market generates market_voided notifications for the bettor", async () => {
    const db = await bootTestDb(18);
    const admin = await createAdmin(db);
    const creator = await createUser(db);
    const reporter = await createUser(db);
    const bettor = await createUser(db);

    const m = await createMarket(db, creator, ["Yes", "No"]);
    const marketId = m.market_id;
    await insertBetDirect(db, marketId, bettor, m.outcomes[0].id, 50);

    // Insert a report directly.
    const reportRes = await db.query<{ id: string }>(
      `INSERT INTO public.reports (market_id, reporter_id, reason)
       VALUES ($1, $2, 'Test report reason')
       RETURNING id`,
      [marketId, reporter],
    );
    const reportId = reportRes.rows[0].id;

    // Admin handles the report with 'action' → voids the market.
    await setUid(db, admin);
    await db.query("select public.handle_report($1, $2)", [reportId, "action"]);

    // Bettor should now have a market_voided notification.
    const notes = await notificationsFor(db, bettor, marketId);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    const voidNote = notes.find((n) => n.type === "market_voided");
    expect(voidNote).toBeDefined();
    expect(voidNote?.payload.role).toBe("bettor");
  });
});

describe("0018 notifications: double-resolve guard", () => {
  it("test 10: resolving an already-resolved market raises and leaves notification count unchanged", async () => {
    const db = await bootTestDb(18);
    const admin = await createAdmin(db);
    const creator = await createUser(db);
    const bettor = await createUser(db);

    const m = await createMarket(db, creator, ["Yes", "No"]);
    const marketId = m.market_id;
    const outcomeA = m.outcomes[0].id;

    await insertBetDirect(db, marketId, bettor, outcomeA, 100);

    // First resolution — succeeds.
    await resolveMarket(db, admin, marketId, "resolve", outcomeA);

    const countAfterFirst = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.notifications WHERE market_id = $1`,
      [marketId],
    );
    const expectedCount = countAfterFirst.rows[0].n;
    expect(expectedCount).toBeGreaterThan(0);

    // Second resolution — must throw.
    await expect(
      resolveMarket(db, admin, marketId, "resolve", outcomeA),
    ).rejects.toThrow(/market already resolved/i);

    // Notification count must be unchanged.
    const countAfterSecond = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.notifications WHERE market_id = $1`,
      [marketId],
    );
    expect(countAfterSecond.rows[0].n).toBe(expectedCount);
  });
});

describe("0018 notifications: schema and grants", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootTestDb(18);
  });

  it("test 11: RLS select-own and update-own-read_at policies exist on notifications table", async () => {
    const policies = await db.query<{ policyname: string; cmd: string }>(
      `SELECT policyname, cmd
         FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'notifications'
        ORDER BY policyname`,
    );

    const names = policies.rows.map((p) => p.policyname);
    expect(names).toContain("notifications: select own");
    expect(names).toContain("notifications: update own read_at");

    const selectPolicy = policies.rows.find(
      (p) => p.policyname === "notifications: select own",
    );
    expect(selectPolicy?.cmd).toBe("SELECT");

    const updatePolicy = policies.rows.find(
      (p) => p.policyname === "notifications: update own read_at",
    );
    expect(updatePolicy?.cmd).toBe("UPDATE");
  });

  it("test 12: authenticated role may UPDATE read_at but NOT email_status on notifications", async () => {
    const grants = await db.query<{
      column_name: string;
      privilege_type: string;
    }>(
      `SELECT column_name, privilege_type
         FROM information_schema.role_column_grants
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND grantee = 'authenticated'
          AND privilege_type = 'UPDATE'`,
    );

    const updatableColumns = grants.rows.map((g) => g.column_name);

    // read_at must be grantable.
    expect(updatableColumns).toContain("read_at");

    // email_status must NOT be grantable to authenticated.
    expect(updatableColumns).not.toContain("email_status");
  });
});
