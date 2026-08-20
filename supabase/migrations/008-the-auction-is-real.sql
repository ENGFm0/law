-- ===========================================================================
--  008 — the auction is a table, the catalogue is a table, and a request
--        belongs to both parties
--
--  Three things were true of the site and not of the database:
--
--  1. The reverse auction lived in one browser's sessionStorage. A brief was
--     never posted anywhere, so no lawyer on another machine could ever see
--     it, and accepting an offer changed a local flag and created nothing —
--     which is exactly why an agreed piece of work never appeared in either
--     side's list of requests.
--
--  2. The catalogue of legal work was a constant compiled into the page. The
--     platform could not add "تحويل شركة إلى مساهمة" without a release.
--
--  3. A request could only be updated by the professionals on it. The client
--     — the person who has to accept the delivery, ask for a revision or open
--     a dispute — could not write a single column of their own case.
-- ===========================================================================

-- --------------------------------------------------- what 007 should have
-- Repeated here, harmlessly, because this file depends on all three and a
-- migration that assumes the previous one was run is a migration that fails
-- in somebody's SQL editor at ten at night with no explanation.
alter table public.services add column if not exists channels text[] not null default '{text}';
alter table public.requests add column if not exists channel text;
alter table public.profiles add column if not exists auto_bid boolean not null default false;

-- ------------------------------------------------------ is_staff, hardened
-- Called from policies on six tables, and it reads `profiles` — a table whose
-- own policies may one day be narrowed. A plain `stable sql` function is
-- evaluated under the caller's policies, so the day `profiles` stops being
-- world-readable this function starts recursing and every read that touches
-- it fails with a 500 that names the wrong table. Definer rights, with the
-- search path pinned so the body cannot be aimed somewhere else.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and 'staff' = any(p.roles)
  )
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- ---------------------------------------------------------- the catalogue
-- What a lawyer can offer to do. The band lives in price_bands and is keyed
-- by the same id, so adding a category and pricing it are one operation in
-- the console and two rows here.
create table if not exists public.service_types (
  id         text primary key,
  title_ar   text not null,
  title_en   text not null,
  meta_ar    text,
  meta_en    text,
  icon       text not null default 'tag',
  channels   text[] not null default '{text}',
  sort       int not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.service_types enable row level security;

drop policy if exists "the catalogue is public" on public.service_types;
create policy "the catalogue is public" on public.service_types for select using (true);
drop policy if exists "staff write the catalogue" on public.service_types;
create policy "staff write the catalogue" on public.service_types for all
  using (public.is_staff()) with check (public.is_staff());
grant select on public.service_types to anon, authenticated;
grant insert, update, delete on public.service_types to authenticated;

-- The six the site shipped with. `on conflict do nothing` so a project that
-- has already been edited from the console is left exactly as it is.
insert into public.service_types (id, title_ar, title_en, meta_ar, meta_en, icon, channels, sort) values
  ('consult',  'استشارة قانونية', 'Legal consultation', 'رأي في مسألة قائمة',    'An opinion on a live question',        'chat',      '{voice,video,text}', 10),
  ('claim',    'صحيفة دعوى',      'Statement of claim', 'إعداد الدعوى وقيدها',   'Preparing and filing the claim',       'gavel',     '{text,voice,video}', 20),
  ('memo',     'مذكرة قانونية',   'Legal memorandum',   'رد أو دفاع مكتوب',      'A written reply or defence',           'file-text', '{text,voice,video}', 30),
  ('contract', 'صياغة عقد',       'Contract drafting',  'عقد جديد بشروطك',       'A new contract on your terms',         'briefcase', '{text,voice,video}', 40),
  ('review',   'مراجعة مستند',    'Document review',    'قراءة وملاحظات',        'Read, with notes',                     'eye',       '{text,voice,video}', 50),
  ('represent','ترافع وتمثيل',    'Representation',     'المتابعة أمام الجهة المختصة', 'Carried before the competent body', 'scale',    '{voice,video,text}', 60)
on conflict (id) do nothing;

insert into public.price_bands (type_id, min_price, max_price) values
  ('consult', 80, 500), ('claim', 400, 3000), ('memo', 300, 2500),
  ('contract', 300, 4000), ('review', 150, 1200), ('represent', 1000, 20000)
on conflict (type_id) do nothing;

-- A category cannot be dropped while a service or a request still points at
-- it — deactivate it instead, which hides it from the picker and leaves every
-- existing row readable.
create or replace function public.catalogue_in_use() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.services where type_id = old.id)
     or exists (select 1 from public.requests where type_id = old.id) then
    raise exception 'category % is in use; deactivate it instead of deleting it', old.id;
  end if;
  delete from public.price_bands where type_id = old.id;
  return old;
