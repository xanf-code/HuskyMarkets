-- Phase 2 · 0003 — Row-level security
-- No insert/update policies exist on transactions/bets/price_history or on
-- market state: all money writes go through security-definer functions only.

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.bets enable row level security;
alter table public.transactions enable row level security;
alter table public.price_history enable row level security;
alter table public.reports enable row level security;
alter table public.mod_applications enable row level security;
alter table public.mod_actions enable row level security;
alter table public.semesters enable row level security;
alter table public.hall_of_fame enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────
-- Users may only self-update the columns granted below; email/role/handle
-- are managed by definer functions and the signup trigger.

revoke update on public.profiles from authenticated;
grant update (real_name, display_mode, onboarded)
  on public.profiles to authenticated;

create policy "profiles: select own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── markets ──────────────────────────────────────────────────────────────

create policy "markets: visible unless hidden"
  on public.markets for select to authenticated
  using (
    hidden = false
    or public.is_staff()
    or creator_id = (select auth.uid())
  );

create policy "markets: create own open future market"
  on public.markets for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and status = 'open'
    and close_at > now()
  );

-- ── bets / price_history (read-only to clients) ──────────────────────────

create policy "bets: authenticated read"
  on public.bets for select to authenticated
  using (true);

create policy "price_history: authenticated read"
  on public.price_history for select to authenticated
  using (true);

-- ── transactions ─────────────────────────────────────────────────────────

create policy "transactions: select own or admin"
  on public.transactions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── reports ──────────────────────────────────────────────────────────────

create policy "reports: file own"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "reports: select own or staff"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_staff());

-- ── mod_applications ─────────────────────────────────────────────────────

create policy "mod_applications: apply own"
  on public.mod_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "mod_applications: select own or admin"
  on public.mod_applications for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── mod_actions ──────────────────────────────────────────────────────────

create policy "mod_actions: select admin or own"
  on public.mod_actions for select to authenticated
  using (public.is_admin() or moderator_id = (select auth.uid()));

-- ── semesters / hall_of_fame ─────────────────────────────────────────────

create policy "semesters: authenticated read"
  on public.semesters for select to authenticated
  using (true);

create policy "semesters: admin insert"
  on public.semesters for insert to authenticated
  with check (public.is_admin());

create policy "semesters: admin update"
  on public.semesters for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "semesters: admin delete"
  on public.semesters for delete to authenticated
  using (public.is_admin());

create policy "hall_of_fame: authenticated read"
  on public.hall_of_fame for select to authenticated
  using (true);

create policy "hall_of_fame: admin insert"
  on public.hall_of_fame for insert to authenticated
  with check (public.is_admin());

create policy "hall_of_fame: admin update"
  on public.hall_of_fame for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "hall_of_fame: admin delete"
  on public.hall_of_fame for delete to authenticated
  using (public.is_admin());
