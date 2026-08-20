-- ===========================================================================
--  Security tests for migration 006 — the console's own tables.
--
--  What the platform spends and what its partners take is nobody's business
--  but the platform's, and the console reads it from a browser holding a key
--  anyone can copy. So every one of these is attempted from an ordinary
--  account before it is attempted from staff.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
delete from public.partners; delete from public.operating_costs;
delete from public.announcements; delete from public.subscriptions;
delete from public.profiles where id in
  ('eeeeeeee-0000-0000-0000-00000000eeee','ffffffff-0000-0000-0000-00000000ffff');
delete from auth.users where id in
  ('eeeeeeee-0000-0000-0000-00000000eeee','ffffffff-0000-0000-0000-00000000ffff');
insert into auth.users (id) values
  ('eeeeeeee-0000-0000-0000-00000000eeee'), ('ffffffff-0000-0000-0000-00000000ffff');
update public.profiles set roles = '{client,staff}', active_role = 'staff', onboarded = true
  where id = 'eeeeeeee-0000-0000-0000-00000000eeee';
update public.profiles set roles = '{lawyer}', active_role = 'lawyer', status = 'pending'
  where id = 'ffffffff-0000-0000-0000-00000000ffff';

\echo '── approving somebody is a staff act, and it sticks ──'
set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
update public.profiles set status = 'verified' where id = auth.uid();
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  a lawyer cannot approve themselves' from public.profiles
  where id = 'ffffffff-0000-0000-0000-00000000ffff';

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
update public.profiles set status = 'verified'
  where id = 'ffffffff-0000-0000-0000-00000000ffff';
reset role;
select case when status = 'verified' then 'PASS' else 'FAIL' end
  || '  staff can, and the row keeps it' from public.profiles
  where id = 'ffffffff-0000-0000-0000-00000000ffff';

\echo '── the price bands ──'
set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
update public.price_bands set max_price = 99999 where type_id = 'express';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot widen the band they sell in'
  from public.price_bands where type_id = 'express' and max_price = 99999;

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
update public.price_bands set max_price = 500 where type_id = 'express';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  staff can' from public.price_bands where type_id = 'express' and max_price = 500;

\echo '── announcements are public to read and staff to write ──'
set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
insert into public.announcements (title) values ('من محامٍ');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot post one' from public.announcements;

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
insert into public.announcements (title, active) values ('إعلان حيّ', true);
insert into public.announcements (title, active) values ('مسودّة', false);
reset role;
set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  everyone sees the live one and not the draft' from public.announcements;
reset role;

\echo '── what the platform spends is its own business ──'
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
insert into public.operating_costs (name, amount, period) values ('خادم', 400, 'monthly');
insert into public.partners (name, share_pct) values ('شريك', 40);
reset role;

set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot read the running costs' from public.operating_costs;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor who the partners are' from public.partners;
insert into public.partners (name, share_pct) values ('أنا', 100);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor add themselves as one' from public.partners;

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  staff read the costs' from public.operating_costs;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the partners' from public.partners;
reset role;

\echo '── a share outside nought to a hundred is not a share ──'
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
insert into public.partners (name, share_pct) values ('مستحيل', 140);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  140% is refused' from public.partners;

\echo '── subscriptions ──'
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000eeee';
insert into public.subscriptions (lawyer_id, price)
  values ('ffffffff-0000-0000-0000-00000000ffff', 199);
reset role;
set role authenticated;
set request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000ffff';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer sees their own subscription' from public.subscriptions;
insert into public.subscriptions (lawyer_id, price)
  values ('ffffffff-0000-0000-0000-00000000ffff', 0);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  but cannot grant themselves another' from public.subscriptions;
