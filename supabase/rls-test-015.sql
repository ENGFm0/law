-- ===========================================================================
--  Security tests for migration 015 — the record.
--
--  A record is only worth having if it cannot be edited by the people it is
--  about. These check that it writes itself, that everyone with a part in a
--  request can read the same one, and that nobody can add a line to it.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),('22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003'),('66666666-0000-0000-0000-000000000006')
on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified' where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified' where id in
  ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
update public.profiles set roles='{intern}', status='verified' where id='66666666-0000-0000-0000-000000000006';
delete from public.request_events; delete from public.disputes;
delete from public.requests where title = 'record test';

\echo '── a request is numbered when it is made ──'
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('aaaa2222-0000-0000-0000-00000000aaaa','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','record test', 250);
select case when ref like 'SND-%' then 'PASS' else 'FAIL' end
  || '  it has a reference anybody can read out'
  from public.requests where id = 'aaaa2222-0000-0000-0000-00000000aaaa';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and no two share one' from (
    select ref from public.requests where id = 'aaaa2222-0000-0000-0000-00000000aaaa'
    except select ref from public.requests where id <> 'aaaa2222-0000-0000-0000-00000000aaaa') x;

\echo '── and every change writes itself down ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006',
       status = 'with_intern' where id = 'aaaa2222-0000-0000-0000-00000000aaaa';
update public.requests set status = 'delivered' where id = 'aaaa2222-0000-0000-0000-00000000aaaa';
reset role;
select case when count(*) >= 5 then 'PASS' else 'FAIL' end
  || '  the record has the whole story' from public.request_events
  where request_id = 'aaaa2222-0000-0000-0000-00000000aaaa';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  including who it went to' from public.request_events
  where kind = 'assigned' and detail = '66666666-0000-0000-0000-000000000006';
select case when by_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  and who did it' from public.request_events
  where kind = 'status:delivered' and request_id = 'aaaa2222-0000-0000-0000-00000000aaaa';

\echo '── everyone on the case reads the same record ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) >= 5 then 'PASS' else 'FAIL' end
  || '  the client' from public.request_events;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) >= 5 then 'PASS' else 'FAIL' end
  || '  the trainee it was routed to' from public.request_events;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and nobody else' from public.request_events;

\echo '── and nobody writes a line into it ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.request_events (request_id, kind, by_id, detail)
  values ('aaaa2222-0000-0000-0000-00000000aaaa','placed',
          '22222222-0000-0000-0000-000000000002','made up');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a line cannot be added by hand' from public.request_events where detail = 'made up';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.request_events set detail = 'rewritten' where kind = 'placed';
delete from public.request_events;
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor rewritten' from public.request_events where detail = 'rewritten';
select case when count(*) >= 5 then 'PASS' else 'FAIL' end
  || '  nor deleted' from public.request_events
  where request_id = 'aaaa2222-0000-0000-0000-00000000aaaa';

\echo '── an objection is numbered too, and lands on the same record ──'
reset role;
update public.requests set delivered_at = now() where id = 'aaaa2222-0000-0000-0000-00000000aaaa';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.disputes (request_id, by_id, reason)
  values ('aaaa2222-0000-0000-0000-00000000aaaa','11111111-0000-0000-0000-000000000001','ناقص');
reset role;
select case when ref like 'OBJ-%' then 'PASS' else 'FAIL' end
  || '  the objection has its own number' from public.disputes
  where request_id = 'aaaa2222-0000-0000-0000-00000000aaaa';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the record says when it was raised' from public.request_events
  where kind = 'disputed' and request_id = 'aaaa2222-0000-0000-0000-00000000aaaa';

\echo '── and when the lawyer took it on ──'
reset role;
delete from public.request_events where request_id = 'bbbb3333-0000-0000-0000-00000000bbbb';
delete from public.requests where id = 'bbbb3333-0000-0000-0000-00000000bbbb';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('bbbb3333-0000-0000-0000-00000000bbbb','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','taken test', 250);

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.requests set status = 'in_progress' where id = 'bbbb3333-0000-0000-0000-00000000bbbb';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  the client touching it is not the lawyer taking it on'
  from public.request_events
 where kind = 'taken' and request_id = 'bbbb3333-0000-0000-0000-00000000bbbb';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.requests set status = 'drafted' where id = 'bbbb3333-0000-0000-0000-00000000bbbb';
update public.requests set status = 'delivered' where id = 'bbbb3333-0000-0000-0000-00000000bbbb';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  their first act on it is recorded, once' from public.request_events
 where kind = 'taken' and request_id = 'bbbb3333-0000-0000-0000-00000000bbbb';
select case when by_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  naming them' from public.request_events
 where kind = 'taken' and request_id = 'bbbb3333-0000-0000-0000-00000000bbbb';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and nothing said in a thread is copied into the record'
  from public.request_events where kind like 'said%';

reset role;
set request.jwt.claim.sub = '';
