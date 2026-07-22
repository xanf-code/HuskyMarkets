-- Phase 6 · 0008 - Report handling, mod applications, market visibility
-- Complements resolve_market / lock_market from 0006. All staff actions log
-- to mod_actions. Conflict rules reuse assert_can_moderate_market.

-- One open report per user per market (upsert-ish guard for submitReport).
create unique index if not exists reports_one_open_per_user_market
  on public.reports (market_id, reporter_id)
  where (status = 'open');

-- ── handle_report ────────────────────────────────────────────────────────
-- dismiss → status dismissed; action → void market + hide + status actioned.

create function public.handle_report(
  p_report_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.reports%rowtype;
  v_market public.markets%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_action not in ('dismiss', 'action') then
    raise exception 'invalid action: must be dismiss or action';
  end if;

  select * into v_report
  from public.reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'report not found';
  end if;

  if v_report.status <> 'open' then
    raise exception 'report already handled';
  end if;

  select * into v_market
  from public.markets
  where id = v_report.market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  perform public.assert_can_moderate_market(v_market, v_uid);

  if p_action = 'dismiss' then
    update public.reports
    set status = 'dismissed', handled_by = v_uid
    where id = p_report_id;

    insert into public.mod_actions (moderator_id, action, market_id, note)
    values (v_uid, 'report_dismiss', v_report.market_id, p_note);
  else
    -- Void + remove: reuse resolve_market void path when still open/closed,
    -- then force hidden. If already resolved, just hide.
    if v_market.status in ('open', 'closed') then
      perform public.resolve_market(v_report.market_id, 'void');
    end if;

    update public.markets set hidden = true where id = v_report.market_id;

    update public.reports
    set status = 'actioned', handled_by = v_uid
    where id = p_report_id;

    -- resolve_market already logged void; log the report_action separately.
    insert into public.mod_actions (moderator_id, action, market_id, note)
    values (v_uid, 'report_action', v_report.market_id, p_note);
  end if;
end;
$$;

-- ── set_market_hidden ────────────────────────────────────────────────────
-- Markets have no client UPDATE RLS; staff hide/unhide via this RPC.

create function public.set_market_hidden(
  p_market_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_market public.markets%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  update public.markets set hidden = p_hidden where id = p_market_id;

  if p_hidden then
    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'hide', p_market_id);
  end if;
end;
$$;

-- ── review_mod_application ───────────────────────────────────────────────

create function public.review_mod_application(
  p_application_id uuid,
  p_decision text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.mod_applications%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision: must be approve or reject';
  end if;

  select * into v_app
  from public.mod_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'application not found';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'application already reviewed';
  end if;

  if p_decision = 'approve' then
    update public.mod_applications
    set status = 'approved', reviewed_by = v_uid
    where id = p_application_id;

    update public.profiles
    set role = 'moderator'
    where id = v_app.user_id
      and role = 'user';
  else
    update public.mod_applications
    set status = 'rejected', reviewed_by = v_uid
    where id = p_application_id;
  end if;
end;
$$;

-- ── revoke_moderator ─────────────────────────────────────────────────────

create function public.revoke_moderator(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_user_id = v_uid then
    raise exception 'cannot revoke yourself';
  end if;

  update public.profiles
  set role = 'user'
  where id = p_user_id
    and role = 'moderator';

  if not found then
    raise exception 'user is not a moderator';
  end if;

  insert into public.mod_actions (moderator_id, action, target_user_id)
  values (v_uid, 'mod_revoke', p_user_id);
end;
$$;

-- ── Grant discipline ─────────────────────────────────────────────────────

revoke execute on function public.handle_report(uuid, text, text)
  from public, anon;
revoke execute on function public.set_market_hidden(uuid, boolean)
  from public, anon;
revoke execute on function public.review_mod_application(uuid, text)
  from public, anon;
revoke execute on function public.revoke_moderator(uuid) from public, anon;

grant execute on function public.handle_report(uuid, text, text)
  to authenticated;
grant execute on function public.set_market_hidden(uuid, boolean)
  to authenticated;
grant execute on function public.review_mod_application(uuid, text)
  to authenticated;
grant execute on function public.revoke_moderator(uuid) to authenticated;
