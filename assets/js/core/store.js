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
  [
    "requests", "requestStates", "services", "removedServices", "reviews",
    "articles", "articleStates", "comments", "endorsements", "applications",
    "agreements", "disputes"
  ].forEach(function (k) {
    if (!work[k]) work[k] = (k.indexOf("States") !== -1 || k === "applications" ? {} : []);
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

    updateAccount: function (id, patch) {
      var u = null;
      for (var i = 0; i < accounts.length; i++) if (accounts[i].id === id) u = accounts[i];
      if (!u) return null;
      Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
      saveAccounts();
      notify();
      return u;
    },

    /** One account can carry several roles — the decision taken up front. */
    addRole: function (id, role, extra) {
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
    addRequest: function (r) {
      r.id = r.id || uid("r");
      r.createdAt = Date.now();
      work.requests.push(r);
      notify();
      return r;
    },
    requestState: function (id) { return work.requestStates[id] || {}; },
    setRequest: function (id, patch) {
      var cur = work.requestStates[id] || {};
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      // Delivery starts the acceptance window, so the moment is stamped where
      // delivery happens rather than at each of the several callers that
      // cause it — one of them would eventually be written without it.
      if (patch.status === "delivered" && !cur.deliveredAt) cur.deliveredAt = Date.now();
      work.requestStates[id] = cur;
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
      d.at = Date.now();
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

    /* ---------------- quote auction (unchanged behaviour) ---------------- */
    getQuote: function () { return work.quote || null; },
    openQuote: function (q) { work.quote = q; notify(); return q; },
    addOffer: function (offer) {
      if (!work.quote || work.quote.status !== "open") return false;
      if (work.quote.offers.some(function (o) { return o.lawyer === offer.lawyer; })) return false;
      work.quote.offers.push(offer);
      notify();
      return true;
    },
    setQuoteStatus: function (status, extra) {
      if (!work.quote) return;
      work.quote.status = status;
      Object.keys(extra || {}).forEach(function (k) { work.quote[k] = extra[k]; });
      notify();
    },
    clearQuote: function () { delete work.quote; notify(); },

    /* ---------------- housekeeping ---------------- */
    resetWork: function () {
      work = { requests: [], requestStates: {}, services: [], removedServices: [],
               reviews: [], articles: [], articleStates: {}, comments: [],
               endorsements: [], applications: {}, agreements: [], disputes: [] };
      notify();
    },
    resetAll: function () {
      accounts = []; saveAccounts();
      Store.signOut();
      Store.resetWork();
    },

    onChange: function (fn) { listeners.push(fn); },

    /** Lets a replacement backend reuse the same notification path, so the
        pages redraw identically however the data arrived. */
    notifyAll: notify
  };

  global.Store = Store;
})(window);
