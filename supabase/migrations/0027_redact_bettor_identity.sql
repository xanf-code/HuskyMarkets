-- ════════════════════════════════════════════════════════════════════════
-- 0027 · Keep bettor identity private
--
-- Authenticated clients could previously SELECT every bets row (including
-- user_id) and receive raw INSERT payloads through Realtime. Besides exposing
-- who backed each outcome, the leaked bet UUID could be passed to the public
-- share-card RPC to resolve the bettor's display identity.
--
-- Direct reads are now owner-only. Public market activity and aggregate
-- bettor counts remain available through SECURITY DEFINER RPCs that return
-- no user_id and never expose the share-card bearer UUID.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "bets: authenticated read" on public.bets;

create policy "bets: read own"
  on public.bets for select to authenticated
  using (user_id = (select auth.uid()));

-- Raw bets rows are no longer a realtime transport. Market pages refresh the
-- redacted activity RPC when the corresponding market_outcomes row changes.
alter publication supabase_realtime drop table public.bets;

create function public.get_market_activity(
  p_market_id uuid,
  p_limit integer default 20
)
returns table (
  activity_id text,
  outcome_id uuid,
  amount integer,
  price_at_bet integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- Stable UI identity without disclosing the bet UUID used by share links.
    md5(b.id::text) as activity_id,
    b.outcome_id,
    b.amount,
    b.price_at_bet,
    b.created_at
  from public.bets b
  join public.markets m on m.id = b.market_id
  where b.market_id = p_market_id
    and (select auth.uid()) is not null
    and (
      (m.hidden = false and m.status::text not in ('pending', 'rejected'))
      or public.is_staff()
      or m.creator_id = (select auth.uid())
    )
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create function public.get_market_bettor_counts(p_market_ids uuid[])
returns table (
  market_id uuid,
  bettor_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.market_id, count(distinct b.user_id) as bettor_count
  from public.bets b
  join public.markets m on m.id = b.market_id
  where b.market_id = any(coalesce(p_market_ids, array[]::uuid[]))
    and (select auth.uid()) is not null
    and (
      (m.hidden = false and m.status::text not in ('pending', 'rejected'))
      or public.is_staff()
      or m.creator_id = (select auth.uid())
    )
  group by b.market_id;
$$;

revoke execute on function public.get_market_activity(uuid, integer)
  from public, anon;
revoke execute on function public.get_market_bettor_counts(uuid[])
  from public, anon;

grant execute on function public.get_market_activity(uuid, integer)
  to authenticated;
grant execute on function public.get_market_bettor_counts(uuid[])
  to authenticated;
