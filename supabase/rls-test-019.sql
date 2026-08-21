-- ===========================================================================
--  Security tests for migration 019 — drafting, workshops, supervision.
--
--  Three new ways for somebody to take something they were not given: spend a
--  subscription that is not theirs, sit in a room that is full, or supervise
--  themselves into a certificate. Each is refused below by the database, not
--  by the page.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- client
  ('22222222-0000-0000-0000-000000000002'),   -- lawyer, pays for the assistant
  ('33333333-0000-0000-0000-000000000003'),   -- lawyer, does not
  ('66666666-0000-0000-0000-000000000006'),   -- trainee
  ('77777777-0000-0000-0000-000000000007'),   -- another trainee
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003');
update public.profiles set roles='{intern}', status='verified'
  where id in ('66666666-0000-0000-0000-000000000006','77777777-0000-0000-0000-000000000007');
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.mentorship_messages;
delete from public.mentorship_sessions;
delete from public.mentorships;
delete from public.webinar_seats;
delete from public.webinars;
delete from public.draft_jobs;
delete from public.reviews; delete from public.quotes; delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
delete from public.subscriptions;
insert into public.subscriptions (lawyer_id, plan, price, active)
  values ('22222222-0000-0000-0000-000000000002', 'ai', 199, true);

\echo '── a draft is owed only where it is paid for ──'
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('19a1aaaa-0000-0000-0000-0000000019a1','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','consult','paid for it', 250);
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  work for a subscribing lawyer queues a draft'
  from public.draft_jobs where request_id = '19a1aaaa-0000-0000-0000-0000000019a1';

update public.requests set status = 'completed', rated = true
  where id = '19a1aaaa-0000-0000-0000-0000000019a1';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price)
  values ('19a2aaaa-0000-0000-0000-0000000019a2','11111111-0000-0000-0000-000000000001',
          '33333333-0000-0000-0000-000000000003','consult','did not', 250);
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and work for a lawyer who does not pay queues nothing'
  from public.draft_jobs where request_id = '19a2aaaa-0000-0000-0000-0000000019a2';

\echo '── the auction route queues one too ──'
update public.requests set lawyer_id = '22222222-0000-0000-0000-000000000002'
  where id = '19a2aaaa-0000-0000-0000-0000000019a2';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a lawyer arriving second is still owed one'
  from public.draft_jobs where request_id = '19a2aaaa-0000-0000-0000-0000000019a2';

\echo '── and the draft is the lawyer''s working copy ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  the lawyer reads their own drafts' from public.draft_jobs;

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  the client whose case it is cannot read the draft' from public.draft_jobs;

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor can another lawyer' from public.draft_jobs;

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and the desk can, for the day one is argued about' from public.draft_jobs;

\echo '── nobody hands themselves a draft ──'
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.draft_jobs (request_id, lawyer_id)
  values ('19a1aaaa-0000-0000-0000-0000000019a1','33333333-0000-0000-0000-000000000003');
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  a queue entry cannot be written by hand' from public.draft_jobs;

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
delete from public.draft_jobs;
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and the lawyer cannot delete what the assistant wrote'
  from public.draft_jobs;

\echo '── a workshop is hosted by a verified lawyer, and only by one ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.webinars (id, host_id, title, seats, price, starts_at)
  values ('19b1aaaa-0000-0000-0000-0000000019b1','22222222-0000-0000-0000-000000000002',
          'صياغة العقود', 2, 100, now() + interval '2 days');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a verified lawyer opens a room' from public.webinars;
select case when ref like 'WRK-%' then 'PASS' else 'FAIL' end
  || '  with a reference anybody can say out loud'
  from public.webinars where id = '19b1aaaa-0000-0000-0000-0000000019b1';

set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.webinars (host_id, title, seats, starts_at)
  values ('11111111-0000-0000-0000-000000000001','client teaching law', 5, now() + interval '1 day');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a client cannot host one' from public.webinars where title = 'client teaching law';

\echo '── the listing is public, the roster is not ──'
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  anybody can see the workshop is happening' from public.webinars;
insert into public.webinar_seats (webinar_id, holder_id)
  values ('19b1aaaa-0000-0000-0000-0000000019b1','66666666-0000-0000-0000-000000000006');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and take a seat in it' from public.webinar_seats;
select case when price = 100 then 'PASS' else 'FAIL' end
  || '  at the room''s price, pinned to the seat'
  from public.webinar_seats where holder_id = '66666666-0000-0000-0000-000000000006';

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  another attendee cannot read who else booked' from public.webinar_seats;
insert into public.webinar_seats (webinar_id, holder_id)
  values ('19b1aaaa-0000-0000-0000-0000000019b1','77777777-0000-0000-0000-000000000007');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  but can take the last seat themselves' from public.webinar_seats;

