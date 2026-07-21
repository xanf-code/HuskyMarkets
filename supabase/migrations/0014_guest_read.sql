-- ════════════════════════════════════════════════════════════════════════
-- 0014: Guest (anon) read access
--
-- Guests may browse the homepage and market pages without signing in, so the
-- anon role needs read on exactly what those pages render: visible markets,
-- their outcomes, their price history, creator display names (via the
-- security-definer public_profiles projection), and the share-card RPC used
-- for OG metadata.
--
-- NOT granted here: bets, transactions, semesters, hall_of_fame, leaderboard
-- RPCs, get_my_balance, place_bet. Activity and leaderboards stay dark for
-- guests at the DB layer, realtime included (postgres_changes applies RLS
-- per subscriber: anon sockets see market/price events, never bets INSERTs).
-- ════════════════════════════════════════════════════════════════════════

-- Table-level grants (0005 hardening revoked implicit defaults).
grant select on public.markets to anon;
grant select on public.market_outcomes to anon;
grant select on public.price_history to anon;

-- Guests see only non-hidden markets (no staff/creator exceptions — anon
-- has no uid and is never staff).
create policy "markets: anon read visible"
  on public.markets for select to anon
  using (hidden = false);

-- Outcomes readable iff the parent market is visible to a guest.
create policy "market_outcomes: anon read with parent market"
  on public.market_outcomes for select to anon
  using (
    exists (
      select 1 from public.markets m
      where m.id = market_outcomes.market_id
        and m.hidden = false
    )
  );

-- Sparklines and the probability chart read price history.
create policy "price_history: anon read with parent market"
  on public.price_history for select to anon
  using (
    exists (
      select 1 from public.markets m
      where m.id = price_history.market_id
        and m.hidden = false
    )
  );

-- Creator display name on the market page. The view is a security-definer
-- projection exposing only id / display_name / role (0002).
grant select on public.public_profiles to anon;

-- OG metadata for shared market links resolves via this RPC; 0010 granted
-- it to authenticated only, but src/lib/supabase/anon.ts assumes anon can
-- call it. Definer-hardened with search_path = '' (0010/0011).
grant execute on function public.get_market_card(uuid) to anon;
