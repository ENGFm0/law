-- ===========================================================================
--  018 — a call leaves a copy
--
--  A consultation held by voice or video is the one part of a case that left
--  no trace at all. When it is later disputed, both sides describe a
--  conversation nobody can check — which is the worst possible footing for
--  the desk to decide on.
--
--  So a call is recorded, and the recording is an attachment on the request
--  like any other. Two things about that are deliberate:
--
--    • Both people are told, on screen, for the whole call. A recording
--      nobody was told about is not evidence, it is a problem.
--
--    • The platform's copy is kept whatever the parties choose, and they are
--      told that too. That needs a third audience: `staff` — readable by the
--      desk alone, invisible to the client and the lawyer both.
-- ===========================================================================

alter table public.messages drop constraint if exists messages_audience_check;
alter table public.messages add constraint messages_audience_check
  check (audience in ('parties', 'internal', 'staff'));
alter table public.attachments drop constraint if exists attachments_audience_check;
alter table public.attachments add constraint attachments_audience_check
  check (audience in ('parties', 'internal', 'staff'));

-- Reading: the desk alone, for that third audience.
drop policy if exists "the thread belongs to its request" on public.messages;
create policy "the thread belongs to its request" on public.messages for select
  using (
    case audience
      when 'staff' then public.is_staff()
      when 'internal' then public.works_on_request(request_id)
      else public.may_see_request(request_id)
    end
  );

drop policy if exists "files follow their thread" on public.attachments;
create policy "files follow their thread" on public.attachments for select
  using (
    case audience
      when 'staff' then public.is_staff()
      when 'internal' then public.works_on_request(request_id)
      else public.may_see_request(request_id)
    end
  );

-- Writing: a party to the call may leave the platform's copy, and only that.
-- Without this the recorder could not hand over the very file the rule exists
-- to keep — and with a looser rule anybody could write into the desk's view.
drop policy if exists "you attach your own" on public.attachments;
create policy "you attach your own" on public.attachments for insert
  with check (
    auth.uid() = author_id
    and case audience
          when 'staff' then public.may_see_request(request_id)
          when 'internal' then public.works_on_request(request_id)
          else public.may_see_request(request_id)
        end
  );

drop policy if exists "you speak for yourself" on public.messages;
create policy "you speak for yourself" on public.messages for insert
  with check (
    auth.uid() = author_id
    and case audience
          when 'staff' then public.may_see_request(request_id)
          when 'internal' then public.works_on_request(request_id)
          else public.may_see_request(request_id)
        end
  );

-- What a recording is of, and how long it ran. On the attachment because the
-- recording IS the attachment; a call with no file left is a call with no row.
alter table public.attachments add column if not exists kind text;
alter table public.attachments add column if not exists seconds int;
