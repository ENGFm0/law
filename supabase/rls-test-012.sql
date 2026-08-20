-- ===========================================================================
--  Security tests for migration 012 — the two threads on a case.
--
--  The internal thread is the one that matters here. A trainee asking their
--  supervisor whether the claim is even in the right forum is not a message
--  to the person paying for the answer, and the difference between those two
--  audiences is one column and one policy.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
delete from public.attachments; delete from public.messages;
delete from public.requests where title = 'thread test';
delete from public.profiles where id = '66666666-0000-0000-0000-000000000006';
delete from auth.users where id = '66666666-0000-0000-0000-000000000006';
insert into auth.users (id) values ('66666666-0000-0000-0000-000000000006');
update public.profiles set roles = '{intern}', active_role = 'intern', status = 'verified'
  where id = '66666666-0000-0000-0000-000000000006';         -- the trainee

insert into public.requests (id, client_id, lawyer_id, assigned_to, type_id, title, price)
  values ('dddddddd-0000-0000-0000-00000000dddd',
          '11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002',
          '66666666-0000-0000-0000-000000000006',
          'consult', 'thread test', 200);

\echo '── the thread the client is in ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.messages (request_id, author_id, audience, body)
  values ('dddddddd-0000-0000-0000-00000000dddd','11111111-0000-0000-0000-000000000001',
          'parties','هذه صورة العقد');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client can write on their own case' from public.messages;

set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer reads it' from public.messages;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  so does the trainee working on it' from public.messages;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer with no part in it reads nothing' from public.messages;

\echo '── the thread the client is not in ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.messages (request_id, author_id, audience, body)
  values ('dddddddd-0000-0000-0000-00000000dddd','22222222-0000-0000-0000-000000000002',
          'internal','راجع الاختصاص قبل الصياغة');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer briefs the trainee privately'
  from public.messages where audience = 'internal';

set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the trainee reads it' from public.messages where audience = 'internal';
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and the client cannot' from public.messages where audience = 'internal';

insert into public.messages (request_id, author_id, audience, body)
  values ('dddddddd-0000-0000-0000-00000000dddd','11111111-0000-0000-0000-000000000001',
          'internal','أريد أن أسمع ما تقولونه');
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  nor write into it' from public.messages where audience = 'internal';

\echo '── nobody writes in somebody else''s name ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.messages (request_id, author_id, audience, body)
  values ('dddddddd-0000-0000-0000-00000000dddd','11111111-0000-0000-0000-000000000001',
          'parties','قال العميل ما لم يقله');
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  a message is signed by whoever sent it' from public.messages;

\echo '── and a conversation is a record ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
update public.messages set body = 'لم أقل ذلك' where audience = 'parties';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  what was said stays said'
  from public.messages where body = 'هذه صورة العقد';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
delete from public.messages;
reset role;
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and cannot be taken back' from public.messages;

\echo '── the files follow the thread they were sent in ──'
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.attachments (request_id, author_id, audience, path, name, size, mime)
  values ('dddddddd-0000-0000-0000-00000000dddd','11111111-0000-0000-0000-000000000001',
          'parties','dddddddd-0000-0000-0000-00000000dddd/contract.pdf','contract.pdf', 1200, 'application/pdf');
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.attachments (request_id, author_id, audience, path, name, size, mime)
  values ('dddddddd-0000-0000-0000-00000000dddd','22222222-0000-0000-0000-000000000002',
          'internal','dddddddd-0000-0000-0000-00000000dddd/notes.pdf','notes.pdf', 900, 'application/pdf');
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  the lawyer sees both' from public.attachments;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the client sees only their own thread''s' from public.attachments;
set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a stranger sees none' from public.attachments;

\echo '── an objection reaches the desk by itself ──'
reset role;
delete from public.notifications where type = 'disputed';
delete from public.disputes where request_id = 'dddddddd-0000-0000-0000-00000000dddd';
-- A delivery can only be refused once there is one to refuse.
update public.requests set delivered_at = now(), status = 'delivered'
  where id = 'dddddddd-0000-0000-0000-00000000dddd';
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.disputes (request_id, by_id, reason)
  values ('dddddddd-0000-0000-0000-00000000dddd','11111111-0000-0000-0000-000000000001',
          'التسليم ناقص ولا يعالج ما طُلب');
reset role;
select case when count(*) >= 1 then 'PASS' else 'FAIL' end
  || '  staff are told the moment one is opened'
  from public.notifications n
  join public.profiles p on p.id = n.to_id
 where n.type = 'disputed' and 'staff' = any(p.roles);

reset role;
set request.jwt.claim.sub = '';
