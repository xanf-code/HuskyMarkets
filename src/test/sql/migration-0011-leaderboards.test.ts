// E-5 / S5-1 - accuracy leaderboard and profile stats determine a win by the
// user's bet outcome matching the market's winning outcome (FR-19), over
// resolved markets. No yes/no status matching anywhere.

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, createAdmin, setUid } from "./harness";

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

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createMarket(
  db: PGlite,
  uid: string,
  outcomes: string[],
): Promise<CreateResult> {
  await setUid(db, uid);
  const r = await db.query<{ m: CreateResult }>(
    `select public.create_market(
       $1, null, 'campus'::public.market_category, $2,
       $3::timestamptz, $4::timestamptz, $5::jsonb, false) as m`,
    [
      `Market ${crypto.randomUUID().slice(0, 8)}`,
      "Resolves when confirmed.",
      future(1),
      future(2),
      JSON.stringify(outcomes),
    ],
  );
  return r.rows[0].m;
}

async function placeBet(
  db: PGlite,
  uid: string,
  marketId: string,
  outcomeId: string,
  amount: number,
): Promise<void> {
  await setUid(db, uid);
  await db.query("select public.place_bet($1, $2, $3)", [
    marketId,
    outcomeId,
    amount,
  ]);
}

async function resolveMarket(
  db: PGlite,
  admin: string,
  marketId: string,
  outcomeId: string,
): Promise<void> {
  await setUid(db, admin);
  await db.query("select public.resolve_market($1, 'resolve', $2)", [
    marketId,
    outcomeId,
  ]);
}

