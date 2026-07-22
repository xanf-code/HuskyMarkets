-- ════════════════════════════════════════════════════════════════════════
-- 0019 · Market approval gate + rate limits
--
-- Adds:
--   • 'pending' / 'rejected' to market_status enum
--   • 'approve_market' / 'reject_market' to mod_action_type enum
--   • 'market_approved' / 'market_rejected' notification types
--   • app_config levers: trusted_market_count, market_daily_limit,
--     market_cooldown_seconds
--   • New-user gate + rate limits in create_market RPC (replace)
--   • review_market RPC for staff to approve/reject pending markets
--   • Updated RLS: pending/rejected hidden from non-owner/non-staff
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Extend enums ──────────────────────────────────────────────────────

alter type public.market_status add value if not exists 'pending';
alter type public.market_status add value if not exists 'rejected';

alter type public.mod_action_type add value if not exists 'approve_market';
alter type public.mod_action_type add value if not exists 'reject_market';

-- ── 2. Seed app_config levers ────────────────────────────────────────────

insert into public.app_config (key, int_val)
values ('trusted_market_count', 2)
on conflict (key) do nothing;

insert into public.app_config (key, int_val)
values ('market_daily_limit', 5)
on conflict (key) do nothing;

insert into public.app_config (key, int_val)
values ('market_cooldown_seconds', 300)
on conflict (key) do nothing;

-- ── 3. Broaden notifications type check ──────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'market_resolved',
    'market_voided',
    'market_approved',
    'market_rejected'
  ));

-- ── 4. Update markets SELECT policy to hide pending/rejected from public ──
-- Use ::text cast to avoid enum-comparison issues within this transaction.

drop policy if exists "markets: visible unless hidden" on public.markets;

create policy "markets: visible unless hidden or pending"
  on public.markets for select to authenticated
  using (
    (hidden = false and status::text not in ('pending', 'rejected'))
    or public.is_staff()
    or creator_id = (select auth.uid())
  );

-- ── 5. Mirror the new visibility in market_outcomes ──────────────────────

drop policy if exists "market_outcomes: visible with parent market"
  on public.market_outcomes;

create policy "market_outcomes: visible with parent market"
  on public.market_outcomes for select to authenticated
  using (
    exists (
      select 1 from public.markets m
      where m.id = market_outcomes.market_id
        and (
          (m.hidden = false and m.status::text not in ('pending', 'rejected'))
          or public.is_staff()
          or m.creator_id = (select auth.uid())
        )
    )
  );

-- ── 6. Replace create_market with rate-limited, trust-aware version ───────

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

  -- ── Rate limiting ───────────────────────────────────────────────────────
  select coalesce(
    (select int_val from public.app_config where key = 'market_cooldown_seconds'),
    300
  ) into v_cooldown_secs;

  select coalesce(
    (select int_val from public.app_config where key = 'market_daily_limit'),
    5
  ) into v_daily_limit;

  -- Cooldown: any market (including pending) in the last N seconds counts.
  select count(*) into v_recent_count
  from public.markets
  where creator_id = v_uid
    and created_at > now() - (v_cooldown_secs || ' seconds')::interval;

  if v_recent_count > 0 then
    raise exception 'rate_limited: please wait before creating another market';
  end if;

  -- Daily cap (rolling 24 h): includes all statuses.
  select count(*) into v_daily_count
  from public.markets
  where creator_id = v_uid
    and created_at > now() - interval '24 hours';

  if v_daily_count >= v_daily_limit then
    raise exception 'rate_limited: daily market creation limit reached';
  end if;

  -- ── Trust check ─────────────────────────────────────────────────────────
  if public.is_staff() then
    -- Staff always publish immediately.
    v_is_trusted := true;
  else
    select coalesce(
      (select int_val from public.app_config where key = 'trusted_market_count'),
      2
    ) into v_trusted_thresh;

    -- Count markets that have ever gone live (pending/rejected don't count).
    select count(*) into v_trusted_count
    from public.markets
    where creator_id = v_uid
      and status::text in ('open', 'closed', 'resolved', 'voided');

    v_is_trusted := v_trusted_count >= v_trusted_thresh;
  end if;

  -- Trusted + clean content → open immediately.
  -- Untrusted or auto-flagged → pending review.
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

-- ── 7. review_market RPC ─────────────────────────────────────────────────

create function public.review_market(
  p_market_id uuid,
  p_action    text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_market public.markets%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'invalid action: must be approve or reject';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  -- Staff-only gate + conflict-of-interest check (admins bypass COI).
  perform public.assert_can_moderate_market(v_market, v_uid);

  if v_market.status::text <> 'pending' then
    raise exception 'market is not pending review';
  end if;

  if p_action = 'approve' then
    update public.markets
    set status = 'open'
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'approve_market', p_market_id);

    -- In-app notification to creator; email skipped (approval is low-latency).
    insert into public.notifications (user_id, type, market_id, payload, email_status)
    values (
      v_market.creator_id,
      'market_approved',
      p_market_id,
      jsonb_build_object('market_title', v_market.title),
      'skipped'
    );
  else
    update public.markets
    set status = 'rejected'
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'reject_market', p_market_id);

    insert into public.notifications (user_id, type, market_id, payload, email_status)
    values (
      v_market.creator_id,
      'market_rejected',
      p_market_id,
      jsonb_build_object('market_title', v_market.title),
      'skipped'
    );
  end if;
end;
$$;

-- ── 8. Grant discipline ──────────────────────────────────────────────────

revoke execute on function public.review_market(uuid, text) from public, anon;
grant  execute on function public.review_market(uuid, text) to authenticated;
