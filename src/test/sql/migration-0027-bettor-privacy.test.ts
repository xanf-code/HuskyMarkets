import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  bootTestDb,
  createUser,
  setUid,
} from "./harness";

describe("0027 bettor privacy", () => {
  let db: PGlite;
  let marketId: string;
  let outcomeId: string;
  let firstBetId: string;

  beforeAll(async () => {
    db = await bootTestDb(27);
    const creatorId = await createUser(db);
    const bettorA = await createUser(db);
    const bettorB = await createUser(db);
    const viewer = await createUser(db);

    const market = await db.query<{ id: string }>(
      `insert into public.markets
         (creator_id, title, category, resolution_criteria, close_at, resolve_at)
       values ($1, 'Will privacy remain intact?', 'campus',
               'Resolve from the published privacy audit.',
               now() + interval '1 day', now() + interval '2 days')
       returning id`,
      [creatorId],
    );
    marketId = market.rows[0].id;

    const outcomes = await db.query<{ id: string }>(
      `insert into public.market_outcomes
         (market_id, label, sort_order, pool, is_catch_all)
       values
         ($1, 'Yes', 0, 100, false),
         ($1, 'No', 1, 100, false)
       returning id`,
      [marketId],
    );
    outcomeId = outcomes.rows[0].id;

    const firstBet = await db.query<{ id: string }>(
      `insert into public.bets
         (market_id, user_id, outcome_id, amount, price_at_bet)
       values ($1, $2, $3, 50, 50)
       returning id`,
      [marketId, bettorA, outcomeId],
    );
    firstBetId = firstBet.rows[0].id;
    await db.query(
      `insert into public.bets
         (market_id, user_id, outcome_id, amount, price_at_bet)
       values ($1, $2, $3, 75, 50)`,
      [marketId, bettorB, outcomeId],
    );

    await setUid(db, viewer);
  });

  afterAll(async () => {
    await db.close();
  });

  it("replaces the blanket bets policy with owner-only reads", async () => {
    const policies = await db.query<{ policyname: string; qual: string }>(
      `select policyname, qual
       from pg_policies
       where schemaname = 'public' and tablename = 'bets'`,
    );

    expect(policies.rows).toHaveLength(1);
    expect(policies.rows[0].policyname).toBe("bets: read own");
    expect(policies.rows[0].qual).toMatch(/user_id.*auth\.uid/i);
  });

  it("returns activity without user ids or share-card bet UUIDs", async () => {
    const activity = await db.query<Record<string, unknown>>(
      "select * from public.get_market_activity($1, 20)",
      [marketId],
    );

    expect(activity.rows).toHaveLength(2);
    expect(activity.rows[0]).not.toHaveProperty("user_id");
    expect(activity.rows[0]).not.toHaveProperty("id");
    expect(activity.rows.map((row) => row.activity_id)).not.toContain(firstBetId);
    expect(activity.rows[0].activity_id).toMatch(/^[a-f0-9]{32}$/);
  });

  it("preserves aggregate bettor counts without exposing identities", async () => {
    const counts = await db.query<{ market_id: string; bettor_count: number }>(
      "select * from public.get_market_bettor_counts(array[$1]::uuid[])",
      [marketId],
    );

    expect(counts.rows).toEqual([{ market_id: marketId, bettor_count: 2 }]);
  });

  it("removes raw bets from realtime and keeps redacted RPCs authenticated-only", async () => {
    const publication = await db.query<{ tablename: string }>(
      `select tablename
       from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'bets'`,
    );
    expect(publication.rows).toHaveLength(0);

    const grants = await db.query<{
      anon_activity: boolean;
      authenticated_activity: boolean;
      anon_counts: boolean;
      authenticated_counts: boolean;
    }>(
      `select
         has_function_privilege(
           'anon', 'public.get_market_activity(uuid, integer)', 'execute'
         ) as anon_activity,
         has_function_privilege(
           'authenticated', 'public.get_market_activity(uuid, integer)', 'execute'
         ) as authenticated_activity,
         has_function_privilege(
           'anon', 'public.get_market_bettor_counts(uuid[])', 'execute'
         ) as anon_counts,
         has_function_privilege(
           'authenticated', 'public.get_market_bettor_counts(uuid[])', 'execute'
         ) as authenticated_counts`,
    );
    expect(grants.rows[0]).toEqual({
      anon_activity: false,
      authenticated_activity: true,
      anon_counts: false,
      authenticated_counts: true,
    });
  });
});
