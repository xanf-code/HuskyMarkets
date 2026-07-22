-- Phase 3 · 0006 - Market engine: place_bet, resolve_market, lock_market
-- Sole write paths for bets and market state. All money math is integer HC.
--
-- Ledger sign conventions (invariant checked in Phase 3 verification):
--   bet_place      negative (stake leaves the wallet)
--   bet_payout     positive
--   market_refund  positive
--   vig_burn       positive, user-less (money destroyed: vig + house share + dust)
-- Invariant: Σ(user tx) + Σ(vig_burn) − 200 × resolved_markets = Σ(grants).

-- ── place_bet ────────────────────────────────────────────────────────────

create function public.place_bet(
  p_market_id uuid,
  p_side public.bet_side,
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
  v_existing_stake integer;
  v_price integer;
  v_bet_id uuid;
  v_yes integer;
  v_no integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_amount < 1 or p_amount > 500 then
    raise exception 'bet amount must be between 1 and 500';
  end if;

  -- Serialize all bets on this market.
  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  -- Past-due markets read as closed; the close-due-markets cron durably
  -- flips status (an update here would roll back with this exception).
  if v_market.status <> 'open' or now() >= v_market.close_at then
    raise exception 'market closed';
  end if;

  -- Wallet lock: two concurrent bets from one wallet queue here, so the
  -- balance check below cannot be raced into an overdraft.
  perform 1 from public.profiles where id = v_uid for update;

  if public.get_balance(v_uid) < p_amount then
    raise exception 'insufficient balance';
  end if;

  select coalesce(sum(b.amount), 0) into v_existing_stake
  from public.bets b
  where b.market_id = p_market_id and b.user_id = v_uid;

  if v_existing_stake + p_amount > 500 then
    raise exception 'per-market cap of 500 HC exceeded';
  end if;

  -- Price the bettor pays: implied YES probability *before* their stake
  -- moves the pools. Same clamp formula as the cron snapshot.
  v_price := least(greatest(
    round(100.0 * v_market.yes_pool / (v_market.yes_pool + v_market.no_pool))::int,
    1), 99);

  insert into public.bets (market_id, user_id, side, amount, price_at_bet)
  values (p_market_id, v_uid, p_side, p_amount, v_price)
  returning id into v_bet_id;

  insert into public.transactions (user_id, type, amount, market_id, bet_id)
  values (v_uid, 'bet_place', -p_amount, p_market_id, v_bet_id);

  update public.markets
  set yes_pool = yes_pool + case when p_side = 'yes' then p_amount else 0 end,
      no_pool  = no_pool  + case when p_side = 'no'  then p_amount else 0 end
  where id = p_market_id
  returning yes_pool, no_pool into v_yes, v_no;

  -- Snapshot the *new* pools so charts show the post-bet price.
  insert into public.price_history (market_id, implied_yes, yes_pool, no_pool)
  values (
    p_market_id,
    least(greatest(round(100.0 * v_yes / (v_yes + v_no))::int, 1), 99),
    v_yes,
    v_no
  );

  return jsonb_build_object(
    'bet_id', v_bet_id,
    'yes_pool', v_yes,
    'no_pool', v_no,
    'implied_yes', least(greatest(round(100.0 * v_yes / (v_yes + v_no))::int, 1), 99),
    'new_balance', public.get_balance(v_uid)
  );
end;
$$;

-- ── Staff conflict gate (shared by resolve_market / lock_market) ─────────

-- Admins may act on any market (v1: admin resolves). Moderators may not
-- touch markets they created or bet on.
create function public.assert_can_moderate_market(
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
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  if public.is_admin() then
    return;
  end if;

  if p_market.creator_id = p_uid then
    raise exception 'conflict of interest: you created this market';
  end if;

  if exists (
    select 1 from public.bets b
    where b.market_id = p_market.id and b.user_id = p_uid
  ) then
    raise exception 'conflict of interest: you bet on this market';
  end if;
end;
$$;

-- ── resolve_market ───────────────────────────────────────────────────────

create function public.resolve_market(
  p_market_id uuid,
  p_outcome text
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
  v_winning_side public.bet_side;
  v_paid integer := 0;
  v_refunded integer := 0;
  v_burn integer;
  v_winning_bettors integer;
  v_status public.market_status;
  v_action public.mod_action_type;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_outcome not in ('yes', 'no', 'void') then
    raise exception 'invalid outcome: must be yes, no, or void';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  perform public.assert_can_moderate_market(v_market, v_uid);

  if v_market.status not in ('open', 'closed') then
    raise exception 'market already resolved';
  end if;

  if p_outcome = 'void' then
    -- Everyone gets their full stake back; nothing is burned.
    insert into public.transactions (user_id, type, amount, market_id)
    select b.user_id, 'market_refund', sum(b.amount), p_market_id
    from public.bets b
    where b.market_id = p_market_id
    group by b.user_id;

    v_status := 'voided';
    v_action := 'void';
  else
    v_winning_side := p_outcome::public.bet_side;
    v_total := v_market.yes_pool + v_market.no_pool;  -- includes 200 house seed
    v_vig := v_total * 5 / 100;                       -- integer division floors
    v_after := v_total - v_vig;
    v_winning_pool := case when v_winning_side = 'yes'
      then v_market.yes_pool else v_market.no_pool end;  -- includes 100 seed

    select count(distinct b.user_id) into v_winning_bettors
    from public.bets b
    where b.market_id = p_market_id and b.side = v_winning_side;

    if v_winning_bettors = 0 then
      -- Nobody backed the winning side: refund the losers instead of
      -- burning their stakes against an empty pool.
      insert into public.transactions (user_id, type, amount, market_id)
      select b.user_id, 'market_refund', sum(b.amount), p_market_id
      from public.bets b
      where b.market_id = p_market_id
      group by b.user_id;
    else
      -- Pro-rata payout, floored per user; stakes aggregated per user first.
      insert into public.transactions (user_id, type, amount, market_id)
      select
        w.user_id,
        'bet_payout',
        (w.stake * v_after) / v_winning_pool,  -- integer division floors
        p_market_id
      from (
        select b.user_id, sum(b.amount) as stake
        from public.bets b
        where b.market_id = p_market_id and b.side = v_winning_side
        group by b.user_id
      ) w;

      select coalesce(sum(t.amount), 0) into v_paid
      from public.transactions t
      where t.market_id = p_market_id and t.type = 'bet_payout';

      -- Vig + the house's pro-rata share + rounding dust, burned user-less.
      v_burn := v_total - v_paid;
      insert into public.transactions (user_id, type, amount, market_id)
      values (null, 'vig_burn', v_burn, p_market_id);
    end if;

    v_status := case when v_winning_side = 'yes'
      then 'resolved_yes'::public.market_status
      else 'resolved_no'::public.market_status end;
    v_action := case when v_winning_side = 'yes'
      then 'resolve_yes'::public.mod_action_type
      else 'resolve_no'::public.mod_action_type end;
  end if;

  update public.markets
  set status = v_status,
      resolved_by = v_uid,
      resolved_at = now()
  where id = p_market_id;

  insert into public.mod_actions (moderator_id, action, market_id)
  values (v_uid, v_action, p_market_id);

  select coalesce(sum(t.amount), 0) into v_refunded
  from public.transactions t
  where t.market_id = p_market_id and t.type = 'market_refund';

  return jsonb_build_object(
    'status', v_status,
    'paid_out', v_paid,
    'refunded', v_refunded,
    'burned', coalesce(v_burn, 0)
  );
end;
$$;

-- ── lock_market ──────────────────────────────────────────────────────────

create function public.lock_market(p_market_id uuid)
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

  perform public.assert_can_moderate_market(v_market, v_uid);

  if v_market.status <> 'open' then
    raise exception 'market is not open';
  end if;

  update public.markets set status = 'closed' where id = p_market_id;

  insert into public.mod_actions (moderator_id, action, market_id)
  values (v_uid, 'lock', p_market_id);
end;
$$;

-- ── Grant discipline (every new function, per 0005 convention) ───────────

revoke execute on function public.place_bet(uuid, public.bet_side, integer)
  from public, anon;
revoke execute on function public.resolve_market(uuid, text) from public, anon;
revoke execute on function public.lock_market(uuid) from public, anon;
revoke execute on function
  public.assert_can_moderate_market(public.markets, uuid)
  from public, anon, authenticated;

grant execute on function public.place_bet(uuid, public.bet_side, integer)
  to authenticated;
grant execute on function public.resolve_market(uuid, text) to authenticated;
grant execute on function public.lock_market(uuid) to authenticated;
