-- Phase E-1 · 0011 — Multi-outcome parimutuel: schema, migration, engine, cron.
--
-- ONE-WAY DOOR. This whole file is applied as a single transaction (Supabase
-- wraps each migration file). The sequence is expand → backfill → verify →
-- contract: a verification failure RAISEs and rolls the entire migration back
-- byte-identical (AD-3, NFR-8). Nothing destructive runs before every
-- verification has passed.
--
-- Money math is FROZEN (C-7): 5% vig, 100 HC/outcome seed, 500 HC aggregate
-- cap. Only its dimensionality (2 → N) changes. Binary markets become the N=2
-- case of one engine (C-5); there is no dual path.
--
-- Generalized ledger invariant (REC-1), shipped as verify_ledger_invariant():
--   Σ(user tx) + Σ(vig_burn) − Σ_{m : seed entered}(100 × outcome_count(m)) = Σ(grants)
-- The seed enters the ledger for a market exactly when it produced a vig_burn
-- (the payout path). Void and empty-winner markets refund stakes and burn
-- nothing, so their seed never enters and they are excluded — this generalizes
-- REC-1's "voided markets stay excluded" to every refund path.

-- ════════════════════════════════════════════════════════════════════════
-- 0. Drop old engine functions that block the type/column changes below.
--    (plpgsql bodies are late-bound, so handle_report's call to resolve_market
--    does not pin the old signature; the new 3-arg form serves it by default.)
-- ════════════════════════════════════════════════════════════════════════

drop function if exists public.place_bet(uuid, public.bet_side, integer);
drop function if exists public.resolve_market(uuid, text);

-- Drop the markets INSERT policy now: it references status = 'open', which
-- would block the market_status type rebuild in section 6, and create_market
-- becomes the sole creation path anyway (AD-7).
drop policy if exists "markets: create own open future market" on public.markets;

-- ════════════════════════════════════════════════════════════════════════
-- 1. market_outcomes table + composite-FK plumbing (expand).
-- ════════════════════════════════════════════════════════════════════════

create table public.market_outcomes (
  id           uuid primary key default gen_random_uuid(),
  market_id    uuid not null references public.markets (id) on delete cascade,
  label        text not null
    check (char_length(btrim(label)) between 1 and 40),
  sort_order   integer not null,
  pool         integer not null default 100 check (pool >= 0),
  is_catch_all boolean not null default false,
  created_at   timestamptz not null default now(),
  -- Target for the composite FKs below: makes a cross-market winner/bet
  -- unrepresentable at the schema level (AD-5, REC-2).
  unique (id, market_id),
  unique (market_id, sort_order)
);

-- Canonical display order everywhere is sort_order (Missing Consideration 9).
create index market_outcomes_market_sort_idx
  on public.market_outcomes (market_id, sort_order);
-- Case-insensitive label uniqueness within a market (AD-6, REC-3).
create unique index market_outcomes_label_ci_idx
  on public.market_outcomes (market_id, lower(btrim(label)));

-- markets.winning_outcome_id must be an outcome *of this market* (AD-5).
alter table public.markets
  add column winning_outcome_id uuid,
  add constraint markets_winning_outcome_fk
    foreign key (winning_outcome_id, id)
    references public.market_outcomes (id, market_id) on delete restrict;

-- bets.outcome_id must belong to the bet's market (FR-10 at schema level).
alter table public.bets
  add column outcome_id uuid,
  add constraint bets_outcome_fk
    foreign key (outcome_id, market_id)
    references public.market_outcomes (id, market_id);

-- price_history becomes per-outcome; new columns nullable until backfilled.
alter table public.price_history
  add column outcome_id uuid,
  add column implied integer,
  add column pool integer;
alter table public.price_history
  alter column implied_yes drop not null,
  alter column yes_pool drop not null,
  alter column no_pool drop not null;

-- mod_actions records which outcome won (REC-11).
alter table public.mod_actions add column outcome_id uuid;

