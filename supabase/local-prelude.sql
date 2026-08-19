-- Stand-ins for what Supabase provides, so schema.sql and rls-test.sql can be
-- run against a plain PostgreSQL during development. Never run this on Supabase.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
