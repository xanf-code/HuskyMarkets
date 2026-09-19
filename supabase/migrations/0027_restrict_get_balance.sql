-- 0027: Keep arbitrary-user balance lookup internal to SECURITY DEFINER RPCs.
--
-- get_balance(uuid) bypasses transactions RLS and accepts any profile id, so
-- exposing it to authenticated clients reveals every user's exact balance.
-- Client code already uses get_my_balance(), which scopes lookup to auth.uid().

revoke execute on function public.get_balance(uuid)
  from public, anon, authenticated;
