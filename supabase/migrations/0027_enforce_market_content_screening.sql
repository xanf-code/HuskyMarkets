-- Enforce market content screening at the database boundary.
--
-- create_market and update_market are callable by authenticated clients, so
-- p_auto_flagged is untrusted input. Re-screen the complete market after its
-- outcomes are written: hard-blocked content aborts the transaction, while
-- heuristic matches must have been acknowledged by the caller. On creation,
-- acknowledged content is already routed to pending review by create_market.

create function public._screen_market_content(p_text text)
returns table(blocked boolean, flagged boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sensitive boolean;
  v_has_name  boolean := false;
  v_match     text[];
  v_words     text[];
  v_allowlist constant text[] := array[
    'northeastern', 'husky', 'huskies', 'boston', 'snell', 'library',
    'curry', 'student', 'center', 'marino', 'matthews', 'arena',
    'krentzman', 'quad', 'centennial', 'common', 'commons', 'village',
    'west', 'east', 'north', 'south', 'international', 'hall', 'dining',
    'green', 'orange', 'red', 'blue', 'line', 'ruggles', 'copley',
    'fenway', 'symphony', 'huntington', 'columbus', 'avenue', 'ave',
    'street', 'mass', 'newbury', 'charles', 'river', 'esplanade',
    'spring', 'summer', 'fall', 'winter', 'thanksgiving', 'break',
    'commencement', 'orientation', 'homecoming', 'springfest',
    'will', 'does', 'do', 'is', 'are', 'can', 'could', 'should', 'would',
    'who', 'what', 'when', 'where', 'why', 'how', 'if', 'the', 'a', 'an',
    'everyone', 'anyone', 'someone', 'nobody', 'resolves', 'yes', 'no'
  ];
  i integer;
begin
  blocked := coalesce(p_text, '') ~*
    '\m(nigger|faggot|retard(ed)?|tranny|kike|chink|spic)\M';

  if blocked then
    flagged := true;
    return next;
    return;
  end if;

  v_sensitive := coalesce(p_text, '') ~*
    '\m(hook(s|ed|ing)?[[:space:]]+up|dat(e|es|ed|ing)|dump(s|ed|ing)?|cheat(s|ed|ing)?|expel(s|led|ling)?|expulsion|pregnan(t|cy)|sl(eep|ept)[[:space:]]+with|arrest(s|ed|ing)?|fired|drop(s|ped|ping)?[[:space:]]+out|br(eak|oke)[[:space:]]+up|overdos(e|ed|ing))\M';

  if v_sensitive then
    for v_match in
      select m
      from regexp_matches(
        coalesce(p_text, ''),
        '((?:[A-Z][a-z]+[[:space:]]+)+[A-Z][a-z]+)',
        'g'
      ) as matches(m)
    loop
      v_words := regexp_split_to_array(v_match[1], '[[:space:]]+');
      for i in 1 .. coalesce(array_length(v_words, 1), 1) - 1 loop
        if not lower(v_words[i]) = any(v_allowlist)
           and not lower(v_words[i + 1]) = any(v_allowlist) then
          v_has_name := true;
          exit;
        end if;
      end loop;
      exit when v_has_name;
    end loop;
  end if;

  flagged := v_sensitive and v_has_name;
  return next;
end;
$$;

create function public.enforce_market_content_screening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id uuid;
  v_text      text;
  v_blocked   boolean;
  v_flagged   boolean;
  v_acknowledged boolean;
begin
  for v_market_id in
    select distinct market_id from changed_outcomes
  loop
    select concat_ws(
      E'\n',
      m.title,
      m.description,
      m.resolution_criteria,
      string_agg(o.label, E'\n' order by o.sort_order)
    ), m.auto_flagged
    into v_text, v_acknowledged
    from public.markets m
    join public.market_outcomes o on o.market_id = m.id
    where m.id = v_market_id
    group by m.id, m.title, m.description, m.resolution_criteria,
             m.auto_flagged;

    select s.blocked, s.flagged
    into v_blocked, v_flagged
    from public._screen_market_content(v_text) as s;

    if v_blocked then
      raise exception 'market content violates community standards';
    end if;

    if v_flagged and not v_acknowledged then
      raise exception 'market content requires moderation';
    end if;
  end loop;

  return null;
end;
$$;

create trigger market_outcomes_screen_insert
after insert on public.market_outcomes
referencing new table as changed_outcomes
for each statement
execute function public.enforce_market_content_screening();

create trigger market_outcomes_screen_update
after update on public.market_outcomes
referencing new table as changed_outcomes
for each statement
execute function public.enforce_market_content_screening();

revoke execute on function public._screen_market_content(text)
  from public, anon, authenticated;
revoke execute on function public.enforce_market_content_screening()
  from public, anon, authenticated;
