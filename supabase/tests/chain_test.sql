-- The ledger, under attack.
--
-- Prints a PASS or FAIL line per case so the output can be read at a glance and grepped
-- in CI. Every case here corresponds to a claim the product makes on stage.
\set ON_ERROR_STOP off
\set QUIET on
\pset pager off
\pset tuples_only on
\pset format unaligned

insert into firms (id, name) values
  ('11111111-1111-1111-1111-111111111111','Meridian Basis Partners'),
  ('22222222-2222-2222-2222-222222222222','Rival Capital');

insert into events (firm_id, kind, payload) values
  ('11111111-1111-1111-1111-111111111111','decision_filed','{"n":1}');
insert into events (firm_id, kind, payload) values
  ('11111111-1111-1111-1111-111111111111','decision_filed','{"n":2}');

-- A multi row insert is the case most likely to break a chain trigger, because every
-- row has to see the one inserted immediately before it inside the same statement.
insert into events (firm_id, kind, payload) values
  ('11111111-1111-1111-1111-111111111111','access_read','{"n":3}'),
  ('11111111-1111-1111-1111-111111111111','access_read','{"n":4}'),
  ('11111111-1111-1111-1111-111111111111','access_read','{"n":5}');

insert into events (firm_id, kind, payload) values
  ('22222222-2222-2222-2222-222222222222','decision_filed','{"n":1}');

select case when count(*) = 5 and bool_and(this_hash <> '') then 'PASS' else 'FAIL' end
  || '  five events chained for the first firm'
from events where firm_id = '11111111-1111-1111-1111-111111111111';

select case when prev_hash is null then 'PASS' else 'FAIL' end
  || '  each firm starts its own genesis row'
from events where firm_id = '22222222-2222-2222-2222-222222222222';

select case when ok then 'PASS' else 'FAIL' end || '  verify_chain is clean on honest data'
from verify_chain_summary('11111111-1111-1111-1111-111111111111');

-- Mutation, three ways.
do $$
begin
  begin
    update events set payload = '{"x":1}' where id = 2;
    raise notice 'FAIL  UPDATE was allowed';
  exception when others then
    raise notice 'PASS  UPDATE is refused';
  end;
  begin
    delete from events where id = 2;
    raise notice 'FAIL  DELETE was allowed';
  exception when others then
    raise notice 'PASS  DELETE is refused';
  end;
  begin
    -- TRUNCATE does not fire row level triggers, so this is a genuinely separate case
    -- and not a variation on the two above.
    truncate events;
    raise notice 'FAIL  TRUNCATE was allowed';
  exception when others then
    raise notice 'PASS  TRUNCATE is refused';
  end;
end
$$;

-- The privileged attacker. session_replication_role = replica turns off every trigger on
-- the table, and the owning role can set it. This is what an insider with database
-- access actually has, so it is the case that matters.
set session_replication_role = replica;
update events set payload = '{"n":2,"tampered":true}' where id = 2;
set session_replication_role = default;

select case when not ok and first_bad_seq = 2 then 'PASS' else 'FAIL' end
  || '  a rewritten row is caught, at the exact row (seq ' || coalesce(first_bad_seq::text,'none') || ')'
from verify_chain_summary('11111111-1111-1111-1111-111111111111');

select case when ok then 'PASS' else 'FAIL' end
  || '  the other firm is unaffected by the tamper'
from verify_chain_summary('22222222-2222-2222-2222-222222222222');

-- The one layer that survives the trigger bypass, because a unique index is not a
-- trigger. A forked history is what a rewritten ledger looks like from the outside.
do $$
begin
  set session_replication_role = replica;
  begin
    insert into events (firm_id, kind, payload, prev_hash, this_hash)
    values ('11111111-1111-1111-1111-111111111111','forged','{}',
            (select prev_hash from events where id = 3), 'forged');
    raise notice 'FAIL  a forked chain was accepted';
  exception when unique_violation then
    raise notice 'PASS  a forked chain is refused even with every trigger disabled';
  end;
  begin
    insert into events (firm_id, kind, payload, prev_hash, this_hash)
    values ('11111111-1111-1111-1111-111111111111','forged','{}', null, 'forged2');
    raise notice 'FAIL  a second genesis row was accepted';
  exception when unique_violation then
    raise notice 'PASS  a second genesis row is refused';
  end;
  set session_replication_role = default;
end
$$;
