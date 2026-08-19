-- ===========================================================================
--  003 — the staff role, disputes, the money ledger and the platform settings
--
--  Adds the tables behind US-003 (licence approval), US-020 (payments) and
--  US-022 (acceptance and disputes).
--
--  The rule that shapes most of this file: the person who decides must not be
--  a party, and the record of what was decided must not be editable by anyone
--  — including the person who wrote it. Where the browser build enforces that
--  by hiding a button, this file enforces it by refusing the write.
-- ===========================================================================

-- ------------------------------------------------------------------- staff
-- Staff is granted on the row and can never be taken. The check constraint is
-- widened rather than the role being handed out through the sign-up path.
alter table public.profiles drop constraint if exists roles_known;
alter table public.profiles add constraint roles_known
  check (roles <@ array['client','lawyer','intern','staff']);

-- Whether a lawyer charges VAT is a fact about them, not about the platform,
-- and it changes the shape of the invoice — so it lives on the profile.
alter table public.profiles add column if not exists vat_registered boolean not null default false;
alter table public.profiles add column if not exists vat_number text;
alter table public.profiles add column if not exists rejected_reason text;

create function public.is_staff() returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and 'staff' = any(p.roles)
  )
$$;

-- Staff is granted, never taken. Without this a user could add 'staff' to
-- their own roles through the ordinary profile-update path and then approve
-- licences, decide disputes and set the commission — the whole desk, from a
-- browser holding a publishable key. The status trigger pinned `status` and
-- left `roles` open; this closes it.
create or replace function public.guard_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if ('staff' = any(new.roles)) and not ('staff' = any(old.roles)) then
    -- auth.uid() is null on the trusted server path (seeding, migrations,
    -- the service key). A request carrying a user is held to the rule.
    if auth.uid() is not null and (not public.is_staff() or auth.uid() = new.id) then
      raise exception 'the staff role is granted, not taken';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_roles before update on public.profiles
  for each row execute function public.guard_roles();

-- Staff may set an account's status; nobody else may, including its owner.
-- The existing keep_status trigger pins it on the ordinary update path, so
-- this policy is what lets the desk work at all.
create policy "staff may set account status" on public.profiles for update
  using (public.is_staff()) with check (public.is_staff());

-- -------------------------------------------------------- platform settings
-- One row. Commission is capped in the database, not only in the form, and
-- VAT ships off so a platform below the registration threshold charges none.
create table public.platform_settings (
  id             int primary key default 1,
  commission_pct int  not null default 10,
  vat_enabled    boolean not null default false,
  vat_pct        int  not null default 15,
  updated_at     timestamptz not null default now(),
  constraint one_row check (id = 1),
  constraint commission_capped check (commission_pct between 0 and 10),
  constraint vat_sane check (vat_pct between 0 and 100)
);
insert into public.platform_settings (id) values (1) on conflict do nothing;
alter table public.platform_settings enable row level security;

create policy "settings are readable" on public.platform_settings for select using (true);
create policy "only staff change settings" on public.platform_settings for update
  using (public.is_staff()) with check (public.is_staff());

-- --------------------------------------------------------------- deliveries
-- The acceptance window is derived from this stamp rather than stored as a
-- deadline: a deadline written down is a deadline that drifts.
alter table public.requests add column if not exists delivered_at timestamptz;
alter table public.requests add column if not exists accepted_at  timestamptz;
alter table public.requests add column if not exists revisions    int not null default 0;
alter table public.requests add column if not exists revision_note text;
alter table public.requests add column if not exists intern_share int;

-- One revision, and the count only ever goes up.
create function public.guard_revisions() returns trigger language plpgsql as $$
begin
  if new.revisions < old.revisions then
    raise exception 'a revision cannot be taken back';
  end if;
  if new.revisions > 1 then
    raise exception 'one revision per request';
  end if;
  return new;
end $$;
create trigger requests_guard_revisions before update on public.requests
  for each row execute function public.guard_revisions();

