-- ===========================================================================
--  Security tests for migration 014 — the guarantee.
--
--  An unconditional refund is a door in the wall of "money moves when both
--  sides agree". These are the hinges: who may open it, when, how often, and
--  what it must not be able to undo afterwards.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'), ('22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003')
on conflict (id) do nothing;
update public.profiles set roles = '{client}', status = 'verified'
  where id = '11111111-0000-0000-0000-000000000001';
update public.profiles set roles = '{lawyer}', status = 'verified'
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
update public.platform_settings set guarantee_hours = 24, guarantee_unconditional = true where id = 1;

-- One open request at a time (migration 017), so the client's slate is
-- cleared before each fixture that needs to open another.
delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price, status, delivered_at)
  values ('eeee0000-0000-0000-0000-00000000eeee','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','guarantee test', 250,
          'delivered', now() - interval '2 hours');

\echo '── only the client, and only on their own case ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'not yours'
            then 'PASS' else 'FAIL' end || '  the lawyer cannot refund their own work';
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'not yours'
            then 'PASS' else 'FAIL' end || '  nor can a stranger';

\echo '── inside the window it just happens ──'
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'refunded'
            then 'PASS' else 'FAIL' end || '  the client asks and it is done';
reset role;
select case when status = 'refunded' then 'PASS' else 'FAIL' end
  || '  the request is closed as refunded' from public.requests
  where id = 'eeee0000-0000-0000-0000-00000000eeee';
select case when outcome = 'refund' and lawyer_pct = 0 then 'PASS' else 'FAIL' end
  || '  and it is on the record as a decided dispute' from public.disputes
  where request_id = 'eeee0000-0000-0000-0000-00000000eeee';
select case when count(*) >= 1 then 'PASS' else 'FAIL' end
  || '  the lawyer is told' from public.notifications
  where to_id = '22222222-0000-0000-0000-000000000002' and type = 'resolved';

\echo '── once, and not twice ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'already disputed'
            then 'PASS' else 'FAIL' end || '  a second attempt changes nothing';

\echo '── and it cannot be walked back ──'
update public.requests set status = 'completed'
  where id = 'eeee0000-0000-0000-0000-00000000eeee';
reset role;
select case when status = 'refunded' then 'PASS' else 'FAIL' end
  || '  a refunded request stays refunded' from public.requests
  where id = 'eeee0000-0000-0000-0000-00000000eeee';

\echo '── outside the window it does not ──'
reset role;
delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price, status, delivered_at)
  values ('eeee0000-0000-0000-0000-00000000eeee','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','guarantee test', 250,
          'delivered', now() - interval '3 days');
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'window closed'
            then 'PASS' else 'FAIL' end || '  three days later the promise has run out';

\echo '── nor before there is anything to refuse ──'
reset role;
update public.requests set delivered_at = null, status = 'in_progress'
  where id = 'eeee0000-0000-0000-0000-00000000eeee';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'not delivered'
            then 'PASS' else 'FAIL' end || '  work that has not been delivered cannot be refunded';

\echo '── and not at all if the platform stops offering it ──'
reset role;
update public.platform_settings set guarantee_unconditional = false where id = 1;
update public.requests set delivered_at = now(), status = 'delivered'
  where id = 'eeee0000-0000-0000-0000-00000000eeee';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.refund_under_guarantee('eeee0000-0000-0000-0000-00000000eeee') = 'not offered'
            then 'PASS' else 'FAIL' end || '  the promise is the platform''s to make';
reset role;
update public.platform_settings set guarantee_unconditional = true where id = 1;

reset role;
set request.jwt.claim.sub = '';
