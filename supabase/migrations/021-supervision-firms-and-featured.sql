-- ===========================================================================
--  021 — supervision by the case, law firms, and a paid place at the top
--
--  WHAT THIS FILE DELIBERATELY DOES NOT DO
--
--  `promo_codes`, `promo_redemptions`, `validate_promo_code`,
--  `redeem_promo_code`, `mentorships`, `mentorship_sessions`,
--  `mentorship_messages` and the free screening all exist already — 019 and
--  020 built them, and 271 policy checks hold them up. Creating them again
--  would either be a no-op or would drop live data, so this file extends them
--  and says so rather than pretending to be their author.
--
--  WHAT IS ACTUALLY NEW, AND WHY
--
--  1. SUPERVISION BY THE CASE. Today a trainee may only take a screening if
--     somebody is supervising them full time. That is the right rule and the
--     wrong gate: a trainee between mentorships, or one whose mentor does not
--     do employment law, is competent to do the work and has nobody to sign
--     it. So supervision becomes buyable one case at a time — the lawyer is
--     answerable for that one piece of advice, is paid for that one piece of
--     advice, and the screening stays free to the client either way.
--
--     Which means the money for it is paid by the TRAINEE, not the client,
--     and `payments` had a constraint saying a row is about exactly one of a
--     request or a mentorship. It is about exactly one of three now.
--
--  2. FIRMS. A directory of people cannot hold a partnership: a firm has a
--     roster, an address and a reputation of its own, and clients ask for
--     firms by name. It is its own entity, verified the way a licence is
--     verified — by the desk, never by the applicant — and listed only while
--     it is paying.
--
--  3. A PAID PLACE AT THE TOP. 006 gave the desk `featured_rank` to place
--     somebody editorially. This adds the other way in: a subscription. The
--     two are kept apart on purpose, because a directory where money is the
--     only way up and a directory where money is one way up are different
--     products, and mixing the columns would make it impossible to say later
--     which one this is.
-- ===========================================================================

-- =============================================== 1. supervision by the case

-- What a mentor offers, beside the monthly sponsorship 020 already priced.
alter table public.profiles add column if not exists supervision_fee numeric(10,2)
  check (supervision_fee is null or supervision_fee >= 0);
-- Taking trainees at all is one switch; taking a single case is another. A
-- lawyer with a full book may still sign one screening, and a lawyer who
-- mentors may not want piecework.
alter table public.profiles add column if not exists supervises_cases boolean not null default false;
alter table public.profiles add column if not exists mentor_note text;
grant select (supervision_fee, supervises_cases, mentor_note)
  on public.profiles to anon, authenticated;

-- The band, published by the platform the way every other band here is.
alter table public.platform_settings
  add column if not exists supervision_min numeric(10,2) not null default 50;
alter table public.platform_settings
  add column if not exists supervision_max numeric(10,2) not null default 100;

create or replace function public.guard_supervision_fee() returns trigger
language plpgsql security definer set search_path = public as $$
declare lo numeric; hi numeric;
begin
  if new.supervision_fee is null or not new.supervises_cases then return new; end if;
  select supervision_min, supervision_max into lo, hi
    from public.platform_settings where id = 1;
  if lo is null then return new; end if;
  if new.supervision_fee < lo or new.supervision_fee > hi then
    raise exception 'supervising one case is priced between % and %', lo, hi
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_supervision_fee on public.profiles;
create trigger profiles_guard_supervision_fee
  before insert or update of supervision_fee, supervises_cases
  on public.profiles for each row execute function public.guard_supervision_fee();

create table if not exists public.supervision_orders (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.profiles on delete restrict,
  intern_id   uuid not null references public.profiles on delete cascade,
  -- The one case it covers. Bought before the case is claimed, so it is
  -- filled in when the trainee takes the work.
  request_id  uuid references public.requests on delete set null,
  fee         numeric(10,2) not null default 0 check (fee >= 0),
  status      text not null default 'paid'
              check (status in ('paid', 'used', 'refunded', 'cancelled')),
  paid_at     timestamptz not null default now(),
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint mentor_is_not_the_trainee check (mentor_id <> intern_id)
);
alter table public.supervision_orders enable row level security;
grant select, insert, update, delete on public.supervision_orders to authenticated;
create index if not exists supervision_open
  on public.supervision_orders (intern_id, status) where status = 'paid';
create index if not exists supervision_mentor on public.supervision_orders (mentor_id);

