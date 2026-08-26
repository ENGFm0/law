-- ===========================================================================
--  024 — a training room that can only carry sentences
--
--  A lawyer supervising a trainee can attach a file to a case and leave a
--  voice note on it: the internal thread has carried both since 012 and 018.
--  The room the two of them actually teach in carried neither. Everything
--  worth handing over in training — a marked-up draft, a judgment to read,
--  two minutes of "here is what you missed" — had to be described in words
--  or moved onto a case that had nothing to do with it.
--
--  So attachments learn a second thing they can belong to, the same way
--  payments learned one in 020: a nullable mentorship_id, and a constraint
--  saying a file is about exactly one thing.
-- ===========================================================================

-- The column and the rule. request_id has to give up `not null` for a file
-- to belong to a room instead — and a file belonging to neither, or to both,
-- is a file nobody can reason about.
alter table public.attachments
  add column if not exists mentorship_id uuid references public.mentorships on delete cascade;
alter table public.attachments alter column request_id drop not null;

alter table public.attachments drop constraint if exists attachment_is_about_one_thing;
alter table public.attachments add constraint attachment_is_about_one_thing check (
  (request_id is not null and mentorship_id is null)
  or (request_id is null and mentorship_id is not null)
);

create index if not exists attachments_room
  on public.attachments (mentorship_id, created_at) where mentorship_id is not null;

-- Messages in the room may point at the file that came with them, the way a
-- case message does. Same table, same idea.
alter table public.mentorship_messages
  add column if not exists attachment_id uuid references public.attachments on delete set null;

-- =============================================== who may read and write them

-- The policies on attachments were written when request_id was the only
-- thing a file could be about, so both of them start by asking about a
-- request. A file in a room has no request, and `works_on_request(null)`
-- answers false — so without this the room's files would be written and
-- never readable, which is the same silent nothing the screening pool was.
drop policy if exists "files follow their thread" on public.attachments;
create policy "files follow their thread" on public.attachments for select
  using (
    case
      when mentorship_id is not null then public.in_mentorship(mentorship_id)
      when audience = 'staff' then public.is_staff()
      when audience = 'internal' then public.works_on_request(request_id)
      else public.may_see_request(request_id)
    end
  );

drop policy if exists "you attach your own" on public.attachments;
create policy "you attach your own" on public.attachments for insert
  with check (
    auth.uid() = author_id
    and case
          when mentorship_id is not null then public.in_mentorship(mentorship_id)
          when audience = 'staff' then public.may_see_request(request_id)
          when audience = 'internal' then public.works_on_request(request_id)
          else public.may_see_request(request_id)
        end
  );

-- A room is two people and the desk, and 019 already says so for what is
-- said in it. This is the same sentence for what is handed over in it.
comment on column public.attachments.mentorship_id is
  'The training room this file belongs to. Exactly one of request_id and this.';
