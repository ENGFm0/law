-- ===========================================================================
--  005 — the staff role cannot be dropped either
--
--  guard_roles() refused to let a request that carries a signed-in user ADD
--  the staff role. It said nothing about removing it, and the gap was not
--  theoretical: the onboarding step writes the whole roles array, so a staff
--  member answering "who are you" would have written themselves out of the
--  desk — and the only way back is the SQL editor, which is exactly the thing
--  the desk exists to save you from needing.
--
--  Losing it should be as deliberate as gaining it.
-- ===========================================================================

create or replace function public.guard_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null on the trusted path — migrations, the SQL editor, the
  -- service key. A request carrying a user is held to both rules.
  if auth.uid() is null then return new; end if;

  if ('staff' = any(new.roles)) and not ('staff' = any(old.roles)) then
    if not public.is_staff() or auth.uid() = new.id then
      raise exception 'the staff role is granted, not taken';
    end if;
  end if;

  if ('staff' = any(old.roles)) and not ('staff' = any(new.roles)) then
    raise exception 'the staff role is not given up by filling in a form';
  end if;

  return new;
end $$;
