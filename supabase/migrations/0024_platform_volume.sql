-- ════════════════════════════════════════════════════════════════════════
-- 0024: Platform volume aggregate for the home live counter
--
-- Guests cannot SELECT bets (0014), so expose a security-definer sum that
-- both anon and authenticated may call. Returns all-time stake placed
-- (SUM(bets.amount)), including resolved/voided markets.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.get_platform_volume()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.amount), 0)::integer
  from public.bets b;
$$;

revoke execute on function public.get_platform_volume() from public;
grant execute on function public.get_platform_volume() to anon, authenticated;
