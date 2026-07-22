-- 0016_creator_controls.sql
-- Pool creator self-management: edit, lock, and void their own pool.
-- Creators are barred from betting on pools they own (removes financial
-- conflict of interest that would otherwise make self-management unsafe).
-- Resolving to a winning outcome remains staff/admin-only.

-- ════════════════════════════════════════════════════════════════════════
-- 1. assert_can_manage_market
--    Creator is always allowed; non-creator falls through to the existing
--    staff conflict gate (which grants admin override and checks for bettor
--    / creator conflicts among moderators).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.assert_can_manage_market(
  p_market public.markets,
  p_uid uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_market.creator_id = p_uid then
    return;
  end if;
  perform public.assert_can_moderate_market(p_market, p_uid);
end;
$$;

-- Internal helper - not callable by clients.
revoke execute on function public.assert_can_manage_market(public.markets, uuid)
  from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. place_bet - bar the creator from betting on their own market
--    Exact copy of the 0011 body, with one additional guard.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.place_bet(
  p_market_id uuid,
  p_outcome_id uuid,
  p_amount integer
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
  v_existing integer;
  v_outcome_pool integer;
  v_total integer;
  v_price integer;
  v_bet_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount < 1 or p_amount > 500 then
    raise exception 'bet amount must be between 1 and 500';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;
  if v_market.status <> 'open' or now() >= v_market.close_at then
    raise exception 'market closed';
  end if;

  if v_market.creator_id = v_uid then
    raise exception 'creator cannot bet on own market';
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if public.get_balance(v_uid) < p_amount then
    raise exception 'insufficient balance';
  end if;

  select coalesce(sum(amount), 0) into v_existing
  from public.bets where market_id = p_market_id and user_id = v_uid;
  if v_existing + p_amount > 500 then
    raise exception 'per-market cap of 500 HC exceeded';
  end if;

  select pool into v_outcome_pool from public.market_outcomes
  where id = p_outcome_id and market_id = p_market_id
  for update;
  if not found then
    raise exception 'outcome does not belong to this market';
  end if;

  select sum(pool) into v_total from public.market_outcomes
  where market_id = p_market_id;

  v_price := least(greatest(round(100.0 * v_outcome_pool / v_total)::int, 1), 99);

  insert into public.bets (market_id, user_id, outcome_id, amount, price_at_bet)
  values (p_market_id, v_uid, p_outcome_id, p_amount, v_price)
  returning id into v_bet_id;

  insert into public.transactions (user_id, type, amount, market_id, bet_id)
  values (v_uid, 'bet_place', -p_amount, p_market_id, v_bet_id);

  update public.market_outcomes set pool = pool + p_amount where id = p_outcome_id;

  insert into public.price_history (market_id, outcome_id, implied, pool, recorded_at)
  select o.market_id, o.id,
         least(greatest(round(100.0 * o.pool / t.total)::int, 1), 99),
         o.pool, now()
  from public.market_outcomes o
  cross join (select sum(pool) as total from public.market_outcomes
              where market_id = p_market_id) t
  where o.market_id = p_market_id;

  return jsonb_build_object(
    'bet_id', v_bet_id,
    'new_balance', public.get_balance(v_uid),
    'outcomes', public._outcome_map(p_market_id)
  );
end;
$$;

revoke execute on function public.place_bet(uuid, uuid, integer) from public, anon;
grant execute on function public.place_bet(uuid, uuid, integer) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. lock_market - creator can now lock their own pool early
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.lock_market(p_market_id uuid)
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

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  perform public.assert_can_manage_market(v_market, v_uid);

  if v_market.status <> 'open' then
    raise exception 'market is not open';
  end if;

  update public.markets set status = 'closed' where id = p_market_id;

  insert into public.mod_actions (moderator_id, action, market_id)
  values (v_uid, 'lock', p_market_id);
end;
$$;

revoke execute on function public.lock_market(uuid) from public, anon;
grant execute on function public.lock_market(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. resolve_market (3-arg, multi-outcome) - void opened to creator,
--    resolve-to-outcome stays staff-only.
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
grant execute on function public.resolve_market(uuid, text, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. update_market - edit all fields until the first bet is placed
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.update_market(
  p_market_id uuid,
  p_title text,
  p_description text,
  p_category public.market_category,
  p_resolution_criteria text,
  p_close_at timestamptz,
  p_resolve_at timestamptz,
  p_outcomes jsonb,
  p_catch_all boolean default false,
  p_auto_flagged boolean default false
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
  v_labels text[];
  v_count integer;
  v_catch_all constant text := 'None of the above';
  i integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;

  if v_market.creator_id <> v_uid and not public.is_admin() then
    raise exception 'not allowed';
  end if;

  if v_market.status <> 'open' then
    raise exception 'market not editable';
  end if;

  if exists (select 1 from public.bets where market_id = p_market_id) then
    raise exception 'market has bets';
  end if;

  -- Same label normalization as create_market (W3).
  select array_agg(regexp_replace(btrim(value), '\s+', ' ', 'g')) into v_labels
  from jsonb_array_elements_text(p_outcomes);

  if p_catch_all then
    v_labels := coalesce(v_labels, array[]::text[]) || v_catch_all;
  end if;

  v_count := coalesce(array_length(v_labels, 1), 0);
  if v_count < 2 or v_count > 6 then
    raise exception 'a market needs between 2 and 6 outcomes';
  end if;

  for i in 1 .. v_count loop
    if v_labels[i] is null or char_length(v_labels[i]) < 1
       or char_length(v_labels[i]) > 40 then
      raise exception 'outcome labels must be 1-40 characters';
    end if;
  end loop;

  if (select count(distinct lower(x)) from unnest(v_labels) as x) <> v_count then
    raise exception 'outcome labels must be unique (case-insensitive)';
  end if;

  if char_length(p_title) < 10 or char_length(p_title) > 120 then
    raise exception 'title must be 10-120 characters';
  end if;
  if char_length(p_resolution_criteria) < 20 then
    raise exception 'resolution criteria must be at least 20 characters';
  end if;
  if p_close_at <= now() then
    raise exception 'close time must be in the future';
  end if;
  if p_resolve_at < p_close_at then
    raise exception 'resolve time must be at or after the close time';
  end if;

  update public.markets
  set
    title = p_title,
    description = p_description,
    category = p_category,
    resolution_criteria = p_resolution_criteria,
    close_at = p_close_at,
    resolve_at = p_resolve_at,
    auto_flagged = p_auto_flagged
  where id = p_market_id;

  -- Replace outcomes: safe because bets/price_history are empty at this point.
  delete from public.market_outcomes where market_id = p_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select p_market_id, v_labels[ord], ord - 1, 100,
         (p_catch_all and ord = v_count)
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', p_market_id,
    'outcomes', public._outcome_map(p_market_id)
  );
end;
$$;

revoke execute on function public.update_market(uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  from public, anon;
grant execute on function public.update_market(uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  to authenticated;