-- Belt-and-braces: a market can never drop below 2 outcomes (REC-4, FR-5).
create function public.market_outcomes_min_two()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.markets m where m.id = old.market_id)
     and (select count(*) from public.market_outcomes o
          where o.market_id = old.market_id) < 2 then
    raise exception 'a market must keep at least 2 outcomes';
  end if;
  return null;
end;
$$;

create constraint trigger market_outcomes_min_two
  after delete on public.market_outcomes
  deferrable initially immediate
  for each row execute function public.market_outcomes_min_two();

-- ════════════════════════════════════════════════════════════════════════
-- 2. Freeze the world (AR-7), then snapshot pre-backfill aggregates so the
--    verification step can catch a backfill that silently changed the data.
-- ════════════════════════════════════════════════════════════════════════

lock table public.markets, public.bets, public.price_history in exclusive mode;

create temp table _v_counts on commit drop as
  select (select count(*) from public.markets)       as markets,
         (select count(*) from public.bets)          as bets,
         (select count(*) from public.price_history) as price_history;

create temp table _v_pools on commit drop as
  select id as market_id, yes_pool, no_pool from public.markets;

-- Legacy stakes keyed to the sort_order each side will map to (yes→0, no→1).
create temp table _v_stakes on commit drop as
  select market_id,
         (case side when 'yes' then 0 else 1 end) as sort_order,
         sum(amount)::bigint as stake,
         count(*)::bigint    as cnt
  from public.bets
  group by market_id, side;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Backfill (FR-31, FR-32, AR-6, REC-6). Status/action are still the legacy
--    enum values here, so winning side is still recoverable.
-- ════════════════════════════════════════════════════════════════════════

-- Yes (sort 0) and No (sort 1) outcomes, inheriting the market's created_at.
insert into public.market_outcomes (market_id, label, sort_order, pool, created_at)
select m.id, 'Yes', 0, m.yes_pool, m.created_at from public.markets m
union all
select m.id, 'No', 1, m.no_pool, m.created_at from public.markets m;

-- Map each bet to its outcome.
update public.bets b
set outcome_id = o.id
from public.market_outcomes o
where o.market_id = b.market_id
  and o.sort_order = (case b.side when 'yes' then 0 else 1 end);

-- AR-6: legacy price_at_bet stored the implied-YES price regardless of side.
-- Rewrite NO bets to the complement so portfolio history reads correctly.
update public.bets b
set price_at_bet = least(greatest(100 - price_at_bet, 1), 99)
where b.side = 'no';

-- Split each legacy price snapshot into one row per outcome, same recorded_at.
insert into public.price_history (market_id, outcome_id, implied, pool, recorded_at)
select ph.market_id, o.id, ph.implied_yes, ph.yes_pool, ph.recorded_at
from public.price_history ph
join public.market_outcomes o on o.market_id = ph.market_id and o.sort_order = 0
where ph.outcome_id is null
union all
select ph.market_id, o.id,
       least(greatest(100 - ph.implied_yes, 1), 99), ph.no_pool, ph.recorded_at
from public.price_history ph
join public.market_outcomes o on o.market_id = ph.market_id and o.sort_order = 1
where ph.outcome_id is null;

-- Remove the original two-sided rows now that per-outcome rows exist.
delete from public.price_history where outcome_id is null;

-- winning_outcome_id from the legacy resolved_yes/resolved_no status.
update public.markets m
set winning_outcome_id = o.id
from public.market_outcomes o
where o.market_id = m.id
  and m.status in ('resolved_yes', 'resolved_no')
  and o.sort_order = (case m.status when 'resolved_yes' then 0 else 1 end);

-- mod_actions.outcome_id from the legacy resolve_yes/resolve_no audit rows.
update public.mod_actions a
set outcome_id = o.id
from public.market_outcomes o
where o.market_id = a.market_id
  and a.action in ('resolve_yes', 'resolve_no')
  and o.sort_order = (case a.action when 'resolve_yes' then 0 else 1 end);

