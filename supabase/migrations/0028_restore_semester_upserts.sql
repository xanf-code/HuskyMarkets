-- 0028: Restore semester creation and editing through an admin-only RPC.
--
-- 0023 correctly removed direct table writes from authenticated clients, but
-- the admin semester form still wrote to public.semesters directly. Keep the
-- table locked down and expose only this validated security-definer operation.

create function public.upsert_semester(
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(p_name);
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'semester name must be 2-80 characters';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'semester end must be after start';
  end if;

  if p_id is null then
    insert into public.semesters (name, starts_at, ends_at)
    values (v_name, p_starts_at, p_ends_at)
    returning id into v_id;
  else
    update public.semesters
    set name = v_name,
        starts_at = p_starts_at,
        ends_at = p_ends_at
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'semester not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.upsert_semester(text, timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.upsert_semester(text, timestamptz, timestamptz, uuid)
  to authenticated;
