-- Serialize market creation per creator so concurrent RPC calls cannot all
-- observe the same pre-insert cooldown and daily-limit counts.

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
  v_uid             uuid := (select auth.uid());
  v_labels          text[];
  v_count           integer;
  v_max_outcomes    integer;
  v_market_id       uuid;
  v_catch_all       constant text := 'None of the above';
  i                 integer;

  -- Rate limits
  v_cooldown_secs   integer;
  v_daily_limit     integer;
  v_recent_count    integer;
  v_daily_count     integer;

  -- Trust check
  v_trusted_count   integer;
  v_trusted_thresh  integer;
  v_is_trusted      boolean;
  v_status          public.market_status;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'outcomes must be a JSON array of labels';
  end if;

  select array_agg(regexp_replace(btrim(value), '\s+', ' ', 'g')) into v_labels
  from jsonb_array_elements_text(p_outcomes);

  if p_catch_all then
    v_labels := coalesce(v_labels, array[]::text[]) || v_catch_all;
  end if;

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

  -- A profile row is the stable per-user mutex already used by place_bet.
  -- After a concurrent creator releases this lock, READ COMMITTED gives the
  -- count queries below a fresh snapshot that includes the committed market.
  perform 1
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  select coalesce(
    (select int_val from public.app_config where key = 'market_cooldown_seconds'),
    300
  ) into v_cooldown_secs;

  select coalesce(
    (select int_val from public.app_config where key = 'market_daily_limit'),
    5
  ) into v_daily_limit;

  select count(*) into v_recent_count
  from public.markets
  where creator_id = v_uid
    and created_at > now() - (v_cooldown_secs || ' seconds')::interval;

  if v_recent_count > 0 then
    raise exception 'rate_limited: please wait before creating another market';
  end if;

  select count(*) into v_daily_count
  from public.markets
  where creator_id = v_uid
    and created_at > now() - interval '24 hours';

  if v_daily_count >= v_daily_limit then
    raise exception 'rate_limited: daily market creation limit reached';
  end if;

  if public.is_staff() then
    v_is_trusted := true;
  else
    select coalesce(
      (select int_val from public.app_config where key = 'trusted_market_count'),
      2
    ) into v_trusted_thresh;

    select count(*) into v_trusted_count
    from public.markets
    where creator_id = v_uid
      and status::text in ('open', 'closed', 'resolved', 'voided');

    v_is_trusted := v_trusted_count >= v_trusted_thresh;
  end if;

  if v_is_trusted and not p_auto_flagged then
    v_status := 'open';
  else
    v_status := 'pending';
  end if;

  insert into public.markets
    (creator_id, title, description, category, resolution_criteria,
     close_at, resolve_at, status, auto_flagged)
  values
    (v_uid, p_title, p_description, p_category, p_resolution_criteria,
     p_close_at, p_resolve_at, v_status, p_auto_flagged)
  returning id into v_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select v_market_id, v_labels[ord], ord - 1, 100,
         (p_catch_all and ord = v_count)
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', v_market_id,
    'status',    v_status::text,
    'outcomes',  public._outcome_map(v_market_id)
  );
end;
$$;