reset role;
select case when status = 'full' then 'PASS' else 'FAIL' end
  || '  and the room closes when it fills'
  from public.webinars where id = '19b1aaaa-0000-0000-0000-0000000019b1';

\echo '── and a full room is full ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.webinar_seats (webinar_id, holder_id)
  values ('19b1aaaa-0000-0000-0000-0000000019b1','11111111-0000-0000-0000-000000000001');
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  the ceiling holds against one more' from public.webinar_seats;

set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
delete from public.webinar_seats where holder_id = '77777777-0000-0000-0000-000000000007';
reset role;
select case when status = 'open' then 'PASS' else 'FAIL' end
  || '  giving a seat up puts the room back on sale'
  from public.webinars where id = '19b1aaaa-0000-0000-0000-0000000019b1';

-- Asked with the room open, so it is the one-seat-each rule being tested and
-- not the ceiling answering first.
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
insert into public.webinar_seats (webinar_id, holder_id)
  values ('19b1aaaa-0000-0000-0000-0000000019b1','66666666-0000-0000-0000-000000000006');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and nobody holds two seats' from public.webinar_seats;

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the host sees who is coming' from public.webinar_seats;

\echo '── supervision is asked for by one side and agreed by the other ──'
reset role;
set request.jwt.claim.sub = '';
update public.profiles set is_mentor = true, mentorship_fee = 300
  where id = '22222222-0000-0000-0000-000000000002';

set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
insert into public.mentorships (id, mentor_id, intern_id, opened_by)
  values ('19c1aaaa-0000-0000-0000-0000000019c1','22222222-0000-0000-0000-000000000002',
          '66666666-0000-0000-0000-000000000006','intern');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a trainee applies to a lawyer taking trainees' from public.mentorships;
select case when fee = 300 then 'PASS' else 'FAIL' end
  || '  at the fee the lawyer published, pinned on the row'
  from public.mentorships where id = '19c1aaaa-0000-0000-0000-0000000019c1';

set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
update public.mentorships set status = 'active'
  where id = '19c1aaaa-0000-0000-0000-0000000019c1';
reset role;
select case when status = 'pending' then 'PASS' else 'FAIL' end
  || '  and cannot then accept their own application'
  from public.mentorships where id = '19c1aaaa-0000-0000-0000-0000000019c1';

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.mentorships set status = 'active', fee = 0
  where id = '19c1aaaa-0000-0000-0000-0000000019c1';
reset role;
select case when status = 'active' and started_at is not null then 'PASS' else 'FAIL' end
  || '  the lawyer accepts, and the moment is stamped'
  from public.mentorships where id = '19c1aaaa-0000-0000-0000-0000000019c1';
select case when fee = 300 then 'PASS' else 'FAIL' end
  || '  and the fee is not rewritten on the way through'
  from public.mentorships where id = '19c1aaaa-0000-0000-0000-0000000019c1';

\echo '── and not to somebody who never offered ──'
set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
insert into public.mentorships (mentor_id, intern_id, opened_by)
  values ('33333333-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000007','intern');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer not taking trainees cannot be applied to'
  from public.mentorships where mentor_id = '33333333-0000-0000-0000-000000000003';

set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
insert into public.mentorships (mentor_id, intern_id, opened_by)
  values ('22222222-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000006','intern');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor does anybody apply on somebody else''s behalf' from public.mentorships;

\echo '── the room is the two of them ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.mentorship_messages (mentorship_id, author_id, body)
  values ('19c1aaaa-0000-0000-0000-0000000019c1','22222222-0000-0000-0000-000000000002',
          'اقرأ نظام المرافعات قبل الجلسة');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the trainee reads what their mentor wrote' from public.mentorship_messages;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and a trainee outside it reads nothing' from public.mentorship_messages;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor does a client' from public.mentorship_messages;

\echo '── the calendar, and the hours it is worth ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.mentorship_sessions
  (id, mentorship_id, mentor_id, title, starts_at, hours, attended)
  values ('19d1aaaa-0000-0000-0000-0000000019d1','19c1aaaa-0000-0000-0000-0000000019c1',
          '22222222-0000-0000-0000-000000000002','مراجعة قضية', now() + interval '3 days', 3, true);
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the trainee sees the session booked for them'
  from public.mentorship_sessions;
select case when public.mentored_hours('66666666-0000-0000-0000-000000000006') = 3
            then 'PASS' else 'FAIL' end
  || '  and an attended session counts towards the certificate';

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000007';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  somebody else''s supervision is not on their calendar'
  from public.mentorship_sessions;

set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
update public.mentorship_sessions set hours = 12
  where id = '19d1aaaa-0000-0000-0000-0000000019d1';
reset role;
select case when hours = 3 then 'PASS' else 'FAIL' end
  || '  and a trainee does not write their own hours'
  from public.mentorship_sessions where id = '19d1aaaa-0000-0000-0000-0000000019d1';

reset role;
set request.jwt.claim.sub = '';
