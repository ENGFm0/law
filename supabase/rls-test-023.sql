-- ===========================================================================
--  Security tests for migration 023 — the screening pool.
--
--  These are the checks whose absence let the whole free screening ship
--  broken: every earlier suite tested the guard, and none tested whether the
--  row could be reached at all. A guard on a row nobody can select or update
--  is a lock on a door that was already welded shut.
--
--  So this asks the two questions in the right order — can the right person
--  SEE it, and can they CLAIM it — and then all the ways the wrong person
--  must not.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- client, opens the screening
  ('99999999-0000-0000-0000-000000000009'),   -- another client entirely
  ('22222222-0000-0000-0000-000000000002'),   -- lawyer, supervises the trainee
  ('44444444-0000-0000-0000-000000000004'),   -- lawyer, supervises nobody
  ('66666666-0000-0000-0000-000000000006'),   -- trainee, supervised
  ('88888888-0000-0000-0000-000000000008'),   -- trainee, nobody behind them
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id in ('11111111-0000-0000-0000-000000000001','99999999-0000-0000-0000-000000000009');
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004');
update public.profiles set roles='{intern}', status='verified'
  where id in ('66666666-0000-0000-0000-000000000006','88888888-0000-0000-0000-000000000008');
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.mentorship_sessions; delete from public.mentorship_messages;
delete from public.supervision_orders; delete from public.mentorships;
delete from public.requests where title = 'screening pool test';
update public.profiles set is_mentor = true, mentorship_fee = 80
  where id = '22222222-0000-0000-0000-000000000002';
insert into public.mentorships (mentor_id, intern_id, opened_by, status, fee, started_at)
  values ('22222222-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000006',
          'intern','active',80, now());

insert into public.requests (id, client_id, type_id, title, price, status)
  values ('eeee0000-0000-0000-0000-00000000eeee',
          '11111111-0000-0000-0000-000000000001',
          'free_screening', 'screening pool test', 0, 'new');

\echo '── the pool is visible to the people who can do the work ──'
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a supervised trainee sees a screening waiting'
  from public.requests where title = 'screening pool test';

set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  so does one with nobody behind them — seeing it is how they learn to fix that'
  from public.requests where title = 'screening pool test';

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and a lawyer, who may hand it to their trainee'
  from public.requests where title = 'screening pool test';

\echo '── and to nobody else ──'
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000009';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  another client sees none of it'
  from public.requests where title = 'screening pool test';

reset role;
set request.jwt.claim.sub = '';
set role anon;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and a signed-out visitor sees nothing at all'
  from public.requests where title = 'screening pool test';

reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client who opened it still reads their own'
  from public.requests where title = 'screening pool test';

\echo '── an unsupervised trainee cannot take one ──'
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
update public.requests set assigned_to = '88888888-0000-0000-0000-000000000008'
  where title = 'screening pool test';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  nobody answerable, nothing claimed'
  from public.requests where id = 'eeee0000-0000-0000-0000-00000000eeee';

\echo '── nor may a lawyer park it on somebody else’s trainee ──'
set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where title = 'screening pool test';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  a lawyer who signs for nobody assigns nobody'
  from public.requests where id = 'eeee0000-0000-0000-0000-00000000eeee';

\echo '── nor take it themselves ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.requests set assigned_to = '22222222-0000-0000-0000-000000000002'
  where title = 'screening pool test';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  a screening is done by a trainee, so a lawyer cannot assign it to themselves'
  from public.requests where id = 'eeee0000-0000-0000-0000-00000000eeee';

\echo '── the supervisor hands it to their own trainee ──'
update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where title = 'screening pool test';
select case when assigned_to = '66666666-0000-0000-0000-000000000006' then 'PASS' else 'FAIL' end
  || '  routed'
  from public.requests where id = 'eeee0000-0000-0000-0000-00000000eeee';
select case when lawyer_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  and the guard put the answerable lawyer on it'
  from public.requests where id = 'eeee0000-0000-0000-0000-00000000eeee';

\echo '── and a claimed one leaves the pool ──'
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a trainee outside it no longer sees it'
  from public.requests where title = 'screening pool test';

\echo '── the trainee can claim one themselves too ──'
reset role;
set request.jwt.claim.sub = '';
delete from public.requests where title = 'screening pool test';
insert into public.requests (id, client_id, type_id, title, price, status)
  values ('eeee1111-0000-0000-0000-00000000eeee',
          '11111111-0000-0000-0000-000000000001',
          'free_screening', 'screening pool test', 0, 'new');
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where title = 'screening pool test';
select case when assigned_to = '66666666-0000-0000-0000-000000000006' then 'PASS' else 'FAIL' end
  || '  a supervised trainee takes it'
  from public.requests where id = 'eeee1111-0000-0000-0000-00000000eeee';
select case when lawyer_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  and brings their supervisor onto it'
  from public.requests where id = 'eeee1111-0000-0000-0000-00000000eeee';

\echo '── and a trainee cannot claim one for somebody else ──'
reset role;
set request.jwt.claim.sub = '';
delete from public.requests where title = 'screening pool test';
insert into public.requests (id, client_id, type_id, title, price, status)
  values ('eeee2222-0000-0000-0000-00000000eeee',
          '11111111-0000-0000-0000-000000000001',
          'free_screening', 'screening pool test', 0, 'new');
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
update public.requests set assigned_to = '88888888-0000-0000-0000-000000000008'
  where title = 'screening pool test';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  a trainee assigns only themselves'
  from public.requests where id = 'eeee2222-0000-0000-0000-00000000eeee';

\echo '── and none of this touched ordinary paid work ──'
reset role;
set request.jwt.claim.sub = '';
insert into public.requests (id, client_id, type_id, title, price, status)
  values ('eeee3333-0000-0000-0000-00000000eeee',
          '11111111-0000-0000-0000-000000000001',
          'consult', 'screening pool test', 250, 'new');
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a trainee does not see an unclaimed paid request'
  from public.requests where id = 'eeee3333-0000-0000-0000-00000000eeee';
update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where id = 'eeee3333-0000-0000-0000-00000000eeee';
reset role;
set request.jwt.claim.sub = '';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  nor claim one'
  from public.requests where id = 'eeee3333-0000-0000-0000-00000000eeee';
delete from public.requests where title = 'screening pool test';
