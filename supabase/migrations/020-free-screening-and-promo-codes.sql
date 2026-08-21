-- ===========================================================================
--  020 — the free screening, the sponsorship that pays for it, and discounts
--
--  Three things, and one thread running through all of them: money that moves
--  without a request behind it, which this schema has never had to hold.
--
--  1. THE SCREENING. A free first look at a case, done by a trainee under a
--     lawyer's supervision. Free is the whole point — it is how somebody with
--     a problem finds out whether they have a case at all — so the platform
--     earns nothing on it and the trainee earns nothing on it either. What it
--     costs is the supervising lawyer's time, and (2) is who pays for that.
--
--     Who may take one is not a matter of policy but of competence: a trainee
--     with nobody checking their work is a trainee giving legal advice, which
--     is the one thing this platform must never let happen by accident. So
--     the rule is written where it cannot be gone around — a screening may
--     only be claimed by a trainee with a live mentorship, and claiming it
--     puts their mentor on the request as the lawyer answerable for it.
--
--  2. THE SPONSORSHIP. A trainee with no supervisor pays monthly for one. The
--     platform takes its cut and the rest queues to the lawyer — which needs
--     a payment with no request behind it, and `payments.request_id` was NOT
--     NULL. Relaxed here with a constraint saying exactly one of the two is
--     set, so a row can never be about both and never about neither.
--
--     Neither table takes writes from a browser (003 left them with no insert
--     policy at all, deliberately). The charge is a definer function with the
--     checks inside it, so the rule travels with the money rather than with
--     whoever called it.
--
--  3. THE DISCOUNT. A promo code reduces what the client pays and takes it
--     out of the platform's commission — never out of the lawyer's or the
--     trainee's share. That is not a preference, it is the only version of a
--     discount that is honest: a platform that runs a sale and bills it to
--     the people doing the work is not running a sale.
--
--     Which is why the discount is capped at the commission. If the code
--     would give away more than the platform earns on that order, the client
--     gets the commission and not a riyal more, and validate_promo_code()
--     says so in the same breath rather than promising a number the ledger
--     cannot honour.
-- ===========================================================================

-- ================================================== 1. the free screening

insert into public.service_types (id, title_ar, title_en, meta_ar, meta_en, icon, channels, sort, active)
values ('free_screening',
        'جلسة فرز وتحليل قضية',
        'Case screening and analysis',
        'نظرة أولى مجانية: هل لديك قضية، وما الطريق أمامها.',
        'A free first look: whether you have a case, and what the road looks like.',
        'search', '{text,voice}', 5, true)
on conflict (id) do update
  set title_ar = excluded.title_ar, title_en = excluded.title_en,
      meta_ar  = excluded.meta_ar,  meta_en  = excluded.meta_en,
      icon = excluded.icon, sort = excluded.sort, active = true;

-- Free, and pinned to free at both ends so nobody quietly starts charging for
-- the thing the platform advertises as costing nothing.
insert into public.price_bands (type_id, min_price, max_price)
values ('free_screening', 0, 0)
on conflict (type_id) do update set min_price = 0, max_price = 0;

-- A screening carries no price and takes no commission. Said as a column so
-- every query that sums money can ask instead of knowing.
alter table public.requests add column if not exists is_screening boolean
  not null generated always as (type_id = 'free_screening') stored;

-- Claiming a screening is the moment the rule bites: only a trainee with a
-- live mentorship, and their mentor becomes the lawyer answerable for it.
create or replace function public.guard_screening() returns trigger
language plpgsql security definer set search_path = public as $$
declare mentor uuid;
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

  select m.mentor_id into mentor
    from public.mentorships m
   where m.intern_id = new.assigned_to and m.status = 'active'
   order by m.started_at desc nulls last
   limit 1;

  if mentor is null then
    raise exception 'a screening needs a supervising lawyer behind the trainee'
      using errcode = 'P0001';
  end if;

  -- The lawyer on the request is the one who answers for the advice. Set
  -- here rather than chosen in a form, because it is a fact about who is
  -- supervising, not a field somebody fills in.
  new.lawyer_id := mentor;
  return new;
end $$;

drop trigger if exists requests_guard_screening on public.requests;
create trigger requests_guard_screening before insert or update on public.requests
  for each row execute function public.guard_screening();

-- A free screening neither blocks a paid request nor is blocked by one: they
-- are different commitments and 017's rule is about somebody juggling four
-- live cases. Two open screenings are still two too many.
create or replace function public.guard_one_open_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare blocking public.requests%rowtype;
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if new.client_id <> auth.uid() then return new; end if;

  select * into blocking from public.requests r
   where r.client_id = new.client_id
     and r.id <> new.id
     -- Like for like: a screening is weighed against screenings, paid work
     -- against paid work.
     and (r.type_id = 'free_screening') = (new.type_id = 'free_screening')
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

