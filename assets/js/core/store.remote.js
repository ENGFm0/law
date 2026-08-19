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
      id: r.id, clientId: r.client_id, lawyerId: r.lawyer_id, assignedTo: r.assigned_to,
      typeId: r.type_id, price: Number(r.price), status: r.status,
      ai: !!r.ai_assisted, hours: r.hours || 3, body: r.body || null,
      internShare: r.intern_share, rated: !!r.rated,
      title: pair(r.title), brief: pair(r.brief), ago: pair(""),
    };
  }
  function outRequest(r) {
    return {
      client_id: r.clientId, lawyer_id: r.lawyerId || null, assigned_to: r.assignedTo || null,
      type_id: r.typeId, title: flat(r.title), brief: flat(r.brief),
      price: r.price, status: r.status || "new", ai_assisted: !!r.ai, hours: r.hours || 3,
    };
  }

  function inService(s) {
    return {
      id: s.id, ownerId: s.owner_id, typeId: s.type_id, price: Number(s.price),
      active: s.active !== false,
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
      id: d.id, requestId: d.request_id, byId: d.by_id, reason: d.reason,
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
    return s ? { commissionPct: s.commission_pct, vatEnabled: !!s.vat_enabled,
                 vatPct: s.vat_pct } : {};
  }

  function inAgreement(a) {
    return { id: a.id, lawyerId: a.lawyer_id, internId: a.intern_id, kind: a.kind,
             amount: Number(a.amount), cases: a.cases, startedAt: a.started_at };
  }

  /* ---------- the cache ---------- */
  var cache = {
    profiles: [], requests: [], services: [], articles: [],
    reviews: [], comments: [], endorsements: [], agreements: [], applications: {},
    disputes: [], notices: [], audit: [], settings: {},
  };
  var ready = false;

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
  function report(res) {
    if (res && res.error && global.App) {
      console.error(res.error);
      global.App.toast(res.error.message, "close");
    }
    return res;
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
                 rated: r.rated, internShare: r.internShare };
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

  Store.addRequest = function (r) {
    var row = outRequest(r);
    push("requests", row).then(function (res) {
      report(res);
      if (res && res.data) { r.id = res.data.id; Store.notifyAll(); }
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
    for (var i = 0; i < cache.requests.length; i++) {
      if (cache.requests[i].id === id) {
        Object.keys(changes).forEach(function (k) { cache.requests[i][k] = changes[k]; });
      }
    }
    Store.notifyAll();
    if (Object.keys(row).length) patch("requests", id, row).then(report);
  };

  Store.addService = function (s) {
    var row = { owner_id: s.ownerId, type_id: s.typeId, price: s.price,
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
    Object.keys(row).forEach(function (k) { if (row[k] == null) delete row[k]; });
    if (changes.skills) row.skills = changes.skills.map(flat);
    if (Object.keys(row).length) patch("profiles", id, row).then(report);
    return me;
  };

  /* ---------- the desk, the notices and the record ----------
     All four were the last things still living only in this browser: the desk
     worked, and worked differently on every device you opened it from. They
     write through like everything else — the cache moves first so the screen
     answers, the row follows, and a refusal is reported rather than left to
     look like it succeeded. */
  Store.settings = function () { return cache.settings; };
  Store.setSettings = function (p) {
    Object.keys(p || {}).forEach(function (k) { cache.settings[k] = p[k]; });
    Store.notifyAll();
    SB.load().then(function (sb) {
      return sb.from("platform_settings").update({
        commission_pct: cache.settings.commissionPct,
        vat_enabled: !!cache.settings.vatEnabled,
        vat_pct: cache.settings.vatPct,
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
    var dup = cache.notices.some(function (x) {
      return x.to === n.to && x.type === n.type && x.ref === n.ref;
    });
    if (dup) return null;
    n.at = Date.now();
    n.read = false;
    cache.notices.push(n);
    Store.notifyAll();
    // A notice raised for somebody else cannot be read back by the sender, so
    // no row is selected here — and the unique key means a duplicate is a
    // refusal to record, not an error worth showing anyone.
    SB.load().then(function (sb) {
      return sb.from("notifications").insert({ to_id: n.to, type: n.type, ref: n.ref || null });
    }).then(function (res) {
      if (res && res.error && res.error.code !== "23505") report(res);
    });
    return n;
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
  Store.hydrate = function () {
    return SB.hydrate().then(function (d) {
      cache.profiles = d.profiles;
      cache.requests = d.requests.map(inRequest);
      cache.services = d.services.map(inService);
      cache.articles = d.articles.map(inArticle);
      cache.reviews = d.reviews.map(inReview);
      cache.comments = d.comments.map(inComment);
      cache.endorsements = d.endorsements.map(inEndorsement);
      cache.agreements = d.agreements.map(inAgreement);
      // Defensive: a table the account may not read comes back empty, and a
      // database that predates a migration returns nothing at all. Neither is
      // a reason for the whole site to fail to start.
      cache.disputes = (d.disputes || []).map(inDispute);
      cache.notices = (d.notices || []).map(inNotice);
      cache.audit = (d.audit || []).map(inAudit);
      cache.settings = inSettings(d.settings);
      ready = true;
      Store.notifyAll();
      return cache;
    });
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
    var here = (global.location.pathname.split("/").pop() || "index.html");
    if (here === "signup.html") return;              // already there
    global.location.replace("signup.html?complete=1");
  }

  SB.currentId().then(function (id) {
    if (id) {
      Store.signIn(id);
      // Store.signIn announces a store change, which redraws pages but not the
      // header — that listens for a session change. Coming back from Google
      // this left the site rendering the guest view for somebody who was in
      // fact signed in, which read as the sign-in having failed.
      document.dispatchEvent(new CustomEvent("sessionchange"));
    }
    return Store.hydrate().then(function () {
      // Roles and status arrive with the profiles, so the navigation is only
      // right once they have.
      document.dispatchEvent(new CustomEvent("sessionchange"));
      return needsOnboarding(id);
    });
  }).catch(function (e) { console.error(e); });
})(window);
