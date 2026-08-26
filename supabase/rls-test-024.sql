-- ===========================================================================
--  Security tests for migration 024 — files in the training room.
--
--  A file that can be written and never read is the same silent nothing the
--  screening pool was, so the first question here is again the one that got
--  missed: can the person it is for actually SEE it. Then the ordinary ones —
--  a room is two people and the desk, and nobody else is in it.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- a client, in no room
  ('22222222-0000-0000-0000-000000000002'),   -- the mentor
  ('44444444-0000-0000-0000-000000000004'),   -- another lawyer entirely
  ('66666666-0000-0000-0000-000000000006'),   -- the trainee
  ('88888888-0000-0000-0000-000000000008'),   -- another trainee
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004');
update public.profiles set roles='{intern}', status='verified'
  where id in ('66666666-0000-0000-0000-000000000006','88888888-0000-0000-0000-000000000008');
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.attachments;
delete from public.mentorship_messages;
delete from public.mentorships;
update public.profiles set is_mentor = true, mentorship_fee = 80
  where id = '22222222-0000-0000-0000-000000000002';
insert into public.mentorships (id, mentor_id, intern_id, opened_by, status, fee, started_at)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '22222222-0000-0000-0000-000000000002',
          '66666666-0000-0000-0000-000000000006', 'intern', 'active', 80, now());

\echo '── a file belongs to one thing ──'
insert into public.attachments (author_id, path, name)
  values ('22222222-0000-0000-0000-000000000002', 'orphan.pdf', 'orphan.pdf');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a file about nothing is refused'
  from public.attachments where path = 'orphan.pdf';

\echo '── the mentor hands something over ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.attachments (mentorship_id, author_id, path, name, mime)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '22222222-0000-0000-0000-000000000002',
          'room/note.pdf', 'مذكرة للمراجعة.pdf', 'application/pdf');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the mentor attaches a file to the room'
  from public.attachments where path = 'room/note.pdf';

insert into public.attachments (mentorship_id, author_id, path, name, mime, kind, seconds)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '22222222-0000-0000-0000-000000000002',
          'room/voice.webm', 'ملاحظة صوتية', 'audio/webm', 'voice', 95);
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and a voice note, with its length on it'
  from public.attachments where path = 'room/voice.webm' and seconds = 95;

\echo '── and the trainee can actually read it ──'
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  the trainee sees both'
  from public.attachments where mentorship_id = 'aaaa0000-0000-0000-0000-00000000aaaa';

insert into public.attachments (mentorship_id, author_id, path, name)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '66666666-0000-0000-0000-000000000006',
          'room/draft.docx', 'مسودتي.docx');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and hands work back the same way'
  from public.attachments where path = 'room/draft.docx';

\echo '── and nobody outside the room ──'
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  another trainee sees nothing of it'
  from public.attachments where mentorship_id = 'aaaa0000-0000-0000-0000-00000000aaaa';
insert into public.attachments (mentorship_id, author_id, path, name)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '88888888-0000-0000-0000-000000000008', 'room/sneak.pdf', 'sneak.pdf');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor writes into it'
  from public.attachments where path = 'room/sneak.pdf';

set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  another lawyer sees nothing of it either'
  from public.attachments where mentorship_id = 'aaaa0000-0000-0000-0000-00000000aaaa';

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and a client is not in a training room at all'
  from public.attachments where mentorship_id = 'aaaa0000-0000-0000-0000-00000000aaaa';

\echo '── nobody signs somebody else’s name to a file ──'
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
insert into public.attachments (mentorship_id, author_id, path, name)
  values ('aaaa0000-0000-0000-0000-00000000aaaa',
          '22222222-0000-0000-0000-000000000002', 'room/forged.pdf', 'forged.pdf');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a file is signed by whoever sent it'
  from public.attachments where path = 'room/forged.pdf';

\echo '── the desk reads it, because a dispute has to be decidable ──'
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 3 then 'PASS' else 'FAIL' end
  || '  staff read the room'
  from public.attachments where mentorship_id = 'aaaa0000-0000-0000-0000-00000000aaaa';

\echo '── and none of this loosened a case’s files ──'
reset role;
set request.jwt.claim.sub = '';
insert into public.requests (id, client_id, lawyer_id, type_id, title, price, status)
  values ('ffff0000-0000-0000-0000-00000000ffff',
          '11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002', 'consult', 'files test', 250, 'assigned')
  on conflict (id) do nothing;
insert into public.attachments (request_id, author_id, audience, path, name)
  values ('ffff0000-0000-0000-0000-00000000ffff',
          '22222222-0000-0000-0000-000000000002', 'internal', 'case/inner.pdf', 'inner.pdf');
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  the client still cannot read an internal file on their own case'
  from public.attachments where path = 'case/inner.pdf';
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the lawyer still can'
  from public.attachments where path = 'case/inner.pdf';
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000008';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and a trainee not on the case cannot'
  from public.attachments where path = 'case/inner.pdf';
