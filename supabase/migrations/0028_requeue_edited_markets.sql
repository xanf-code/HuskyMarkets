-- Require another staff review when a creator changes the content of an
-- already-approved market. Without this, a creator can replace reviewed
-- content while the market remains open, provided no bets have been placed.

create or replace function public.update_market(
  p_market_id uuid,
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
  v_market public.markets%rowtype;
  v_labels text[];
  v_existing_labels text[];
  v_existing_catch_all boolean;
  v_content_changed boolean;
  v_count integer;
  v_catch_all constant text := 'None of the above';
  i integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;

  if v_market.creator_id <> v_uid and not public.is_admin() then
    raise exception 'not allowed';
  end if;

  if v_market.status <> 'open' then
    raise exception 'market not editable';
  end if;

  if exists (select 1 from public.bets where market_id = p_market_id) then
    raise exception 'market has bets';
  end if;

  -- Same label normalization as create_market (W3).
  select array_agg(regexp_replace(btrim(value), '\s+', ' ', 'g')) into v_labels
  from jsonb_array_elements_text(p_outcomes);

  if p_catch_all then
    v_labels := coalesce(v_labels, array[]::text[]) || v_catch_all;
  end if;

  v_count := coalesce(array_length(v_labels, 1), 0);
  if v_count < 2 or v_count > 6 then
    raise exception 'a market needs between 2 and 6 outcomes';
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

  select
    array_agg(label order by sort_order),
    coalesce(bool_or(is_catch_all), false)
  into v_existing_labels, v_existing_catch_all
  from public.market_outcomes
  where market_id = p_market_id;

  v_content_changed :=
    p_title is distinct from v_market.title
    or coalesce(p_description, '') is distinct from coalesce(v_market.description, '')
    or p_category is distinct from v_market.category
    or p_resolution_criteria is distinct from v_market.resolution_criteria
    or v_labels is distinct from v_existing_labels
    or p_catch_all is distinct from v_existing_catch_all;

  update public.markets
  set
    title = p_title,
    description = p_description,
    category = p_category,
    resolution_criteria = p_resolution_criteria,
    close_at = p_close_at,
    resolve_at = p_resolve_at,
    auto_flagged = p_auto_flagged,
    status = case
      when v_content_changed and not public.is_admin()
        then 'pending'::public.market_status
      else status
    end
  where id = p_market_id;

  -- The minimum-two constraint is immediate by default, so deleting the old
  -- outcomes otherwise aborts before their replacements can be inserted.
  -- It still validates the final outcome set at transaction commit.
  set constraints public.market_outcomes_min_two deferred;

  -- Replace outcomes: safe because bets/price_history are empty at this point.
  delete from public.market_outcomes where market_id = p_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select p_market_id, v_labels[ord], ord - 1, 100,
         (p_catch_all and ord = v_count)
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', p_market_id,
    'outcomes', public._outcome_map(p_market_id)
  );
end;
$$;

revoke execute on function public.update_market(uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  from public, anon;
grant execute on function public.update_market(uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  to authenticated;
