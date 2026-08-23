-- ===========================================================================
--  Security tests for migration 021 — supervision by the case, firms, and a
--  paid place at the top.
--
--  Three new ways to take something you were not given: sign advice with
--  nobody answerable for it, put your name on a firm's roster (or somebody
--  else's name on yours), and stand at the top of the directory without
--  paying. Each is refused below by the database.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- client
  ('22222222-0000-0000-0000-000000000002'),   -- lawyer, supervises single cases
  ('33333333-0000-0000-0000-000000000003'),   -- lawyer, mentors but not by the case
  ('44444444-0000-0000-0000-000000000004'),   -- lawyer, neither
  ('66666666-0000-0000-0000-000000000006'),   -- trainee, buys supervision
  ('77777777-0000-0000-0000-000000000007'),   -- trainee, fully supervised
  ('88888888-0000-0000-0000-000000000008'),   -- trainee, neither
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003',
               '44444444-0000-0000-0000-000000000004');
update public.profiles set roles='{intern}', status='verified'
  where id in ('66666666-0000-0000-0000-000000000006','77777777-0000-0000-0000-000000000007',
               '88888888-0000-0000-0000-000000000008');
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.firm_members; delete from public.firms;
delete from public.mentorship_invites;
delete from public.payouts; delete from public.payments;
delete from public.supervision_orders;
delete from public.mentorship_messages; delete from public.mentorship_sessions;
delete from public.mentorships;
delete from public.subscriptions;
delete from public.reviews; delete from public.quotes; delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
update public.profiles set is_mentor = false, mentorship_fee = null,
       supervises_cases = false, supervision_fee = null
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003',
               '44444444-0000-0000-0000-000000000004');
-- Taking trainees and supervising a single case are two switches, not one.
-- This lawyer mentors and does NOT sell case-by-case, which is what makes the
-- first check below mean anything.
update public.profiles set is_mentor = true, mentorship_fee = 80
  where id = '33333333-0000-0000-0000-000000000003';

\echo '── one case of supervision is priced inside the published band ──'
update public.profiles set supervises_cases = true, supervision_fee = 500
  where id = '22222222-0000-0000-0000-000000000002';
select case when coalesce(supervision_fee, 0) <> 500 then 'PASS' else 'FAIL' end
  || '  a fee above the band is refused'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';
update public.profiles set supervises_cases = true, supervision_fee = 75
  where id = '22222222-0000-0000-0000-000000000002';
select case when supervision_fee = 75 then 'PASS' else 'FAIL' end
  || '  and one inside it is kept'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';

\echo '── it is bought from somebody who offers it, and only through the door ──'
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when public.buy_supervision('33333333-0000-0000-0000-000000000003',
       'mada','r1') = 'not offered' then 'PASS' else 'FAIL' end
  || '  a lawyer who mentors but does not sell by the case is not bought from';
select case when public.buy_supervision('22222222-0000-0000-0000-000000000002',
       'mada','r2') = 'bought' then 'PASS' else 'FAIL' end
  || '  and one who does, can';
select case when public.buy_supervision('22222222-0000-0000-0000-000000000002',
       'mada','r3') = 'already bought' then 'PASS' else 'FAIL' end
  || '  one unspent order at a time';

insert into public.supervision_orders (mentor_id, intern_id, fee)
  values ('22222222-0000-0000-0000-000000000002','88888888-0000-0000-0000-000000000008', 0);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and nobody writes themselves a signature' from public.supervision_orders;

select case when amount = 7500 and supervision_id is not null
                 and request_id is null and mentorship_id is null
            then 'PASS' else 'FAIL' end
  || '  the charge is about the supervision, not a request and not a month'
  from public.payments where gateway_ref = 'r2';
select case when amount = 1125 then 'PASS' else 'FAIL' end
  || '  the platform takes its 15 per cent'
  from public.payouts where party = 'platform';
select case when amount = 6375 and profile_id = '22222222-0000-0000-0000-000000000002'
            then 'PASS' else 'FAIL' end
  || '  and the rest is owed to the lawyer who will sign'
  from public.payouts where party = 'lawyer';

\echo '── a trainee already supervised is sold nothing ──'
insert into public.mentorships (mentor_id, intern_id, opened_by, status, started_at)
  values ('33333333-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000007',
          'intern','active', now());
