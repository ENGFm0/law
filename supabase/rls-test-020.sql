-- ===========================================================================
--  Security tests for migration 020 — screening, sponsorship, discounts.
--
--  Three new ways to take something: give legal advice with nobody checking
--  it, be paid for supervision you are not giving, or spend a discount that
--  is not yours. Each is refused below by the database.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- client
  ('44444444-0000-0000-0000-000000000004'),   -- another client
  ('22222222-0000-0000-0000-000000000002'),   -- mentor lawyer
  ('33333333-0000-0000-0000-000000000003'),   -- lawyer, no trainees
  ('66666666-0000-0000-0000-000000000006'),   -- supervised trainee
  ('77777777-0000-0000-0000-000000000007'),   -- unsupervised trainee
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id in ('11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000004');
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
update public.profiles set roles='{intern}', status='verified'
  where id in ('66666666-0000-0000-0000-000000000006','77777777-0000-0000-0000-000000000007');
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.promo_redemptions;
delete from public.promo_codes;
delete from public.payouts;
delete from public.payments;
delete from public.mentorship_messages;
delete from public.mentorship_sessions;
delete from public.mentorships;
delete from public.reviews; delete from public.quotes; delete from public.disputes;
delete from public.requests
  where client_id in ('11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000004');

\echo '── a monthly sponsorship sits inside the published band ──'
update public.profiles set is_mentor = true, mentorship_fee = 500
  where id = '22222222-0000-0000-0000-000000000002';
select case when coalesce(mentorship_fee, 0) <> 500 then 'PASS' else 'FAIL' end
  || '  a fee above the band is refused'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';
update public.profiles set is_mentor = true, mentorship_fee = 80
  where id = '22222222-0000-0000-0000-000000000002';
select case when mentorship_fee = 80 then 'PASS' else 'FAIL' end
  || '  and one inside it is kept'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';

insert into public.mentorships (id, mentor_id, intern_id, opened_by, status, started_at)
  values ('2011aaaa-0000-0000-0000-0000000020a1','22222222-0000-0000-0000-000000000002',
          '66666666-0000-0000-0000-000000000006','intern','active', now());

\echo '── a screening is free, and free means free ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (client_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001','free_screening','quietly charged for', 200);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a screening with a price on it is refused'
  from public.requests where title = 'quietly charged for';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, type_id, title, price)
  values ('2021aaaa-0000-0000-0000-0000000020a2','11111111-0000-0000-0000-000000000001',
          'free_screening','هل لدي قضية؟', 0);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and one at zero goes through' from public.requests
 where id = '2021aaaa-0000-0000-0000-0000000020a2';

\echo '── nobody advises on their own ──'
update public.requests set assigned_to = '77777777-0000-0000-0000-000000000007'
  where id = '2021aaaa-0000-0000-0000-0000000020a2';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  a trainee with no supervisor cannot take a screening'
  from public.requests where id = '2021aaaa-0000-0000-0000-0000000020a2';

update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where id = '2021aaaa-0000-0000-0000-0000000020a2';
select case when assigned_to = '66666666-0000-0000-0000-000000000006' then 'PASS' else 'FAIL' end
  || '  a supervised one can'
  from public.requests where id = '2021aaaa-0000-0000-0000-0000000020a2';
select case when lawyer_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  and their mentor lands on it as the lawyer answerable for it'
  from public.requests where id = '2021aaaa-0000-0000-0000-0000000020a2';

\echo '── a screening and a paid case are different commitments ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('2031aaaa-0000-0000-0000-0000000020a3','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','paid work', 250);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  an open screening does not block paid work'
  from public.requests where id = '2031aaaa-0000-0000-0000-0000000020a3';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.requests (client_id, type_id, title, price)
  values ('11111111-0000-0000-0000-000000000001','free_screening','a second screening', 0);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  but two open screenings are two too many'
  from public.requests where title = 'a second screening';

\echo '── the sponsorship is paid by the trainee, and only by them ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.charge_sponsorship('2011aaaa-0000-0000-0000-0000000020a1',
       'mada', 'ref-outsider') = 'not yours' then 'PASS' else 'FAIL' end
  || '  somebody else cannot pay for it';

set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when public.charge_sponsorship('2011aaaa-0000-0000-0000-0000000020a1',
       'mada', 'ref-one') = 'paid' then 'PASS' else 'FAIL' end
  || '  the trainee pays for their own supervision';
reset role;
select case when amount = 8000 and mentorship_id is not null and request_id is null
            then 'PASS' else 'FAIL' end
  || '  the charge is 80 riyals in halalas, against the mentorship not a request'
  from public.payments where gateway_ref = 'ref-one';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and it splits two ways' from public.payouts;
select case when amount = 1200 then 'PASS' else 'FAIL' end
  || '  the platform takes its 15 per cent'
  from public.payouts where party = 'platform';
select case when amount = 6800 and profile_id = '22222222-0000-0000-0000-000000000002'
            then 'PASS' else 'FAIL' end
  || '  and the rest queues to the supervising lawyer'
  from public.payouts where party = 'lawyer';
select case when paid_until > now() then 'PASS' else 'FAIL' end
  || '  the supervision is paid up' from public.mentorships
 where id = '2011aaaa-0000-0000-0000-0000000020a1';

set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when public.charge_sponsorship('2011aaaa-0000-0000-0000-0000000020a1',
       'mada', 'ref-one') = 'already paid' then 'PASS' else 'FAIL' end
  || '  and the same gateway reference is not charged twice';

