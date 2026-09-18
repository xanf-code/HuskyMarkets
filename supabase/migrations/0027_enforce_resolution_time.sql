-- Prevent irreversible payouts before a market's declared resolution time.
-- Voids remain available at any time so staff can remove invalid markets.

create function public.enforce_market_resolution_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if now() < old.resolve_at then
    raise exception 'market cannot be resolved before its resolution time';
  end if;
  return new;
end;
$$;

create trigger markets_enforce_resolution_time
  before update of status on public.markets
  for each row
  when (new.status = 'resolved' and old.status is distinct from 'resolved')
  execute function public.enforce_market_resolution_time();
