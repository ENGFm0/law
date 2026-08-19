-- ===========================================================================
--  سند | Sanad — database schema
--
--  Run this once against a fresh Supabase project (SQL editor, or
--  `supabase db push`). It creates the tables the front-end already models,
--  and the row-level security that makes the public anon key safe to ship.
--
--  The security rules are the point. Every table denies everything by default
--  and then grants the narrowest thing that works, because the browser holds a
--  key anyone can read — what stops a client reading another client's file is
--  this file, not the key.
-- ===========================================================================

-- ---------------------------------------------------------------- profiles
-- Supabase owns auth.users (email, hashed password, sessions). This table is
-- everything the platform knows on top of that. Passwords never live here.
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text not null,
  phone         text,
  city          text,
  avatar_url    text,
  roles         text[] not null default '{client}',
  active_role   text   not null default 'client',
  status        text   not null default 'pending',   -- pending | verified | rejected
  bio           text,
  -- lawyer
  licence_no    text,
  licence_authority text,
  licence_expiry    date,
  licence_file_url  text,
  specialties   text[],
  years         int,
  -- trainee
  university    text,
  level         text,
  cv_url        text,
  skills        text[],
  created_at    timestamptz not null default now(),
  constraint roles_known check (roles <@ array['client','lawyer','intern'])
);
alter table public.profiles enable row level security;

-- A profile is public: the directory, the article byline and the review list
-- all show it. Only its owner may change it.
create policy "profiles are readable"  on public.profiles for select using (true);
create policy "own profile is writable" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "own profile is insertable" on public.profiles for insert
  with check (auth.uid() = id);

-- A licence is approved by staff, never by the applicant. `status` is stripped
-- from the user-facing update path by this trigger rather than by trusting the
-- client to leave it alone.
create function public.keep_status() returns trigger language plpgsql as $$
begin
  new.status := old.status;
  return new;
end $$;
create trigger profiles_keep_status before update on public.profiles
  for each row when (auth.uid() = new.id) execute function public.keep_status();

-- ---------------------------------------------------------------- services
create table public.services (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles on delete cascade,
  type_id    text not null,                    -- call | video | written | express | drafting
  title      text,                             -- the lawyer's own wording
  meta       text,
  price      numeric(10,2) not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;
create policy "services are readable" on public.services for select using (true);
create policy "own services are writable" on public.services for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- The price band belongs in the database, not only in the form, or the rule
-- lasts exactly as long as nobody calls the API directly.
create table public.price_bands (
  type_id   text primary key,
  min_price numeric(10,2) not null,
  max_price numeric(10,2) not null
);
alter table public.price_bands enable row level security;
create policy "bands are readable" on public.price_bands for select using (true);

create function public.check_price_band() returns trigger language plpgsql as $$
declare band public.price_bands%rowtype;
begin
  select * into band from public.price_bands where type_id = new.type_id;
  if band is null then raise exception 'unknown service type %', new.type_id; end if;
  if new.price < band.min_price or new.price > band.max_price then
    raise exception 'price % is outside the band % to %',
      new.price, band.min_price, band.max_price;
  end if;
  return new;
end $$;
create trigger services_price_band before insert or update on public.services
  for each row execute function public.check_price_band();

-- ---------------------------------------------------------------- requests
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles on delete cascade,
  lawyer_id     uuid references public.profiles on delete set null,
  assigned_to   uuid references public.profiles on delete set null,  -- the trainee
  type_id       text not null,
  title         text not null,
  brief         text,
  price         numeric(10,2) not null,
  status        text not null default 'new',
  ai_assisted   boolean not null default false,
  body          text,                      -- the deliverable
  intern_share  int check (intern_share between 30 and 100),
  hours         int default 3,
  created_at    timestamptz not null default now()
);
alter table public.requests enable row level security;

