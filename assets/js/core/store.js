/* ==========================================================================
   Store — accounts, session, and everything the visitor creates.

   Two tiers, deliberately:
     • ACCOUNTS + SESSION live in localStorage, so signing up and coming back
       tomorrow works. This is the "saved accounts" decision — real enough to
       use, and the UI says plainly that it lives in this browser only.
     • WORK (requests, comments, quotes…) lives in sessionStorage, so a demo
       run starts clean without wiping the accounts someone registered.
   ========================================================================== */
(function (global) {
  "use strict";

  var ACCOUNTS_KEY = "sanad.accounts";
  var SETTINGS_KEY = "sanad.settings";
  var SESSION_KEY  = "sanad.session.user";
  var WORK_KEY     = "sanad.work";

  function read(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  var accounts = read(localStorage, ACCOUNTS_KEY, []);
  var work = read(sessionStorage, WORK_KEY, {});
  // Attachment bytes, by attachment id. Nothing here is written to storage:
  // it is the one part of the demo that lives and dies with the tab.
  var blobs = {};
  [
    "requests", "requestStates", "services", "removedServices", "reviews",
    "articles", "articleStates", "comments", "endorsements", "applications",
    "agreements", "disputes", "audit", "profiles", "notices",
    "announcements", "subscriptions", "costs", "partners", "bands",
    "types", "removedTypes", "quotes", "offers", "messages", "attachments", "events",
    "mentorships", "sessions", "rooms", "webinars", "seats", "promos", "redemptions",
    "drafts"
  ].forEach(function (k) {
    if (!work[k]) {
      work[k] = (k.indexOf("States") !== -1 || k === "applications" ||
                 k === "profiles" || k === "bands")
        ? {} : [];
    }
  });

  // Platform-wide settings sit beside the accounts rather than with the work:
  // a demo reset wipes what a visitor made, not how the platform is configured.
  // Tax ships switched off — a platform below the registration threshold
  // charges none, and turning it on later is a setting, not a rebuild.
  var settings = read(localStorage, SETTINGS_KEY, {});

  var listeners = [];
  function notify() {
    write(sessionStorage, WORK_KEY, work);
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("storechange"));
  }
  function saveAccounts() { write(localStorage, ACCOUNTS_KEY, accounts); }
  function saveSettings() { write(localStorage, SETTINGS_KEY, settings); }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var Store = {
    /* ---------------- accounts ---------------- */
    signups: function () { return accounts; },

    findAccount: function (email) {
      var e = String(email || "").trim().toLowerCase();
      for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].email.toLowerCase() === e) return accounts[i];
      }
      return null;
    },

    /** Creates the account and signs them in. Resolves to { ok, error, user }.
        A promise either way: on Supabase the work is a network round trip, and
        the sign-up wizard should not have to know which backend answered. */
    register: function (data) {
      var SB = global.SB;
      if (SB && SB.configured()) {
        return SB.register(data).then(function (res) {
          if (res.ok) Store.signIn(res.user.id);
          return res;
        });
      }
      return Promise.resolve(Store.registerLocal(data));
    },

    /** The browser backend's own version, kept whole and separately testable. */
    registerLocal: function (data) {
      if (Store.findAccount(data.email)) return { ok: false, error: "emailTaken" };
      var u = {
        id: uid("u"),
        roles: [data.role],
        activeRole: data.role,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        city: data.city || "",
        password: data.password || "",     // demo only; never a real credential
        avatar: data.avatar || null,
        status: data.role === "client" ? "verified" : "pending",
        createdAt: Date.now(),
        completed: 0,
        responseHours: 12,
        seedRating: 0,
        seedReviews: 0,
        seedHours: 0
      };
      if (data.role === "lawyer") {
        u.licence = {
          number: data.licenceNumber, authority: data.licenceAuthority,
          expiry: data.licenceExpiry, fileName: data.licenceFile || null
        };
        u.specialties = data.specialties || [];
        u.years = data.years || 0;
        u.bio = data.bio || "";
        u.title = data.title || "";
      }
      if (data.role === "intern") {
        u.university = data.university || "";
        u.level = data.level || "";
        u.skills = data.skills || [];
        u.cvName = data.cvFile || null;
        u.bio = data.bio || "";
      }
      accounts.push(u);
      saveAccounts();
      Store.signIn(u.id);
      return { ok: true, user: u };
    },

    /** Changes to a seeded person have no account row to land in, so they go
        to an overlay the model reads on top of the seed — the same shape the
        request states already use. Without it a staff member could not approve
        anybody who came with the demo. */
    profileState: function (id) { return work.profiles[id] || {}; },

    updateAccount: function (id, patch) {
      var u = null;
      for (var i = 0; i < accounts.length; i++) if (accounts[i].id === id) u = accounts[i];
      if (!u) {
        var over = work.profiles[id] || {};
        Object.keys(patch).forEach(function (k) { over[k] = patch[k]; });
        work.profiles[id] = over;
        notify();
        return global.Models ? global.Models.user(id) : null;
      }
      Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
      saveAccounts();
      notify();
      return u;
    },

    /** One account can carry several roles — the decision taken up front. */
    addRole: function (id, role, extra) {
      // Staff is granted on the account, never taken. A path that let someone
      // add it to themselves would hand them every approval on the platform.
      if (role === "staff") return null;
      var u = Store.updateAccount(id, {});
      if (!u || u.roles.indexOf(role) !== -1) return u;
      u.roles.push(role);
      if (role !== "client") u.status = "pending";
      Object.keys(extra || {}).forEach(function (k) { u[k] = extra[k]; });
      saveAccounts();
      notify();
      return u;
    },

    /* ---------------- platform settings ---------------- */
    settings: function () { return settings; },
    setSettings: function (patch) {
      Object.keys(patch || {}).forEach(function (k) { settings[k] = patch[k]; });
      saveSettings();
      notify();
      return settings;
    },

    /* ---------------- session ---------------- */
    currentId: function () {
      try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    },
    signIn: function (id) {
      try { localStorage.setItem(SESSION_KEY, id); } catch (e) {}
      notify();
    },
    signOut: function () {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
      notify();
    },

    /* ---------------- work created during a visit ---------------- */
    requests: function () { return work.requests; },
    /* `done` is called once the request exists somewhere it can be pointed
       at. Here that is immediately; the remote backend calls it when the
       database has given the row an id, which is the only id worth writing
       down anywhere else. */
    addRequest: function (r, done) {
      r.id = r.id || uid("r");
      r.ref = r.ref || ("SND-" + new Date().getFullYear().toString().slice(2) + "-" +
                        String(100000 + work.requests.length + 1).slice(1));
      r.createdAt = Date.now();
      work.requests.push(r);
      Store.logEvent({ requestId: r.id, kind: "placed", byId: r.clientId });
      Store.oweDraft(r.id, r.lawyerId, r.status);
      if (r.lawyerId) {
        Store.logEvent({ requestId: r.id, kind: "lawyer_set", byId: r.clientId, detail: r.lawyerId });
      }
      notify();
      if (done) done(r);
      return r;
    },
    requestState: function (id) { return work.requestStates[id] || {}; },
    setRequest: function (id, patch) {
      var cur = work.requestStates[id] || {};
      var was = { status: cur.status, assignedTo: cur.assignedTo,
                  revisions: cur.revisions || 0 };
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      // Delivery starts the acceptance window, so the moment is stamped where
      // delivery happens rather than at each of the several callers that
      // cause it — one of them would eventually be written without it.
      if (patch.status === "delivered" && !cur.deliveredAt) cur.deliveredAt = Date.now();
      if (patch.status === "completed" && !cur.acceptedAt) cur.acceptedAt = Date.now();
      work.requestStates[id] = cur;

      // The same lines the database trigger writes on the real backend, so a
      // timeline reads the same either way.
      var by = Store.currentId();
      // The first thing the lawyer on a request does to it is them taking it
      // on — the one moment nothing else records.
      var req = null;
      work.requests.forEach(function (x) { if (x.id === id) req = x; });
      if (by && req && by === req.lawyerId &&
          !work.events.some(function (e) { return e.requestId === id && e.kind === "taken"; })) {
        Store.logEvent({ requestId: id, kind: "taken", byId: by });
      }
      if (patch.status && patch.status !== was.status) {
        Store.logEvent({ requestId: id, kind: "status:" + patch.status,
                         byId: by, detail: was.status || null });

        // A screening that ends with "yes, you have a case" is the one moment
        // the client is ready to hear what the full thing costs. The offer is
        // a real code cut for that person — one use, thirty days — mirroring
        // offer_conversion() in migration 020 rather than being a banner.
        if (patch.status === "completed" && req && req.typeId === "free_screening" &&
            req.lawyerId) {
          var offer = "SND" + String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
          if (!Store.promoByCode(offer)) {
            Store.addPromo({ code: offer, discountPct: 10, clientId: req.clientId,
                             usageLimit: 1, createdBy: req.lawyerId,
                             expiresAt: Date.now() + 30 * 86400000 });
          }
        }
      }
      if ("assignedTo" in patch && patch.assignedTo !== was.assignedTo) {
        Store.logEvent({ requestId: id,
                         kind: patch.assignedTo ? "assigned" : "unassigned",
                         byId: by, detail: patch.assignedTo || was.assignedTo || null });
      }
      if ((patch.revisions || 0) > was.revisions) {
        Store.logEvent({ requestId: id, kind: "revision", byId: by,
                         detail: patch.revisionNote || null });
      }
      notify();
    },

    services: function () { return work.services; },
    addService: function (s) {
      s.id = s.id || uid("s");
      work.services.push(s);
      notify();
      return s;
    },
    removeService: function (id) {
      work.removedServices = work.removedServices || [];
      if (work.removedServices.indexOf(id) === -1) work.removedServices.push(id);
      work.services = work.services.filter(function (s) { return s.id !== id; });
      notify();
    },
    removedServices: function () { return work.removedServices || []; },

    /* ---------------- trainees applying for an open task ----------------
       A lawyer may hand a task to one trainee, or open it to all of them. In
       the second case the trainees apply here and the lawyer picks. */
    applicants: function (requestId) { return work.applications[requestId] || []; },
    apply: function (requestId, internId) {
      var list = work.applications[requestId] || (work.applications[requestId] = []);
      if (list.indexOf(internId) !== -1) return false;
      list.push(internId);
      notify();
      return true;
    },
    clearApplicants: function (requestId) {
      delete work.applications[requestId];
      notify();
    },

    /* ---------------- what a trainee is paid ----------------
       By default a routed task carries a percentage of what the client paid.
       A lawyer may instead put a standing agreement in place — so many cases,
       or a monthly or yearly retainer — and then that governs instead. */
    agreements: function () { return work.agreements; },
    addAgreement: function (a) {
      a.id = uid("ag");
      a.startedAt = Date.now();
      // One live agreement per pair; a new one replaces whatever stood before.
      work.agreements = work.agreements.filter(function (x) {
        return !(x.lawyerId === a.lawyerId && x.internId === a.internId);
      });
      work.agreements.push(a);
      notify();
      return a;
    },
    endAgreement: function (lawyerId, internId) {
      work.agreements = work.agreements.filter(function (x) {
        return !(x.lawyerId === lawyerId && x.internId === internId);
      });
      notify();
    },

    /* ---------------- notices ----------------
       A bid that closes unseen, or a delivery whose acceptance window runs
       out while the client is looking the other way, spoils the best flow
       anyone could design. So the events that carry a deadline or a decision
       tell the people they belong to.

       The notice carries a type and a reference, never the contents of the
       thing it points at — someone reading over a shoulder learns that a
       request moved, not what it says. */
    notices: function () { return work.notices; },
    notify: function (n) {
      if (!n.to) return null;
      // The same event twice is one notice: a page that redraws must not be
      // able to fill somebody's list with copies of itself.
      var dup = work.notices.some(function (x) {
        return x.to === n.to && x.type === n.type && x.ref === n.ref;
      });
      if (dup) return null;
      n.id = uid("n");
      n.at = Date.now();
      n.read = false;
      work.notices.push(n);
      notify();
      return n;
    },
    readNotice: function (id) {
      work.notices.forEach(function (n) { if (n.id === id) n.read = true; });
      notify();
    },
    readAllNotices: function (to) {
      work.notices.forEach(function (n) { if (n.to === to) n.read = true; });
      notify();
    },

    /* ---------------- what the platform runs on ----------------
       Announcements, the drafting subscription, the running costs and who
       shares what is left. All four are the platform talking about itself, so
       all four are written from one place and read from wherever they belong. */
    announcements: function () { return work.announcements; },
    addAnnouncement: function (a) {
      a.id = uid("an");
      a.at = Date.now();
      if (a.active === undefined) a.active = true;
      work.announcements.unshift(a);
      notify();
      return a;
    },
    setAnnouncement: function (id, patch) {
      work.announcements.forEach(function (a) {
        if (a.id === id) Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
      });
      notify();
    },
    removeAnnouncement: function (id) {
      work.announcements = work.announcements.filter(function (a) { return a.id !== id; });
      notify();
    },

    subscriptions: function () { return work.subscriptions; },
    setSubscription: function (lawyerId, sub) {
      var found = null;
      work.subscriptions.forEach(function (s) { if (s.lawyerId === lawyerId) found = s; });
      if (!found) {
        found = { id: uid("sub"), lawyerId: lawyerId, plan: "ai", startedAt: Date.now() };
        work.subscriptions.push(found);
      }
      Object.keys(sub || {}).forEach(function (k) { found[k] = sub[k]; });
      notify();
      return found;
    },

    costs: function () { return work.costs; },
    addCost: function (c) {
      c.id = uid("cost");
      c.at = Date.now();
      work.costs.unshift(c);
      notify();
      return c;
    },
    removeCost: function (id) {
      work.costs = work.costs.filter(function (c) { return c.id !== id; });
      notify();
    },

    partners: function () { return work.partners; },
    addPartner: function (p) {
      p.id = uid("prt");
      work.partners.push(p);
      notify();
      return p;
    },
    removePartner: function (id) {
      work.partners = work.partners.filter(function (p) { return p.id !== id; });
      notify();
    },

    /** Price bands the platform publishes, overriding the seeded defaults. */
    bands: function () { return work.bands; },
    setBand: function (typeId, band) {
      work.bands[typeId] = { min: band.min, max: band.max };
      notify();
    },

    /* ---------------- the audit trail ----------------
       Approvals, rejections and decisions are written down because the point
       of them is that somebody can be asked afterwards why. Append only. */
    audit: function () { return work.audit; },
    log: function (entry) {
      entry.id = uid("log");
      entry.at = Date.now();
      work.audit.push(entry);
      notify();
      return entry;
    },

    /* ---------------- disputes ----------------
       A delivery the client refuses. Opening one freezes the money; only a
       staff decision moves it after that. Nothing here is ever deleted — a
       dispute closes by changing state, because the record of what was
       claimed and what was decided is the whole point of having one. */
    disputes: function () { return work.disputes; },
    disputeFor: function (requestId) {
      var all = work.disputes;
      for (var i = 0; i < all.length; i++) {
        if (all[i].requestId === requestId) return all[i];
      }
      return null;
    },
    openDispute: function (d) {
      if (Store.disputeFor(d.requestId)) return null;   // one per request
      d.id = uid("d");
      d.ref = "OBJ-" + new Date().getFullYear().toString().slice(2) + "-" +
              String(100000 + work.disputes.length + 1).slice(1);
      d.at = Date.now();
      Store.logEvent({ requestId: d.requestId, kind: "disputed",
                       byId: d.byId, detail: d.reason });
      d.status = "open";
      d.resolution = null;
      work.disputes.push(d);
      notify();
      return d;
    },
    resolveDispute: function (id, decision) {
      var d = null, all = work.disputes;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) d = all[i];
      if (!d || d.status === "resolved") return null;
      d.status = "resolved";
      d.resolution = {
        outcome: decision.outcome,                 // release | refund | split
        lawyerPct: decision.outcome === "split" ? decision.lawyerPct : null,
        reason: decision.reason || "",             // never a code — a written reason
        byId: decision.byId || null,
        at: Date.now()
      };
      Store.logEvent({ requestId: d.requestId, kind: "decided", byId: decision.byId || null,
                       detail: decision.outcome +
                         (decision.reason ? " · " + decision.reason : "") });
      notify();
      return d;
    },

    reviews: function () { return work.reviews; },
    addReview: function (rev) {
      rev.id = uid("rev");
      rev.at = Date.now();
      work.reviews.push(rev);
      notify();
      return rev;
    },

    articles: function () { return work.articles; },
    addArticle: function (a) {
      a.id = a.id || uid("a");
      a.at = Date.now();
      work.articles.push(a);
      notify();
      return a;
    },
    articleState: function (id) { return work.articleStates[id] || {}; },
    setArticle: function (id, patch) {
      var cur = work.articleStates[id] || {};
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      work.articleStates[id] = cur;
      notify();
    },

    comments: function () { return work.comments; },
    addComment: function (c) {
      c.id = uid("c");
      c.at = Date.now();
      work.comments.push(c);
      notify();
      return c;
    },

    endorsements: function () { return work.endorsements; },
    addEndorsement: function (e) {
      e.id = uid("end");
      e.at = Date.now();
      work.endorsements.push(e);
      notify();
      return e;
    },

    /* ---------------- the catalogue ----------------
       What a lawyer can offer to do. The seed carries the six the site
       shipped with; anything the platform adds from the console lives here
       and, on the remote backend, in a table everyone can read. */
    types: function () { return work.types; },
    addType: function (t) {
      t.id = t.id || uid("type");
      work.types.push(t);
      notify();
      return t;
    },
    /* Editing one of the six the site shipped with writes an overlay rather
       than changing the fixture — the same way an approved licence does. The
       merge in models.js puts these on top. */
    setType: function (id, changes) {
      var found = null;
      work.types.forEach(function (t) { if (t.id === id) found = t; });
      if (!found) { found = { id: id }; work.types.push(found); }
      Object.keys(changes).forEach(function (k) { found[k] = changes[k]; });
      notify();
    },
    removeType: function (id) {
      work.types = work.types.filter(function (t) { return t.id !== id; });
      if (work.removedTypes.indexOf(id) === -1) work.removedTypes.push(id);
      notify();
    },
    removedTypes: function () { return work.removedTypes; },

    /** The demo has no server to decide it, so the same rules are applied
        here — and the outcome is recorded the same way: a dispute that was
        already decided, which is what the promise is. */
    refundUnderGuarantee: function (requestId, done) {
      var say = function (word) { if (done) done(word); return Promise.resolve(word); };
      var models = global.Models;
      var r = models && models.request(requestId);
      if (!r) return say("no such request");
      var me = Store.currentId();
      if (r.clientId !== me) return say("not yours");
      var g = models.guarantee(r);
      if (!g.unconditional) return say("not offered");
      if (!g.open) return say("window closed");
      if (Store.disputeFor(requestId)) return say("already disputed");

      Store.openDispute({ requestId: requestId, byId: me, reason: "ضمان الرضا" });
      var d = Store.disputeFor(requestId);
      Store.resolveDispute(d.id, { outcome: "refund", lawyerPct: 0,
                                   reason: "استرداد ضمن نافذة الضمان المعلنة", byId: null });
      Store.setRequest(requestId, { status: "refunded" });
      return say("refunded");
    },

    /* ---------------- what happened to a case ----------------
       The remote backend writes this from a trigger, where it cannot be
       forgotten. Here the callers append it, which is the same record by a
       weaker means — good enough for a demo, and it keeps every screen that
       reads a timeline working without a backend. */
    events: function (requestId) {
      return work.events.filter(function (e) { return e.requestId === requestId; })
        .sort(function (a, b) { return a.at - b.at; });
    },
    logEvent: function (e) {
      e.id = e.id || uid("ev");
      e.at = e.at || Date.now();
      work.events.push(e);
      return e;
    },

    /* ---------------- the conversation on a case ----------------
       Two threads per request. `parties` is the client and whoever is doing
       the work; `internal` is the lawyer and the trainee they routed it to,
       and the client cannot read it — a trainee asking whether the claim is
       even in the right forum is not a message to the person paying for the
       answer.

       Files are part of it rather than a separate feature: what a client
       uploads is a message with something attached to it. */
    messages: function (requestId, audience) {
      return work.messages.filter(function (m) {
        return m.requestId === requestId && m.audience === (audience || "parties");
      }).sort(function (a, b) { return a.at - b.at; });
    },
    attachments: function () { return work.attachments; },
    attachmentsOn: function (messageId) {
      return work.attachments.filter(function (a) { return a.messageId === messageId; });
    },
    /** Files on a case, whichever message carried them — what the request
        page lists under "everything that was sent". */
    filesOf: function (requestId, audience) {
      return work.attachments.filter(function (a) {
        return a.requestId === requestId && a.audience === (audience || "parties");
      }).sort(function (a, b) { return a.at - b.at; });
    },
    sendMessage: function (m, done) {
      m.id = m.id || uid("msg");
      m.at = Date.now();
      m.audience = m.audience || "parties";
      work.messages.push(m);
      notify();
      if (done) done(m);
      return m;
    },
    /** In the demo the file never leaves the browser. The record of it goes
        into the work like everything else; the bytes are held here, beside it,
        because a Blob does not survive being written to sessionStorage — it
        comes back as {}, and asking the browser to make a link out of that
        used to throw rather than say "gone". Reloading the tab loses the
        bytes and keeps the record, which is exactly what demo mode is. */
    attachFile: function (a) {
      a.id = a.id || uid("att");
      a.at = Date.now();
      a.audience = a.audience || "parties";
      if (a.file) blobs[a.id] = a.file;
      work.attachments.push(a);
      notify();
      return a;
    },
    /** The file never left this browser, so the link is made from the copy
        in memory. Nothing is uploaded anywhere in demo mode, by design. */
    fileUrl: function (att) {
      if (!att) return Promise.resolve(null);
      if (att.url) return Promise.resolve(att.url);
      var file = blobs[att.id] || att.file;
      var real = file && typeof global.Blob === "function" && file instanceof global.Blob;
      if (real && global.URL && global.URL.createObjectURL) {
        att.url = global.URL.createObjectURL(file);
        return Promise.resolve(att.url);
      }
      return Promise.resolve(null);
    },

    /* ---------------- the reverse auction ----------------
       A brief and the offers on it. This used to be a single object in this
       browser's sessionStorage, which meant a brief was posted to nobody: no
       lawyer on another machine could see it, and taking an offer set a flag
       and created nothing. It is a list now, and on the remote backend it is
       a pair of tables, so the two sides of an auction are looking at the
       same thing. */
    /* Nothing to fetch: this backend is the only copy there is. Defined so
       the page can ask without knowing which backend it is talking to. */
    refreshAuction: function () { return Promise.resolve(); },
    quotes: function () { return work.quotes; },
    quote: function (id) {
      for (var i = 0; i < work.quotes.length; i++) {
        if (work.quotes[i].id === id) return work.quotes[i];
      }
      return null;
    },
    openQuote: function (q) {
      q.id = q.id || uid("q");
      q.status = q.status || "open";
      q.at = Date.now();
      work.quotes.push(q);
      notify();
      return q;
    },
    setQuote: function (id, changes) {
      var found = null;
      work.quotes.forEach(function (q) {
        if (q.id !== id) return;
        found = q;
        Object.keys(changes).forEach(function (k) { q[k] = changes[k]; });
      });
      notify();
      return found;
    },
    offers: function () { return work.offers; },
    offersOn: function (quoteId) {
      return work.offers.filter(function (o) { return o.quoteId === quoteId; });
    },
    /** One offer per lawyer per brief, on a brief that is still open. Returns
        whether it was taken, because the form says so either way. */
    addOffer: function (offer) {
      var q = Store.quote(offer.quoteId);
      if (!q || q.status !== "open") return false;
      var already = work.offers.some(function (o) {
        return o.quoteId === offer.quoteId && o.lawyer === offer.lawyer;
      });
      if (already) return false;
      offer.id = offer.id || uid("off");
      offer.at = Date.now();
      work.offers.push(offer);
      notify();
      return true;
    },

    /* ---------------- housekeeping ---------------- */
    resetWork: function () {
      work = { requests: [], requestStates: {}, services: [], removedServices: [],
               reviews: [], articles: [], articleStates: {}, comments: [],
               endorsements: [], applications: {}, agreements: [], disputes: [],
               audit: [], profiles: {}, notices: [],
               announcements: [], subscriptions: [], costs: [], partners: [], bands: {},
               types: [], removedTypes: [], quotes: [], offers: [],
               messages: [], attachments: [], events: [],
               mentorships: [], sessions: [], rooms: [], webinars: [], seats: [],
               promos: [], redemptions: [], drafts: [] };
      notify();
    },
    resetAll: function () {
      accounts = []; saveAccounts();
      Store.signOut();
      Store.resetWork();
    },

    /* ---------------- supervision, workshops and discounts ----------------
       The same shape as everything above: a list, a lookup, and a writer that
       ends in notify(). What the database enforces with a policy this
       enforces with nothing at all — which is exactly why the rules live
       there and not here, and why the remote store overrides every one of
       these with a call rather than a copy of the logic. */
    mentorships: function () { return work.mentorships; },
    mentorship: function (id) { return byId(work.mentorships, id); },
    mentorshipOf: function (internId) {
      var out = null;
      work.mentorships.forEach(function (m) {
        if (m.internId === internId && m.status === "active") out = m;
      });
      return out;
    },
    openMentorship: function (m) {
      m.id = m.id || uid("men");
      m.status = m.status || "pending";
      m.at = Date.now();
      work.mentorships.push(m);
      Store.notify({ to: m.openedBy === "intern" ? m.mentorId : m.internId,
                     type: "mentorship", ref: m.id });
      notify();
      return m;
    },
    setMentorship: function (id, patch) {
      var m = byId(work.mentorships, id);
      if (!m) return null;
      Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
      if (patch.status === "active" && !m.startedAt) m.startedAt = Date.now();
      if (patch.status === "ended" && !m.endedAt) m.endedAt = Date.now();
      Store.notify({ to: m.openedBy === "intern" ? m.internId : m.mentorId,
                     type: "mentorship", ref: m.id });
      notify();
      return m;
    },

    /* ---------------- the drafting queue ----------------
       A row that says a draft is owed on this request. The row is the point:
       whatever writes the draft — a function on the server, or the stand-in
       below — has somewhere to be asked from and somewhere to put the answer,
       and nobody has to remember that one was due. */
    drafts: function () { return work.drafts; },
    draftFor: function (requestId) {
      var out = null;
      work.drafts.forEach(function (d) { if (d.requestId === requestId) out = d; });
      return out;
    },
    /** Owe a draft on this request, once, and only to a lawyer paying for the
        tool. Mirrors owe_a_draft() in migration 019. */
    oweDraft: function (requestId, lawyerId, status) {
      if (!lawyerId) return null;
      if (["delivered", "completed", "cancelled", "refunded"].indexOf(status) !== -1) return null;
      // Whether the tool is paid for is a model question, and this file is
      // loaded on its own by the contract test. No model layer, no drafting —
      // which is the right answer rather than a crash.
      if (!global.Models || !global.Models.canDraft(lawyerId)) return null;
      if (Store.draftFor(requestId)) return null;
      var job = { id: uid("job"), requestId: requestId, lawyerId: lawyerId,
                  status: "queued", body: null, at: Date.now(), readyAt: null };
      work.drafts.push(job);
      notify();
      return job;
    },
    setDraft: function (id, patch) {
      var d = byId(work.drafts, id);
      if (!d) return null;
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      if (patch.status === "ready") {
        d.readyAt = d.readyAt || Date.now();
        // A draft nobody is told about is a draft sitting in a table.
        Store.notify({ to: d.lawyerId, type: "draft_ready", ref: d.requestId });
      }
      notify();
      return d;
    },

    /** A trainee claiming a screening. The mentor goes on the request with
        them, because the person who answers is the person answerable for the
        answer — the same rule guard_screening() enforces on the real backend. */
    takeScreening: function (requestId) {
      var me = Store.currentId();
      if (!me) return "not signed in";
      var m = Store.mentorshipOf(me);
      if (!m) return "no mentor";
      var r = byId(work.requests, requestId);
      if (!r || r.typeId !== "free_screening") return "not a screening";
      var st = work.requestStates[requestId] || {};
      if (st.assignedTo) return "taken";
      r.lawyerId = m.mentorId;
      Store.setRequest(requestId, { assignedTo: me, status: "with_intern" });
      return "yours";
    },

    /** A trainee asking a lawyer to supervise them. Answers with a word: the
        page has to say why, and "nothing happened" is not a reason. */
    applyForMentorship: function (mentorId) {
      var me = Store.currentId();
      if (!me) return "not signed in";
      var mentor = global.Models.user(mentorId);
      if (!mentor || !mentor.isMentor || mentor.status !== "verified") return "not offered";
      if (Store.mentorshipOf(me)) return "already";
      Store.openMentorship({ mentorId: mentorId, internId: me, openedBy: "intern",
                             fee: mentor.mentorshipFee || 0 });
      return "sent";
    },
    /** The same relationship from the other end. */
    inviteToMentorship: function (internId) {
      var me = Store.currentId();
      if (!me) return "not signed in";
      if (Store.mentorshipOf(internId)) return "already";
      var mentor = global.Models.user(me);
      Store.openMentorship({ mentorId: me, internId: internId, openedBy: "mentor",
                             fee: (mentor && mentor.mentorshipFee) || 0 });
      return "sent";
    },

    sessions: function () { return work.sessions; },
    addSession: function (s) {
      s.id = s.id || uid("ses");
      s.at = Date.now();
      work.sessions.push(s);
      notify();
      return s;
    },
    setSession: function (id, patch) {
      var s = byId(work.sessions, id);
      if (!s) return null;
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      notify();
      return s;
    },

    /** This month's sponsorship. The real backend does this inside a definer
        function that writes the payment and both payouts; here it is the same
        arithmetic against the same settings, so the demo shows the figures
        somebody would actually be charged. */
    chargeSponsorship: function (mentorshipId, done) {
      var say = function (word) { if (done) done(word); return word; };
      var m = byId(work.mentorships, mentorshipId);
      if (!m) return say("no such mentorship");
      if (Store.currentId() !== m.internId) return say("not yours");
      if (m.status !== "active") return say("not active");
      if (!m.fee) return say("nothing to pay");

      var from = Math.max(m.paidUntil || 0, Date.now());
      var until = new Date(from);
      until.setMonth(until.getMonth() + 1);
      m.paidUntil = until.getTime();
      notify();
      return say("paid");
    },

    /** The supervision room. Its own list, for the same reason it is its own
        table: the case thread is bolted to a request and this is not one. */
    roomMessages: function (mentorshipId) {
      return work.rooms.filter(function (m) { return m.mentorshipId === mentorshipId; });
    },
    sayInRoom: function (m) {
      m.id = m.id || uid("rm");
      m.at = Date.now();
      work.rooms.push(m);
      notify();
      return m;
    },

    webinars: function () { return work.webinars; },
    webinar: function (id) { return byId(work.webinars, id); },
    addWebinar: function (w) {
      w.id = w.id || uid("web");
      w.ref = w.ref || ("WRK-" + new Date().getFullYear().toString().slice(2) + "-" +
                        String(100000 + work.webinars.length + 1).slice(1));
      w.status = w.status || "open";
      w.at = Date.now();
      work.webinars.push(w);
      notify();
      return w;
    },
    setWebinar: function (id, patch) {
      var w = byId(work.webinars, id);
      if (!w) return null;
      Object.keys(patch).forEach(function (k) { w[k] = patch[k]; });
      notify();
      return w;
    },
    seats: function (webinarId) {
      return work.seats.filter(function (s) { return s.webinarId === webinarId; });
    },
    seatOf: function (webinarId, holderId) {
      var out = null;
      work.seats.forEach(function (s) {
        if (s.webinarId === webinarId && s.holderId === holderId) out = s;
      });
      return out;
    },
    /** Returns the seat, or a word saying why there is not one. */
    takeSeat: function (webinarId, holderId) {
      var w = byId(work.webinars, webinarId);
      if (!w) return "no such workshop";
      if (Store.seatOf(webinarId, holderId)) return "already booked";
      if (Store.seats(webinarId).length >= (w.seats || 0)) return "full";
      if (w.startsAt && new Date(w.startsAt).getTime() <= Date.now()) return "started";
      var seat = { id: uid("seat"), webinarId: webinarId, holderId: holderId,
                   price: w.price || 0, attended: false, at: Date.now() };
      work.seats.push(seat);
      if (Store.seats(webinarId).length >= (w.seats || 0)) w.status = "full";
      notify();
      return seat;
    },
    dropSeat: function (webinarId, holderId) {
      work.seats = work.seats.filter(function (s) {
        return !(s.webinarId === webinarId && s.holderId === holderId);
      });
      var w = byId(work.webinars, webinarId);
      if (w && w.status === "full") w.status = "open";
      notify();
    },

    promos: function () { return work.promos; },
    promoByCode: function (code) {
      var want = String(code || "").trim().toUpperCase(), out = null;
      work.promos.forEach(function (p) { if (p.code === want) out = p; });
      return out;
    },
    addPromo: function (p) {
      p.id = p.id || uid("promo");
      p.code = String(p.code || "").trim().toUpperCase();
      p.usedCount = p.usedCount || 0;
      p.active = p.active !== false;
      p.at = Date.now();
      work.promos.push(p);
      notify();
      return p;
    },
    setPromo: function (id, patch) {
      var p = byId(work.promos, id);
      if (!p) return null;
      Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
      notify();
      return p;
    },
    redemptions: function () { return work.redemptions; },
    redemptionOf: function (promoId, clientId) {
      var out = null;
      work.redemptions.forEach(function (r) {
        if (r.promoId === promoId && r.clientId === clientId) out = r;
      });
      return out;
    },
    addRedemption: function (r) {
      r.id = r.id || uid("red");
      r.at = Date.now();
      work.redemptions.push(r);
      var p = byId(work.promos, r.promoId);
      if (p) p.usedCount = (p.usedCount || 0) + 1;
      notify();
      return r;
    },

    /** Spend a code on a request. Answers with a word and with the reason
        behind it, the same pair redeem_promo_code() returns on the real
        backend — so the page reads one shape whichever it is talking to. */
    redeemPromo: function (requestId, code, done) {
      var say = function (word, answer) { if (done) done(word, answer); return word; };
      var r = byId(work.requests, requestId);
      if (!r) return say("no such request");
      var st = work.requestStates[requestId] || {};
      if (["new", "quoting", "assigned", "scheduled"].indexOf(st.status || r.status) === -1) {
        return say("too late", { ok: false, reason: "too late" });
      }
      if ((r.promoDiscount || 0) > 0) {
        return say("already discounted", { ok: false, reason: "already used" });
      }
      var answer = global.Models.promoValue(code, Math.round((r.price || 0) * 100),
                                            r.typeId, r.clientId);
      if (!answer.ok) return say(answer.reason, answer);

      Store.addRedemption({ promoId: answer.promo.id, clientId: r.clientId,
                            requestId: requestId, amount: answer.discount });
      r.promoCode = answer.promo.code;
      r.promoDiscount = answer.discount;
      notify();
      return say("applied", answer);
    },
    clearPromo: function (requestId) {
      var r = byId(work.requests, requestId);
      if (!r) return;
      work.redemptions = work.redemptions.filter(function (x) {
        if (x.requestId !== requestId) return true;
        var p = byId(work.promos, x.promoId);
        if (p) p.usedCount = Math.max(0, (p.usedCount || 0) - 1);
        return false;
      });
      r.promoCode = null;
      r.promoDiscount = 0;
      notify();
    },

    onChange: function (fn) { listeners.push(fn); },

    /** Lets a replacement backend reuse the same notification path, so the
        pages redraw identically however the data arrived. */
    notifyAll: notify
  };

  global.Store = Store;
})(window);
