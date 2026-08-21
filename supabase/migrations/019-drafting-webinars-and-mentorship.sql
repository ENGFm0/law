-- ===========================================================================
--  019 — the drafting subscription, workshops, and paid supervision
--
--  Three things the platform does that the database had no way of holding.
--
--  1. DRAFTING. A lawyer pays for the assistant; work that lands on them
--     should arrive with a first draft already written. The subscription
--     itself is not new — `subscriptions (lawyer_id, plan='ai', active,
--     ends_at)` has held exactly that fact since 006, and adding
--     `ai_subscribed` / `ai_expiry` beside it would give one fact two places
--     to disagree. What was missing is the QUEUE: a row that says a draft is
--     owed on this request, so that whatever writes it — an Edge Function
--     today, something else tomorrow — has somewhere to be asked from and
--     somewhere to put the answer. Postgres cannot write a legal draft; it
--     can make sure nobody forgets that one is due.
--
--  2. WORKSHOPS. A lawyer running a session for trainees is selling seats,
--     not hours, so it is not a request and cannot be squeezed into one. A
--     seat is sold once, the room has a ceiling, and the money splits the
--     same way every other riyal on this platform splits.
--
--  3. SUPERVISION. `agreements` already says what a lawyer pays a trainee for
--     work routed to them. This is the other direction: a trainee paying a
--     lawyer to be taught. Same two people, opposite flow, and conflating the
--     two would have made the ledger unreadable.
--
--  The rule that shapes all three, as everywhere else here: a party may not
--  hand themselves a place, money or a grade. Every check below is a row
--  policy or a trigger, never a hidden button.
-- ===========================================================================

-- ------------------------------------------------------- is the tool paid for
-- One question, asked in one place, so the answer cannot drift between the
-- page that draws the button and the trigger that acts on it.
create or replace function public.has_ai(who uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
     where s.lawyer_id = who
       and s.plan = 'ai'
       and s.active
       and (s.ends_at is null or s.ends_at > now())
  )
$$;
revoke all on function public.has_ai(uuid) from public;
grant execute on function public.has_ai(uuid) to authenticated;

create index if not exists subscriptions_lawyer_plan
  on public.subscriptions (lawyer_id, plan) where active;

-- =========================================================== 1. the drafting

-- Where a draft came from, kept on the request itself because the client is
-- entitled to know a machine wrote the first version of what they paid for,
-- and because "the assistant drafted this" is a fact about the deliverable
-- rather than about the queue that produced it.
alter table public.requests add column if not exists draft_source text
  check (draft_source is null or draft_source in ('ai', 'lawyer'));
alter table public.requests add column if not exists drafted_at timestamptz;

create table if not exists public.draft_jobs (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests on delete cascade,
  lawyer_id   uuid not null references public.profiles on delete cascade,
  status      text not null default 'queued'
              check (status in ('queued', 'running', 'ready', 'failed', 'used')),
  body        text,
  model       text,
  context_ref text,                  -- which template and which statutes were used
  error       text,
  attempts    int not null default 0,
  queued_at   timestamptz not null default now(),
  ready_at    timestamptz,
  -- One draft owed per request. A second would be a second answer to the same
  -- question, and the lawyer would have no way to tell which one they edited.
  unique (request_id)
);
alter table public.draft_jobs enable row level security;
grant select, insert, update, delete on public.draft_jobs to authenticated;
create index if not exists draft_jobs_pending
  on public.draft_jobs (status, queued_at) where status in ('queued', 'running');

-- A draft is the lawyer's working copy. The client sees what was delivered,
-- not what was proposed and thrown away — and the desk sees everything,
-- because an objection about a draft nobody kept is undecidable.
drop policy if exists "a draft belongs to the lawyer on it" on public.draft_jobs;
create policy "a draft belongs to the lawyer on it" on public.draft_jobs for select
  using (auth.uid() = lawyer_id or public.is_staff());

drop policy if exists "the lawyer works their own draft" on public.draft_jobs;
create policy "the lawyer works their own draft" on public.draft_jobs for update
  using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id);

-- Nobody inserts one by hand: the trigger below decides when a draft is owed,
-- and it only ever owes one to a lawyer who is paying for the tool. Left to
-- the client, this is a way to spend somebody else's subscription.
drop policy if exists "drafts are queued by the platform" on public.draft_jobs;
create policy "drafts are queued by the platform" on public.draft_jobs for insert
  with check (public.is_staff());

