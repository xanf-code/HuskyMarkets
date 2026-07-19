-- Phase 5 · 0007 — Leaderboards & profile stats
-- (phase5.md said 0006_leaderboards.sql; 0006 was taken by market_engine.)
-- Semester-scoped scores, accuracy board, hall-of-fame freeze, profile strip.

-- ── Current semester ─────────────────────────────────────────────────────

create function public.get_current_semester()
returns setof public.semesters
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.semesters s
  where now() >= s.starts_at and now() < s.ends_at
  limit 1;
$$;

-- ── Semester leaderboard ─────────────────────────────────────────────────
-- Score = 1000 + Σ(tx.amount) where type <> signup_grant, within the window.
-- Eligibility: ≥1 bet_place in window. Hidden for the current ET bailout week.

create function public.get_semester_leaderboard(
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
    cross join sem
    where t.type = 'bet_place'
      and t.created_at >= sem.starts_at
      and t.created_at < sem.ends_at
      and t.user_id is not null
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

-- ── Accuracy leaderboard ─────────────────────────────────────────────────
-- Markets resolved in-window; win = side matches outcome; ≥10 resolved bets;
-- rank by win rate, ties by volume (total stake on resolved bets).

create function public.get_accuracy_leaderboard(p_semester_id uuid)
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
      case
        when m.status = 'resolved_yes' and b.side = 'yes' then true
        when m.status = 'resolved_no' and b.side = 'no' then true
        else false
      end as won
    from public.bets b
    join public.markets m on m.id = b.market_id
    cross join sem
    where m.status in ('resolved_yes', 'resolved_no')
      and m.resolved_at is not null
      and m.resolved_at >= sem.starts_at
      and m.resolved_at < sem.ends_at
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

-- ── Profile stats ────────────────────────────────────────────────────────

create function public.get_profile_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_biggest_win integer;
  v_worst_loss integer;
  v_streak integer := 0;
  v_direction integer := 0; -- +1 win streak, -1 loss streak
  r record;
begin
  select coalesce(max(t.amount), 0) into v_biggest_win
  from public.transactions t
  where t.user_id = p_user and t.type = 'bet_payout';

  -- Worst loss: largest losing-side stake on a resolved market (per market).
  select coalesce(max(lost.stake), 0) into v_worst_loss
  from (
    select b.market_id, sum(b.amount)::integer as stake
    from public.bets b
    join public.markets m on m.id = b.market_id
    where b.user_id = p_user
      and m.status in ('resolved_yes', 'resolved_no')
      and (
        (m.status = 'resolved_yes' and b.side = 'no')
        or (m.status = 'resolved_no' and b.side = 'yes')
      )
    group by b.market_id
  ) lost;

  -- Current streak: walk resolved markets newest-first; consecutive wins
  -- (positive) or losses (negative) from the most recent result.
  for r in
    select
      case
        when m.status = 'resolved_yes' and exists (
          select 1 from public.bets b
          where b.market_id = m.id and b.user_id = p_user and b.side = 'yes'
        ) then 1
        when m.status = 'resolved_no' and exists (
          select 1 from public.bets b
          where b.market_id = m.id and b.user_id = p_user and b.side = 'no'
        ) then 1
        else -1
      end as result
    from public.markets m
    where m.status in ('resolved_yes', 'resolved_no')
      and m.resolved_at is not null
      and exists (
        select 1 from public.bets b
        where b.market_id = m.id and b.user_id = p_user
      )
    order by m.resolved_at desc
  loop
    if v_direction = 0 then
      v_direction := r.result;
      v_streak := r.result;
    elsif r.result = v_direction then
      v_streak := v_streak + r.result;
    else
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'biggest_win', v_biggest_win,
    'worst_loss', v_worst_loss,
    'current_streak', v_streak
  );
end;
$$;

-- ── Hall of fame freeze (admin-only) ─────────────────────────────────────

create function public.snapshot_semester(p_semester_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if not exists (select 1 from public.semesters s where s.id = p_semester_id) then
    raise exception 'semester not found';
  end if;

  delete from public.hall_of_fame where semester_id = p_semester_id;

  insert into public.hall_of_fame (semester_id, rank, user_id, display_name_snapshot, score)
  select
    p_semester_id,
    lb.rank,
    lb.user_id,
    lb.display_name,
    lb.score
  from public.get_semester_leaderboard(p_semester_id, 10) lb;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Grant discipline ─────────────────────────────────────────────────────

revoke execute on function public.get_current_semester() from public, anon;
revoke execute on function public.get_semester_leaderboard(uuid, integer)
  from public, anon;
revoke execute on function public.get_accuracy_leaderboard(uuid)
  from public, anon;
revoke execute on function public.get_profile_stats(uuid) from public, anon;
revoke execute on function public.snapshot_semester(uuid) from public, anon;

grant execute on function public.get_current_semester() to authenticated;
grant execute on function public.get_semester_leaderboard(uuid, integer)
  to authenticated;
grant execute on function public.get_accuracy_leaderboard(uuid)
  to authenticated;
grant execute on function public.get_profile_stats(uuid) to authenticated;
grant execute on function public.snapshot_semester(uuid) to authenticated;
