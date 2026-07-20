-- 0012 — Observability fixtures (E-6 / S6-2).
--
-- The three standing instruments the rollout soak consumes (REC-16, REC-18):
--   1. Scheduled verify_ledger_invariant() whose results land in a
--      human-checked table — a failing check writing to an unread table is
--      not monitoring, so ledger_checks is the ops-canary sink.
--   2. check_cron_health(): any failed run of any cron job in the last 24h
--      (pg_cron failures are silent; they only land in cron.job_run_details).
--   3. price_history_growth(): row-count/size metric for the accepted
--      retention posture (A-3/R-3), with the revisit threshold in writing.

-- ── 1. ledger_checks: human-visible sink for the money canary ────────────────

create table public.ledger_checks (
  id         bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  balanced   boolean not null,
  delta      bigint not null,
  detail     jsonb not null
);

-- No client read path: ops only, via the service role.
alter table public.ledger_checks enable row level security;
revoke all on public.ledger_checks from public, anon, authenticated;
grant select on public.ledger_checks to service_role;

-- Scheduled every 6 hours. Imbalance must surface somewhere a human looks;
-- this table is that place (and the soak checklist reads it).
select cron.schedule(
  'verify-ledger',
  '0 */6 * * *',
  $ct$
    insert into public.ledger_checks (balanced, delta, detail)
    select (v ->> 'balanced')::boolean, (v ->> 'delta')::bigint, v
    from (select public.verify_ledger_invariant() as v) s
  $ct$
);

-- ── 2. check_cron_health() (REC-18) ──────────────────────────────────────────
-- Failed runs of any cron job in the last 24h. pg_cron failures never raise;
-- this is the query the ops checklist runs to notice them.

create function public.check_cron_health()
returns table (
  jobid bigint,
  failed_runs bigint,
  last_failure timestamptz,
  last_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.jobid,
    count(*)::bigint as failed_runs,
    max(d.start_time) as last_failure,
    (array_agg(d.return_message order by d.start_time desc))[1] as last_message
  from cron.job_run_details d
  where d.status = 'failed'
    and d.start_time > now() - interval '24 hours'
  group by d.jobid;
$$;

-- ── 3. price_history_growth() (A-3/R-3) ──────────────────────────────────────
-- N-outcome snapshots multiply row volume (up to 6 rows/snapshot/market vs 2).
-- Retention is accepted and monitored, not thinned — REVISIT retention when
-- total_rows passes 5,000,000 or table_bytes passes 1 GB.

create function public.price_history_growth()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total_rows', (select count(*) from public.price_history),
    'rows_last_24h', (select count(*) from public.price_history
                      where recorded_at > now() - interval '24 hours'),
    'table_bytes', pg_total_relation_size('public.price_history'),
    'revisit_threshold_rows', 5000000,
    'revisit_threshold_bytes', 1073741824
  );
$$;

-- ── 4. Grant discipline (0005 convention) ────────────────────────────────────
-- Ops functions: no client surface. verify_ledger_invariant stays blocked for
-- clients but must be callable by the service role (ops scripts, seed-bets
-- assertion, and the cron body above run outside the authenticated role).

revoke execute on function public.check_cron_health() from public, anon, authenticated;
revoke execute on function public.price_history_growth() from public, anon, authenticated;

grant execute on function public.check_cron_health() to service_role;
grant execute on function public.price_history_growth() to service_role;
grant execute on function public.verify_ledger_invariant() to service_role;

-- REC-17 snapshot/reconciliation scripts run as the service role; the board
-- and stats RPCs are otherwise authenticated-only (0007).
grant execute on function public.get_current_semester() to service_role;
grant execute on function public.get_semester_leaderboard(uuid, integer) to service_role;
-- W2: 0011 replaced the 1-arg overloads with 2-arg defaults; grant accordingly.
grant execute on function public.get_accuracy_leaderboard(uuid, timestamptz) to service_role;
grant execute on function public.get_profile_stats(uuid, timestamptz) to service_role;
