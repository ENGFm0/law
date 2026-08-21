-- ===========================================================================
--  Security tests for migration 008 — the auction, the catalogue and the two
--  sides of a request.
--
--  The auction is the one place on the site where a stranger is shown someone
--  else's case on purpose. Every line below is a way that could go wrong: a
--  lawyer bidding as another lawyer, a rival reading the field, a bidder
--  declaring themselves the winner, a client rewriting the price after the
--  work is done.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';

delete from public.offers; delete from public.quotes;
delete from public.requests where title = 'test case';
delete from public.profiles where id in (
  '11111111-0000-0000-0000-000000000001',   -- the client
  '22222222-0000-0000-0000-000000000002',   -- a verified lawyer
  '33333333-0000-0000-0000-000000000003',   -- a rival, also verified
  '44444444-0000-0000-0000-000000000004',   -- a lawyer still pending
  '55555555-0000-0000-0000-000000000005');  -- staff
delete from auth.users where id in (
  '11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000004',
  '55555555-0000-0000-0000-000000000005');
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),('22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003'),('44444444-0000-0000-0000-000000000004'),
  ('55555555-0000-0000-0000-000000000005');
update public.profiles set roles = '{client}', active_role = 'client', onboarded = true
  where id = '11111111-0000-0000-0000-000000000001';
update public.profiles set roles = '{lawyer}', active_role = 'lawyer', status = 'verified'
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
update public.profiles set roles = '{lawyer}', active_role = 'lawyer', status = 'pending'
  where id = '44444444-0000-0000-0000-000000000004';
update public.profiles set roles = '{client,staff}', active_role = 'staff', onboarded = true
  where id = '55555555-0000-0000-0000-000000000005';

insert into public.quotes (id, client_id, type_id, channel, brief, expires_at) values
  ('aaaaaaaa-0000-0000-0000-00000000aaaa','11111111-0000-0000-0000-000000000001',
   'consult','text','a question about a lease', now() + interval '30 minutes');

\echo '── who may look at the board ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a verified lawyer sees an open brief' from public.quotes;

set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer whose licence is unchecked sees nothing' from public.quotes;

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client sees their own brief' from public.quotes;

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  staff see the board' from public.quotes;

\echo '── posting a brief ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.quotes (client_id, type_id, brief, expires_at)
  values ('11111111-0000-0000-0000-000000000001','consult','posted by someone else',
          now() + interval '10 minutes');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot post a brief in a client''s name'
  from public.quotes where brief = 'posted by someone else';

\echo '── bidding ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.offers (quote_id, lawyer_id, price, eta)
  values ('aaaaaaaa-0000-0000-0000-00000000aaaa','22222222-0000-0000-0000-000000000002', 200, 24);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer bids on an open brief' from public.offers;

set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
insert into public.offers (quote_id, lawyer_id, price)
  values ('aaaaaaaa-0000-0000-0000-00000000aaaa','22222222-0000-0000-0000-000000000002', 90);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot bid in another lawyer''s name' from public.offers;

set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
insert into public.offers (quote_id, lawyer_id, price)
  values ('aaaaaaaa-0000-0000-0000-00000000aaaa','33333333-0000-0000-0000-000000000003', 5000);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  an offer outside the published band is refused' from public.offers;

\echo '── who reads the field ──'
set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a rival cannot read another lawyer''s offer' from public.offers;

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client reads the offers on their own brief' from public.offers;

\echo '── closing it ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.quotes set status = 'accepted', accepted_by = '22222222-0000-0000-0000-000000000002'
  where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
reset role;
select case when status = 'open' then 'PASS' else 'FAIL' end
  || '  a bidder cannot declare themselves the winner'
  from public.quotes where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.quotes set status = 'accepted', accepted_by = '22222222-0000-0000-0000-000000000002'
  where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
reset role;
select case when status = 'accepted' then 'PASS' else 'FAIL' end
  || '  the client takes the offer they want'
  from public.quotes where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.offers (quote_id, lawyer_id, price)
  values ('aaaaaaaa-0000-0000-0000-00000000aaaa','33333333-0000-0000-0000-000000000003', 150);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nobody bids on a brief that has been taken' from public.offers;

