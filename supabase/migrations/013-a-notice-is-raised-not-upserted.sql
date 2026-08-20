-- ===========================================================================
--  013 — raising a notice for somebody else
--
--  A notice belongs to the person it is for: they alone may read it and mark
--  it read. Anyone signed in may raise one, because the events worth a notice
--  are the ordinary acts of using the platform.
--
--  Which makes "the same event again" awkward from a browser. The unique key
--  on (person, kind, subject) is right — one line per case, not one per
--  message — but the second message has to reopen a row the sender cannot
--  read and must not be able to write. An upsert asks Postgres to do exactly
--  that, and Postgres refuses:
--
--      new row violates row-level security policy for table "notifications"
--
--  It was right to refuse. Reopening somebody else's notice is a privileged
--  act, so it happens here, in one function, with the one rule that applies
--  to it: you have to be signed in. Nothing else about the row is the
--  caller's to choose.
-- ===========================================================================

-- The parameters are prefixed because two of them would otherwise share a
-- name with the columns they are written into, and `insert … values (to_id …)
-- on conflict (to_id …)` is ambiguous to Postgres — it refuses the whole
-- function at run time with "column reference to_id is ambiguous". Which is
-- exactly what a browser then reports as a notice that silently never
-- arrived.
-- The guard on `notifications` pins everything except `read`: a notice is
-- marked read, not rewritten. That is the right rule for the person it
-- belongs to and the wrong one for the platform reopening it — moving `at`
-- forward is exactly what "this happened again" means. So the guard learns
-- about one caller: this function, which announces itself for the length of
-- its own transaction and cannot be impersonated from a browser, because a
-- browser cannot set a server-side setting.
create or replace function public.notice_only_read_changes() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('sanad.raising_notice', true), '') = 'on' then
    return new;
  end if;
  if new.to_id is distinct from old.to_id
     or new.type is distinct from old.type
     or new.ref  is distinct from old.ref
     or new.at   is distinct from old.at then
    raise exception 'a notice is marked read, not rewritten';
  end if;
  return new;
end $$;

create or replace function public.raise_notice(p_to uuid, p_kind text, p_ref text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'only a signed-in account may raise a notice';
  end if;
  if p_to is null or p_kind is null then return; end if;

  perform set_config('sanad.raising_notice', 'on', true);   -- this transaction only
  insert into public.notifications (to_id, type, ref, read, at)
  values (p_to, p_kind, p_ref, false, now())
  on conflict (to_id, type, ref) do update
    set read = false, at = now();
  perform set_config('sanad.raising_notice', 'off', true);
end $$;
revoke all on function public.raise_notice(uuid, text, text) from public;
grant execute on function public.raise_notice(uuid, text, text) to authenticated;

-- The direct insert stays for the simple case, but nothing in the site uses
-- it now: one door, one rule, and the unique key does what it was written to
-- do instead of turning the second message on a case into an error.