drop policy if exists "the two of them, and the desk" on public.supervision_orders;
create policy "the two of them, and the desk" on public.supervision_orders for select
  using (auth.uid() in (mentor_id, intern_id) or public.is_staff());

-- Bought through buy_supervision() and nowhere else: an order somebody can
-- write for themselves is a signature somebody can write for themselves.
drop policy if exists "supervision is bought, not written" on public.supervision_orders;
create policy "supervision is bought, not written" on public.supervision_orders for insert
  with check (public.is_staff());

drop policy if exists "the desk alone edits an order" on public.supervision_orders;
create policy "the desk alone edits an order" on public.supervision_orders for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "the desk alone removes an order" on public.supervision_orders;
create policy "the desk alone removes an order" on public.supervision_orders for delete
  using (public.is_staff());

-- Money about a person's supervision of one case: not the client's payment
-- for a request, and not a monthly sponsorship. A third thing, and the
-- constraint says exactly one of the three so no row is ever about two.
alter table public.payments add column if not exists supervision_id uuid
  references public.supervision_orders on delete restrict;
alter table public.payments drop constraint if exists payment_is_about_one_thing;
alter table public.payments add constraint payment_is_about_one_thing check (
  (request_id is not null)::int
  + (mentorship_id is not null)::int
  + (supervision_id is not null)::int = 1
);

drop policy if exists "you see your own money" on public.payments;
create policy "you see your own money" on public.payments for select
  using (
    public.is_staff()
    or (request_id is not null and exists (
          select 1 from public.requests r where r.id = request_id and public.is_party(r)))
    or (mentorship_id is not null and public.in_mentorship(mentorship_id))
    or (supervision_id is not null and exists (
          select 1 from public.supervision_orders s
           where s.id = supervision_id and auth.uid() in (s.mentor_id, s.intern_id)))
  );

/** Buy one lawyer's signature on one case. Returns a word the page can act on
    rather than a stack trace, like every other money call here. */
create or replace function public.buy_supervision(
  p_mentor uuid, p_gateway text, p_gateway_ref text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.profiles%rowtype;
  cfg public.platform_settings%rowtype;
  gross bigint; cut bigint; net bigint; pid uuid; oid uuid;
begin
  if me is null then return 'not signed in'; end if;

  -- A trainee already supervised does not need to buy a signature, and
  -- selling them one would be selling nothing.
  if exists (select 1 from public.mentorships x
              where x.intern_id = me and x.status = 'active') then
    return 'already supervised';
  end if;
  -- Nor a second one while the first is unspent.
  if exists (select 1 from public.supervision_orders s
              where s.intern_id = me and s.status = 'paid') then
    return 'already bought';
  end if;

  select * into m from public.profiles where id = p_mentor;
  if m.id is null or not m.supervises_cases or m.status <> 'verified'
     or not ('lawyer' = any(m.roles)) then
    return 'not offered';
  end if;

  select * into cfg from public.platform_settings where id = 1;
  gross := round(coalesce(m.supervision_fee, 0) * 100)::bigint;
  if gross <= 0 then return 'nothing to pay'; end if;

  insert into public.supervision_orders (mentor_id, intern_id, fee)
  values (p_mentor, me, m.supervision_fee)
  returning id into oid;

  cut := round(gross * coalesce(cfg.sponsorship_pct, 15) / 100.0)::bigint;
  net := gross - cut;

  insert into public.payments (supervision_id, client_id, gateway, gateway_ref,
                               amount, status)
  values (oid, me, p_gateway, p_gateway_ref, gross, 'released')
  returning id into pid;

  insert into public.payouts (payment_id, party, profile_id, amount, pct)
  values (pid, 'platform', null, cut, coalesce(cfg.sponsorship_pct, 15)),
         (pid, 'lawyer', p_mentor, net, 100 - coalesce(cfg.sponsorship_pct, 15));

  return 'bought';
exception
  when unique_violation then return 'already paid';
end $$;
revoke all on function public.buy_supervision(uuid, text, text) from public;
grant execute on function public.buy_supervision(uuid, text, text) to authenticated;

/** Who may sign for this trainee right now: their standing mentor, or the
    lawyer whose single-case supervision they have bought and not yet spent.
    One question, one place — the screening guard and the page both ask it. */
create or replace function public.signer_for(intern uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.mentor_id from public.mentorships m
      where m.intern_id = intern and m.status = 'active'
      order by m.started_at desc nulls last limit 1),
    (select s.mentor_id from public.supervision_orders s
      where s.intern_id = intern and s.status = 'paid'
      order by s.paid_at limit 1)
  )
