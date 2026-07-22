-- ════════════════════════════════════════════════════════════════════════
-- 0023: Migration B — revoke blanket table write-grants, re-grant minimal
--
-- H2 (continued): removes the existing per-table blanket write grants that
--     0022 only fixed going forward via default-privilege change. After
--     this migration, RLS is no longer the *only* guardrail against client
--     writes — the grants themselves enforce it.
--
-- Minimal direct-write surface re-granted (verified against RLS policies
-- and src/actions/* code):
--
--   authenticated INSERT  → reports          (policy: reports: file own)
--   authenticated INSERT  → mod_applications (policy: mod_applications: apply own)
--   authenticated UPDATE  → profiles (columns: display_mode, email_notifications,
--                                     onboarded, real_name)
--                                    (policy: profiles: update own)
--   authenticated UPDATE  → notifications (column: read_at)
--                                    (policy: notifications: update own read_at)
--
-- Everything else (bets, transactions, markets, market_outcomes,
-- price_history, semesters, hall_of_fame, mod_actions) is mutated
-- exclusively through SECURITY DEFINER RPCs (place_bet, resolve_market,
-- create_market, cron, etc.) and needs no direct table grant.
--
-- anon: no write grant on any table (guests only read via RLS policies).
-- ════════════════════════════════════════════════════════════════════════

-- Strip all existing write grants in one pass, then re-grant minimally.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- ── authenticated minimal write surface ──────────────────────────────────

-- User-submitted reports (RLS enforces reporter_id = auth.uid()).
grant insert on public.reports to authenticated;

-- Mod applications (RLS enforces user_id = auth.uid() and status = pending).
grant insert on public.mod_applications to authenticated;

-- Profile self-edit: only the four user-editable columns.
-- (RLS enforces id = auth.uid() on both USING and WITH CHECK.)
grant update (display_mode, email_notifications, onboarded, real_name)
  on public.profiles to authenticated;

-- Mark notifications read.
-- (RLS enforces user_id = auth.uid() on both USING and WITH CHECK.)
grant update (read_at) on public.notifications to authenticated;

-- SELECT grants are unaffected by the revoke above (only wrote to
-- INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) and remain intact.