-- ════════════════════════════════════════════════════════════════════════
-- 4. In-transaction verification. Every check RAISEs (NFR-8). Row counts alone
--    can pass on wrong data (AR-4), so we also check pool-sum and stake-sum
--    against the pre-backfill snapshot (REC-6).
-- ════════════════════════════════════════════════════════════════════════

-- >>> VERIFY <<<
do $$
begin
  if (select count(*) from public.market_outcomes)
     <> 2 * (select markets from _v_counts) then
    raise exception 'migration verify: expected exactly 2 outcomes per market';
  end if;

  if exists (select 1 from public.bets where outcome_id is null) then
    raise exception 'migration verify: bets with null outcome_id remain';
  end if;

  if (select count(*) from public.bets) <> (select bets from _v_counts) then
    raise exception 'migration verify: bet count changed during backfill';
  end if;

  if (select count(*) from public.price_history)
     <> 2 * (select price_history from _v_counts) then
    raise exception 'migration verify: price_history not doubled per outcome';
  end if;

  -- Σ outcome pools = old yes_pool + no_pool, per market.
  if exists (
    select 1
    from _v_pools p
    join (select market_id, sum(pool) as s
          from public.market_outcomes group by market_id) o
      on o.market_id = p.market_id
    where o.s <> p.yes_pool + p.no_pool
  ) then
    raise exception 'migration verify: per-market pool-sum mismatch';
  end if;

  -- Stake and bet-count preserved, per market and outcome.
  if exists (
    select 1
    from _v_stakes v
    full join (
      select b.market_id, o.sort_order,
             sum(b.amount)::bigint as stake, count(*)::bigint as cnt
      from public.bets b
      join public.market_outcomes o on o.id = b.outcome_id
      group by b.market_id, o.sort_order
    ) cur on cur.market_id = v.market_id and cur.sort_order = v.sort_order
    where coalesce(v.stake, 0) <> coalesce(cur.stake, 0)
       or coalesce(v.cnt, 0)   <> coalesce(cur.cnt, 0)
  ) then
    raise exception 'migration verify: per-outcome stake-sum mismatch';
  end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Lock in NOT NULL, then contract (drop legacy) — only after verify passed.
-- ════════════════════════════════════════════════════════════════════════

alter table public.bets alter column outcome_id set not null;
alter table public.price_history
  alter column outcome_id set not null,
  alter column implied set not null,
  alter column pool set not null;

-- price_history per-outcome FK + access index (REC-5).
alter table public.price_history
  add constraint price_history_outcome_fk
    foreign key (outcome_id, market_id)
    references public.market_outcomes (id, market_id);
create index price_history_market_outcome_recorded_idx
  on public.price_history (market_id, outcome_id, recorded_at);

-- W3: the new three-column index (market_id, outcome_id, recorded_at) supersedes
-- the legacy two-column index (market_id, recorded_at) created in 0001. Keeping
-- both would double the write cost on place_bet's per-outcome snapshot insert.
drop index if exists public.price_history_market_recorded_idx;

alter table public.markets drop column yes_pool, drop column no_pool;
alter table public.bets drop column side;
alter table public.price_history
  drop column implied_yes, drop column yes_pool, drop column no_pool;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Enum type rebuild (AD-4). Postgres cannot remove enum values, so create a
--    new type, remap the column, and drop the old. Winner/action facts were
--    captured above while the legacy values still existed.
-- ════════════════════════════════════════════════════════════════════════

alter type public.market_status rename to market_status_old;
create type public.market_status as enum ('open', 'closed', 'resolved', 'voided');
alter table public.markets alter column status drop default;
alter table public.markets
  alter column status type public.market_status
  using (case status::text
           when 'resolved_yes' then 'resolved'
           when 'resolved_no'  then 'resolved'
           else status::text
         end)::public.market_status;
alter table public.markets alter column status set default 'open';
drop type public.market_status_old;
-- markets_status_close_idx is rebuilt automatically by the column type rewrite.

