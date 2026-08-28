-- 0027: Keep anonymous-handle allocation available beyond 2,000 profiles.
--
-- The original generator had only 20 adjectives × 100 numeric suffixes and
-- retried forever once every combination was occupied. Because it runs inside
-- the auth.users signup trigger, exhausting that namespace hangs every future
-- signup. Expand the suffix to six digits and cap retries so collisions can
-- never become an unbounded database loop.

create or replace function public.gen_anon_handle()
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
  for v_attempt in 1 .. 100 loop
    v_handle := v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int]
      || 'Husky'
      || lpad(floor(random() * 1000000)::int::text, 6, '0');

    if not exists (
      select 1 from public.profiles p where p.anon_handle = v_handle
    ) then
      return v_handle;
    end if;
  end loop;

  raise exception 'unable to allocate a unique anonymous handle';
end;
$$;
