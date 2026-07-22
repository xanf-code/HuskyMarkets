-- ════════════════════════════════════════════════════════════════════════
-- 0025 · AI market generation + bot trading infrastructure
--
-- Adds:
--   • app_config levers for AI features (kill switches + tuning)
--   • ai_market_proposals  — reviewer-facing research citations (staff-read)
--   • ai_trade_log         — per-decision trading audit log (staff-read)
--   • create_market_ai()   — service_role-only RPC, skips rate limits,
--                            always sets status='pending'
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. App config levers ─────────────────────────────────────────────────

insert into public.app_config (key, int_val) values
  ('ai_markets_enabled',             1),
  ('ai_trading_enabled',             1),
  ('ai_trade_edge_threshold',       15),
  ('ai_trade_min_bet',              25),
  ('ai_trade_max_bet',             150),
  ('ai_trade_markets_per_bot_run',   3)
on conflict (key) do nothing;

-- ── 2. AI market proposals (reviewer-facing research citations) ──────────

create table public.ai_market_proposals (
  market_id        uuid primary key references public.markets(id) on delete cascade,
  sources          jsonb    not null default '[]'::jsonb,
  research_summary text,
  model            text     not null,
  created_at       timestamptz not null default now()
);

alter table public.ai_market_proposals enable row level security;

create policy "ai_proposals: staff read"
  on public.ai_market_proposals
  for select to authenticated
  using (public.is_staff());

-- Writes come from service_role only (bypasses RLS by default).

-- ── 3. AI trade decision log ─────────────────────────────────────────────

create table public.ai_trade_log (
  id           uuid primary key default gen_random_uuid(),
  bot_user_id  uuid not null references public.profiles(id),
  market_id    uuid not null references public.markets(id) on delete cascade,
  outcome_id   uuid,
  action       text not null check (action in ('bet', 'skip', 'error')),
  est_prob     integer,
  implied      integer,
  edge         integer,
  amount       integer,
  reasoning    text,
  created_at   timestamptz not null default now()
);

alter table public.ai_trade_log enable row level security;

create policy "ai_trade_log: staff read"
  on public.ai_trade_log
  for select to authenticated
  using (public.is_staff());

create index ai_trade_log_bot_market_idx
  on public.ai_trade_log (bot_user_id, market_id, created_at desc);

-- ── 4. create_market_ai — validation-only, service_role gate ─────────────
-- Copies validation logic from 0019 create_market but:
--   • skips rate limits and trust checks
--   • always sets status = 'pending'
--   • takes explicit p_creator_id (service_role acts on behalf of AI account)
--   • no catch-all param (AI supplies all outcome labels explicitly)

create function public.create_market_ai(
  p_creator_id          uuid,
  p_title               text,
  p_description         text,
  p_category            public.market_category,
  p_resolution_criteria text,
  p_close_at            timestamptz,
  p_resolve_at          timestamptz,
  p_outcomes            jsonb,
  p_auto_flagged        boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_labels       text[];
  v_count        integer;
  v_max_outcomes integer;
  v_market_id    uuid;
  i              integer;
begin
  -- Caller must supply a real creator profile.
  if p_creator_id is null then
    raise exception 'p_creator_id is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_creator_id) then
    raise exception 'creator profile not found';
  end if;

  if jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'outcomes must be a JSON array of labels';
  end if;

  -- Normalise interior whitespace (mirrors create_market W3).
  select array_agg(regexp_replace(btrim(value), '\s+', ' ', 'g'))
    into v_labels
  from jsonb_array_elements_text(p_outcomes);

  select greatest(2, coalesce(
    (select int_val from public.app_config where key = 'max_outcomes'),
    6
  )) into v_max_outcomes;

  v_count := coalesce(array_length(v_labels, 1), 0);
  if v_count < 2 or v_count > v_max_outcomes then
    raise exception 'a market needs between 2 and % outcomes', v_max_outcomes;
  end if;

  for i in 1 .. v_count loop
    if v_labels[i] is null
       or char_length(v_labels[i]) < 1
       or char_length(v_labels[i]) > 40 then
      raise exception 'outcome labels must be 1–40 characters';
    end if;
  end loop;

  if (select count(distinct lower(x)) from unnest(v_labels) as x) <> v_count then
    raise exception 'outcome labels must be unique (case-insensitive)';
  end if;

  if char_length(p_title) < 10 or char_length(p_title) > 120 then
    raise exception 'title must be 10–120 characters';
  end if;

  if char_length(p_resolution_criteria) < 20 then
    raise exception 'resolution criteria must be at least 20 characters';
  end if;

  if p_close_at <= now() then
    raise exception 'close time must be in the future';
  end if;

  if p_resolve_at < p_close_at then
    raise exception 'resolve time must be at or after close time';
  end if;

  insert into public.markets
    (creator_id, title, description, category, resolution_criteria,
     close_at, resolve_at, status, auto_flagged)
  values
    (p_creator_id, p_title, p_description, p_category, p_resolution_criteria,
     p_close_at, p_resolve_at, 'pending', p_auto_flagged)
  returning id into v_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select v_market_id, v_labels[ord], ord - 1, 100, false
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', v_market_id,
    'status',    'pending',
    'outcomes',  public._outcome_map(v_market_id)
  );
end;
$$;

-- Grant exclusively to service_role; all other roles are revoked.
revoke execute on function public.create_market_ai(
  uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean
) from public, anon, authenticated;

grant execute on function public.create_market_ai(
  uuid, text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean
) to service_role;
