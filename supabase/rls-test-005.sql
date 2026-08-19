-- ===========================================================================
--  Security tests for migration 005 — the staff role cannot be dropped.
--
--      …after schema.sql, 002, 003, 004, 005
--      psql -f supabase/rls-test-005.sql
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
delete from public.profiles where id = 'cccccccc-0000-0000-0000-00000000cccc';
delete from auth.users     where id = 'cccccccc-0000-0000-0000-00000000cccc';
insert into auth.users (id) values ('cccccccc-0000-0000-0000-00000000cccc');
update public.profiles set roles = '{client,staff}', active_role = 'staff',
       status = 'verified', onboarded = false
  where id = 'cccccccc-0000-0000-0000-00000000cccc';

select case when 'staff' = any(roles) then 'PASS' else 'FAIL' end
  || '  the SQL editor can grant it' from public.profiles
  where id = 'cccccccc-0000-0000-0000-00000000cccc';

\echo '── finishing your details does not hand back the desk ──'
set role authenticated;
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-00000000cccc';
-- exactly what the onboarding step used to write
update public.profiles set roles = '{intern}', active_role = 'intern', onboarded = true
  where id = 'cccccccc-0000-0000-0000-00000000cccc';
reset role;
select case when 'staff' = any(roles) then 'PASS' else 'FAIL' end
  || '  answering "who are you" cannot write you out of it' from public.profiles
  where id = 'cccccccc-0000-0000-0000-00000000cccc';

\echo '── and neither can anybody else ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.profiles set roles = '{client}'
  where id = 'cccccccc-0000-0000-0000-00000000cccc';
reset role;
select case when 'staff' = any(roles) then 'PASS' else 'FAIL' end
  || '  a client cannot strip a staff member' from public.profiles
  where id = 'cccccccc-0000-0000-0000-00000000cccc';

\echo '── the way out is the way in ──'
reset role;
-- `reset role` leaves request.jwt.claim.sub exactly where it was, so without
-- this the "trusted path" is still carrying a user and the guard rightly
-- refuses. Clearing it is what makes this the SQL editor.
set request.jwt.claim.sub = '';
update public.profiles set roles = '{client}', active_role = 'client'
  where id = 'cccccccc-0000-0000-0000-00000000cccc';
select case when not ('staff' = any(roles)) then 'PASS' else 'FAIL' end
  || '  the SQL editor can take it away again' from public.profiles
  where id = 'cccccccc-0000-0000-0000-00000000cccc';

\echo '── and adding it is still refused from a browser ──'
set role authenticated;
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-00000000cccc';
update public.profiles set roles = '{client,staff}'
  where id = 'cccccccc-0000-0000-0000-00000000cccc';
reset role;
select case when not ('staff' = any(roles)) then 'PASS' else 'FAIL' end
  || '  nobody grants it to themselves' from public.profiles
  where id = 'cccccccc-0000-0000-0000-00000000cccc';
