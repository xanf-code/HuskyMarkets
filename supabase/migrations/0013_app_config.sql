-- W1: app_config - runtime lever for operational constants.
-- A single-row config table lets operators tune max_outcomes without a deploy.
-- Only service_role may write; authenticated/anon have read-only SELECT.

create table public.app_config (
  key        text    primary key,
  int_val    integer,
  updated_at timestamptz not null default now()
);

-- Seed the default outcome cap (mirrors the previous compile-time constant).
insert into public.app_config (key, int_val)
values ('max_outcomes', 6);

-- Read-only from client roles; all writes are service_role / migration only.
grant select on public.app_config to authenticated, anon;

-- Update create_market to read the cap at call time instead of embedding the
-- literal 6. The effective_max is greatest(2, configured) so the hard floor
-- of 2 cannot be bypassed even if the config row is set to 1.
create or replace function public.create_market(
  p_title text,
  p_description text,
  p_category public.market_category,
  p_resolution_criteria text,
  p_close_at timestamptz,
  p_resolve_at timestamptz,
  p_outcomes jsonb,
  p_catch_all boolean default false,
  p_auto_flagged boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_labels text[];
  v_count integer;
  v_max_outcomes integer;
  v_market_id uuid;
  v_catch_all constant text := 'None of the above';
  i integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'outcomes must be a JSON array of labels';
  end if;

  -- W3: normalize interior whitespace so "A  B" and "A B" collide.
  select array_agg(regexp_replace(btrim(value), '\s+', ' ', 'g')) into v_labels
  from jsonb_array_elements_text(p_outcomes);

  if p_catch_all then
    v_labels := coalesce(v_labels, array[]::text[]) || v_catch_all;
  end if;

  -- Read the runtime cap; fall back to 6 if the config row is absent.
  select greatest(2, coalesce(
    (select int_val from public.app_config where key = 'max_outcomes'),
    6
  )) into v_max_outcomes;

  v_count := coalesce(array_length(v_labels, 1), 0);
  if v_count < 2 or v_count > v_max_outcomes then
    raise exception 'a market needs between 2 and % outcomes', v_max_outcomes;
  end if;

  for i in 1 .. v_count loop
    if v_labels[i] is null or char_length(v_labels[i]) < 1
       or char_length(v_labels[i]) > 40 then
      raise exception 'outcome labels must be 1-40 characters';
    end if;
  end loop;

  if (select count(distinct lower(x)) from unnest(v_labels) as x) <> v_count then
    raise exception 'outcome labels must be unique (case-insensitive)';
  end if;

  if char_length(p_title) < 10 or char_length(p_title) > 120 then
    raise exception 'title must be 10-120 characters';
  end if;
  if char_length(p_resolution_criteria) < 20 then
    raise exception 'resolution criteria must be at least 20 characters';
  end if;
  if p_close_at <= now() then
    raise exception 'close time must be in the future';
  end if;
  if p_resolve_at < p_close_at then
    raise exception 'resolve time must be at or after the close time';
  end if;

  insert into public.markets
    (creator_id, title, description, category, resolution_criteria,
     close_at, resolve_at, status, auto_flagged)
  values
    (v_uid, p_title, p_description, p_category, p_resolution_criteria,
     p_close_at, p_resolve_at, 'open', p_auto_flagged)
  returning id into v_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select v_market_id, v_labels[ord], ord - 1, 100,
         (p_catch_all and ord = v_count)
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', v_market_id,
    'outcomes', public._outcome_map(v_market_id)
  );
end;
$$;