-- A queue entry is evidence of what the assistant was asked and what it said.
-- It is not deleted by the person it reflects on.
drop policy if exists "drafts are not deleted" on public.draft_jobs;
create policy "drafts are not deleted" on public.draft_jobs for delete
  using (public.is_staff());

-- Work arriving on a subscribing lawyer owes a draft. Queued once, and never
-- for work that is already written or already finished.
--
-- The decision is a plain function rather than a trigger body so that both
-- ways a lawyer can arrive on a request — named at the start, or taken on
-- afterwards from the auction — ask the same question of the same code.
create or replace function public.owe_a_draft(rid uuid, who uuid, state text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if who is null then return; end if;
  if state in ('delivered', 'completed', 'cancelled', 'refunded') then return; end if;
  if not public.has_ai(who) then return; end if;

  insert into public.draft_jobs (request_id, lawyer_id)
  values (rid, who)
  on conflict (request_id) do nothing;
end $$;

create or replace function public.queue_ai_draft() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.lawyer_id is distinct from old.lawyer_id then
    perform public.owe_a_draft(new.id, new.lawyer_id, new.status);
  end if;
  return new;
end $$;

drop trigger if exists requests_queue_draft on public.requests;
create trigger requests_queue_draft after insert on public.requests
  for each row execute function public.queue_ai_draft();

-- The auction route, where the lawyer arrives second.
drop trigger if exists requests_queue_draft_on_take on public.requests;
create trigger requests_queue_draft_on_take after update of lawyer_id on public.requests
  for each row execute function public.queue_ai_draft();

-- A draft that is ready is worth nothing sitting in a table. The lawyer is
-- told, through the same notice path as everything else, and told once.
create or replace function public.tell_lawyer_draft_ready() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    new.ready_at := coalesce(new.ready_at, now());
    -- Insert-if-absent rather than an upsert: 013 made reopening somebody
    -- else's notice a privileged act with one door, and this may well run
    -- with no session at all. One draft per request means one notice, so
    -- there is nothing here that needs reopening.
    insert into public.notifications (to_id, type, ref)
    values (new.lawyer_id, 'draft_ready', new.request_id::text)
    on conflict (to_id, type, ref) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists draft_jobs_tell_lawyer on public.draft_jobs;
create trigger draft_jobs_tell_lawyer before update on public.draft_jobs
  for each row execute function public.tell_lawyer_draft_ready();

-- =========================================================== 2. the workshops

create table if not exists public.webinars (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique,
  host_id     uuid not null references public.profiles on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  brief       text,
  audience    text not null default 'intern'
              check (audience in ('intern', 'client', 'all')),
  channel     text not null default 'video' check (channel in ('voice', 'video')),
  price       numeric(10,2) not null default 0 check (price >= 0),
  seats       int not null check (seats between 1 and 500),
  hours       int not null default 1 check (hours between 1 and 12),
  starts_at   timestamptz not null,
  minutes     int not null default 60 check (minutes between 15 and 480),
  status      text not null default 'open'
              check (status in ('open', 'full', 'live', 'done', 'cancelled')),
  created_at  timestamptz not null default now()
);
alter table public.webinars enable row level security;
grant select, insert, update, delete on public.webinars to authenticated;
create index if not exists webinars_when on public.webinars (starts_at);
create index if not exists webinars_host on public.webinars (host_id);

-- A workshop is advertised: anyone may read the listing. What is not public
-- is who booked a seat, which is the next table down.
drop policy if exists "workshops are listed" on public.webinars;
create policy "workshops are listed" on public.webinars for select using (true);

-- Only a verified lawyer hosts one. Status is checked here rather than
-- trusted from the form, because the form is not the only way in.
drop policy if exists "a verified lawyer hosts" on public.webinars;
create policy "a verified lawyer hosts" on public.webinars for insert
  with check (
    auth.uid() = host_id
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and 'lawyer' = any(p.roles)
                   and p.status = 'verified')
  );

drop policy if exists "the host runs their own" on public.webinars;
create policy "the host runs their own" on public.webinars for update
  using (auth.uid() = host_id or public.is_staff())
  with check (auth.uid() = host_id or public.is_staff());

drop policy if exists "only the desk removes a workshop" on public.webinars;
create policy "only the desk removes a workshop" on public.webinars for delete
  using (public.is_staff());

