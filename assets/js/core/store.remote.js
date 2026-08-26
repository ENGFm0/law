/* ==========================================================================
   The Supabase-backed data source.

   Everything above core/store.js is synchronous — `Store.requests()` hands
   back an array, and sixteen files rely on that. Supabase is not. Turning all
   of them async would have been the obvious move and the wrong one: it changes
   every page to serve a decision about where rows live.

   So this keeps a cache instead. It is filled once on boot, reads come from it
   at once, and writes go into it immediately and to the database behind. The
   pages never learn which backend answered.

   Three things vanish here that the demo needed. `requestStates`,
   `removedServices` and `articleStates` exist only because seeded data is a
   frozen constant that has to be patched over; a real row is simply updated.
   ========================================================================== */
(function (global) {
  "use strict";

  var Store = global.Store, SB = global.SB;
  if (!Store || !SB || !SB.configured()) return;

  /* ---------- rows in, the shapes models.js already speaks ---------- */
  var pair = function (v) { return v == null ? { ar: "", en: "" } : { ar: v, en: v }; };
  var flat = function (v) {
    return v && typeof v === "object" ? (v.ar || v.en || null) : (v == null ? null : v);
  };

  function inRequest(r) {
    return {
      id: r.id, ref: r.ref || null,
      clientId: r.client_id, lawyerId: r.lawyer_id, assignedTo: r.assigned_to,
      typeId: r.type_id, channel: r.channel || "text",
      price: Number(r.price), status: r.status,
      ai: !!r.ai_assisted, hours: r.hours || 3, body: r.body || null,
      internShare: r.intern_share, rated: !!r.rated,
      // The clock the acceptance window and the guarantee both run on. It was
      // not carried across at all, so on the real backend there was no
      // deadline, no automatic acceptance and no window to promise anything
      // about — every one of them reads these three.
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).getTime() : null,
      acceptedAt: r.accepted_at ? new Date(r.accepted_at).getTime() : null,
      revisions: r.revisions || 0,
      revisionNote: r.revision_note || null,
      // What a code took off, in halalas, and which code. Read back rather
      // than recomputed: the database is what applied it, under a lock, and a
      // second opinion here would only ever be a way to disagree with it.
      promoCode: r.promo_code || null,
      promoDiscount: r.promo_discount || 0,
      title: pair(r.title), brief: pair(r.brief), ago: pair(""),
    };
  }
  function outRequest(r) {
    return {
      client_id: r.clientId, lawyer_id: r.lawyerId || null, assigned_to: r.assignedTo || null,
      type_id: r.typeId, channel: r.channel || "text",
      title: flat(r.title), brief: flat(r.brief),
      price: r.price, status: r.status || "new", ai_assisted: !!r.ai, hours: r.hours || 3,
    };
  }

  function inService(s) {
    return {
      id: s.id, ownerId: s.owner_id, typeId: s.type_id, price: Number(s.price),
      active: s.active !== false, channels: s.channels || ["text"],
      title: s.title ? pair(s.title) : null, meta: s.meta ? pair(s.meta) : null,
    };
  }
  function inArticle(a) {
    return {
      id: a.id, authorId: a.author_id, signedBy: a.signed_by, cat: a.category,
      cover: a.cover_url || "cover-contracts.svg", read: 4, likes: 0,
      status: a.status, date: pair(""), title: pair(a.title),
      excerpt: pair(a.excerpt), body: pair(a.body),
    };
  }
  function inReview(r) {
    return { id: r.id, targetId: r.target_id, authorId: r.author_id,
             requestId: r.request_id, rating: r.rating, date: pair(""), body: pair(r.body) };
  }
  function inComment(c) {
    return { id: c.id, articleId: c.article_id, authorId: c.author_id,
             at: c.created_at, body: pair(c.body) };
  }
  function inEndorsement(e) {
    return { id: e.id, internId: e.intern_id, lawyerId: e.lawyer_id,
             hours: e.hours, date: pair(""), note: e.note ? pair(e.note) : null };
  }
  function inDispute(d) {
    return {
      id: d.id, ref: d.ref || null,
      requestId: d.request_id, byId: d.by_id, reason: d.reason,
      at: new Date(d.created_at).getTime(), status: d.status,
      resolution: d.status === "resolved" ? {
        outcome: d.outcome, lawyerPct: d.lawyer_pct, reason: d.resolution_reason,
        byId: d.resolved_by, at: new Date(d.resolved_at).getTime(),
      } : null,
    };
  }
  function inNotice(n) {
    return { id: n.id, to: n.to_id, type: n.type, ref: n.ref, read: !!n.read,
             at: new Date(n.at).getTime() };
  }
  function inAudit(a) {
    return { id: a.id, action: a.action, byId: a.by_id, targetId: a.target_id,
             subject: a.subject, reason: a.reason, at: new Date(a.at).getTime() };
  }
  function inSettings(s) {
    return s ? {
      commissionPct: s.commission_pct, vatEnabled: !!s.vat_enabled, vatPct: s.vat_pct,
      madaPct: Number(s.mada_pct), madaFixed: Number(s.mada_fixed),
      cardPct: Number(s.card_pct), cardFixed: Number(s.card_fixed),
      madaSharePct: s.mada_share_pct, aiPrice: Number(s.ai_price),
      guaranteeHours: s.guarantee_hours == null ? 24 : Number(s.guarantee_hours),
      guaranteeUnconditional: s.guarantee_unconditional !== false,
      minYears: s.min_years == null ? 5 : Number(s.min_years)
    } : {};
  }
  function inAnnouncement(a) {
    return { id: a.id, title: a.title, body: a.body, link: a.link,
             imageUrl: a.image_url, html: a.html, placement: a.placement || "bar",
             audience: a.audience, active: !!a.active,
             startsAt: a.starts_at, endsAt: a.ends_at,
             at: new Date(a.created_at).getTime() };
  }
  function inSubscription(s) {
    // firm_id or nothing: a firm's listing is a subscription that names the
    // firm, and dropping the column made firm_is_listed()'s other half
    // unanswerable here — every verified, paying firm read as unlisted.
    return { id: s.id, lawyerId: s.lawyer_id, plan: s.plan, price: Number(s.price),
             firmId: s.firm_id || null,
             startedAt: s.started_at, endsAt: s.ends_at, active: !!s.active };
  }
  function inCost(c) {
    return { id: c.id, name: c.name, amount: Number(c.amount), period: c.period,
             startsAt: c.starts_at, endsAt: c.ends_at, note: c.note,
             at: new Date(c.created_at).getTime() };
  }
  function inPartner(p) {
    return { id: p.id, name: p.name, sharePct: Number(p.share_pct), note: p.note };
  }

  function inType(t) {
    return {
      id: t.id, icon: t.icon || "tag",
      title: { ar: t.title_ar || "", en: t.title_en || t.title_ar || "" },
      meta:  { ar: t.meta_ar  || "", en: t.meta_en  || t.meta_ar  || "" },
      channels: t.channels || ["text"], sort: t.sort == null ? 100 : t.sort,
      active: t.active !== false,
    };
  }
  function outType(t) {
    var row = {};
    if (t.id !== undefined) row.id = t.id;
    if (t.title) { row.title_ar = t.title.ar || ""; row.title_en = t.title.en || t.title.ar || ""; }
    if (t.meta)  { row.meta_ar  = t.meta.ar  || ""; row.meta_en  = t.meta.en  || t.meta.ar  || ""; }
    if (t.icon !== undefined) row.icon = t.icon || "tag";
    if (t.channels !== undefined) row.channels = t.channels;
    if (t.sort !== undefined) row.sort = t.sort;
    if (t.active !== undefined) row.active = !!t.active;
    return row;
  }

  function inQuote(q) {
    return {
      id: q.id, clientId: q.client_id, typeId: q.type_id, channel: q.channel || "text",
      brief: q.brief || "", city: q.city || "", specialty: q.specialty || "",
      status: q.status, acceptedBy: q.accepted_by, requestId: q.request_id,
      expiresAt: new Date(q.expires_at).getTime(),
      at: new Date(q.created_at).getTime(),
    };
  }
  function outQuote(q) {
    var row = {};
    if (q.clientId !== undefined) row.client_id = q.clientId;
    if (q.typeId !== undefined) row.type_id = q.typeId;
    if (q.channel !== undefined) row.channel = q.channel || "text";
    if (q.brief !== undefined) row.brief = q.brief;
    if (q.city !== undefined) row.city = q.city || null;
    if (q.specialty !== undefined) row.specialty = q.specialty || null;
    if (q.status !== undefined) row.status = q.status;
    if (q.acceptedBy !== undefined) row.accepted_by = q.acceptedBy || null;
    if (q.requestId !== undefined) row.request_id = q.requestId || null;
    if (q.expiresAt !== undefined) row.expires_at = new Date(q.expiresAt).toISOString();
    return row;
  }

  function inOffer(o) {
    return {
      id: o.id, quoteId: o.quote_id, lawyer: o.lawyer_id, price: Number(o.price),
      eta: o.eta == null ? 24 : o.eta, auto: !!o.auto, note: o.note || "",
      at: new Date(o.created_at).getTime(),
    };
  }

  function inEvent(e) {
    return { id: e.id, requestId: e.request_id, kind: e.kind,
             byId: e.by_id, detail: e.detail || null,
             at: new Date(e.at).getTime() };
  }

  function inMessage(m) {
    return { id: m.id, requestId: m.request_id, authorId: m.author_id,
             audience: m.audience || "parties", body: m.body || "",
             at: new Date(m.created_at).getTime() };
  }
  function inAttachment(a) {
    return { id: a.id, requestId: a.request_id, messageId: a.message_id,
             authorId: a.author_id, audience: a.audience || "parties",
             path: a.path, name: a.name, size: Number(a.size || 0),
             mime: a.mime || "application/octet-stream",
             // A recording is an attachment that knows what it is and how
             // long it ran, so a list of files can say "call, 4 minutes".
             kind: a.kind || null, seconds: a.seconds || null,
             at: new Date(a.created_at).getTime() };
  }

  function inAgreement(a) {
    return { id: a.id, lawyerId: a.lawyer_id, internId: a.intern_id, kind: a.kind,
             amount: Number(a.amount), cases: a.cases, startedAt: a.started_at };
  }

  /* ---------- who you are, before the network says so ----------
     Every page load was: download a library, ask it who is signed in, fetch
     the profiles. Three round trips, and the page is painted long before the
     first one answers — so every navigation showed the guest view for a
     second and then corrected itself. On a phone that reads as being logged
     out and logged back in on every tap.

     So the signed-in profile is kept here and read synchronously at startup.
     The first paint is right, and hydration replaces it a moment later with
     whatever the database actually says.

     It is a convenience, never a permission: this copy decides what a screen
     draws and nothing else. Every rule that matters is a row-level policy the
     server applies to a request carrying a real token, so a stale copy that
     claims more than it should still cannot read or write a thing. */
  var ME_KEY = "sanad.me";
  var WARM_KEY = "sanad.warm.v1";
  var WARM_MAX = 1500000;                 // bytes; past this it is not a win
  var WARM_LIFE = 7 * 24 * 60 * 60 * 1000;

  /* The public half of the last visit, kept on disk.

     Every page here is drawn from data, so a cold cache means a directory
     with nobody in it, a catalogue with nothing in it and a price band of
     zero — for as long as the network takes. Which is what people saw: an
     empty page that filled itself in a few seconds later.

     Only what is public goes in: who the lawyers are, what they sell, what
     the platform charges. Nobody's requests, nobody's notifications, no
     ledger. It is replaced by the real answer as soon as one arrives, and
     ignored entirely once it is a week old. */
  function saveWarm() {
    try {
      // The desk's copy of the contact book must not be what ends up on disk:
      // it is read into the same objects the directory uses, so it is taken
      // back out here rather than trusted not to have arrived yet.
      var people = cache.profiles.map(function (p) {
        if (!p.email && !p.phone) return p;
        var copy = {};
        Object.keys(p).forEach(function (k) { copy[k] = p[k]; });
        copy.email = ""; copy.phone = "";
        return copy;
      });
      var text = JSON.stringify({
        at: Date.now(),
        profiles: people, services: cache.services, types: cache.types,
        reviews: cache.reviews, announcements: cache.announcements,
        bands: cache.bands, settings: cache.settings,
      });
      if (text.length > WARM_MAX) return;
      localStorage.setItem(WARM_KEY, text);
    } catch (e) { /* private mode, or the quota */ }
  }
  function readWarm() {
    try {
      var raw = localStorage.getItem(WARM_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.at || Date.now() - d.at > WARM_LIFE) return null;
      return d;
    } catch (e) { return null; }
  }

  function remember(profile) {
    try {
      profile ? localStorage.setItem(ME_KEY, JSON.stringify(profile))
              : localStorage.removeItem(ME_KEY);
    } catch (e) { /* private mode */ }
  }
  function recall() {
    try {
      var raw = localStorage.getItem(ME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------- the cache ---------- */
  var cache = {
    profiles: [], requests: [], services: [], articles: [],
    reviews: [], comments: [], endorsements: [], agreements: [], applications: {},
    disputes: [], notices: [], audit: [], settings: {},
    announcements: [], subscriptions: [], costs: [], partners: [], bands: {},
    types: [], quotes: [], offers: [], messages: [], attachments: [], events: [],
    mentorships: [], sessions: [], rooms: [], promos: [], redemptions: [],
    drafts: [], orders: [], invites: [], firms: [], firmMembers: [],
  };
  var ready = false;

  // Synchronously, before anything draws: last visit's public data, and the
  // person this browser was signed in as. Neither is a permission — every
  // rule that matters is a row policy the server applies to a request
  // carrying a real token — but both are what the first paint is made of.
  var warm = readWarm();
  if (warm) {
    cache.profiles = warm.profiles || [];
    cache.services = warm.services || [];
    cache.types = warm.types || [];
    cache.reviews = warm.reviews || [];
    cache.announcements = warm.announcements || [];
    cache.bands = warm.bands || {};
    cache.settings = warm.settings || {};
  }

  var remembered = recall();
  if (remembered && remembered.id && remembered.id === Store.currentId()) {
    var seen = false;
    cache.profiles = cache.profiles.map(function (p) {
      if (p.id !== remembered.id) return p;
      seen = true;
      return remembered;
    });
    if (!seen) cache.profiles.push(remembered);
  } else if (remembered) {
    remember(null);                    // signed out elsewhere; forget them
  }

  function push(table, row) {
    return SB.load().then(function (sb) {
      return sb.from(table).insert(row).select().single();
    });
  }
  function patch(table, id, row) {
    return SB.load().then(function (sb) {
      return sb.from(table).update(row).eq("id", id);
    });
  }

  /** A write that fails leaves the cache ahead of the database, so say so
      rather than letting the screen quietly disagree with the server. */
  var toldAboutSchema = false;
  function report(res) {
    if (res && res.error) {
      // The same distinction the reads make: a migration that has not been
      // run is a state, not a fault. Said once per visit, to whoever is
      // looking at the console, rather than as a toast on every attempt.
      if (SB.notYet && SB.notYet(res.error)) {
        if (!toldAboutSchema) {
          toldAboutSchema = true;
          console.warn("this database is missing something the site expects —",
                       res.error.message);
        }
        return res;
      }
      console.error(res.error);
      // 42501 on a write, from a page that believes somebody is signed in,
      // has one meaning worth showing: the request carried no session. The
      // Postgres wording is true and useless to the person reading it.
      var lost = res.error.code === "42501" ||
                 /row-level security/i.test(res.error.message || "");
      if (lost && Store.currentId() && !authId) {
        sessionGone();
      } else if (global.App) {
        global.App.toast(res.error.message, "close");
      }
    }
    return res;
  }

  /** Said once, on screen, with the way out of it. */
  function sessionGone() {
    if (document.querySelector("[data-sessiongone]")) return;
    var t = function (k) { return global.I18N ? global.I18N.t(k) : ""; };
    var bar = document.createElement("div");
    bar.setAttribute("data-sessiongone", "");
    bar.className = "offline-bar";
    var title = document.createElement("strong");
    title.textContent = t("sys.sessionGone");
    var body = document.createElement("span");
    body.textContent = t("sys.sessionGoneBody");
    var again = document.createElement("a");
    again.className = "btn btn--sm";
    again.href = "login.html";
    again.textContent = t("sys.authRetry");
    bar.appendChild(title); bar.appendChild(body); bar.appendChild(again);
    (document.body || document.documentElement).appendChild(bar);
  }

  /* ---------- reads, all from the cache ---------- */
  Store.signups = function () { return cache.profiles; };
  Store.findAccount = function (email) {
    var e = String(email || "").trim().toLowerCase();
    for (var i = 0; i < cache.profiles.length; i++) {
      if ((cache.profiles[i].email || "").toLowerCase() === e) return cache.profiles[i];
    }
    return null;
  };
  Store.requests = function () { return cache.requests; };
  Store.services = function () { return cache.services; };
  Store.removedServices = function () { return []; };       // a row is deleted, not shadowed
  Store.articles = function () { return cache.articles; };
  Store.reviews = function () { return cache.reviews; };
  Store.comments = function () { return cache.comments; };
  Store.endorsements = function () { return cache.endorsements; };
  Store.agreements = function () { return cache.agreements; };
  Store.applicants = function (id) { return cache.applications[id] || []; };

  /** The row is the state now — there is nothing layered over a constant. */
  Store.requestState = function (id) {
    for (var i = 0; i < cache.requests.length; i++) {
      if (cache.requests[i].id === id) {
        var r = cache.requests[i];
        return { status: r.status, assignedTo: r.assignedTo, body: r.body,
                 rated: r.rated, internShare: r.internShare,
                 deliveredAt: r.deliveredAt, acceptedAt: r.acceptedAt,
                 revisions: r.revisions, revisionNote: r.revisionNote,
                 promoCode: r.promoCode, promoDiscount: r.promoDiscount };
      }
    }
    return {};
  };
  Store.articleState = function (id) {
    for (var i = 0; i < cache.articles.length; i++) {
      if (cache.articles[i].id === id) return { status: cache.articles[i].status };
    }
    return {};
  };

  /* ---------- writes: cache first, database behind ---------- */
  function local(list, row) { list.push(row); Store.notifyAll(); return row; }

  Store.addRequest = function (r, done) {
    if (noSession()) return r;
    var row = outRequest(r);
    push("requests", row).then(function (res) {
      report(res);
      if (res && res.data) {
        r.id = res.data.id;
        Store.notifyAll();
        if (done) done(r);
      }
    });
    r.id = r.id || "pending-" + Math.random().toString(36).slice(2, 8);
    return local(cache.requests, r);
  };

  Store.setRequest = function (id, changes) {
    var row = {};
    if ("status" in changes) row.status = changes.status;
    if ("assignedTo" in changes) row.assigned_to = changes.assignedTo;
    if ("body" in changes) row.body = changes.body;
    if ("internShare" in changes) row.intern_share = changes.internShare;
    if ("rated" in changes) row.rated = changes.rated;
    if ("channel" in changes) row.channel = changes.channel;
    if ("revisions" in changes) row.revisions = changes.revisions;
    if ("revisionNote" in changes) row.revision_note = changes.revisionNote;
    if ("promoCode" in changes) row.promo_code = changes.promoCode;
    if ("promoDiscount" in changes) row.promo_discount = changes.promoDiscount || 0;
    // `delivered_at` and `accepted_at` are stamped by the database when the
    // status moves, because they decide when money moves and a browser's
    // clock is not something to settle that on.
    for (var i = 0; i < cache.requests.length; i++) {
      if (cache.requests[i].id === id) {
        Object.keys(changes).forEach(function (k) { cache.requests[i][k] = changes[k]; });
      }
    }
    Store.notifyAll();
    if (Object.keys(row).length) patch("requests", id, row).then(report);
  };

  Store.addService = function (s) {
    s.channels = s.channels && s.channels.length ? s.channels : ["text"];
    var row = { owner_id: s.ownerId, type_id: s.typeId, price: s.price,
                channels: s.channels,
                title: flat(s.title), meta: flat(s.meta), active: true };
    push("services", row).then(function (res) {
      report(res);
      if (res && res.data) { s.id = res.data.id; Store.notifyAll(); }
    });
    s.id = s.id || "pending-" + Math.random().toString(36).slice(2, 8);
    return local(cache.services, s);
  };

  Store.removeService = function (id) {
    cache.services = cache.services.filter(function (s) { return s.id !== id; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("services").delete().eq("id", id).then(report);
    });
  };

  Store.addReview = function (rev) {
    var row = { target_id: rev.targetId, author_id: rev.authorId,
                request_id: rev.requestId || null, rating: rev.rating, body: flat(rev.body) };
    push("reviews", row).then(function (res) {
      report(res);
      if (res && res.data) { rev.id = res.data.id; Store.notifyAll(); }
    });
    rev.at = Date.now();
    return local(cache.reviews, rev);
  };

  Store.addArticle = function (a) {
    var row = { author_id: a.authorId, category: a.cat, title: flat(a.title),
                excerpt: flat(a.excerpt), body: flat(a.body),
                cover_url: a.cover, status: a.status || "pending" };
    push("articles", row).then(function (res) {
      report(res);
      if (res && res.data) { a.id = res.data.id; Store.notifyAll(); }
    });
    a.id = a.id || "pending-" + Math.random().toString(36).slice(2, 8);
    return local(cache.articles, a);
  };

  Store.setArticle = function (id, changes) {
    var row = {};
    if ("status" in changes) row.status = changes.status;
    if ("signedBy" in changes) row.signed_by = changes.signedBy;
    for (var i = 0; i < cache.articles.length; i++) {
      if (cache.articles[i].id === id) {
        Object.keys(changes).forEach(function (k) { cache.articles[i][k] = changes[k]; });
      }
    }
    Store.notifyAll();
    if (Object.keys(row).length) patch("articles", id, row).then(report);
  };

  Store.addComment = function (c) {
    var row = { article_id: c.articleId, author_id: c.authorId, body: flat(c.body) };
    push("comments", row).then(function (res) {
      report(res);
      if (res && res.data) { c.id = res.data.id; Store.notifyAll(); }
    });
    c.at = Date.now();
    return local(cache.comments, c);
  };

  Store.addEndorsement = function (e) {
    var row = { intern_id: e.internId, lawyer_id: e.lawyerId,
                hours: e.hours, note: flat(e.note) };
    push("endorsements", row).then(function (res) {
      report(res);
      if (res && res.data) { e.id = res.data.id; Store.notifyAll(); }
    });
    return local(cache.endorsements, e);
  };

  Store.addAgreement = function (a) {
    // One live agreement per pair, same rule the database enforces.
    cache.agreements = cache.agreements.filter(function (x) {
      return !(x.lawyerId === a.lawyerId && x.internId === a.internId);
    });
    var row = { lawyer_id: a.lawyerId, intern_id: a.internId, kind: a.kind,
                amount: a.amount, cases: a.cases || null };
    SB.load().then(function (sb) {
      return sb.from("agreements").upsert(row, { onConflict: "lawyer_id,intern_id" })
        .select().single().then(function (res) {
          report(res);
          if (res && res.data) { a.id = res.data.id; Store.notifyAll(); }
        });
    });
    a.startedAt = Date.now();
    return local(cache.agreements, a);
  };

  Store.endAgreement = function (lawyerId, internId) {
    cache.agreements = cache.agreements.filter(function (x) {
      return !(x.lawyerId === lawyerId && x.internId === internId);
    });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("agreements").delete()
        .eq("lawyer_id", lawyerId).eq("intern_id", internId).then(report);
    });
  };

  Store.apply = function (requestId, internId) {
    var list = cache.applications[requestId] || (cache.applications[requestId] = []);
    if (list.indexOf(internId) !== -1) return false;
    list.push(internId);
    Store.notifyAll();
    push("applications", { request_id: requestId, intern_id: internId }).then(report);
    return true;
  };
  Store.clearApplicants = function (requestId) {
    delete cache.applications[requestId];
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("applications").delete().eq("request_id", requestId).then(report);
    });
  };

  Store.updateAccount = function (id, changes) {
    var me = null;
    cache.profiles.forEach(function (p) {
      if (p.id === id) { me = p; Object.keys(changes).forEach(function (k) { p[k] = changes[k]; }); }
    });
    Store.notifyAll();
    var row = SB.fromProfile(changes);
    if ("autoBid" in changes) row.auto_bid = !!changes.autoBid;
    Object.keys(row).forEach(function (k) { if (row[k] == null) delete row[k]; });
    if (changes.skills) row.skills = changes.skills.map(flat);
    if (Object.keys(row).length) patch("profiles", id, row).then(report);
    if (id === Store.currentId()) keepMe();
    return me;
  };

  /* ---------- the desk, the notices and the record ----------
     All four were the last things still living only in this browser: the desk
     worked, and worked differently on every device you opened it from. They
     write through like everything else — the cache moves first so the screen
     answers, the row follows, and a refusal is reported rather than left to
     look like it succeeded. */
  /* ---------- what the platform runs on ---------- */
  Store.announcements = function () { return cache.announcements; };
  Store.addAnnouncement = function (a) {
    a.at = Date.now();
    if (a.active === undefined) a.active = true;
    cache.announcements.unshift(a);
    Store.notifyAll();
    push("announcements", { title: a.title, body: a.body || null, link: a.link || null,
                            image_url: a.imageUrl || null, html: a.html || null,
                            placement: a.placement || "bar",
                            audience: a.audience || "all", active: !!a.active,
                            starts_at: a.startsAt || null, ends_at: a.endsAt || null,
                            created_by: Store.currentId() })
      .then(report)
      .then(function (res) { if (res && res.data) { a.id = res.data.id; Store.notifyAll(); } });
    return a;
  };
  Store.setAnnouncement = function (id, p) {
    cache.announcements.forEach(function (a) {
      if (a.id === id) Object.keys(p).forEach(function (k) { a[k] = p[k]; });
    });
    Store.notifyAll();
    var row = {};
    if ("active" in p) row.active = !!p.active;
    if ("title" in p) row.title = p.title;
    if ("body" in p) row.body = p.body;
    if ("link" in p) row.link = p.link;
    if ("audience" in p) row.audience = p.audience;
    if ("imageUrl" in p) row.image_url = p.imageUrl;
    if ("html" in p) row.html = p.html;
    if ("placement" in p) row.placement = p.placement;
    if (Object.keys(row).length) patch("announcements", id, row).then(report);
  };
  Store.removeAnnouncement = function (id) {
    cache.announcements = cache.announcements.filter(function (a) { return a.id !== id; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("announcements").delete().eq("id", id);
    }).then(report);
  };

  Store.subscriptions = function () { return cache.subscriptions; };
  Store.setSubscription = function (lawyerId, sub) {
    var plan = (sub && sub.plan) || "ai";
    var found = null;
    cache.subscriptions.forEach(function (s) {
      if (s.lawyerId === lawyerId && (s.plan || "ai") === plan) found = s;
    });
    if (!found) {
      found = { lawyerId: lawyerId, plan: plan, startedAt: new Date().toISOString() };
      cache.subscriptions.push(found);
    }
    Object.keys(sub || {}).forEach(function (k) { found[k] = sub[k]; });
    Store.notifyAll();
    // Written as an update when the row is known and an insert when it is
    // not, rather than an upsert: migration 021 replaced the (lawyer_id,
    // plan) unique constraint with two partial indexes — one lawyer may own
    // two firms — and a partial index is not a conflict target PostgREST can
    // name. The uniqueness is still the database's to enforce; a collision
    // comes back through report() like any other refusal.
    var row = { lawyer_id: lawyerId, plan: plan, firm_id: found.firmId || null,
                price: found.price || 0, active: found.active !== false,
                ends_at: found.endsAt || null };
    if (found.id) {
      patch("subscriptions", found.id, row).then(report);
    } else {
      row.created_by = Store.currentId();
      push("subscriptions", row).then(report).then(function (res) {
        if (res && res.data) { found.id = res.data.id; Store.notifyAll(); }
      });
    }
    return found;
  };

  Store.costs = function () { return cache.costs; };
  Store.addCost = function (c) {
    c.at = Date.now();
    cache.costs.unshift(c);
    Store.notifyAll();
    push("operating_costs", { name: c.name, amount: c.amount, period: c.period,
                              starts_at: c.startsAt || null, ends_at: c.endsAt || null,
                              note: c.note || null })
      .then(report)
      .then(function (res) { if (res && res.data) { c.id = res.data.id; Store.notifyAll(); } });
    return c;
  };
  Store.removeCost = function (id) {
    cache.costs = cache.costs.filter(function (c) { return c.id !== id; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("operating_costs").delete().eq("id", id);
    }).then(report);
  };

  Store.partners = function () { return cache.partners; };
  Store.addPartner = function (p) {
    cache.partners.push(p);
    Store.notifyAll();
    push("partners", { name: p.name, share_pct: p.sharePct, note: p.note || null })
      .then(report)
      .then(function (res) { if (res && res.data) { p.id = res.data.id; Store.notifyAll(); } });
    return p;
  };
  Store.removePartner = function (id) {
    cache.partners = cache.partners.filter(function (p) { return p.id !== id; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("partners").delete().eq("id", id);
    }).then(report);
  };

  /* ---------- the catalogue ----------
     Six categories used to be a constant compiled into the page, so adding
     one meant a release. They are rows now: staff write them, everybody
     reads them, and a lawyer picks from whatever the platform is currently
     offering. */
  Store.types = function () { return cache.types; };
  // Nothing is hidden behind a list here: a category the platform deleted is
  // gone from the table, and the table is the catalogue.
  Store.removedTypes = function () { return []; };
  Store.addType = function (t) {
    var row = outType(t);
    push("service_types", row).then(function (res) {
      report(res);
      if (res && res.data) { cache.types.push(inType(res.data)); Store.notifyAll(); }
    });
    return t;
  };
  Store.setType = function (id, changes) {
    cache.types.forEach(function (t) {
      if (t.id !== id) return;
      Object.keys(changes).forEach(function (k) { t[k] = changes[k]; });
    });
    Store.notifyAll();
    patch("service_types", id, outType(changes)).then(report);
  };
  Store.removeType = function (id) {
    var kept = cache.types.filter(function (t) { return t.id !== id; });
    cache.types = kept;
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("service_types").delete().eq("id", id);
    }).then(function (res) {
      // A category something is already sold under cannot go; the database
      // says so and the row comes back, because pretending otherwise would
      // leave the console showing a catalogue the platform does not have.
      if (res && res.error) { Store.hydrate(); report(res); }
    });
  };

  /* ---------- the auction ---------- */
  Store.quotes = function () { return cache.quotes; };
  Store.quote = function (id) {
    for (var i = 0; i < cache.quotes.length; i++) {
      if (cache.quotes[i].id === id) return cache.quotes[i];
    }
    return null;
  };
  Store.offers = function () { return cache.offers; };
  Store.offersOn = function (quoteId) {
    return cache.offers.filter(function (o) { return o.quoteId === quoteId; });
  };

  /** Ask again for the two tables that change while somebody is watching
      them. Announced only when the answer is different: a redraw on a timer
      replaces every input on the page, including the one being typed into. */
  Store.refreshAuction = function () {
    return SB.load().then(function (sb) {
      return Promise.all([
        sb.from("quotes").select("*").order("created_at", { ascending: false }),
        sb.from("offers").select("*"),
      ]);
    }).then(function (r) {
      var before = signature();
      if (r[0] && !r[0].error && r[0].data) cache.quotes = r[0].data.map(inQuote);
      if (r[1] && !r[1].error && r[1].data) cache.offers = r[1].data.map(inOffer);
      if (signature() !== before) Store.notifyAll();
      return cache;
    }).catch(function (e) { console.error(e); });
  };
  function signature() {
    return cache.quotes.map(function (q) { return q.id + q.status; }).join(",") + "|" +
           cache.offers.map(function (o) { return o.id + o.price; }).join(",");
  }

  Store.openQuote = function (q) {
    if (noSession()) return q;
    // Addressed with the id the server will check it against, not the one
    // this browser remembers. They are the same id in every ordinary case —
    // and when they are not, the row is refused and nothing explains why.
    if (authId) q.clientId = authId;
    var row = outQuote(q);
    push("quotes", row).then(function (res) {
      report(res);
      if (!res || !res.data) return;
      var real = inQuote(res.data);
      // Swap the placeholder for the row the database made, then read the
      // offers it made with it: a lawyer who takes matching work
      // automatically has already bid by the time this returns, and the
      // board would otherwise sit empty until the next page load.
      cache.quotes = cache.quotes.filter(function (x) { return x.id !== q.id; });
      cache.quotes.unshift(real);
      q.id = real.id;
      Store.notifyAll();
      SB.load().then(function (sb) {
        return sb.from("offers").select("*").eq("quote_id", real.id);
      }).then(function (out) {
        if (!out || out.error || !out.data) return;
        cache.offers = cache.offers.filter(function (o) { return o.quoteId !== real.id; })
          .concat(out.data.map(inOffer));
        Store.notifyAll();
      });
    });
    q.id = q.id || "pending-" + Math.random().toString(36).slice(2, 8);
    q.status = q.status || "open";
    q.at = Date.now();
    cache.quotes.unshift(q);
    Store.notifyAll();
    return q;
  };

  Store.setQuote = function (id, changes) {
    var found = null;
    cache.quotes.forEach(function (q) {
      if (q.id !== id) return;
      found = q;
      Object.keys(changes).forEach(function (k) { q[k] = changes[k]; });
    });
    Store.notifyAll();
    patch("quotes", id, outQuote(changes)).then(report);
    return found;
  };

  Store.addOffer = function (offer) {
    if (noSession()) return false;
    if (authId) offer.lawyer = authId;
    var q = Store.quote(offer.quoteId);
    if (!q || q.status !== "open") return false;
    var already = cache.offers.some(function (o) {
      return o.quoteId === offer.quoteId && o.lawyer === offer.lawyer;
    });
    if (already) return false;
    push("offers", {
      quote_id: offer.quoteId, lawyer_id: offer.lawyer, price: offer.price,
      eta: offer.eta || 24, auto: !!offer.auto, note: offer.note || null,
    }).then(function (res) {
      report(res);
      if (res && res.data) {
        cache.offers = cache.offers.filter(function (o) {
          return !(o.quoteId === offer.quoteId && o.lawyer === offer.lawyer);
        });
        cache.offers.push(inOffer(res.data));
        Store.notifyAll();
      }
    });
    offer.id = offer.id || "pending-" + Math.random().toString(36).slice(2, 8);
    offer.at = Date.now();
    cache.offers.push(offer);
    Store.notifyAll();
    return true;
  };

  /* ---------- the conversation on a case ---------- */
  Store.messages = function (requestId, audience) {
    var want = audience || "parties";
    return cache.messages.filter(function (m) {
      return m.requestId === requestId && m.audience === want;
    }).sort(function (a, b) { return a.at - b.at; });
  };
  Store.attachments = function () { return cache.attachments; };
  Store.events = function (requestId) {
    return cache.events.filter(function (e) { return e.requestId === requestId; })
      .sort(function (a, b) { return a.at - b.at; });
  };
  Store.attachmentsOn = function (messageId) {
    return cache.attachments.filter(function (a) { return a.messageId === messageId; });
  };
  Store.filesOf = function (requestId, audience) {
    var want = audience || "parties";
    return cache.attachments.filter(function (a) {
      return a.requestId === requestId && a.audience === want;
    }).sort(function (a, b) { return a.at - b.at; });
  };

  Store.sendMessage = function (m, done) {
    if (noSession()) return m;
    if (authId) m.authorId = authId;
    m.audience = m.audience || "parties";
    push("messages", {
      request_id: m.requestId, author_id: m.authorId,
      audience: m.audience, body: m.body || null,
    }).then(function (res) {
      report(res);
      if (!res || !res.data) return;
      var real = inMessage(res.data);
      cache.messages = cache.messages.filter(function (x) { return x.id !== m.id; });
      cache.messages.push(real);
      m.id = real.id;
      Store.notifyAll();
      if (done) done(m);
    });
    m.id = m.id || "pending-" + Math.random().toString(36).slice(2, 8);
    m.at = Date.now();
    cache.messages.push(m);
    Store.notifyAll();
    return m;
  };

  /** The file goes to Storage first and the row second: a row pointing at an
      object that was never written is worse than no row, because the thread
      then shows an attachment that cannot be opened. */
  Store.attachFile = function (a, done) {
    if (noSession()) return a;
    if (authId) a.authorId = authId;
    a.audience = a.audience || "parties";
    var path = a.requestId + "/" + Math.random().toString(36).slice(2, 10) + "-" +
      String(a.name).replace(/[^\w.\-]/g, "_").slice(-60);

    global.REST.upload("case-files", path, a.file).then(function (up) {
      if (up.error) {
        cache.attachments = cache.attachments.filter(function (x) { return x.id !== a.id; });
        Store.notifyAll();
        report({ error: up.error });
        return;
      }
      return push("attachments", {
        request_id: a.requestId, message_id: a.messageId || null,
        author_id: a.authorId, audience: a.audience,
        path: path, name: a.name, size: a.size, mime: a.mime,
        kind: a.kind || null, seconds: a.seconds || null,
      }).then(function (res) {
        report(res);
        if (!res || !res.data) return;
        var real = inAttachment(res.data);
        cache.attachments = cache.attachments.filter(function (x) { return x.id !== a.id; });
        cache.attachments.push(real);
        a.id = real.id;
        Store.notifyAll();
        if (done) done(a);
      });
    });

    a.id = a.id || "pending-" + Math.random().toString(36).slice(2, 8);
    a.at = Date.now();
    a.path = path;
    cache.attachments.push(a);
    Store.notifyAll();
    return a;
  };

  /** Nothing in the bucket is public, so a file is shown through a link that
      expires. Held for a few minutes so a redraw does not ask again. */
  var signed = {};
  Store.fileUrl = function (att) {
    if (!att || !att.path) return Promise.resolve(null);
    var held = signed[att.path];
    if (held && held.until > Date.now()) return Promise.resolve(held.url);
    return global.REST.signUrl("case-files", att.path, 3600).then(function (url) {
      if (url) signed[att.path] = { url: url, until: Date.now() + 50 * 60000 };
      return url;
    });
  };

  /** A thread is the one place two people are waiting on each other, so it is
      asked again while it is open. Announced only when it has changed. */
  Store.refreshThread = function (requestId) {
    return SB.load().then(function (sb) {
      return Promise.all([
        sb.from("messages").select("*").eq("request_id", requestId).order("created_at"),
        sb.from("attachments").select("*").eq("request_id", requestId).order("created_at"),
      ]);
    }).then(function (r) {
      var before = threadSignature(requestId);
      if (r[0] && !r[0].error && r[0].data) {
        cache.messages = cache.messages.filter(function (m) { return m.requestId !== requestId; })
          .concat(r[0].data.map(inMessage));
      }
      if (r[1] && !r[1].error && r[1].data) {
        cache.attachments = cache.attachments.filter(function (a) { return a.requestId !== requestId; })
          .concat(r[1].data.map(inAttachment));
      }
      if (threadSignature(requestId) !== before) Store.notifyAll();
    }).catch(function (e) { console.error(e); });
  };
  function threadSignature(requestId) {
    return cache.messages.filter(function (m) { return m.requestId === requestId; })
      .map(function (m) { return m.id; }).join(",") + "|" +
      cache.attachments.filter(function (a) { return a.requestId === requestId; })
        .map(function (a) { return a.id; }).join(",");
  }

  /** The client's own door out, inside the window the platform published.
      Decided by the database — every rule that makes it safe is there, and
      none of them is something a browser should be trusted with. */
  Store.refundUnderGuarantee = function (requestId, done) {
    if (noSession()) return Promise.resolve("not signed in");
    return SB.load().then(function (sb) {
      return sb.rpc("refund_under_guarantee", { p_request: requestId });
    }).then(function (res) {
      if (res && res.error) { report(res); return "failed"; }
      var answer = Array.isArray(res.data) ? res.data[0] : res.data;
      var word = answer && typeof answer === "object"
        ? answer.refund_under_guarantee : answer;
      if (word === "refunded") {
        cache.requests.forEach(function (r) {
          if (r.id === requestId) r.status = "refunded";
        });
        Store.notifyAll();
        Store.hydrate();               // the dispute row it wrote is worth having
      }
      if (done) done(word);
      return word;
    });
  };

  /* ---------------- supervision ----------------
     Reads come from the hydrated cache like everything else; writes go to the
     table and let the policies decide. Nothing here re-checks what the
     database checks — guard_mentorship() refuses an application answered by
     the side that made it, and a second opinion in a browser would only ever
     be a way to disagree with it. */
  function inMentorship(m) {
    return { id: m.id, mentorId: m.mentor_id, internId: m.intern_id,
             openedBy: m.opened_by, status: m.status, fee: Number(m.fee || 0),
             note: m.note || null,
             startedAt: m.started_at ? new Date(m.started_at).getTime() : null,
             endedAt: m.ended_at ? new Date(m.ended_at).getTime() : null,
             paidUntil: m.paid_until ? new Date(m.paid_until).getTime() : null,
             at: new Date(m.created_at).getTime() };
  }
  function inSession(x) {
    return { id: x.id, mentorshipId: x.mentorship_id, mentorId: x.mentor_id,
             kind: x.kind, title: x.title, note: x.note || null,
             startsAt: x.starts_at, minutes: x.minutes || 60,
             hours: x.hours || 1, attended: !!x.attended };
  }
  function inRoomSaid(x) {
    return { id: x.id, mentorshipId: x.mentorship_id, authorId: x.author_id,
             body: x.body, at: new Date(x.created_at).getTime() };
  }
  function inPromo(p) {
    return { id: p.id, code: p.code, label: p.label || null,
             discountPct: p.discount_pct, maxDiscount: p.max_discount,
             usageLimit: p.usage_limit, usedCount: p.used_count || 0,
             clientId: p.client_id || null, typeId: p.type_id || null,
             expiresAt: p.expires_at ? new Date(p.expires_at).getTime() : null,
             active: p.active !== false, at: new Date(p.created_at).getTime() };
  }
  function inRedemption(r) {
    return { id: r.id, promoId: r.promo_id, clientId: r.client_id,
             requestId: r.request_id || null, amount: r.amount || 0,
             at: new Date(r.at).getTime() };
  }
  function inDraft(d) {
    return { id: d.id, requestId: d.request_id, lawyerId: d.lawyer_id,
             status: d.status, body: d.body || null, model: d.model || null,
             error: d.error || null, attempts: d.attempts || 0,
             at: new Date(d.queued_at).getTime(),
             readyAt: d.ready_at ? new Date(d.ready_at).getTime() : null };
  }
  Store.drafts = function () { return cache.drafts || []; };
  Store.draftFor = function (requestId) {
    var out = null;
    (cache.drafts || []).forEach(function (d) {
      if (d.requestId === requestId) out = d;
    });
    return out;
  };
  /* The queue is filled by a trigger on the way in — a browser cannot insert
     into it, and should not: owing a draft is the platform's decision about a
     subscription, not a claim anybody makes for themselves. */
  Store.oweDraft = function () { return null; };
  Store.setDraft = function (id, changes) {
    var row = {};
    if ("status" in changes) row.status = changes.status;
    if ("body" in changes) row.body = changes.body;
    var out = null;
    (cache.drafts || []).forEach(function (d) {
      if (d.id !== id) return;
      Object.keys(changes).forEach(function (k) { d[k] = changes[k]; });
      out = d;
    });
    Store.notifyAll();
    patch("draft_jobs", id, row);
    return out;
  };

  Store.promos = function () { return cache.promos || []; };
  Store.promoByCode = function (code) {
    var want = String(code || "").trim().toUpperCase(), out = null;
    (cache.promos || []).forEach(function (p) { if (p.code === want) out = p; });
    return out;
  };
  Store.redemptions = function () { return cache.redemptions || []; };
  Store.redemptionOf = function (promoId, clientId) {
    var out = null;
    (cache.redemptions || []).forEach(function (r) {
      if (r.promoId === promoId && r.clientId === clientId) out = r;
    });
    return out;
  };

  /* ---------------- supervision by the case, calls, and firms ----------------
     Reads from the hydrated cache; writes go to the table or through the one
     function that is allowed to move money. Nothing here re-checks what the
     database checks. */
  function inOrder(o) {
    return { id: o.id, mentorId: o.mentor_id, internId: o.intern_id,
             requestId: o.request_id || null, fee: Number(o.fee || 0),
             status: o.status, paidAt: new Date(o.paid_at).getTime(),
             usedAt: o.used_at ? new Date(o.used_at).getTime() : null };
  }
  function inInvite(i) {
    return { id: i.id, internId: i.intern_id, mentorId: i.mentor_id || null,
             note: i.note || null, status: i.status, takenBy: i.taken_by || null,
             expiresAt: i.expires_at, at: new Date(i.created_at).getTime() };
  }
  function inFirm(f) {
    return { id: f.id, ref: f.ref || null, ownerId: f.owner_id, name: f.name,
             bio: f.bio || null, city: f.city || null, address: f.address || null,
             website: f.website || null, logoUrl: f.logo_url || null,
             licenceNo: f.licence_no || null, status: f.status,
             rejectedReason: f.rejected_reason || null,
             at: new Date(f.created_at).getTime() };
  }
  function inFirmMember(m) {
    return { id: m.id, firmId: m.firm_id, profileId: m.profile_id, role: m.role,
             status: m.status, title: m.title || null,
             joinedAt: m.joined_at ? new Date(m.joined_at).getTime() : null };
  }

  Store.supervisionOrders = function () { return cache.orders || []; };
  /* Neither supervision_orders nor payouts takes an insert from a browser, so
     buying one is a single call with the checks inside it. */
  Store.buySupervision = function (mentorId, done) {
    if (noSession()) { if (done) done("not signed in"); return Promise.resolve("not signed in"); }
    return SB.load().then(function (sb) {
      return sb.rpc("buy_supervision", {
        p_mentor: mentorId, p_gateway: "demo",
        p_gateway_ref: mentorId + "-" + Date.now()
      });
    }).then(function (res) {
      if (res && res.error) { report(res); if (done) done("failed"); return "failed"; }
      var word = Array.isArray(res.data) ? res.data[0] : res.data;
      if (word && typeof word === "object") word = word.buy_supervision;
      if (word === "bought") Store.hydrate();
      if (done) done(word);
      return word;
    });
  };

  Store.invites = function () { return cache.invites || []; };
  Store.callForMentor = function (note, mentorId) {
    if (noSession()) return "not signed in";
    push("mentorship_invites", { intern_id: Store.currentId(),
                                 mentor_id: mentorId || null, note: note || null })
      .then(function (res) { report(res); if (res && res.data) Store.hydrate(); });
    return "sent";
  };
  Store.withdrawCall = function (id) {
    (cache.invites || []).forEach(function (i) {
      if (i.id === id) i.status = "withdrawn";
    });
    Store.notifyAll();
    patch("mentorship_invites", id, { status: "withdrawn" });
  };

  Store.firms = function () { return cache.firms || []; };
  Store.firm = function (id) {
    var out = null;
    (cache.firms || []).forEach(function (f) { if (f.id === id) out = f; });
    return out;
  };
  /* The id and the reference are the database's to hand back — stamp_firm_ref()
     writes the reference — so the caller is told when they arrive rather than
     being handed a row with neither and sent to firm.html?id=undefined. */
  Store.addFirm = function (f, done) {
    if (noSession()) return f;
    push("firms", { owner_id: Store.currentId(), name: f.name, bio: f.bio || null,
                    city: f.city || null, address: f.address || null,
                    website: f.website || null, licence_no: f.licenceNo || null })
      .then(function (res) {
        report(res);
        if (res && res.data) {
          f.id = res.data.id;
          f.ref = res.data.ref;
          Store.hydrate();
          if (done) done(f);
        }
      });
    f.status = "pending";
    return local(cache.firms, f);
  };
  Store.setFirm = function (id, changes) {
    var row = {};
    ["name", "bio", "city", "address", "website", "status"].forEach(function (k) {
      if (k in changes) row[k === "name" ? "name" : k] = changes[k];
    });
    if ("logoUrl" in changes) row.logo_url = changes.logoUrl;
    if ("rejectedReason" in changes) row.rejected_reason = changes.rejectedReason;
    (cache.firms || []).forEach(function (f) {
      if (f.id === id) Object.keys(changes).forEach(function (k) { f[k] = changes[k]; });
    });
    Store.notifyAll();
    patch("firms", id, row).then(report);
    return Store.firm(id);
  };

  function inSlot(x) {
    return { id: x.id, mentorId: x.mentor_id, weekday: Number(x.weekday),
             from: String(x.starts_at).slice(0, 5), to: String(x.ends_at).slice(0, 5) };
  }

  Store.mentorSlots = function () { return cache.slots || []; };
  Store.addSlot = function (weekday, from, to) {
    if (noSession()) return "not signed in";
    var me = Store.currentId();
    if (!(to > from)) return "backwards";
    var clash = false;
    (cache.slots || []).forEach(function (x) {
      if (x.mentorId === me && x.weekday === weekday && x.from === from) clash = true;
    });
    if (clash) return "already";
    push("mentor_slots", { mentor_id: me, weekday: weekday,
                           starts_at: from, ends_at: to })
      .then(function (res) { report(res); if (res && res.data) Store.hydrate(); });
    local(cache.slots, { mentorId: me, weekday: weekday, from: from, to: to });
    return "added";
  };
  Store.removeSlot = function (id) {
    var me = Store.currentId();
    cache.slots = (cache.slots || []).filter(function (x) {
      return !(x.id === id && x.mentorId === me);
    });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("mentor_slots").delete().eq("id", id).eq("mentor_id", me);
    }).then(report);
  };

  Store.firmMembers = function () { return cache.firmMembers || []; };
  Store.inviteToFirm = function (firmId, profileId, role) {
    if (noSession()) return "not signed in";
    push("firm_members", { firm_id: firmId, profile_id: profileId,
                           role: role || "associate" })
      .then(function (res) { report(res); if (res && res.data) Store.hydrate(); });
    return "sent";
  };
  Store.answerFirm = function (firmId, yes) {
    var me = Store.currentId();
    var status = yes ? "active" : "declined";
    (cache.firmMembers || []).forEach(function (m) {
      if (m.firmId === firmId && m.profileId === me) m.status = status;
    });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("firm_members").update({ status: status })
        .eq("firm_id", firmId).eq("profile_id", me);
    }).then(function (res) { report(res); Store.hydrate(); });
    return status;
  };

  /* The row is reachable now — migration 023 opened exactly this update — so
     this is a plain write, and the guard and the policy between them settle
     whether it is allowed. */
  Store.routeScreening = function (requestId, internId) {
    if (noSession()) return "not signed in";
    var me = Store.currentId();
    var signer = global.Models && global.Models.signerFor(internId);
    if (!signer || signer.id !== me) return "not yours";
    (cache.requests || []).forEach(function (r) {
      if (r.id === requestId) { r.assignedTo = internId; r.lawyerId = me; r.status = "with_intern"; }
    });
    Store.notifyAll();
    patch("requests", requestId, { assigned_to: internId, status: "with_intern" })
      .then(report).then(function () { Store.hydrate(); });
    return "routed";
  };

  Store.mentorships = function () { return cache.mentorships || []; };
  Store.mentorship = function (id) {
    var out = null;
    (cache.mentorships || []).forEach(function (m) { if (m.id === id) out = m; });
    return out;
  };
  Store.mentorshipOf = function (internId) {
    var out = null;
    (cache.mentorships || []).forEach(function (m) {
      if (m.internId === internId && m.status === "active") out = m;
    });
    return out;
  };
  Store.sessions = function () { return cache.sessions || []; };
  Store.roomMessages = function (mentorshipId) {
    return (cache.rooms || []).filter(function (x) {
      return x.mentorshipId === mentorshipId;
    }).sort(function (a, b) { return a.at - b.at; });
  };

  function openMentorship(mentorId, internId, openedBy) {
    if (noSession()) return "not signed in";
    push("mentorships", { mentor_id: mentorId, intern_id: internId,
                          opened_by: openedBy }).then(function (res) {
      report(res);
      if (res && res.data) Store.hydrate();
    });
    return "sent";
  }
  Store.applyForMentorship = function (mentorId) {
    var me = Store.currentId();
    if (!me) return "not signed in";
    if (Store.mentorshipOf(me)) return "already";
    return openMentorship(mentorId, me, "intern");
  };
  Store.inviteToMentorship = function (internId) {
    var me = Store.currentId();
    if (!me) return "not signed in";
    if (Store.mentorshipOf(internId)) return "already";
    return openMentorship(me, internId, "mentor");
  };
  Store.setMentorship = function (id, changes) {
    var row = {};
    if ("status" in changes) row.status = changes.status;
    (cache.mentorships || []).forEach(function (m) {
      if (m.id === id) Object.keys(changes).forEach(function (k) { m[k] = changes[k]; });
    });
    Store.notifyAll();
    patch("mentorships", id, row);
    return Store.mentorship(id);
  };
  Store.addSession = function (x) {
    if (noSession()) return x;
    push("mentorship_sessions", {
      mentorship_id: x.mentorshipId, mentor_id: x.mentorId, kind: x.kind || "training",
      title: x.title, starts_at: x.startsAt, hours: x.hours || 1
    }).then(function (res) { report(res); if (res && res.data) Store.hydrate(); });
    return local(cache.sessions, x);
  };
  Store.setSession = function (id, changes) {
    var row = {};
    if ("attended" in changes) row.attended = !!changes.attended;
    (cache.sessions || []).forEach(function (x) {
      if (x.id === id) Object.keys(changes).forEach(function (k) { x[k] = changes[k]; });
    });
    Store.notifyAll();
    patch("mentorship_sessions", id, row);
  };
  Store.sayInRoom = function (m) {
    if (noSession()) return m;
    push("mentorship_messages", { mentorship_id: m.mentorshipId,
                                  author_id: m.authorId, body: m.body })
      .then(function (res) { report(res); if (res && res.data) Store.hydrate(); });
    m.at = Date.now();
    return local(cache.rooms, m);
  };

  /* The charge writes a payment and two payouts, and neither table takes an
     insert from a browser. So it is one call, and the checks travel with it. */
  Store.chargeSponsorship = function (mentorshipId, done) {
    if (noSession()) { if (done) done("not signed in"); return Promise.resolve("not signed in"); }
    return SB.load().then(function (sb) {
      return sb.rpc("charge_sponsorship", {
        p_mentorship: mentorshipId, p_gateway: "demo",
        p_gateway_ref: mentorshipId + "-" + Date.now(), p_months: 1
      });
    }).then(function (res) {
      if (res && res.error) { report(res); if (done) done("failed"); return "failed"; }
      var word = Array.isArray(res.data) ? res.data[0] : res.data;
      if (word && typeof word === "object") word = word.charge_sponsorship;
      if (word === "paid") Store.hydrate();
      if (done) done(word);
      return word;
    });
  };

  /* ---------------- discount codes ----------------
     Validating and spending are two calls because they are two questions: one
     is "what is this worth" and is asked while somebody types, the other is
     "take it" and moves a counter under a lock. Neither is arithmetic done
     here — the database decides, and the browser only has to agree with it. */
  Store.promoValue = function (code, gross, typeId, done) {
    if (noSession()) return Promise.resolve({ ok: false, reason: "not signed in" });
    return SB.load().then(function (sb) {
      return sb.rpc("validate_promo_code",
                    { p_code: code, p_gross: gross, p_type: typeId || null });
    }).then(function (res) {
      if (res && res.error) { report(res); return { ok: false, reason: "failed" }; }
      var row = Array.isArray(res.data) ? res.data[0] : res.data;
      var out = row
        ? { ok: !!row.ok, reason: row.reason, discount: row.discount || 0, pct: row.pct || 0 }
        : { ok: false, reason: "unknown" };
      if (done) done(out);
      return out;
    });
  };

  Store.redeemPromo = function (requestId, code, done) {
    if (noSession()) { if (done) done("not signed in"); return Promise.resolve("not signed in"); }
    return SB.load().then(function (sb) {
      return sb.rpc("redeem_promo_code", { p_code: code, p_request: requestId });
    }).then(function (res) {
      if (res && res.error) { report(res); if (done) done("failed"); return "failed"; }
      var word = Array.isArray(res.data) ? res.data[0] : res.data;
      if (word && typeof word === "object") word = word.redeem_promo_code;
      // The row carries the discount now, so the price on screen has to come
      // from the row rather than from what was typed.
      if (word === "applied") Store.hydrate();
      if (done) done(word, { ok: word === "applied", reason: word });
      return word;
    });
  };

  /* Taking a code off again is an update to the request like any other, and
     the redemption row stays: it is the record that the code was spent, and
     the unique key on it is what stops a second attempt. */
  Store.clearPromo = function (requestId) {
    return Store.setRequest(requestId, { promoCode: null, promoDiscount: 0 });
  };

  Store.bands = function () { return cache.bands; };
  Store.setBand = function (typeId, band) {
    cache.bands[typeId] = { min: band.min, max: band.max };
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("price_bands").upsert(
        { type_id: typeId, min_price: band.min, max_price: band.max },
        { onConflict: "type_id" });
    }).then(report);
  };

  Store.settings = function () { return cache.settings; };
  Store.setSettings = function (p) {
    Object.keys(p || {}).forEach(function (k) { cache.settings[k] = p[k]; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      var c = cache.settings;
      return sb.from("platform_settings").update({
        commission_pct: c.commissionPct,
        vat_enabled: !!c.vatEnabled,
        vat_pct: c.vatPct,
        mada_pct: c.madaPct, mada_fixed: c.madaFixed,
        card_pct: c.cardPct, card_fixed: c.cardFixed,
        mada_share_pct: c.madaSharePct, ai_price: c.aiPrice,
        guarantee_hours: c.guaranteeHours,
        guarantee_unconditional: !!c.guaranteeUnconditional,
        min_years: c.minYears,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
    }).then(report);
    return cache.settings;
  };

  Store.disputes = function () { return cache.disputes; };
  Store.disputeFor = function (requestId) {
    for (var i = 0; i < cache.disputes.length; i++) {
      if (cache.disputes[i].requestId === requestId) return cache.disputes[i];
    }
    return null;
  };
  Store.openDispute = function (d) {
    if (Store.disputeFor(d.requestId)) return null;
    var row = { id: null, requestId: d.requestId, byId: d.byId, reason: d.reason,
                at: Date.now(), status: "open", resolution: null };
    cache.disputes.push(row);
    Store.notifyAll();
    push("disputes", { request_id: d.requestId, by_id: d.byId, reason: d.reason })
      .then(report)
      .then(function (res) { if (res && res.data) { row.id = res.data.id; Store.notifyAll(); } });
    return row;
  };
  Store.resolveDispute = function (id, decision) {
    var d = null;
    for (var i = 0; i < cache.disputes.length; i++) if (cache.disputes[i].id === id) d = cache.disputes[i];
    if (!d || d.status === "resolved") return null;
    d.status = "resolved";
    d.resolution = {
      outcome: decision.outcome,
      lawyerPct: decision.outcome === "split" ? decision.lawyerPct : null,
      reason: decision.reason || "", byId: decision.byId || null, at: Date.now(),
    };
    Store.notifyAll();
    patch("disputes", id, {
      status: "resolved", outcome: d.resolution.outcome, lawyer_pct: d.resolution.lawyerPct,
      resolution_reason: d.resolution.reason, resolved_by: d.resolution.byId,
      resolved_at: new Date().toISOString(),
    }).then(report);
    return d;
  };

  Store.audit = function () { return cache.audit; };
  Store.log = function (entry) {
    entry.at = Date.now();
    cache.audit.unshift(entry);
    Store.notifyAll();
    push("audit_log", { action: entry.action, by_id: entry.byId,
                        target_id: entry.targetId || null,
                        subject: entry.subject || null, reason: entry.reason || null })
      .then(report)
      .then(function (res) { if (res && res.data) entry.id = res.data.id; });
    return entry;
  };

  Store.notices = function () { return cache.notices; };
  Store.notify = function (n) {
    if (!n.to) return null;
    // One row per person, kind and subject — and it comes back unread when
    // something happens again. The plain insert this replaced was refused by
    // the unique key the second time, which was right for "your account was
    // approved" and quite wrong for "a new message on your request": the bell
    // rang once per case and then never again.
    var held = null;
    cache.notices.forEach(function (x) {
      if (x.to === n.to && x.type === n.type && x.ref === n.ref) held = x;
    });
    if (held) { held.read = false; held.at = Date.now(); }
    else { n.at = Date.now(); n.read = false; cache.notices.push(n); }
    Store.notifyAll();

    // Raised through a function rather than written directly. Reopening a
    // notice that belongs to somebody else is a privileged act — the sender
    // may not read that row, let alone update it — and an upsert asked
    // Postgres to do exactly that, which it refused, out loud, on the second
    // message of every case.
    SB.load().then(function (sb) {
      return sb.rpc("raise_notice", { p_to: n.to, p_kind: n.type, p_ref: n.ref || null });
    }).then(function (res) {
      if (res && res.error && res.error.code !== "23505") report(res);
    });
    return held || n;
  };
  Store.readNotice = function (id) {
    cache.notices.forEach(function (n) { if (n.id === id) n.read = true; });
    Store.notifyAll();
    patch("notifications", id, { read: true }).then(report);
  };
  Store.readAllNotices = function (to) {
    cache.notices.forEach(function (n) { if (n.to === to) n.read = true; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("notifications").update({ read: true }).eq("to_id", to).eq("read", false);
    }).then(report);
  };

  /* ---------- filling the cache ---------- */
  /* ---------- filling the cache ----------
     Two waves. The first is what every screen needs to draw at all — who
     people are, what they sell, what it may cost — and the page redraws the
     moment it lands rather than waiting on the blog, the ledgers and one
     account's own requests. */
  function absorb(payload) {
    var rows = payload.rows;
    var had = function (name) { return Object.prototype.hasOwnProperty.call(rows, name); };
    // A read that failed comes back as null, not as an empty list, and a list
    // we do not have is not a list with nothing in it. Keeping what the cache
    // already holds is the difference between a page missing one section and
    // a page that has decided nobody is signed in.
    var take = function (name, map, current) {
      if (!had(name)) return current;
      return rows[name] ? rows[name].map(map) : current;
    };

    if (had("profiles") && rows.profiles) cache.profiles = rows.profiles.map(SB.toProfile);
    // The desk's book. Empty for everyone who is not staff, by the function's
    // own rule rather than by this file being careful.
    if (had("contacts") && rows.contacts) {
      var book = {};
      rows.contacts.forEach(function (c) { book[c.id] = c; });
      cache.profiles.forEach(function (p) {
        if (!book[p.id]) return;
        p.email = book[p.id].email || "";
        p.phone = book[p.id].phone || "";
      });
    }
    cache.services = take("services", inService, cache.services);
    cache.types = take("service_types", inType, cache.types);
    cache.reviews = take("reviews", inReview, cache.reviews);
    cache.announcements = take("announcements", inAnnouncement, cache.announcements);
    cache.requests = take("requests", inRequest, cache.requests);
    cache.articles = take("articles", inArticle, cache.articles);
    cache.comments = take("comments", inComment, cache.comments);
    cache.endorsements = take("endorsements", inEndorsement, cache.endorsements);
    cache.agreements = take("agreements", inAgreement, cache.agreements);
    cache.disputes = take("disputes", inDispute, cache.disputes);
    cache.notices = take("notifications", inNotice, cache.notices);
    cache.audit = take("audit_log", inAudit, cache.audit);
    cache.subscriptions = take("subscriptions", inSubscription, cache.subscriptions);
    cache.costs = take("operating_costs", inCost, cache.costs);
    cache.partners = take("partners", inPartner, cache.partners);
    cache.quotes = take("quotes", inQuote, cache.quotes);
    cache.offers = take("offers", inOffer, cache.offers);
    cache.messages = take("messages", inMessage, cache.messages);
    cache.attachments = take("attachments", inAttachment, cache.attachments);
    cache.events = take("request_events", inEvent, cache.events);
    cache.mentorships = take("mentorships", inMentorship, cache.mentorships);
    cache.sessions = take("mentorship_sessions", inSession, cache.sessions);
    cache.rooms = take("mentorship_messages", inRoomSaid, cache.rooms);
    cache.promos = take("promo_codes", inPromo, cache.promos);
    cache.redemptions = take("promo_redemptions", inRedemption, cache.redemptions);
    cache.drafts = take("draft_jobs", inDraft, cache.drafts);
    cache.orders = take("supervision_orders", inOrder, cache.orders);
    cache.invites = take("mentorship_invites", inInvite, cache.invites);
    cache.firms = take("firms", inFirm, cache.firms);
    cache.firmMembers = take("firm_members", inFirmMember, cache.firmMembers);
    cache.slots = take("mentor_slots", inSlot, cache.slots);

    if (had("platform_settings")) cache.settings = inSettings(rows.platform_settings);
    if (had("price_bands") && rows.price_bands) {
      cache.bands = {};
      rows.price_bands.forEach(function (b) {
        cache.bands[b.type_id] = { min: Number(b.min_price), max: Number(b.max_price) };
      });
    }

    keepMe();
    Store.notifyAll();
    if (payload.errors && payload.errors.length) dataProblem(payload.errors);
  }

  Store.hydrate = function () {
    // Both waves leave together — they are separate requests either way — and
    // each is taken in as it lands.
    var core = SB.hydrate(SB.CORE).then(function (d) {
      absorb(d);
      saveWarm();                         // a warm start for the next visit
      ready = true;
      return d;
    });
    // Fifteen of the twenty reads are about one account: their requests,
    // their notices, their threads, the desk's ledgers. A visitor who is not
    // signed in has none of them, and asking anyway was fifteen round trips
    // to be told so.
    var rest = Store.currentId() || global.REST.session()
      ? SB.hydrate(SB.REST).then(absorb)
      : Promise.resolve();
    return Promise.all([core, rest]).then(function () {
      ready = true;
      return cache;
    });
  };

  /** A table the database refused to hand over, named, with the reason it
      gave. The alternative is what happened for a week: a site that looks
      fine, holds half of what it should, and explains nothing. */
  function dataProblem(errors) {
    console.error("Supabase read failed", errors);
    // Nothing answered at all: that is not twenty table-shaped problems, it is
    // one network-shaped one, and it has its own bar with a retry on it.
    var allNetwork = errors.every(function (e) { return e.code === "network"; });
    if (allNetwork) return offline();
    var line = errors.map(function (e) {
      return e.table + ": " + e.message + (e.code ? " (" + e.code + ")" : "");
    }).join(" · ");
    var bar = document.querySelector("[data-datafail]");
    if (!bar) {
      var t = function (k) { return global.I18N ? global.I18N.t(k) : ""; };
      bar = document.createElement("div");
      bar.setAttribute("data-datafail", "");
      bar.className = "offline-bar";
      var title = document.createElement("strong");
      title.textContent = t("sys.dataFailed");
      var body = document.createElement("span");
      body.setAttribute("data-datafail-detail", "");
      bar.appendChild(title); bar.appendChild(body);
      (document.body || document.documentElement).appendChild(bar);
    }
    var detail = bar.querySelector("[data-datafail-detail]");
    if (detail) detail.textContent = line;
  }

  /** Put one freshly-read profile into the cache, replacing what was there. */
  function mergeProfile(me) {
    if (!me) return;
    var seen = false;
    cache.profiles = cache.profiles.map(function (p) {
      if (p.id !== me.id) return p;
      seen = true;
      return me;
    });
    if (!seen) cache.profiles.push(me);
    remember(me);
  }

  /** Keep the remembered copy in step with the real one. */
  function keepMe() {
    var id = Store.currentId();
    if (!id) return remember(null);
    for (var i = 0; i < cache.profiles.length; i++) {
      if (cache.profiles[i].id === id) return remember(cache.profiles[i]);
    }
  }

  var signOut = Store.signOut;
  Store.signOut = function () {
    remember(null);
    return signOut.apply(Store, arguments);
  };

  Store.isReady = function () { return ready; };
  Store.cache = function () { return cache; };

  // Restore the signed-in user before anything draws, so a returning visitor
  // is not shown the guest view for a moment first.
  /** An account Google made on somebody's behalf knows their name and nothing
      else — not their role, not a phone, not a licence. Rather than let them
      wander a site that has quietly decided they are a client, send them once
      to the step that asks. `onboarded` is set the moment they answer, so this
      cannot become a loop, and anyone who registered through the wizard was
      never in it. */
  function needsOnboarding(id) {
    if (!id) return;
    var me = null;
    for (var i = 0; i < cache.profiles.length; i++) {
      if (cache.profiles[i].id === id) me = cache.profiles[i];
    }
    if (!me || me.onboarded) return;
    // Staff are not one of the three answers the wizard offers, so asking them
    // the question has no right answer — and the account was granted by
    // somebody with the database in front of them, which is a better
    // introduction than a form.
    if ((me.roles || []).indexOf("staff") !== -1) return;
    var here = (global.location.pathname.split("/").pop() || "index.html");
    if (here === "signup.html") return;              // already there
    global.location.replace("signup.html?complete=1");
  }

  // Said at once, not after asking whether we are signed in. That question
  // needs the library, and the library may be the very thing that failed —
  // in which case the answer arrives as an error about the network and the
  // real reason, sitting in plain sight in the URL, is never read at all.
  /* Who the database will think we are, as opposed to who this browser has
     remembered. Every ownership rule on the server is written against the
     first one, so every write is addressed with it. */
  var authId = null;
  var authKnown = false;
  Store.authId = function () { return authId; };

  /** Refuse a write we already know the server will refuse, and say why in a
      sentence about the session rather than about the row. Only once the
      provider has actually answered — before that, silence is not a no. */
  function noSession() {
    if (!authKnown || authId) return false;
    // Only when this browser believes somebody is signed in. A guest never
    // reaches a write from the pages, and if one ever did, the database
    // refusing it is the right answer rather than a bar about a session
    // nobody claimed to have.
    if (!Store.currentId()) return false;
    sessionGone();
    return true;
  }
  // Whose session this browser claimed at the moment the page loaded. The
  // check below compares against it rather than against "whoever is signed in
  // now", so somebody who signs in while the first answer is still in flight
  // is not signed straight back out by it.
  var bootSession = Store.currentId();

  var authFail = SB.authError && SB.authError();
  if (authFail) authProblem(authFail.message);

  // The data does not wait to be told who is asking for it. Most of it is
  // public, the rest is decided by a row policy on the server, and holding
  // every read behind "who am I" was the last thing still doing that — it
  // costs nothing when the answer is in this browser's own token, and a whole
  // library-load when the token needs renewing first.
  var hydrating = Store.hydrate().then(function () {
    document.dispatchEvent(new CustomEvent("sessionchange"));
  }).catch(function (e) {
    console.error(e);
    offline();
  });

  SB.currentId().then(function (id) {
    authId = id;
    authKnown = true;
    if (id) SB.cleanUrl && SB.cleanUrl();
    // The browser says one thing and the provider says another. This is the
    // state behind "new row violates row-level security policy": the local
    // session key outlived the provider's, the site drew as signed in, every
    // read went through because most of them are public — and then the first
    // write reached the database carrying no token, so `auth.uid()` was null
    // and the row was refused by a rule doing its job.
    //
    // Saying so is right; signing them out here was not. The answer arrives a
    // second or two after the page has drawn, so the header emptied and
    // filled again on every navigation — which is the same flicker this cache
    // exists to prevent, only worse, because now it looked like being logged
    // out. So the local session is left alone, `authId` stays null, and the
    // bar says the session ended with the way back to it. Writes will refuse
    // themselves with that same explanation rather than a Postgres sentence.
    if (!id && bootSession && Store.currentId() === bootSession) sessionGone();
    if (id) {
      Store.signIn(id);
      // Store.signIn announces a store change, which redraws pages but not the
      // header — that listens for a session change. Coming back from Google
      // this left the site rendering the guest view for somebody who was in
      // fact signed in, which read as the sign-in having failed.
      document.dispatchEvent(new CustomEvent("sessionchange"));
      // One row, asked for by id, rather than waiting on the twenty tables
      // the rest of the site needs. Who you are and what you may do is the
      // one answer every page is blocked on, so it is fetched on its own and
      // arrives first — and it still arrives if the big read is the thing
      // that is failing.
      SB.profile(id).then(function (me) {
        if (!me) return;
        mergeProfile(me);
        Store.notifyAll();
        document.dispatchEvent(new CustomEvent("sessionchange"));
      }).catch(function (e) { console.error(e); });
    }
    // Roles and status arrive with the profiles, so the question of where to
    // send somebody is only answerable once they have.
    return hydrating.then(function () { return needsOnboarding(id); });
  }).catch(function (e) {
    console.error(e);
    // One explanation is enough. If the provider already told us why, a second
    // bar about the network is noise on top of the answer.
    if (!authFail) offline();
  });

  /** The library is fetched at runtime, so a blocked or failing network leaves
      a site that looks perfectly normal and holds nothing — every list empty
      for reasons the person reading it cannot see. Better to say so. */
  /** The provider refused, and said why. Shown rather than logged, because
      the person is looking at a home page wondering what happened. */
  function authProblem(message) {
    if (document.querySelector("[data-authfail]")) return;
    var t = function (k) { return global.I18N ? global.I18N.t(k) : ""; };
    var bar = document.createElement("div");
    bar.setAttribute("data-authfail", "");
    bar.className = "offline-bar";

    var title = document.createElement("strong");
    title.textContent = t("sys.authFailed");
    var body = document.createElement("span");
    body.textContent = message || "";
    var retry = document.createElement("a");
    retry.className = "btn btn--sm";
    retry.href = "login.html";
    retry.textContent = t("sys.authRetry");

    bar.appendChild(title); bar.appendChild(body); bar.appendChild(retry);
    (document.body || document.documentElement).appendChild(bar);
    SB.cleanUrl && SB.cleanUrl();
  }

  function offline() {
    if (document.querySelector("[data-offline]")) return;
    // This runs on a failure that can beat app.js to the ready line, so it
    // builds its own nodes and asks nothing of anything that may not exist
    // yet. Text, not markup: there is no escaping to get wrong.
    var t = function (k) { return global.I18N ? global.I18N.t(k) : ""; };
    var bar = document.createElement("div");
    bar.setAttribute("data-offline", "");
    bar.className = "offline-bar";

    var title = document.createElement("strong");
    title.textContent = t("sys.offlineTitle");
    var body = document.createElement("span");
    body.textContent = t("sys.offlineBody");
    var retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn--sm";
    retry.setAttribute("data-offline-retry", "");
    retry.textContent = t("sys.retry");
    retry.addEventListener("click", function () { global.location.reload(); });

    bar.appendChild(title); bar.appendChild(body); bar.appendChild(retry);
    (document.body || document.documentElement).appendChild(bar);
  }
})(window);
