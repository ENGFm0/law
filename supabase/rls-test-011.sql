-- ===========================================================================
--  Security tests for migration 011 — whose phone number is it anyway.
--
--  `profiles` was world-readable and `select *` returns every column, so a
--  visitor who had never signed in could read every user's phone number,
--  licence document and CV. Nobody decided that; it is what a public table
--  does. These prove the three doors that replaced it.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
update public.profiles set phone = '0500000001', email = 'client@test.sa'
  where id = '11111111-0000-0000-0000-000000000001';
update public.profiles set phone = '0500000002', email = 'lawyer@test.sa'
  where id = '22222222-0000-0000-0000-000000000002';

\echo '── a visitor who has not signed in ──'
set role anon;
set request.jwt.claim.sub = '';
select case when count(*) > 0 then 'PASS' else 'FAIL' end
  || '  can still read the directory'
  from (select id, full_name, city, years, status from public.profiles) x;

\echo '── but not the parts that are nobody else''s business ──'
-- Each of these raises; the assertion is that psql prints the error above it.
select phone from public.profiles limit 1;
select email from public.profiles limit 1;
select cv_url from public.profiles limit 1;
select * from public.profiles limit 1;

reset role;
select case when has_column_privilege('anon', 'public.profiles', 'phone', 'select')
            then 'FAIL' else 'PASS' end || '  anon has no privilege on phone';
select case when has_column_privilege('authenticated', 'public.profiles', 'email', 'select')
            then 'FAIL' else 'PASS' end || '  nor does a signed-in stranger on email';
select case when has_column_privilege('authenticated', 'public.profiles', 'full_name', 'select')
            then 'PASS' else 'FAIL' end || '  the name is still readable';

\echo '── your own row comes back whole ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when phone = '0500000001' then 'PASS' else 'FAIL' end
  || '  my_profile hands me my own phone' from public.my_profile();
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and only mine' from public.my_profile();

\echo '── and one counterparty''s, when there is a reason ──'
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a stranger''s details are refused'
  from public.contact_of('33333333-0000-0000-0000-000000000003');

reset role;
delete from public.requests where title = 'contact test';
insert into public.requests (client_id, lawyer_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
          'consult','contact test', 200);

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when phone = '0500000002' then 'PASS' else 'FAIL' end
  || '  the lawyer I hired is reachable'
  from public.contact_of('22222222-0000-0000-0000-000000000002');

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when phone = '0500000001' then 'PASS' else 'FAIL' end
  || '  and so is the client who hired me'
  from public.contact_of('11111111-0000-0000-0000-000000000001');

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer with no case between them gets nothing'
  from public.contact_of('11111111-0000-0000-0000-000000000001');

\echo '── the desk''s book ──'
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  is empty for everybody else' from public.contact_book();
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) >= 2 then 'PASS' else 'FAIL' end
  || '  and holds the platform for staff' from public.contact_book();

\echo '── an address is not something you rewrite ──'
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.profiles set email = 'someone@else.sa'
  where id = '11111111-0000-0000-0000-000000000001';
reset role;
select case when email = 'client@test.sa' then 'PASS' else 'FAIL' end
  || '  the email you signed in with stays yours'
  from public.profiles where id = '11111111-0000-0000-0000-000000000001';

\echo '── and the two columns the code was writing into thin air ──'
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  requests.rated exists' from information_schema.columns
  where table_name = 'requests' and column_name = 'rated';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  profiles.title exists' from information_schema.columns
  where table_name = 'profiles' and column_name = 'title';

reset role;
set request.jwt.claim.sub = '';
