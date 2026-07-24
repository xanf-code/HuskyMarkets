import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  bootTestDb,
  createAdmin,
  createUser,
  setUid,
} from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createPendingMarket(
  db: PGlite,
  creatorId: string,
): Promise<string> {
  await setUid(db, creatorId);
  const result = await db.query<{ market: { market_id: string } }>(
    `select public.create_market(
       $1, null, 'campus'::public.market_category, $2,
       $3::timestamptz, $4::timestamptz, $5::jsonb, false, false
     ) as market`,
    [
      "Will this pending market stay private?",
      "Resolves from an official university announcement.",
      future(1),
      future(2),
      JSON.stringify(["Yes", "No"]),
    ],
  );
  return result.rows[0].market.market_id;
}

describe("0027 unapproved market visibility", () => {
  let db: PGlite;
  let creatorId: string;
  let marketId: string;

  beforeEach(async () => {
    db = await bootTestDb(27);
    creatorId = await createUser(db);
    marketId = await createPendingMarket(db, creatorId);
  });

  it("filters pending and rejected rows from every anon table policy", async () => {
    const result = await db.query<{
      tablename: string;
      qual: string;
    }>(
      `select tablename, qual
       from pg_policies
       where schemaname = 'public'
         and roles = array['anon']::name[]
         and tablename in ('markets', 'market_outcomes', 'price_history')
       order by tablename`,
    );

    expect(result.rows).toHaveLength(3);
    for (const policy of result.rows) {
      expect(policy.qual).toContain("pending");
      expect(policy.qual).toContain("rejected");
    }
  });

  it("blocks public share cards while preserving creator and staff review access", async () => {
    await setUid(db, null);
    const guest = await db.query<{ card: unknown }>(
      "select public.get_market_card($1) as card",
      [marketId],
    );
    expect(guest.rows[0].card).toBeNull();

    await setUid(db, creatorId);
    const creator = await db.query<{ card: { id: string } | null }>(
      "select public.get_market_card($1) as card",
      [marketId],
    );
    expect(creator.rows[0].card?.id).toBe(marketId);

    const adminId = await createAdmin(db);
    await setUid(db, adminId);
    const staff = await db.query<{ card: { id: string } | null }>(
      "select public.get_market_card($1) as card",
      [marketId],
    );
    expect(staff.rows[0].card?.id).toBe(marketId);
  });
});
