-- ===========================================================================
--  007 — the catalogue is legal work, and the channel is how it happens
--
--  The service types used to BE the delivery channel: "phone consultation",
--  "video consultation", "written consultation". That made the catalogue a
--  list of ways to talk rather than a list of legal work, and it made the
--  price band answer the wrong question — a statement of claim is a statement
--  of claim whether it is talked through or handed over as a file.
--
--  So the category carries the band, and the channels are chosen on top of it:
--  the platform says which a category allows, the lawyer says which of those
--  they will take, and the client picks one when they order.
-- ===========================================================================

-- Which channels this lawyer will take this work through.
alter table public.services add column if not exists channels text[] not null default '{text}';

-- How this particular request is happening. Whether it is a call is read from
-- here, not inferred from what kind of work was ordered.
alter table public.requests add column if not exists channel text;

-- A lawyer who has said they will take matching work automatically. Their
-- standing price for the category becomes the bid, so a posted consultation
-- does not sit unanswered while everyone is asleep.
alter table public.profiles add column if not exists auto_bid boolean not null default false;

-- An announcement worth looking at. `image_url` for the ordinary case and
-- `html` for the one the platform wants to lay out itself — staff-only to
-- write either way, which is what makes the second one safe to allow at all.
alter table public.announcements add column if not exists image_url text;
alter table public.announcements add column if not exists html text;
alter table public.announcements add column if not exists placement text not null default 'bar'
  check (placement in ('bar', 'home'));
