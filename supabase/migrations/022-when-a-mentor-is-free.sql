-- ===========================================================================
--  022 — how long, and when
--
--  A trainee choosing a supervisor was shown two prices and a paragraph. The
--  two questions they actually have to answer before spending their own money
--  are neither of those:
--
--    • how much of this person do I get — hours a week, and for how many
--      months before the arrangement is meant to end
--    • when are they free — because a supervisor whose only slot is Sunday
--      morning is no supervisor at all to somebody who studies then
--
--  Both were being written into mentor_note as prose, which means neither
--  could be filtered on, compared, or held to. So they become columns: two
--  numbers and a small table of weekly windows.
--
--  The windows are what a mentor is willing to be booked in, not bookings.
--  A session is still written by the mentor, in mentorship_sessions, exactly
--  as before — this only says where the calendar is open, so a trainee can
--  see whether the two of them can ever meet before they pay anything.
-- ===========================================================================

-- =============================================== 1. how much of them you get

alter table public.profiles add column if not exists mentor_hours int
  check (mentor_hours is null or (mentor_hours >= 0 and mentor_hours <= 40));
alter table public.profiles add column if not exists mentor_months int
  check (mentor_months is null or (mentor_months >= 1 and mentor_months <= 24));

-- Read by the directory on every card, so it is readable the same way the
-- rest of the offer is.
grant select (mentor_hours, mentor_months) on public.profiles to anon, authenticated;

comment on column public.profiles.mentor_hours is
  'Hours a week this mentor commits to a trainee. Null means unstated.';
comment on column public.profiles.mentor_months is
  'How many months the arrangement is meant to run. Null means open-ended.';

-- =============================================== 2. when they are free

create table if not exists public.mentor_slots (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles on delete cascade,
  -- 0 = Sunday, matching the week the rest of the platform counts in.
  weekday    smallint not null check (weekday between 0 and 6),
  starts_at  time not null,
  ends_at    time not null,
  created_at timestamptz not null default now(),
  constraint slot_ends_after_it_starts check (ends_at > starts_at),
  -- The same window twice is a mistake, not a second offer.
  constraint one_window_per_start unique (mentor_id, weekday, starts_at)
);
alter table public.mentor_slots enable row level security;
grant select, insert, update, delete on public.mentor_slots to authenticated;
grant select on public.mentor_slots to anon;
create index if not exists mentor_slots_by_mentor
  on public.mentor_slots (mentor_id, weekday, starts_at);

-- When a lawyer is free to teach is not private: it is half the offer, and a
-- trainee has to read it before deciding. So it is public like the price.
drop policy if exists "a mentor's hours are part of the offer" on public.mentor_slots;
create policy "a mentor's hours are part of the offer" on public.mentor_slots
  for select using (true);

-- And written by nobody but the mentor themselves. Not by a trainee, not by
-- a lawyer filling in somebody else's week, not by the desk: an availability
-- somebody else wrote is a promise this person never made.
drop policy if exists "only your own week" on public.mentor_slots;
create policy "only your own week" on public.mentor_slots for insert
  with check (auth.uid() = mentor_id);
drop policy if exists "only your own week, changed" on public.mentor_slots;
create policy "only your own week, changed" on public.mentor_slots for update
  using (auth.uid() = mentor_id) with check (auth.uid() = mentor_id);
drop policy if exists "only your own week, removed" on public.mentor_slots;
create policy "only your own week, removed" on public.mentor_slots for delete
  using (auth.uid() = mentor_id);

-- A window is an offer to teach, so it belongs to somebody who is offering.
-- Checked in a trigger rather than a policy because the policy cannot see
-- the profile row without reading a table the policy is already on.
create or replace function public.guard_mentor_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare offers boolean;
begin
  select (is_mentor or supervises_cases) into offers
    from public.profiles where id = new.mentor_id;
  if not coalesce(offers, false) then
    raise exception 'only somebody taking trainees publishes hours'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists mentor_slots_guard on public.mentor_slots;
create trigger mentor_slots_guard
  before insert or update on public.mentor_slots
  for each row execute function public.guard_mentor_slot();

-- =============================================== 3. reading it back

-- One row per mentor with their week folded into it, so a directory does not
-- fetch a table per card.
create or replace function public.mentor_week(who uuid)
returns table (weekday smallint, starts_at time, ends_at time)
language sql stable security definer set search_path = public as $$
  select s.weekday, s.starts_at, s.ends_at
    from public.mentor_slots s
   where s.mentor_id = who
   order by s.weekday, s.starts_at;
$$;
grant execute on function public.mentor_week(uuid) to anon, authenticated;

-- How many hours a week those windows actually come to. The number a mentor
-- typed is what they promise; this is what they have published room for, and
-- the two disagreeing is worth showing rather than hiding.
create or replace function public.mentor_open_hours(who uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(extract(epoch from (ends_at - starts_at)) / 3600), 0)::numeric
    from public.mentor_slots where mentor_id = who;
$$;
grant execute on function public.mentor_open_hours(uuid) to anon, authenticated;