alter type public.mod_action_type rename to mod_action_type_old;
create type public.mod_action_type as enum
  ('resolve', 'void', 'lock', 'report_dismiss', 'report_action', 'hide', 'mod_revoke');
alter table public.mod_actions
  alter column action type public.mod_action_type
  using (case action::text
           when 'resolve_yes' then 'resolve'
           when 'resolve_no'  then 'resolve'
           else action::text
         end)::public.mod_action_type;
drop type public.mod_action_type_old;

-- bet_side is no longer referenced by any column or live function.
drop type public.bet_side;

-- ════════════════════════════════════════════════════════════════════════
-- 7. RLS + creation-path discipline.
-- ════════════════════════════════════════════════════════════════════════

alter table public.market_outcomes enable row level security;

-- Readable iff the parent market is readable to that user, INCLUDING the
-- hidden-market filter (REC-14) — mirrors "markets: visible unless hidden".
create policy "market_outcomes: visible with parent market"
  on public.market_outcomes for select to authenticated
  using (
    exists (
      select 1 from public.markets m
      where m.id = market_outcomes.market_id
        and (m.hidden = false
             or public.is_staff()
             or m.creator_id = (select auth.uid()))
    )
  );
-- No INSERT/UPDATE/DELETE policies: only the definer create_market writes here.
-- (The markets INSERT policy was already dropped at the top of this migration.)

-- ════════════════════════════════════════════════════════════════════════
-- 8. Engine RPCs (N-outcome). Money math identical to 0006, generalized 2 → N.
-- ════════════════════════════════════════════════════════════════════════

-- Ordered outcome map with implied prices; shared by create_market/place_bet.
create function public._outcome_map(p_market_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'sort_order', o.sort_order,
           'pool', o.pool,
           'implied', least(greatest(round(100.0 * o.pool / t.total)::int, 1), 99)
         ) order by o.sort_order), '[]'::jsonb)
  from public.market_outcomes o
  cross join (select sum(pool) as total from public.market_outcomes
              where market_id = p_market_id) t
  where o.market_id = p_market_id;
$$;

