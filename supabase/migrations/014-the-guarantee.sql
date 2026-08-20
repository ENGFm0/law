-- ===========================================================================
--  014 — the promise that makes a stranger pay a stranger
--
--  Everything on this platform already holds the client's money until they
--  accept the work, and hands it back in full when a dispute is decided that
--  way. What was missing is the sentence that says so before anybody pays:
--  "if it was not what you were told it would be, you get your money back."
--
--  So the promise becomes a setting the platform publishes and a door the
--  client can actually open:
--
--    guarantee_hours          — how long after delivery the promise stands
--    guarantee_unconditional  — whether the client alone decides inside it
--    min_years                — the experience the platform says it lists
--
--  Unconditional is not a loophole. The window is short, it starts at
--  delivery, it can be used once per request, and it is recorded as a decided
--  dispute like any other — so the books, the trainee's claim and the record
--  all behave exactly as they already do. What it removes is the wait for
--  somebody at a desk to agree.
-- ===========================================================================

alter table public.platform_settings
  add column if not exists guarantee_hours int not null default 24;
alter table public.platform_settings
  add column if not exists guarantee_unconditional boolean not null default true;
alter table public.platform_settings
  add column if not exists min_years int not null default 5;

alter table public.platform_settings drop constraint if exists guarantee_window_is_sane;
alter table public.platform_settings add constraint guarantee_window_is_sane
  check (guarantee_hours between 0 and 168);

-- ------------------------------------------------------------- the clock
-- Both the acceptance deadline and the guarantee window start at delivery,
-- and neither can be left to a browser: the moment work was handed over is
-- what decides when money moves, so the database stamps it.
--
-- It was not being written at all. The update that marks a request delivered
-- carries a status and nothing else, so `delivered_at` stayed null on every
-- real request — which meant no countdown, no automatic acceptance, and now
-- no window to make a promise about.
create or replace function public.stamp_request_clock() returns trigger
language plpgsql as $$
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered')
     and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  if new.status = 'completed' and (old.status is distinct from 'completed')
     and new.accepted_at is null then
    new.accepted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists requests_stamp_clock on public.requests;
create trigger requests_stamp_clock before update on public.requests
  for each row execute function public.stamp_request_clock();

-- The client's own door. Definer, because settling a request is not something
-- a browser may do — every rule that makes it safe is checked here:
--   • the caller is the client on that request
--   • the work was delivered, and not already accepted
--   • the window has not closed
--   • nothing has been disputed on it already
--   • and the platform is actually offering the promise
create or replace function public.refund_under_guarantee(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.requests%rowtype;
  cfg public.platform_settings%rowtype;
begin
  if auth.uid() is null then return 'not signed in'; end if;
  select * into cfg from public.platform_settings where id = 1;
  if cfg.id is null or not cfg.guarantee_unconditional then return 'not offered'; end if;

  select * into r from public.requests where id = p_request;
  if r.id is null then return 'no such request'; end if;
  if r.client_id <> auth.uid() then return 'not yours'; end if;
  if r.delivered_at is null then return 'not delivered'; end if;
  if r.accepted_at is not null or r.status = 'completed' then return 'already accepted'; end if;
  if now() - r.delivered_at > make_interval(hours => cfg.guarantee_hours) then
    return 'window closed';
  end if;
  if exists (select 1 from public.disputes d where d.request_id = p_request) then
    return 'already disputed';
  end if;

  -- Recorded as a decided dispute, because that is what it is: the platform
  -- deciding, in advance and in public, that inside this window the client is
  -- right. Everything downstream — the split, the trainee's surviving claim,
  -- the books — already knows how to read one of these.
  insert into public.disputes (request_id, by_id, reason, status, outcome,
                               lawyer_pct, resolution_reason, resolved_by, resolved_at)
  values (p_request, auth.uid(), 'ضمان الرضا', 'resolved', 'refund',
          0, 'استرداد ضمن نافذة الضمان المعلنة', null, now());

  update public.requests set status = 'refunded' where id = p_request;

  perform public.raise_notice(r.lawyer_id, 'resolved', p_request::text);
  insert into public.notifications (to_id, type, ref)
  select p.id, 'resolved', p_request::text
    from public.profiles p where 'staff' = any(p.roles)
  on conflict (to_id, type, ref) do nothing;

  return 'refunded';
end $$;
revoke all on function public.refund_under_guarantee(uuid) from public;
grant execute on function public.refund_under_guarantee(uuid) to authenticated;

-- A request that was refunded is finished, and the client's own update policy
-- must not be able to walk it back into "completed" and out of the ledger.
create or replace function public.pin_request_terms() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if old.status = 'refunded' and new.status is distinct from 'refunded' then
    raise exception 'a refunded request is closed';
  end if;
  if new.client_id is distinct from old.client_id
     or new.price is distinct from old.price
     or new.type_id is distinct from old.type_id then
    raise exception 'the parties and the price are settled when the request is made';
  end if;
  if old.lawyer_id is not null and new.lawyer_id is distinct from old.lawyer_id then
    raise exception 'the lawyer on a request does not change';
  end if;
  return new;
end $$;
