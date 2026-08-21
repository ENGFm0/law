-- ===========================================================================
--  Security tests for migration 018 — the platform's copy of a call.
--
--  A recording that the parties chose not to keep still exists: the platform
--  holds one, for the day the two of them describe the call differently. That
--  copy is worth nothing if either of them can read it, delete it or write a
--  different one — and worth nothing if the desk cannot open it. So all four
--  of those are checked here, from the database side, where the rule lives.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),('22222222-0000-0000-0000-000000000002'),
  ('66666666-0000-0000-0000-000000000006'),('55555555-0000-0000-0000-000000000005'),
  ('99999999-0000-0000-0000-000000000009') on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id in ('11111111-0000-0000-0000-000000000001','99999999-0000-0000-0000-000000000009');
update public.profiles set roles='{lawyer}', status='verified'
  where id='22222222-0000-0000-0000-000000000002';
update public.profiles set roles='{intern}', status='verified'
  where id='66666666-0000-0000-0000-000000000006';
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.attachments;
delete from public.messages;
delete from public.reviews; delete from public.quotes; delete from public.disputes;
delete from public.requests where client_id = '11111111-0000-0000-0000-000000000001';
insert into public.requests (id, client_id, lawyer_id, assigned_to, type_id, title, price, status)
  values ('1818aaaa-0000-0000-0000-0000000018aa','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000006',
          'consult','a call was held', 250, 'with_intern');

\echo '── the recorder may hand the platform its copy ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.attachments (request_id, author_id, audience, path, name, size, mime, kind, seconds)
  values ('1818aaaa-0000-0000-0000-0000000018aa','22222222-0000-0000-0000-000000000002',
          'staff','calls/018-staff.webm','مكالمة صوتية ٩٠ ثانية.webm', 4096,
          'audio/webm','call', 90);
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  a party to the call may write the platform''s copy'
  from public.attachments where audience = 'staff';

select case when kind = 'call' and seconds = 90 then 'PASS' else 'FAIL' end
  || '  with what it is and how long it ran on it'
  from public.attachments where audience = 'staff';

\echo '── and then cannot read it back ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  not even the lawyer who recorded it can read it'
  from public.attachments where audience = 'staff';

set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor the client who was on the call'
  from public.attachments where audience = 'staff';

set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  nor the trainee the case was routed to'
  from public.attachments where audience = 'staff';

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the desk can open it'
  from public.attachments where audience = 'staff';

\echo '── nor change it, nor make it go away ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
update public.attachments set name = 'nothing to see' where audience = 'staff';
delete from public.attachments where audience = 'staff';
reset role;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the copy survives the person it is evidence about'
  from public.attachments where audience = 'staff' and name like 'مكالمة%';

\echo '── and a stranger cannot plant one ──'
set role authenticated;
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000009';
insert into public.attachments (request_id, author_id, audience, path, name, mime)
  values ('1818aaaa-0000-0000-0000-0000000018aa','99999999-0000-0000-0000-000000000009',
          'staff','calls/018-forged.webm','forged','audio/webm');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  someone who was not on the call cannot write into the desk''s view'
  from public.attachments where name = 'forged';

\echo '── the parties'' copy is the ordinary one ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.attachments (request_id, author_id, audience, path, name, size, mime, kind, seconds)
  values ('1818aaaa-0000-0000-0000-0000000018aa','22222222-0000-0000-0000-000000000002',
          'parties','calls/018-parties.webm','مكالمة صوتية ٩٠ ثانية.webm', 4096,
          'audio/webm','call', 90);
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  the lawyer sees the kept recording' from public.attachments where audience = 'parties';
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and so does the client' from public.attachments where audience = 'parties';
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and the desk sees both copies' from public.attachments;

\echo '── the same third audience on the thread itself ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.messages (request_id, author_id, audience, body)
  values ('1818aaaa-0000-0000-0000-0000000018aa','22222222-0000-0000-0000-000000000002',
          'staff','for the desk');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a note to the desk is not readable by the person who wrote it'
  from public.messages where audience = 'staff';
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  and not by the client' from public.messages where audience = 'staff';
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the desk has it' from public.messages where audience = 'staff';

\echo '── and there is no fourth ──'
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.attachments (request_id, author_id, audience, path, name, mime)
  values ('1818aaaa-0000-0000-0000-0000000018aa','22222222-0000-0000-0000-000000000002',
          'everyone','calls/018-everyone.webm','everyone','audio/webm');
reset role;
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  an audience nobody defined is refused outright'
  from public.attachments where name = 'everyone';

reset role;
set request.jwt.claim.sub = '';
