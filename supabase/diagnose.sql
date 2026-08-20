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
union all select '008 is_staff is definer', (select p.prosecdef from pg_proc p
                                              join pg_namespace n on n.oid = p.pronamespace
                                              where n.nspname = 'public' and p.proname = 'is_staff');

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
