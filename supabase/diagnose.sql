-- ===========================================================================
--  Why did that request fail?
--
--  Paste the whole file into the Supabase SQL editor and run it. It changes
--  nothing: the one part that writes is wrapped in a transaction that rolls
--  itself back. Three answers come out of it, in three result sets:
--
--    1. which migrations this project has actually had run against it
--    2. every policy on the tables the site reads on every page
--    3. what the server really says when the site reads `profiles` as an
--       ordinary signed-in account — the message the browser only shows as
--       "500", which is the whole reason this file exists
-- ===========================================================================

-- ---------------------------------------------------------------- 1 of 3
select 'schema'       as migration, (to_regclass('public.profiles')        is not null) as applied
union all select '002 oauth + status',  (select count(*) > 0 from information_schema.columns
                                          where table_name = 'profiles' and column_name = 'status')
union all select '003 staff + money',   (to_regprocedure('public.is_staff()') is not null)
union all select '004 notifications',   (to_regclass('public.notifications') is not null)
union all select '005 roles guard',     (to_regprocedure('public.guard_roles()') is not null)
union all select '006 console',         (to_regclass('public.announcements')  is not null)
union all select '007 work + channels', (select count(*) > 0 from information_schema.columns
                                          where table_name = 'services' and column_name = 'channels')
union all select '008 auction + catalogue', (to_regclass('public.quotes') is not null)
union all select '009 anon writes nothing',   (not has_table_privilege('anon', 'public.requests', 'insert'))
union all select '010 indexes',               (select count(*) > 0 from pg_indexes
                                                where schemaname = 'public' and indexname = 'requests_client')
union all select '011 columns + privacy',     (select count(*) > 0 from information_schema.columns
                                                where table_name = 'profiles' and column_name = 'email')
union all select '012 conversations',         (to_regclass('public.messages') is not null)
union all select '013 raise_notice',          (to_regprocedure('public.raise_notice(uuid,text,text)') is not null)
union all select '014 the guarantee',         (select count(*) > 0 from information_schema.columns
                                                where table_name = 'platform_settings' and column_name = 'guarantee_hours')
union all select '015 reference + record',    (to_regclass('public.request_events') is not null)
-- 016 adds no column: it rewrites the event logger to record the moment the
-- lawyer picked the work up, so the function's own body is the evidence.
union all select '016 when the lawyer took it on',
                                              (select prosrc like '%''taken''%' from pg_proc p
                                                join pg_namespace n on n.oid = p.pronamespace
                                                where n.nspname = 'public'
                                                  and p.proname = 'log_request_event')
union all select '017 one at a time',         (to_regprocedure('public.guard_one_open_request()') is not null)
union all select '018 a call leaves a copy',  (select count(*) > 0 from information_schema.columns
                                                where table_name = 'attachments' and column_name = 'kind')
union all select '019 drafting + workshops + supervision',
                                              (to_regclass('public.mentorships') is not null)
union all select '020 free screening + promo codes',
                                              (to_regclass('public.promo_codes') is not null)
union all select '021 supervision by the case + firms',
                                              (to_regclass('public.firms') is not null)
union all select '003 is_staff is definer', (select p.prosecdef from pg_proc p
                                              join pg_namespace n on n.oid = p.pronamespace
                                              where n.nspname = 'public' and p.proname = 'is_staff');

-- ------------------------------------------------- 1b: the columns a screen
-- A table can exist while the column a panel reads does not, and the site is
-- built to treat that as state rather than fault — so the panel draws, the
-- field is blank, saving reaches nothing, and no error appears anywhere. If
-- something "does not show up", this is the list that says why.
select 'profiles.' || c.name as column_the_site_reads,
       (select count(*) > 0 from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = c.name) as present,
       c.needed_for
  from (values
    ('is_mentor',        '019 — the monthly supervision offer, account.html'),
    ('mentorship_fee',   '019 — its price'),
    ('supervises_cases', '021 — the single-case offer, account.html'),
    ('supervision_fee',  '021 — its price'),
    ('mentor_note',      '021 — the terms a mentor publishes'),
    ('featured_until',   '006 — when a placement runs out')
  ) as c(name, needed_for);

select t.name as table_the_site_reads,
       (to_regclass('public.' || t.name) is not null) as present,
       t.needed_for
  from (values
    ('draft_jobs',           '019 — the drafting queue behind assistant.html'),
    ('webinars',             '019 — workshops'),
    ('webinar_seats',        '019 — and their seats'),
    ('mentorships',          '019 — a standing supervision'),
    ('mentorship_sessions',  '019 — its calendar'),
    ('mentorship_messages',  '019 — its room'),
    ('promo_codes',          '020 — discount codes'),
    ('promo_redemptions',    '020 — who spent which'),
    ('supervision_orders',   '021 — a signature bought for one case'),
    ('mentorship_invites',   '021 — the open call for a supervisor'),
    ('firms',                '021 — law firms, firm.html'),
    ('firm_members',         '021 — their rosters')
  ) as t(name, needed_for);

-- The free screening is a row, not code: without it the category does not
-- exist and the band that keeps it free does not either.
select 'free_screening in service_types' as thing,
       (select count(*) > 0 from public.service_types where id = 'free_screening') as present
union all
select 'its price band is 0 to 0',
       (select count(*) > 0 from public.price_bands
         where type_id = 'free_screening' and min_price = 0 and max_price = 0);

-- And the plan list has to have room for what is sold now: a paid place at
-- the top and a firm's listing are subscriptions, and 021 widened the check
-- to let them exist at all.
select 'subscriptions.plan allows featured + firm' as thing,
       coalesce((select pg_get_constraintdef(oid) like '%featured%'
                   from pg_constraint where conname = 'subscriptions_plan_check'),
                false) as present;

-- ---------------------------------------------------------------------------
-- If anything above says false, run the migrations it names, in order, from
-- supabase/migrations/. Every one of them is written to be safe to run twice,
-- so running one already applied changes nothing. Then come back and run this
-- file again: every row should say true.
-- ---------------------------------------------------------------------------

-- If a row above says false, that migration has not been run here. And if one
-- says true while the browser still reports PGRST205, the table is there and
-- PostgREST has not noticed yet — this tells it to look again:
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------- 2 of 3
-- A policy that reads the table it is written on is how a plain read turns
-- into "infinite recursion detected in policy" — which reaches the browser
-- as a 500 with nothing in it to go on.
select tablename, policyname, cmd,
       coalesce(qual, '') as using_expression,
       coalesce(with_check, '') as with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('profiles', 'requests', 'services', 'price_bands', 'service_types')
 order by tablename, cmd, policyname;

-- ---------------------------------------------------------------- 3 of 3
-- The same read the site makes, from the same role, carrying a real account.
-- Whatever the browser saw as a 500, this prints as a sentence.
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', (select id from auth.users limit 1),
                      'role', 'authenticated')::text,
    true) as pretending_to_be;
  set local role authenticated;
  select count(*) as profiles_readable from public.profiles;
  select count(*) as requests_readable from public.requests;
  select count(*) as catalogue_readable from public.service_types;
rollback;
