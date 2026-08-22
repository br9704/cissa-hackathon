-- 0006_cadence.sql: the scheduler, and the projection refresh.
--
-- Cadence is a first class concept in this product rather than a background job someone
-- added later. The pitch line is that the layer is fortified on a schedule and not by
-- heroics, and this file is where that stops being a slide.

-- ---------------------------------------------------------------------------
-- What is due, and why.
--
-- A row here is a promise to ask somebody something. It is separate from
-- debrief_sessions because a session is what happened and this is what should happen:
-- collapsing them would mean a debrief nobody has done yet is indistinguishable from one
-- that was skipped.
-- ---------------------------------------------------------------------------
create table if not exists cadence_rules (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  trigger_reason text not null check (trigger_reason in (
    'post_merge', 'drawdown_flag', 'weekly_pulse', 'half_life_refresh', 'exit'
  )),
  -- Null means event driven rather than periodic: a post_merge rule fires on a merge, not
  -- every N days.
  interval_days integer check (interval_days is null or interval_days > 0),
  active boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cadence_rules_firm_idx on cadence_rules (firm_id, active);

-- ---------------------------------------------------------------------------
-- The memory half life.
--
-- A deliberately simple exponential decay, and it is LABELLED a stub everywhere it is
-- shown. The honest version of this is a real forgetting curve fitted to how often people
-- actually fail to answer questions about their own old decisions, and we have no such
-- data. What this does have is the right shape: confidence in a recorded decision decays
-- with time since it was written, faster for decisions nobody has revisited.
--
-- Returning a number nobody can act on would be worse than returning nothing, so the
-- output is used for ORDERING which refresh to schedule next, never displayed as a
-- percentage anybody could mistake for a measurement.
-- ---------------------------------------------------------------------------
create or replace function decision_half_life_score(
  p_occurred_at timestamptz,
  p_revisited_count integer default 0
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  -- 90 day half life, extended by roughly 45 days for each time the ground was revisited.
  select exp(
    -0.693147 * (extract(epoch from (now() - p_occurred_at)) / 86400.0)
    / (90.0 + 45.0 * least(p_revisited_count, 6))
  )
$$;

-- ---------------------------------------------------------------------------
-- What is due right now.
--
-- One function rather than a view, so the caller passes the firm and RLS is not asked to
-- do work a parameter can do. Ordered by how badly the answer is needed rather than by
-- date: a decision nobody else can explain, on a book with a bus factor of one, outranks
-- an older one on a book three people understand.
-- ---------------------------------------------------------------------------
create or replace function cadence_due(p_firm_id uuid)
returns table (
  rule_id uuid,
  strategy_id uuid,
  member_id uuid,
  trigger_reason text,
  due_since timestamptz,
  urgency double precision
)
language sql
stable
set search_path = ''
as $$
  select
    r.id,
    r.strategy_id,
    r.member_id,
    r.trigger_reason,
    coalesce(r.last_fired_at, r.created_at) as due_since,
    -- Days overdue, weighted by how concentrated the strategy is. A late refresh on a
    -- book one person holds is a different thing from a late refresh on a shared one.
    (extract(epoch from (now() - coalesce(r.last_fired_at, r.created_at))) / 86400.0
      / greatest(r.interval_days, 1))
      * (1.0 + coalesce(k.herfindahl_concentration, 0.5))
      as urgency
  from public.cadence_rules r
  left join lateral (
    select ks.herfindahl_concentration
    from public.knowledge_scores ks
    where ks.strategy_id = r.strategy_id
    order by ks.computed_at desc
    limit 1
  ) k on true
  where r.firm_id = p_firm_id
    and r.active
    and r.interval_days is not null
    and now() > coalesce(r.last_fired_at, r.created_at) + (r.interval_days || ' days')::interval
  order by urgency desc
$$;

-- ---------------------------------------------------------------------------
-- Materialising the knowledge scores.
--
-- The scoring itself lives in packages/core as pure TypeScript, because it is the same
-- arithmetic the UI runs on demand and having two implementations is having two answers.
-- This function only writes what the caller computed, in one transaction, so a half
-- finished nightly run never leaves a firm with three strategies scored and one stale.
-- ---------------------------------------------------------------------------
create or replace function record_knowledge_scores(p_firm_id uuid, p_scores jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row jsonb;
begin
  for v_row in select * from jsonb_array_elements(p_scores)
  loop
    insert into public.knowledge_scores (
      firm_id, strategy_id, bus_factor, herfindahl_concentration,
      vacation_readiness, top_holder_member_id, breakdown
    )
    values (
      p_firm_id,
      (v_row->>'strategy_id')::uuid,
      (v_row->>'bus_factor')::integer,
      (v_row->>'concentration')::numeric,
      (v_row->>'vacation_readiness')::integer,
      nullif(v_row->>'top_holder_member_id', '')::uuid,
      coalesce(v_row->'breakdown', '{}'::jsonb)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- The latest score per strategy. Written as a function over the append only history
-- rather than as an UPDATE, so a score can be compared with the one it replaced: "this
-- was amber last month too" is a more useful sentence than "this is amber".
create or replace function latest_knowledge_scores(p_firm_id uuid)
returns setof knowledge_scores
language sql
stable
set search_path = ''
as $$
  select distinct on (ks.strategy_id) ks.*
  from public.knowledge_scores ks
  where ks.firm_id = p_firm_id
  order by ks.strategy_id, ks.computed_at desc
$$;

grant select, insert, update on public.cadence_rules to authenticated, service_role;
grant execute on function cadence_due(uuid) to authenticated, service_role;
grant execute on function latest_knowledge_scores(uuid) to authenticated, service_role;
grant execute on function record_knowledge_scores(uuid, jsonb) to service_role;
grant execute on function decision_half_life_score(timestamptz, integer) to authenticated, service_role;

alter table cadence_rules enable row level security;
alter table cadence_rules force row level security;

drop policy if exists cadence_rules_select on cadence_rules;
create policy cadence_rules_select on cadence_rules for select to authenticated
  using (firm_id in (select my_firm_ids()));

drop policy if exists cadence_rules_write on cadence_rules;
create policy cadence_rules_write on cadence_rules for insert to authenticated
  with check (firm_id in (select my_firm_ids()));