$$;
revoke all on function public.signer_for(uuid) from public;
grant execute on function public.signer_for(uuid) to anon, authenticated;

-- The gate widens; the rule does not. A screening still cannot be taken by a
-- trainee nobody is answerable for — there is simply a second way to have
-- somebody answerable, and taking the case spends it.
create or replace function public.guard_screening() returns trigger
language plpgsql security definer set search_path = public as $$
declare signer uuid;
begin
  if new.type_id <> 'free_screening' then return new; end if;

  -- A screening is free. Not "usually free" — free.
  if coalesce(new.price, 0) <> 0 then
    raise exception 'a screening is free' using errcode = 'P0001';
  end if;

  if new.assigned_to is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  signer := public.signer_for(new.assigned_to);
  if signer is null then
    raise exception 'a screening needs a supervising lawyer behind the trainee'
      using errcode = 'P0001';
  end if;

  -- The lawyer on the request is the one who answers for the advice. Set
  -- here rather than chosen in a form, because it is a fact about who is
  -- supervising, not a field somebody fills in.
  new.lawyer_id := signer;
  return new;
end $$;

-- Spending it: the order is attached to the case it paid for, once.
create or replace function public.spend_supervision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type_id <> 'free_screening' or new.assigned_to is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  -- A standing mentorship covers it and nothing is spent.
  if exists (select 1 from public.mentorships m
              where m.intern_id = new.assigned_to and m.status = 'active') then
    return new;
  end if;

  update public.supervision_orders
     set status = 'used', used_at = now(), request_id = new.id
   where id = (select s.id from public.supervision_orders s
                where s.intern_id = new.assigned_to and s.status = 'paid'
                order by s.paid_at limit 1);
  return new;
end $$;

drop trigger if exists requests_spend_supervision on public.requests;
create trigger requests_spend_supervision after insert or update of assigned_to
  on public.requests for each row execute function public.spend_supervision();

-- ================================================= 2. an open call for a mentor

create table if not exists public.mentorship_invites (
  id         uuid primary key default gen_random_uuid(),
  intern_id  uuid not null references public.profiles on delete cascade,
  -- Named, or open to every mentor taking trainees. The second is the point:
  -- a trainee with no supervisor should not have to guess which of forty
  -- lawyers would say yes.
  mentor_id  uuid references public.profiles on delete cascade,
  note       text,
  status     text not null default 'open'
             check (status in ('open', 'taken', 'withdrawn', 'expired')),
  taken_by   uuid references public.profiles on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
alter table public.mentorship_invites enable row level security;
grant select, insert, update, delete on public.mentorship_invites to authenticated;
create index if not exists invites_open on public.mentorship_invites (status, expires_at);
create index if not exists invites_intern on public.mentorship_invites (intern_id);

-- An open call is readable by the trainee who made it, by the mentor it names,
-- by any lawyer who takes trainees when it names nobody, and by the desk. Not
-- by clients: who is looking for a supervisor is nobody's business but the
-- profession's.
drop policy if exists "an open call is for mentors to see" on public.mentorship_invites;
create policy "an open call is for mentors to see" on public.mentorship_invites for select
  using (
    auth.uid() = intern_id
    or auth.uid() = mentor_id
    or public.is_staff()
    or (mentor_id is null and exists (
          select 1 from public.profiles p
           where p.id = auth.uid() and p.is_mentor
             and 'lawyer' = any(p.roles) and p.status = 'verified'))
  );

drop policy if exists "a trainee calls for themselves" on public.mentorship_invites;
create policy "a trainee calls for themselves" on public.mentorship_invites for insert
  with check (auth.uid() = intern_id);

drop policy if exists "the caller withdraws it, the desk closes it"
  on public.mentorship_invites;
create policy "the caller withdraws it, the desk closes it"
  on public.mentorship_invites for update
  using (auth.uid() = intern_id or public.is_staff())
  with check (auth.uid() = intern_id or public.is_staff());

drop policy if exists "only the desk deletes a call" on public.mentorship_invites;
create policy "only the desk deletes a call" on public.mentorship_invites for delete
  using (public.is_staff());

-- One open call at a time, and none at all while somebody is already
-- supervising them.
create or replace function public.guard_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.mentorships m
                where m.intern_id = new.intern_id and m.status = 'active') then
      raise exception 'you already have a supervisor' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.mentorship_invites i
                where i.intern_id = new.intern_id and i.status = 'open'
                  and i.expires_at > now()) then
      raise exception 'you already have a call out' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- The platform closing a call that was answered is not the trainee
  -- rewriting their own. Recognised by a transaction-local flag rather than
  -- by auth.uid(), which is still the trainee at that moment — the same door
  -- 013 built for raise_notice(), and for the same reason: a guard with no
  -- trusted path blocks the platform along with the person.
  if current_setting('sanad.closing_invite', true) = 'on' then return new; end if;

  -- The trainee may withdraw their own call and nothing else about it.
  if auth.uid() = old.intern_id and new.status <> 'withdrawn' then
    raise exception 'a call is withdrawn, not rewritten' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists invites_guard on public.mentorship_invites;
