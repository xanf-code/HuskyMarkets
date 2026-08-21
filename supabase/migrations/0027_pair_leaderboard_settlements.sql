-- ════════════════════════════════════════════════════════════════════════
-- 0027 · Keep semester settlement credits paired with their stakes
--
-- Settlement ledger rows are written when a market resolves. Counting those
-- rows by settlement time gave a user the full gross payout/refund even when
-- the corresponding bet_place debit was outside the semester. Attribute each
-- settlement only to the fraction of the user's stake placed in the semester.
-- ════════════════════════════════════════════════════════════════════════

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
  ordinary_transactions as (
    select t.user_id, sum(t.amount)::bigint as amount
    from public.transactions t
    cross join sem
    where t.type not in ('signup_grant', 'bet_payout', 'market_refund')
      and t.created_at >= sem.starts_at
      and t.created_at < sem.ends_at
      and t.user_id is not null
    group by t.user_id
  ),
  settlement_stakes as (
    select
      t.id,
      t.user_id,
      t.amount,
      coalesce(sum(b.amount) filter (
        where b.created_at >= sem.starts_at
          and b.created_at < sem.ends_at
      ), 0)::bigint as semester_stake,
      sum(b.amount)::bigint as total_stake
    from public.transactions t
    cross join sem
    join public.markets m on m.id = t.market_id
    join public.bets b
      on b.market_id = t.market_id
     and b.user_id = t.user_id
     and (
       t.type = 'market_refund'
       or (t.type = 'bet_payout' and b.outcome_id = m.winning_outcome_id)
     )
    where t.type in ('bet_payout', 'market_refund')
      and t.created_at >= sem.starts_at
      and t.created_at < sem.ends_at
      and t.user_id is not null
    group by t.id, t.user_id, t.amount
  ),
  settlement_credits as (
    select
      ss.user_id,
      sum(floor(
        ss.amount::numeric * ss.semester_stake / nullif(ss.total_stake, 0)
      ))::bigint as amount
    from settlement_stakes ss
    group by ss.user_id
  ),
  scored as (
    select
      e.user_id,
      (
        1000
        + coalesce(ot.amount, 0)
        + coalesce(sc.amount, 0)
      )::integer as score
    from eligible e
    left join ordinary_transactions ot on ot.user_id = e.user_id
    left join settlement_credits sc on sc.user_id = e.user_id
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