set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
select case when public.buy_supervision('22222222-0000-0000-0000-000000000002',
       'mada','r4') = 'already supervised' then 'PASS' else 'FAIL' end
  || '  because they already have somebody answerable for them';

\echo '── and a screening still needs somebody answerable ──'
reset role;
set request.jwt.claim.sub = '';
insert into public.requests (id, client_id, type_id, title, price)
  values ('2101aaaa-0000-0000-0000-0000000021a1','11111111-0000-0000-0000-000000000001',
          'free_screening','هل لدي قضية؟', 0);

update public.requests set assigned_to = '88888888-0000-0000-0000-000000000008'
  where id = '2101aaaa-0000-0000-0000-0000000021a1';
select case when assigned_to is null then 'PASS' else 'FAIL' end
  || '  a trainee with neither a mentor nor an order cannot take one'
  from public.requests where id = '2101aaaa-0000-0000-0000-0000000021a1';

update public.requests set assigned_to = '77777777-0000-0000-0000-000000000007'
  where id = '2101aaaa-0000-0000-0000-0000000021a1';
select case when lawyer_id = '33333333-0000-0000-0000-000000000003' then 'PASS' else 'FAIL' end
  || '  a fully supervised one brings their standing mentor'
  from public.requests where id = '2101aaaa-0000-0000-0000-0000000021a1';

update public.requests set assigned_to = '66666666-0000-0000-0000-000000000006'
  where id = '2101aaaa-0000-0000-0000-0000000021a1';
select case when lawyer_id = '22222222-0000-0000-0000-000000000002' then 'PASS' else 'FAIL' end
  || '  and one who bought a signature brings the lawyer they bought it from'
  from public.requests where id = '2101aaaa-0000-0000-0000-0000000021a1';
select case when status = 'used' and request_id = '2101aaaa-0000-0000-0000-0000000021a1'
            then 'PASS' else 'FAIL' end
  || '  taking the case spends the order, on that case'
  from public.supervision_orders where intern_id = '66666666-0000-0000-0000-000000000006';

set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when public.buy_supervision('22222222-0000-0000-0000-000000000002',
       'mada','r5') = 'bought' then 'PASS' else 'FAIL' end
  || '  and once spent, another may be bought';

\echo '── a trainee with no supervisor may call for one ──'
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
insert into public.mentorship_invites (id, intern_id, note)
  values ('2111aaaa-0000-0000-0000-0000000021b1','88888888-0000-0000-0000-000000000008',
          'أبحث عن مشرف في العمالي');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the call goes out' from public.mentorship_invites;

set role authenticated;
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
insert into public.mentorship_invites (intern_id, note)
  values ('88888888-0000-0000-0000-000000000008','ومرة أخرى');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  one call at a time' from public.mentorship_invites;

set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
insert into public.mentorship_invites (intern_id, note)
  values ('77777777-0000-0000-0000-000000000007','ولي مشرف');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and none at all with a supervisor already' from public.mentorship_invites;

\echo '── mentors see an open call; clients do not ──'
reset role;
set request.jwt.claim.sub = '';
update public.profiles set is_mentor = true, mentorship_fee = 80
  where id = '22222222-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer taking trainees sees it' from public.mentorship_invites;
set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  one who does not take trainees, does not' from public.mentorship_invites;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and a client never does' from public.mentorship_invites;

\echo '── the caller withdraws it and nothing else ──'
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
update public.mentorship_invites set status = 'taken',
       taken_by = '88888888-0000-0000-0000-000000000008'
  where id = '2111aaaa-0000-0000-0000-0000000021b1';
reset role;
select case when status = 'open' then 'PASS' else 'FAIL' end
  || '  a trainee cannot mark their own call taken'
  from public.mentorship_invites where id = '2111aaaa-0000-0000-0000-0000000021b1';

\echo '── and answering it closes it ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.mentorships (mentor_id, intern_id, opened_by, invite_id)
  values ('22222222-0000-0000-0000-000000000002','88888888-0000-0000-0000-000000000008',
          'mentor','2111aaaa-0000-0000-0000-0000000021b1');
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
update public.mentorships set status = 'active'
  where intern_id = '88888888-0000-0000-0000-000000000008';
