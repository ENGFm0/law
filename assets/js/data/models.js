/* ==========================================================================
   Entity model — the relations the old flat arrays never had.
   Everything is addressed by id, so an article knows its author, a request
   knows its client and lawyer, and a comment knows both.

   Derived values (rank, average rating, training hours) are COMPUTED here,
   never stored, so two numbers can never disagree.
   ========================================================================== */
(function (global) {
  "use strict";

  var SEED = global.SEED;
  var Store = global.Store;

  /* ---------- id lookups ---------- */
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- users & profiles ---------- */
  function user(id) { return byId(users(), id); }

  /** Demo people exist only in demo mode. On a real project the accounts that
      signed up are the only accounts there are — inventing six lawyers on a
      live platform would be a lie told to its first visitor. */
  function seeded(list) {
    return (global.SANAD_CONFIG || {}).backend === "supabase" ? [] : list;
  }

  function users() {
    return seeded(SEED.users).concat(Store.signups());
  }

  function lawyers() {
    return users().filter(function (u) { return u.roles.indexOf("lawyer") !== -1; });
  }
  function interns() {
    return users().filter(function (u) { return u.roles.indexOf("intern") !== -1; });
  }

  /** Only verified lawyers are offered to clients; the rest are still setting up. */
  function listedLawyers() {
    return lawyers().filter(function (u) { return u.status === "verified"; });
  }

  /* ---------- reviews & rating ---------- */
  function reviewsFor(userId) {
    return seeded(SEED.reviews).concat(Store.reviews()).filter(function (r) {
      return r.targetId === userId;
    });
  }

  function ratingOf(userId) {
    var rs = reviewsFor(userId);
    if (!rs.length) {
      var u = user(userId);
      return u && u.seedRating ? { avg: u.seedRating, count: u.seedReviews || 0 } : { avg: 0, count: 0 };
    }
    var sum = rs.reduce(function (t, r) { return t + r.rating; }, 0);
    var u2 = user(userId);
    // Seed figures stand in for history this demo does not carry row by row.
    var baseCount = (u2 && u2.seedReviews) || 0;
    var baseSum = baseCount * ((u2 && u2.seedRating) || 0);
    var count = baseCount + rs.length;
    return { avg: Math.round(((baseSum + sum) / count) * 10) / 10, count: count };
  }

  /** How many of each star this person has. Seed history has no rows of its
      own, so it is spread around the seeded average rather than invented. */
  function ratingSpread(userId) {
    var out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsFor(userId).forEach(function (r) {
      var k = Math.max(1, Math.min(5, Math.round(r.rating)));
      out[k]++;
    });
    var u = user(userId);
    var base = (u && u.seedReviews) || 0;
    if (base) {
      var avg = (u && u.seedRating) || 5;
      var top = Math.min(5, Math.floor(avg));
      var share = avg - top;                       // how far above `top` it sits
      var upper = Math.round(base * share);
      out[Math.min(5, top + 1)] += upper;
      out[top] += base - upper;
    }
    return out;
  }

  /* ---------- ranking ----------
     A blend, as decided: rating carries the most weight, then delivered work,
     then responsiveness. Exposed with its parts so the person ranked can see
     what would move them. */
  function scoreOf(u) {
    var r = ratingOf(u.id);
    var rating = (r.avg / 5) * 60;                       // out of 60
    var volume = Math.min(u.completed || 0, 100) / 100 * 25;  // out of 25
    var speed = Math.max(0, 1 - (u.responseHours || 24) / 24) * 15; // out of 15
    return {
      total: Math.round(rating + volume + speed),
      rating: Math.round(rating), volume: Math.round(volume), speed: Math.round(speed)
    };
  }

  /** Rank within one role's cohort. 1 is best. */
  function rankOf(userId, role) {
    var cohort = (role === "intern" ? interns() : lawyers())
      .map(function (u) { return { id: u.id, score: scoreOf(u).total }; })
      .sort(function (a, b) { return b.score - a.score; });
    for (var i = 0; i < cohort.length; i++) {
      if (cohort[i].id === userId) return { rank: i + 1, of: cohort.length };
    }
    return { rank: null, of: cohort.length };
  }

  function leaderboard(role) {
    return (role === "intern" ? interns() : lawyers())
      .map(function (u) { return { user: u, score: scoreOf(u), rating: ratingOf(u.id) }; })
      .sort(function (a, b) { return b.score.total - a.score.total; });
  }

  /* ---------- services ----------
     A lawyer sets their own price, but only inside the band the platform
     publishes for that service type — decided to stop undercutting and gouging. */
  function serviceTypes() { return SEED.serviceTypes; }
  function serviceType(id) { return byId(SEED.serviceTypes, id); }

  function servicesOf(lawyerId) {
    var own = seeded(SEED.services).filter(function (s) { return s.ownerId === lawyerId; });
    var added = Store.services().filter(function (s) { return s.ownerId === lawyerId; });
    var removed = Store.removedServices();
    return own.concat(added).filter(function (s) { return removed.indexOf(s.id) === -1; });
  }

  /* A lawyer names their own service; the category behind it only fixes the
     price band and the icon. Anything unnamed falls back to the category. */
  function serviceTitle(s) {
    if (s.title) return s.title;
    var t = serviceType(s.typeId);
    return t ? t.title : {};
  }
  function serviceMeta(s) {
    if (s.meta) return s.meta;
    var t = serviceType(s.typeId);
    return t ? t.meta : {};
  }
  function serviceIcon(s) {
    var t = serviceType(s.typeId);
    return (t && t.icon) || "tag";
  }

  function priceBand(typeId) {
    var t = serviceType(typeId);
    return t ? { min: t.minPrice, max: t.maxPrice } : { min: 0, max: 0 };
  }

  /** Returns null when the price is fine, or the reason it is not. */
  function checkPrice(typeId, price) {
    var band = priceBand(typeId);
    if (!price || isNaN(price)) return "empty";
    if (price < band.min) return "low";
    if (price > band.max) return "high";
    return null;
  }

  /* ---------- requests ---------- */
  function requests() {
    return seeded(SEED.requests).concat(Store.requests());
  }
  function request(id) { return byId(requests(), id); }

  /** Live state comes from the store; the seed row is only the starting point.
      Whatever the store holds wins, field by field — enumerating a fixed list
      here once meant a newly stored field (the trainee's share) silently
      vanished on the way out. */
  function requestState(r) {
    var out = {
      status: r.status,
      assignedTo: r.assignedTo || null,
      body: r.body || null,
      rated: false,
      internShare: null
    };
    var live = Store.requestState(r.id);
    Object.keys(live).forEach(function (k) {
      if (live[k] !== undefined) out[k] = live[k];
    });
    out.rated = !!out.rated;
    return out;
  }

  // A booked appointment is still a live request — it belongs with the current
  // ones, not the history.
  var OPEN_STATES = ["new", "quoting", "assigned", "scheduled", "drafted",
                     "open_to_interns", "with_intern", "in_progress"];

  function requestsForClient(clientId, which) {
    return requests().filter(function (r) {
      if (r.clientId !== clientId) return false;
      var st = requestState(r).status;
      var open = OPEN_STATES.indexOf(st) !== -1;
      return which === "past" ? !open : open;
    });
  }

  function requestsForLawyer(lawyerId) {
    return requests().filter(function (r) { return r.lawyerId === lawyerId; });
  }

  function requestsForIntern(internId) {
    return requests().filter(function (r) { return requestState(r).assignedTo === internId; });
  }

  /** Tasks a lawyer opened to every trainee, still waiting to be handed out. */
  function openInternTasks() {
    return requests().filter(function (r) {
      var st = requestState(r);
      return st.status === "open_to_interns" && !st.assignedTo;
    });
  }

  /* ---------- what a trainee is paid ----------
     Two ways, and the standing one wins. Without an agreement each routed task
     carries its own percentage of what the client paid; with one, the pair have
     already settled the terms and the per-task share does not apply. */
  // 30% is the floor the platform guarantees a trainee. A lawyer may pay more,
  // never less, so the share is clamped on the way out as well as on the way in.
  var MIN_SHARE = 30;
  var DEFAULT_SHARE = 30;

  function clampShare(n) {
    if (n == null || isNaN(n)) return DEFAULT_SHARE;
    return Math.max(MIN_SHARE, Math.min(100, Math.round(n)));
  }

  function agreementFor(lawyerId, internId) {
    var all = Store.agreements();
    for (var i = 0; i < all.length; i++) {
      if (all[i].lawyerId === lawyerId && all[i].internId === internId) return all[i];
    }
    return null;
  }

  function agreementsOfIntern(internId) {
    return Store.agreements().filter(function (a) { return a.internId === internId; });
  }

  /** What this one task pays the trainee, and under what arrangement. */
  function taskPay(r) {
    var st = requestState(r);
    if (!st.assignedTo) return null;
    var deal = agreementFor(r.lawyerId, st.assignedTo);
    if (deal) {
      return { kind: deal.kind, agreement: deal, amount: deal.kind === "cases" ? deal.amount : 0 };
    }
    var pct = clampShare(st.internShare);
    return { kind: "share", pct: pct, amount: Math.round((r.price || 0) * pct / 100) };
  }

  /** Everything a trainee has actually earned from delivered work. */
  function earnedBy(internId) {
    return requestsForIntern(internId).reduce(function (total, r) {
      var st = requestState(r).status;
      if (st !== "delivered" && st !== "completed") return total;
      var pay = taskPay(r);
      return total + (pay ? pay.amount : 0);
    }, 0);
  }

  /** How far through a by-the-case agreement the pair have got. */
  function casesDone(deal) {
    return requests().filter(function (r) {
      var st = requestState(r);
      return r.lawyerId === deal.lawyerId && st.assignedTo === deal.internId &&
             (st.status === "delivered" || st.status === "completed");
    }).length;
  }

  /* ---------- money ----------
     Everything here is in halalas. A percentage of a riyal is rarely a whole
     riyal, and three shares taken out of one price have to add back up to it
     exactly — so the arithmetic is done in the smallest unit and the lawyer
     takes the remainder rather than a rounded figure of their own. Nobody
     loses a halala to rounding, and nobody invents one.

     The client pays the advertised price. The platform's commission comes out
     of the lawyer's side, not on top of what the client was quoted, and the
     trainee's share is measured against the value of the task itself. */
  var COMMISSION_MAX_PCT = 10;
  var DEFAULT_COMMISSION_PCT = 10;
  var DEFAULT_VAT_PCT = 15;

  function clampCommission(n) {
    if (n == null || isNaN(n)) return DEFAULT_COMMISSION_PCT;
    return Math.max(0, Math.min(COMMISSION_MAX_PCT, Math.round(n)));
  }

  /** How the platform is configured to charge. Tax is off until the platform
      is actually registered for it — below the threshold there is none to
      charge, and switching it on later is this setting, not a rebuild. */
  function platformSettings() {
    var s = Store.settings() || {};
    return {
      commissionPct: clampCommission(s.commissionPct),
      vatEnabled: !!s.vatEnabled,
      vatPct: s.vatPct == null ? DEFAULT_VAT_PCT : Math.max(0, Math.min(100, s.vatPct))
    };
  }

  /** Returns null when the two shares can live together, or why they cannot.
      A commission and a trainee share that add past the whole would leave the
      lawyer working for nothing — or for less than nothing. */
  function checkSplit(commissionPct, internPct) {
    var c = clampCommission(commissionPct), i = clampShare(internPct);
    if (c + i > 100) return "over";
    return null;
  }

  function pct(halalas, p) { return Math.round(halalas * p / 100); }

  /** Who gets what out of one request, to the halala.

      `client` is what the client is charged; `lawyer` is whatever is left
      after every other share, so the parts always reconstitute the whole. */
  function distribute(r) {
    var cfg = platformSettings();
    var st = requestState(r);
    var gross = Math.round((r.price || 0) * 100);

    // The legal service is the lawyer's supply, so it carries tax only if the
    // lawyer is registered for it. The platform's own supply is the
    // commission, and that carries tax whenever the platform is registered.
    var lawyer = user(r.lawyerId);
    var serviceVat = cfg.vatEnabled && lawyer && lawyer.vatRegistered
      ? pct(gross, cfg.vatPct) : 0;

    var commission = pct(gross, cfg.commissionPct);
    var commissionVat = cfg.vatEnabled ? pct(commission, cfg.vatPct) : 0;

    // A standing agreement is paid by the lawyer on its own terms — by the
    // case, monthly or yearly — so it takes nothing out of this one request.
    var pay = taskPay(r);
    var viaAgreement = !!(pay && pay.kind !== "share");
    var internPct = pay && pay.kind === "share" ? pay.pct : null;
    var intern = internPct == null ? 0 : pct(gross, internPct);

    return {
      gross: gross,
      serviceVat: serviceVat,
      client: gross + serviceVat,
      commission: commission,
      commissionVat: commissionVat,
      commissionPct: cfg.commissionPct,
      intern: intern,
      internPct: internPct,
      internId: st.assignedTo || null,
      viaAgreement: viaAgreement,
      lawyer: gross - commission - commissionVat - intern,
      vatEnabled: cfg.vatEnabled,
      vatPct: cfg.vatPct
    };
  }

  /* ---------- accepting a delivery, and refusing one ----------
     A delivery cannot hang unanswered forever: the lawyer would never be paid
     by a client who simply stopped replying. So acceptance has a deadline, and
     silence past it counts as acceptance. The client is not cornered by that —
     inside the window they may ask for the work to be redone once, and if that
     does not settle it they may refuse and have someone else decide.

     Three working days, and the Saudi weekend is Friday and Saturday: a
     delivery on Thursday evening must not eat its whole window before the
     client has had a working day to look at it. */
  var ACCEPT_DAYS = 3;
  var MAX_REVISIONS = 1;

  function addWorkingDays(ts, n) {
    var d = new Date(ts), left = n;
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      var w = d.getDay();
      if (w !== 5 && w !== 6) left--;          // 5 = Friday, 6 = Saturday
    }
    return d.getTime();
  }

  function disputeFor(requestId) { return Store.disputeFor(requestId); }

  function openDisputes() {
    return Store.disputes().filter(function (d) { return d.status === "open"; });
  }

  /** The acceptance state of a delivery, derived rather than stored — a
      deadline that has to be written down to be true is a deadline that drifts
      the moment nobody is looking. */
  function acceptance(r, now) {
    var st = requestState(r);
    var t = now || Date.now();
    var delivered = st.status === "delivered" || st.status === "completed";
    if (!delivered) return { delivered: false };

    var at = st.deliveredAt || r.deliveredAt || null;
    var deadline = at ? addWorkingDays(at, ACCEPT_DAYS) : null;
    var d = disputeFor(r.id);
    var revisions = st.revisions || 0;
    var accepted = st.status === "completed" || !!st.acceptedAt;
    // A dispute stops the clock. Money does not move on a deadline while
    // somebody is still saying the work was not what they paid for.
    var expired = !!(deadline && t >= deadline) && !d;

    return {
      delivered: true,
      deliveredAt: at,
      deadline: deadline,
      msLeft: deadline ? Math.max(0, deadline - t) : null,
      expired: expired,
      accepted: accepted,
      autoAccepted: !accepted && expired,
      settled: accepted || expired,
      revisions: revisions,
      canRevise: !accepted && !d && !expired && revisions < MAX_REVISIONS,
      canDispute: !accepted && !d && !expired,
      dispute: d
    };
  }

  /** What the money does once a dispute has been decided.

      The trainee is the reason this is not simply "split the price". They
      delivered work to the lawyer, not to the client, and a client who wins a
      refund has not been let down by them. So their claim survives the refund
      and the lawyer carries it — otherwise the one party with no say in the
      dispute would be the only one who could lose everything by it. */
  function settlement(r) {
    var base = distribute(r);
    var d = disputeFor(r.id);
    if (!d || d.status !== "resolved") return null;

    var out = d.resolution.outcome;
    var lawyerPct = out === "release" ? 100 : out === "refund" ? 0 : d.resolution.lawyerPct;
    var kept = pct(base.gross, lawyerPct);            // of the price, before shares
    var refund = base.client - kept;

    var commission = pct(kept, base.commissionPct);
    var commissionVat = base.vatEnabled ? pct(commission, base.vatPct) : 0;

    return {
      outcome: out,
      lawyerPct: lawyerPct,
      refund: refund,
      kept: kept,
      commission: commission,
      commissionVat: commissionVat,
      intern: base.intern,
      internPct: base.internPct,
      internId: base.internId,
      // Owed by the lawyer whatever the client got back — never netted off.
      internBorneByLawyer: base.intern > 0 && kept - commission - commissionVat < base.intern,
      lawyer: kept - commission - commissionVat - base.intern,
      reason: d.resolution.reason,
      at: d.resolution.at
    };
  }

  /* ---------- training hours & endorsements ----------
     Hours accumulate from work a lawyer routed to the trainee and that the
     trainee delivered. Past the threshold the supervising lawyer may issue a
     certificate saying they trained with them. */
  var CERT_HOURS = 40;

  function hoursOf(internId) {
    var u = user(internId);
    var base = (u && u.seedHours) || 0;
    var earned = requestsForIntern(internId).reduce(function (t, r) {
      return requestState(r).status === "delivered" || requestState(r).status === "completed"
        ? t + (r.hours || 4) : t;
    }, 0);
    return base + earned;
  }

  function certProgress(internId) {
    var h = hoursOf(internId);
    return { hours: h, needed: CERT_HOURS, pct: Math.min(100, Math.round(h / CERT_HOURS * 100)), eligible: h >= CERT_HOURS };
  }

  function endorsementsFor(internId) {
    return seeded(SEED.endorsements).concat(Store.endorsements())
      .filter(function (e) { return e.internId === internId; });
  }

  /* ---------- articles, likes, comments ---------- */
  function articles() {
    return seeded(SEED.articles).concat(Store.articles()).filter(function (a) {
      // A trainee's article waits for a lawyer's signature before it is public.
      var st = Store.articleState(a.id);
      var status = st.status || a.status || "published";
      return status === "published";
    });
  }
  function allArticles() { return seeded(SEED.articles).concat(Store.articles()); }
  function article(id) { return byId(allArticles(), id); }

  function articlesBy(authorId) {
    return allArticles().filter(function (a) { return a.authorId === authorId; });
  }

  function pendingArticles() {
    return allArticles().filter(function (a) {
      return (Store.articleState(a.id).status || a.status) === "pending";
    });
  }

  function likesOf(articleId) {
    var a = article(articleId);
    var st = Store.articleState(articleId);
    return {
      count: ((a && a.likes) || 0) + (st.liked ? 1 : 0),
      mine: !!st.liked
    };
  }

  function commentsOn(articleId) {
    return seeded(SEED.comments).concat(Store.comments())
      .filter(function (c) { return c.articleId === articleId; })
      .sort(function (x, y) { return (x.at || 0) - (y.at || 0); });
  }

  /* ---------- display helpers ---------- */
  function specialty(id) { return byId(SEED.specialties, id); }
  function city(id) { return byId(SEED.cities, id); }

  /** Where a person's name should link to — the two profile templates. */
  function profileHref(u) {
    if (!u) return "#";
    return (u.roles.indexOf("lawyer") !== -1 ? "lawyer.html?id=" : "intern.html?id=") +
      encodeURIComponent(u.id);
  }

  global.Models = {
    byId: byId,
    users: users, user: user, lawyers: lawyers, interns: interns, listedLawyers: listedLawyers,
    reviewsFor: reviewsFor, ratingOf: ratingOf, ratingSpread: ratingSpread,
    scoreOf: scoreOf, rankOf: rankOf, leaderboard: leaderboard,
    serviceTypes: serviceTypes, serviceType: serviceType, servicesOf: servicesOf,
    priceBand: priceBand, checkPrice: checkPrice,
    serviceTitle: serviceTitle, serviceMeta: serviceMeta, serviceIcon: serviceIcon,
    MIN_SHARE: MIN_SHARE, DEFAULT_SHARE: DEFAULT_SHARE, clampShare: clampShare,
    agreementFor: agreementFor,
    agreementsOfIntern: agreementsOfIntern, taskPay: taskPay,
    COMMISSION_MAX_PCT: COMMISSION_MAX_PCT, DEFAULT_VAT_PCT: DEFAULT_VAT_PCT,
    clampCommission: clampCommission, platformSettings: platformSettings,
    checkSplit: checkSplit, distribute: distribute,
    ACCEPT_DAYS: ACCEPT_DAYS, MAX_REVISIONS: MAX_REVISIONS,
    addWorkingDays: addWorkingDays, acceptance: acceptance, settlement: settlement,
    disputeFor: disputeFor, openDisputes: openDisputes,
    earnedBy: earnedBy, casesDone: casesDone,
    requests: requests, request: request, requestState: requestState,
    requestsForClient: requestsForClient, requestsForLawyer: requestsForLawyer,
    requestsForIntern: requestsForIntern, openInternTasks: openInternTasks,
    CERT_HOURS: CERT_HOURS, hoursOf: hoursOf, certProgress: certProgress,
    endorsementsFor: endorsementsFor,
    articles: articles, allArticles: allArticles, article: article, articlesBy: articlesBy,
    pendingArticles: pendingArticles, likesOf: likesOf, commentsOn: commentsOn,
    specialty: specialty, city: city, profileHref: profileHref
  };
})(window);
