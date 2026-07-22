// E-6 / S6-2 - observability fixtures (0012): scheduled verify_ledger_invariant
// writing to a human-checked table (REC-16), cron-health check flagging failed
// runs in 24h (REC-18), and the price_history growth metric (A-3/R-3).

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb } from "./harness";

describe("migration 0012 - scheduled ledger invariant (REC-16)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb(12);
  });

  it("schedules a verify-ledger cron job that records into ledger_checks", async () => {
    const job = await db.query<{ command: string; schedule: string }>(
      "select command, schedule from cron.job where jobname = 'verify-ledger'",
    );
    expect(job.rows).toHaveLength(1);
    expect(job.rows[0].command).toContain("verify_ledger_invariant");
    expect(job.rows[0].command).toContain("ledger_checks");
  });

  it("the verify-ledger job body inserts a balanced result a human can read", async () => {
    const job = await db.query<{ command: string }>(
      "select command from cron.job where jobname = 'verify-ledger'",
    );
    await db.exec(job.rows[0].command);

    const rows = await db.query<{
      balanced: boolean;
      delta: number;
      detail: Record<string, unknown>;
    }>("select balanced, delta, detail from public.ledger_checks");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].balanced).toBe(true);
    expect(rows.rows[0].delta).toBe(0);
    expect(rows.rows[0].detail).toHaveProperty("user_tx");
  });

  it("locks ledger_checks behind RLS with no client policies", async () => {
    const cls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.ledger_checks'::regclass",
    );
    expect(cls.rows[0].relrowsecurity).toBe(true);

    const pol = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_policies where tablename = 'ledger_checks'",
    );
    expect(pol.rows[0].n).toBe(0);
  });

  it("lets the service role call verify_ledger_invariant (ops + seed scripts)", async () => {
    const r = await db.query<{ ok: boolean }>(
      "select has_function_privilege('service_role', 'public.verify_ledger_invariant()', 'execute') as ok",
    );
    expect(r.rows[0].ok).toBe(true);
  });
});

describe("migration 0012 - cron health check (REC-18)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb(12);
  });

  it("flags failed runs of the tracked jobs within the last 24h", async () => {
    await db.exec(`
      insert into cron.job_run_details (jobid, status, return_message, start_time)
      values
        (1, 'failed', 'column yes_pool does not exist', now() - interval '1 hour'),
        (1, 'succeeded', 'OK', now() - interval '2 hours'),
        (2, 'failed', 'old failure outside the window', now() - interval '2 days')
    `);

    const r = await db.query<{
      jobid: number;
      failed_runs: number;
      last_message: string;
    }>("select * from public.check_cron_health()");

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].jobid).toBe(1);
    expect(r.rows[0].failed_runs).toBe(1);
    expect(r.rows[0].last_message).toContain("yes_pool");
  });

  it("is not callable by authenticated clients (ops-only)", async () => {
    const r = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated', 'public.check_cron_health()', 'execute') as ok",
    );
    expect(r.rows[0].ok).toBe(false);
  });
});

describe("migration 0012 - price_history growth metric (A-3/R-3)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bootTestDb(12);
  });

  it("reports total rows, recent rows, size, and the revisit threshold", async () => {
    const r = await db.query<{ g: {
      total_rows: number;
      rows_last_24h: number;
      table_bytes: number;
      revisit_threshold_rows: number;
    } }>("select public.price_history_growth() as g");

    const g = r.rows[0].g;
    expect(g.total_rows).toBe(0);
    expect(g.rows_last_24h).toBe(0);
    expect(g.table_bytes).toBeGreaterThanOrEqual(0);
    expect(g.revisit_threshold_rows).toBeGreaterThan(0);
  });

  it("counts rows inserted in the window", async () => {
    // Seed a market + outcomes directly to hang history rows off of.
    const u = await db.query<{ id: string }>(
      "insert into auth.users (email) values ('ph@northeastern.edu') returning id",
    );
    const m = await db.query<{ id: string }>(
      `insert into public.markets (creator_id, title, category, resolution_criteria, close_at, resolve_at)
       values ($1, 'A market for the growth metric', 'campus', 'Resolves when the outcome is officially confirmed.', now() + interval '1 day', now() + interval '2 days')
       returning id`,
      [u.rows[0].id],
    );
    const o = await db.query<{ id: string }>(
      `insert into public.market_outcomes (market_id, label, sort_order, pool)
       values ($1, 'Yes', 0, 100), ($1, 'No', 1, 100) returning id`,
      [m.rows[0].id],
    );
    await db.exec(
      `insert into public.price_history (market_id, outcome_id, implied, pool)
       values ('${m.rows[0].id}', '${o.rows[0].id}', 50, 100),
              ('${m.rows[0].id}', '${o.rows[1].id}', 50, 100)`,
    );

    const r = await db.query<{ g: { total_rows: number; rows_last_24h: number } }>(
      "select public.price_history_growth() as g",
    );
    expect(r.rows[0].g.total_rows).toBe(2);
    expect(r.rows[0].g.rows_last_24h).toBe(2);
  });
});
