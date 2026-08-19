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

  function users() {
    // Seed people plus anyone who signed up in this browser.
    return SEED.users.concat(Store.signups());
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
    return SEED.reviews.concat(Store.reviews()).filter(function (r) {
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
    var seeded = SEED.services.filter(function (s) { return s.ownerId === lawyerId; });
    var added = Store.services().filter(function (s) { return s.ownerId === lawyerId; });
    var removed = Store.removedServices();
    return seeded.concat(added).filter(function (s) { return removed.indexOf(s.id) === -1; });
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
    return SEED.requests.concat(Store.requests());
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
    return SEED.endorsements.concat(Store.endorsements())
      .filter(function (e) { return e.internId === internId; });
  }

  /* ---------- articles, likes, comments ---------- */
  function articles() {
    return SEED.articles.concat(Store.articles()).filter(function (a) {
      // A trainee's article waits for a lawyer's signature before it is public.
      var st = Store.articleState(a.id);
      var status = st.status || a.status || "published";
      return status === "published";
    });
  }
  function allArticles() { return SEED.articles.concat(Store.articles()); }
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
    return SEED.comments.concat(Store.comments())
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
