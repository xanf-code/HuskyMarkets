-- Phase 2 · 0005 - Advisor hardening (post-apply lint pass)
-- Fixes: anon/public could execute every security-definer function
-- (lint 0028), and several foreign keys lacked covering indexes (lint 0001).

-- ── Function execute grants ──────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default; strip it and re-grant only
-- the intended signed-in RPC surface.

revoke execute on all functions in schema public from public, anon;

grant execute on function public.get_balance(uuid) to authenticated;
grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.claim_bailout() to authenticated;
grant execute on function public.reroll_anon_handle() to authenticated;

-- Internal-only: run as trigger/definer helpers, never as client RPCs.
revoke execute on function public.gen_anon_handle() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.transactions_append_only() from authenticated;

-- ── Covering indexes for foreign keys ────────────────────────────────────

create index markets_creator_idx on public.markets (creator_id);
create index markets_resolved_by_idx on public.markets (resolved_by);
create index transactions_bet_idx on public.transactions (bet_id);
create index reports_market_idx on public.reports (market_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_handled_by_idx on public.reports (handled_by);
create index mod_applications_reviewed_by_idx
  on public.mod_applications (reviewed_by);
create index mod_actions_moderator_idx on public.mod_actions (moderator_id);
create index mod_actions_market_idx on public.mod_actions (market_id);
create index mod_actions_target_user_idx
  on public.mod_actions (target_user_id);
create index hall_of_fame_user_idx on public.hall_of_fame (user_id);
