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

  /** A seeded person plus whatever has since been changed about them. Staff
      approving a licence writes to the overlay, not to the fixture. */
  function overlay(u) {
    var live = Store.profileState(u.id);
    var keys = Object.keys(live);
    if (!keys.length) return u;
    var out = {};
    Object.keys(u).forEach(function (k) { out[k] = u[k]; });
    keys.forEach(function (k) { out[k] = live[k]; });
    return out;
  }

  function users() {
    return seeded(SEED.users).map(overlay).concat(Store.signups());
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

  /** Waiting on the platform to check them. A professional role is claimed at
      sign-up and believed by nobody until somebody looks at the licence — so
      this queue is the whole of what "verified" means. */
  function pendingVerification() {
    return users().filter(function (u) {
      return u.status === "pending" &&
        (u.roles.indexOf("lawyer") !== -1 || u.roles.indexOf("intern") !== -1);
    });
  }

  /* ---------- notices ---------- */
  function noticesFor(userId) {
    return Store.notices().filter(function (n) { return n.to === userId; })
      .slice().sort(function (a, b) { return b.at - a.at; });
  }
  function unreadFor(userId) {
    return Store.notices().filter(function (n) { return n.to === userId && !n.read; }).length;
  }
  /** Everyone who should hear about something happening on a request. */
  function partiesOf(r, exclude) {
    var st = requestState(r);
    return [r.clientId, r.lawyerId, st.assignedTo].filter(function (id, i, a) {
      return id && id !== exclude && a.indexOf(id) === i;
    });
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

  /** The cohort a rank is measured against: people the platform has actually
      approved. Someone still waiting on their licence has not earned a place
      in the ranking, and counting them would move everyone else's. */
  function ranked(role) {
    return (role === "intern" ? interns() : lawyers())
      .filter(function (u) { return u.status === "verified"; });
  }

  /** Rank within one role's cohort. 1 is best. */
  function rankOf(userId, role) {
    var cohort = ranked(role)
      .map(function (u) { return { id: u.id, score: scoreOf(u).total }; })
      .sort(function (a, b) { return b.score - a.score; });
    for (var i = 0; i < cohort.length; i++) {
      if (cohort[i].id === userId) return { rank: i + 1, of: cohort.length };
    }
    return { rank: null, of: cohort.length };
  }

  function leaderboard(role) {
    return ranked(role)
      .map(function (u) { return { user: u, score: scoreOf(u), rating: ratingOf(u.id) }; })
      .sort(function (a, b) { return b.score.total - a.score.total; });
  }

  /* ---------- services ----------
     A lawyer sets their own price, but only inside the band the platform
     publishes for that service type — decided to stop undercutting and gouging. */
  /** Every category the platform knows about, including the ones it has
      stopped offering — an old service still has to be able to say what it
      was. The seed is the starting point in the demo; on the remote backend
      the table is the catalogue and the seed is only the fallback for a
      database that has not had the migration run against it yet. */
  function allServiceTypes() {
    var extra = (Store.types && Store.types()) || [];
    var gone = (Store.removedTypes && Store.removedTypes()) || [];
    var base = seeded(SEED.serviceTypes);
    if (!extra.length && !base.length) return SEED.serviceTypes;
    var out = base.filter(function (t) { return gone.indexOf(t.id) === -1; });
    extra.forEach(function (t) {
      var at = -1;
      for (var i = 0; i < out.length; i++) if (out[i].id === t.id) at = i;
      if (at === -1) { out.push(t); return; }
      var merged = {};
      Object.keys(out[at]).forEach(function (k) { merged[k] = out[at][k]; });
      Object.keys(t).forEach(function (k) { merged[k] = t[k]; });
      out[at] = merged;
    });
    return out.sort(function (a, b) { return (a.sort || 100) - (b.sort || 100); });
  }

  /** The ones a lawyer may actually pick from today. */
  function serviceTypes() {
    return allServiceTypes().filter(function (t) { return t.active !== false; });
  }

  /* ---------- how the work is delivered ----------
     The channel is not the work. A statement of claim is a statement of claim
     whether it is talked through or handed over as a file — so the category
     carries the band and the price, and the channel is how it happens. */
  function channels() { return SEED.channels || []; }
  function channel(id) { return byId(channels(), id); }

  /** The channels this category allows at all. */
  function channelsFor(typeId) {
    var t = serviceType(typeId);
    return (t && t.channels) || ["text"];
  }

  /** The channels a particular lawyer will take this work through, narrowed to
      what the category permits — a stale row cannot offer video on something
      the platform never allowed it on. */
  function serviceChannels(s) {
    var allowed = channelsFor(s.typeId);
    return ((s.channels && s.channels.length) ? s.channels : allowed)
      .filter(function (id) { return allowed.indexOf(id) !== -1; });
  }

  /** Whether a request happens as a call rather than as a file. Read from the
      channel that was chosen, not from what kind of work it is. */
  function isLive(r) {
    var c = channel(r && r.channel);
    return !!(c && c.live);
  }
  function serviceType(id) { return byId(allServiceTypes(), id); }

  /** Every service on the platform, seeded and added alike. The console needs
      it to answer one question: is anything actually sold under this
      category? */
  function services() {
    var removed = Store.removedServices();
    return seeded(SEED.services).concat(Store.services())
      .filter(function (s) { return removed.indexOf(s.id) === -1; });
  }

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

  /** The band a service must be priced inside. The seed carries a default and
      staff may move it; whatever the platform last published wins. */
  function priceBand(typeId) {
    var set = (Store.bands && Store.bands()) || {};
    if (set[typeId]) return { min: set[typeId].min, max: set[typeId].max };
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

  /* ---------- what happened to a case, in order ----------
     The record the database keeps, the conversation, and the files, merged
     and sorted. One story rather than three lists — which is what somebody
     deciding an objection actually needs to read.

     Every line carries who did it and when, to the minute. `audience` is kept
     on the message lines so a screen can leave the internal ones out when the
     person reading is not entitled to them. */
  function timeline(r, opts) {
    var o = opts || {};
    var id = r && r.id;
    if (!id) return [];
    var out = [];

    // Where a request came from an auction, the story starts before the
    // request exists: the brief the client posted, the offer that won it, and
    // the moment they took it. All three are already rows — the quote, the
    // offer, and the request's own creation — so none of them needs recording
    // twice, only reading in order.
    var q = quotes().filter(function (x) { return x.requestId === id; })[0];
    if (q) {
      out.push({ at: q.at, kind: "brief_posted", byId: q.clientId, sort: -1 });
      var won = offersOn(q.id).filter(function (x) { return x.lawyer === q.acceptedBy; })[0];
      if (won) {
        out.push({ at: won.at, kind: won.auto ? "offer_auto" : "offer_made",
                   byId: won.lawyer, price: won.price, sort: -1 });
      }
    }

    ((Store.events && Store.events(id)) || []).forEach(function (e) {
      // A request born of an accepted offer was "placed" at the moment the
      // client took that offer, which is a different sentence.
      var kind = (q && e.kind === "placed") ? "offer_taken" : e.kind;
      if (q && kind === "lawyer_set") return;      // said by the offer above
      out.push({ at: e.at, kind: kind, byId: e.byId, detail: e.detail, sort: 0 });
    });

    if (o.messages !== false) {
      ["parties", "internal"].forEach(function (side) {
        if (side === "internal" && o.internal === false) return;
        ((Store.messages && Store.messages(id, side)) || []).forEach(function (m) {
          out.push({ at: m.at, kind: "message", byId: m.authorId, audience: side,
                     detail: m.body, files: (Store.attachmentsOn &&
                                             Store.attachmentsOn(m.id)) || [], sort: 1 });
        });
      });
    }

    // A file sent without a message of its own still belongs in the story.
    if (o.messages !== false) {
      ["parties", "internal"].forEach(function (side) {
        if (side === "internal" && o.internal === false) return;
        ((Store.filesOf && Store.filesOf(id, side)) || []).forEach(function (a) {
          if (a.messageId) return;
          out.push({ at: a.at, kind: "file", byId: a.authorId, audience: side,
                     files: [a], sort: 1 });
        });
      });
    }

    return out.sort(function (a, b) { return (a.at - b.at) || (a.sort - b.sort); });
  }

  /** The reference somebody can say out loud. Falls back to the tail of the
      id so a screen never shows an empty column while a migration is pending. */
  function refOf(row) {
    if (!row) return "";
    if (row.ref) return row.ref;
    // A demo fixture predates the sequence that hands these out, and "#r-11"
    // is not something anybody can read down a phone. One is made from its
    // own number and its own date, in the shape a real one has.
    var seq = String(row.id || "").match(/^r-(\d+)$/);
    if (seq) {
      var when = new Date(whenOf(row) || Date.now());
      return "SND-" + String(when.getFullYear()).slice(2) + "-" +
             ("00000" + seq[1]).slice(-5);
    }
    return "#" + String(row.id || "").slice(-6);
  }

  /** Everyone with a part in a request, in the order they joined it. */
  function partyList(r) {
    if (!r) return [];
    var st = requestState(r);
    var out = [];
    var add = function (id, role) {
      if (!id) return;
      out.push({ id: id, role: role, user: user(id) });
    };
    add(r.clientId, "client");
    add(r.lawyerId, "lawyer");
    add(st.assignedTo, "intern");
    return out;
  }

  /* ---------- the reverse auction ----------
     A brief is posted once and answered by whoever can take it. What a lawyer
     is shown is decided here rather than in the page, because it is the same
     question the row-level policy answers on the server: could this person
     do this work? */
  function quotes() { return (Store.quotes && Store.quotes()) || []; }
  function quote(id) { return byId(quotes(), id); }
  function offersOn(quoteId) {
    return (Store.offersOn && Store.offersOn(quoteId)) || [];
  }
  function quoteLive(q) {
    return !!q && q.status === "open" && q.expiresAt > Date.now();
  }
  /** Every brief this client has posted, newest first. */
  function quotesForClient(clientId) {
    return quotes().filter(function (q) { return q.clientId === clientId; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }

  /** Where a brief stands, worked out rather than trusted. A window that ran
      out while nobody had the page open is over whatever the stored status
      still says — the clock that closes it lives in a browser, and browsers
      get closed. */
  function quoteState(q) {
    if (!q) return "cancelled";
    if (q.status === "accepted" || q.status === "cancelled") return q.status;
    return q.expiresAt > Date.now() ? "open" : "expired";
  }

  /** The brief this client is currently watching — the newest one. */
  function myQuote(clientId) {
    return quotesForClient(clientId)[0] || null;
  }

  /** How many lawyers could have answered this brief at all: the ones whose
      listed work matches it. A board with no bids means something different
      when the answer is nought. */
  function lawyersForQuote(q) {
    if (!q) return [];
    return listedLawyers().filter(function (l) {
      if (l.id === q.clientId) return false;
      return servicesOf(l.id).some(function (s) {
        return s.typeId === q.typeId && serviceChannels(s).indexOf(q.channel) !== -1;
      });
    });
  }
  /** Briefs this lawyer could bid on: still open, and work they have actually
      listed through a channel the client asked for. */
  function openQuotesFor(lawyerId) {
    var mine = servicesOf(lawyerId);
    return quotes().filter(function (q) {
      if (!quoteLive(q)) return false;
      if (q.clientId === lawyerId) return false;
      return mine.some(function (s) {
        return s.typeId === q.typeId && serviceChannels(s).indexOf(q.channel) !== -1;
      });
    }).sort(function (a, b) { return (a.expiresAt || 0) - (b.expiresAt || 0); });
  }
  /** What this lawyer would charge for that brief: their own listed price for
      the work, or the middle of the platform's band if they have not listed
      it. Pulled inside the band either way — the band is the platform's
      promise, and a stale row is not a reason to break it. */
  function quotePrice(lawyerId, typeId) {
    var band = priceBand(typeId);
    var own = servicesOf(lawyerId).filter(function (s) { return s.typeId === typeId; })[0];
    var price = own ? own.price : Math.round((band.min + band.max) / 2 / 5) * 5;
    return Math.min(band.max, Math.max(band.min, price));
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

  /** A client's work sorted into the four piles anybody actually thinks in:
      what is happening now, what is booked for later, what is finished, and
      what is being argued about. Nothing appears in two of them. */
  function requestPiles(list) {
    var out = { live: [], booked: [], past: [], disputed: [] };
    (list || []).forEach(function (r) {
      var st = requestState(r).status;
      var d = disputeFor(r.id);
      if (d && d.status === "open") { out.disputed.push(r); return; }
      if (st === "completed" || st === "cancelled" || st === "refunded") {
        out.past.push(r); return;
      }
      // Booked means a time was agreed and has not come yet: a call waiting
      // to happen is not work in progress.
      if (st === "scheduled" || (isLive(r) && st === "new")) { out.booked.push(r); return; }
      out.live.push(r);
    });
    return out;
  }

  /** What stops a client opening a second request: one that is still running,
      or one that was delivered and never rated. Returns the request in the
      way, or null. */
  function blockingRequest(clientId) {
    // Only work this person actually opened. In production that is every
    // request there is — the seed is empty — and in the demo it leaves the
    // fixtures out, which are an illustration of a busy platform rather than
    // one visitor's own commitments.
    var mine = Store.requests().filter(function (r) { return r.clientId === clientId; });
    for (var i = 0; i < mine.length; i++) {
      var st = requestState(mine[i]);
      if (["completed", "cancelled", "refunded"].indexOf(st.status) === -1) return mine[i];
      // Closed, but the lawyer was never rated — the last thing owed.
      if (st.status === "completed" && !st.rated) return mine[i];
    }
    return null;
  }

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

  /** What one person's work on this platform has come to.

      Two numbers, and the difference between them matters: `settled` is work
      that was accepted, so the money is theirs; `pending` is work delivered or
      still in hand, which is a promise rather than a balance. Both are their
      share after the platform's cut — the number they are paid, never the
      number the client paid, because showing somebody a figure they will not
      receive is how a platform gets accused of taking more than it said.

      Halalas, like every other number here that means money. Work paid under
      a standing agreement between a lawyer and a trainee is counted apart: it
      is settled between the two of them and not out of this request. */
  function walletOf(id) {
    var out = { settled: 0, pending: 0, cases: 0, byAgreement: 0 };
    requests().forEach(function (r) {
      var st = requestState(r);
      var seat = r.lawyerId === id ? "lawyer" : (st.assignedTo === id ? "intern" : null);
      if (!seat) return;

      var pay = taskPay(r);
      if (seat === "intern" && pay && pay.kind !== "share") { out.byAgreement += 1; return; }

      var s = settlement(r);
      var d = distribute(r);
      var mine = seat === "lawyer" ? (s ? s.lawyer : d.lawyer) : (s ? s.intern : d.intern);
      if (!mine) return;

      out.cases += 1;
      if (st.status === "completed" || st.status === "refunded") out.settled += mine;
      else if (st.status === "delivered" || OPEN_STATES.indexOf(st.status) !== -1) out.pending += mine;
    });
    return out;
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
    var n = function (v, d) { return v == null || isNaN(v) ? d : Number(v); };
    return {
      commissionPct: clampCommission(s.commissionPct),
      vatEnabled: !!s.vatEnabled,
      vatPct: s.vatPct == null ? DEFAULT_VAT_PCT : Math.max(0, Math.min(100, s.vatPct)),
      // What the gateway takes, per scheme. Settings rather than constants:
      // they are negotiated, they differ by card, and profit reported from a
      // stale figure is worse than profit not reported at all.
      madaPct: n(s.madaPct, 1.5), madaFixed: n(s.madaFixed, 1),
      cardPct: n(s.cardPct, 2.2), cardFixed: n(s.cardFixed, 1),
      madaSharePct: Math.max(0, Math.min(100, n(s.madaSharePct, 70))),
      aiPrice: n(s.aiPrice, 199),
      // The promise the platform publishes: how long after delivery a client
      // may say it was not what they were told, and whether inside that
      // window they decide alone.
      guaranteeHours: Math.max(0, Math.min(168, n(s.guaranteeHours, 24))),
      guaranteeUnconditional: s.guaranteeUnconditional !== false,
      // The experience the directory says it lists. A standard, not a gate:
      // it is shown and it is filterable, and nobody is thrown out by it.
      minYears: Math.max(0, n(s.minYears, 5)),
      // What the platform takes out of a monthly sponsorship, and the band a
      // lawyer may ask inside. Capped at 20 for the same reason the
      // commission is capped at 10: a number nobody can raise quietly.
      sponsorshipPct: Math.max(0, Math.min(20, n(s.sponsorshipPct, 15))),
      sponsorshipMin: Math.max(0, n(s.sponsorshipMin, 50)),
      sponsorshipMax: Math.max(0, n(s.sponsorshipMax, 100))
    };
  }

  /** What the promise means for one delivered request: how long is left of
      it, and whether the client can still act on it alone. */
  function guarantee(r) {
    var cfg = platformSettings();
    var out = { hours: cfg.guaranteeHours, unconditional: cfg.guaranteeUnconditional,
                open: false, msLeft: 0 };
    if (!r || !cfg.guaranteeUnconditional || !cfg.guaranteeHours) return out;
    var st = requestState(r);
    var at = st.deliveredAt || r.deliveredAt || null;
    if (!at) return out;
    if (st.status === "completed" || st.status === "refunded" || st.acceptedAt) return out;
    if (disputeFor(r.id)) return out;
    var until = at + cfg.guaranteeHours * 3600000;
    out.msLeft = Math.max(0, until - Date.now());
    out.open = out.msLeft > 0;
    return out;
  }

  /** Whether this professional meets the experience the platform advertises. */
  function seasoned(u) {
    return !!u && (u.years || 0) >= platformSettings().minYears;
  }

  /** What a category costs at its cheapest, which is the number a price list
      should lead with — "from 100" is a promise anybody can check. */
  function startingPrice(typeId) { return priceBand(typeId).min; }
  function cheapestStart() {
    var all = serviceTypes().map(function (t) { return startingPrice(t.id); })
      .filter(function (n) { return n > 0; });
    return all.length ? Math.min.apply(null, all) : 0;
  }

  /** How long the first offer has actually taken, lately. Reported only when
      there is enough of it to mean anything — a promise about speed that is
      made up is worse than no promise. */
  function typicalFirstOffer() {
    var seen = [];
    quotes().forEach(function (q) {
      var first = null;
      offersOn(q.id).forEach(function (o) {
        if (first === null || o.at < first) first = o.at;
      });
      if (first !== null && q.at && first >= q.at) seen.push((first - q.at) / 60000);
    });
    if (seen.length < 3) return null;
    seen.sort(function (a, b) { return a - b; });
    var mid = seen[Math.floor(seen.length / 2)];
    return Math.max(1, Math.round(mid));
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

    // A promo code comes out of the platform's own cut and out of nothing
    // else. The lawyer's and the trainee's shares are computed off the price
    // above and are not touched here — a platform that runs a sale and bills
    // it to the people doing the work is not running a sale.
    //
    // Which is why it cannot exceed the commission. The figure on the request
    // was capped when it was applied; this caps it again rather than trusting
    // a column, because a settings change afterwards can move the commission
    // underneath a discount that was fine when it was granted.
    var discount = Math.max(0, Math.min(r.promoDiscount || 0, commission));

    return {
      gross: gross,
      serviceVat: serviceVat,
      discount: discount,
      promoCode: discount ? (r.promoCode || null) : null,
      client: gross + serviceVat - discount,
      // What the platform is left with after its own discount.
      commission: commission - discount,
      commissionGross: commission,
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

  /* ---------- promo codes ----------
     The same arithmetic as validate_promo_code() in migration 020, and it has
     to stay the same: this is what the client is shown before they order, and
     being shown one number and charged another is the single worst thing a
     checkout can do. The database is the one that decides — this only has to
     agree with it.

     Returns a reason rather than a boolean, because "why not" is the whole
     of what somebody wants when a code is refused. */
  function promoValue(code, gross, typeId, clientId) {
    var no = function (why) { return { ok: false, reason: why, discount: 0, pct: 0 }; };
    var p = Store.promoByCode ? Store.promoByCode(code) : null;
    if (!p) return no("unknown");
    if (p.active === false) return no("withdrawn");
    if (p.expiresAt && new Date(p.expiresAt).getTime() <= Date.now()) return no("expired");
    if (p.usageLimit != null && (p.usedCount || 0) >= p.usageLimit) return no("used up");
    if (p.clientId && clientId && p.clientId !== clientId) return no("not yours");
    if (p.typeId && typeId && p.typeId !== typeId) return no("wrong service");
    if (clientId && Store.redemptionOf && Store.redemptionOf(p.id, clientId)) {
      return no("already used");
    }
    if (!gross || gross <= 0) return no("nothing to discount");

    var raw = pct(gross, p.discountPct);
    if (p.maxDiscount != null) raw = Math.min(raw, p.maxDiscount);

    var commission = pct(gross, platformSettings().commissionPct);
    if (raw > commission) {
      return { ok: true, reason: "capped", discount: commission,
               pct: p.discountPct, promo: p };
    }
    return { ok: true, reason: "ok", discount: raw, pct: p.discountPct, promo: p };
  }

  /* ---------- the sponsorship ----------
     A trainee with no supervisor pays monthly for one. Same shape as every
     other split here: what was paid, what the platform took, what is owed to
     the person who did the work. Halalas throughout. */
  function sponsorship(m) {
    var cfg = platformSettings();
    var gross = Math.round(((m && m.fee) || 0) * 100);
    var cut = pct(gross, cfg.sponsorshipPct);
    return {
      gross: gross,
      pct: cfg.sponsorshipPct,
      platform: cut,
      lawyer: gross - cut,
      mentorId: m ? m.mentorId : null,
      internId: m ? m.internId : null,
      paidUntil: m ? m.paidUntil : null,
      current: !!(m && m.status === "active" &&
                  (!m.fee || (m.paidUntil && new Date(m.paidUntil).getTime() > Date.now())))
    };
  }

  /** Every trainee this lawyer supervises, and what that comes to a month. */
  function sponsorshipBook(mentorId) {
    var out = { active: 0, pending: 0, gross: 0, platform: 0, lawyer: 0, rows: [] };
    ((Store.mentorships && Store.mentorships()) || []).forEach(function (m) {
      if (m.mentorId !== mentorId) return;
      if (m.status === "pending") { out.pending += 1; return; }
      if (m.status !== "active") return;
      var s = sponsorship(m);
      out.active += 1;
      out.gross += s.gross;
      out.platform += s.platform;
      out.lawyer += s.lawyer;
      out.rows.push({ mentorship: m, user: user(m.internId), split: s });
    });
    return out;
  }

  /* ---------- a workshop ----------
     Seats, not hours. The host keeps what is left after the platform's cut,
     and a seat that was booked at the old price stays booked at the old
     price — which is why the seat carries its own. */
  function ticketSplit(w, seats) {
    var cfg = platformSettings();
    var rows = seats || ((Store.seats && Store.seats(w.id)) || []);
    var gross = 0;
    rows.forEach(function (s) { gross += Math.round((s.price || 0) * 100); });
    var cut = pct(gross, cfg.commissionPct);
    return {
      sold: rows.length,
      seats: w.seats || 0,
      left: Math.max(0, (w.seats || 0) - rows.length),
      gross: gross,
      pct: cfg.commissionPct,
      platform: cut,
      host: gross - cut
    };
  }

  /** Workshops worth showing: the ones that have not happened yet, soonest
      first, and only the ones this person is allowed to be in. */
  function webinarsFor(u) {
    var now = Date.now();
    var role = u ? (u.roles.indexOf("intern") !== -1 ? "intern" : "client") : "client";
    return ((Store.webinars && Store.webinars()) || []).filter(function (w) {
      if (w.status === "cancelled") return false;
      if (w.audience && w.audience !== "all" && w.audience !== role) return false;
      return !w.startsAt || new Date(w.startsAt).getTime() > now;
    }).sort(function (a, b) {
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
  }

  /* ---------- the free screening ----------
     Free, and only taken on by a trainee somebody is actually supervising.
     The database refuses it either way; this is so the button is not drawn in
     the first place. */
  var SCREENING = "free_screening";

  function isScreening(r) { return !!r && r.typeId === SCREENING; }

  function mentorOf(internId) {
    var m = Store.mentorshipOf ? Store.mentorshipOf(internId) : null;
    return m ? user(m.mentorId) : null;
  }

  function canScreen(internId) { return !!mentorOf(internId); }

  /** The offer a finished screening earns: a real code in this person's name,
      not a banner. Mirrors offer_conversion() in migration 020. */
  function conversionOffer(clientId) {
    var best = null;
    ((Store.promos && Store.promos()) || []).forEach(function (p) {
      if (p.clientId !== clientId || p.active === false) return;
      if (p.expiresAt && new Date(p.expiresAt).getTime() <= Date.now()) return;
      if (p.usageLimit != null && (p.usedCount || 0) >= p.usageLimit) return;
      best = p;
    });
    return best;
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

  /* ---------- placement, subscriptions and announcements ---------- */

  /** Lawyers the platform is putting in front of people, in the order it
      chose. A rank rather than a flag, because "first" is an ordering. */
  function featured() {
    var now = Date.now();
    return listedLawyers().filter(function (u) {
      if (u.featuredRank == null) return false;
      return !u.featuredUntil || new Date(u.featuredUntil).getTime() > now;
    }).sort(function (a, b) { return a.featuredRank - b.featuredRank; });
  }

  /** The directory order: placed lawyers first, then everyone else as before. */
  function byPlacement(list) {
    var rank = {};
    featured().forEach(function (u, i) { rank[u.id] = i; });
    return list.slice().sort(function (a, b) {
      var ra = rank[a.id], rb = rank[b.id];
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return 0;
    });
  }

  function subscriptionOf(lawyerId) {
    var all = (Store.subscriptions && Store.subscriptions()) || [];
    var now = Date.now();
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (s.lawyerId !== lawyerId || s.plan !== "ai") continue;
      var live = s.active !== false && (!s.endsAt || new Date(s.endsAt).getTime() > now);
      return { sub: s, active: live };
    }
    return { sub: null, active: false };
  }

  /** The drafting workspace is sold, not given. Staff never need it and are
      not sold it; a lawyer needs a live subscription. */
  function canDraft(userId) {
    var u = user(userId);
    if (!u) return false;
    if ((u.roles || []).indexOf("lawyer") === -1) return false;
    return subscriptionOf(userId).active;
  }

  function announcementsFor(role) {
    var now = Date.now();
    return ((Store.announcements && Store.announcements()) || []).filter(function (a) {
      if (!a.active) return false;
      if (a.audience && a.audience !== "all" && a.audience !== role) return false;
      if (a.startsAt && new Date(a.startsAt).getTime() > now) return false;
      if (a.endsAt && new Date(a.endsAt).getTime() < now) return false;
      return true;
    });
  }

  /* ---------- the books ----------
     Everything in halalas, and every figure derived from the requests that
     actually completed rather than from a running total somebody has to
     remember to update. */

  /** A cost expressed as what it comes to over one month, so a yearly licence
      and a monthly server can be added together and mean something. */
  var PER_MONTH = { once: 0, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  function monthlyCost(c) {
    var amount = Math.round((c.amount || 0) * 100);
    return Math.round(amount * (PER_MONTH[c.period] == null ? 1 : PER_MONTH[c.period]));
  }

  /** One-off costs belong to the month they fall in, not to every month. */
  function costsInWindow(months) {
    var list = (Store.costs && Store.costs()) || [];
    return list.reduce(function (total, c) {
      if (c.period === "once") return total + Math.round((c.amount || 0) * 100);
      return total + monthlyCost(c) * months;
    }, 0);
  }

  /** What the payment gateway takes out of a transaction. It is charged on the
      whole amount the client paid, not on the platform's share of it — which
      is why a 10% commission does not leave 10%. */
  function gatewayFee(clientHalalas, cfg) {
    var mada = Math.round(clientHalalas * cfg.madaPct / 100) + Math.round(cfg.madaFixed * 100);
    var card = Math.round(clientHalalas * cfg.cardPct / 100) + Math.round(cfg.cardFixed * 100);
    var share = cfg.madaSharePct / 100;
    return Math.round(mada * share + card * (1 - share));
  }

  /** Every request whose money is real: delivered, accepted or settled. */
  /** When a request happened. Stored rows carry the moment; the demo's
      fixtures carry an age in days, which is the same fact written for a
      person to read. Zero means unknown, and unknown is never used to exclude
      something from a window — a date nobody wrote is not evidence that the
      work is old. */
  function whenOf(r) {
    if (!r) return 0;
    if (r.createdAt) return r.createdAt;
    var st = requestState(r);
    if (st.deliveredAt) return st.deliveredAt;
    if (typeof r.daysAgo === "number") return Date.now() - r.daysAgo * 86400000;
    return 0;
  }

  /** The start of a window of `months`, counted back from now. */
  function windowFrom(months) {
    var m = months || 1;
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - m, d.getDate()).getTime();
  }

  function inWindow(r, months) {
    var when = whenOf(r);
    return !when || when >= windowFrom(months);
  }

  function earnedRequests() {
    return requests().filter(function (r) {
      var st = requestState(r).status;
      // Refunded work was delivered and did happen: it belongs in the count
      // of orders and in the ledger, at the amount that survived.
      return st === "delivered" || st === "completed" || st === "refunded";
    });
  }

  /** The same trading, cut into buckets over time. The ledger says what the
      window came to; this says what it did on the way — which is the whole
      difference between a number and a shape.

      Weeks for a single month, months beyond it: twelve bars can be read at a
      glance and fifty-two cannot. Labelling is left to the view, which is the
      only part of this that knows what language it is in. */
  function series(months) {
    var m = months || 1;
    var now = new Date();
    var week = 7 * 86400000;
    var buckets = [];

    if (m <= 1) {
      var end = now.getTime();
      for (var w = 3; w >= 0; w--) {
        buckets.push({ from: end - (w + 1) * week, to: end - w * week,
                       at: end - w * week - week / 2, step: "week" });
      }
    } else {
      for (var i = m - 1; i >= 0; i--) {
        var start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        buckets.push({ from: start.getTime(), to: next.getTime(),
                       at: start.getTime(), step: "month" });
      }
    }

    buckets.forEach(function (b) {
      b.orders = 0; b.paid = 0; b.commission = 0; b.refunded = 0;
    });

    earnedRequests().forEach(function (r) {
      var when = whenOf(r);
      if (!when) return;
      var d = distribute(r), st = settlement(r);
      for (var i = 0; i < buckets.length; i++) {
        var b = buckets[i];
        if (when < b.from || when >= b.to) continue;
        b.orders += 1;
        b.paid += d.client - (st ? st.refund : 0);
        b.commission += st ? st.commission : d.commission;
        b.refunded += st ? st.refund : 0;
        return;
      }
    });

    return buckets;
  }

  /* ---------- the stepper ----------
     Four people watch the same request and none of them is watching the same
     thing. A client is waiting to find out whether their problem has an
     answer; a lawyer is watching a piece of work move from their inbox to
     their pay; a trainee is watching a draft go up for a signature; the desk
     is watching all of it at once and looking for where it stuck.

     So the stages are per role rather than one bar relabelled — but they are
     read off the SAME record, so no two of them can disagree about where the
     case actually is. Each step carries the moment it happened, because "in
     progress since when" is the question behind every one of these bars. */
  var STEPS = {
    client: [
      { key: "placed",    on: ["placed", "brief_posted"] },
      { key: "taken",     on: ["taken", "offer_taken", "lawyer_set", "status:assigned",
                               "status:scheduled"] },
      { key: "working",   on: ["status:in_progress", "status:with_intern",
                               "status:drafted", "status:open_to_interns"] },
      { key: "delivered", on: ["status:delivered"] },
      { key: "closed",    on: ["status:completed", "status:refunded"] }
    ],
    lawyer: [
      { key: "arrived",   on: ["placed", "brief_posted", "offer_taken"] },
      { key: "taken",     on: ["taken", "lawyer_set", "status:assigned"] },
      { key: "routed",    on: ["assigned", "status:with_intern", "status:open_to_interns"],
        optional: true },
      { key: "drafted",   on: ["status:drafted"] },
      { key: "delivered", on: ["status:delivered"] },
      { key: "paid",      on: ["status:completed"] }
    ],
    intern: [
      { key: "handed",    on: ["assigned", "status:with_intern"] },
      { key: "talking",   on: ["internal_said"] },
      { key: "submitted", on: ["status:drafted", "status:delivered"] },
      { key: "signed",    on: ["status:delivered", "status:completed"] }
    ],
    staff: [
      { key: "placed",    on: ["placed", "brief_posted"] },
      { key: "taken",     on: ["taken", "offer_taken", "lawyer_set"] },
      { key: "routed",    on: ["assigned"], optional: true },
      { key: "working",   on: ["status:in_progress", "status:with_intern", "status:drafted"] },
      { key: "delivered", on: ["status:delivered"] },
      { key: "closed",    on: ["status:completed", "status:refunded", "status:cancelled"] }
    ]
  };

  /** When each stage happened, from the record rather than from the status.
      A status says where a case is; only the record says when it got there. */
  function stampsOn(r) {
    var out = {};
    ((Store.events && Store.events(r.id)) || []).forEach(function (e) {
      if (out[e.kind] == null) out[e.kind] = e.at;
    });
    // The trainee's stage "talking to the lawyer" is not an event, it is the
    // first thing either of them said out of the client's earshot.
    var said = (Store.messages && Store.messages(r.id, "internal")) || [];
    if (said.length && out.internal_said == null) out.internal_said = said[0].at;
    return out;
  }

  function stepsFor(r, role) {
    var plan = STEPS[role] || STEPS.client;
    var st = requestState(r);
    var d = disputeFor(r.id);
    var held = !!(d && d.status === "open");
    var stamps = stampsOn(r);
    var at = -1;

    var steps = plan.map(function (step, i) {
      var when = null;
      step.on.forEach(function (kind) {
        if (stamps[kind] != null && (when == null || stamps[kind] < when)) {
          when = stamps[kind];
        }
      });
      if (when != null) at = i;
      return { key: step.key, at: when, optional: !!step.optional, done: false, here: false };
    });

    // A record that has nothing in it — a fixture, or a request placed before
    // the log existed — still has a status, and a bar that says "nothing has
    // happened" to somebody looking at delivered work is worse than one drawn
    // from the status alone.
    if (at === -1) {
      var fallback = { "new": 0, quoting: 0, assigned: 1, scheduled: 1,
                       drafted: 2, open_to_interns: 2, with_intern: 2, in_progress: 2,
                       delivered: 3, completed: 4, refunded: 4, cancelled: 4 };
      at = Math.min(steps.length - 1, fallback[st.status] == null ? 0 : fallback[st.status]);
    }

    steps.forEach(function (x, i) {
      x.done = i < at;
      x.here = i === at;
    });

    return {
      role: role, steps: steps, at: at, held: held,
      status: st.status,
      // Whose move it is. The bar says how far along; this says who everyone
      // is waiting for, which is what people actually came to find out.
      waiting: held ? "staff" : waitingFor(st.status, role),
      dispute: d || null
    };
  }

  function waitingFor(status, role) {
    if (status === "delivered") return role === "client" ? "you" : "client";
    if (status === "completed" || status === "refunded" || status === "cancelled") return null;
    if (status === "with_intern" || status === "open_to_interns") {
      return role === "intern" ? "you" : "intern";
    }
    return role === "client" ? "lawyer" : "you";
  }

  /** The whole picture, over a window of `months`. */
  function books(months) {
    var cfg = platformSettings();
    var m = months || 1;
    var out = {
      months: m, orders: 0,
      clientPaid: 0, refunded: 0, gross: 0, toLawyers: 0, toTrainees: 0,
      commission: 0, commissionVat: 0, gateway: 0,
      subscriptions: 0, costs: costsInWindow(m), settings: cfg
    };

    earnedRequests().forEach(function (r) {
      // The window is a window. Counting every order the platform ever took
      // against one month of costs is how a page reports a loss that is not
      // there — or a profit that is not either.
      if (!inWindow(r, m)) return;
      var d = distribute(r);
      // A decided dispute is what actually happened to the money. Reading the
      // books from `distribute` alone counted a fully refunded order as
      // revenue — commission taken, lawyer paid, client's money still gone —
      // which is the one number on this page nobody should have to check.
      var s = settlement(r);
      out.orders += 1;
      out.clientPaid += d.client - (s ? s.refund : 0);
      out.refunded += s ? s.refund : 0;
      out.gross += s ? s.kept : d.gross;
      out.toLawyers += s ? s.lawyer : d.lawyer;
      out.toTrainees += s ? s.intern : d.intern;
      out.commission += s ? s.commission : d.commission;
      out.commissionVat += s ? s.commissionVat : d.commissionVat;
      // The gateway took its cut of the original charge and does not give it
      // back when the client does.
      out.gateway += gatewayFee(d.client, cfg);
    });

    // What lawyers pay for the drafting workspace, over the same window.
    ((Store.subscriptions && Store.subscriptions()) || []).forEach(function (s) {
      if (s.active === false) return;
      out.subscriptions += Math.round((s.price || 0) * 100) * m;
    });

    out.revenue = out.commission + out.subscriptions;
    out.profit = out.revenue - out.gateway - out.costs;
    out.partners = ((Store.partners && Store.partners()) || []).map(function (p) {
      return { id: p.id, name: p.name, sharePct: p.sharePct,
               amount: Math.round(out.profit * (p.sharePct || 0) / 100) };
    });
    out.assigned = out.partners.reduce(function (t, p) { return t + p.amount; }, 0);
    // Whatever the partners' shares do not add up to stays with the platform.
    out.unassigned = out.profit - out.assigned;
    return out;
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
    pendingVerification: pendingVerification,
    noticesFor: noticesFor, unreadFor: unreadFor, partiesOf: partiesOf,
    reviewsFor: reviewsFor, ratingOf: ratingOf, ratingSpread: ratingSpread,
    scoreOf: scoreOf, rankOf: rankOf, leaderboard: leaderboard, ranked: ranked,
    serviceTypes: serviceTypes, allServiceTypes: allServiceTypes,
    serviceType: serviceType, servicesOf: servicesOf, services: services,
    timeline: timeline, refOf: refOf, partyList: partyList,
    requestPiles: requestPiles, blockingRequest: blockingRequest,
    walletOf: walletOf,
    quotes: quotes, quote: quote, offersOn: offersOn, quoteLive: quoteLive,
    myQuote: myQuote, openQuotesFor: openQuotesFor, quotePrice: quotePrice,
    quotesForClient: quotesForClient, quoteState: quoteState,
    lawyersForQuote: lawyersForQuote,
    channels: channels, channel: channel, channelsFor: channelsFor,
    serviceChannels: serviceChannels, isLive: isLive,
    priceBand: priceBand, checkPrice: checkPrice,
    guarantee: guarantee, seasoned: seasoned,
    startingPrice: startingPrice, cheapestStart: cheapestStart,
    typicalFirstOffer: typicalFirstOffer,
    serviceTitle: serviceTitle, serviceMeta: serviceMeta, serviceIcon: serviceIcon,
    MIN_SHARE: MIN_SHARE, DEFAULT_SHARE: DEFAULT_SHARE, clampShare: clampShare,
    agreementFor: agreementFor,
    agreementsOfIntern: agreementsOfIntern, taskPay: taskPay,
    COMMISSION_MAX_PCT: COMMISSION_MAX_PCT, DEFAULT_VAT_PCT: DEFAULT_VAT_PCT,
    clampCommission: clampCommission, platformSettings: platformSettings,
    checkSplit: checkSplit, distribute: distribute,
    featured: featured, byPlacement: byPlacement,
    subscriptionOf: subscriptionOf, canDraft: canDraft,
    announcementsFor: announcementsFor,
    monthlyCost: monthlyCost, costsInWindow: costsInWindow,
    gatewayFee: gatewayFee, earnedRequests: earnedRequests, books: books,
    series: series, whenOf: whenOf, inWindow: inWindow,
    promoValue: promoValue, sponsorship: sponsorship, sponsorshipBook: sponsorshipBook,
    ticketSplit: ticketSplit, webinarsFor: webinarsFor,
    isScreening: isScreening, mentorOf: mentorOf, canScreen: canScreen,
    conversionOffer: conversionOffer, SCREENING: SCREENING,
    stepsFor: stepsFor, stampsOn: stampsOn,
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
