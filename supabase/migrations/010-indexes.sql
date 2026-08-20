-- ===========================================================================
--  010 — indexes for the reads the site actually makes
--
--  Every table here has been small enough that a sequential scan was free, so
--  nothing was slow yet. That is not a reason to leave it: the first day the
--  platform has a few thousand requests on it, the policy on `requests` runs
--  `is_party()` against every row of every read, and the first person to
--  notice will be a client waiting on their own list.
--
--  Each of these matches a filter the code really issues — the columns row
--  policies compare, the columns pages group by, and the columns lists are
--  ordered on. Nothing speculative.
-- ===========================================================================

-- The three columns `is_party()` compares, one at a time.
create index if not exists requests_client   on public.requests (client_id);
create index if not exists requests_lawyer   on public.requests (lawyer_id);
create index if not exists requests_assigned on public.requests (assigned_to);
create index if not exists requests_recent   on public.requests (created_at desc);

-- A lawyer's own catalogue, and "who sells this category" — which is the
-- question the automatic bidder asks on every posted brief.
create index if not exists services_owner on public.services (owner_id);
create index if not exists services_type  on public.services (type_id, active);

-- The bell. Read on every page load, for one person at a time.
create index if not exists notifications_owner on public.notifications (to_id, read);
create index if not exists notifications_recent on public.notifications (to_id, at desc);

-- The auction: whose brief, and what is still open.
create index if not exists quotes_client on public.quotes (client_id, created_at desc);
create index if not exists offers_lawyer on public.offers (lawyer_id);

-- Ratings are read for every card in the directory.
create index if not exists reviews_target on public.reviews (target_id);
create index if not exists reviews_author on public.reviews (author_id);

-- The blog, and the comments under it.
create index if not exists articles_author on public.articles (author_id);
create index if not exists articles_live   on public.articles (status);
create index if not exists comments_article on public.comments (article_id);

-- Trainees: their certificates, their agreements, the tasks routed to them.
create index if not exists endorsements_intern on public.endorsements (intern_id);
create index if not exists agreements_pair on public.agreements (lawyer_id, intern_id);

-- Disputes hang off a request, and the desk reads them newest first.
create index if not exists disputes_request on public.disputes (request_id);
create index if not exists disputes_open on public.disputes (status, created_at desc);

-- The record, which is only ever read newest-first and in a page of 200.
create index if not exists audit_recent on public.audit_log (at desc);

-- The directory: who is listed, and who the platform is featuring.
create index if not exists profiles_listed on public.profiles (status);
create index if not exists profiles_featured on public.profiles (featured_rank)
  where featured_rank is not null;
