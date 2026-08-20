-- ===========================================================================
--  009 — a visitor who is not signed in writes nothing, and is told so
--
--  Every write rule on this project is a row policy of the shape
--  `auth.uid() = owner`. Against a request carrying no session that
--  expression is null, so the row is refused — correctly — with:
--
--      new row violates row-level security policy for table "quotes"
--
--  Which is true, and tells the person reading it nothing about what actually
--  happened: their session had ended and the page still looked signed in.
--
--  Supabase grants every new table in `public` to `anon` as well as to
--  `authenticated`, so an anonymous write gets far enough to be judged by a
--  policy. Taking the privilege away instead means the same attempt fails as
--  "permission denied for table quotes" — a sentence that points at the
--  session rather than at the row. The browser now notices the dead session
--  before it gets this far; this is the floor under that.
--
--  Reads are left exactly as they are: what is public is public because a
--  policy says so, and that is the right place for it to be decided.
-- ===========================================================================

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete on public.%I from anon', t.tablename);
  end loop;
end $$;

-- Said again for anything created after this file runs, so a later migration
-- does not quietly hand the privilege back.
alter default privileges in schema public revoke insert, update, delete on tables from anon;