create trigger invites_guard before insert or update on public.mentorship_invites
  for each row execute function public.guard_invite();

-- Which call a mentorship came out of, so an accepted call can be closed and
-- so "how did this start" has an answer a year later.
alter table public.mentorships add column if not exists invite_id uuid
  references public.mentorship_invites on delete set null;

create or replace function public.close_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invite_id is null then return new; end if;
  if new.status <> 'active' then return new; end if;

  perform set_config('sanad.closing_invite', 'on', true);   -- this transaction only
  update public.mentorship_invites
     set status = 'taken', taken_by = new.mentor_id
   where id = new.invite_id and status = 'open';
  perform set_config('sanad.closing_invite', 'off', true);
  return new;
end $$;

drop trigger if exists mentorships_close_invite on public.mentorships;
create trigger mentorships_close_invite after insert or update of status
  on public.mentorships for each row execute function public.close_invite();

-- ======================================================== 3. law firms

create table if not exists public.firms (
  id         uuid primary key default gen_random_uuid(),
  ref        text unique,
  owner_id   uuid not null references public.profiles on delete restrict,
  name       text not null check (length(btrim(name)) > 0),
  bio        text,
  city       text,
  address    text,
  website    text,
  logo_url   text,
  licence_no text,
  -- Approved by the desk, never by the applicant — the same rule a licence
  -- lives under, and for the same reason.
  status     text not null default 'pending'
             check (status in ('pending', 'verified', 'rejected')),
  rejected_reason text,
  created_at timestamptz not null default now()
);
alter table public.firms enable row level security;
grant select, insert, update, delete on public.firms to authenticated;
create index if not exists firms_listed on public.firms (status, city);

drop policy if exists "a verified firm is public" on public.firms;
create policy "a verified firm is public" on public.firms for select
  using (status = 'verified' or auth.uid() = owner_id or public.is_staff());

drop policy if exists "a verified lawyer opens a firm" on public.firms;
create policy "a verified lawyer opens a firm" on public.firms for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and 'lawyer' = any(p.roles)
                   and p.status = 'verified')
  );

drop policy if exists "the owner keeps the page, the desk decides" on public.firms;
create policy "the owner keeps the page, the desk decides" on public.firms for update
  using (auth.uid() = owner_id or public.is_staff())
  with check (auth.uid() = owner_id or public.is_staff());

drop policy if exists "only the desk removes a firm" on public.firms;
create policy "only the desk removes a firm" on public.firms for delete
  using (public.is_staff());

-- `status` is stripped from the owner's update path rather than trusting the
-- owner to leave it alone. Exactly what keep_status() does for a profile.
create or replace function public.keep_firm_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.status := old.status;
    new.rejected_reason := old.rejected_reason;
  end if;
  return new;
end $$;

drop trigger if exists firms_keep_status on public.firms;
create trigger firms_keep_status before update on public.firms
  for each row execute function public.keep_firm_status();

