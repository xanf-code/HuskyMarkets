// E-1 / S1-2 - destructive backfill of legacy binary markets onto the
// N-outcome model. Seed legacy state through 0010, apply 0011, assert the
// rewrite is lossless (FR-31/FR-32, AR-6, REC-6).

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, applyMigration, createUser, createAdmin } from "./harness";

const CREATED = "2026-01-02T03:04:05.000Z";
const SNAP = "2026-01-03T10:00:00.000Z";

interface Seeded {
  admin: string;
  u1: string;
  u2: string;
  open: string;
  resolvedYes: string;
  resolvedNo: string;
  voided: string;
}

async function seedLegacy(db: PGlite): Promise<Seeded> {
  const admin = await createAdmin(db);
  const u1 = await createUser(db);
  const u2 = await createUser(db);

  async function market(
    status: string,
    yes: number,
    no: number,
    resolved: boolean,
  ): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.markets
         (creator_id, title, category, resolution_criteria, close_at, resolve_at,
          status, yes_pool, no_pool, created_at, resolved_at, resolved_by)
       values ($1, 'A sufficiently long market title', 'campus',
               'Resolution criteria long enough here.',
               now() + interval '1 day', now() + interval '2 day',
               $2::public.market_status, $3, $4, $5::timestamptz,
               $6, $7)
       returning id`,
      [
        admin,
        status,
        yes,
        no,
        CREATED,
        resolved ? CREATED : null,
        resolved ? admin : null,
      ],
    );
    return r.rows[0].id;
  }

  const open = await market("open", 250, 150, false);
  const resolvedYes = await market("resolved_yes", 300, 100, true);
  const resolvedNo = await market("resolved_no", 100, 400, true);
  const voided = await market("voided", 100, 100, false);

  // Bets on the open market: a YES bet and a NO bet. price_at_bet is stored as
  // the implied-YES price at bet time regardless of side (legacy behavior).
  await db.query(
    `insert into public.bets (market_id, user_id, side, amount, price_at_bet)
     values ($1, $2, 'yes', 50, 60), ($1, $3, 'no', 30, 70)`,
    [open, u1, u2],
  );

  // A price snapshot on the open market.
  await db.query(
    `insert into public.price_history (market_id, implied_yes, yes_pool, no_pool, recorded_at)
     values ($1, 62, 250, 150, $2::timestamptz)`,
    [open, SNAP],
  );

  // Legacy audit rows for the resolutions.
  await db.query(
    `insert into public.mod_actions (moderator_id, action, market_id)
     values ($1, 'resolve_yes', $2), ($1, 'resolve_no', $3)`,
    [admin, resolvedYes, resolvedNo],
  );

  return { admin, u1, u2, open, resolvedYes, resolvedNo, voided };
}

describe("migration 0011 - backfill", () => {
  let db: PGlite;
  let s: Seeded;
  beforeEach(async () => {
    db = await bootTestDb(10);
    s = await seedLegacy(db);
    await applyMigration(db, "0011_multi_outcome_engine.sql");
  });

  it("creates Yes(0)=yes_pool and No(1)=no_pool per market, inheriting created_at", async () => {
    const r = await db.query<{
      label: string;
      sort_order: number;
      pool: number;
      created_at: string;
    }>(
      `select label, sort_order, pool, created_at
       from public.market_outcomes where market_id = $1 order by sort_order`,
      [s.open],
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ label: "Yes", sort_order: 0, pool: 250 });
    expect(r.rows[1]).toMatchObject({ label: "No", sort_order: 1, pool: 150 });
    expect(new Date(r.rows[0].created_at).toISOString()).toBe(CREATED);
  });

  it("maps each bet to the matching outcome", async () => {
    const r = await db.query<{ label: string; amount: number }>(
      `select o.label, b.amount
       from public.bets b join public.market_outcomes o on o.id = b.outcome_id
       where b.market_id = $1 order by b.amount desc`,
      [s.open],
    );
    expect(r.rows).toEqual([
      { label: "Yes", amount: 50 },
      { label: "No", amount: 30 },
    ]);
  });

  it("complements price_at_bet for legacy NO bets (AR-6), leaves YES bets", async () => {
    const r = await db.query<{ label: string; price_at_bet: number }>(
      `select o.label, b.price_at_bet
       from public.bets b join public.market_outcomes o on o.id = b.outcome_id
       where b.market_id = $1`,
      [s.open],
    );
    const byLabel = Object.fromEntries(r.rows.map((x) => [x.label, x.price_at_bet]));
    expect(byLabel.Yes).toBe(60); // unchanged
    expect(byLabel.No).toBe(30); // 100 - 70
  });

  it("splits each price_history row into per-outcome rows sharing recorded_at", async () => {
    const r = await db.query<{
      label: string;
      implied: number;
      pool: number;
      recorded_at: string;
    }>(
      `select o.label, ph.implied, ph.pool, ph.recorded_at
       from public.price_history ph join public.market_outcomes o on o.id = ph.outcome_id
       where ph.market_id = $1 order by o.sort_order`,
      [s.open],
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ label: "Yes", implied: 62, pool: 250 });
    expect(r.rows[1]).toMatchObject({ label: "No", implied: 38, pool: 150 }); // 100-62
    expect(new Date(r.rows[0].recorded_at).toISOString()).toBe(SNAP);
    expect(new Date(r.rows[1].recorded_at).toISOString()).toBe(SNAP);
  });

  it("sets winning_outcome_id and collapses status to resolved", async () => {
    const yes = await db.query<{ status: string; label: string }>(
      `select m.status::text, o.label
       from public.markets m join public.market_outcomes o on o.id = m.winning_outcome_id
       where m.id = $1`,
      [s.resolvedYes],
    );
    expect(yes.rows[0]).toMatchObject({ status: "resolved", label: "Yes" });

    const no = await db.query<{ status: string; label: string }>(
      `select m.status::text, o.label
       from public.markets m join public.market_outcomes o on o.id = m.winning_outcome_id
       where m.id = $1`,
      [s.resolvedNo],
    );
    expect(no.rows[0]).toMatchObject({ status: "resolved", label: "No" });
  });

  it("keeps voided markets voided with no winner", async () => {
    const r = await db.query<{ status: string; w: string | null }>(
      "select status::text, winning_outcome_id as w from public.markets where id = $1",
      [s.voided],
    );
    expect(r.rows[0]).toMatchObject({ status: "voided", w: null });
  });

  it("backfills mod_actions.outcome_id and maps action to resolve", async () => {
    const r = await db.query<{ action: string; label: string }>(
      `select a.action::text, o.label
       from public.mod_actions a join public.market_outcomes o on o.id = a.outcome_id
       where a.market_id = $1`,
      [s.resolvedYes],
    );
    expect(r.rows[0]).toMatchObject({ action: "resolve", label: "Yes" });
  });
});

describe("migration 0011 - loud failure on verification mismatch", () => {
  it("rolls back the whole migration if a stake-sum check is corrupted", async () => {
    const db = await bootTestDb(10);
    await seedLegacy(db);

    // Splice a corrupting statement into the migration right before the
    // verification block: silently drop a bet after backfill so the
    // stake-sum verification must catch the mismatch and abort.
    const { readMigration } = await import("./harness");
    const sql = readMigration("0011_multi_outcome_engine.sql");
    const marker = "-- >>> VERIFY <<<";
    expect(sql).toContain(marker); // migration must expose the splice point
    const corrupted = sql.replace(
      marker,
      "delete from public.bets where amount = 50;\n" + marker,
    );

    const { applyMigrationSql } = await import("./harness");
    await expect(applyMigrationSql(db, corrupted)).rejects.toThrow();

    // Rolled back cleanly: legacy schema untouched, no market_outcomes table.
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
       where table_schema = 'public' and table_name = 'market_outcomes'`,
    );
    expect(r.rows[0].n).toBe(0);
    const legacy = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.columns
       where table_name = 'markets' and column_name = 'yes_pool'`,
    );
    expect(legacy.rows[0].n).toBe(1); // yes_pool still there
  });
});