-- ---------------------------------------------------------------- disputes
create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests on delete restrict,
  by_id       uuid not null references public.profiles,
  reason      text not null check (length(btrim(reason)) > 0),
  status      text not null default 'open' check (status in ('open','resolved')),
  outcome     text check (outcome in ('release','refund','split')),
  lawyer_pct  int  check (lawyer_pct between 0 and 100),
  resolution_reason text,
  resolved_by uuid references public.profiles,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  -- One per request: a second bite would restart the freeze indefinitely.
  unique (request_id),
  -- A split with no share, or a ruling with no reason, is not reviewable.
  constraint split_has_a_share check (outcome is distinct from 'split' or lawyer_pct is not null),
  constraint ruling_has_a_reason check (
    status <> 'resolved' or length(btrim(coalesce(resolution_reason,''))) > 0)
);
alter table public.disputes enable row level security;

-- The parties to the request and the staff who decide — nobody else.
create policy "parties and staff read disputes" on public.disputes for select
  using (public.is_staff() or exists (
    select 1 from public.requests r where r.id = request_id and public.is_party(r)));

-- Only the client may refuse a delivery, and only one that was delivered.
create policy "the client may refuse a delivery" on public.disputes for insert
  with check (
    auth.uid() = by_id and exists (
      select 1 from public.requests r
      where r.id = request_id and r.client_id = auth.uid()
        and r.delivered_at is not null and r.accepted_at is null));

create policy "only staff decide" on public.disputes for update
  using (public.is_staff()) with check (public.is_staff());

-- Not even staff delete one. A dispute closes by changing state.
create function public.guard_dispute() returns trigger language plpgsql as $$
begin
  if old.status = 'resolved' then
    raise exception 'a dispute is decided once';
  end if;
  -- Whoever decides must not be a party to it.
  if new.resolved_by is not null and exists (
      select 1 from public.requests r
      where r.id = new.request_id
        and new.resolved_by in (r.client_id, r.lawyer_id, r.assigned_to)) then
    raise exception 'a party cannot decide their own dispute';
  end if;
  return new;
end $$;
create trigger disputes_guard before update on public.disputes
  for each row execute function public.guard_dispute();

-- ---------------------------------------------------------------- payments
-- Held, then released — never transferred on the strength of a promise. The
-- gateway reference is unique so the same notification cannot be acted on
-- twice, whichever gateway is in front of it.
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests on delete restrict,
  client_id    uuid not null references public.profiles,
  gateway      text not null,
  gateway_ref  text not null,
  amount       bigint not null check (amount > 0),   -- halalas
  service_vat  bigint not null default 0,
  currency     text not null default 'SAR' check (currency = 'SAR'),
  status       text not null default 'held'
               check (status in ('held','released','refunded','frozen')),
  created_at   timestamptz not null default now(),
  unique (gateway, gateway_ref)
);
alter table public.payments enable row level security;

-- Every share of every release, kept as its own row so the parts can always
-- be added back up to the whole and shown to the person they belong to.
create table public.payouts (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments on delete restrict,
  party       text not null check (party in ('platform','lawyer','intern','client')),
  profile_id  uuid references public.profiles,
  amount      bigint not null,          -- halalas; negative is a refund
  vat         bigint not null default 0,
  pct         int,
  created_at  timestamptz not null default now()
);
alter table public.payouts enable row level security;

create policy "you see your own money" on public.payments for select
  using (public.is_staff() or exists (
    select 1 from public.requests r where r.id = request_id and public.is_party(r)));
create policy "you see your own share" on public.payouts for select
  using (public.is_staff() or auth.uid() = profile_id);

-- No policy grants insert, update or delete on either table to anyone. Money
-- moves through a trusted server path with the service key, never from a
-- browser holding a publishable one — and a financial record is never edited.

-- ------------------------------------------------------------------- audit
-- Append only, and readable by staff alone. A decision nobody can be asked
-- about later is not a decision.
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  by_id      uuid not null references public.profiles,
  target_id  uuid,
  subject    text,
  reason     text,
  at         timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create policy "staff read the record" on public.audit_log for select
  using (public.is_staff());
create policy "staff write to the record" on public.audit_log for insert
  with check (public.is_staff() and auth.uid() = by_id);

create function public.audit_is_final() returns trigger language plpgsql as $$
begin
  raise exception 'the record is appended to, never changed';
end $$;
create trigger audit_no_update before update or delete on public.audit_log
  for each row execute function public.audit_is_final();