\echo '── the request that comes out of it ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price, channel)
  values ('bbbbbbbb-0000-0000-0000-00000000bbbb','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','test case', 200, 'text');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the agreed work becomes a request with both parties on it'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer sees it in their own list'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer who was not taken sees nothing'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.requests set status = 'completed' where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
reset role;
select case when status = 'completed' then 'PASS' else 'FAIL' end
  || '  the client accepts the delivery on their own case'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.requests set price = 1 where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
reset role;
select case when price = 200 then 'PASS' else 'FAIL' end
  || '  the client cannot rewrite the agreed price'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.requests set lawyer_id = '33333333-0000-0000-0000-000000000003'
  where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';
reset role;
select case when lawyer_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  the client cannot swap the lawyer out'
  from public.requests where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb';

\echo '── the catalogue ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.service_types (id, title_ar, title_en) values ('bogus','مزور','Forged');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer cannot add a category' from public.service_types where id = 'bogus';

set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
insert into public.service_types (id, title_ar, title_en, channels)
  values ('company','تأسيس شركة','Company formation','{text,video}');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  staff add a category' from public.service_types where id = 'company';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) >= 7 then 'PASS' else 'FAIL' end
  || '  everyone can read the catalogue' from public.service_types;

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
delete from public.service_types where id = 'consult';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a category in use cannot be deleted' from public.service_types where id = 'consult';

set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
delete from public.service_types where id = 'company';
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  an unused category can be' from public.service_types where id = 'company';

reset role;
set request.jwt.claim.sub = '';

\echo '── bids that answer at once ──'
reset role;
set request.jwt.claim.sub = '';
update public.profiles set auto_bid = true  where id = '33333333-0000-0000-0000-000000000003';
update public.profiles set auto_bid = false where id = '22222222-0000-0000-0000-000000000002';
delete from public.services where owner_id in
  ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
insert into public.services (owner_id, type_id, price, channels) values
  ('33333333-0000-0000-0000-000000000003','consult', 250, '{text,voice}'),
  ('22222222-0000-0000-0000-000000000002','consult', 300, '{text}');
-- One open request at a time (migration 017), so the client's slate is
-- cleared before each fixture that needs to open another.
delete from public.offers; delete from public.quotes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.quotes (id, client_id, type_id, channel, brief, expires_at) values
  ('cccccccc-0000-0000-0000-00000000cccc','11111111-0000-0000-0000-000000000001',
   'consult','text','a second question', now() + interval '30 minutes');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer who takes work automatically has already bid'
  from public.offers where lawyer_id = '33333333-0000-0000-0000-000000000003' and auto;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer who has not said so has not'
  from public.offers where lawyer_id = '22222222-0000-0000-0000-000000000002';
select case when price = 250 then 'PASS' else 'FAIL' end
  || '  the bid is their own listed price'
  from public.offers where lawyer_id = '33333333-0000-0000-0000-000000000003';
select case when count(*) >= 2 then 'PASS' else 'FAIL' end
  || '  every lawyer who could take it was told' from public.notifications
  where type = 'quote' and ref = 'cccccccc-0000-0000-0000-00000000cccc';

-- A price the platform no longer allows is pulled back to the band rather
-- than let through: the band is the platform's promise, not the lawyer's.
reset role;
update public.price_bands set max_price = 200 where type_id = 'consult';
delete from public.offers; delete from public.quotes;
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.quotes (client_id, type_id, channel, brief, expires_at) values
  ('11111111-0000-0000-0000-000000000001','consult','text','a third question',
   now() + interval '30 minutes');
reset role;
select case when price = 200 then 'PASS' else 'FAIL' end
  || '  an automatic bid is clamped to the published band'
  from public.offers where lawyer_id = '33333333-0000-0000-0000-000000000003';
update public.price_bands set max_price = 500 where type_id = 'consult';

reset role;
set request.jwt.claim.sub = '';