reset role;
select case when status = 'taken' and taken_by = '22222222-0000-0000-0000-000000000002'
            then 'PASS' else 'FAIL' end
  || '  the call is closed by the mentorship that came out of it'
  from public.mentorship_invites where id = '2111aaaa-0000-0000-0000-0000000021b1';

\echo '── a firm is opened by a lawyer and verified by the desk ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.firms (owner_id, name) values
  ('11111111-0000-0000-0000-000000000001','مكتب العميل');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot open one' from public.firms;

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.firms (id, owner_id, name, city)
  values ('2121aaaa-0000-0000-0000-0000000021c1','22222222-0000-0000-0000-000000000002',
          'مكتب المحمدي للمحاماة','الرياض');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a verified lawyer can' from public.firms;
select case when ref like 'FRM-%' and status = 'pending' then 'PASS' else 'FAIL' end
  || '  with a reference, and waiting on the desk'
  from public.firms where id = '2121aaaa-0000-0000-0000-0000000021c1';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.firms set status = 'verified'
  where id = '2121aaaa-0000-0000-0000-0000000021c1';
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  and the owner cannot verify their own firm'
  from public.firms where id = '2121aaaa-0000-0000-0000-0000000021c1';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a firm waiting on the desk is not in the directory' from public.firms;
reset role;
set request.jwt.claim.sub = '';
update public.firms set status = 'verified'
  where id = '2121aaaa-0000-0000-0000-0000000021c1';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  once verified, it is' from public.firms;

\echo '── a roster is joined, not declared ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.firm_members (firm_id, profile_id, role, status)
  values ('2121aaaa-0000-0000-0000-0000000021c1','33333333-0000-0000-0000-000000000003',
          'partner','active');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a firm cannot put somebody on its page as joined' from public.firm_members;

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.firm_members (firm_id, profile_id, role)
  values ('2121aaaa-0000-0000-0000-0000000021c1','33333333-0000-0000-0000-000000000003','partner');
update public.firm_members set status = 'active'
  where profile_id = '33333333-0000-0000-0000-000000000003';
reset role;
select case when status = 'invited' then 'PASS' else 'FAIL' end
  || '  nor accept on their behalf' from public.firm_members;

set role authenticated;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
update public.firm_members set status = 'active'
  where profile_id = '33333333-0000-0000-0000-000000000003';
reset role;
select case when status = 'active' and joined_at is not null then 'PASS' else 'FAIL' end
  || '  the person named may, and the moment is stamped' from public.firm_members;

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and then the roster is public' from public.firm_members;

\echo '── a place at the top is paid for, or it is not held ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when public.is_paid_featured('22222222-0000-0000-0000-000000000002') = false
            then 'PASS' else 'FAIL' end
  || '  nobody is featured by default';
reset role;
set request.jwt.claim.sub = '';
insert into public.subscriptions (lawyer_id, plan, price, active)
  values ('22222222-0000-0000-0000-000000000002','featured', 300, true);
select case when public.is_paid_featured('22222222-0000-0000-0000-000000000002') = true
            then 'PASS' else 'FAIL' end
  || '  a live subscription puts them there';
update public.subscriptions set ends_at = now() - interval '1 day'
  where lawyer_id = '22222222-0000-0000-0000-000000000002' and plan = 'featured';
select case when public.is_paid_featured('22222222-0000-0000-0000-000000000002') = false
            then 'PASS' else 'FAIL' end
  || '  and one that ran out takes it away with nothing to expire by hand';

select case when public.firm_is_listed('2121aaaa-0000-0000-0000-0000000021c1') = false
            then 'PASS' else 'FAIL' end
  || '  a verified firm with no subscription is not listed';
insert into public.subscriptions (lawyer_id, plan, price, active, firm_id)
  values ('22222222-0000-0000-0000-000000000002','firm', 900, true,
          '2121aaaa-0000-0000-0000-0000000021c1');
select case when public.firm_is_listed('2121aaaa-0000-0000-0000-0000000021c1') = true
            then 'PASS' else 'FAIL' end
  || '  and one that pays is';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.subscriptions (lawyer_id, plan, price, active)
  values ('22222222-0000-0000-0000-000000000002','featured', 0, true);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and nobody grants themselves one'
  from public.subscriptions where plan = 'featured';

reset role;
set request.jwt.claim.sub = '';
