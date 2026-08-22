-- Row level security, from both sides of the boundary.
--
-- Read supabase/tests/README.md first if you are wondering why every case is wrapped in
-- a transaction with an explicit `set local role`. Short version: a superuser bypasses
-- RLS entirely, and SET LOCAL outside a transaction is a silent no op, so getting either
-- one wrong produces a test that passes or fails for reasons unrelated to the policies.
\set ON_ERROR_STOP off
\set QUIET on
\pset pager off
\pset tuples_only on
\pset format unaligned

insert into firms (id, name) values
  ('11111111-1111-1111-1111-111111111111','Meridian Basis Partners'),
  ('22222222-2222-2222-2222-222222222222','Rival Capital');
insert into members (id, user_id, firm_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111','researcher','Priya'),
  ('bbbbbbbb-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222','researcher','Outsider');
insert into events (firm_id, kind, payload, actor_member_id) values
  ('11111111-1111-1111-1111-111111111111','decision_filed','{"secret":"meridian"}',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222','decision_filed','{"secret":"rival"}',
   'bbbbbbbb-0000-0000-0000-000000000002');

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
  select case when count(*) = 1 and bool_and(firm_id = '11111111-1111-1111-1111-111111111111')
    then 'PASS' else 'FAIL' end || '  a member sees only their own firm events' from events;
  select case when count(*) = 1 then 'PASS' else 'FAIL' end
    || '  and only their own firm' from firms;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
  select case when count(*) = 1 and bool_and(firm_id = '22222222-2222-2222-2222-222222222222')
    then 'PASS' else 'FAIL' end || '  the other firm sees only its own' from events;
commit;

begin;
  set local role authenticated;
  -- No identity at all. The anon case, and the one that matters if a token is ever
  -- dropped on the floor.
  select case when count(*) = 0 then 'PASS' else 'FAIL' end
    || '  a session with no identity sees nothing' from events;
commit;

do $$
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
    insert into events (firm_id, kind, payload, actor_member_id)
    values ('22222222-2222-2222-2222-222222222222','forged','{}',
            'aaaaaaaa-0000-0000-0000-000000000001');
    raise notice 'FAIL  a member wrote into another firm';
  exception when others then
    raise notice 'PASS  writing into another firm is refused';
  end;
end
$$;

do $$
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
    -- Attribution is the product's legal value, so impersonation has to be impossible
    -- even inside your own firm.
    insert into events (firm_id, kind, payload, actor_member_id)
    values ('11111111-1111-1111-1111-111111111111','forged','{}',
            'bbbbbbbb-0000-0000-0000-000000000002');
    raise notice 'FAIL  a member filed an event under someone else name';
  exception when others then
    raise notice 'PASS  filing under another member name is refused';
  end;
end
$$;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
  insert into events (firm_id, kind, payload, actor_member_id)
  values ('11111111-1111-1111-1111-111111111111','decision_filed','{"n":"mine"}',
          'aaaaaaaa-0000-0000-0000-000000000001');
  select case when count(*) = 2 then 'PASS' else 'FAIL' end
    || '  a member can file their own event' from events;
commit;

do $$
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
    update events set payload = '{}'
    where firm_id = '11111111-1111-1111-1111-111111111111';
    raise notice 'FAIL  a member rewrote the ledger';
  exception when others then
    -- Caught by the missing GRANT before it ever reaches the trigger, which is the
    -- cheaper of the two layers and the one that produces the clearer error.
    raise notice 'PASS  a member cannot rewrite the ledger';
  end;
end
$$;
