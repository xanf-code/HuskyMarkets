-- 0027 · Restore the creator self-bet guard
--
-- 0020 replaced place_bet to add a hidden-market check, but omitted the
-- creator guard introduced in 0016. Preserve the hidden check while restoring
-- the conflict-of-interest protection.

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
  v_uid          uuid := (select auth.uid());
  v_market       public.markets%rowtype;
  v_existing     integer;
  v_outcome_pool integer;
  v_total        integer;
  v_price        integer;
  v_bet_id       uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount < 1 or p_amount > 500 then
    raise exception 'bet amount must be between 1 and 500';
  end if;

  -- Serialize all bets on this market on the markets row (AD-2).
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;

  if v_market.hidden then
    raise exception 'market not available';
  end if;

  if v_market.status <> 'open' or now() >= v_market.close_at then
    raise exception 'market closed';
  end if;

  if v_market.creator_id = v_uid then
    raise exception 'creator cannot bet on own market';
  end if;

  -- Wallet lock (preserve markets → profiles lock order).
  perform 1 from public.profiles where id = v_uid for update;
  if public.get_balance(v_uid) < p_amount then
    raise exception 'insufficient balance';
  end if;

  -- 500 HC cap is the aggregate across every outcome of this market (FR-9).
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

  -- Implied price of the chosen outcome *before* the stake moves the pools.
  v_price := least(greatest(round(100.0 * v_outcome_pool / v_total)::int, 1), 99);

  insert into public.bets (market_id, user_id, outcome_id, amount, price_at_bet)
  values (p_market_id, v_uid, p_outcome_id, p_amount, v_price)
  returning id into v_bet_id;

  insert into public.transactions (user_id, type, amount, market_id, bet_id)
  values (v_uid, 'bet_place', -p_amount, p_market_id, v_bet_id);

  update public.market_outcomes set pool = pool + p_amount where id = p_outcome_id;

  -- Snapshot the post-bet price of every outcome for the market charts.
  insert into public.price_history (market_id, outcome_id, implied, pool, recorded_at)
  select o.market_id, o.id,
         least(greatest(round(100.0 * o.pool / t.total)::int, 1), 99),
         o.pool, now()
  from public.market_outcomes o
  cross join (
    select sum(pool) as total from public.market_outcomes where market_id = p_market_id
  ) t
  where o.market_id = p_market_id;

  return jsonb_build_object(
    'bet_id',      v_bet_id,
    'outcome_id',  p_outcome_id,
    'amount',      p_amount,
    'price',       v_price,
    'new_balance', public.get_balance(v_uid),
    'outcomes',    public._outcome_map(p_market_id)
  );
end;
$$;

revoke execute on function public.place_bet(uuid, uuid, integer) from public, anon;
grant execute on function public.place_bet(uuid, uuid, integer) to authenticated;
