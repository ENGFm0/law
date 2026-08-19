-- ===========================================================================
--  Security tests for schema.sql.
--
--  The row-level security in this project is not a formality — it is the only
--  thing standing between a public anon key and every client's file. So it is
--  tested the way application code is: run it, and check what actually happened.
--
--  Usage against a local Postgres (not Supabase, which already provides auth):
--      psql -f supabase/local-prelude.sql
--      psql -f supabase/schema.sql
--      psql -f supabase/rls-test.sql
--
--  Every check prints PASS or FAIL. Errors printed along the way are expected:
--  they are the policies doing their job. What matters is the verdicts.
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
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444');

-- Since migration 002 a profile already exists for every auth user, created by
-- the trigger as a verified client. Setting up a lawyer or a trainee therefore
-- means updating that row, not inserting one — which is what the application
-- does too. Run as owner with no JWT claim, so the guard trigger stays out of
-- the way; it only fires when a user edits themselves.
insert into public.profiles (id, full_name, roles, status) values
  ('11111111-1111-1111-1111-111111111111','Client A','{client}','verified'),
  ('22222222-2222-2222-2222-222222222222','Client B','{client}','verified'),
  ('33333333-3333-3333-3333-333333333333','Lawyer','{lawyer}','verified'),
  ('44444444-4444-4444-4444-444444444444','Trainee','{intern}','pending')
on conflict (id) do update set
  full_name = excluded.full_name,
  roles     = excluded.roles,
  status    = excluded.status;

insert into public.requests (id, client_id, lawyer_id, type_id, title, price, status)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        'written','Client A''s matter', 100, 'delivered');

\echo '── a request is visible only to its parties ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  its own client sees it' from public.requests;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  another client cannot' from public.requests;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer on it can' from public.requests;

\echo '── only the client of a delivered request may rate it ──'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.reviews (target_id, author_id, request_id, rating) values
  ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001',5);
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.reviews (target_id, author_id, request_id, rating) values
  ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-0000-0000-0000-000000000001',1);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the paying client''s rating stands' from public.reviews
  where author_id = '11111111-1111-1111-1111-111111111111';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a stranger''s rating is refused' from public.reviews
  where author_id = '22222222-2222-2222-2222-222222222222';

\echo '── the price band is enforced in the database, not the form ──'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.services (owner_id, type_id, price)
  values ('33333333-3333-3333-3333-333333333333','written',120);
insert into public.services (owner_id, type_id, price)
  values ('33333333-3333-3333-3333-333333333333','written',10);
insert into public.services (owner_id, type_id, price)
  values ('33333333-3333-3333-3333-333333333333','written',9000);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  only the price inside the band survived' from public.services;

\echo '── nobody verifies themselves ──'
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
update public.profiles set status = 'verified', bio = 'edited'
  where id = '44444444-4444-4444-4444-444444444444';
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  a self-granted licence is ignored' from public.profiles
  where id = '44444444-4444-4444-4444-444444444444';
select case when bio = 'edited' then 'PASS' else 'FAIL' end
  || '  but the rest of the profile still saves' from public.profiles
  where id = '44444444-4444-4444-4444-444444444444';

\echo '── a certificate needs a lawyer who actually supervised ──'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.endorsements (intern_id, lawyer_id, hours) values
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',40);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  refused before any work was routed' from public.endorsements;
update public.requests set assigned_to = '44444444-4444-4444-4444-444444444444'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.endorsements (intern_id, lawyer_id, hours) values
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',40);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  accepted once they have supervised them' from public.endorsements;

\echo '── a Google sign-in gets a profile without touching our code ──'
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-9999-9999-999999999999', 'g@gmail.com',
   '{"full_name":"Google Person","avatar_url":"https://x/y.png"}'::jsonb)
on conflict (id) do nothing;
select case when full_name = 'Google Person' and status = 'verified'
              and roles = '{client}' then 'PASS' else 'FAIL' end
  || '  the trigger created it as a verified client' from public.profiles
  where id = '99999999-9999-9999-9999-999999999999';

\echo '── and cannot then declare itself a licensed lawyer ──'
set role authenticated;
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
update public.profiles set roles = '{lawyer}', licence_no = '9999', bio = 'claimed'
  where id = '99999999-9999-9999-9999-999999999999';
set request.jwt.claim.sub = '';
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  taking a professional role drops it to pending' from public.profiles
  where id = '99999999-9999-9999-9999-999999999999';
select case when bio = 'claimed' then 'PASS' else 'FAIL' end
  || '  while the rest of that edit still saves' from public.profiles
  where id = '99999999-9999-9999-9999-999999999999';

\echo '── an unpublished article is not public ──'
insert into public.articles (id, author_id, title, body, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444','Draft','body','pending');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot read an unsigned draft' from public.articles;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer sees it, to sign it' from public.articles;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  its author sees their own' from public.articles;
reset role;
