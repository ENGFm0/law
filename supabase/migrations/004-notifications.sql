-- ===========================================================================
--  004 — notifications (US-021) and finishing an account
--
--  A bid that closes unseen, or an acceptance window that runs out while the
--  client is looking elsewhere, spoils the best flow anyone could design. This
--  is the table that stops that happening.
--
--  Two rules shape it. A notice says that something moved and points at it; it
--  never carries the contents, so a glance over a shoulder reveals that a
--  request changed and not what is in it. And a notice belongs to exactly one
--  person, who is the only one who can read it — the row policy says so rather
--  than the query being careful.
-- ===========================================================================

-- --------------------------------------------------- finishing an account
-- Signing in with Google gives us a name and a picture and nothing else: no
-- role, no phone, no licence. The trigger has to create the profile anyway, so
-- it creates the smallest honest one — a client who has told us nothing — and
-- this column is how the site knows to ask. Without it the only signal was an
-- empty phone number, which is a guess, and a guess here means either
-- pestering someone who is already finished or never asking someone who is
-- not.
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Everyone who registered through the wizard has already answered all of it.
update public.profiles set onboarded = true where phone is not null and phone <> '';

create table if not exists public.notifications (
  id       uuid primary key default gen_random_uuid(),
  to_id    uuid not null references public.profiles on delete cascade,
  type     text not null,
  ref      text,                       -- a request, an article, an account
  read     boolean not null default false,
  at       timestamptz not null default now(),
  -- The same event twice is one notice: a page that redraws must not be able
  -- to fill somebody's list with copies of itself. Enforced here as well as in
  -- the browser, because the browser is not the only thing that can write.
  unique (to_id, type, ref)
);
create index if not exists notifications_to_unread on public.notifications (to_id, read, at desc);
alter table public.notifications enable row level security;

-- Supabase grants the API roles on new tables by default; saying it here means
-- the file also works on a plain Postgres, and that the local security tests
-- exercise the real policies rather than failing at the permission check
-- before they ever reach them. A guest has no notices, so anon gets nothing.
grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists "your notices are yours" on public.notifications;
create policy "your notices are yours" on public.notifications for select
  using (auth.uid() = to_id);

-- Anyone signed in may raise one, because the events that deserve a notice are
-- the ordinary acts of using the platform: delivering, refusing, routing work.
-- What they may not do is address it to themselves in someone else's name, or
-- read what they sent.
drop policy if exists "a signed-in user may raise a notice" on public.notifications;
create policy "a signed-in user may raise a notice" on public.notifications
  for insert with check (auth.uid() is not null);

-- Marking read is the only change anyone makes, and only to their own.
drop policy if exists "you may mark your own read" on public.notifications;
create policy "you may mark your own read" on public.notifications for update
  using (auth.uid() = to_id) with check (auth.uid() = to_id);

create or replace function public.notice_only_read_changes() returns trigger
language plpgsql as $$
begin
  if new.to_id is distinct from old.to_id
     or new.type is distinct from old.type
     or new.ref  is distinct from old.ref
     or new.at   is distinct from old.at then
    raise exception 'a notice is marked read, not rewritten';
  end if;
  return new;
end $$;
drop trigger if exists notifications_only_read on public.notifications;
create trigger notifications_only_read before update on public.notifications
  for each row execute function public.notice_only_read_changes();

-- Old notices are cleared out; there is nothing to keep once they are read and
-- the thing they pointed at has moved on.
drop policy if exists "you may clear your own" on public.notifications;
create policy "you may clear your own" on public.notifications for delete
  using (auth.uid() = to_id);
