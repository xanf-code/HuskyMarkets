-- Allow creators to withdraw a market while it is awaiting staff review.
-- Pending markets cannot have bets, so cancellation is a state transition
-- without refunds. Keep this separate from resolve_market's payout paths.

create function public.cancel_pending_market(p_market_id uuid)
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

  if v_market.creator_id <> v_uid then
    raise exception 'not allowed';
  end if;

  if v_market.status <> 'pending' then
    raise exception 'market is not pending review';
  end if;

  -- Rejected is the existing non-public, non-trust-earning terminal state.
  -- Using voided here would incorrectly count a never-published submission
  -- toward create_market's trusted-creator threshold.
  update public.markets
  set status = 'rejected'
  where id = p_market_id;
end;
$$;

revoke execute on function public.cancel_pending_market(uuid)
  from public, anon;
grant execute on function public.cancel_pending_market(uuid)
  to authenticated;
