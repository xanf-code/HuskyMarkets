-- 0017: Make get_share_card accessible to unauthenticated callers.
--
-- Share cards are public links (the bet UUID is the access token). The 0011
-- body required auth.uid() to equal the bet owner, which always fails for the
-- anon client used by /share/bet/[betId] and /api/og/bet/[betId].
-- 0014 granted get_market_card to anon but missed get_share_card.
--
-- Fix: drop the owner/staff predicate from the body, then grant anon.

create or replace function public.get_share_card(p_bet_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'bet_id',       b.id,
    'market_id',    b.market_id,
    'amount',       b.amount,
    'price_at_bet', b.price_at_bet,
    'outcome_label', o.label,
    'market_title', m.title,
    'payout', coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.user_id = b.user_id
        and t.market_id = b.market_id
        and t.type = 'bet_payout'
    ), 0),
    'display_name', coalesce((
      select p.display_name from public.public_profiles p where p.id = b.user_id
    ), 'Unknown Husky')
  )
  from public.bets b
  join public.markets m on m.id = b.market_id
  join public.market_outcomes o on o.id = b.outcome_id
  where b.id = p_bet_id
    and m.hidden = false;
$$;

grant execute on function public.get_share_card(uuid) to anon;