-- ================================================== 2. the sponsorship

alter table public.platform_settings
  add column if not exists sponsorship_pct int not null default 15;
alter table public.platform_settings
  drop constraint if exists sponsorship_capped;
alter table public.platform_settings
  add constraint sponsorship_capped check (sponsorship_pct between 0 and 20);
alter table public.platform_settings
  add column if not exists sponsorship_min numeric(10,2) not null default 50;
alter table public.platform_settings
  add column if not exists sponsorship_max numeric(10,2) not null default 100;

-- What a lawyer asks per month, inside the band the platform publishes. The
-- band is checked here rather than in the form for the same reason every
-- other band on this project is.
create or replace function public.guard_mentorship_fee() returns trigger
language plpgsql security definer set search_path = public as $$
declare lo numeric; hi numeric;
begin
  if new.mentorship_fee is null or not new.is_mentor then return new; end if;
  select sponsorship_min, sponsorship_max into lo, hi
    from public.platform_settings where id = 1;
  if lo is null then return new; end if;
  if new.mentorship_fee < lo or new.mentorship_fee > hi then
    raise exception 'a monthly sponsorship is between % and %', lo, hi
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_fee on public.profiles;
create trigger profiles_guard_fee before insert or update of mentorship_fee, is_mentor
  on public.profiles for each row execute function public.guard_mentorship_fee();

-- How far this month's sponsorship is paid up.
alter table public.mentorships add column if not exists paid_until timestamptz;

-- Money with no request behind it. Exactly one of the two, never both and
-- never neither — a payment that is about nothing is a payment nobody can
-- reconcile.
alter table public.payments alter column request_id drop not null;
alter table public.payments add column if not exists mentorship_id uuid
  references public.mentorships on delete restrict;
alter table public.payments drop constraint if exists payment_is_about_one_thing;
alter table public.payments add constraint payment_is_about_one_thing check (
  (request_id is not null and mentorship_id is null)
  or (request_id is null and mentorship_id is not null)
);

-- 003 gave payments a select policy that reads through the request. A row
-- with no request would fall out of every audience, so the two sides of a
-- sponsorship are named here.
drop policy if exists "you see your own money" on public.payments;
create policy "you see your own money" on public.payments for select
  using (
    public.is_staff()
    or (request_id is not null and exists (
          select 1 from public.requests r where r.id = request_id and public.is_party(r)))
    or (mentorship_id is not null and public.in_mentorship(mentorship_id))
  );

-- The charge itself. Neither payments nor payouts takes an insert from a
-- browser, and that stays true: this runs as the owner, with every check
-- inside it, and returns a word the page can act on rather than a stack trace.
create or replace function public.charge_sponsorship(
  p_mentorship uuid, p_gateway text, p_gateway_ref text, p_months int default 1)
returns text
language plpgsql security definer set search_path = public as $$
declare
  m public.mentorships%rowtype;
  cfg public.platform_settings%rowtype;
  gross bigint; cut bigint; net bigint; pid uuid; months int;
begin
  if auth.uid() is null then return 'not signed in'; end if;
  months := greatest(1, least(12, coalesce(p_months, 1)));

  select * into m from public.mentorships where id = p_mentorship;
  if m.id is null then return 'no such mentorship'; end if;
  -- The trainee pays for their own supervision. Nobody pays for somebody
  -- else's, and nobody bills a trainee for it either.
  if auth.uid() <> m.intern_id then return 'not yours'; end if;
  if m.status <> 'active' then return 'not active'; end if;

  select * into cfg from public.platform_settings where id = 1;

  -- Halalas from here down, like every other amount in this schema.
  gross := round(m.fee * 100)::bigint * months;
  if gross <= 0 then return 'nothing to pay'; end if;

  cut := round(gross * coalesce(cfg.sponsorship_pct, 15) / 100.0)::bigint;
  net := gross - cut;

  insert into public.payments (mentorship_id, client_id, gateway, gateway_ref,
                               amount, status)
  values (p_mentorship, m.intern_id, p_gateway, p_gateway_ref, gross, 'released')
  returning id into pid;

  insert into public.payouts (payment_id, party, profile_id, amount, pct)
  values (pid, 'platform', null, cut, coalesce(cfg.sponsorship_pct, 15)),
         (pid, 'lawyer', m.mentor_id, net, 100 - coalesce(cfg.sponsorship_pct, 15));

  -- Paid up from wherever it was already paid to, so two months bought in one
  -- go do not overlap into one.
  update public.mentorships
     set paid_until = greatest(coalesce(paid_until, now()), now())
                      + (months || ' months')::interval
   where id = p_mentorship;

  return 'paid';