\echo '── money is read by the two of them, written by neither ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer sees what they were paid' from public.payments;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer outside it sees nothing' from public.payments;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
insert into public.payouts (payment_id, party, profile_id, amount)
  select id, 'lawyer', '66666666-0000-0000-0000-000000000006', 999999
    from public.payments limit 1;
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and nobody writes themselves a payout' from public.payouts;

\echo '── a discount comes out of the commission, never out of the work ──'
insert into public.promo_codes (code, discount_pct, active) values ('SANAD10', 10, true);
insert into public.promo_codes (code, discount_pct, active, expires_at)
  values ('OLDONE', 50, true, now() - interval '1 day');
insert into public.promo_codes (code, discount_pct, active) values ('OFFNOW', 50, false);
insert into public.promo_codes (code, discount_pct, active, usage_limit, used_count)
  values ('SPENT', 50, true, 2, 2);
insert into public.promo_codes (code, discount_pct, active, max_discount)
  values ('CAPPED', 50, true, 500);
insert into public.promo_codes (code, discount_pct, active) values ('BIGCUT', 50, true);
insert into public.promo_codes (code, discount_pct, active, client_id)
  values ('MINE', 10, true, '44444444-0000-0000-0000-000000000004');

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
-- 25,000 halalas of work: 10 per cent is 2,500, and the commission is 2,500.
select case when ok and discount = 2500 then 'PASS' else 'FAIL' end
  || '  ten per cent of 250 riyals is 25 riyals'
  from public.validate_promo_code('SANAD10', 25000);
-- Half of it would be 12,500, and the whole commission is 2,500.
select case when ok and discount = 2500 and reason = 'capped at our commission'
            then 'PASS' else 'FAIL' end
  || '  a bigger code is capped at what the platform earns, and says so'
  from public.validate_promo_code('BIGCUT', 25000);
select case when ok and discount = 500 then 'PASS' else 'FAIL' end
  || '  and its own ceiling binds first when it is lower'
  from public.validate_promo_code('CAPPED', 100000);
select case when not ok and reason = 'unknown' then 'PASS' else 'FAIL' end
  || '  a code nobody issued is unknown' from public.validate_promo_code('NOPE', 25000);
select case when not ok and reason = 'expired' then 'PASS' else 'FAIL' end
  || '  an expired one says expired' from public.validate_promo_code('OLDONE', 25000);
select case when not ok and reason = 'withdrawn' then 'PASS' else 'FAIL' end
  || '  a withdrawn one says withdrawn' from public.validate_promo_code('OFFNOW', 25000);
select case when not ok and reason = 'used up' then 'PASS' else 'FAIL' end
  || '  and one at its limit says used up' from public.validate_promo_code('SPENT', 25000);
select case when not ok and reason = 'not yours' then 'PASS' else 'FAIL' end
  || '  somebody else''s personal code is not yours'
  from public.validate_promo_code('MINE', 25000);

\echo '── spending it moves the counter, once ──'
select case when public.redeem_promo_code('SANAD10','2031aaaa-0000-0000-0000-0000000020a3')
            = 'applied' then 'PASS' else 'FAIL' end || '  the code applies to the order';
reset role;
select case when promo_code = 'SANAD10' and promo_discount = 2500 then 'PASS' else 'FAIL' end
  || '  and is written on the request'
  from public.requests where id = '2031aaaa-0000-0000-0000-0000000020a3';
select case when used_count = 1 then 'PASS' else 'FAIL' end
  || '  the counter moves' from public.promo_codes where code = 'SANAD10';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  against a redemption anybody can check' from public.promo_redemptions;

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when public.redeem_promo_code('SANAD10','2031aaaa-0000-0000-0000-0000000020a3')
            = 'already discounted' then 'PASS' else 'FAIL' end
  || '  one order takes one code';
select case when not ok and reason = 'already used' then 'PASS' else 'FAIL' end
  || '  and one person spends it once'
  from public.validate_promo_code('SANAD10', 25000);

\echo '── and nobody writes their own discount ──'
insert into public.promo_codes (code, discount_pct) values ('FREEBIE', 100);
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot issue a code' from public.promo_codes where code = 'FREEBIE';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.promo_redemptions (promo_id, client_id, amount)
  select id, auth.uid(), 999999 from public.promo_codes where code = 'CAPPED';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor write a redemption by hand' from public.promo_redemptions;

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor read the whole book of codes' from public.promo_codes;
set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a person sees only the one cut for them' from public.promo_codes;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) >= 6 then 'PASS' else 'FAIL' end
  || '  and the desk sees all of them' from public.promo_codes;

\echo '── a finished screening is worth an offer, not a banner ──'
reset role;
set request.jwt.claim.sub = '';
update public.requests set status = 'delivered', body = 'التحليل'
  where id = '2021aaaa-0000-0000-0000-0000000020a2';
update public.requests set status = 'completed'
  where id = '2021aaaa-0000-0000-0000-0000000020a2';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client is issued a real code when the screening completes'
  from public.promo_codes
 where client_id = '11111111-0000-0000-0000-000000000001' and discount_pct = 10;
select case when usage_limit = 1 and expires_at > now() then 'PASS' else 'FAIL' end
  || '  one use, and it runs out' from public.promo_codes
 where client_id = '11111111-0000-0000-0000-000000000001' and discount_pct = 10;

reset role;
set request.jwt.claim.sub = '';