end $$;
drop trigger if exists service_types_in_use on public.service_types;
create trigger service_types_in_use before delete on public.service_types
  for each row execute function public.catalogue_in_use();

-- ------------------------------------------------------------- the auction
-- A brief, posted once, seen by every lawyer who could take it and by nobody
-- else. The client's identity is not in it: `client_id` is the owner column
-- the policies are written against, and the columns a lawyer reads carry no
-- name, no phone and no email.
create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles on delete cascade,
  type_id     text not null,
  channel     text not null default 'text',
  brief       text not null,
  city        text,
  specialty   text,
  status      text not null default 'open'
              check (status in ('open', 'accepted', 'expired', 'cancelled')),
  accepted_by uuid references public.profiles on delete set null,
  request_id  uuid references public.requests on delete set null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.quotes enable row level security;

create index if not exists quotes_open on public.quotes (status, expires_at);

-- Who may see a brief: the client who wrote it, the lawyer who won it, staff,
-- and — while it is still open — any lawyer whose licence has been checked.
-- That last clause is the whole auction; without it the board is empty for
-- everyone who could bid.
drop policy if exists "the board is open to lawyers" on public.quotes;
create policy "the board is open to lawyers" on public.quotes for select
  using (
    auth.uid() = client_id
    or auth.uid() = accepted_by
    or public.is_staff()
    or (status = 'open' and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and 'lawyer' = any(p.roles) and p.status = 'verified'))
  );

drop policy if exists "a client posts their own brief" on public.quotes;
create policy "a client posts their own brief" on public.quotes for insert
  with check (auth.uid() = client_id);

-- The client closes it — by taking an offer, or by walking away. Nobody else
-- may, which is what stops a lawyer from marking themselves the winner.
drop policy if exists "the client closes it" on public.quotes;
create policy "the client closes it" on public.quotes for update
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

grant select, insert, update on public.quotes to authenticated;

-- An offer. One per lawyer per brief — a second one is an edit, not a new bid.
create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes on delete cascade,
  lawyer_id  uuid not null references public.profiles on delete cascade,
  price      numeric(10,2) not null check (price > 0),
  eta        int not null default 24,
  auto       boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  unique (quote_id, lawyer_id)
);
alter table public.offers enable row level security;

drop policy if exists "offers are seen by the two sides" on public.offers;
create policy "offers are seen by the two sides" on public.offers for select
  using (
    auth.uid() = lawyer_id
    or public.is_staff()
    or exists (select 1 from public.quotes q where q.id = quote_id and q.client_id = auth.uid())
  );

-- A lawyer bids as themselves, on a brief that is still open, at a price
-- inside the platform's band for that category. The band is checked here as
-- well as in the form, because a form is not a rule.
drop policy if exists "a lawyer bids as themselves" on public.offers;
create policy "a lawyer bids as themselves" on public.offers for insert
  with check (
    auth.uid() = lawyer_id
    and exists (select 1 from public.quotes q
                where q.id = quote_id and q.status = 'open' and q.expires_at > now())
  );

drop policy if exists "a lawyer may revise their own offer" on public.offers;
create policy "a lawyer may revise their own offer" on public.offers for all
  using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id);

grant select, insert, update, delete on public.offers to authenticated;

create or replace function public.check_offer_band() returns trigger
language plpgsql security definer set search_path = public as $$
declare band public.price_bands%rowtype;
        kind text;
begin
  select type_id into kind from public.quotes where id = new.quote_id;
  select * into band from public.price_bands where type_id = kind;
  if band.type_id is null then return new; end if;   -- a category with no band
  if new.price < band.min_price or new.price > band.max_price then
    raise exception 'offer % is outside the band % to %',
      new.price, band.min_price, band.max_price;
  end if;
  return new;
