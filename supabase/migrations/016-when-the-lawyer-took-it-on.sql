-- ===========================================================================
--  016 — the moment a lawyer took the work on
--
--  The record says when a request was placed, routed, delivered, revised and
--  decided. It did not say when the lawyer picked it up — and "when did they
--  actually start" is one of the first questions anybody asks of a case that
--  went wrong.
--
--  It cannot be inferred afterwards. A request created from a won auction
--  already has a lawyer on it, so the row itself carries no moment of taking
--  on; and a request ordered directly from a lawyer's page sits at 'new'
--  until they touch it, which might be minutes or days. So the moment is
--  recorded when it happens: the first time the lawyer on a request changes
--  anything about it, that is them taking it on, once and never again.
-- ===========================================================================

create or replace function public.log_request_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'placed', new.client_id, null);
    if new.lawyer_id is not null then
      insert into public.request_events (request_id, kind, by_id, detail)
      values (new.id, 'lawyer_set', new.client_id, new.lawyer_id::text);
    end if;
    return new;
  end if;

  -- The first thing the lawyer on this request does to it is them starting.
  if who is not null and who = new.lawyer_id
     and not exists (select 1 from public.request_events e
                      where e.request_id = new.id and e.kind = 'taken') then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'taken', who, null);
  end if;

  if new.status is distinct from old.status then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'status:' || new.status, who, old.status);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id,
            case when new.assigned_to is null then 'unassigned' else 'assigned' end,
            who, coalesce(new.assigned_to, old.assigned_to)::text);
  end if;
  if coalesce(new.revisions, 0) > coalesce(old.revisions, 0) then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'revision', who, new.revision_note);
  end if;
  if new.lawyer_id is distinct from old.lawyer_id and new.lawyer_id is not null then
    insert into public.request_events (request_id, kind, by_id, detail)
    values (new.id, 'lawyer_set', who, new.lawyer_id::text);
  end if;
  return new;
end $$;

-- No trigger copies messages into this table, deliberately. The record is
-- readable by everyone who may see the request — the client included — and a
-- line saying "the lawyer said something internally at 14:32" tells them the
-- one thing the internal thread exists to keep from them. The conversation is
-- its own record, read under its own rule, and the timeline merges the two
-- where the reader is entitled to both.