create table if not exists public.webinar_seats (
  id          uuid primary key default gen_random_uuid(),
  webinar_id  uuid not null references public.webinars on delete cascade,
  holder_id   uuid not null references public.profiles on delete cascade,
  price       numeric(10,2) not null default 0 check (price >= 0),
  attended    boolean not null default false,
  created_at  timestamptz not null default now(),
  -- One seat per person. Two is a way to hold the room shut.
  unique (webinar_id, holder_id)
);
alter table public.webinar_seats enable row level security;
grant select, insert, update, delete on public.webinar_seats to authenticated;
create index if not exists webinar_seats_room on public.webinar_seats (webinar_id);

-- Who is in the room is known to the person themselves, to the host, and to
-- the desk. Not to the other attendees: a workshop roster is a list of people
-- who needed legal training, which is nobody else's business.
drop policy if exists "your seat, the host's room" on public.webinar_seats;
create policy "your seat, the host's room" on public.webinar_seats for select
  using (
    auth.uid() = holder_id
    or public.is_staff()
    or exists (select 1 from public.webinars w
                where w.id = webinar_id and w.host_id = auth.uid())
  );

drop policy if exists "you take your own seat" on public.webinar_seats;
create policy "you take your own seat" on public.webinar_seats for insert
  with check (auth.uid() = holder_id);

drop policy if exists "the host marks attendance" on public.webinar_seats;
create policy "the host marks attendance" on public.webinar_seats for update
  using (public.is_staff() or exists (
    select 1 from public.webinars w where w.id = webinar_id and w.host_id = auth.uid()))
  with check (public.is_staff() or exists (
    select 1 from public.webinars w where w.id = webinar_id and w.host_id = auth.uid()));

-- Giving up a seat is allowed while the room has not started. Afterwards the
-- row is the record that somebody was there.
drop policy if exists "a seat is given up before it starts" on public.webinar_seats;
create policy "a seat is given up before it starts" on public.webinar_seats for delete
  using (
    public.is_staff()
    or (auth.uid() = holder_id and exists (
          select 1 from public.webinars w
           where w.id = webinar_id and w.starts_at > now()))
  );

-- The ceiling is a number in a column until something enforces it. Two people
-- taking the last seat at the same moment is the ordinary case, not the
-- exotic one, so the count is taken with the row locked.
create or replace function public.guard_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare room public.webinars%rowtype; taken int;
begin
  select * into room from public.webinars where id = new.webinar_id for update;
  if room is null then raise exception 'no such workshop'; end if;
  if room.status in ('cancelled', 'done') then
    raise exception 'this workshop is not taking seats';
  end if;
  if room.starts_at <= now() then
    raise exception 'this workshop has started';
  end if;

  select count(*) into taken from public.webinar_seats where webinar_id = new.webinar_id;
  if taken >= room.seats then
    raise exception 'this workshop is full';
  end if;

  -- The price is the room's price at the moment the seat was taken, pinned
  -- here so a host cannot raise it afterwards on people already booked.
  new.price := room.price;

  if taken + 1 >= room.seats then
    update public.webinars set status = 'full' where id = room.id and status = 'open';
  end if;
  return new;
end $$;

drop trigger if exists webinar_seats_guard on public.webinar_seats;
create trigger webinar_seats_guard before insert on public.webinar_seats
  for each row execute function public.guard_seats();

-- A seat given up puts the room back on sale.
create or replace function public.reopen_room() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.webinars set status = 'open'
   where id = old.webinar_id and status = 'full';
  return old;
end $$;

drop trigger if exists webinar_seats_reopen on public.webinar_seats;
create trigger webinar_seats_reopen after delete on public.webinar_seats
  for each row execute function public.reopen_room();

-- A workshop gets a reference for the same reason a request does: somebody
-- has to be able to say it out loud.
create sequence if not exists public.webinar_ref_seq;
create or replace function public.stamp_webinar_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null then
    new.ref := 'WRK-' || to_char(now(), 'YY') || '-' ||
               lpad(nextval('public.webinar_ref_seq')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists webinars_stamp_ref on public.webinars;
create trigger webinars_stamp_ref before insert on public.webinars
  for each row execute function public.stamp_webinar_ref();

-- ========================================================== 3. the supervision

alter table public.profiles add column if not exists is_mentor boolean not null default false;
alter table public.profiles add column if not exists mentorship_fee numeric(10,2)
  check (mentorship_fee is null or mentorship_fee >= 0);
grant select (is_mentor, mentorship_fee) on public.profiles to anon, authenticated;

create table if not exists public.mentorships (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.profiles on delete cascade,
  intern_id    uuid not null references public.profiles on delete cascade,
  -- Who moved first. A trainee applying and a lawyer inviting are the same
  -- relationship arrived at from opposite ends, and the difference matters
  -- when somebody asks later how this started.
  opened_by    text not null check (opened_by in ('intern', 'mentor')),
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'declined', 'ended')),
  fee          numeric(10,2) not null default 0 check (fee >= 0),
  note         text,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),
  unique (mentor_id, intern_id),
  constraint mentor_is_not_the_trainee check (mentor_id <> intern_id)
);
alter table public.mentorships enable row level security;
grant select, insert, update, delete on public.mentorships to authenticated;
create index if not exists mentorships_mentor on public.mentorships (mentor_id, status);
create index if not exists mentorships_intern on public.mentorships (intern_id, status);