// 0004 seeds semesters; "now" falls inside one of them.
async function currentSemester(db: PGlite): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select id from public.semesters
     where starts_at <= now() and ends_at > now()
     limit 1`,
  );
  return r.rows[0].id;
}

describe("get_accuracy_leaderboard (FR-19)", () => {
  let db: PGlite;
  let admin: string;
  let a: string;
  let b: string;

  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
    b = await createUser(db);
  });

  it("counts a win by bet outcome = winning outcome, across 2- and 3-outcome markets", async () => {
    const sem = await currentSemester(db);

    // Binary market: a backs the winner 5 times.
    const m1 = await createMarket(db, admin, ["Yes", "No"]);
    for (let i = 0; i < 5; i++) {
      await placeBet(db, a, m1.market_id, m1.outcomes[0].id, 40);
    }
    // 3-outcome market: a backs Gamma (winner) 3× and Beta (loser) 2×.
    const m2 = await createMarket(db, admin, ["Alpha", "Beta", "Gamma"]);
    for (let i = 0; i < 3; i++) {
      await placeBet(db, a, m2.market_id, m2.outcomes[2].id, 40);
    }
    for (let i = 0; i < 2; i++) {
      await placeBet(db, a, m2.market_id, m2.outcomes[1].id, 40);
    }
    // b bets 10 times on outcomes that will lose.
    for (let i = 0; i < 5; i++) {
      await placeBet(db, b, m1.market_id, m1.outcomes[1].id, 30);
    }
    for (let i = 0; i < 5; i++) {
      await placeBet(db, b, m2.market_id, m2.outcomes[0].id, 30);
    }

    await resolveMarket(db, admin, m1.market_id, m1.outcomes[0].id); // Yes wins
    await resolveMarket(db, admin, m2.market_id, m2.outcomes[2].id); // Gamma wins

    await setUid(db, admin);
    const r = await db.query<{
      rank: number;
      user_id: string;
      wins: number;
      losses: number;
      win_rate: number;
    }>("select * from public.get_accuracy_leaderboard($1)", [sem]);

    const rowA = r.rows.find((row) => row.user_id === a);
    const rowB = r.rows.find((row) => row.user_id === b);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    // a: 10 bets, 8 wins (5 Yes + 3 Gamma), 2 losses (Beta).
    expect(rowA!.wins).toBe(8);
    expect(rowA!.losses).toBe(2);
    expect(Number(rowA!.win_rate)).toBeCloseTo(0.8, 4);
    // b: 10 bets, 0 wins.
    expect(rowB!.wins).toBe(0);
    expect(rowB!.losses).toBe(10);
    expect(rowA!.rank).toBeLessThan(rowB!.rank);
  });

  it("ignores open and voided markets entirely", async () => {
    const sem = await currentSemester(db);

    const open = await createMarket(db, admin, ["Yes", "No"]);
    for (let i = 0; i < 6; i++) {
      await placeBet(db, a, open.market_id, open.outcomes[0].id, 40);
    }
    const voided = await createMarket(db, admin, ["Yes", "No"]);
    for (let i = 0; i < 6; i++) {
      await placeBet(db, a, voided.market_id, voided.outcomes[0].id, 40);
    }
    await setUid(db, admin);
    await db.query("select public.resolve_market($1, 'void', null)", [
      voided.market_id,
    ]);

    const r = await db.query<{ user_id: string }>(
      "select * from public.get_accuracy_leaderboard($1)",
      [sem],
    );
    expect(r.rows.find((row) => row.user_id === a)).toBeUndefined();
  });
});

describe("get_profile_stats (FR-19)", () => {
  let db: PGlite;
  let admin: string;
  let a: string;
  let b: string;

  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
    b = await createUser(db);
  });

  async function stats(uid: string): Promise<{
    biggest_win: number;
    worst_loss: number;
    current_streak: number;
  }> {
    await setUid(db, admin);
    const r = await db.query<{ s: {
      biggest_win: number;
      worst_loss: number;
      current_streak: number;
    } }>("select public.get_profile_stats($1) as s", [uid]);
    return r.rows[0].s;
  }

  it("computes worst loss as the largest per-market stake on non-winning outcomes", async () => {
    // Market 1: a loses 80 on No; Yes wins.
    const m1 = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m1.market_id, m1.outcomes[1].id, 80);
    await placeBet(db, b, m1.market_id, m1.outcomes[0].id, 50);
    // Market 2 (3-outcome): a hedges - 100 on loser Alpha, 60 on winner Gamma.
    const m2 = await createMarket(db, admin, ["Alpha", "Beta", "Gamma"]);
    await placeBet(db, a, m2.market_id, m2.outcomes[0].id, 100);
    await placeBet(db, a, m2.market_id, m2.outcomes[2].id, 60);

    await resolveMarket(db, admin, m1.market_id, m1.outcomes[0].id);
    await resolveMarket(db, admin, m2.market_id, m2.outcomes[2].id);

    const s = await stats(a);
    // m2's losing stake (100 on Alpha) exceeds m1's (80 on No).
    expect(s.worst_loss).toBe(100);
    // a won a payout on m2 (Gamma).
    expect(s.biggest_win).toBeGreaterThan(0);
  });

  it("counts the current streak by outcome match on the most recent resolved markets", async () => {
    const m1 = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m1.market_id, m1.outcomes[0].id, 50);
    const m2 = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m2.market_id, m2.outcomes[0].id, 50);
    const m3 = await createMarket(db, admin, ["Alpha", "Beta", "Gamma"]);
    await placeBet(db, a, m3.market_id, m3.outcomes[1].id, 50);

    // Resolution order defines recency: m1 win, m2 win, m3 loss (latest).
    await resolveMarket(db, admin, m1.market_id, m1.outcomes[0].id);
    await resolveMarket(db, admin, m2.market_id, m2.outcomes[0].id);
    await resolveMarket(db, admin, m3.market_id, m3.outcomes[0].id); // Alpha wins; a held Beta

    const s = await stats(a);
    expect(s.current_streak).toBe(-1);
    expect(s.worst_loss).toBe(50);
  });

  it("returns zeros for a user with no settled bets", async () => {
    const s = await stats(b);
    expect(s).toEqual({ biggest_win: 0, worst_loss: 0, current_streak: 0 });
  });
});

// W2 - reconciliation cutoff: markets resolved after the snapshot timestamp must
// be excluded from the re-captured boards so post-snapshot activity never triggers
// a false-positive restore decision.

describe("get_accuracy_leaderboard - p_resolved_before (W2)", () => {
  let db: PGlite;
  let admin: string;
  let a: string;

  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
  });

  it("excludes a market resolved at or after the cutoff", async () => {
    const sem = await currentSemester(db);
    const m = await createMarket(db, admin, ["Yes", "No"]);
    for (let i = 0; i < 10; i++) {
      await placeBet(db, a, m.market_id, m.outcomes[0].id, 40);
    }

    // Capture the cutoff BEFORE resolution.
    const { rows: [{ cut }] } = await db.query<{ cut: string }>(
      "select now()::text as cut",
    );

    await resolveMarket(db, admin, m.market_id, m.outcomes[0].id);

    // With the cutoff, the resolved market is excluded → user absent.
    await setUid(db, admin);
    const r = await db.query<{ user_id: string }>(
      "select * from public.get_accuracy_leaderboard($1, $2::timestamptz)",
      [sem, cut],
    );
    expect(r.rows.find((row) => row.user_id === a)).toBeUndefined();
  });

  it("includes all resolved markets when p_resolved_before is null (backward compat)", async () => {
    const sem = await currentSemester(db);
    const m = await createMarket(db, admin, ["Yes", "No"]);
    for (let i = 0; i < 10; i++) {
      await placeBet(db, a, m.market_id, m.outcomes[0].id, 40);
    }
    await resolveMarket(db, admin, m.market_id, m.outcomes[0].id);

    await setUid(db, admin);
    // Calling with null second arg behaves like the old 1-arg version.
    const r = await db.query<{ user_id: string }>(
      "select * from public.get_accuracy_leaderboard($1, null::timestamptz)",
      [sem],
    );
    expect(r.rows.find((row) => row.user_id === a)).toBeDefined();
  });
});

describe("get_profile_stats - p_resolved_before (W2)", () => {
  let db: PGlite;
  let admin: string;
  let a: string;

  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
  });

  it("returns zeros when all markets resolved after the cutoff", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 80);

    // Capture cutoff BEFORE resolution.
    const { rows: [{ cut }] } = await db.query<{ cut: string }>(
      "select now()::text as cut",
    );

    await resolveMarket(db, admin, m.market_id, m.outcomes[0].id);

    await setUid(db, admin);
    const r = await db.query<{ s: { biggest_win: number; worst_loss: number; current_streak: number } }>(
      "select public.get_profile_stats($1, $2::timestamptz) as s",
      [a, cut],
    );
    expect(r.rows[0].s).toEqual({ biggest_win: 0, worst_loss: 0, current_streak: 0 });
  });

  it("includes stats from markets resolved before the cutoff", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 80);
    await resolveMarket(db, admin, m.market_id, m.outcomes[0].id);

    // Capture cutoff AFTER resolution.
    const { rows: [{ cut }] } = await db.query<{ cut: string }>(
      "select now()::text as cut",
    );

    await setUid(db, admin);
    const r = await db.query<{ s: { biggest_win: number; worst_loss: number; current_streak: number } }>(
      "select public.get_profile_stats($1, $2::timestamptz) as s",
      [a, cut],
    );
    // Won the bet → biggest_win > 0, streak = +1.
    expect(r.rows[0].s.biggest_win).toBeGreaterThan(0);
    expect(r.rows[0].s.current_streak).toBe(1);
  });
});
