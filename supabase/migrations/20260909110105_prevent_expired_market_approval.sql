-- Pending markets can outlive the close time chosen at creation. Prevent any
-- approval path from publishing a market after betting has already closed.

create function public.prevent_expired_market_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status::text = 'pending'
     and new.status::text = 'open'
     and new.close_at <= now() then
    raise exception 'market close time has passed';
  end if;

  return new;
end;
$$;

create trigger markets_prevent_expired_approval
before update of status on public.markets
for each row
execute function public.prevent_expired_market_approval();
