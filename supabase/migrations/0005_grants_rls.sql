-- 0005_grants_rls.sql: who can see what, and who is allowed to reach the table at all.
--
-- Two different mechanisms, and confusing them costs an hour every time. GRANTS decide
-- whether a role can touch the table. RLS POLICIES decide which rows it sees. A correct
-- policy on a table with no grant returns 42501 permission denied, and the error says
-- nothing about RLS, so the natural reaction is to go and rewrite the policy.
--
-- This matters more than it used to. Since 2026-05-30 new Supabase projects do NOT
-- expose new tables to the Data API automatically: anon, authenticated and service_role
-- get nothing by default. There is a dashboard toggle that restores the old behaviour.
-- We write the grants explicitly instead, so the repository describes its own security
-- rather than depending on a setting nobody can see in a diff.

-- ---------------------------------------------------------------------------
-- The firm is the security boundary.
--
-- SECURITY DEFINER, because a policy on members that calls a function that reads members
-- is how you get infinite recursion. Pinning search_path is not decoration on a definer
-- function, it is the thing that stops a caller shadowing the tables it reads.
-- ---------------------------------------------------------------------------
create or replace function my_firm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.firm_id from public.members m where m.user_id = auth.uid()
$$;

create or replace function my_member_id(p_firm_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m
  where m.user_id = auth.uid() and m.firm_id = p_firm_id
$$;

create or replace function my_role(p_firm_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.members m
  where m.user_id = auth.uid() and m.firm_id = p_firm_id
$$;

-- ---------------------------------------------------------------------------
-- Grants.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

do $$
declare
  t text;
  -- Everything except events. The ledger gets its own line below, because it is the one
  -- table where the absence of update and delete is a product guarantee rather than an
  -- oversight.
  readwrite text[] := array[
    'firms', 'members', 'strategies', 'artifacts', 'decisions', 'decision_links',
    'debrief_sessions', 'debrief_turns', 'questions', 'knowledge_scores',
    'anchor_receipts', 'handover_packs'
  ];
begin
  foreach t in array readwrite loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end
$$;

-- The ledger. Select and insert, and nothing else, for everyone including service_role.
-- The revoke is a no op on a project created after the grants default changed, because
-- the grant never existed to revoke. It stays because it states the intent, and because
-- the same file has to be correct against an older project too.
revoke update, delete on public.events from anon, authenticated, service_role;
grant select, insert on public.events to authenticated;
grant select, insert on public.events to service_role;
grant usage, select on sequence public.events_id_seq to authenticated, service_role;

grant execute on function my_firm_ids() to authenticated, service_role;
grant execute on function my_member_id(uuid) to authenticated, service_role;
grant execute on function my_role(uuid) to authenticated, service_role;
grant execute on function verify_chain(uuid) to authenticated, service_role;
grant execute on function verify_chain_summary(uuid) to authenticated, service_role;
grant execute on function match_corpus(extensions.vector, uuid, text, double precision, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  all_tables text[] := array[
    'firms', 'members', 'strategies', 'artifacts', 'events', 'decisions',
    'decision_links', 'debrief_sessions', 'debrief_turns', 'questions',
    'knowledge_scores', 'anchor_receipts', 'handover_packs'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    -- Force it for the table owner too. Without this, anything running as the owner
    -- quietly sees every row, and a policy that has never actually been exercised is a
    -- policy nobody should trust.
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- Firms and members: you can see your own firm and the people in it.
drop policy if exists firms_select on firms;
create policy firms_select on firms for select to authenticated
  using (id in (select my_firm_ids()));

drop policy if exists members_select on members;
create policy members_select on members for select to authenticated
  using (firm_id in (select my_firm_ids()));

-- Everything scoped by firm_id gets the same shape, so it is generated rather than
-- copied thirteen times. A copied policy is a policy that drifts.
do $$
declare
  t text;
  firm_scoped text[] := array[
    'strategies', 'artifacts', 'decisions', 'debrief_sessions', 'questions',
    'knowledge_scores', 'anchor_receipts', 'handover_packs'
  ];
begin
  foreach t in array firm_scoped loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated
       using (firm_id in (select my_firm_ids()))', t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated
       with check (firm_id in (select my_firm_ids()))', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated
       using (firm_id in (select my_firm_ids()))
       with check (firm_id in (select my_firm_ids()))', t, t);
  end loop;
end
$$;

-- The ledger. Select scoped by firm; insert scoped by firm AND required to be honest
-- about who wrote it. A member cannot file an event in someone else's name.
drop policy if exists events_select on events;
create policy events_select on events for select to authenticated
  using (firm_id in (select my_firm_ids()));

drop policy if exists events_insert on events;
create policy events_insert on events for insert to authenticated
  with check (
    firm_id in (select my_firm_ids())
    and (
      actor_member_id is null
      or actor_member_id = my_member_id(firm_id)
    )
  );

-- Join tables reach their firm through their parent rather than carrying a firm_id of
-- their own. Denormalising firm_id onto them would be faster and would also create a
-- second source of truth for the one thing that must never disagree.
drop policy if exists decision_links_select on decision_links;
create policy decision_links_select on decision_links for select to authenticated
  using (exists (
    select 1 from decisions d
    where d.id = decision_links.parent_decision_id
      and d.firm_id in (select my_firm_ids())
  ));

drop policy if exists decision_links_insert on decision_links;
create policy decision_links_insert on decision_links for insert to authenticated
  with check (exists (
    select 1 from decisions d
    where d.id = decision_links.parent_decision_id
      and d.firm_id in (select my_firm_ids())
  ));

drop policy if exists debrief_turns_select on debrief_turns;
create policy debrief_turns_select on debrief_turns for select to authenticated
  using (exists (
    select 1 from debrief_sessions s
    where s.id = debrief_turns.session_id
      and s.firm_id in (select my_firm_ids())
  ));

drop policy if exists debrief_turns_insert on debrief_turns;
create policy debrief_turns_insert on debrief_turns for insert to authenticated
  with check (exists (
    select 1 from debrief_sessions s
    where s.id = debrief_turns.session_id
      and s.firm_id in (select my_firm_ids())
  ));

-- ---------------------------------------------------------------------------
-- Realtime. The ledger tail in the UI is a subscription to this publication, and
-- Realtime authorizes every event against each subscriber, so RLS is the boundary there
-- too. replica identity full is what makes the old row available on a change.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table events';
  end if;
end
$$;

alter table events replica identity full;
