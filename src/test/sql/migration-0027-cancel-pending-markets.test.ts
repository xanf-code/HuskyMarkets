import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, setUid } from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createPendingMarket(
  db: PGlite,
  creatorId: string,
): Promise<string> {
  await setUid(db, creatorId);
  const result = await db.query<{
    market: { market_id: string; status: string };
  }>(
    `select public.create_market(
       $1, $2, $3::public.market_category, $4,
       $5::timestamptz, $6::timestamptz, $7::jsonb, false, false
     ) as market`,
    [
      "Will the library extend weekend hours?",
      "Awaiting an official library announcement.",
      "campus",
      "Resolves from the hours published on the library website.",
      future(2),
      future(3),
      JSON.stringify(["Yes", "No"]),
    ],
  );
  expect(result.rows[0].market.status).toBe("pending");
  return result.rows[0].market.market_id;
}

describe("cancel_pending_market", () => {
  let db: PGlite;
  let creatorId: string;
  let otherUserId: string;

  beforeEach(async () => {
    db = await bootTestDb(27);
    creatorId = await createUser(db);
    otherUserId = await createUser(db);
  });

  it("lets the creator withdraw a pending market without ledger writes", async () => {
    const marketId = await createPendingMarket(db, creatorId);

    await setUid(db, creatorId);
    await db.query("select public.cancel_pending_market($1)", [marketId]);

    const market = await db.query<{ status: string }>(
      `select status::text
       from public.markets where id = $1`,
      [marketId],
    );
    expect(market.rows[0].status).toBe("rejected");

    const ledger = await db.query<{ count: number }>(
      `select count(*)::int as count
       from public.transactions where market_id = $1`,
      [marketId],
    );
    expect(ledger.rows[0].count).toBe(0);

    const trusted = await db.query<{ count: number }>(
      `select count(*)::int as count
       from public.markets
       where creator_id = $1
         and status::text in ('open', 'closed', 'resolved', 'voided')`,
      [creatorId],
    );
    expect(trusted.rows[0].count).toBe(0);
  });

  it("rejects withdrawal by a different user", async () => {
    const marketId = await createPendingMarket(db, creatorId);

    await setUid(db, otherUserId);
    await expect(
      db.query("select public.cancel_pending_market($1)", [marketId]),
    ).rejects.toThrow(/not allowed/i);

    const market = await db.query<{ status: string }>(
      "select status::text from public.markets where id = $1",
      [marketId],
    );
    expect(market.rows[0].status).toBe("pending");
  });

  it("rejects markets that are no longer pending", async () => {
    const marketId = await createPendingMarket(db, creatorId);
    await db.query("update public.markets set status = 'open' where id = $1", [
      marketId,
    ]);

    await setUid(db, creatorId);
    await expect(
      db.query("select public.cancel_pending_market($1)", [marketId]),
    ).rejects.toThrow(/not pending review/i);
  });
});