-- Only the three people involved may see a request. This is the rule the whole
-- privacy promise rests on, so it is stated once and reused.
create function public.is_party(r public.requests) returns boolean
language sql stable as $$
  select auth.uid() in (r.client_id, r.lawyer_id, r.assigned_to)
$$;

create policy "parties read their requests" on public.requests for select
  using (public.is_party(requests));
create policy "a client opens their own" on public.requests for insert
  with check (auth.uid() = client_id);
create policy "the professionals update it" on public.requests for update
  using (auth.uid() in (lawyer_id, assigned_to));

-- Trainees applying for a task a lawyer opened to all of them.
create table public.applications (
  request_id uuid not null references public.requests on delete cascade,
  intern_id  uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, intern_id)
);
alter table public.applications enable row level security;
create policy "trainees see open tasks" on public.applications for select
  using (auth.uid() = intern_id or auth.uid() in (
    select lawyer_id from public.requests where id = request_id));
create policy "a trainee applies for themselves" on public.applications for insert
  with check (auth.uid() = intern_id);

-- What a trainee is paid, when the two have settled it in advance.
create table public.agreements (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references public.profiles on delete cascade,
  intern_id  uuid not null references public.profiles on delete cascade,
  kind       text not null check (kind in ('cases','monthly','yearly')),
  amount     numeric(10,2) not null check (amount > 0),
  cases      int,
  started_at timestamptz not null default now(),
  unique (lawyer_id, intern_id)
);
alter table public.agreements enable row level security;
create policy "only the two parties" on public.agreements for select
  using (auth.uid() in (lawyer_id, intern_id));
create policy "the lawyer sets the terms" on public.agreements for all
  using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id);

-- ------------------------------------------------------- articles & reviews
create table public.articles (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles on delete cascade,
  signed_by  uuid references public.profiles on delete set null,
  category   text,
  title      text not null,
  excerpt    text,
  body       text not null,
  cover_url  text,
  status     text not null default 'pending',   -- pending | published
  created_at timestamptz not null default now()
);
alter table public.articles enable row level security;
create policy "published articles are public" on public.articles for select
  using (status = 'published' or auth.uid() = author_id
         or 'lawyer' = any((select roles from public.profiles where id = auth.uid())));
create policy "authors write their own" on public.articles for insert
  with check (auth.uid() = author_id);
create policy "authors edit, lawyers sign" on public.articles for update
  using (auth.uid() = author_id
         or 'lawyer' = any((select roles from public.profiles where id = auth.uid())));

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "comments are public" on public.comments for select using (true);
create policy "sign your own comment" on public.comments for insert
  with check (auth.uid() = author_id);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.profiles on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  request_id uuid references public.requests on delete set null,
  rating     int not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (request_id, author_id)          -- one rating per request
);
alter table public.reviews enable row level security;
create policy "reviews are public" on public.reviews for select using (true);
-- Only the client of a delivered request may rate it. Ratings decide the
-- ranking, so an unenforced rule here is an open invitation.
create policy "rate only what you paid for" on public.reviews for insert
  with check (auth.uid() = author_id and exists (
    select 1 from public.requests r
    where r.id = request_id and r.client_id = auth.uid()
      and r.status in ('delivered','completed')));

create table public.endorsements (
  id         uuid primary key default gen_random_uuid(),
  intern_id  uuid not null references public.profiles on delete cascade,
  lawyer_id  uuid not null references public.profiles on delete cascade,
  hours      int not null,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.endorsements enable row level security;
create policy "certificates are public" on public.endorsements for select using (true);
create policy "only a supervising lawyer signs" on public.endorsements for insert
  with check (auth.uid() = lawyer_id and exists (
    select 1 from public.requests r
    where r.lawyer_id = auth.uid() and r.assigned_to = intern_id));

-- --------------------------------------------------------------- the bands
insert into public.price_bands (type_id, min_price, max_price) values
  ('call', 80, 400), ('video', 150, 800), ('written', 50, 300),
  ('express', 60, 250), ('drafting', 300, 2000)
on conflict (type_id) do nothing;
