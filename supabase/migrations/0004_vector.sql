-- 0004_vector.sql: retrieval for the ask bar.
--
-- 384 dimensions on every path, and that choice is what removes a fork rather than
-- expressing a preference. vector(n) is fixed width, so an OpenAI primary at 1536 with
-- a local fallback at 384 could never share a column: it would have forced two columns,
-- two indexes and a branch at query time. OpenAI's text-embedding-3-small accepts a
-- dimensions parameter, so asking it for 384 makes both providers fit one column and
-- the schema stops depending on which key happens to be present.

create extension if not exists vector with schema extensions;

alter table decisions
  add column if not exists embedding extensions.vector(384);

-- The trap that 384 everywhere does NOT solve, and the one most likely to quietly ruin
-- the ask bar: OpenAI at 384 and gte-small at 384 are different vector spaces. A row
-- embedded locally and queried through OpenAI returns meaningless cosine scores and
-- succeeds silently, with no error anywhere. So every embedded row records which model
-- produced it, and retrieval filters on it. Vectors from different providers are never
-- compared.
alter table decisions
  add column if not exists embedding_model text;

alter table debrief_turns
  add column if not exists embedding extensions.vector(384);
alter table debrief_turns
  add column if not exists embedding_model text;

-- HNSW rather than IVFFlat, and the deciding reason is not recall, it is scheduling:
-- an HNSW index can be built on an empty table and stays good as rows arrive, while
-- IVFFlat needs representative data to exist before it is built. On a weekend where the
-- migration runs before the seed, that difference is the whole argument.
create index if not exists decisions_embedding_idx
  on decisions using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists debrief_turns_embedding_idx
  on debrief_turns using hnsw (embedding extensions.vector_cosine_ops);

-- Retrieval over decisions and debrief turns together, because the answer to "why is
-- the expiry window capped" is as likely to live in something someone said in a debrief
-- as in a decision record.
create or replace function match_corpus(
  -- Schema qualified on purpose. The vector type lives in the extensions schema, and an
  -- unqualified vector(384) in a function signature fails to resolve on Supabase.
  query_embedding extensions.vector(384),
  p_firm_id uuid,
  p_embedding_model text,
  match_threshold double precision default 0.15,
  match_count integer default 8
)
returns table (
  source text,
  id uuid,
  strategy_id uuid,
  title text,
  body text,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  select * from (
    -- Each arm is parenthesised because it carries its own ORDER BY and LIMIT. Without
    -- the parentheses Postgres reads the ORDER BY as belonging to the whole UNION and
    -- rejects the second SELECT. The per arm limit is the point: take the best few from
    -- each source, then rank the combined set, so a long debrief cannot crowd out every
    -- decision.
    (select
      'decision'::text as source,
      d.id,
      d.strategy_id,
      d.title,
      coalesce(d.why, d.what_changed, '') as body,
      1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.decisions d
    where d.firm_id = p_firm_id
      and d.embedding is not null
      and d.embedding_model = p_embedding_model
    order by d.embedding operator(extensions.<=>) query_embedding
    limit match_count)

    union all

    (select
      'debrief_turn'::text as source,
      t.id,
      s.strategy_id,
      'Debrief answer'::text as title,
      t.text as body,
      1 - (t.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.debrief_turns t
    join public.debrief_sessions s on s.id = t.session_id
    where s.firm_id = p_firm_id
      and t.embedding is not null
      and t.embedding_model = p_embedding_model
    order by t.embedding operator(extensions.<=>) query_embedding
    limit match_count)
  ) hits
  where hits.similarity > match_threshold
  order by hits.similarity desc
  limit match_count
$$;
