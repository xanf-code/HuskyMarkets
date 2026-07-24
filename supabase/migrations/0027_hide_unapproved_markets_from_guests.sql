-- 0027: Keep moderation-blocked markets out of all public read paths.
--
-- 0019 added pending/rejected visibility rules for authenticated users but
-- left the older anon policies and the security-definer share-card RPC on
-- their pre-approval-gate rules. A guest with a market UUID could therefore
-- read and share content that moderators had not approved.

drop policy if exists "markets: anon read visible" on public.markets;

create policy "markets: anon read approved"
  on public.markets for select to anon
  using (
    hidden = false
    and status::text not in ('pending', 'rejected')
  );

drop policy if exists "market_outcomes: anon read with parent market"
  on public.market_outcomes;

create policy "market_outcomes: anon read with approved parent"
  on public.market_outcomes for select to anon
  using (
    exists (
      select 1
      from public.markets m
      where m.id = market_outcomes.market_id
        and m.hidden = false
        and m.status::text not in ('pending', 'rejected')
    )
  );

drop policy if exists "price_history: anon read with parent market"
  on public.price_history;

create policy "price_history: anon read with approved parent"
  on public.price_history for select to anon
  using (
    exists (
      select 1
      from public.markets m
      where m.id = price_history.market_id
        and m.hidden = false
        and m.status::text not in ('pending', 'rejected')
    )
  );

create or replace function public.get_market_card(p_market_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', m.id,
    'title', m.title,
    'category', m.category,
    'created_at', m.created_at,
    'close_at', m.close_at,
    'status', m.status,
    'outcomes', public._outcome_map(m.id),
    'leading', (
      select json_build_object('label', o.label, 'implied',
               least(greatest(round(100.0 * o.pool /
                 (select sum(pool) from public.market_outcomes where market_id = m.id))::int, 1), 99))
      from public.market_outcomes o
      where o.market_id = m.id
      order by o.pool desc, o.sort_order
      limit 1
    )
  )
  from public.markets m
  where m.id = p_market_id
    and (
      (m.hidden = false and m.status::text not in ('pending', 'rejected'))
      or public.is_staff()
      or m.creator_id = (select auth.uid())
    );
$$;
