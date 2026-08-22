-- 0002_events.sql: THE LEDGER.
--
-- Every meaningful thing in the system is an event here first and a projection
-- everywhere else. Rows are append only, and each one carries the sha256 of the row
-- before it, so an edit anywhere in the history invalidates every hash after it.
--
-- Read the honesty note at the bottom of this file before repeating any claim about
-- what this table guarantees.

create table if not exists events (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_member_id uuid references members(id),
  occurred_at timestamptz not null default now(),
  prev_hash text,
  this_hash text not null default ''
);

create index if not exists events_firm_id_idx on events (firm_id, id);
create index if not exists events_kind_idx on events (kind);

-- A chain cannot fork if a given predecessor can only be claimed once. This also
-- permits exactly one genesis row per firm, because NULL prev_hash is distinct from
-- itself in a plain unique index but NULLS NOT DISTINCT makes it collide.
alter table events drop constraint if exists events_no_fork;
alter table events add constraint events_no_fork
  unique nulls not distinct (firm_id, prev_hash);

-- ---------------------------------------------------------------------------
-- The canonical text.
--
-- Built by hand, field by field, and hashed inside Postgres. It is tempting to
-- serialize the row in TypeScript and hash it there instead, and that is a trap:
-- jsonb::text orders keys by LENGTH FIRST and then bytewise, not lexicographically, and
-- emits a space after every colon. So {"z":1,"aa":[1,2]} renders with z before aa. No
-- JSON.stringify with sorted keys reproduces that, which is why verification is a SQL
-- function further down rather than a TypeScript one.
--
-- sha256() is core Postgres 11 and lives in pg_catalog. pgcrypto's digest() would work
-- too, but only when schema qualified as extensions.digest(), because Supabase installs
-- pgcrypto outside the default search_path. One fewer extension and one fewer footgun.
--
-- These functions run with search_path pinned to empty, which is the hardened form, so
-- every call is schema qualified. pg_catalog is implicitly searched even then, but
-- spelling it out means the next person does not have to know that to read the code.
-- ---------------------------------------------------------------------------
create or replace function event_canonical_text(
  p_prev_hash text,
  p_firm_id uuid,
  p_actor uuid,
  p_kind text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_prev_hash, '')
    || '|' || p_firm_id::text
    || '|' || coalesce(p_actor::text, '')
    || '|' || p_kind
    || '|' || extract(epoch from p_occurred_at)::text
    || '|' || p_payload::text
$$;

create or replace function event_hash(
  p_prev_hash text,
  p_firm_id uuid,
  p_actor uuid,
  p_kind text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        public.event_canonical_text(
          p_prev_hash, p_firm_id, p_actor, p_kind, p_occurred_at, p_payload
        ),
        'UTF8'
      )
    ),
    'hex'
  )
$$;

-- ---------------------------------------------------------------------------
-- The chain trigger.
-- ---------------------------------------------------------------------------
create or replace function chain_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text;
begin
  -- Serialize per firm, not globally. Two firms writing at once never block each other;
  -- two writers in the same firm queue, which is the only place ordering matters.
  --
  -- This is correct only under READ COMMITTED, because the lookup below has to see the
  -- other transaction's committed row once its lock is released. PostgREST defaults to
  -- READ COMMITTED. Never put the ledger insert path in REPEATABLE READ or SERIALIZABLE.
  perform pg_advisory_xact_lock(hashtext('events_chain'), hashtext(new.firm_id::text));

  select e.this_hash into v_prev
  from public.events e
  where e.firm_id = new.firm_id
  order by e.id desc
  limit 1;

  new.prev_hash := v_prev;
  new.this_hash := public.event_hash(
    v_prev, new.firm_id, new.actor_member_id, new.kind, new.occurred_at, new.payload
  );
  return new;
end;
$$;

drop trigger if exists trg_events_chain on events;
create trigger trg_events_chain
  before insert on events
  for each row
  execute function chain_events();

-- ---------------------------------------------------------------------------
-- Immutability, in three layers, because one is not enough.
-- ---------------------------------------------------------------------------
create or replace function forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'events is append only (%)', tg_op
    using errcode = 'raise_exception';
end;
$$;

