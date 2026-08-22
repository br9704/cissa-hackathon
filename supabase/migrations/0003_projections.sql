-- 0003_projections.sql: everything that is not the ledger.
--
-- Every table here is a PROJECTION. The events table is the source of truth, and each
-- of these rows exists because an event said so. That is why they are all ordinary
-- mutable tables: rewriting a projection is not falsifying history, it is recomputing a
-- view. Falsifying history means editing events, and that is what 0002 is about.

-- The decision genealogy node. decision_type and risk_flag are written by the tagger,
-- so they are nullable until it has run: a decision with no tag yet is honest, a
-- decision defaulted to some class is not.
create table if not exists decisions (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete set null,
  event_id bigint references events(id),
  title text not null,
  what_changed text,
  why text,
  alternatives jsonb not null default '[]'::jsonb,
  confidence text check (confidence in ('low', 'medium', 'high')),
  tags text[] not null default '{}',
  decision_type text check (decision_type in (
    'parameter_change', 'risk_limit', 'data_handling', 'execution',
    'universe', 'infra', 'process'
  )),
  risk_flag boolean,
  author_member_id uuid references members(id),
  approved_at timestamptz,
  -- An AI drafted row is visibly a draft until a human approves it. This column is what
  -- the dashed hairline in the UI reads.
  drafted_by text not null default 'human' check (drafted_by in ('human', 'model')),
  source_artifact_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists decisions_firm_idx on decisions (firm_id);
create index if not exists decisions_strategy_idx on decisions (strategy_id);
create index if not exists decisions_type_idx on decisions (decision_type);
create index if not exists decisions_risk_idx on decisions (risk_flag) where risk_flag;

-- The genealogy edges. A decision that supersedes another is the shape that makes the
-- graph worth drawing: it is the record of the firm changing its mind.
create table if not exists decision_links (
  parent_decision_id uuid not null references decisions(id) on delete cascade,
  child_decision_id uuid not null references decisions(id) on delete cascade,
  relation text not null check (relation in ('supersedes', 'informs', 'reverts')),
  primary key (parent_decision_id, child_decision_id, relation),
  -- A decision cannot be its own parent. Cheap to state, expensive to debug in a force
  -- layout that will not settle.
  check (parent_decision_id <> child_decision_id)
);

create table if not exists debrief_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  member_id uuid references members(id),
  strategy_id uuid references strategies(id) on delete set null,
  scheduled_for timestamptz,
  completed_at timestamptz,
  -- Cadence is a first class concept: the layer is fortified on a schedule, not by
  -- heroics, and this column is where the schedule shows up.
  trigger_reason text not null check (trigger_reason in (
    'post_merge', 'drawdown_flag', 'weekly_pulse', 'half_life_refresh', 'exit'
  )),
  created_at timestamptz not null default now()
);

create table if not exists debrief_turns (
  id uuid primary key default extensions.uuid_generate_v4(),
  session_id uuid not null references debrief_sessions(id) on delete cascade,
  seq integer not null,
  role text not null check (role in ('agent', 'human')),
  text text not null,
  -- Every agent question is grounded in something the person actually did. An ungrounded
  -- question is the interviewer guessing, and the whole point is that it does not have to.
  grounded_artifact_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

-- The open questions only one person can answer, ranked by how undocumented they are.
create table if not exists questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete set null,
  text text not null,
  asked_by uuid references members(id),
  answered_by_decision_id uuid references decisions(id),
  undocumentedness_score numeric(4, 3) not null default 0.5
    check (undocumentedness_score between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists questions_firm_idx on questions (firm_id);

-- Scores are a property of a STRATEGY. top_holder_member_id exists so the departure
-- simulation can name the orphaned decisions, and it must never be rendered as a
-- ranking. No view in this product ranks individuals.
create table if not exists knowledge_scores (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  strategy_id uuid not null references strategies(id) on delete cascade,
  computed_at timestamptz not null default now(),
  bus_factor integer not null,
  herfindahl_concentration numeric(5, 4) not null,
  vacation_readiness integer not null check (vacation_readiness between 0 and 100),
  top_holder_member_id uuid references members(id),
  breakdown jsonb not null default '{}'::jsonb
);

create index if not exists knowledge_scores_strategy_idx
  on knowledge_scores (strategy_id, computed_at desc);

-- OpenTimestamps anchoring of the ledger head. The receipt is stored as the exact bytes
-- the client serialized, never as JSON: the format is a binary protocol and round
-- tripping it through JSON.stringify loses it.
create table if not exists anchor_receipts (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  through_event_id bigint not null references events(id),
  merkle_root text not null,
  ots_receipt bytea,
  -- Pending until a Bitcoin attestation exists. Confirmation takes hours, so a fresh
  -- receipt is honestly pending and the UI says so rather than implying otherwise.
  status text not null default 'pending' check (status in ('pending', 'upgraded')),
  anchored_at timestamptz not null default now(),
  upgraded_at timestamptz
);

-- Frozen generated artifacts. Every pack records the ledger position it was generated
-- from, so a pack and the ledger can always be reconciled after the fact.
create table if not exists handover_packs (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  member_id uuid references members(id),
  generated_at timestamptz not null default now(),
  through_event_id bigint references events(id),
  content_md text not null,
  pack_hash text not null
);
