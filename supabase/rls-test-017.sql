-- ===========================================================================
--  Security tests for migration 017 — one at a time, and rate before the next.
--
--  A rule drawn only where the button is drawn is a rule anybody can call the
--  API around, so these go at it from the database side.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),('22222222-0000-0000-0000-000000000002'),
  ('55555555-0000-0000-0000-000000000005') on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id='22222222-0000-0000-0000-000000000002';
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';
delete from public.reviews; delete from public.quotes; delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';

\echo '── the first one goes through ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('1111aaaa-0000-0000-0000-0000000011aa','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','first', 250);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a client with nothing open may order' from public.requests
 where client_id = '11111111-0000-0000-0000-000000000001';

\echo '── the second does not ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (client_id, lawyer_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','second', 250);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a second open request is refused' from public.requests where title = 'second';

\echo '── nor a brief to the auction ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.quotes (client_id, type_id, brief, expires_at)
  values ('11111111-0000-0000-0000-000000000001','consult','while one is open',
          now() + interval '30 minutes');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor a brief posted while one is open' from public.quotes;

\echo '── closing it is not enough on its own ──'
update public.requests set status = 'delivered', delivered_at = now()
  where id = '1111aaaa-0000-0000-0000-0000000011aa';
update public.requests set status = 'completed'
  where id = '1111aaaa-0000-0000-0000-0000000011aa';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (client_id, lawyer_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','unrated', 250);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a finished but unrated request still blocks the next'
  from public.requests where title = 'unrated';

\echo '── rating it closes it ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.reviews (target_id, author_id, request_id, rating, body)
  values ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001',
          '1111aaaa-0000-0000-0000-0000000011aa', 5, 'ممتاز');
reset role;
select case when rated then 'PASS' else 'FAIL' end
  || '  the rating marks the request rated' from public.requests
 where id = '1111aaaa-0000-0000-0000-0000000011aa';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (client_id, lawyer_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','next one', 250);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and then the next one goes through' from public.requests where title = 'next one';

\echo '── and the trusted path is not queue-jumping ──'
reset role;
-- Dropping the role is not dropping the claim: auth.uid() reads the setting,
-- and leaving it set is how a "trusted path" test quietly tests nothing.
set request.jwt.claim.sub = '';
update public.requests set status = 'completed', rated = false where title = 'next one';
-- No session: a migration, a seeding script or the service key. The rule is
-- about a person opening their fifth request, not about the platform.
insert into public.requests (client_id, lawyer_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','opened by the platform', 250);
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the platform itself is not held to it'
  from public.requests where title = 'opened by the platform';

reset role;
set request.jwt.claim.sub = '';
