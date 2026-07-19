-- Phase 7: the balance chip subscribes to the signed-in user's transactions
-- inserts. RLS ("transactions: select own or admin") scopes realtime delivery
-- to the owner; replica identity default suffices for INSERT events.
alter publication supabase_realtime add table public.transactions;
