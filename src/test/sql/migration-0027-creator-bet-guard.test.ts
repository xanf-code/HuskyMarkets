import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  bootTestDb,
  createAdmin,
  createUser,
  setUid,
} from "./harness";

interface CreateResult {
  market_id: string;
  outcomes: Array<{ id: string }>;
}

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createOpenMarket(
  db: PGlite,
  creatorId: string,
): Promise<CreateResult> {
  await setUid(db, creatorId);
  const result = await db.query<{ market: CreateResult }>(
    `select public.create_market(
       $1, $2, $3::public.market_category, $4,
       $5::timestamptz, $6::timestamptz, $7::jsonb, $8
     ) as market`,
    [
      "Will this regression test pass?",
      null,
      "campus",
      "Resolves from the automated test result.",
      future(1),
      future(2),
      JSON.stringify(["Yes", "No"]),
      false,
    ],
  );
  return result.rows[0].market;
}

describe("0027 creator self-bet guard", () => {
  it("rejects the creator without blocking another bettor", async () => {
    const db = await bootTestDb(27);
    const creator = await createAdmin(db);
    const bettor = await createUser(db);
    const market = await createOpenMarket(db, creator);

    await expect(
      db.query("select public.place_bet($1, $2, 10)", [
        market.market_id,
        market.outcomes[0].id,
      ]),
    ).rejects.toThrow(/creator cannot bet on own market/i);

    await setUid(db, bettor);
    await expect(
      db.query("select public.place_bet($1, $2, 10)", [
        market.market_id,
        market.outcomes[0].id,
      ]),
    ).resolves.toBeDefined();

    const bets = await db.query<{ count: number }>(
      "select count(*)::int as count from public.bets where market_id = $1",
      [market.market_id],
    );
    expect(bets.rows[0].count).toBe(1);
    await db.close();
  }, 30_000);
});
