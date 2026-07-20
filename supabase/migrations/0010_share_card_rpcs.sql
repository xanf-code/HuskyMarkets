-- Share-card RPCs for market and bet OG image generation.
-- These RPCs were authored outside source control and are being committed here
-- as stubs against the legacy binary schema. Their bodies are rewritten
-- N-outcome-aware in the Phase E-1 schema migration
-- (0011_multi_outcome_engine.sql, section 10), which supersedes them.
--
-- Security: definer-hardened, set search_path = '', explicit grant discipline.

-- get_market_card: Returns market metadata for OG image generation.
-- Callable by authenticated users (filters by market visibility).
create or replace function get_market_card(p_market_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market json;
begin
  select json_build_object(
    'id', markets.id,
    'title', markets.title,
    'created_at', markets.created_at,
    'close_at', markets.close_at,
    'status', markets.status,
    'yes_pool', markets.yes_pool,
    'no_pool', markets.no_pool
  ) into v_market
  from public.markets
  where markets.id = p_market_id
    and (
      markets.hidden = false
      or auth.uid() in (select id from public.profiles where role = 'moderator')
    );

  return v_market;
end;
$$;

grant execute on function get_market_card(uuid) to authenticated;

-- get_share_card: Returns bet metadata for bet OG image generation.
-- Callable only by the bet creator or moderators.
create or replace function get_share_card(p_bet_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card json;
begin
  select json_build_object(
    'bet_id', bets.id,
    'market_id', bets.market_id,
    'amount', bets.amount,
    'price_at_bet', bets.price_at_bet,
    'side', bets.side,
    'market_title', markets.title,
    'yes_pool', markets.yes_pool,
    'no_pool', markets.no_pool
  ) into v_card
  from public.bets
  join public.markets on bets.market_id = markets.id
  where bets.id = p_bet_id
    and (
      bets.user_id = auth.uid()
      or auth.uid() in (select id from public.profiles where role = 'moderator')
    );

  return v_card;
end;
$$;

grant execute on function get_share_card(uuid) to authenticated;
