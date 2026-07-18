-- Phase 2 · 0001 — Enums, tables, indexes
-- All money columns are integer (whole HuskyCoin), all times timestamptz.

create extension if not exists btree_gist with schema extensions;

-- ── Enums ────────────────────────────────────────────────────────────────

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.display_mode as enum ('real', 'anon');
create type public.market_status as enum
  ('open', 'closed', 'resolved_yes', 'resolved_no', 'voided');
create type public.market_category as enum
  ('campus', 'transit', 'weather', 'sports', 'academics', 'dining', 'wildcard');
create type public.bet_side as enum ('yes', 'no');
create type public.tx_type as enum
  ('signup_grant', 'daily_bonus', 'bailout', 'bet_place', 'bet_payout',
   'vig_burn', 'market_refund');
create type public.report_status as enum ('open', 'dismissed', 'actioned');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.mod_action_type as enum
  ('resolve_yes', 'resolve_no', 'void', 'lock', 'report_dismiss',
   'report_action', 'hide', 'mod_revoke');

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  real_name    text,
  anon_handle  text not null unique,
  display_mode public.display_mode not null default 'anon',
  role         public.user_role not null default 'user',
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Pools cache includes the 100/100 house seed; only place_bet (Phase 3)
-- ever mutates them.
create table public.markets (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references public.profiles (id),
  title               text not null
    check (char_length(title) between 10 and 120),
  description         text,
  category            public.market_category not null,
  resolution_criteria text not null
    check (char_length(resolution_criteria) >= 20),
  close_at            timestamptz not null,
  resolve_at          timestamptz not null,
  status              public.market_status not null default 'open',
  yes_pool            integer not null default 100,
  no_pool             integer not null default 100,
  hidden              boolean not null default false,
  auto_flagged        boolean not null default false,
  resolved_by         uuid references public.profiles (id),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint markets_resolve_after_close check (resolve_at >= close_at)
);

create table public.bets (
  id           uuid primary key default gen_random_uuid(),
  market_id    uuid not null references public.markets (id),
  user_id      uuid not null references public.profiles (id),
  side         public.bet_side not null,
  amount       integer not null check (amount > 0),
  price_at_bet integer not null,
  created_at   timestamptz not null default now()
);

-- Append-only ledger. Sum(amount) per user is the balance.
-- vig_burn rows are house burns and carry no user; everything else must.
create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id),
  type       public.tx_type not null,
  amount     integer not null,
  market_id  uuid references public.markets (id),
  bet_id     uuid references public.bets (id),
  day_key    date,
  created_at timestamptz not null default now(),
  constraint transactions_vig_burn_userless
    check ((type = 'vig_burn') = (user_id is null))
);

create table public.price_history (
  id          bigserial primary key,
  market_id   uuid not null references public.markets (id),
  implied_yes integer not null,
  yes_pool    integer not null,
  no_pool     integer not null,
  recorded_at timestamptz not null default now()
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets (id),
  reporter_id uuid not null references public.profiles (id),
  reason      text not null,
  status      public.report_status not null default 'open',
  handled_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.mod_applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id),
  statement   text not null,
  status      public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.mod_actions (
  id             uuid primary key default gen_random_uuid(),
  moderator_id   uuid not null references public.profiles (id),
  action         public.mod_action_type not null,
  market_id      uuid references public.markets (id),
  target_user_id uuid references public.profiles (id),
  note           text,
  created_at     timestamptz not null default now()
);

create table public.semesters (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  constraint semesters_ends_after_starts check (ends_at > starts_at),
  constraint semesters_no_overlap exclude using gist
    (tstzrange(starts_at, ends_at, '[)') with &&)
);

create table public.hall_of_fame (
  id                    uuid primary key default gen_random_uuid(),
  semester_id           uuid not null references public.semesters (id),
  rank                  integer not null,
  user_id               uuid not null references public.profiles (id),
  display_name_snapshot text not null,
  score                 integer not null,
  unique (semester_id, rank)
);

-- ── Append-only enforcement on the ledger ────────────────────────────────

create function public.transactions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'transactions are append-only';
end;
$$;

create trigger transactions_append_only
  before update or delete on public.transactions
  for each row execute function public.transactions_append_only();

-- ── Indexes ──────────────────────────────────────────────────────────────

create index bets_market_created_idx on public.bets (market_id, created_at desc);
create index bets_user_idx on public.bets (user_id);
create index bets_market_user_idx on public.bets (market_id, user_id);

create index transactions_user_created_idx
  on public.transactions (user_id, created_at);
create index transactions_market_idx on public.transactions (market_id);
-- One daily bonus per ET day, one bailout per ET week (day_key = ET Monday).
create unique index transactions_daily_bonus_once
  on public.transactions (user_id, day_key) where (type = 'daily_bonus');
create unique index transactions_bailout_once
  on public.transactions (user_id, day_key) where (type = 'bailout');

-- A user can have at most one application in flight.
create unique index mod_applications_one_pending
  on public.mod_applications (user_id) where (status = 'pending');

create index price_history_market_recorded_idx
  on public.price_history (market_id, recorded_at);

create index markets_status_close_idx on public.markets (status, close_at);
create index markets_category_idx on public.markets (category);

create index reports_status_idx on public.reports (status);
