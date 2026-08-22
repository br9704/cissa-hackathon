-- The scheduler, and the score history.
\set ON_ERROR_STOP off
\set QUIET on
\pset pager off
\pset tuples_only on
\pset format unaligned

insert into firms (id, name) values
  ('11111111-1111-1111-1111-111111111111','Meridian Basis Partners');
insert into members (id, user_id, firm_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111','researcher','Priya');
insert into strategies (id, firm_id, name, status) values
  ('55555555-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Concentrated book','live'),
  ('55555555-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Shared book','live');

-- Two rules, equally overdue. The strategies differ only in concentration.
insert into cadence_rules (firm_id, strategy_id, member_id, trigger_reason, interval_days, last_fired_at) values
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001','weekly_pulse', 7, now() - interval '30 days'),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001','weekly_pulse', 7, now() - interval '30 days');

-- An event driven rule with no interval. It should never appear in the due list.
insert into cadence_rules (firm_id, strategy_id, trigger_reason, interval_days) values
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001','post_merge', null);

-- A rule that is not due yet.
insert into cadence_rules (firm_id, strategy_id, trigger_reason, interval_days, last_fired_at) values
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','half_life_refresh', 90, now());

select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  only periodic rules past their interval are due (' || count(*) || ' of 4 rules)'
from cadence_due('11111111-1111-1111-1111-111111111111');

-- Now give the two strategies different concentration and re-rank.
select record_knowledge_scores('11111111-1111-1111-1111-111111111111', $j$[
  {"strategy_id":"55555555-0000-0000-0000-000000000001","bus_factor":1,"concentration":0.90,
   "vacation_readiness":20,"top_holder_member_id":"aaaaaaaa-0000-0000-0000-000000000001"},
  {"strategy_id":"55555555-0000-0000-0000-000000000002","bus_factor":3,"concentration":0.20,
   "vacation_readiness":80,"top_holder_member_id":"aaaaaaaa-0000-0000-0000-000000000001"}
]$j$::jsonb) as recorded;

select case when strategy_id = '55555555-0000-0000-0000-000000000001' then 'PASS' else 'FAIL' end
  || '  the concentrated book outranks the shared one at equal lateness'
from cadence_due('11111111-1111-1111-1111-111111111111') limit 1;

-- Scores are append only history, not an UPDATE.
select record_knowledge_scores('11111111-1111-1111-1111-111111111111', $j$[
  {"strategy_id":"55555555-0000-0000-0000-000000000001","bus_factor":2,"concentration":0.55,
   "vacation_readiness":60,"top_holder_member_id":null}
]$j$::jsonb) as recorded_again;

select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  a rescore adds history rather than overwriting it'
from knowledge_scores where strategy_id = '55555555-0000-0000-0000-000000000001';

select case when bus_factor = 2 then 'PASS' else 'FAIL' end
  || '  latest_knowledge_scores returns the newest per strategy'
from latest_knowledge_scores('11111111-1111-1111-1111-111111111111')
where strategy_id = '55555555-0000-0000-0000-000000000001';

select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and one row per strategy, not one per rescore'
from latest_knowledge_scores('11111111-1111-1111-1111-111111111111');

-- The half life stub.
select case when decision_half_life_score(now()) > 0.99 then 'PASS' else 'FAIL' end
  || '  a decision written today scores near 1';
select case when decision_half_life_score(now() - interval '90 days') between 0.45 and 0.55
  then 'PASS' else 'FAIL' end || '  and half that after ninety days';
select case when decision_half_life_score(now() - interval '90 days', 4)
  > decision_half_life_score(now() - interval '90 days', 0)
  then 'PASS' else 'FAIL' end || '  revisited ground decays more slowly';
