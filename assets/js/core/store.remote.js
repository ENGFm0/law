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
  function inAgreement(a) {
    return { id: a.id, lawyerId: a.lawyer_id, internId: a.intern_id, kind: a.kind,
             amount: Number(a.amount), cases: a.cases, startedAt: a.started_at };
  }

  /* ---------- the cache ---------- */
  var cache = {
    profiles: [], requests: [], services: [], articles: [],
    reviews: [], comments: [], endorsements: [], agreements: [], applications: {},
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
      ready = true;
      Store.notifyAll();
      return cache;
    });
  };
  Store.isReady = function () { return ready; };
  Store.cache = function () { return cache; };

  // Restore the signed-in user before anything draws, so a returning visitor
  // is not shown the guest view for a moment first.
  SB.currentId().then(function (id) {
    if (id) Store.signIn(id);
    return Store.hydrate();
  }).catch(function (e) { console.error(e); });
})(window);
