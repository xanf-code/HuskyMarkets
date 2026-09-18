import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createAdmin, createUser, setUid } from "./harness";

interface MarketFixture {
  marketId: string;
  outcomeId: string;
}

async function createMarket(
  db: PGlite,
  creatorId: string,
  closeAt: string,
  resolveAt: string,
): Promise<MarketFixture> {
  const market = await db.query<{ id: string }>(
    `insert into public.markets
       (creator_id, title, category, resolution_criteria, close_at, resolve_at)
     values ($1, 'Will the event happen?', 'campus',
       'Resolves when the official result is published.', $2, $3)
     returning id`,
    [creatorId, closeAt, resolveAt],
  );
  const outcomes = await db.query<{ id: string }>(
    `insert into public.market_outcomes (market_id, label, sort_order, pool)
     values ($1, 'Yes', 0, 100), ($1, 'No', 1, 100)
     returning id`,
    [market.rows[0].id],
  );
  return { marketId: market.rows[0].id, outcomeId: outcomes.rows[0].id };
}

describe("0027 resolution-time enforcement", () => {
  let db: PGlite;
  let admin: string;
  let creator: string;

  beforeEach(async () => {
    db = await bootTestDb(27);
    admin = await createAdmin(db);
    creator = await createUser(db);
  });

  it("rejects early resolution and rolls back payouts", async () => {
    const market = await createMarket(
      db,
      creator,
      new Date(Date.now() + 86_400_000).toISOString(),
      new Date(Date.now() + 2 * 86_400_000).toISOString(),
    );
    const bettor = await createUser(db);
    await db.query(
      `insert into public.bets
         (market_id, user_id, outcome_id, amount, price_at_bet)
       values ($1, $2, $3, 50, 50)`,
      [market.marketId, bettor, market.outcomeId],
    );
    await db.query(
      `insert into public.transactions (user_id, type, amount, market_id)
       values ($1, 'bet_place', -50, $2)`,
      [bettor, market.marketId],
    );
    await setUid(db, admin);

    await expect(
      db.query("select public.resolve_market($1, 'resolve', $2)", [
        market.marketId,
        market.outcomeId,
      ]),
    ).rejects.toThrow(/before its resolution time/i);

    const state = await db.query<{ status: string; settlement_rows: number }>(
      `select m.status::text,
         count(t.id) filter (
           where t.type in ('bet_payout', 'market_refund', 'vig_burn')
         )::int as settlement_rows
       from public.markets m
       left join public.transactions t on t.market_id = m.id
       where m.id = $1
       group by m.status`,
      [market.marketId],
    );
    expect(state.rows[0]).toEqual({ status: "open", settlement_rows: 0 });
  });

  it("allows resolution once resolve_at has passed", async () => {
    const market = await createMarket(
      db,
      creator,
      new Date(Date.now() - 2 * 86_400_000).toISOString(),
      new Date(Date.now() - 86_400_000).toISOString(),
    );
    await setUid(db, admin);

    await db.query("select public.resolve_market($1, 'resolve', $2)", [
      market.marketId,
      market.outcomeId,
    ]);

    const state = await db.query<{ status: string }>(
      "select status::text from public.markets where id = $1",
      [market.marketId],
    );
    expect(state.rows[0].status).toBe("resolved");
  });

  it("still allows voiding before resolve_at", async () => {
    const market = await createMarket(
      db,
      creator,
      new Date(Date.now() + 86_400_000).toISOString(),
      new Date(Date.now() + 2 * 86_400_000).toISOString(),
    );
    await setUid(db, admin);

    await db.query("select public.resolve_market($1, 'void', null)", [
      market.marketId,
    ]);

    const state = await db.query<{ status: string }>(
      "select status::text from public.markets where id = $1",
      [market.marketId],
    );
    expect(state.rows[0].status).toBe("voided");
  });
});
