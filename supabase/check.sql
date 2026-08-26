-- ===========================================================================
--  What has actually been run against this database?
--
--  Paste this whole file into the Supabase SQL editor and press Run. It
--  changes nothing, and it answers in ONE table — the editor only shows the
--  last result set a script produces, so everything here is a single query
--  on purpose. (diagnose.sql is the deeper one, for reading policies and
--  reproducing a 500; run its sections one at a time.)
--
--  Read the `ok` column. Every false names a migration in the last column.
--  Run those, in order, from supabase/migrations/. All of them are safe to
--  run twice, so one already applied costs nothing. Then run this again.
-- ===========================================================================

with
-- Reading a table that may not exist would fail at parse time, so the two
-- row checks go through a string the server only evaluates if the table is
-- actually there.
row_exists as (
  select
    case when to_regclass('public.service_types') is null then false else
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.service_types where id = ''free_screening''',
        false, true, '')))[1]::text::int > 0 end as screening_type,
    case when to_regclass('public.price_bands') is null then false else
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.price_bands where type_id = ''free_screening''
           and min_price = 0 and max_price = 0',
        false, true, '')))[1]::text::int > 0 end as screening_band
),
col as (
  select table_name, column_name from information_schema.columns
   where table_schema = 'public'
),
checks (sort, item, ok, run_this_if_false) as (values

  --------------------------------------------------------------- migrations
  (10, 'schema (the tables the site was built on)',
       to_regclass('public.profiles') is not null, 'supabase/schema.sql'),
  (11, 'migration 002 — sign-in and account status',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='status'),
       '002-oauth-and-status.sql'),
  (12, 'migration 003 — staff, objections and money',
       to_regprocedure('public.is_staff()') is not null, '003-staff-disputes-and-money.sql'),
  (13, 'migration 004 — notices',
       to_regclass('public.notifications') is not null, '004-notifications.sql'),
  (14, 'migration 005 — the staff role cannot be taken',
       to_regprocedure('public.guard_roles()') is not null, '005-staff-cannot-be-dropped.sql'),
  (15, 'migration 006 — the admin desk',
       to_regclass('public.announcements') is not null, '006-console.sql'),
  (16, 'migration 007 — work is not a channel',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='services' and column_name='channels'),
       '007-work-not-channels.sql'),
  (17, 'migration 008 — the auction and the catalogue',
       to_regclass('public.quotes') is not null, '008-the-auction-is-real.sql'),
  (18, 'migration 009 — a signed-out visitor writes nothing',
       to_regclass('public.requests') is not null
         and not has_table_privilege('anon', 'public.requests', 'insert'),
       '009-anon-writes-nothing.sql'),
  (19, 'migration 010 — indexes',
       exists (select 1 from pg_indexes where schemaname='public' and indexname='requests_client'),
       '010-indexes.sql'),
  (20, 'migration 011 — columns the site expected',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='email'),
       '011-columns-the-code-expected.sql'),
  (21, 'migration 012 — the two threads on a case',
       to_regclass('public.messages') is not null, '012-a-case-has-a-conversation.sql'),
  (22, 'migration 013 — a notice is raised, not rewritten',
       to_regprocedure('public.raise_notice(uuid,text,text)') is not null,
       '013-a-notice-is-raised-not-upserted.sql'),
  (23, 'migration 014 — the guarantee',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='platform_settings'
                  and column_name='guarantee_hours'),
       '014-the-guarantee.sql'),
  (24, 'migration 015 — a reference number and a record',
       to_regclass('public.request_events') is not null, '015-a-reference-and-a-record.sql'),
  (25, 'migration 016 — when the lawyer took it on',
       coalesce((select prosrc like '%''taken''%' from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname='public' and p.proname='log_request_event'), false),
       '016-when-the-lawyer-took-it-on.sql'),
  (26, 'migration 017 — one request at a time',
       to_regprocedure('public.guard_one_open_request()') is not null,
       '017-one-request-at-a-time.sql'),
  (27, 'migration 018 — a call leaves a copy',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='attachments' and column_name='kind'),
       '018-a-call-leaves-a-copy.sql'),
  (28, 'migration 019 — drafting, workshops and supervision',
       to_regclass('public.mentorships') is not null,
       '019-drafting-webinars-and-mentorship.sql'),
  (29, 'migration 020 — the free screening and discount codes',
       to_regclass('public.promo_codes') is not null,
       '020-free-screening-and-promo-codes.sql'),
  (30, 'migration 021 — supervision by the case, firms, featured',
       to_regclass('public.firms') is not null,
       '021-supervision-firms-and-featured.sql'),
  (31, 'migration 022 — how long a mentor commits, and when they are free',
       to_regclass('public.mentor_slots') is not null,
       '022-when-a-mentor-is-free.sql'),
  (32, 'migration 023 — the screening pool is reachable at all',
       to_regprocedure('public.in_the_profession()') is not null,
       '023-a-screening-nobody-can-see.sql'),
  (33, 'migration 024 — the training room carries files and voice',
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='attachments'
                  and column_name='mentorship_id'),
       '024-the-training-room-carries-files.sql')
)

--------------------------------------------------------------------- output
select item, ok, run_this_if_false from checks

-- The columns behind each panel. A table can be there while the column a
-- screen reads is not, and the site treats that as state rather than fault:
-- the panel draws, the field stays blank, saving reaches nothing, and no
-- error appears anywhere. That silence is why these are listed one by one.
union all select
  'account.html — ' || c.label,
  exists (select 1 from col where table_name='profiles' and column_name=c.name),
  c.from_file
from (values
  ('the monthly supervision toggle (profiles.is_mentor)',
   'is_mentor',        '019-drafting-webinars-and-mentorship.sql'),
  ('its price (profiles.mentorship_fee)',
   'mentorship_fee',   '019-drafting-webinars-and-mentorship.sql'),
  ('the single-case toggle (profiles.supervises_cases)',
   'supervises_cases', '021-supervision-firms-and-featured.sql'),
  ('its price (profiles.supervision_fee)',
   'supervision_fee',  '021-supervision-firms-and-featured.sql'),
  ('the terms a mentor publishes (profiles.mentor_note)',
   'mentor_note',      '021-supervision-firms-and-featured.sql'),
  ('hours a week (profiles.mentor_hours)',
   'mentor_hours',     '022-when-a-mentor-is-free.sql'),
  ('how many months (profiles.mentor_months)',
   'mentor_months',    '022-when-a-mentor-is-free.sql')
) as c(label, name, from_file)

union all select
  t.screen || ' — ' || t.name, to_regclass('public.' || t.name) is not null, t.from_file
from (values
  ('assistant.html', 'draft_jobs',          '019-drafting-webinars-and-mentorship.sql'),
  ('webinars.html',  'webinars',            '019-drafting-webinars-and-mentorship.sql'),
  ('webinars.html',  'webinar_seats',       '019-drafting-webinars-and-mentorship.sql'),
  ('intern.html',    'mentorships',         '019-drafting-webinars-and-mentorship.sql'),
  ('intern.html',    'mentorship_sessions', '019-drafting-webinars-and-mentorship.sql'),
  ('intern.html',    'mentorship_messages', '019-drafting-webinars-and-mentorship.sql'),
  ('requests.html',  'promo_codes',         '020-free-screening-and-promo-codes.sql'),
  ('requests.html',  'promo_redemptions',   '020-free-screening-and-promo-codes.sql'),
  ('intern.html',    'supervision_orders',  '021-supervision-firms-and-featured.sql'),
  ('intern.html',    'mentorship_invites',  '021-supervision-firms-and-featured.sql'),
  ('firm.html',      'firms',               '021-supervision-firms-and-featured.sql'),
  ('firm.html',      'firm_members',        '021-supervision-firms-and-featured.sql'),
  ('mentorship.html','mentor_slots',        '022-when-a-mentor-is-free.sql')
) as t(screen, name, from_file)

-- Two of these are rows, not tables. A row can be missing while every table
-- around it is present, and then the category simply does not exist.
-- Without these policies the pool is invisible: the site draws it, the guard
-- is written and tested, and no trainee or lawyer can select the row at all.
-- An empty list reads as "no work today", which is how it shipped broken.
union all select 'a waiting screening can be seen by the profession',
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'requests'
           and policyname = 'an unclaimed screening is the profession''s to see'),
  '023-a-screening-nobody-can-see.sql'
union all select 'and claimed by a supervised trainee',
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'requests'
           and policyname = 'a supervised trainee claims a screening'),
  '023-a-screening-nobody-can-see.sql'
union all select 'or routed to one by their supervisor',
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'requests'
           and policyname = 'a supervisor routes a screening to their trainee'),
  '023-a-screening-nobody-can-see.sql'

union all select 'the free screening exists as a category', screening_type,
                 '020-free-screening-and-promo-codes.sql' from row_exists
union all select 'and its price band is nothing to nothing', screening_band,
                 '020-free-screening-and-promo-codes.sql' from row_exists

union all select 'a paid place at the top and a firm listing can be sold',
  coalesce((select pg_get_constraintdef(oid) like '%featured%'
              from pg_constraint where conname='subscriptions_plan_check'), false),
  '021-supervision-firms-and-featured.sql';

-- If a row says true and the browser still reports PGRST205, the table is
-- there and PostgREST has not noticed yet. This tells it to look again:
notify pgrst, 'reload schema';