exception
  when unique_violation then return 'already paid';   -- (gateway, gateway_ref)
end $$;
revoke all on function public.charge_sponsorship(uuid, text, text, int) from public;
grant execute on function public.charge_sponsorship(uuid, text, text, int) to authenticated;

-- Is this supervision paid up right now? One question, one place.
create or replace function public.sponsorship_current(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships x
     where x.id = m and x.status = 'active'
       and (x.fee = 0 or (x.paid_until is not null and x.paid_until > now()))
  )
$$;
revoke all on function public.sponsorship_current(uuid) from public;
grant execute on function public.sponsorship_current(uuid) to authenticated;

-- ================================================== 3. the promo codes

create table if not exists public.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code = upper(btrim(code)) and length(btrim(code)) between 3 and 24),
  label        text,
  discount_pct int not null check (discount_pct between 1 and 100),
  -- The ceiling, in halalas, like every other amount here. Null is no ceiling
  -- beyond the commission itself, which always caps it.
  max_discount bigint check (max_discount is null or max_discount > 0),
  usage_limit  int check (usage_limit is null or usage_limit > 0),
  used_count   int not null default 0 check (used_count >= 0),
  -- A code cut for one person: the conversion offer after a free screening is
  -- issued this way, so it cannot be passed around.
  client_id    uuid references public.profiles on delete cascade,
  type_id      text,                     -- limited to one kind of work, or all
  expires_at   timestamptz,
  active       boolean not null default true,
  created_by   uuid references public.profiles,
  created_at   timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
grant select, insert, update, delete on public.promo_codes to authenticated;
create index if not exists promo_codes_live on public.promo_codes (active, expires_at);
create index if not exists promo_codes_personal on public.promo_codes (client_id) where client_id is not null;

-- A campaign code is public in the sense that it is printed on things; what
-- is not public is the list of every code the platform has ever issued, and
-- least of all somebody's personal one. So: the desk sees all of them, and a
-- person sees the one cut for them.
drop policy if exists "your own code, or the desk's list" on public.promo_codes;
create policy "your own code, or the desk's list" on public.promo_codes for select
  using (public.is_staff() or auth.uid() = client_id);

drop policy if exists "the desk issues codes" on public.promo_codes;
create policy "the desk issues codes" on public.promo_codes for all
  using (public.is_staff()) with check (public.is_staff());

-- Who used what. `used_count` on its own is a number nobody can check and a
-- race nobody can lose safely; this is the row that makes it true, and the
-- unique key is what stops one person spending a code twice.
create table if not exists public.promo_redemptions (
  id         uuid primary key default gen_random_uuid(),
  promo_id   uuid not null references public.promo_codes on delete cascade,
  client_id  uuid not null references public.profiles on delete cascade,
  request_id uuid references public.requests on delete set null,
  amount     bigint not null default 0,     -- halalas actually taken off
  at         timestamptz not null default now(),
  unique (promo_id, client_id)
);
alter table public.promo_redemptions enable row level security;
grant select on public.promo_redemptions to authenticated;
create index if not exists promo_redemptions_code on public.promo_redemptions (promo_id);

drop policy if exists "your own redemptions, or the desk's" on public.promo_redemptions;
create policy "your own redemptions, or the desk's" on public.promo_redemptions for select
  using (public.is_staff() or auth.uid() = client_id);

-- No insert policy: a redemption is written by redeem_promo_code() below and
-- by nothing else. A discount somebody can write for themselves is not a
-- discount, it is a price list.

-- What a code is worth on this order, and why it is not worth more. Returns a
-- row rather than a number so the page can say the actual reason instead of
-- showing a disabled button.
alter table public.requests add column if not exists promo_code text;
alter table public.requests add column if not exists promo_discount bigint
  not null default 0 check (promo_discount >= 0);   -- halalas

create or replace function public.validate_promo_code(p_code text, p_gross bigint,
                                                      p_type text default null)
returns table (ok boolean, reason text, discount bigint, pct int)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.promo_codes%rowtype;
  cfg public.platform_settings%rowtype;
  raw bigint; commission bigint;
