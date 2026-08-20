-- ===========================================================================
--  011 — three columns the code has been writing to that did not exist, and
--        the ones that should never have been readable by everybody
--
--  Found by checking every mapper against the schema rather than by anybody
--  noticing on the site, which is the point: none of these three failed
--  loudly.
--
--    • `requests.rated` — rating a delivered piece of work sends
--      `{ rated: true, status: 'completed' }` in one update. The column was
--      not there, so PostgREST refused the whole statement: the rating went
--      in, the request never completed, and the money never settled.
--
--    • `profiles.title` — a lawyer's professional title is read on every card
--      and every profile. It was never stored, so it was blank for everyone
--      who was not part of the demo seed.
--
--    • `profiles.email` — the desk lists people by name and email, and there
--      was no email to list. It lives in `auth.users`, which the browser
--      cannot read at all.
--
--  And the other half of that last one: `phone` HAS always been in `profiles`,
--  and `profiles` is world-readable, so every visitor could read every user's
--  phone number, licence document and CV. That is not a policy anybody chose;
--  it is what `select *` on a public table does. Column privileges close it,
--  and the two places that legitimately need the details ask for them by name.
-- ===========================================================================

alter table public.requests add column if not exists rated boolean not null default false;
alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists email text;

-- Fill it in for everyone who already exists, and keep it filled in after.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, roles, active_role, status, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    '{client}', 'client',
    -- A client is taking no professional claim, so there is nothing to vet.
    'verified',
    new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- An address is not something the owner of a profile gets to rewrite: it is
-- what they signed in with, and the desk uses it to tell two people apart.
create or replace function public.keep_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profiles_keep_email on public.profiles;
create trigger profiles_keep_email before update on public.profiles
  for each row execute function public.keep_email();

-- ------------------------------------------------- what is nobody's business
-- The directory needs a name, a city, a licence number and a rating. It does
-- not need a phone number, and an anonymous visitor never did.
--
-- Revoking the column on its own does nothing while a table-wide SELECT grant
-- is in place — column privileges are only consulted when there is no grant on
-- the table — and Supabase grants every new table to anon and authenticated by
-- default. So the table grant goes, and the public columns are handed back by
-- name. Everything not in this list is now unreadable except through the three
-- functions below.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, full_name, avatar_url, roles, active_role, status, bio, title,
  licence_no, licence_authority, licence_expiry, specialties, years,
  university, level, skills, city, created_at, onboarded,
  featured_rank, featured_until, auto_bid, vat_registered
) on public.profiles to anon, authenticated;

-- Which means the site must ask for columns by name — `select=*` on a table
-- with a column you may not read is refused outright, and rightly so.

-- Your own profile, whole, including the parts nobody else may see.
create or replace function public.my_profile() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

-- The desk's own list. Staff-only, checked inside the function rather than
-- trusted from outside it.
create or replace function public.contact_book()
returns table (id uuid, email text, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.phone from public.profiles p where public.is_staff()
$$;
revoke all on function public.contact_book() from public;
grant execute on function public.contact_book() to authenticated;

-- One person's details, for somebody who has a reason to have them: staff, the
-- person themselves, or the other party to a request between them. This is
-- the promise the auction makes — "your details are released only to the
-- lawyer whose quote you accept" — written where it is enforced.
create or replace function public.contact_of(target uuid)
returns table (email text, phone text)
language sql stable security definer set search_path = public as $$
  select p.email, p.phone from public.profiles p
   where p.id = target
     and (
       auth.uid() = target
       or public.is_staff()
       or exists (
         select 1 from public.requests r
          where (r.client_id = auth.uid() and (r.lawyer_id = target or r.assigned_to = target))
             or (r.client_id = target and (r.lawyer_id = auth.uid() or r.assigned_to = auth.uid()))
             or (r.lawyer_id = auth.uid() and r.assigned_to = target)
             or (r.assigned_to = auth.uid() and r.lawyer_id = target))
     )
$$;
revoke all on function public.contact_of(uuid) from public;
grant execute on function public.contact_of(uuid) to authenticated;
