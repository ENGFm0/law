-- ===========================================================================
--  012 — a case has a conversation, and the conversation has files
--
--  Everything the two sides needed to say to each other happened somewhere
--  else: on the phone, over email, in a call the platform hosted and then
--  forgot. So the record of what was agreed, what was sent and when, lived
--  nowhere — which is precisely the record a dispute turns on.
--
--  Two threads per request, not one:
--
--    parties  — the client and the professional. What the client uploads,
--               what comes back, and everything said around it.
--    internal — the lawyer and the trainee they routed the work to. The
--               client cannot read it, and that is the whole point: a trainee
--               asking "is this the right forum?" is not a message to the
--               person paying for the answer.
--
--  Files live in Storage, in a private bucket, one folder per request. The
--  row in `attachments` is what the site lists; the object is what it fetches
--  with a signed URL that expires. Nothing is world-readable.
-- ===========================================================================

-- Who may see a request at all, as one expression rather than four copies of
-- it. Definer, because the policies below are read from tables the caller may
-- not be allowed to look at directly.
create or replace function public.may_see_request(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.requests r
     where r.id = rid
       and (r.client_id = auth.uid() or r.lawyer_id = auth.uid()
            or r.assigned_to = auth.uid())
  ) or public.is_staff()
$$;
revoke all on function public.may_see_request(uuid) from public;
grant execute on function public.may_see_request(uuid) to authenticated;

-- The professional side of a request: the lawyer who owns it and the trainee
-- it was routed to. Everything the client must not read is gated on this.
create or replace function public.works_on_request(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.requests r
     where r.id = rid
       and (r.lawyer_id = auth.uid() or r.assigned_to = auth.uid())
  ) or public.is_staff()
$$;
revoke all on function public.works_on_request(uuid) from public;
grant execute on function public.works_on_request(uuid) to authenticated;

-- ------------------------------------------------------------- the messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  audience   text not null default 'parties'
             check (audience in ('parties', 'internal')),
  body       text,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index if not exists messages_request on public.messages (request_id, created_at);

drop policy if exists "the thread belongs to its request" on public.messages;
create policy "the thread belongs to its request" on public.messages for select
  using (
    case audience
      when 'internal' then public.works_on_request(request_id)
      else public.may_see_request(request_id)
    end
  );

-- You write as yourself, on a case you are on, into a thread you belong to.
drop policy if exists "you speak for yourself" on public.messages;
create policy "you speak for yourself" on public.messages for insert
  with check (
    auth.uid() = author_id
    and case audience
          when 'internal' then public.works_on_request(request_id)
          else public.may_see_request(request_id)
        end
  );

-- A conversation is a record. Nobody edits it, including the person who wrote
-- it — which is what makes it worth anything when a delivery is disputed.
grant select, insert on public.messages to authenticated;

-- ---------------------------------------------------------- the attachments
create table if not exists public.attachments (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests on delete cascade,
  message_id uuid references public.messages on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  audience   text not null default 'parties'
             check (audience in ('parties', 'internal')),
  path       text not null unique,
  name       text not null,
  size       bigint not null default 0,
  mime       text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);
alter table public.attachments enable row level security;
create index if not exists attachments_request on public.attachments (request_id, created_at);

drop policy if exists "files follow their thread" on public.attachments;
create policy "files follow their thread" on public.attachments for select
  using (
    case audience
      when 'internal' then public.works_on_request(request_id)
      else public.may_see_request(request_id)
    end
  );
drop policy if exists "you attach your own" on public.attachments;
create policy "you attach your own" on public.attachments for insert
  with check (
    auth.uid() = author_id
    and case audience
          when 'internal' then public.works_on_request(request_id)
          else public.may_see_request(request_id)
        end
  );
grant select, insert on public.attachments to authenticated;

-- --------------------------------------------------------------- the bucket
-- Private, one folder per request, and the policies read the folder name as
-- the request it belongs to. Wrapped because a plain PostgreSQL used for the
-- policy tests has no `storage` schema — the rules still have to be written
-- down here rather than clicked into a dashboard nobody can review.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'objects') then

    insert into storage.buckets (id, name, public, file_size_limit)
    values ('case-files', 'case-files', false, 26214400)   -- 25 MB
    on conflict (id) do update set public = false, file_size_limit = 26214400;

    execute $p$drop policy if exists "case files are read by the case" on storage.objects$p$;
    execute $p$
      create policy "case files are read by the case" on storage.objects for select
        using (bucket_id = 'case-files'
               and public.may_see_request(((storage.foldername(name))[1])::uuid))
    $p$;

    execute $p$drop policy if exists "case files are written by the case" on storage.objects$p$;
    execute $p$
      create policy "case files are written by the case" on storage.objects for insert
        with check (bucket_id = 'case-files'
                    and auth.uid() is not null
                    and public.may_see_request(((storage.foldername(name))[1])::uuid))
    $p$;

    -- Nobody overwrites or removes evidence, including whoever uploaded it.
    execute $p$drop policy if exists "case files are not rewritten" on storage.objects$p$;
  end if;
end $$;

-- ------------------------------------------------------ an objection is news
-- A dispute that nobody is told about is a dispute that sits there. The desk
-- is the only body that can decide one, so the desk is told the moment one
-- opens — from the database, so it happens whoever opened it and however.
create or replace function public.tell_staff_about_dispute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (to_id, type, ref)
  select p.id, 'disputed', new.request_id::text
    from public.profiles p
   where 'staff' = any(p.roles)
  on conflict (to_id, type, ref) do nothing;
  return new;
end $$;
drop trigger if exists disputes_tell_staff on public.disputes;
create trigger disputes_tell_staff after insert on public.disputes
  for each row execute function public.tell_staff_about_dispute();
