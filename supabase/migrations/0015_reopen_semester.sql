-- Undo a Hall of Fame freeze: clear snapshot rows for a semester (admin-only).

create function public.reopen_semester(p_semester_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if not exists (select 1 from public.semesters s where s.id = p_semester_id) then
    raise exception 'semester not found';
  end if;

  delete from public.hall_of_fame where semester_id = p_semester_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reopen_semester(uuid) from public, anon;
grant execute on function public.reopen_semester(uuid) to authenticated;
