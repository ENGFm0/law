-- ===========================================================================
--  Security tests for migration 022 — how long, and when.
--
--  A published week is a promise, and the whole value of it is that the
--  person who made it is the person it belongs to. So the interesting
--  refusals here are about authorship: nobody writes hours into somebody
--  else's week, nobody publishes hours who is not offering to teach, and
--  nobody quietly erases a mentor's availability but the mentor.
-- ===========================================================================
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset border 0

reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),   -- client
  ('22222222-0000-0000-0000-000000000002'),   -- lawyer, takes trainees
  ('44444444-0000-0000-0000-000000000004'),   -- lawyer, takes none
  ('66666666-0000-0000-0000-000000000006'),   -- trainee
  ('55555555-0000-0000-0000-000000000005')    -- staff
  on conflict (id) do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id in ('22222222-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004');
update public.profiles set roles='{intern}', status='verified'
  where id='66666666-0000-0000-0000-000000000006';
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';

delete from public.mentor_slots;
update public.profiles set is_mentor = false, supervises_cases = false,
       mentor_hours = null, mentor_months = null
  where id in ('22222222-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004');

\echo '── how much of them you get is bounded ──'
update public.profiles set mentor_hours = 200
  where id = '22222222-0000-0000-0000-000000000002';
select case when mentor_hours is null then 'PASS' else 'FAIL' end
  || '  a week with more hours than a week has is refused'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';
update public.profiles set mentor_months = 0
  where id = '22222222-0000-0000-0000-000000000002';
select case when mentor_months is null then 'PASS' else 'FAIL' end
  || '  and an arrangement of no months at all'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';
update public.profiles set is_mentor = true, mentorship_fee = 80,
       mentor_hours = 6, mentor_months = 6
  where id = '22222222-0000-0000-0000-000000000002';
select case when mentor_hours = 6 and mentor_months = 6 then 'PASS' else 'FAIL' end
  || '  a real commitment is kept'
  from public.profiles where id = '22222222-0000-0000-0000-000000000002';

\echo '── only somebody taking trainees publishes hours ──'
set role authenticated;
set request.jwt.claim.sub = '44444444-0000-0000-0000-000000000004';
insert into public.mentor_slots (mentor_id, weekday, starts_at, ends_at)
  values ('44444444-0000-0000-0000-000000000004', 1, '17:00', '19:00');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a lawyer taking nobody cannot publish a week'
  from public.mentor_slots where mentor_id = '44444444-0000-0000-0000-000000000004';

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
insert into public.mentor_slots (mentor_id, weekday, starts_at, ends_at)
  values ('22222222-0000-0000-0000-000000000002', 1, '17:00', '19:00'),
         ('22222222-0000-0000-0000-000000000002', 3, '17:00', '20:00');
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  one who is, can'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';

\echo '── a window that ends before it starts is not a window ──'
insert into public.mentor_slots (mentor_id, weekday, starts_at, ends_at)
  values ('22222222-0000-0000-0000-000000000002', 5, '20:00', '18:00');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  backwards hours are refused'
  from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002' and weekday = 5;

insert into public.mentor_slots (mentor_id, weekday, starts_at, ends_at)
  values ('22222222-0000-0000-0000-000000000002', 1, '17:00', '21:00');
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  and the same window twice is one window, not two'
  from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002'
   and weekday = 1 and starts_at = '17:00';

\echo '── nobody writes into somebody else’s week ──'
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
insert into public.mentor_slots (mentor_id, weekday, starts_at, ends_at)
  values ('22222222-0000-0000-0000-000000000002', 6, '09:00', '11:00');
select case when count(*) = 0 then 'PASS' else 'FAIL' end
  || '  a trainee cannot add hours to their mentor'
  from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002' and weekday = 6;

update public.mentor_slots set ends_at = '23:00'
  where mentor_id = '22222222-0000-0000-0000-000000000002' and weekday = 1;
select case when ends_at <> '23:00' then 'PASS' else 'FAIL' end
  || '  nor stretch one'
  from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002' and weekday = 1;

delete from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  nor erase the week entirely'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
delete from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and neither can the desk — a week is nobody’s but its owner’s'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';

\echo '── but everybody may read it, because it is half the offer ──'
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000006';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  a trainee reads the week before paying for it'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  and mentor_week() says the same'
  from public.mentor_week('22222222-0000-0000-0000-000000000002');
select case when public.mentor_open_hours('22222222-0000-0000-0000-000000000002') = 5
            then 'PASS' else 'FAIL' end
  || '  and the open hours add up to what was published';

reset role;
set request.jwt.claim.sub = '';
select case when count(*) = 2 then 'PASS' else 'FAIL' end
  || '  a signed-out visitor reads it too — it is a public offer'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';

\echo '── and the mentor themselves owns it ──'
set role authenticated;
set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
delete from public.mentor_slots
 where mentor_id = '22222222-0000-0000-0000-000000000002' and weekday = 3;
select case when count(*) = 1 then 'PASS' else 'FAIL' end
  || '  they can take a window back'
  from public.mentor_slots where mentor_id = '22222222-0000-0000-0000-000000000002';