drop trigger if exists trg_events_no_mutation on events;
create trigger trg_events_no_mutation
  before update or delete on events
  for each row
  execute function forbid_mutation();

-- TRUNCATE does not fire row level triggers. Without this statement level trigger, one
-- TRUNCATE empties the append only ledger without raising anything at all.
drop trigger if exists trg_events_no_truncate on events;
create trigger trg_events_no_truncate
  before truncate on events
  for each statement
  execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- Verification. Runs in SQL, walks the rows in id order, recomputes every hash from the
-- row's own contents, and reports the first row where the recomputation disagrees.
--
-- Sequence gaps are normal: a failed insert burns an id. So this walks ordered rows and
-- never assumes id continuity.
-- ---------------------------------------------------------------------------
create or replace function verify_chain(p_firm_id uuid)
returns table (
  event_id bigint,
  seq integer,
  stored_hash text,
  computed_hash text,
  prev_ok boolean,
  hash_ok boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_prev text := null;
  v_computed text;
  v_seq integer := 0;
begin
  for r in
    select e.id, e.firm_id, e.kind, e.payload, e.actor_member_id,
           e.occurred_at, e.prev_hash, e.this_hash
    from public.events e
    where e.firm_id = p_firm_id
    order by e.id
  loop
    v_seq := v_seq + 1;
    v_computed := public.event_hash(
      v_prev, r.firm_id, r.actor_member_id, r.kind, r.occurred_at, r.payload
    );

    event_id := r.id;
    seq := v_seq;
    stored_hash := r.this_hash;
    computed_hash := v_computed;
    -- The stored predecessor must match what we actually walked past, and the stored
    -- hash must match what this row's contents produce. Two separate failures: a
    -- rewritten link, and a rewritten row.
    prev_ok := r.prev_hash is not distinct from v_prev;
    hash_ok := r.this_hash = v_computed;
    return next;

    -- Walk with the STORED hash, not the computed one. Using the computed hash would
    -- silently repair the chain as it verified it, and report a clean sweep over
    -- tampered data.
    v_prev := r.this_hash;
  end loop;
end;
$$;

-- A one row answer for the UI's headline, built on the same walk.
create or replace function verify_chain_summary(p_firm_id uuid)
returns table (total integer, first_bad_seq integer, ok boolean)
language sql
stable
set search_path = ''
as $$
  select
    count(*)::integer as total,
    min(v.seq) filter (where not v.prev_ok or not v.hash_ok) as first_bad_seq,
    bool_and(v.prev_ok and v.hash_ok) as ok
  from public.verify_chain(p_firm_id) v
$$;

-- ---------------------------------------------------------------------------
-- HONESTY NOTE. Read this before writing a claim about the ledger anywhere.
--
-- The triggers above are tamper RESISTANCE. They are not tamper proof, and saying so
-- would be a false claim. `set session_replication_role = replica` disables every
-- trigger on the table, and the owning role can set it. Anyone with that level of
-- database access can write whatever they like.
--
-- What survives that access is the CHAIN. An edited row produces a different sha256,
-- and every hash after it stops matching, so verify_chain() reports the exact row where
-- the history was rewritten. The database resists the edit; the hash chain is what
-- makes the edit evidence.
--
-- Measured, not assumed. Under `set session_replication_role = replica`:
--   UPDATE, DELETE and TRUNCATE all succeed. Every trigger above is off.
--   The events_no_fork UNIQUE CONSTRAINT still holds. A unique index is not a trigger,
--   so it is the one layer that survives, and it rejects both a grafted branch and a
--   second genesis row for the same firm.
-- So the ladder is: triggers stop ordinary mistakes, the constraint stops a forked
-- history even from a privileged session, and the hash chain makes a rewritten row
-- visible no matter who did it.
--
-- One more limit, stated plainly because someone will ask on stage: an attacker who
-- edits a row AND recomputes every hash after it produces an internally consistent
-- chain. That is true of every hash chain, and it is exactly why the head gets anchored
-- externally through OpenTimestamps. The chain proves internal consistency; the anchor
-- proves the chain existed in that shape at a point in time. Neither claim covers the
-- other, and blurring them would be the sort of thing this project refuses to do.
--
-- That distinction is the honest version of the pitch, and it is a stronger one.
-- ---------------------------------------------------------------------------
