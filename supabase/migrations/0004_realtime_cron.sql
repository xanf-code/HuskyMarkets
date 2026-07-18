-- Phase 2 · 0004 — Realtime, cron jobs, semester seed

-- ── Realtime ─────────────────────────────────────────────────────────────

alter publication supabase_realtime
  add table public.markets, public.bets, public.price_history;

-- Full replica identity so realtime UPDATE payloads carry old + new rows.
alter table public.markets replica identity full;

-- ── Cron ─────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

-- Every 5 minutes: close past-due open markets.
select cron.schedule(
  'close-due-markets',
  '*/5 * * * *',
  $$
    update public.markets
    set status = 'closed'
    where status = 'open' and close_at <= now()
  $$
);

-- Every 15 minutes: snapshot price history for open markets.
-- implied_yes uses the same clamp(round(100·yes/(yes+no)), 1, 99) the
-- Phase 3 betting engine will use.
select cron.schedule(
  'snapshot-price-history',
  '*/15 * * * *',
  $$
    insert into public.price_history (market_id, implied_yes, yes_pool, no_pool)
    select
      m.id,
      least(greatest(round(100.0 * m.yes_pool / (m.yes_pool + m.no_pool))::int, 1), 99),
      m.yes_pool,
      m.no_pool
    from public.markets m
    where m.status = 'open'
  $$
);

-- ── Semester seed (admin-editable later) ─────────────────────────────────

insert into public.semesters (name, starts_at, ends_at)
values
  ('Summer 2026',
   '2026-05-04 00:00:00 America/New_York',
   '2026-08-21 00:00:00 America/New_York'),
  ('Fall 2026',
   '2026-09-09 00:00:00 America/New_York',
   '2026-12-19 00:00:00 America/New_York');
