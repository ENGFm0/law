-- ===========================================================================
--  Security tests for migration 013 — reopening somebody else's notice.
--
--  The rule the browser cannot satisfy: a notice belongs to the person it is
--  for, who alone may read it and mark it read. "The same thing happened
--  again" has to reopen that row, which is a privileged act — so it happens
--  in one function, and these check that the function does only that and that
--  nobody else gained anything by its existing.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
delete from public.notifications where ref in ('case-1', 'case-2');
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'), ('22222222-0000-0000-0000-000000000002')
on conflict (id) do nothing;

\echo '── raising one for somebody else ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.raise_notice('22222222-0000-0000-0000-000000000002', 'message', 'case-1');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a notice is raised for the other party' from public.notifications where ref = 'case-1';

\echo '── the second message reopens it rather than failing ──'
reset role;
update public.notifications set read = true where ref = 'case-1';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select public.raise_notice('22222222-0000-0000-0000-000000000002', 'message', 'case-1');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  still one row, not two' from public.notifications where ref = 'case-1';
select case when read = false then 'PASS' else 'FAIL' end
  || '  and it is unread again' from public.notifications where ref = 'case-1';

\echo '── and nothing else was opened up by it ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  the sender still cannot read it' from public.notifications where ref = 'case-1';

update public.notifications set ref = 'somewhere else' where ref = 'case-1';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor rewrite what it points at' from public.notifications where ref = 'case-1';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.notifications set at = now() - interval '1 day' where ref = 'case-1';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and its owner may mark it read, not backdate it'
  from public.notifications where ref = 'case-1' and at > now() - interval '1 hour';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.notifications set read = true where ref = 'case-1';
reset role;
select case when read then 'PASS' else 'FAIL' end
  || '  marking it read still works' from public.notifications where ref = 'case-1';

\echo '── a visitor raises nothing ──'
set role anon;
set request.jwt.claim.sub = '';
select public.raise_notice('22222222-0000-0000-0000-000000000002', 'message', 'case-2');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nobody signed in, nothing raised' from public.notifications where ref = 'case-2';

reset role;
set request.jwt.claim.sub = '';
