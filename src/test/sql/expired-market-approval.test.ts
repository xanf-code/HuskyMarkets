import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  applyMigration,
  bootTestDb,
  createAdmin,
  createUser,
  setUid,
} from "./harness";

const migration =
  "20260909110105_prevent_expired_market_approval.sql";

describe("expired market approval guard", () => {
  let db: PGlite;
  let adminId: string;
  let creatorId: string;

  beforeEach(async () => {
    db = await bootTestDb(26);
    await applyMigration(db, migration);
    adminId = await createAdmin(db);
    creatorId = await createUser(db);
    await setUid(db, adminId);
  });

  async function createPendingMarket(closeAt: Date): Promise<string> {
    const market = await db.query<{ id: string }>(
      `insert into public.markets
         (creator_id, title, category, resolution_criteria,
          close_at, resolve_at, status)
       values ($1, 'Will this pending market accept bets?', 'campus',
               'Resolves from the official result after the event.',
               $2, $3, 'pending')
       returning id`,
      [
        creatorId,
        closeAt.toISOString(),
        new Date(Date.now() + 2 * 86_400_000).toISOString(),
      ],
    );
    return market.rows[0].id;
  }

  it("rejects approval after the market close time", async () => {
    const marketId = await createPendingMarket(
      new Date(Date.now() - 86_400_000),
    );

    await expect(
      db.query("select public.review_market($1, 'approve')", [marketId]),
    ).rejects.toThrow(/close time has passed/i);

    const market = await db.query<{ status: string }>(
      "select status::text as status from public.markets where id = $1",
      [marketId],
    );
    expect(market.rows[0].status).toBe("pending");

    const sideEffects = await db.query<{ count: number }>(
      `select (
         (select count(*) from public.mod_actions where market_id = $1) +
         (select count(*) from public.notifications where market_id = $1)
       )::int as count`,
      [marketId],
    );
    expect(sideEffects.rows[0].count).toBe(0);
  });

  it("still approves a pending market with time left to bet", async () => {
    const marketId = await createPendingMarket(
      new Date(Date.now() + 86_400_000),
    );

    await db.query("select public.review_market($1, 'approve')", [marketId]);

    const market = await db.query<{ status: string }>(
      "select status::text as status from public.markets where id = $1",
      [marketId],
    );
    expect(market.rows[0].status).toBe("open");
  });
});
