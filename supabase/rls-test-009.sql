-- ===========================================================================
--  Security tests for migration 009 — a visitor who is not signed in.
--
--  The point is not only that the write fails. It failed before. The point is
--  which sentence comes back, because that sentence is the only thing anyone
--  gets to read when a session quietly ends.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
delete from public.offers; delete from public.quotes;

\echo '── a visitor may read what is public ──'
set role anon;
set request.jwt.claim.sub = '';
select case when count(*) >= 6 then 'PASS' else 'FAIL' end
  || '  the catalogue is readable without signing in' from public.service_types;
select case when count(*) >= 0 then 'PASS' else 'FAIL' end
  || '  and so is the directory' from public.profiles;

\echo '── and writes nothing at all ──'
insert into public.quotes (client_id, type_id, brief, expires_at)
  values ('11111111-0000-0000-0000-000000000001','consult','anonymous', now() + interval '1 hour');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a brief cannot be posted by nobody' from public.quotes;

set role anon;
insert into public.requests (client_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001','consult','anonymous', 100);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor a request opened' from public.requests where title = 'anonymous';

set role anon;
update public.profiles set full_name = 'changed'
  where id = '11111111-0000-0000-0000-000000000001';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor a profile edited' from public.profiles where full_name = 'changed';

\echo '── while a signed-in account still works ──'
-- One open request at a time (migration 017), so the client's slate is
-- cleared before each fixture that needs to open another.
reset role;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.quotes (client_id, type_id, brief, expires_at)
  values ('11111111-0000-0000-0000-000000000001','consult','signed in', now() + interval '1 hour');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the same write from a real session goes through' from public.quotes;

reset role;
set request.jwt.claim.sub = '';
