-- 0001_core.sql: firms, members, strategies, artifacts.
--
-- The objects half of the ontology. Everything in the product hangs off a strategy, and
-- every row in every table is scoped to a firm, because the firm is the security
-- boundary and there is no such thing as a cross firm read.

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists firms (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- A member is the join between a Supabase auth user and a firm. Role is a claim column
-- and not an admin system: three values, checked here, read by the RLS policies.
create table if not exists members (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null,
  firm_id uuid not null references firms(id) on delete cascade,
  role text not null check (role in ('researcher', 'desk_head', 'compliance')),
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, firm_id)
);

create index if not exists members_firm_idx on members (firm_id);
create index if not exists members_user_idx on members (user_id);

create table if not exists strategies (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  status text not null default 'research'
    check (status in ('research', 'paper', 'live', 'retired')),
  description text,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

create index if not exists strategies_firm_idx on strategies (firm_id);

-- The captured exhaust. Immutable by convention rather than by trigger: artifacts are
-- what happened, and the content_hash is what makes an edit detectable. A transcript
-- carries its speaker turns and attendees in raw_meta.
create table if not exists artifacts (
  id uuid primary key default extensions.uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete set null,
  kind text not null check (kind in (
    'commit', 'notebook', 'param_file', 'chat', 'doc', 'meeting_transcript'
  )),
  external_ref text,
  content_hash text,
  author_member_id uuid references members(id),
  occurred_at timestamptz not null default now(),
  raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artifacts_firm_idx on artifacts (firm_id);
create index if not exists artifacts_strategy_idx on artifacts (strategy_id);
create index if not exists artifacts_kind_idx on artifacts (kind);
