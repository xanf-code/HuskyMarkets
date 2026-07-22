-- ════════════════════════════════════════════════════════════════════════
-- 0018 · Notifications
-- ════════════════════════════════════════════════════════════════════════

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('market_resolved', 'market_voided')),
  market_id     uuid references public.markets (id),
  payload       jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  email_status  text not null default 'pending'
    check (email_status in ('pending','sending','sent','failed','skipped')),
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;
create index notifications_email_outbox_idx
  on public.notifications (market_id) where email_status = 'pending';

-- ════════════════════════════════════════════════════════════════════════
-- RLS + column grants
-- ════════════════════════════════════════════════════════════════════════

alter table public.notifications enable row level security;

create policy "notifications: select own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: update own read_at"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Restrict to read_at column only (same pattern as 0003/0005 column grants).
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- No INSERT or DELETE policies: writes happen only inside security-definer RPCs.
-- email_status transitions happen only via service role (bypasses RLS).

-- ════════════════════════════════════════════════════════════════════════
-- Profile preference column
-- ════════════════════════════════════════════════════════════════════════

-- email_notifications preference (default opt-in, spam-law compliant via unsubscribe route)
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

-- Re-issue the profiles column grant to include the new column.
revoke update on public.profiles from authenticated;
grant update (real_name, display_mode, onboarded, email_notifications) on public.profiles to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- resolve_market replacement (adds notification inserts)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.resolve_market(
  p_market_id uuid,
  p_action text,
  p_winning_outcome_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_market public.markets%rowtype;
  v_total integer;
  v_vig integer;
  v_after integer;
  v_winning_pool integer;
  v_winning_bettors integer;
  v_paid integer := 0;
  v_refunded integer := 0;
  v_burn integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_action not in ('resolve', 'void') then
    raise exception 'invalid action: must be resolve or void';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;

  -- Void is creator-or-staff; picking a winning outcome is staff-only.
  if p_action = 'void' then
    perform public.assert_can_manage_market(v_market, v_uid);
  else
    perform public.assert_can_moderate_market(v_market, v_uid);
  end if;

  if v_market.status not in ('open', 'closed') then
    raise exception 'market already resolved';
  end if;

  if p_action = 'void' then
    insert into public.transactions (user_id, type, amount, market_id)
    select b.user_id, 'market_refund', sum(b.amount), p_market_id
    from public.bets b where b.market_id = p_market_id group by b.user_id;

    update public.markets
    set status = 'voided', resolved_by = v_uid, resolved_at = now()
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'void', p_market_id);

    -- Bettor notifications (one per user whose bets were refunded)
    insert into public.notifications (user_id, type, market_id, payload)
    select t.user_id, 'market_voided', p_market_id,
           jsonb_build_object(
             'role', 'bettor',
             'refund', t.amount,
             'market_title', v_market.title
           )
    from public.transactions t
    where t.market_id = p_market_id and t.type = 'market_refund';

    -- Creator notification (skip if creator is the voider, or if creator is also a bettor)
    insert into public.notifications (user_id, type, market_id, payload)
    select v_market.creator_id, 'market_voided', p_market_id,
           jsonb_build_object('role', 'creator', 'market_title', v_market.title)
    where v_market.creator_id <> v_uid
      and not exists (
        select 1 from public.notifications n
        where n.market_id = p_market_id and n.user_id = v_market.creator_id
      );
  else
    if p_winning_outcome_id is null then
      raise exception 'resolve requires a winning outcome';
    end if;

    select pool into v_winning_pool from public.market_outcomes
    where id = p_winning_outcome_id and market_id = p_market_id;
    if not found then
      raise exception 'winning outcome does not belong to this market';
    end if;

    select sum(pool) into v_total from public.market_outcomes
    where market_id = p_market_id;
    v_vig := v_total * 5 / 100;
    v_after := v_total - v_vig;

    select count(distinct b.user_id) into v_winning_bettors
    from public.bets b
    where b.market_id = p_market_id and b.outcome_id = p_winning_outcome_id;

    if v_winning_bettors = 0 then
      insert into public.transactions (user_id, type, amount, market_id)
      select b.user_id, 'market_refund', sum(b.amount), p_market_id
      from public.bets b where b.market_id = p_market_id group by b.user_id;

      -- Empty-winner: all bettors refunded
      insert into public.notifications (user_id, type, market_id, payload)
      select t.user_id, 'market_resolved', p_market_id,
             jsonb_build_object(
               'role', 'bettor', 'result', 'refunded',
               'refund', t.amount,
               'market_title', v_market.title
             )
      from public.transactions t
      where t.market_id = p_market_id and t.type = 'market_refund';

      insert into public.notifications (user_id, type, market_id, payload)
      select v_market.creator_id, 'market_resolved', p_market_id,
             jsonb_build_object('role', 'creator', 'market_title', v_market.title)
      where not exists (
        select 1 from public.notifications n
        where n.market_id = p_market_id and n.user_id = v_market.creator_id
      );
    else
      insert into public.transactions (user_id, type, amount, market_id)
      select w.user_id, 'bet_payout', (w.stake * v_after) / v_winning_pool, p_market_id
      from (
        select b.user_id, sum(b.amount) as stake
        from public.bets b
        where b.market_id = p_market_id and b.outcome_id = p_winning_outcome_id
        group by b.user_id
      ) w;

      select coalesce(sum(t.amount), 0) into v_paid
      from public.transactions t
      where t.market_id = p_market_id and t.type = 'bet_payout';

      v_burn := v_total - v_paid;
      insert into public.transactions (user_id, type, amount, market_id)
      values (null, 'vig_burn', v_burn, p_market_id);

      -- Winners: amounts from the bet_payout rows just inserted
      insert into public.notifications (user_id, type, market_id, payload)
      select t.user_id, 'market_resolved', p_market_id,
             jsonb_build_object(
               'role', 'bettor', 'result', 'won', 'amount', t.amount,
               'winning_label', (select label from public.market_outcomes
                                  where id = p_winning_outcome_id),
               'market_title', v_market.title
             )
      from public.transactions t
      where t.market_id = p_market_id and t.type = 'bet_payout';

      -- Losers: bettors with no stake on the winning outcome
      insert into public.notifications (user_id, type, market_id, payload)
      select b.user_id, 'market_resolved', p_market_id,
             jsonb_build_object(
               'role', 'bettor', 'result', 'lost', 'amount', sum(b.amount),
               'winning_label', (select label from public.market_outcomes
                                  where id = p_winning_outcome_id),
               'market_title', v_market.title
             )
      from public.bets b
      where b.market_id = p_market_id
        and b.user_id not in (
          select wb.user_id from public.bets wb
          where wb.market_id = p_market_id and wb.outcome_id = p_winning_outcome_id
        )
      group by b.user_id;

      -- Creator: insert only if they didn't already get a bettor notification
      insert into public.notifications (user_id, type, market_id, payload)
      select v_market.creator_id, 'market_resolved', p_market_id,
             jsonb_build_object('role', 'creator', 'market_title', v_market.title)
      where not exists (
        select 1 from public.notifications n
        where n.market_id = p_market_id and n.user_id = v_market.creator_id
      );
    end if;

    update public.markets
    set status = 'resolved', winning_outcome_id = p_winning_outcome_id,
        resolved_by = v_uid, resolved_at = now()
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id, outcome_id)
    values (v_uid, 'resolve', p_market_id, p_winning_outcome_id);
  end if;

  select coalesce(sum(t.amount), 0) into v_refunded
  from public.transactions t
  where t.market_id = p_market_id and t.type = 'market_refund';

  return jsonb_build_object(
    'status', (select status from public.markets where id = p_market_id),
    'paid_out', v_paid,
    'refunded', v_refunded,
    'burned', coalesce(v_burn, 0)
  );
end;
$$;

revoke execute on function public.resolve_market(uuid, text, uuid) from public, anon;
grant  execute on function public.resolve_market(uuid, text, uuid) to authenticated;
