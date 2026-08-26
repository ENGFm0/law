-- ===========================================================================
--  023 — a pool nobody could see, and nobody could claim
--
--  The free screening was built end to end and could not work at all on a
--  real database. Two policies, written long before screenings existed, are
--  why:
--
--    select  using (is_party(requests))        -- client, lawyer, assigned_to
--    update  using (auth.uid() in (lawyer_id, assigned_to))
--
--  A screening waiting to be picked up has no lawyer and no trainee on it
--  yet. So nobody was a party to it, which means no trainee could SEE the
--  pool — it was empty for everyone but the client who opened it — and
--  nobody could claim one either, because claiming is an update to a row you
--  are not yet on.
--
--  The site drew the pool, the guard was written and tested, and the row was
--  unreachable the whole time. It failed silently, the way a missing table
--  does: an empty list reads as "no work today".
--
--  This opens exactly the gap that was missing and no more: an unclaimed
--  screening is visible to the profession, a trainee with somebody
--  answerable may take one, and a supervising lawyer may hand one to their
--  own trainee. Everything else about a screening stays where it was.
-- ===========================================================================

-- Who may look at work waiting for the profession. Definer rights for the
-- same reason is_staff() has them: it reads profiles from inside a policy on
-- another table, and a plain stable function would be evaluated under the
-- caller's policies and recurse the day profiles narrows.
create or replace function public.in_the_profession() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'verified'
      and (p.roles && array['lawyer', 'intern'])
  )
$$;
revoke all on function public.in_the_profession() from public;
grant execute on function public.in_the_profession() to authenticated;

-- Is anybody answerable for this trainee right now? signer_for() already says
-- who; this is the question a policy actually asks.
create or replace function public.can_sign_for(intern uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.signer_for(intern) is not null
$$;
revoke all on function public.can_sign_for(uuid) from public;
grant execute on function public.can_sign_for(uuid) to authenticated;

-- =============================================== 1. seeing the pool

-- A screening nobody has taken is not private: it is work the platform is
-- offering to whoever is qualified to do it. Clients see only their own, as
-- before — this adds nothing for them, and nothing at all for a signed-out
-- visitor.
drop policy if exists "an unclaimed screening is the profession's to see"
  on public.requests;
create policy "an unclaimed screening is the profession's to see"
  on public.requests for select
  using (
    type_id = 'free_screening'
    and assigned_to is null
    and lawyer_id is null
    and status in ('new', 'quoting', 'in_progress')
    and public.in_the_profession()
  );

-- =============================================== 2. claiming one

-- A trainee takes it themselves. The rule that matters is unchanged and is
-- still enforced by guard_screening(): somebody has to be answerable for the
-- answer. This only makes the row reachable so the guard gets to run.
drop policy if exists "a supervised trainee claims a screening" on public.requests;
create policy "a supervised trainee claims a screening"
  on public.requests for update
  using (
    type_id = 'free_screening'
    and assigned_to is null
    and lawyer_id is null
    and public.can_sign_for(auth.uid())
  )
  with check (
    type_id = 'free_screening'
    and assigned_to = auth.uid()
  );

-- Or their supervisor hands it to them. This was missing entirely: a lawyer
-- with trainees had no way to see incoming screenings, let alone route one,
-- and routing work to a trainee is the ordinary shape of everything else on
-- this platform.
--
-- The check is the whole safeguard: a lawyer may only assign a screening to
-- somebody they are the signer for. They cannot park it on a stranger's
-- trainee, and they cannot take it themselves — assigned_to is a trainee.
drop policy if exists "a supervisor routes a screening to their trainee"
  on public.requests;
create policy "a supervisor routes a screening to their trainee"
  on public.requests for update
  using (
    type_id = 'free_screening'
    and assigned_to is null
    and lawyer_id is null
  )
  with check (
    type_id = 'free_screening'
    and assigned_to is not null
    and public.signer_for(assigned_to) = auth.uid()
  );
