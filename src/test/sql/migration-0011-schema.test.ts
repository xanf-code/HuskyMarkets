// E-1 / S1-1, S1-3, S1-5 — schema shape after the migration: rebuilt enums,
// market_outcomes constraints, dropped legacy columns, RLS, publication, cron.

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, applyMigration } from "./harness";

async function enumValues(db: PGlite, typeName: string): Promise<string[]> {
  const r = await db.query<{ v: string }>(
    `select e.enumlabel as v
     from pg_type t join pg_enum e on e.enumtypid = t.oid
     where t.typname = $1 order by e.enumsortorder`,
    [typeName],
  );
  return r.rows.map((row) => row.v);
}

async function columnExists(
  db: PGlite,
  table: string,
  column: string,
): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from information_schema.columns
     where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [table, column],
  );
  return r.rows[0].n > 0;
}

describe("migration 0011 — enums rebuilt", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb();
  });

  it("market_status has only open/closed/resolved/voided", async () => {
    expect((await enumValues(db, "market_status")).sort()).toEqual(
      ["closed", "open", "resolved", "voided"].sort(),
    );
  });

  it("mod_action_type collapses resolve_yes/resolve_no to resolve", async () => {
    const vals = await enumValues(db, "mod_action_type");
    expect(vals).toContain("resolve");
    expect(vals).not.toContain("resolve_yes");
    expect(vals).not.toContain("resolve_no");
  });

  it("drops the bet_side enum entirely", async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_type where typname = 'bet_side'",
    );
    expect(r.rows[0].n).toBe(0);
  });
});

describe("migration 0011 — legacy columns dropped", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb();
  });

  it("drops markets.yes_pool / no_pool", async () => {
    expect(await columnExists(db, "markets", "yes_pool")).toBe(false);
    expect(await columnExists(db, "markets", "no_pool")).toBe(false);
  });

  it("drops bets.side and adds bets.outcome_id NOT NULL", async () => {
    expect(await columnExists(db, "bets", "side")).toBe(false);
    expect(await columnExists(db, "bets", "outcome_id")).toBe(true);
    const r = await db.query<{ nullable: string }>(
      `select is_nullable as nullable from information_schema.columns
       where table_name = 'bets' and column_name = 'outcome_id'`,
    );
    expect(r.rows[0].nullable).toBe("NO");
  });

  it("drops price_history yes/no columns and adds outcome_id", async () => {
    expect(await columnExists(db, "price_history", "implied_yes")).toBe(false);
    expect(await columnExists(db, "price_history", "yes_pool")).toBe(false);
    expect(await columnExists(db, "price_history", "outcome_id")).toBe(true);
  });

  it("adds markets.winning_outcome_id and mod_actions.outcome_id", async () => {
    expect(await columnExists(db, "markets", "winning_outcome_id")).toBe(true);
    expect(await columnExists(db, "mod_actions", "outcome_id")).toBe(true);
  });
});

describe("migration 0011 — market_outcomes constraints", () => {
  let db: PGlite;
  let uid: string;
  const future = (d: number) =>
    new Date(Date.now() + d * 86_400_000).toISOString();

  beforeEach(async () => {
    db = await bootTestDb();
    uid = await createUser(db);
    await db.exec(`set test.uid = '${uid}'`);
  });

  async function makeMarket(): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.markets
         (creator_id, title, category, resolution_criteria, close_at, resolve_at)
       values ($1, 'A sufficiently long market title', 'campus',
               'Resolution criteria long enough to pass.', $2, $3)
       returning id`,
      [uid, future(1), future(2)],
    );
    return r.rows[0].id;
  }

  it("rejects a bet whose outcome belongs to another market (composite FK)", async () => {
    const m1 = await makeMarket();
    const m2 = await makeMarket();
    const o2 = await db.query<{ id: string }>(
      `insert into public.market_outcomes (market_id, label, sort_order)
       values ($1, 'Foreign', 0) returning id`,
      [m2],
    );
    const bettor = await createUser(db);
    await expect(
      db.query(
        `insert into public.bets (market_id, user_id, outcome_id, amount, price_at_bet)
         values ($1, $2, $3, 10, 50)`,
        [m1, bettor, o2.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("rejects a case-insensitive duplicate label within a market", async () => {
    const m = await makeMarket();
    await db.query(
      `insert into public.market_outcomes (market_id, label, sort_order)
       values ($1, 'Yes', 0)`,
      [m],
    );
    await expect(
      db.query(
        `insert into public.market_outcomes (market_id, label, sort_order)
         values ($1, '  yes ', 1)`,
        [m],
      ),
    ).rejects.toThrow();
  });

  it("rejects a label longer than 40 characters", async () => {
    const m = await makeMarket();
    await expect(
      db.query(
        `insert into public.market_outcomes (market_id, label, sort_order)
         values ($1, $2, 0)`,
        [m, "x".repeat(41)],
      ),
    ).rejects.toThrow();
  });

  it("forbids deleting an outcome that would leave fewer than 2", async () => {
    const m = await makeMarket();
    const ids = await db.query<{ id: string }>(
      `insert into public.market_outcomes (market_id, label, sort_order)
       values ($1, 'A', 0), ($1, 'B', 1) returning id`,
      [m],
    );
    await expect(
      db.query("delete from public.market_outcomes where id = $1", [
        ids.rows[0].id,
      ]),
    ).rejects.toThrow();
  });
});

describe("migration 0011 — realtime, cron, RLS wiring", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb();
  });

  it("adds market_outcomes to the supabase_realtime publication", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'market_outcomes'`,
    );
    expect(r.rows[0].n).toBe(1);
  });

  it("rewrites the snapshot cron to read market_outcomes, not yes_pool", async () => {
    const r = await db.query<{ command: string }>(
      "select command from cron.job where jobname = 'snapshot-price-history'",
    );
    expect(r.rows[0].command).toMatch(/market_outcomes/);
    expect(r.rows[0].command).not.toMatch(/yes_pool/);
  });

  it("has a select RLS policy on market_outcomes referencing markets visibility", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies
       where schemaname = 'public' and tablename = 'market_outcomes' and cmd = 'SELECT'`,
    );
    expect(r.rows[0].n).toBeGreaterThan(0);
  });

  it("revokes the direct markets INSERT RLS policy (create_market is the only path)", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies
       where schemaname = 'public' and tablename = 'markets' and cmd = 'INSERT'`,
    );
    expect(r.rows[0].n).toBe(0);
  });
});

describe("migration 0011 — W3 hardening", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb();
  });

  it("W3: drops the legacy price_history_market_recorded_idx (market_id, recorded_at)", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_indexes
       where tablename = 'price_history' and indexname = 'price_history_market_recorded_idx'`,
    );
    expect(r.rows[0].n).toBe(0);
  });

  it("W3: verification block passes vacuously at zero rows (safe for new environments)", async () => {
    const freshDb = await bootTestDb(10);
    await expect(
      applyMigration(freshDb, "0011_multi_outcome_engine.sql"),
    ).resolves.not.toThrow();
  });
});
