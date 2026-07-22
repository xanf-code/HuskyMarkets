-- 0021 · review_market: set email_status 'pending' so approval/rejection emails are sent
--
-- Migration 0019 inserted notifications with email_status='skipped', meaning the
-- email pipeline never fired for approval/rejection events. Now that
-- sendResolutionEmails is called from reviewMarketAction, the rows need
-- email_status='pending' so they are claimed by the sender.

create or replace function public.review_market(
  p_market_id uuid,
  p_action    text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_market public.markets%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'invalid action: must be approve or reject';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  perform public.assert_can_moderate_market(v_market, v_uid);

  if v_market.status::text <> 'pending' then
    raise exception 'market is not pending review';
  end if;

  if p_action = 'approve' then
    update public.markets
    set status = 'open'
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'approve_market', p_market_id);

    insert into public.notifications (user_id, type, market_id, payload, email_status)
    values (
      v_market.creator_id,
      'market_approved',
      p_market_id,
      jsonb_build_object('market_title', v_market.title),
      'pending'
    );
  else
    update public.markets
    set status = 'rejected'
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'reject_market', p_market_id);

    insert into public.notifications (user_id, type, market_id, payload, email_status)
    values (
      v_market.creator_id,
      'market_rejected',
      p_market_id,
      jsonb_build_object('market_title', v_market.title),
      'pending'
    );
  end if;
end;
$$;
