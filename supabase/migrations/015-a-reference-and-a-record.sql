-- ===========================================================================
--  015 — a number you can say out loud, and a record of what happened
--
--  Two things the desk cannot work without and did not have.
--
--  A REFERENCE. Every request and every objection is a UUID, which is the
--  right thing for a database and a useless thing for a person: nobody reads
--  one over the phone, nobody types one into a search box, and nobody quotes
--  one in a complaint. So each gets a short code — SND-26-00042 — unique,
--  never reused, and generated where it cannot be forgotten.
--
--  A RECORD. The site could show what a request IS, never what happened to
--  it. When it was placed, when it went to a trainee and to whom, when it was
--  delivered, when a revision was asked for, when it was disputed and how it
--  was decided — all of that lived only in the current value of `status`,
--  which is to say it did not live anywhere. Deciding an objection without it
--  is guessing.
--
--  So every change to a request appends a line. Written by a trigger rather
--  than by the pages, because a record that depends on sixteen callers
--  remembering to write it is a record with holes in it.
-- ===========================================================================

-- ------------------------------------------------------------- the reference
create sequence if not exists public.request_ref_seq start 1;
create sequence if not exists public.dispute_ref_seq start 1;

alter table public.requests add column if not exists ref text;
alter table public.disputes add column if not exists ref text;
create unique index if not exists requests_ref_unique on public.requests (ref);
create unique index if not exists disputes_ref_unique on public.disputes (ref);

create or replace function public.stamp_ref() returns trigger
language plpgsql as $$
begin
  if new.ref is null then
    if tg_table_name = 'requests' then
      new.ref := 'SND-' || to_char(now(), 'YY') || '-' ||
                 lpad(nextval('public.request_ref_seq')::text, 5, '0');
    else
      new.ref := 'OBJ-' || to_char(now(), 'YY') || '-' ||
                 lpad(nextval('public.dispute_ref_seq')::text, 5, '0');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists requests_stamp_ref on public.requests;
create trigger requests_stamp_ref before insert on public.requests
  for each row execute function public.stamp_ref();
drop trigger if exists disputes_stamp_ref on public.disputes;
create trigger disputes_stamp_ref before insert on public.disputes
  for each row execute function public.stamp_ref();

-- Everything already here gets one too, oldest first, so the numbers run in
-- the order the work did.
do $$
declare row record;
begin
  for row in select id from public.requests where ref is null order by created_at loop
    update public.requests
       set ref = 'SND-' || to_char(now(), 'YY') || '-' ||
                 lpad(nextval('public.request_ref_seq')::text, 5, '0')
     where id = row.id;
  end loop;
  for row in select id from public.disputes where ref is null order by created_at loop
    update public.disputes
       set ref = 'OBJ-' || to_char(now(), 'YY') || '-' ||
                 lpad(nextval('public.dispute_ref_seq')::text, 5, '0')
     where id = row.id;
  end loop;
end $$;

-- ---------------------------------------------------------------- the record
create table if not exists public.request_events (
  id         bigserial primary key,
  request_id uuid not null references public.requests on delete cascade,
  kind       text not null,
  by_id      uuid references public.profiles on delete set null,
  detail     text,
  at         timestamptz not null default now()
);
alter table public.request_events enable row level security;
create index if not exists request_events_request on public.request_events (request_id, at);

-- Whoever may see the request may see what happened to it. There is no
-- version of this history one party gets and another does not: an objection
-- is decided on the same record both sides can read.
drop policy if exists "the record follows the request" on public.request_events;
create policy "the record follows the request" on public.request_events for select
  using (public.may_see_request(request_id));
grant select on public.request_events to authenticated;
-- Nobody writes it by hand. The trigger below does, as the table's owner.
revoke insert, update, delete on public.request_events from anon, authenticated;

create or replace function public.log_request_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'placed', new.client_id, null);
    if new.lawyer_id is not null then
      insert into public.request_events (request_id, kind, by_id, detail)
      values (new.id, 'lawyer_set', new.client_id, new.lawyer_id::text);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'status:' || new.status, who, old.status);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id,
            case when new.assigned_to is null then 'unassigned' else 'assigned' end,
            who, coalesce(new.assigned_to, old.assigned_to)::text);
  end if;
  if coalesce(new.revisions, 0) > coalesce(old.revisions, 0) then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'revision', who, new.revision_note);
  end if;
  if new.lawyer_id is distinct from old.lawyer_id and new.lawyer_id is not null then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'lawyer_set', who, new.lawyer_id::text);
  end if;
  return new;
end $$;
drop trigger if exists requests_log_insert on public.requests;
create trigger requests_log_insert after insert on public.requests
  for each row execute function public.log_request_event();
drop trigger if exists requests_log_update on public.requests;
create trigger requests_log_update after update on public.requests
  for each row execute function public.log_request_event();

-- An objection and its decision belong on the same line of the same record.
create or replace function public.log_dispute_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.request_id, 'disputed', new.by_id, new.reason);
    if new.status = 'resolved' then
      insert into public.request_events (request_id, kind, by_id, detail)
      values (new.request_id, 'decided', new.resolved_by,
              new.outcome || coalesce(' · ' || new.resolution_reason, ''));
    end if;
  elsif new.status = 'resolved' and old.status is distinct from 'resolved' then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.request_id, 'decided', new.resolved_by,
            new.outcome || coalesce(' · ' || new.resolution_reason, ''));
  end if;
  return new;
end $$;
drop trigger if exists disputes_log_insert on public.disputes;
create trigger disputes_log_insert after insert on public.disputes
  for each row execute function public.log_dispute_event();
drop trigger if exists disputes_log_update on public.disputes;
create trigger disputes_log_update after update on public.disputes
  for each row execute function public.log_dispute_event();
