-- ════════════════════════════════════════════════════════════════════════
-- 0022: Migration A -lock app_config + fix blanket table default grants
--
-- C1: app_config had RLS disabled with anon/authenticated holding full
--     write access (INSERT/UPDATE/DELETE/TRUNCATE). Anyone with the anon
--     key (shipped in client bundle) could rewrite config rows. Fixed by
--     enabling RLS and revoking write grants.
--
-- H2 (root cause): pg_default_acl granted INSERT/UPDATE/DELETE/TRUNCATE
--     to anon/authenticated on every new public table. Only RLS
--     default-deny was blocking writes -correct by accident. Fixed here
--     so future tables start write-locked by default.
--
-- H3: public_profiles SECURITY DEFINER view had stray write grants to
--     authenticated (INSERT/UPDATE/DELETE/TRUNCATE) that serve no purpose.
--     The SELECT projection for guests is intentional and kept.
--
-- M5: ledger_checks has RLS enabled but no policy (linter INFO). The table
--     is cron-written via service_role only; no client role needs access.
--     Revoke all to make the intent explicit.
-- ════════════════════════════════════════════════════════════════════════

-- ── C1: lock app_config ──────────────────────────────────────────────────
-- The app only ever SELECTs this table (create_market reads max_outcomes).
-- All writes are migrations / service_role, which bypass RLS.

alter table public.app_config enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on public.app_config from anon, authenticated;

-- RLS default-deny would also block reads, so add an explicit read policy.
create policy "app_config: read-only"
  on public.app_config for select
  to anon, authenticated
  using (true);

-- ── H2: fix default privileges -stop auto-granting writes on new tables ─
-- Going forward, tables in public start with SELECT-only for client roles.
-- Individual migrations opt back in with explicit GRANTs as needed.

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from authenticated;

-- ── H3: strip stray write grants from public_profiles view ───────────────
-- anon: already SELECT-only -no change needed.
-- authenticated: had full write via blanket default; only SELECT is used.

revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from authenticated;

-- ── M5: make ledger_checks lockdown explicit ─────────────────────────────
revoke all on public.ledger_checks from anon, authenticated;

comment on table public.ledger_checks is
  'Cron-written audit table. No client role access by design (service_role only).';
