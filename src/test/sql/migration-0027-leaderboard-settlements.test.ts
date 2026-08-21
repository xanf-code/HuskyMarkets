import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser } from "./harness";

const BEFORE_SEMESTER = "2026-05-01T12:00:00Z";
const IN_SEMESTER = "2026-06-01T12:00:00Z";

interface MarketFixture {
  marketId: string;
  winningOutcomeId: string;
  losingOutcomeId: string;
}

async function createResolvedMarket(
  db: PGlite,
  creatorId: string,
): Promise<MarketFixture> {
  const market = await db.query<{ id: string }>(
    `insert into public.markets (
       creator_id, title, category, resolution_criteria,
       close_at, resolve_at, status
     )
     values (
       $1, 'Will the test outcome happen?', 'campus',
       'Resolve from the deterministic test fixture.',
       '2026-07-01T12:00:00Z', '2026-07-02T12:00:00Z', 'open'
     )
     returning id`,
    [creatorId],
  );
  const marketId = market.rows[0].id;
  const outcomes = await db.query<{ id: string; sort_order: number }>(
    `insert into public.market_outcomes (market_id, label, sort_order, pool)
     values ($1, 'Winner', 0, 100), ($1, 'Loser', 1, 100)
     returning id, sort_order`,
    [marketId],
  );
  const winningOutcomeId = outcomes.rows.find((row) => row.sort_order === 0)!.id;
  const losingOutcomeId = outcomes.rows.find((row) => row.sort_order === 1)!.id;
  await db.query(
    `update public.markets
     set status = 'resolved', winning_outcome_id = $2,
         resolved_at = '2026-06-02T12:00:00Z'
     where id = $1`,
    [marketId, winningOutcomeId],
  );
  return { marketId, winningOutcomeId, losingOutcomeId };
}

async function addBet(
  db: PGlite,
  userId: string,
  marketId: string,
  outcomeId: string,
  amount: number,
  createdAt: string,
): Promise<void> {
  const bet = await db.query<{ id: string }>(
    `insert into public.bets (
       market_id, user_id, outcome_id, amount, price_at_bet, created_at
     )
     values ($1, $2, $3, $4, 50, $5)
     returning id`,
    [marketId, userId, outcomeId, amount, createdAt],
  );
  await db.query(
    `insert into public.transactions (
       user_id, type, amount, market_id, bet_id, created_at
     )
     values ($1, 'bet_place', $2, $3, $4, $5)`,
    [userId, -amount, marketId, bet.rows[0].id, createdAt],
  );
}

async function addSettlement(
  db: PGlite,
  userId: string,
  marketId: string,
  type: "bet_payout" | "market_refund",
  amount: number,
): Promise<void> {
  await db.query(
    `insert into public.transactions (
       user_id, type, amount, market_id, created_at
     )
     values ($1, $2, $3, $4, $5)`,
    [userId, type, amount, marketId, IN_SEMESTER],
  );
}

describe("0027 semester settlement attribution", () => {
  let db: PGlite;
  let semesterId: string;

  beforeAll(async () => {
    db = await bootTestDb(27);
    const semester = await db.query<{ id: string }>(
      "select id from public.semesters where name = 'Summer 2026'",
    );
    semesterId = semester.rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  async function scoreFor(userId: string): Promise<number> {
    const result = await db.query<{ user_id: string; score: number }>(
      "select user_id, score from public.get_semester_leaderboard($1, 50)",
      [semesterId],
    );
    return result.rows.find((row) => row.user_id === userId)!.score;
  }

  it("does not credit a gross payout whose winning stake predates the semester", async () => {
    const userId = await createUser(db);
    const market = await createResolvedMarket(db, userId);

    await addBet(
      db,
      userId,
      market.marketId,
      market.winningOutcomeId,
      250,
      BEFORE_SEMESTER,
    );
    await addBet(
      db,
      userId,
      market.marketId,
      market.losingOutcomeId,
      250,
      BEFORE_SEMESTER,
    );
    await addBet(
      db,
      userId,
      market.marketId,
      market.losingOutcomeId,
      1,
      IN_SEMESTER,
    );
    await addSettlement(db, userId, market.marketId, "bet_payout", 475);

    // The old scorer returned 1474: 1000 - 1 + the full 475 gross payout.
    expect(await scoreFor(userId)).toBe(999);
  });

  it("prorates a payout when winning stake spans the semester boundary", async () => {
    const userId = await createUser(db);
    const market = await createResolvedMarket(db, userId);

    await addBet(
      db,
      userId,
      market.marketId,
      market.winningOutcomeId,
      100,
      BEFORE_SEMESTER,
    );
    await addBet(
      db,
      userId,
      market.marketId,
      market.winningOutcomeId,
      50,
      IN_SEMESTER,
    );
    await addSettlement(db, userId, market.marketId, "bet_payout", 300);

    // Only 50/150 of the payout pairs with this semester: 1000 - 50 + 100.
    expect(await scoreFor(userId)).toBe(1050);
  });

  it("pairs only the in-semester portion of a cross-boundary refund", async () => {
    const userId = await createUser(db);
    const market = await createResolvedMarket(db, userId);

    await addBet(
      db,
      userId,
      market.marketId,
      market.losingOutcomeId,
      100,
      BEFORE_SEMESTER,
    );
    await addBet(
      db,
      userId,
      market.marketId,
      market.losingOutcomeId,
      20,
      IN_SEMESTER,
    );
    await addSettlement(db, userId, market.marketId, "market_refund", 120);

    expect(await scoreFor(userId)).toBe(1000);
  });
});
