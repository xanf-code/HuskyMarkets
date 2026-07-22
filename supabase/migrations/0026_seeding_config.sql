-- ════════════════════════════════════════════════════════════════════════
-- 0026 · Volume seeding config
--
-- Adds app_config levers for the bot volume-seeding pass that fills
-- each market to a configurable HC pool target regardless of edge.
-- Bot count + initial grant also live here so the seed script reads them.
-- ════════════════════════════════════════════════════════════════════════

insert into public.app_config (key, int_val) values
  ('ai_seeding_enabled',         1),
  ('ai_seeding_target_volume', 2500),
  ('ai_bot_count',               10),
  ('ai_bot_initial_grant',     5000)
on conflict (key) do nothing;
