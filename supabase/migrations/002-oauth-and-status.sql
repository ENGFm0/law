-- ===========================================================================
--  002 — a profile for every new user, and a status nobody can grant themselves
--
--  Run this once on a project that already has schema.sql. Safe to re-run.
--
--  Why it exists: signing in with Google never touches the sign-up wizard, so
--  nothing on our side creates the profile row. The database has to do it, or
--  a Google user lands with an auth record and no profile — invisible to the
--  whole site.
--
--  And once profiles can be created without going through our code, the rule
--  that a lawyer cannot verify themselves has to hold at the database level in
--  every direction, not just the one the wizard happens to take.
-- ===========================================================================

-- ---------------------------------------------------- a profile on sign-up
-- SECURITY DEFINER because it runs as the new user, who has no rights yet.
-- search_path is pinned: a definer function that resolves names loosely is a
-- privilege-escalation waiting to happen.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, roles, active_role, status)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    '{client}', 'client',
    -- A client is taking no professional claim, so there is nothing to vet.
    'verified')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------- status is not self-served
-- Replaces the earlier keep_status(), which froze the column outright. That
-- was too blunt: signing up as a lawyer legitimately moves you from verified
-- to pending, and the old rule blocked it — so a Google user who then declared
-- themselves a lawyer would have stayed verified.
create or replace function public.guard_status()
returns trigger language plpgsql as $$
begin
  -- Taking on a professional role always drops you back to pending. Staff lift
  -- it again after checking the licence; nobody lifts it for themselves.
  if (new.roles && array['lawyer','intern'])
     and not (old.roles && array['lawyer','intern']) then
    new.status := 'pending';
    return new;
  end if;

  -- Verification can never be granted from this side. Anything else about the
  -- profile saves normally.
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists profiles_keep_status on public.profiles;
drop trigger if exists profiles_guard_status on public.profiles;
create trigger profiles_guard_status
  before update on public.profiles
  for each row when (auth.uid() = new.id)
  execute function public.guard_status();

drop function if exists public.keep_status();
