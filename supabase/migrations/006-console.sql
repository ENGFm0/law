-- ===========================================================================
--  006 — everything the staff console needs to actually run the place
--
--  Adds: announcements, lawyer subscriptions, operating costs, partners,
--  featured placement, gateway fee rates, and a way for staff to edit the
--  price bands. Plus the one-line fix that made approving somebody stick.
--
--  The shape of the money here is worth stating once, because the console
--  reports it and reporting it wrongly is worse than not reporting it:
--
--      what the client paid
--        − the trainee's share      (of the task, floor 30%)
--        − the platform commission  (of the task, capped 10%)
--        = the lawyer's side
--
--      the platform commission
--        − the gateway's cut        (of the WHOLE transaction, not of us)
--        − operating costs          (prorated to the period being shown)
--        = what there is to divide between partners
-- ===========================================================================

-- ----------------------------------------------------- featured placement
-- A lawyer the platform is putting in front of people. Deliberately a number
-- and not a flag: "top of the list" is an ordering, and two lawyers both
-- flagged as first is not an answer.
alter table public.profiles add column if not exists featured_rank int;
alter table public.profiles add column if not exists featured_until timestamptz;

-- ------------------------------------------------------- gateway fee rates
-- What the payment gateway takes. Kept as settings rather than constants
-- because they are negotiated, they differ by card scheme, and the console
-- reports profit that is wrong the moment they are stale.
alter table public.platform_settings add column if not exists mada_pct   numeric(5,3) not null default 1.5;
alter table public.platform_settings add column if not exists mada_fixed numeric(6,2) not null default 1.00;
alter table public.platform_settings add column if not exists card_pct   numeric(5,3) not null default 2.2;
alter table public.platform_settings add column if not exists card_fixed numeric(6,2) not null default 1.00;
-- Roughly what share of payments come through mada rather than a credit card.
-- An estimate, and labelled as one in the console.
alter table public.platform_settings add column if not exists mada_share_pct int not null default 70;
alter table public.platform_settings add column if not exists ai_price numeric(10,2) not null default 199;

-- --------------------------------------------------------- the price bands
-- They already existed and only staff may move them. Without this the console
-- can show a band and not change it.
drop policy if exists "staff set the bands" on public.price_bands;
create policy "staff set the bands" on public.price_bands for all
  using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on public.price_bands to authenticated;

-- ---------------------------------------------------------- announcements
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(btrim(title)) > 0),
  body       text,
  link       text,
  audience   text not null default 'all'
             check (audience in ('all','client','lawyer','intern')),
  active     boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
grant select, insert, update, delete on public.announcements to authenticated;
grant select on public.announcements to anon;

-- Everyone reads what is live; only staff decide what that is.
drop policy if exists "live announcements are public" on public.announcements;
create policy "live announcements are public" on public.announcements for select
  using (active or public.is_staff());
drop policy if exists "staff write announcements" on public.announcements;
create policy "staff write announcements" on public.announcements for all
  using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------- subscriptions
-- The drafting workspace, sold to lawyers rather than given away. A lawyer
-- reads their own; staff read and grant all of them.
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references public.profiles on delete cascade,
  plan       text not null default 'ai' check (plan in ('ai')),
  price      numeric(10,2) not null default 0,
  started_at timestamptz not null default now(),
  ends_at    timestamptz,
  active     boolean not null default true,
  created_by uuid references public.profiles,
  unique (lawyer_id, plan)
);
alter table public.subscriptions enable row level security;
grant select, insert, update, delete on public.subscriptions to authenticated;

drop policy if exists "your own subscription, or staff" on public.subscriptions;
create policy "your own subscription, or staff" on public.subscriptions for select
  using (auth.uid() = lawyer_id or public.is_staff());
drop policy if exists "staff grant subscriptions" on public.subscriptions;
create policy "staff grant subscriptions" on public.subscriptions for all
  using (public.is_staff()) with check (public.is_staff());

-- -------------------------------------------------------- operating costs
-- What the platform spends, and how often. `period` is what makes a yearly
-- licence and a monthly server comparable in one figure.
create table if not exists public.operating_costs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  amount     numeric(12,2) not null check (amount >= 0),
  period     text not null default 'monthly'
             check (period in ('once','monthly','quarterly','yearly')),
  starts_at  date,
  ends_at    date,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.operating_costs enable row level security;
grant select, insert, update, delete on public.operating_costs to authenticated;

-- What the platform spends is nobody's business but the platform's.
drop policy if exists "staff only, costs" on public.operating_costs;
create policy "staff only, costs" on public.operating_costs for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------- partners
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  share_pct  numeric(5,2) not null check (share_pct >= 0 and share_pct <= 100),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
grant select, insert, update, delete on public.partners to authenticated;

drop policy if exists "staff only, partners" on public.partners;
create policy "staff only, partners" on public.partners for all
  using (public.is_staff()) with check (public.is_staff());