drop policy if exists "the two of them, and the desk" on public.mentorships;
create policy "the two of them, and the desk" on public.mentorships for select
  using (auth.uid() in (mentor_id, intern_id) or public.is_staff());

-- Either side may open it, and only as themselves: a trainee applies, a
-- mentor invites, and neither writes the other's half of the row.
drop policy if exists "apply as yourself, invite as yourself" on public.mentorships;
create policy "apply as yourself, invite as yourself" on public.mentorships for insert
  with check (
    (opened_by = 'intern' and auth.uid() = intern_id)
    or (opened_by = 'mentor' and auth.uid() = mentor_id)
  );

drop policy if exists "either side answers" on public.mentorships;
create policy "either side answers" on public.mentorships for update
  using (auth.uid() in (mentor_id, intern_id) or public.is_staff())
  with check (auth.uid() in (mentor_id, intern_id) or public.is_staff());

drop policy if exists "only the desk deletes a mentorship" on public.mentorships;
create policy "only the desk deletes a mentorship" on public.mentorships for delete
  using (public.is_staff());

-- The side that opened it cannot also accept it. Written here because it is
-- the whole of what "an application" means, and a button is not a rule.
create or replace function public.guard_mentorship() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    -- The fee is the mentor's published one, pinned at the moment of asking
    -- so it cannot move underneath somebody who already agreed to it.
    select coalesce(p.mentorship_fee, 0) into new.fee
      from public.profiles p where p.id = new.mentor_id;
    if not exists (select 1 from public.profiles p
                    where p.id = new.mentor_id and p.is_mentor
                      and 'lawyer' = any(p.roles) and p.status = 'verified') then
      raise exception 'this lawyer is not taking trainees';
    end if;
    return new;
  end if;

  if who is null or public.is_staff() then return new; end if;

  if new.status = 'active' and old.status = 'pending' then
    if (old.opened_by = 'intern' and who <> old.mentor_id)
       or (old.opened_by = 'mentor' and who <> old.intern_id) then
      raise exception 'the side that asked does not also answer';
    end if;
    new.started_at := coalesce(new.started_at, now());
  end if;

  if new.status = 'ended' and old.status <> 'ended' then
    new.ended_at := coalesce(new.ended_at, now());
  end if;

  -- The fee is what it was when this was agreed. Neither side edits it later.
  new.fee := old.fee;
  new.mentor_id := old.mentor_id;
  new.intern_id := old.intern_id;
  new.opened_by := old.opened_by;
  return new;
end $$;

drop trigger if exists mentorships_guard on public.mentorships;
create trigger mentorships_guard before insert or update on public.mentorships
  for each row execute function public.guard_mentorship();

-- The other side is told. An application nobody sees is an application nobody
-- answers, which is the failure mode this whole feature has.
create or replace function public.tell_about_mentorship() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if tg_op = 'INSERT' then
    target := case when new.opened_by = 'intern' then new.mentor_id else new.intern_id end;
  elsif new.status is distinct from old.status then
    -- The answer goes back to whoever asked.
    target := case when new.opened_by = 'intern' then new.intern_id else new.mentor_id end;
  else
    return new;
  end if;

  -- One mentorship raises more than one notice over its life — applied,
  -- accepted, ended — against the same (person, kind, ref). Reopening that
  -- row is exactly what 013 made a privileged act with one door, so this
  -- goes through that door rather than round it.
  if auth.uid() is not null then
    perform public.raise_notice(target, 'mentorship', new.id::text);
  else
    insert into public.notifications (to_id, type, ref)
    values (target, 'mentorship', new.id::text)
    on conflict (to_id, type, ref) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists mentorships_tell on public.mentorships;
