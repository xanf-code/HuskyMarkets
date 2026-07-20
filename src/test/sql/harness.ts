// pglite-backed SQL test harness for the Supabase migration stack.
//
// Runs a real Postgres (WASM) in-process — no Docker, no Supabase CLI — so the
// migrations in supabase/migrations/*.sql can be applied and exercised in
// vitest. This is how Epic E-1 (the atomic multi-outcome migration) is tested.
//
// STUBBED / NOT FAITHFULLY REPRESENTED (flagged for real-stack verification):
//   - pg_cron: the `create extension pg_cron` line is stripped and cron.schedule
//     is shimmed to record job bodies in cron.job. Job *bodies* are asserted as
//     text; they are never actually scheduled/run.
//   - RLS as a role boundary: pglite runs as superuser, which bypasses RLS. We
//     assert policy *existence/shape* via pg_policies, not live enforcement.
//   - Realtime delivery: we assert publication membership, not event delivery.
//   - security definer/invoker distinction collapses under a single superuser;
//     auth.uid() is driven by the `test.uid` GUC instead of a real JWT.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

// Minimal Supabase environment the migrations assume exists.
const SHIMS = /* sql */ `
  create schema if not exists auth;
  create schema if not exists cron;
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon')
      then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'authenticated')
      then create role authenticated; end if;
    if not exists (select from pg_roles where rolname = 'service_role')
      then create role service_role; end if;
  end $$;

  create table if not exists auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text
  );

  -- Driven by the test.uid GUC; empty string reads as "not authenticated".
  create or replace function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

  -- pg_cron stand-in: capture scheduled job bodies as inspectable text.
  create table if not exists cron.job (
    jobid    bigserial primary key,
    jobname  text,
    schedule text,
    command  text
  );
  -- Run-history stand-in so check_cron_health() has something to read.
  create table if not exists cron.job_run_details (
    runid          bigserial primary key,
    jobid          bigint,
    status         text,
    return_message text,
    start_time     timestamptz default now(),
    end_time       timestamptz
  );
  -- Mirrors pg_cron's replace-by-name upsert so a rewritten job body swaps in.
  create or replace function cron.schedule(job_name text, schedule text, command text)
    returns bigint language plpgsql as $$
    declare v_id bigint;
    begin
      delete from cron.job where jobname = job_name;
      insert into cron.job (jobname, schedule, command)
      values (job_name, schedule, command)
      returning jobid into v_id;
      return v_id;
    end $$;
  create or replace function cron.unschedule(job_name text)
    returns boolean language sql as $$
      delete from cron.job where jobname = job_name; select true
    $$;

  create publication supabase_realtime;
`;

function fourDigitPrefix(filename: string): number {
  return Number.parseInt(filename.slice(0, 4), 10);
}

export function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Strip constructs pglite cannot run; the shimmed cron schema stands in. */
function preprocess(sql: string): string {
  return sql.replace(/create extension if not exists pg_cron;/g, "");
}

export function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
}

/**
 * Apply one migration file inside a single transaction, mirroring how the
 * Supabase CLI wraps each migration. A mid-file `RAISE EXCEPTION` therefore
 * rolls the whole file back cleanly — which is exactly the atomicity guarantee
 * Epic E-1's one-way-door migration depends on (AD-3).
 */
export async function applyMigration(db: PGlite, filename: string): Promise<void> {
  const sql = preprocess(readMigration(filename));
  await db.exec("begin");
  try {
    await db.exec(sql);
    await db.exec("commit");
  } catch (err) {
    await db.exec("rollback");
    throw err;
  }
}

/**
 * Apply raw SQL as one atomic migration (begin/commit, rollback on error).
 * Used by the atomicity test to feed a deliberately-corrupted variant of 0011
 * and assert the whole thing rolls back.
 */
export async function applyMigrationSql(db: PGlite, sql: string): Promise<void> {
  await db.exec("begin");
  try {
    await db.exec(preprocess(sql));
    await db.exec("commit");
  } catch (err) {
    await db.exec("rollback");
    throw err;
  }
}

/**
 * Boot a fresh in-memory Postgres with the Supabase shims applied and all
 * migrations whose 4-digit prefix is <= `through` (default 12 = the whole
 * stack including 0012). Pass `through: 10` to seed legacy state, then call
 * `applyMigration(db, "0011_multi_outcome_engine.sql")` to test the migration.
 */
export async function bootTestDb(through = 12): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec("create extension if not exists btree_gist;");
  await db.exec(SHIMS);
  for (const file of listMigrations()) {
    if (fourDigitPrefix(file) <= through) {
      await applyMigration(db, file);
    }
  }
  return db;
}

/** Set the acting user for subsequent auth.uid()-dependent calls. */
export async function setUid(db: PGlite, uid: string | null): Promise<void> {
  await db.exec(`set test.uid = '${uid ?? ""}'`);
}

/**
 * Create an auth user (which fires handle_new_user → profile + 1000 HC grant)
 * and return its id. Email must be @northeastern.edu; the admin address gets
 * the admin role, per 0002.
 */
export async function createUser(
  db: PGlite,
  email = `u${crypto.randomUUID().slice(0, 8)}@northeastern.edu`,
): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  return res.rows[0].id;
}

/** Convenience: create the admin user (role = admin via 0002 trigger). */
export async function createAdmin(db: PGlite): Promise<string> {
  return createUser(db, "aswathappa.d@northeastern.edu");
}
