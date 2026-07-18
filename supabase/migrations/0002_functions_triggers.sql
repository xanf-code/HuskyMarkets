-- Phase 2 · 0002 — Ledger/auth functions and triggers
-- (Market-engine functions — place_bet, resolve_market, lock_market — land
-- in Phase 3.)

-- ── Balance & role helpers ───────────────────────────────────────────────

-- Balance is derived: sum of the append-only ledger. Never stored.
create function public.get_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.amount), 0)::integer
  from public.transactions t
  where t.user_id = p_user_id;
$$;

create function public.get_my_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_balance((select auth.uid()));
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('moderator', 'admin')
  );
$$;

-- ── Anonymous handles ────────────────────────────────────────────────────

create function public.gen_anon_handle()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_adjectives constant text[] := array[
    'Swift', 'Clever', 'Bold', 'Quiet', 'Lucky', 'Frosty', 'Midnight',
    'Scrappy', 'Nimble', 'Cosmic', 'Turbo', 'Sneaky', 'Mighty', 'Rowdy',
    'Chill', 'Blazing', 'Crimson', 'Shadow', 'Electric', 'Wandering'
  ];
  v_handle text;
begin
  -- Loop-retry on unique collision; 20 adjectives × 100 numbers = 2,000
  -- combinations, far above expected campus population for v1.
  loop
    v_handle := v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int]
      || 'Husky'
      || lpad(floor(random() * 100)::int::text, 2, '0');
    exit when not exists (
      select 1 from public.profiles p where p.anon_handle = v_handle
    );
  end loop;
  return v_handle;
end;
$$;

-- ── Signup: profile + grant ──────────────────────────────────────────────

-- Server-side NEU domain enforcement. The client-side check in the login
-- form is UX only; this is the security boundary.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := 'user';
begin
  if new.email !~* '@northeastern\.edu$' then
    raise exception 'HuskyMarkets is restricted to @northeastern.edu accounts';
  end if;

  if lower(new.email) = 'aswathappa.d@northeastern.edu' then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, anon_handle, role)
  values (new.id, lower(new.email), public.gen_anon_handle(), v_role);

  insert into public.transactions (user_id, type, amount)
  values (new.id, 'signup_grant', 1000);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Profile RPCs ─────────────────────────────────────────────────────────

create function public.reroll_anon_handle()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_handle text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  v_handle := public.gen_anon_handle();
  update public.profiles
  set anon_handle = v_handle
  where id = (select auth.uid());
  return v_handle;
end;
$$;

-- ── Grants: daily bonus & weekly bailout ─────────────────────────────────

-- Idempotent per ET day via the partial unique index; returns whether this
-- call actually claimed.
create function public.claim_daily_bonus()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  insert into public.transactions (user_id, type, amount, day_key)
  values (
    (select auth.uid()),
    'daily_bonus',
    50,
    (now() at time zone 'America/New_York')::date
  )
  on conflict (user_id, day_key) where (type = 'daily_bonus') do nothing;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

-- One bailout per ET week (day_key = the ET Monday of the current week),
-- only when broke (< 100 HC).
create function public.claim_bailout()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  if public.get_balance((select auth.uid())) >= 100 then
    raise exception 'bailout requires balance below 100 HC';
  end if;

  insert into public.transactions (user_id, type, amount, day_key)
  values (
    (select auth.uid()),
    'bailout',
    200,
    date_trunc('week', now() at time zone 'America/New_York')::date
  )
  on conflict (user_id, day_key) where (type = 'bailout') do nothing;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

-- ── Public profile projection ────────────────────────────────────────────

-- Security-definer view (intentional): profiles RLS is select-own, but every
-- signed-in user needs the *display* identity of others (market creators,
-- leaderboards) without ever seeing a hidden real_name/email.
create view public.public_profiles as
select
  p.id,
  case p.display_mode
    when 'real' then coalesce(p.real_name, p.anon_handle)
    else p.anon_handle
  end as display_name,
  p.role
from public.profiles p;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;
