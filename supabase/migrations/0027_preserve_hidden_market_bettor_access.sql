-- 0027 · Preserve bettor access when a market is hidden
--
-- Admin hide-only moderation removes a market from public discovery without
-- voiding its live bets. Bettors must retain read access to that financially
-- material position until staff resolve or void it.

drop policy if exists "markets: visible unless hidden or pending"
  on public.markets;

create policy "markets: visible unless hidden or pending"
  on public.markets for select to authenticated
  using (
    (hidden = false and status::text not in ('pending', 'rejected'))
    or public.is_staff()
    or creator_id = (select auth.uid())
    or exists (
      select 1
      from public.bets b
      where b.market_id = markets.id
        and b.user_id = (select auth.uid())
    )
  );

drop policy if exists "market_outcomes: visible with parent market"
  on public.market_outcomes;

create policy "market_outcomes: visible with parent market"
  on public.market_outcomes for select to authenticated
  using (
    exists (
      select 1
      from public.markets m
      where m.id = market_outcomes.market_id
        and (
          (m.hidden = false and m.status::text not in ('pending', 'rejected'))
          or public.is_staff()
          or m.creator_id = (select auth.uid())
          or exists (
            select 1
            from public.bets b
            where b.market_id = m.id
              and b.user_id = (select auth.uid())
          )
        )
    )
  );
