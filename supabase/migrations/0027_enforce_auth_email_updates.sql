-- Keep the campus-email authorization boundary intact after signup.
--
-- Supabase Auth updates auth.users.email when an email-change token is
-- confirmed. The signup trigger validates only INSERTs, so without a matching
-- UPDATE trigger an account can be transferred to a non-NEU address while its
-- profile keeps the old address.

create function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or new.email !~* '@northeastern\.edu$' then
    raise exception 'HuskyMarkets is restricted to @northeastern.edu accounts';
  end if;

  update public.profiles
  set email = lower(new.email)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_update();

revoke execute on function public.handle_auth_user_email_update()
  from public, anon, authenticated;
