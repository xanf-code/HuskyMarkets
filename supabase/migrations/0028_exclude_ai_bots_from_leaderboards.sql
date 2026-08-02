-- 0028 · Keep automated traders out of user leaderboards
--
-- AI traders are provisioned as ordinary authenticated users so they can call
-- place_bet. Without an explicit marker, their automated bets make them
-- eligible for the prize-bearing semester board, accuracy board, and Hall of
-- Fame snapshots.

alter table public.profiles
  add column is_ai_bot boolean not null default false;

comment on column public.profiles.is_ai_bot is
  'Service-managed marker for automated traders; excluded from user leaderboards.';

-- Existing bots have already recorded their decisions here. Future bots are
-- marked directly by the provisioning script.
update public.profiles p
set is_ai_bot = true
where exists (
  select 1
  from public.ai_trade_log l
  where l.bot_user_id = p.id
);

create or replace function public.get_semester_leaderboard(
  p_semester_id uuid,
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  score integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sem as (
    select s.starts_at, s.ends_at
    from public.semesters s
    where s.id = p_semester_id
  ),
  et_week as (
    select date_trunc('week', now() at time zone 'America/New_York')::date as monday
  ),
  eligible as (
    select distinct t.user_id
    from public.transactions t
    join public.profiles p on p.id = t.user_id and not p.is_ai_bot
    cross join sem
    where t.type = 'bet_place'
      and t.created_at >= sem.starts_at
      and t.created_at < sem.ends_at
  ),
  hidden as (
    select distinct t.user_id
    from public.transactions t
    cross join et_week
    where t.type = 'bailout'
      and t.day_key = et_week.monday
  ),
  scored as (
    select
      e.user_id,
      1000 + coalesce((
        select sum(t.amount)::integer
        from public.transactions t
        cross join sem
        where t.user_id = e.user_id
          and t.type <> 'signup_grant'
          and t.created_at >= sem.starts_at
          and t.created_at < sem.ends_at
      ), 0) as score
    from eligible e
    where not exists (select 1 from hidden h where h.user_id = e.user_id)
  )
  select
    (row_number() over (order by s.score desc, s.user_id))::integer as rank,
    s.user_id,
    pp.display_name,
    s.score
  from scored s
  join public.public_profiles pp on pp.id = s.user_id
  order by s.score desc, s.user_id
  limit greatest(p_limit, 1);
$$;

create or replace function public.get_accuracy_leaderboard(
  p_semester_id uuid,
  p_resolved_before timestamptz default null
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  wins integer,
  losses integer,
  win_rate numeric,
  volume integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sem as (
    select s.starts_at, s.ends_at
    from public.semesters s
    where s.id = p_semester_id
  ),
  resolved as (
    select
      b.user_id,
      b.amount,
      (m.winning_outcome_id = b.outcome_id) as won
    from public.bets b
    join public.profiles p on p.id = b.user_id and not p.is_ai_bot
    join public.markets m on m.id = b.market_id
    cross join sem
    where m.status = 'resolved'
      and m.winning_outcome_id is not null
      and m.resolved_at is not null
      and m.resolved_at >= sem.starts_at
      and m.resolved_at < sem.ends_at
      and (p_resolved_before is null or m.resolved_at < p_resolved_before)
  ),
  agg as (
    select
      r.user_id,
      count(*)::integer as bets,
      count(*) filter (where r.won)::integer as wins,
      count(*) filter (where not r.won)::integer as losses,
      coalesce(sum(r.amount), 0)::integer as volume
    from resolved r
    group by r.user_id
    having count(*) >= 10
  )
  select
    (row_number() over (
      order by (a.wins::numeric / a.bets) desc, a.volume desc, a.user_id
    ))::integer as rank,
    a.user_id,
    pp.display_name,
    a.wins,
    a.losses,
    round(a.wins::numeric / a.bets, 4) as win_rate,
    a.volume
  from agg a
  join public.public_profiles pp on pp.id = a.user_id
  order by win_rate desc, a.volume desc, a.user_id;
$$;