begin
  select * into c from public.promo_codes where code = upper(btrim(p_code));
  if c.id is null then
    return query select false, 'unknown', 0::bigint, 0; return;
  end if;
  if not c.active then
    return query select false, 'withdrawn', 0::bigint, 0; return;
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return query select false, 'expired', 0::bigint, 0; return;
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select false, 'used up', 0::bigint, 0; return;
  end if;
  if c.client_id is not null and c.client_id <> auth.uid() then
    return query select false, 'not yours', 0::bigint, 0; return;
  end if;
  if c.type_id is not null and p_type is not null and c.type_id <> p_type then
    return query select false, 'wrong service', 0::bigint, 0; return;
  end if;
  if exists (select 1 from public.promo_redemptions r
              where r.promo_id = c.id and r.client_id = auth.uid()) then
    return query select false, 'already used', 0::bigint, 0; return;
  end if;
  if coalesce(p_gross, 0) <= 0 then
    return query select false, 'nothing to discount', 0::bigint, 0; return;
  end if;

  raw := round(p_gross * c.discount_pct / 100.0)::bigint;
  if c.max_discount is not null then raw := least(raw, c.max_discount); end if;

  -- The lawyer's and the trainee's shares are computed off the price and are
  -- not touched by any of this. What is left to give away is the platform's
  -- own cut, so that is the ceiling — anything past it would be the platform
  -- billing its sale to the people doing the work.
  select * into cfg from public.platform_settings where id = 1;
  commission := round(p_gross * coalesce(cfg.commission_pct, 10) / 100.0)::bigint;
  if raw > commission then
    return query select true, 'capped at our commission', commission, c.discount_pct;
    return;
  end if;

  return query select true, 'ok', raw, c.discount_pct;
end $$;
revoke all on function public.validate_promo_code(text, bigint, text) from public;
grant execute on function public.validate_promo_code(text, bigint, text) to authenticated;

-- Spending it. Separate from validating it because one is a question and the
-- other is a fact, and because the counter has to move under a lock.
create or replace function public.redeem_promo_code(p_code text, p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  c public.promo_codes%rowtype;
  r public.requests%rowtype;
  v record; gross bigint;
begin
  if auth.uid() is null then return 'not signed in'; end if;

  select * into r from public.requests where id = p_request;
  if r.id is null then return 'no such request'; end if;
  if r.client_id <> auth.uid() then return 'not yours'; end if;
  if r.status not in ('new', 'quoting', 'assigned', 'scheduled') then
    return 'too late';
  end if;
  if coalesce(r.promo_discount, 0) > 0 then return 'already discounted'; end if;

  gross := round(r.price * 100)::bigint;
  select * into v from public.validate_promo_code(p_code, gross, r.type_id);
  if not v.ok then return v.reason; end if;

  select * into c from public.promo_codes where code = upper(btrim(p_code)) for update;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return 'used up';
  end if;

  insert into public.promo_redemptions (promo_id, client_id, request_id, amount)
  values (c.id, auth.uid(), p_request, v.discount);

  update public.promo_codes set used_count = used_count + 1 where id = c.id;
  update public.requests
     set promo_code = c.code, promo_discount = v.discount
   where id = p_request;

  return 'applied';
exception
  when unique_violation then return 'already used';
end $$;
revoke all on function public.redeem_promo_code(text, uuid) from public;
grant execute on function public.redeem_promo_code(text, uuid) to authenticated;

-- ------------------------------------------------- the conversion offer
-- A screening that ends with "yes, you have a case" is the one moment the
-- client is ready to hear what the full thing costs. The offer is a real code
-- cut for that person, not a banner: it expires, it is one use, and the desk
-- can see every one that was issued.
create or replace function public.offer_conversion() returns trigger
language plpgsql security definer set search_path = public as $$
-- Not named `code`: a PL/pgSQL variable of that name shadows the column in
-- `on conflict (code)`, and Postgres refuses the whole statement — which
-- would have made completing a screening impossible rather than merely
-- skipping the offer.
declare offer_code text;
begin
  if new.type_id <> 'free_screening' then return new; end if;
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  if new.lawyer_id is null then return new; end if;

  offer_code := 'SND' || upper(substr(replace(new.id::text, '-', ''), 1, 8));

  insert into public.promo_codes
    (code, label, discount_pct, client_id, expires_at, usage_limit, created_by)
  values (offer_code, 'تحويل جلسة فرز إلى خدمة كاملة', 10, new.client_id,
          now() + interval '30 days', 1, new.lawyer_id)
  on conflict (code) do nothing;

  insert into public.notifications (to_id, type, ref)
  values (new.client_id, 'conversion_offer', new.id::text)
  on conflict (to_id, type, ref) do nothing;

  return new;
end $$;

drop trigger if exists requests_offer_conversion on public.requests;
create trigger requests_offer_conversion after update of status on public.requests
  for each row execute function public.offer_conversion();

-- ------------------------------------------------------------------ anon
do $$
declare t text;
begin
  foreach t in array array['promo_codes', 'promo_redemptions'] loop
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
