-- ===========================================================================
--  Security tests for migration 003 — staff, disputes, money and the record.
--
--  The rules being tested are the ones that decide who gets paid, so they are
--  not left to a hidden button. Every one of them is attempted here from an
--  account that should not be able to do it.
--
--      psql -f supabase/local-prelude.sql
--      psql -f supabase/schema.sql
--      psql -f supabase/migrations/002-oauth-and-status.sql
--      psql -f supabase/migrations/003-staff-disputes-and-money.sql
--      psql -f supabase/rls-test-003.sql
--
--  Errors printed along the way are expected — they are the rules refusing.
--  What matters is the verdicts.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;

truncate auth.users cascade;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),   -- the client
  ('22222222-2222-2222-2222-222222222222'),   -- a stranger
  ('33333333-3333-3333-3333-333333333333'),   -- the lawyer
  ('44444444-4444-4444-4444-444444444444'),   -- the trainee
  ('55555555-5555-5555-5555-555555555555');   -- platform staff

insert into public.profiles (id, full_name, roles, status) values
  ('11111111-1111-1111-1111-111111111111','Client','{client}','verified'),
  ('22222222-2222-2222-2222-222222222222','Stranger','{client}','verified'),
  ('33333333-3333-3333-3333-333333333333','Lawyer','{lawyer}','verified'),
  ('44444444-4444-4444-4444-444444444444','Trainee','{intern}','pending'),
  ('55555555-5555-5555-5555-555555555555','Staff','{staff}','verified')
on conflict (id) do update set
  full_name = excluded.full_name, roles = excluded.roles, status = excluded.status;

insert into public.requests (id, client_id, lawyer_id, assigned_to, type_id, title,
                             price, status, delivered_at)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        'written','A delivered matter', 100, 'delivered', now());

\echo '── the licence queue: nobody approves themselves ──'
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
update public.profiles set status = 'verified'
  where id = '44444444-4444-4444-4444-444444444444';
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  a trainee cannot verify themselves' from public.profiles
  where id = '44444444-4444-4444-4444-444444444444';

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
update public.profiles set status = 'verified'
  where id = '44444444-4444-4444-4444-444444444444';
reset role;
select case when status = 'verified' then 'PASS' else 'FAIL' end
  || '  staff can' from public.profiles
  where id = '44444444-4444-4444-4444-444444444444';

\echo '── a role nobody grants themselves ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.profiles set roles = '{client,staff}'
  where id = '11111111-1111-1111-1111-111111111111';
reset role;
select case when not ('staff' = any(roles)) then 'PASS' else 'FAIL' end
  || '  a client cannot make themselves staff' from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';

\echo '── only the client of a delivered request may refuse it ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.disputes (request_id, by_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222','not my request');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.disputes (request_id, by_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333','I refuse my own delivery');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.disputes (request_id, by_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111','the clause is missing');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  only the client''s refusal was recorded' from public.disputes;

\echo '── a refusal with no reason is not reviewable ──'
insert into public.disputes (request_id, by_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111','   ');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  an empty reason is refused' from public.disputes;

\echo '── and it cannot be opened twice ──'
insert into public.disputes (request_id, by_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111','again');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a second refusal on the same request is refused' from public.disputes;

\echo '── who can read it ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a stranger sees no dispute' from public.disputes;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer being complained about does' from public.disputes;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and so does staff' from public.disputes;

\echo '── the decision ──'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.disputes set status = 'resolved', outcome = 'refund',
  resolution_reason = 'I decide in my own favour',
  resolved_by = '11111111-1111-1111-1111-111111111111';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a party cannot decide their own dispute' from public.disputes
  where status = 'resolved';

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
update public.disputes set status = 'resolved', outcome = 'split',
  resolution_reason = '', resolved_by = '55555555-5555-5555-5555-555555555555',
  lawyer_pct = 60;
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a ruling with no written reason is refused' from public.disputes
  where status = 'resolved';

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
update public.disputes set status = 'resolved', outcome = 'split',
  lawyer_pct = null, resolution_reason = 'most of it was delivered',
  resolved_by = '55555555-5555-5555-5555-555555555555';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a split with no share is refused' from public.disputes
  where status = 'resolved';

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
update public.disputes set status = 'resolved', outcome = 'split', lawyer_pct = 60,
  resolution_reason = 'most of it was delivered',
  resolved_by = '55555555-5555-5555-5555-555555555555';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a reasoned ruling by staff stands' from public.disputes
  where status = 'resolved';

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
update public.disputes set outcome = 'refund',
  resolution_reason = 'changed my mind';
reset role;
select case when outcome = 'split' then 'PASS' else 'FAIL' end
  || '  and it is decided once, not revisited' from public.disputes;

\echo '── one revision, and the count only goes up ──'
update public.requests set revisions = 1
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.requests set revisions = 2
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select case when revisions = 1 then 'PASS' else 'FAIL' end
  || '  a second revision is refused' from public.requests
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.requests set revisions = 0
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select case when revisions = 1 then 'PASS' else 'FAIL' end
  || '  and a used one cannot be taken back' from public.requests
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '── the commission cap lives in the database ──'
update public.platform_settings set commission_pct = 15 where id = 1;
select case when commission_pct <= 10 then 'PASS' else 'FAIL' end
  || '  above 10% is refused' from public.platform_settings;
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
update public.platform_settings set commission_pct = 0 where id = 1;
reset role;
select case when commission_pct = 10 then 'PASS' else 'FAIL' end
  || '  and a lawyer cannot set it to zero' from public.platform_settings;

\echo '── tax ships off ──'
select case when vat_enabled = false then 'PASS' else 'FAIL' end
  || '  nothing is charged until somebody turns it on' from public.platform_settings;

\echo '── money is not written from a browser ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.payments (request_id, client_id, gateway, gateway_ref, amount)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111','moyasar','ref-1', 10000);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot record their own payment' from public.payments;

insert into public.payments (id, request_id, client_id, gateway, gateway_ref, amount)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111','moyasar','ref-1', 10000);
insert into public.payments (request_id, client_id, gateway, gateway_ref, amount)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111','moyasar','ref-1', 10000);
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the same gateway reference cannot be acted on twice' from public.payments;

\echo '── the record is appended to, never changed ──'
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
insert into public.audit_log (action, by_id, subject)
  values ('approve','55555555-5555-5555-5555-555555555555','Trainee');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.audit_log (action, by_id, subject)
  values ('approve','11111111-1111-1111-1111-111111111111','myself');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot read the record' from public.audit_log;
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  only the staff entry was written' from public.audit_log;

update public.audit_log set subject = 'something else';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  an entry cannot be edited' from public.audit_log where subject = 'Trainee';
delete from public.audit_log;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor deleted' from public.audit_log;
