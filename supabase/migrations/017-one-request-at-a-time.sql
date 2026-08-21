-- ===========================================================================
--  017 — one open request at a time, and rate the lawyer before the next
--
--  A client with four open requests is a client who cannot say what any of
--  them is about, and a lawyer chasing four acceptances gets none. Worse, the
--  rating — the one thing the whole directory is ordered by — is the step
--  everybody skips, because by the time the work is done there is nothing
--  standing between them and the next thing they want.
--
--  So the next request waits on two things: the last one is closed, and the
--  lawyer on it has been rated. Both are cheap to satisfy and neither can be
--  satisfied by accident.
--
--  Written here rather than in the page, because a rule enforced only where
--  the button is drawn is a rule anybody can call the API around. Staff are
--  exempt: the desk opens requests on people's behalf.
-- ===========================================================================

create or replace function public.guard_one_open_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare blocking public.requests%rowtype;
begin
  -- The trusted path (migrations, seeding, the service key) and the desk are
  -- not somebody queue-jumping.
  if auth.uid() is null or public.is_staff() then return new; end if;
  if new.client_id <> auth.uid() then return new; end if;

  select * into blocking from public.requests r
   where r.client_id = new.client_id
     and r.id <> new.id
     and (
       r.status not in ('completed', 'cancelled', 'refunded')
       or (r.status = 'completed' and not r.rated)
     )
   order by r.created_at
   limit 1;

  if blocking.id is not null then
    if blocking.status = 'completed' then
      raise exception 'rate the lawyer on % before opening another', blocking.ref
        using errcode = 'P0001';
    end if;
    raise exception 'request % is still open', blocking.ref
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists requests_one_at_a_time on public.requests;
create trigger requests_one_at_a_time before insert on public.requests
  for each row execute function public.guard_one_open_request();

-- Posting a brief to the auction is the same act one step earlier, and it is
-- the step where somebody is actually stopped: a brief that wins becomes a
-- request, so letting four briefs run is letting four requests through.
create or replace function public.guard_one_open_brief() returns trigger
language plpgsql security definer set search_path = public as $$
declare blocking public.requests%rowtype;
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if new.client_id <> auth.uid() then return new; end if;

  select * into blocking from public.requests r
   where r.client_id = new.client_id
     and (
       r.status not in ('completed', 'cancelled', 'refunded')
       or (r.status = 'completed' and not r.rated)
     )
   limit 1;

  if blocking.id is not null then
    raise exception 'request % is still open', blocking.ref using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists quotes_one_at_a_time on public.quotes;
create trigger quotes_one_at_a_time before insert on public.quotes
  for each row execute function public.guard_one_open_brief();

-- Rating is what closes a request, so the rating has to be able to say so.
-- It could not: `reviews` and `requests` are separate tables and nothing
-- joined them, so a client could rate and the request would sit at
-- "completed, unrated" for ever.
create or replace function public.mark_request_rated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.request_id is not null then
    update public.requests set rated = true where id = new.request_id;
  end if;
  return new;
end $$;
drop trigger if exists reviews_close_request on public.reviews;
create trigger reviews_close_request after insert on public.reviews
  for each row execute function public.mark_request_rated();
