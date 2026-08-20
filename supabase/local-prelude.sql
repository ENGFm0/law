-- Stand-ins for what Supabase provides, so schema.sql and rls-test.sql can be
-- run against a plain PostgreSQL during development. Never run this on Supabase.
create schema if not exists auth;
-- The columns the triggers actually read. Supabase's real table has many more,
-- but a stub that omits these lets a trigger appear to work when it never ran.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;

-- Supabase ships these two roles; a plain PostgreSQL does not, and a migration
-- that grants to them fails at the first GRANT rather than at the policy it was
-- really about. They existed here by accident before — created by hand in an
-- earlier session — which is a poor foundation for a test that is supposed to
-- prove a migration applies cleanly.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public to anon, authenticated;