end $$;
drop trigger if exists offers_price_band on public.offers;
create trigger offers_price_band before insert or update on public.offers
  for each row execute function public.check_offer_band();

-- ------------------------------------------------- a request has two sides
-- The client could not write to their own case: the update policy named the
-- lawyer and the trainee and stopped. Accepting a delivery, asking for a
-- revision and opening a dispute are all client actions, so all three failed
-- silently — the screen moved, the row did not.
drop policy if exists "the client updates their own" on public.requests;
create policy "the client updates their own" on public.requests for update
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

drop policy if exists "staff read every request" on public.requests;
create policy "staff read every request" on public.requests for select
  using (public.is_staff());

-- Letting the client write the row means pinning what the client must not
-- change. Who the parties are and what was agreed are settled when the
-- request is created; after that only staff can move them.
create or replace function public.pin_request_terms() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if new.client_id is distinct from old.client_id
     or new.price is distinct from old.price
     or new.type_id is distinct from old.type_id then
    raise exception 'the parties and the price are settled when the request is made';
  end if;
  -- The lawyer may be filled in once, never swapped.
  if old.lawyer_id is not null and new.lawyer_id is distinct from old.lawyer_id then
    raise exception 'the lawyer on a request does not change';
  end if;
  return new;
end $$;
drop trigger if exists requests_pin_terms on public.requests;
create trigger requests_pin_terms before update on public.requests
  for each row execute function public.pin_request_terms();

-- ------------------------------------------------------------ tidying up
-- The bands the site shipped with before 007 priced the delivery channel:
-- "call", "video", "written". They are not categories any more and nothing
-- can be sold against them, but they still show up wherever bands are listed.
-- Removed only where no service and no request points at them.
delete from public.price_bands b
 where b.type_id not in (select id from public.service_types)
   and not exists (select 1 from public.services  s where s.type_id = b.type_id)
   and not exists (select 1 from public.requests  r where r.type_id = b.type_id);

-- ------------------------------------------------- bids that answer at once
-- A lawyer who has said they take matching work automatically has already
-- told us everything a bid needs: which category, through which channel, at
-- what price. So the offer is made here, the moment the brief is posted,
-- rather than waiting for their browser to be open — which it will not be at
-- two in the morning, which is when a board with no bids on it looks like a
-- platform with no lawyers on it.
--
-- Definer rights because one client's insert writes rows that belong to other
-- people. The rule it must not break is that the price is the lawyer's own
-- listed price for that work, clamped to the band the platform publishes.
create or replace function public.auto_bid_on_new_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare band public.price_bands%rowtype;
begin
  select * into band from public.price_bands where type_id = new.type_id;

  insert into public.offers (quote_id, lawyer_id, price, eta, auto)
  select new.id, s.owner_id,
         case
           when band.type_id is null then s.price
           when s.price < band.min_price then band.min_price
           when s.price > band.max_price then band.max_price
           else s.price
         end,
         12, true
    from public.services s
    join public.profiles p on p.id = s.owner_id
   where s.type_id = new.type_id
     and new.channel = any(s.channels)
     and p.auto_bid
     and p.status = 'verified'
     and 'lawyer' = any(p.roles)
     and p.id <> new.client_id
  on conflict (quote_id, lawyer_id) do nothing;

  -- And tell them, so the ones who bid by hand know there is something to
  -- bid on. The same insert covers both: an automatic bidder gets to see
  -- what was offered on their behalf.
  insert into public.notifications (to_id, type, ref)
  select distinct s.owner_id, 'quote', new.id::text
    from public.services s
    join public.profiles p on p.id = s.owner_id
   where s.type_id = new.type_id
     and new.channel = any(s.channels)
     and p.status = 'verified'
     and 'lawyer' = any(p.roles)
     and p.id <> new.client_id;

  return new;
end $$;
drop trigger if exists quotes_auto_bid on public.quotes;
create trigger quotes_auto_bid after insert on public.quotes
  for each row execute function public.auto_bid_on_new_quote();