create sequence if not exists public.firm_ref_seq;
create or replace function public.stamp_firm_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null then
    new.ref := 'FRM-' || to_char(now(), 'YY') || '-' ||
               lpad(nextval('public.firm_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists firms_stamp_ref on public.firms;
create trigger firms_stamp_ref before insert on public.firms
  for each row execute function public.stamp_firm_ref();

create table if not exists public.firm_members (
  firm_id    uuid not null references public.firms on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  role       text not null default 'associate'
             check (role in ('partner', 'associate', 'trainee')),
  -- Being listed on a roster is a claim about somebody, so they confirm it.
  -- A firm cannot put a name on its page and leave it there.
  status     text not null default 'invited'
             check (status in ('invited', 'active', 'declined', 'left')),
  title      text,
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  primary key (firm_id, profile_id)
);
alter table public.firm_members enable row level security;
grant select, insert, update, delete on public.firm_members to authenticated;
create index if not exists firm_members_person on public.firm_members (profile_id, status);

drop policy if exists "the roster of a listed firm is public" on public.firm_members;
create policy "the roster of a listed firm is public" on public.firm_members for select
  using (
    (status = 'active' and exists (
        select 1 from public.firms f where f.id = firm_id and f.status = 'verified'))
    or auth.uid() = profile_id
    or public.is_staff()
    or exists (select 1 from public.firms f where f.id = firm_id and f.owner_id = auth.uid())
  );

drop policy if exists "the firm invites" on public.firm_members;
create policy "the firm invites" on public.firm_members for insert
  with check (exists (
    select 1 from public.firms f where f.id = firm_id and f.owner_id = auth.uid()));

-- The person answers for themselves; the firm may only take a name off.
drop policy if exists "you answer for your own name" on public.firm_members;
create policy "you answer for your own name" on public.firm_members for update
  using (
    auth.uid() = profile_id or public.is_staff()
    or exists (select 1 from public.firms f where f.id = firm_id and f.owner_id = auth.uid()))
  with check (
    auth.uid() = profile_id or public.is_staff()
    or exists (select 1 from public.firms f where f.id = firm_id and f.owner_id = auth.uid()));

create or replace function public.guard_firm_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'invited' then
      raise exception 'a roster is joined, not declared' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- Only the person named may accept. A firm accepting on somebody's behalf
  -- is a firm writing a claim about them.
  if new.status = 'active' and old.status <> 'active' and auth.uid() <> old.profile_id then
    raise exception 'only the person named may join' using errcode = 'P0001';
  end if;
  if new.status = 'active' and old.status <> 'active' then
    new.joined_at := coalesce(new.joined_at, now());
  end if;
  return new;
end $$;

drop trigger if exists firm_members_guard on public.firm_members;
create trigger firm_members_guard before insert or update on public.firm_members
  for each row execute function public.guard_firm_member();

drop policy if exists "the firm or the person removes a name" on public.firm_members;
create policy "the firm or the person removes a name" on public.firm_members for delete
  using (
    auth.uid() = profile_id or public.is_staff()
    or exists (select 1 from public.firms f where f.id = firm_id and f.owner_id = auth.uid()));

-- ============================================ 4. a paid place at the top

-- 006 priced one plan. There are three now, and the check constraint is the
-- only thing that decides which words are real.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('ai', 'featured', 'firm'));

-- Which firm a firm subscription is for. Null for the other two.
alter table public.subscriptions add column if not exists firm_id uuid
  references public.firms on delete cascade;

-- The unique key was (lawyer_id, plan), which is right for 'ai' and
-- 'featured' and wrong for a lawyer who owns two firms.
alter table public.subscriptions drop constraint if exists subscriptions_lawyer_id_plan_key;
create unique index if not exists subscriptions_one_per_plan
  on public.subscriptions (lawyer_id, plan) where firm_id is null;
create unique index if not exists subscriptions_one_per_firm
  on public.subscriptions (firm_id) where firm_id is not null;

/** Is this profile's place at the top paid for right now?
    Kept apart from `featured_rank`, which is the desk placing somebody
    editorially. A directory where money is the ONLY way up and one where
    money is A way up are different products, and one column could not say
    which this is. */
create or replace function public.is_paid_featured(who uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
     where s.lawyer_id = who and s.plan = 'featured' and s.active
       and (s.ends_at is null or s.ends_at > now())
  )
$$;
revoke all on function public.is_paid_featured(uuid) from public;
grant execute on function public.is_paid_featured(uuid) to anon, authenticated;

create or replace function public.firm_is_listed(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.firms x
     join public.subscriptions s on s.firm_id = x.id
     where x.id = f and x.status = 'verified' and s.plan = 'firm' and s.active
       and (s.ends_at is null or s.ends_at > now())
  )
$$;
revoke all on function public.firm_is_listed(uuid) from public;
grant execute on function public.firm_is_listed(uuid) to anon, authenticated;

-- A subscription ending takes the placement with it. Reading the placement
-- through the function above means there is nothing to expire by hand and
-- nothing to go stale — which is the whole reason it is a function.

-- ------------------------------------------------------------------ anon
do $$
declare t text;
begin
  foreach t in array array['supervision_orders', 'mentorship_invites',
                           'firms', 'firm_members']
  loop
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