create trigger mentorships_tell after insert or update on public.mentorships
  for each row execute function public.tell_about_mentorship();

-- Are these two in a live mentorship? One question, one place, same reason as
-- has_ai() above.
create or replace function public.mentored_by(mentor uuid, intern uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships m
     where m.mentor_id = mentor and m.intern_id = intern and m.status = 'active'
  )
$$;
revoke all on function public.mentored_by(uuid, uuid) from public;
grant execute on function public.mentored_by(uuid, uuid) to authenticated;

create or replace function public.in_mentorship(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships x
     where x.id = m and auth.uid() in (x.mentor_id, x.intern_id)
  ) or public.is_staff()
$$;
revoke all on function public.in_mentorship(uuid) from public;
grant execute on function public.in_mentorship(uuid) to authenticated;

-- ------------------------------------------------------------- the calendar
create table if not exists public.mentorship_sessions (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid references public.mentorships on delete cascade,
  mentor_id     uuid not null references public.profiles on delete cascade,
  kind          text not null default 'training'
                check (kind in ('training', 'review', 'office_hours')),
  title         text not null check (length(btrim(title)) > 0),
  note          text,
  starts_at     timestamptz not null,
  minutes       int not null default 60 check (minutes between 15 and 480),
  hours         int not null default 1 check (hours between 0 and 12),
  attended      boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.mentorship_sessions enable row level security;
grant select, insert, update, delete on public.mentorship_sessions to authenticated;
create index if not exists mentorship_sessions_when
  on public.mentorship_sessions (mentor_id, starts_at);

-- A session with no mentorship on it is the mentor's group slot: everybody
-- they currently supervise can see it. One with a mentorship on it is between
-- those two.
drop policy if exists "the people it is for" on public.mentorship_sessions;
create policy "the people it is for" on public.mentorship_sessions for select
  using (
    auth.uid() = mentor_id
    or public.is_staff()
    or (mentorship_id is not null and public.in_mentorship(mentorship_id))
    or (mentorship_id is null and public.mentored_by(mentor_id, auth.uid()))
  );

drop policy if exists "the mentor keeps the calendar" on public.mentorship_sessions;
create policy "the mentor keeps the calendar" on public.mentorship_sessions for all
  using (auth.uid() = mentor_id or public.is_staff())
  with check (auth.uid() = mentor_id or public.is_staff());

-- ------------------------------------------------------------- the room
-- The case thread is bolted to a request, and a mentorship is not one. Rather
-- than loosening `messages.request_id` — which every audience policy on this
-- project reads — supervision gets its own small room with its own rule.
create table if not exists public.mentorship_messages (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships on delete cascade,
  author_id     uuid not null references public.profiles on delete cascade,
  body          text,
  created_at    timestamptz not null default now()
);
alter table public.mentorship_messages enable row level security;
grant select, insert, update, delete on public.mentorship_messages to authenticated;
create index if not exists mentorship_messages_room
  on public.mentorship_messages (mentorship_id, created_at);

drop policy if exists "the room is the two of them" on public.mentorship_messages;
create policy "the room is the two of them" on public.mentorship_messages for select
  using (public.in_mentorship(mentorship_id));

drop policy if exists "speak for yourself in the room" on public.mentorship_messages;
create policy "speak for yourself in the room" on public.mentorship_messages for insert
  with check (auth.uid() = author_id and public.in_mentorship(mentorship_id));

-- Said is said. Neither side rewrites the record of a supervision that may
-- later be asked about when a certificate is signed.
drop policy if exists "the room is not rewritten" on public.mentorship_messages;
create policy "the room is not rewritten" on public.mentorship_messages for delete
  using (public.is_staff());

-- --------------------------------------------------------------- the hours
-- Training hours came from delivered work alone. Supervision that was
-- attended counts too, and the certificate threshold is the same 40.
create or replace function public.mentored_hours(intern uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(s.hours), 0)::int
    from public.mentorship_sessions s
    join public.mentorships m on m.id = s.mentorship_id
   where s.attended and m.intern_id = intern
$$;
revoke all on function public.mentored_hours(uuid) from public;
grant execute on function public.mentored_hours(uuid) to authenticated;

-- ------------------------------------------------------------------ anon
-- 009 said this once for every table that existed then. Said again for the
-- four created above, because a later migration must not hand it back.
do $$
declare t text;
begin
  foreach t in array array['draft_jobs', 'webinars', 'webinar_seats',
                           'mentorships', 'mentorship_sessions', 'mentorship_messages']
  loop
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
