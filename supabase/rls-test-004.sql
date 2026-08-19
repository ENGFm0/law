-- ===========================================================================
--  Security tests for migration 004 — notifications.
--
--      psql -f supabase/local-prelude.sql
--      psql -f supabase/schema.sql
--      psql -f supabase/migrations/002-oauth-and-status.sql
--      psql -f supabase/migrations/003-staff-disputes-and-money.sql
--      psql -f supabase/migrations/004-notifications.sql
--      psql -f supabase/rls-test-004.sql
--
--  Errors along the way are expected — they are the rules refusing.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
delete from public.notifications;
delete from public.profiles where id in
  ('aaaaaaaa-0000-0000-0000-00000000aaaa','bbbbbbbb-0000-0000-0000-00000000bbbb');
delete from auth.users where id in
  ('aaaaaaaa-0000-0000-0000-00000000aaaa','bbbbbbbb-0000-0000-0000-00000000bbbb');
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-00000000aaaa'), ('bbbbbbbb-0000-0000-0000-00000000bbbb');
insert into public.profiles (id, full_name, roles, active_role, status) values
  ('aaaaaaaa-0000-0000-0000-00000000aaaa','A','{client}','client','verified'),
  ('bbbbbbbb-0000-0000-0000-00000000bbbb','B','{client}','client','verified')
on conflict (id) do nothing;

\echo '── a notice belongs to one person ──'
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
insert into public.notifications (to_id, type, ref)
  values ('bbbbbbbb-0000-0000-0000-00000000bbbb','delivered','r-1');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  one person can raise a notice for another' from public.notifications;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  but cannot read what they sent' from public.notifications;

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the person it belongs to can' from public.notifications;

\echo '── the same event twice is one notice ──'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
insert into public.notifications (to_id, type, ref)
  values ('bbbbbbbb-0000-0000-0000-00000000bbbb','delivered','r-1');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a repeat does not become a second row' from public.notifications;

\echo '── marking read, and nothing else ──'
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
update public.notifications set read = true;
reset role;
select case when read = false then 'PASS' else 'FAIL' end
  || '  somebody else cannot mark it read' from public.notifications;

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
update public.notifications set read = true;
reset role;
select case when read then 'PASS' else 'FAIL' end
  || '  its owner can' from public.notifications;

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
update public.notifications set type = 'resolved';
reset role;
select case when type = 'delivered' then 'PASS' else 'FAIL' end
  || '  and cannot rewrite what it says' from public.notifications;

\echo '── clearing ──'
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
delete from public.notifications;
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  somebody else cannot clear your list' from public.notifications;

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
delete from public.notifications;
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  you can clear your own' from public.notifications;