-- create_market: atomic market + 2–6 outcomes, each seeded 100 HC (FR-1..FR-5).
-- Structural validation only; content-rule screening remains in the server
-- action (flagContent), matching today's title handling — the caller passes
-- p_auto_flagged. (E-2 extends screening to outcome labels; REC-15.)
create function public.create_market(
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
  v_labels text[];
  v_count integer;
  v_market_id uuid;
  v_catch_all constant text := 'None of the above';
  i integer;
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

  insert into public.markets
    (creator_id, title, description, category, resolution_criteria,
     close_at, resolve_at, status, auto_flagged)
  values
    (v_uid, p_title, p_description, p_category, p_resolution_criteria,
     p_close_at, p_resolve_at, 'open', p_auto_flagged)
  returning id into v_market_id;

  insert into public.market_outcomes (market_id, label, sort_order, pool, is_catch_all)
  select v_market_id, v_labels[ord], ord - 1, 100,
         (p_catch_all and ord = v_count)
  from generate_series(1, v_count) as g(ord);

  return jsonb_build_object(
    'market_id', v_market_id,
    'outcomes', public._outcome_map(v_market_id)
  );
end;
$$;

-- place_bet: locks the markets row first (AD-2), aggregate cap across all
-- outcomes (FR-9), composite-FK-backed membership (FR-10), N snapshot rows
-- (FR-12, REC-20), returns the full outcome map + new balance (FR-13, REC-12).
create function public.place_bet(
  p_market_id uuid,
  p_outcome_id uuid,
  p_amount integer
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
  v_existing integer;
  v_outcome_pool integer;
  v_total integer;
  v_price integer;
  v_bet_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount < 1 or p_amount > 500 then
    raise exception 'bet amount must be between 1 and 500';
  end if;

  -- Serialize all bets on this market on the markets row (AD-2).
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;
  if v_market.status <> 'open' or now() >= v_market.close_at then
    raise exception 'market closed';
  end if;

  -- Wallet lock (preserve markets → profiles lock order).
  perform 1 from public.profiles where id = v_uid for update;
  if public.get_balance(v_uid) < p_amount then
    raise exception 'insufficient balance';
  end if;

  -- 500 HC cap is the aggregate across every outcome of this market (FR-9).
  select coalesce(sum(amount), 0) into v_existing
  from public.bets where market_id = p_market_id and user_id = v_uid;
  if v_existing + p_amount > 500 then
    raise exception 'per-market cap of 500 HC exceeded';
  end if;

  select pool into v_outcome_pool from public.market_outcomes
  where id = p_outcome_id and market_id = p_market_id
  for update;
  if not found then
    raise exception 'outcome does not belong to this market';
  end if;

  select sum(pool) into v_total from public.market_outcomes
  where market_id = p_market_id;

  -- Implied price of the chosen outcome *before* the stake moves the pools.
  v_price := least(greatest(round(100.0 * v_outcome_pool / v_total)::int, 1), 99);

  insert into public.bets (market_id, user_id, outcome_id, amount, price_at_bet)
  values (p_market_id, v_uid, p_outcome_id, p_amount, v_price)
  returning id into v_bet_id;

  insert into public.transactions (user_id, type, amount, market_id, bet_id)
  values (v_uid, 'bet_place', -p_amount, p_market_id, v_bet_id);

  update public.market_outcomes set pool = pool + p_amount where id = p_outcome_id;

  -- Snapshot the post-bet price of EVERY outcome (FR-12). Do not optimize this
  -- all-outcome snapshot away — charts depend on it (REC-20).
  insert into public.price_history (market_id, outcome_id, implied, pool, recorded_at)
  select o.market_id, o.id,
         least(greatest(round(100.0 * o.pool / t.total)::int, 1), 99),
         o.pool, now()
  from public.market_outcomes o
  cross join (select sum(pool) as total from public.market_outcomes
              where market_id = p_market_id) t
  where o.market_id = p_market_id;

  return jsonb_build_object(
    'bet_id', v_bet_id,
    'new_balance', public.get_balance(v_uid),
    'outcomes', public._outcome_map(p_market_id)
  );
end;
$$;

-- resolve_market: explicit resolve/void discriminant, no null-sentinel
-- (REC-10). Vig/dust/empty-winner math is identical to 0006 (C-7).
create function public.resolve_market(
  p_market_id uuid,
  p_action text,
  p_winning_outcome_id uuid default null
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
  v_total integer;
  v_vig integer;
  v_after integer;
  v_winning_pool integer;
  v_winning_bettors integer;
  v_paid integer := 0;
  v_refunded integer := 0;
  v_burn integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_action not in ('resolve', 'void') then
    raise exception 'invalid action: must be resolve or void';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market not found';
  end if;

  perform public.assert_can_moderate_market(v_market, v_uid);

  if v_market.status not in ('open', 'closed') then
    raise exception 'market already resolved';
  end if;

  if p_action = 'void' then
    insert into public.transactions (user_id, type, amount, market_id)
    select b.user_id, 'market_refund', sum(b.amount), p_market_id
    from public.bets b where b.market_id = p_market_id group by b.user_id;

    update public.markets
    set status = 'voided', resolved_by = v_uid, resolved_at = now()
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id)
    values (v_uid, 'void', p_market_id);
  else
    if p_winning_outcome_id is null then
      raise exception 'resolve requires a winning outcome';
    end if;

    select pool into v_winning_pool from public.market_outcomes
    where id = p_winning_outcome_id and market_id = p_market_id;
    if not found then
      raise exception 'winning outcome does not belong to this market';
    end if;

    select sum(pool) into v_total from public.market_outcomes
    where market_id = p_market_id;
    v_vig := v_total * 5 / 100;      -- integer division floors
    v_after := v_total - v_vig;

    select count(distinct b.user_id) into v_winning_bettors
    from public.bets b
    where b.market_id = p_market_id and b.outcome_id = p_winning_outcome_id;

    if v_winning_bettors = 0 then
      -- Nobody backed the winner: refund everyone, burn nothing (FR-17).
      insert into public.transactions (user_id, type, amount, market_id)
      select b.user_id, 'market_refund', sum(b.amount), p_market_id
      from public.bets b where b.market_id = p_market_id group by b.user_id;
    else
      insert into public.transactions (user_id, type, amount, market_id)
      select w.user_id, 'bet_payout', (w.stake * v_after) / v_winning_pool, p_market_id
      from (
        select b.user_id, sum(b.amount) as stake
        from public.bets b
        where b.market_id = p_market_id and b.outcome_id = p_winning_outcome_id
        group by b.user_id
      ) w;

      select coalesce(sum(t.amount), 0) into v_paid
      from public.transactions t
      where t.market_id = p_market_id and t.type = 'bet_payout';

      v_burn := v_total - v_paid;    -- vig + house share + rounding dust
      insert into public.transactions (user_id, type, amount, market_id)
      values (null, 'vig_burn', v_burn, p_market_id);
    end if;

    update public.markets
    set status = 'resolved', winning_outcome_id = p_winning_outcome_id,
        resolved_by = v_uid, resolved_at = now()
    where id = p_market_id;

    insert into public.mod_actions (moderator_id, action, market_id, outcome_id)
    values (v_uid, 'resolve', p_market_id, p_winning_outcome_id);
  end if;

  select coalesce(sum(t.amount), 0) into v_refunded
  from public.transactions t
  where t.market_id = p_market_id and t.type = 'market_refund';

  return jsonb_build_object(
    'status', (select status from public.markets where id = p_market_id),
    'paid_out', v_paid,
    'refunded', v_refunded,
    'burned', coalesce(v_burn, 0)
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. Leaderboard/stats: recreated so they no longer reference removed enum
--    values. Win = the user's bet outcome matched the winning outcome (FR-19).
--    (E-5 confirms the surrounding display; these bodies are the DB half.)
-- ════════════════════════════════════════════════════════════════════════

-- W2: drop the old 1-arg overloads so the new default-arg versions are the
-- canonical signatures; callers with 1 arg still work via PostgreSQL defaults.
drop function if exists public.get_accuracy_leaderboard(uuid);
drop function if exists public.get_profile_stats(uuid);

-- p_resolved_before: when set, only markets resolved strictly before this
-- timestamp are counted — scopes the re-captured board to the pre-snapshot
-- window so post-snapshot activity never causes a false reconciliation failure.
create function public.get_accuracy_leaderboard(
  p_semester_id uuid,
  p_resolved_before timestamptz default null
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  wins integer,
  losses integer,
  win_rate numeric,
  volume integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sem as (
    select s.starts_at, s.ends_at
    from public.semesters s
    where s.id = p_semester_id
  ),
  resolved as (
    select
      b.user_id,
      b.amount,
      (m.winning_outcome_id = b.outcome_id) as won
    from public.bets b
    join public.markets m on m.id = b.market_id
    cross join sem
    where m.status = 'resolved'
      and m.winning_outcome_id is not null
      and m.resolved_at is not null
      and m.resolved_at >= sem.starts_at
      and m.resolved_at < sem.ends_at
      and (p_resolved_before is null or m.resolved_at < p_resolved_before)
  ),
  agg as (
    select
      r.user_id,
      count(*)::integer as bets,
      count(*) filter (where r.won)::integer as wins,
      count(*) filter (where not r.won)::integer as losses,
      coalesce(sum(r.amount), 0)::integer as volume
    from resolved r
    group by r.user_id
    having count(*) >= 10
  )
  select
    (row_number() over (
      order by (a.wins::numeric / a.bets) desc, a.volume desc, a.user_id
    ))::integer as rank,
    a.user_id,
    pp.display_name,
    a.wins,
    a.losses,
    round(a.wins::numeric / a.bets, 4) as win_rate,
    a.volume
  from agg a
  join public.public_profiles pp on pp.id = a.user_id
  order by win_rate desc, a.volume desc, a.user_id;
$$;

create function public.get_profile_stats(
  p_user uuid,
  p_resolved_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_biggest_win integer;
  v_worst_loss integer;
  v_streak integer := 0;
  v_direction integer := 0;
  r record;
begin
  select coalesce(max(t.amount), 0) into v_biggest_win
  from public.transactions t
  where t.user_id = p_user
    and t.type = 'bet_payout'
    and (p_resolved_before is null or t.created_at < p_resolved_before);

  -- Worst loss: largest stake on non-winning outcomes of a resolved market.
  select coalesce(max(lost.stake), 0) into v_worst_loss
  from (
    select b.market_id, sum(b.amount)::integer as stake
    from public.bets b
    join public.markets m on m.id = b.market_id
    where b.user_id = p_user
      and m.status = 'resolved'
      and m.winning_outcome_id is not null
      and b.outcome_id <> m.winning_outcome_id
      and (p_resolved_before is null or m.resolved_at < p_resolved_before)
    group by b.market_id
  ) lost;

  for r in
    select exists (
      select 1 from public.bets b
      where b.market_id = m.id and b.user_id = p_user
        and b.outcome_id = m.winning_outcome_id
    ) as won
    from public.markets m
    where m.status = 'resolved'
      and m.winning_outcome_id is not null
      and m.resolved_at is not null
      and (p_resolved_before is null or m.resolved_at < p_resolved_before)
      and exists (
        select 1 from public.bets b
        where b.market_id = m.id and b.user_id = p_user
      )
    order by m.resolved_at desc, m.created_at desc
  loop
    if v_direction = 0 then
      v_direction := case when r.won then 1 else -1 end;
      v_streak := v_direction;
    elsif (r.won and v_direction = 1) or (not r.won and v_direction = -1) then
      v_streak := v_streak + v_direction;
    else
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'biggest_win', v_biggest_win,
    'worst_loss', v_worst_loss,
    'current_streak', v_streak
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 10. Share-card RPCs — N-outcome bodies (D-2). Replaces the 0010 stubs now
--     that market_outcomes exists.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.get_market_card(p_market_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', m.id,
    'title', m.title,
    'category', m.category,
    'created_at', m.created_at,
    'close_at', m.close_at,
    'status', m.status,
    'outcomes', public._outcome_map(m.id),
    'leading', (
      select json_build_object('label', o.label, 'implied',
               least(greatest(round(100.0 * o.pool /
                 (select sum(pool) from public.market_outcomes where market_id = m.id))::int, 1), 99))
      from public.market_outcomes o
      where o.market_id = m.id
      order by o.pool desc, o.sort_order
      limit 1
    )
  )
  from public.markets m
  where m.id = p_market_id
    and (m.hidden = false or public.is_staff());
$$;

create or replace function public.get_share_card(p_bet_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'bet_id', b.id,
    'market_id', b.market_id,
    'amount', b.amount,
    'price_at_bet', b.price_at_bet,
    'outcome_label', o.label,
    'market_title', m.title,
    'payout', coalesce((
      select sum(t.amount) from public.transactions t
      where t.user_id = b.user_id and t.market_id = b.market_id
        and t.type = 'bet_payout'
    ), 0),
    'display_name', coalesce((
      select p.display_name from public.public_profiles p
      where p.id = b.user_id
    ), 'Unknown Husky')
  )
  from public.bets b
  join public.markets m on m.id = b.market_id
  join public.market_outcomes o on o.id = b.outcome_id
  where b.id = p_bet_id
    and (b.user_id = (select auth.uid()) or public.is_staff());
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 11. verify_ledger_invariant() — the money canary (REC-1, REC-16). Seed term
--     is summed per market and only for markets whose seed entered the ledger
--     (i.e. produced a vig_burn); void/empty-winner refund paths are excluded.
-- ════════════════════════════════════════════════════════════════════════

create function public.verify_ledger_invariant()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with parts as (
    select
      coalesce((select sum(amount) from public.transactions
                where user_id is not null), 0)::bigint as user_tx,
      coalesce((select sum(amount) from public.transactions
                where type = 'vig_burn'), 0)::bigint as vig_burn,
      coalesce((select sum(amount) from public.transactions
                where type in ('signup_grant', 'daily_bonus', 'bailout')), 0)::bigint as grants,
      coalesce((
        select sum(100 * (select count(*) from public.market_outcomes o
                          where o.market_id = m.id))
        from public.markets m
        where exists (select 1 from public.transactions t
                      where t.market_id = m.id and t.type = 'vig_burn')
      ), 0)::bigint as seed
  )
  select jsonb_build_object(
    'balanced', (user_tx + vig_burn - seed) = grants,
    'delta', (user_tx + vig_burn - seed - grants),
    'user_tx', user_tx,
    'vig_burn', vig_burn,
    'seed', seed,
    'grants', grants
  )
  from parts;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 12. Cron rewrite (REC-7, D-4) — one snapshot row per outcome per open market,
--     inside this migration (transactional replace by job name).
-- ════════════════════════════════════════════════════════════════════════

select cron.schedule(
  'snapshot-price-history',
  '*/15 * * * *',
  $ct$
    insert into public.price_history (market_id, outcome_id, implied, pool, recorded_at)
    select o.market_id, o.id,
           least(greatest(round(100.0 * o.pool / t.total)::int, 1), 99),
           o.pool, now()
    from public.market_outcomes o
    join public.markets m on m.id = o.market_id
    cross join lateral (
      select sum(pool) as total from public.market_outcomes x
      where x.market_id = o.market_id
    ) t
    where m.status = 'open'
  $ct$
);
-- close-due-markets (0004) references only markets.status = 'open' and needs
-- no change under the rebuilt enum; left as-is.

-- ════════════════════════════════════════════════════════════════════════
-- 13. Realtime publication (REC-13, D-5). Pool changes now live on
--     market_outcomes; markets-row UPDATEs stop carrying price data.
-- ════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.market_outcomes;
alter table public.market_outcomes replica identity full;

-- ════════════════════════════════════════════════════════════════════════
-- 14. Grant discipline (0005 convention): revoke default PUBLIC execute, grant
--     only the intended surface. verify_ledger_invariant is ops-only.
-- ════════════════════════════════════════════════════════════════════════

revoke execute on function public._outcome_map(uuid) from public, anon, authenticated;
revoke execute on function public.market_outcomes_min_two() from public, anon, authenticated;
revoke execute on function public.create_market(
  text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  from public, anon;
revoke execute on function public.place_bet(uuid, uuid, integer) from public, anon;
revoke execute on function public.resolve_market(uuid, text, uuid) from public, anon;
revoke execute on function public.verify_ledger_invariant() from public, anon, authenticated;

grant execute on function public.create_market(
  text, text, public.market_category, text, timestamptz, timestamptz, jsonb, boolean, boolean)
  to authenticated;
grant execute on function public.place_bet(uuid, uuid, integer) to authenticated;
grant execute on function public.resolve_market(uuid, text, uuid) to authenticated;
-- W2: new 2-arg overloads replace the dropped 1-arg versions from 0007.
revoke execute on function public.get_accuracy_leaderboard(uuid, timestamptz)
  from public, anon;
revoke execute on function public.get_profile_stats(uuid, timestamptz)
  from public, anon;
grant execute on function public.get_accuracy_leaderboard(uuid, timestamptz)
  to authenticated;
grant execute on function public.get_profile_stats(uuid, timestamptz)
  to authenticated;
