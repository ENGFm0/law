/* ==========================================================================
   Requests — the same URL, three jobs.

     client : what I asked for, running and finished. Never a word about how
              the work was produced — that is the lawyer's business.
     lawyer : the inbox. What the assistant has drafted, what needs my pen,
              what I routed to a trainee.
     intern : the work routed to me, and the button that logs its hours.
   ========================================================================== */
Pages.define("requests", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-requests]");
  if (!host) return;

  var open = null;      // request id whose editor/detail panel is expanded
  // Which of the two conversations the lawyer is looking at.
  var side = "parties";
  // Which request has its record open on the list, if any.
  var path = null;
  // Which pile is on screen.
  var pile = "live";
  var rating = {};      // requestId -> stars picked but not yet sent
  var arguing = null;   // requestId whose refusal form is open
  var revising = null;  // requestId whose revision form is open

  function guest() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", "auth.guestHint") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="login.html" data-i18n="auth.signIn"></a></p></div>';
  }

  /* ------------------------------------------------------- posted briefs
     A brief that nobody has taken yet is not nothing. It used to vanish the
     moment it was sent — the client saw an empty list and could only assume
     it had gone somewhere. It belongs here, with its clock running, until it
     is taken or the window closes; then it drops to the finished list with
     the date on it and a way to post it again. */
  function briefRow(q) {
    var state = M.quoteState(q);
    var kind = M.serviceType(q.typeId) || { title: {} };
    var ch = M.channel(q.channel);
    var offers = M.offersOn(q.id).length;
    var open = state === "open";
    var left = Math.max(0, Math.floor((q.expiresAt - Date.now()) / 60000));
    var pill = { open: "ok", accepted: "ok", expired: "", cancelled: "" }[state];

    return '<article class="req-row">' +
      '<span class="req-row__icon">' + Icons.svg(open ? "gavel" : "clock", "icon-sm") + "</span>" +
      '<div class="grow" style="min-width:0">' +
        '<div class="row gap-2 wrap"><strong class="small">' +
          esc(q.brief.slice(0, 70)) + (q.brief.length > 70 ? "…" : "") + "</strong>" +
          '<span class="tag">' + esc(tx(kind.title)) + "</span></div>" +
        '<p class="tiny muted">' + esc(ch ? tx(ch.title) : "") +
          ' <span class="dot"></span> ' + esc(I18N.t("brief.offers", { n: I18N.num(offers) })) +
          ' <span class="dot"></span> ' +
          esc(open ? I18N.t("brief.closesInMin", { n: I18N.num(left) })
                   : I18N.date(q.at)) + "</p></div>" +
      '<div class="req-row__side">' +
        '<span class="status' + (pill ? " status--" + pill : "") + '">' +
          esc(I18N.t("brief." + state)) + "</span>" +
        (open
          ? '<a class="btn btn--ghost btn--sm" href="quotes.html">' +
              esc(I18N.t("brief.watch")) + "</a>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-brief-cancel="' +
              esc(q.id) + '">' + esc(I18N.t("quotes.cancel")) + "</button>"
          : state === "accepted"
            ? ""
            : '<a class="btn btn--outline btn--sm" href="quotes.html?again=' + esc(q.id) + '">' +
                Icons.svg("send", "icon-sm") + esc(I18N.t("brief.again")) + "</a>") +
      "</div></article>";
  }

  function briefs(me, which) {
    return M.quotesForClient(me.id).filter(function (q) {
      var state = M.quoteState(q);
      // An accepted brief became a request; it is in the list below as itself.
      if (state === "accepted") return false;
      return which === "open" ? state === "open" : state !== "open";
    });
  }

  /* ====================================================== client ========== */
  /** Four piles, one on screen at a time. A list that mixes a call booked for
      Tuesday with an objection from March and a finished consultation is a
      list nobody reads — they scan it for the one thing they came for. */
  function tabs(counts) {
    var of = function (id, key) {
      var n = counts[id] || 0;
      return '<button type="button" class="pill-tab' + (pile === id ? " is-active" : "") +
        '" data-pile="' + id + '">' + esc(I18N.t(key)) +
        (n ? '<span class="pill-tab__n">' + I18N.num(n) + "</span>" : "") + "</button>";
    };
    return '<nav class="pill-tabs">' +
      of("live", "req.tabLive") + of("booked", "req.tabBooked") +
      of("briefs", "req.tabBriefs") + of("past", "req.tabPast") +
      of("disputed", "req.tabDisputed") + "</nav>";
  }

  function clientView() {
    var me = Session.user();
    var mine = M.requests().filter(function (r) { return r.clientId === me.id; });
    var piles = M.requestPiles(mine);
    var waiting = briefs(me, "open");
    var doneBriefs = briefs(me, "past");

    var counts = { live: piles.live.length, booked: piles.booked.length,
                   past: piles.past.length + doneBriefs.length,
                   disputed: piles.disputed.length, briefs: waiting.length };

    var shown = pile === "briefs" ? waiting
              : pile === "past" ? piles.past
              : piles[pile] || piles.live;
    var rows = pile === "briefs"
      ? waiting.map(briefRow).join("")
      : shown.map(clientRow).join("") +
        (pile === "past" ? doneBriefs.map(briefRow).join("") : "");
    var emptyKey = { live: "req.noneCurrent", booked: "req.noneBooked",
                     past: "req.nonePast", disputed: "req.noneDisputed",
                     briefs: "brief.waiting" }[pile];

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline" data-i18n="req.heading"></h1>' +
        '<p class="lead" data-i18n="req.leadClient"></p></header>' +

      // One at a time, said before they go looking for the button.
      openLimit(me) +
      tabs(counts) +
      '<div class="case-list">' +
        (rows || '<div class="card empty"><p class="subtitle">' +
          esc(I18N.t(emptyKey)) + "</p></div>") +
      "</div></div>";
  }

  /** The rule, and what is owed to satisfy it. Shown rather than enforced
      silently: a button that does nothing teaches nobody anything. */
  function openLimit(me) {
    var blocking = M.blockingRequest(me.id);
    if (!blocking) return "";
    var st = M.requestState(blocking);
    var needsRating = st.status === "completed" && !st.rated;
    return '<div class="note-card">' +
      '<span class="note-card__icon">' + Icons.svg("lock", "icon-sm") + "</span>" +
      "<div><strong>" + esc(I18N.t("req.oneAtATime")) + "</strong>" +
      '<p class="small muted">' + esc(I18N.t("req.oneAtATimeBody")) + "</p>" +
      '<p class="tiny" style="margin-top:var(--s-2)">' +
        '<span class="num" dir="ltr">' + esc(M.refOf(blocking)) + "</span> · " +
        esc(tx(blocking.title || {})) + "</p>" +
      '<button class="btn btn--outline btn--sm" style="margin-top:var(--s-3)" type="button" ' +
        'data-detail="' + esc(blocking.id) + '" data-go-thread>' +
        esc(I18N.t(needsRating ? "req.rateToClose" : "req.finishFirst")) + "</button>" +
      "</div></div>";
  }

  /* What the client is allowed to see. Drafting, assistant queues and trainee
     routing are how the work gets done, not something the client ordered — so
     all three collapse into one honest word: in progress. */
  var CLIENT_STATUS = {
    drafted: "in_progress", with_intern: "in_progress", assigned: "in_progress",
    open_to_interns: "in_progress"
  };

  /* A case as a card, not a table row: the number, what it is, who it is
     with, where it has got to, and the two things anybody wants next — the
     conversation and the record. Separated from its neighbour by space rather
     than by a hairline, because these are files, not rows. */
  function clientRow(r) {
    var st = M.requestState(r);
    var lawyer = M.user(r.lawyerId);
    var canRate = (st.status === "delivered" || st.status === "completed") && !st.rated;
    var said = Store.messages(r.id, "parties").length;
    var chan = M.channel(r.channel);
    var liveNow = M.isLive(r) &&
      ["delivered", "completed", "cancelled", "refunded"].indexOf(st.status) === -1;
    var type = M.serviceType(r.typeId);
    var showing = open === r.id;

    return '<article class="case' + (showing ? " is-open" : "") + '">' +
      '<div class="case__head">' +
        '<span class="case__icon">' + Icons.svg(type ? type.icon : "file-text", "icon-sm") + "</span>" +
        '<div class="grow" style="min-width:0">' +
          '<div class="row gap-2 wrap">' +
            '<span class="case__ref num" dir="ltr">' + esc(M.refOf(r)) + "</span>" +
            "<strong>" + esc(tx(r.title)) + "</strong>" +
            (type ? '<span class="tag">' + esc(tx(type.title)) + "</span>" : "") +
          "</div>" +
          '<p class="tiny muted" style="margin-top:var(--s-1)">' +
            (lawyer ? esc(tx(lawyer.name)) : "") +
            (chan ? ' <span class="dot"></span> ' + esc(tx(chan.title)) : "") +
          "</p>" +
        "</div>" +
        '<div class="case__end">' +
          C.statusPill(CLIENT_STATUS[st.status] || st.status) +
          '<strong class="case__price">' + C.num(r.price) + " " + C.sar() + "</strong>" +
        "</div>" +
      "</div>" +

      // An objection is the reason this case is in the pile it is in, so it
      // says so on the card rather than only inside the panel.
      (function () {
        var d = M.disputeFor(r.id);
        if (!d || d.status !== "open") return "";
        return '<div class="case__flag">' +
          Icons.svg("bell", "icon-sm") +
          '<span class="num" dir="ltr">' + esc(M.refOf(d)) + "</span>" +
          '<span class="small">' + esc(d.reason || "") + "</span></div>";
      })() +

      '<div class="case__track">' + C.progress(r, "client") + "</div>" +

      '<div class="case__actions">' +
        (liveNow
          ? '<a class="btn btn--primary btn--sm" href="call.html?id=' + esc(r.id) + '">' +
            Icons.svg(chan.icon, "icon-sm") + esc(I18N.t("inbox.join")) + "</a>"
          : "") +
        '<button class="btn btn--outline btn--sm" type="button" data-detail="' + esc(r.id) + '" ' +
          'data-go-thread>' +
          Icons.svg("comment", "icon-sm") + esc(I18N.t("req.talk")) +
          (said ? '<span class="btn__n">' + I18N.num(said) + "</span>" : "") + "</button>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-path="' + esc(r.id) + '">' +
          Icons.svg("clock", "icon-sm") +
          esc(I18N.t(path === r.id ? "req.hideDetails" : "req.details")) + "</button>" +
        (canRate
          ? '<button class="btn btn--accent btn--sm" type="button" data-rate="' + esc(r.id) + '">' +
            Icons.svg("star", "icon-sm") + esc(I18N.t("rate.cta")) + "</button>"
          : st.rated
            ? '<span class="tiny muted">' + esc(I18N.t("rate.already")) + "</span>"
            : "") +
      "</div>" +

      (path === r.id
        ? '<div class="case__panel">' +
          C.timeline(r, { internal: false, titleKey: "req.whatHappened" }) + "</div>"
        : "") +
      (showing ? clientDetail(r, st, lawyer) : "") +
    "</article>";
  }

  /* The window a code can still be applied in — the same list the database
     checks in redeem_promo_code(), because a button drawn where the server
     will refuse is a button that lies. */
  var EARLY = ["new", "quoting", "assigned", "scheduled"];
  var promoTried = {};          // the last answer per request, so it can be said

  function convertOffer(r) {
    var code = M.conversionOffer(r.clientId);
    if (!code) return "";
    var lawyer = M.user(r.lawyerId);
    return '<div class="promo is-on" style="display:block" data-convert>' +
      "<strong>" + esc(I18N.t("scr.convert")) + "</strong>" +
      '<p class="small" style="margin-top:var(--s-2)">' +
        esc(I18N.t("scr.convertBody", {
          name: lawyer ? tx(lawyer.name) : "",
          code: code.code
        })) + "</p>" +
      '<a class="btn btn--primary btn--sm" style="margin-top:var(--s-3)" ' +
        'href="lawyer.html?id=' + esc(r.lawyerId || "") + '">' +
        esc(I18N.t("scr.convertGo")) + "</a>" +
    "</div>";
  }

  function clientDetail(r, st, lawyer) {
    return '<div class="case__panel">' +
      '<div class="row between wrap gap-3">' +
        '<div class="row gap-3">' + C.avatar(lawyer, "sm") +
          '<div><span class="tiny muted" data-i18n="req.byLawyer"></span>' +
          "<div>" + C.personLink(lawyer) + "</div></div></div>" +
        '<button class="icon-btn" type="button" data-detail-close>' + Icons.svg("close", "icon-sm") + "</button>" +
      "</div>" +
      '<h3 class="subtitle" style="margin-top:var(--s-5)" data-i18n="req.deliverable"></h3>' +
      (st.body
        ? '<pre class="draft-text" style="min-height:auto" readonly>' + esc(st.body) + "</pre>"
        : '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="req.noDeliverable"></p>') +
      // The one moment somebody is ready to hear what the full thing costs.
      // A real code in their name, not a banner — so it can be checked, it
      // runs out, and it cannot be passed around.
      (M.isScreening(r) && st.status === "completed" ? convertOffer(r) : "") +
      // A discount can only be taken before the work starts: after that the
      // price is what the lawyer agreed to be paid against, and moving it is
      // moving the terms of a job already under way.
      (EARLY.indexOf(st.status) !== -1 && !M.isScreening(r)
        ? C.promoBox(r, promoTried[r.id])
        : "") +
      acceptPanel(r) +
      (rating[r.id] !== undefined ? rateForm(r) : "") +
      // Everything the two of them said and sent, on the case it belongs to.
      C.thread(r, "parties", { closed: st.status === "completed" }) +
    "</div>";
  }


  /* ---- accepting a delivery, and refusing one -------------------------
     The client is not asked to trust that somebody will eventually settle
     this. The window is on screen with its deadline, the one revision is
     offered before the right to refuse rather than instead of it, and a
     refusal says plainly that the money stops moving until it is decided. */
  function timeLeft(ms) {
    var h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
    if (d > 0) return I18N.t("accept.leftDays", { d: d, h: h - d * 24 });
    if (h > 0) return I18N.t("accept.leftHours", { h: h });
    return I18N.t("accept.leftSoon");
  }

  function outcomeLine(res) {
    if (res.outcome === "release") return I18N.t("accept.outRelease");
    if (res.outcome === "refund") return I18N.t("accept.outRefund");
    return I18N.t("accept.outSplit", { p: res.lawyerPct });
  }

  function acceptPanel(r) {
    var a = M.acceptance(r);
    if (!a.delivered) return "";
    var d = a.dispute;

    // Decided: the outcome and the reason behind it, in the same words the
    // lawyer sees — there is no version of this the other party cannot read.
    if (d && d.status === "resolved") {
      var s = M.settlement(r);
      return card("gold",
        '<h3 class="subtitle">' + esc(I18N.t("accept.decided")) + "</h3>" +
        '<p style="margin-top:var(--s-2)">' + esc(outcomeLine(d.resolution)) + "</p>" +
        (s && s.refund > 0
          ? '<p class="small" style="margin-top:var(--s-2)">' +
            esc(I18N.t("accept.refunded")) + ": " + C.num(Math.round(s.refund / 100)) + " " + C.sar() + "</p>"
          : "") +
        '<p class="tiny muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("accept.decisionReason")) + "</p>" +
        '<p class="small">' + esc(d.resolution.reason) + "</p>");
    }

    if (d) {
      return card("gold",
        '<h3 class="subtitle">' + esc(I18N.t("accept.disputeOpen")) + "</h3>" +
        '<p class="small" style="margin-top:var(--s-2)">' + esc(I18N.t("accept.frozen")) + "</p>" +
        '<p class="tiny muted" style="margin-top:var(--s-3)">' + esc(I18N.t("accept.yourReason")) + "</p>" +
        '<p class="small">' + esc(d.reason) + "</p>");
    }

    if (a.settled) {
      return card("", '<p class="small">' + Icons.svg("check", "icon-sm") + " " +
        esc(I18N.t(a.autoAccepted ? "accept.auto" : "accept.accepted")) + "</p>");
    }

    if (revising === r.id) return card("gold", form("revise", r));
    if (arguing === r.id) return card("gold", form("dispute", r));

    return card("gold",
      '<h3 class="subtitle">' + esc(I18N.t("accept.heading")) + "</h3>" +
      '<p class="small" style="margin-top:var(--s-2)">' + esc(I18N.t("accept.lead")) + "</p>" +
      (a.msLeft != null
        ? '<p class="small" style="margin-top:var(--s-3)"><strong>' + esc(timeLeft(a.msLeft)) +
          "</strong></p>" +
          '<p class="tiny muted">' + esc(I18N.t("accept.autoNote")) + "</p>"
        : "") +
      '<p class="tiny muted" style="margin-top:var(--s-2)">' +
        esc(I18N.t(a.canRevise ? "accept.reviseOnce" : "accept.reviseUsed")) + "</p>" +
      '<div class="row gap-3 wrap" style="margin-top:var(--s-4)">' +
        '<button class="btn btn--primary btn--sm" type="button" data-accept="' + esc(r.id) + '">' +
          Icons.svg("check", "icon-sm") + esc(I18N.t("accept.cta")) + "</button>" +
        (a.canRevise
          ? '<button class="btn btn--outline btn--sm" type="button" data-revise="' + esc(r.id) + '">' +
            esc(I18N.t("accept.revise")) + "</button>"
          : "") +
        // Refusing is deliberately the quiet option: it is a right, not the
        // expected next step.
        '<button class="btn btn--ghost btn--sm" type="button" data-argue="' + esc(r.id) + '">' +
          esc(I18N.t("accept.dispute")) + "</button>" +
      "</div>" +
      guaranteePanel(r));
  }

  /** The promise the platform makes on the home page, said again at the only
      moment it matters — with the clock on it and the door in reach. Shown
      only while it is true. */
  function guaranteePanel(r) {
    var g = M.guarantee(r);
    if (!g.open) return "";
    var hours = Math.floor(g.msLeft / 3600000);
    return '<hr class="divider">' +
      '<div class="row gap-3" style="align-items:flex-start">' +
        '<span class="promise__icon">' + Icons.svg("shield-check", "icon-sm") + "</span>" +
        '<div class="grow"><strong class="small">' + esc(I18N.t("guar.title")) + "</strong>" +
        '<p class="tiny muted" style="margin-top:var(--s-1)">' +
          esc(hours >= 1
            ? I18N.t("guar.left", { n: I18N.num(hours) })
            : I18N.t("guar.leftMin", { n: I18N.num(Math.max(1, Math.round(g.msLeft / 60000))) })) +
          "</p>" +
        '<button class="btn btn--outline btn--sm" style="margin-top:var(--s-3)" type="button" ' +
          'data-guarantee="' + esc(r.id) + '">' + esc(I18N.t("guar.ask")) + "</button>" +
      "</div></div>";
  }

  function card(rule, inner) {
    return '<div class="card card--pad' + (rule ? " card--rule-" + rule : "") +
      '" style="margin-top:var(--s-6)">' + inner + "</div>";
  }

  function form(kind, r) {
    var revise = kind === "revise";
    return '<h3 class="subtitle">' +
        esc(I18N.t(revise ? "accept.revise" : "accept.dispute")) + "</h3>" +
      '<p class="small" style="margin-top:var(--s-2)">' +
        esc(I18N.t(revise ? "accept.reviseWhat" : "accept.disputeWhy")) + "</p>" +
      '<textarea class="input" rows="4" style="margin-top:var(--s-3)" data-argue-body></textarea>' +
      '<div class="row gap-3" style="margin-top:var(--s-4)">' +
        '<button class="btn btn--primary btn--sm" type="button" data-' +
          (revise ? "revise-send" : "argue-send") + '="' + esc(r.id) + '">' +
          esc(I18N.t(revise ? "accept.reviseSend" : "accept.disputeSend")) + "</button>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-argue-cancel>' +
          esc(I18N.t("accept.cancel")) + "</button>" +
      "</div>";
  }

  function rateForm(r) {
    var lawyer = M.user(r.lawyerId);
    return '<div class="card card--pad card--rule-gold" style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle" data-i18n="rate.title"></h3>' +
      '<p class="tiny muted" style="margin-top:var(--s-1)">' +
        esc(lawyer ? tx(lawyer.name) : "") + " · " + esc(tx(r.title)) + "</p>" +
      '<div style="margin:var(--s-5) 0">' + C.starPicker(rating[r.id] || 0, r.id) + "</div>" +
      '<textarea class="textarea" data-rate-body ' +
        'data-i18n-attr="placeholder:rate.placeholder"></textarea>' +
      '<p class="tiny faint" style="margin-top:var(--s-2)" data-i18n="rate.commentOptional"></p>' +
      '<button class="btn btn--accent" type="button" style="margin-top:var(--s-4)" ' +
        'data-rate-send="' + esc(r.id) + '" data-i18n="rate.submit"></button></div>';
  }

  /* ====================================================== lawyer ========== */
  var FILTERS = [
    { id: "all",      key: "inbox.all" },
    { id: "ai",       key: "inbox.withAi" },
    { id: "manual",   key: "inbox.withoutAi" },
    { id: "live",     key: "inbox.live" },
    { id: "assigned", key: "inbox.assigned" }
  ];
  var filter = "all";

  function bucket(r) {
    var st = M.requestState(r);
    if (st.assignedTo) return "assigned";
    var t = M.serviceType(r.typeId);
    if (t && t.mode === "live") return "live";
    return r.ai ? "ai" : "manual";
  }

  function inboxStatus(r) {
    var st = M.requestState(r);
    if (st.status === "delivered" || st.status === "completed") return { cls: "ok", key: "inbox.done" };
    if (st.assignedTo) return { cls: "info", key: "inbox.assigned" };
    var t = M.serviceType(r.typeId);
    if (t && t.mode === "live") return { cls: "info", key: "inbox.scheduled" };
    if (r.ai && st.status === "drafted") return { cls: "ok", key: "inbox.aiReady" };
    if (r.ai) return { cls: "muted", key: "inbox.aiQueued" };
    return { cls: "warn", key: "inbox.needsYou" };
  }

  /** One way in to the conversation, from the row, saying how much is in it. */
  function threadButton(r) {
    var said = Store.messages(r.id, "parties").length;
    return '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '" ' +
      'data-go-thread>' + Icons.svg("comment", "icon-sm") +
      esc(said ? I18N.t("thread.count", { n: I18N.num(said) }) : I18N.t("thread.open")) + "</button>";
  }

  function lawyerActions(r) {
    var st = M.requestState(r);
    var t = M.serviceType(r.typeId) || {};
    if (st.status === "delivered" || st.status === "completed") return "";

    // A screening written by the trainee this lawyer supervises. One button,
    // because the lawyer's job here is to read it and stand behind it — and
    // whose work it is is said on the row rather than left to be worked out.
    if (M.isScreening(r) && st.assignedTo && st.status === "drafted") {
      var who = M.user(st.assignedTo);
      return '<span class="tiny muted">' +
          esc(I18N.t("scr.byIntern", { name: who ? tx(who.name) : "" })) + "</span>" +
        threadButton(r) +
        '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '">' +
          esc(I18N.t("req.openDetails")) + "</button>" +
        '<button class="btn btn--accent btn--sm" type="button" data-scr-approve="' +
          esc(r.id) + '">' + Icons.svg("check", "icon-sm") +
          esc(I18N.t("scr.approve")) + "</button>";
    }

    if (st.status === "open_to_interns" && !st.assignedTo) {
      var n = Store.applicants(r.id).length;
      return '<span class="tiny muted">' +
          esc(I18N.t("task.competing", { n: I18N.num(n) })) + "</span>" +
        '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '">' +
          esc(I18N.t("inbox.applicants")) + "</button>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-unassign="' + esc(r.id) + '">' +
          esc(I18N.t("inbox.withdrawOffer")) + "</button>";
    }

    if (st.assignedTo) {
      var who = M.user(st.assignedTo);
      return '<span class="tiny muted">' +
          esc(I18N.t("inbox.assignedTo", { name: who ? tx(who.name) : "" })) + "</span>" +
        '<span>' + payLine(r, "pay.share") + "</span>" +
        // Routing work to a trainee used to be the last thing a lawyer could
        // do with it: the row offered "unassign" and nothing else, so the
        // draft, the client and now both conversations were out of reach on
        // exactly the cases somebody else is writing.
        threadButton(r) +
        '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '">' +
          esc(I18N.t("req.openDetails")) + "</button>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-unassign="' + esc(r.id) + '">' +
          esc(I18N.t("inbox.unassign")) + "</button>";
    }

    if (t.mode === "live") {
      return '<a class="btn btn--primary btn--sm" href="call.html?id=' + esc(r.id) + '">' +
        Icons.svg(t.icon, "icon-sm") + esc(I18N.t("inbox.join")) + "</a>";
    }

    var main = r.ai
      ? (st.status === "drafted"
          ? '<button class="btn btn--primary btn--sm" type="button" data-open="' + esc(r.id) + '">' +
            esc(I18N.t("inbox.review")) + "</button>"
          : '<button class="btn btn--outline btn--sm" type="button" data-gen="' + esc(r.id) + '">' +
            Icons.svg("sparkle", "icon-sm") + esc(I18N.t("inbox.generate")) + "</button>")
      : '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '">' +
        esc(I18N.t("inbox.writeSelf")) + "</button>";

    return threadButton(r) + main +
      '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
        Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>";
  }

  /* ---------- the strip at the top of a professional's page ----------
     A lawyer and a trainee were each handed a list and nothing else: no idea
     what the month had come to, what was riding on open work, or where they
     stood. The list is still the page; this is the sentence above it. */
  function kpi(labelKey, value, note, tone) {
    return '<div class="kpi' + (tone ? " kpi--" + tone : "") + '">' +
      '<span class="kpi__label">' + esc(I18N.t(labelKey)) + "</span>" +
      '<strong class="kpi__value">' + value + "</strong>" +
      (note ? '<span class="tiny faint">' + esc(note) + "</span>" : "") +
    "</div>";
  }

  /** Money first, because it is the question, and said in the two halves that
      are actually different: what is theirs, and what is still a promise. */
  function walletCards(me) {
    var w = M.walletOf(me.id);
    return kpi("dash.settled", C.sar(w.settled), I18N.t("dash.afterCut"), "good") +
           kpi("dash.pending", C.sar(w.pending), I18N.t("dash.notYours")) +
           (w.byAgreement
             ? kpi("pay.tab", C.num(w.byAgreement),
                   I18N.t("dash.byAgreement", { n: I18N.num(w.byAgreement) }))
             : "");
  }

  function pileCards(list) {
    var piles = M.requestPiles(list);
    return kpi("dash.running", C.num(piles.live.length)) +
           kpi("dash.booked", C.num(piles.booked.length)) +
           kpi("dash.done", C.num(piles.past.length)) +
           kpi("dash.objections", C.num(piles.disputed.length),
               null, piles.disputed.length ? "warn" : "");
  }

  function standingCards(me, role) {
    var rank = M.rankOf(me.id, role);
    var rating = M.ratingOf(me.id);
    return (rating.count
             ? kpi("dash.rating", C.num(rating.avg),
                   I18N.t("dash.reviewsN", { n: I18N.num(rating.count) }))
             : "") +
           (rank.rank
             ? kpi("dash.rank", C.num(rank.rank) + '<span class="tiny faint"> / ' +
                                I18N.num(rank.of) + "</span>")
             : "");
  }

  function dashHead(titleKey, leadKey, cards) {
    return '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline" data-i18n="' + titleKey + '"></h1>' +
        '<p class="lead" data-i18n="' + leadKey + '"></p></header>' +
      '<div class="kpi-grid" style="margin-bottom:var(--s-8)">' + cards + "</div>";
  }

  function lawyerView() {
    var me = Session.user();
    var all = M.requestsForLawyer(me.id);
    var rows = all.filter(function (r) { return filter === "all" || bucket(r) === filter; });

    var chips = FILTERS.map(function (f) {
      var n = f.id === "all" ? all.length
        : all.filter(function (r) { return bucket(r) === f.id; }).length;
      return '<button type="button" class="chip' + (filter === f.id ? " is-active" : "") +
        '" data-filter="' + f.id + '">' + esc(I18N.t(f.key)) +
        ' <span class="num">' + I18N.num(n) + "</span></button>";
    }).join("");

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      dashHead("inbox.title", "inbox.lead",
               walletCards(me) + pileCards(all) + standingCards(me, "lawyer")) +
      '<div class="row gap-2 wrap" style="margin-bottom:var(--s-5)">' + chips + "</div>" +
      '<p class="small muted" style="margin-bottom:var(--s-4)">' +
        esc(I18N.t("inbox.count", { n: I18N.num(rows.length) })) + "</p>" +

      (rows.length
        ? rows.map(function (r) {
            var st = inboxStatus(r);
            var client = M.user(r.clientId);
            var t = M.serviceType(r.typeId) || {};
            return "<div>" +
              '<div class="inbox-row' + (open === r.id ? " is-open" : "") + '">' +
                '<span class="inbox-row__icon">' + Icons.svg(t.icon || "file-text", "icon-sm") + "</span>" +
                '<div class="grow" style="min-width:0">' +
                  '<div class="row gap-2 wrap"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
                    '<span class="tag">' + esc(tx(t.title || {})) + "</span></div>" +
                  '<p class="tiny muted">' + esc(client ? tx(client.name) : "") +
                    ' <span class="dot"></span> ' + esc(tx(r.ago)) + "</p>" +
                  (r.brief ? '<p class="tiny faint">' + esc(I18N.t("inbox.clientNote")) + ": " +
                    esc(tx(r.brief)) + "</p>" : "") +
                "</div>" +
                '<div class="inbox-row__side">' +
                  '<span class="status status--' + st.cls + '">' + esc(I18N.t(st.key)) + "</span>" +
                  // What reaches them, not what the client pays. The two are
                  // different numbers and only one of them is theirs.
                  '<span class="case__net"><span class="tiny muted">' +
                    esc(I18N.t("req.yourShare")) + "</span>" +
                    '<strong class="tiny">' + C.sar(M.distribute(r).lawyer) + "</strong>" +
                    '<span class="tiny faint">' + esc(I18N.t("req.clientPays")) + " " +
                      C.sar(M.distribute(r).client) + "</span></span>" +
                  '<div class="inbox-row__actions">' +
                    '<button class="btn btn--ghost btn--sm" type="button" data-path="' +
                      esc(r.id) + '">' + Icons.svg("clock", "icon-sm") +
                      esc(I18N.t(path === r.id ? "tl.close" : "tl.open")) + "</button>" +
                    lawyerActions(r) + "</div>" +
                "</div></div>" +
              '<div class="track-slot">' + C.progress(r, "lawyer") + "</div>" +
              (path === r.id
                ? '<div class="admin-case">' + C.timeline(r, { internal: true }) + "</div>"
                : "") +
              (open === r.id
                ? (M.requestState(r).status === "open_to_interns" && !M.requestState(r).assignedTo
                    ? applicantsPanel(r)
                    : draftPanel(r))
                : "") + "</div>";
          }).join("")
        : '<p class="muted center" style="padding:var(--s-8)">' + esc(I18N.t("inbox.empty")) + "</p>") +
      mentorshipPanel(me) +
      // Trainees asking for a supervisor. Only a mentor sees this at all.
      C.callInbox(me) +
    "</div>";
  }

  /** Who put their hand up for an opened task, and the button that ends it. */
  function applicantsPanel(r) {
    var ids = Store.applicants(r.id);
    return '<section class="panel" style="margin:var(--s-2) 0 var(--s-5)">' +
      '<div class="panel__head row between wrap gap-3">' +
        '<h2 class="subtitle">' + esc(I18N.t("inbox.applicants")) + " — " + esc(tx(r.title)) + "</h2>" +
        '<button class="icon-btn" type="button" data-draft-close>' + Icons.svg("close", "icon-sm") + "</button>" +
      "</div>" +
      '<div style="padding:var(--s-5)">' +
        (ids.length
          ? '<div class="req-list">' + ids.map(function (id) {
              var u = M.user(id);
              if (!u) return "";
              var prog = M.certProgress(u.id);
              return '<div class="req-row">' +
                '<span class="req-row__icon">' + C.avatar(u, "sm") + "</span>" +
                '<div class="grow" style="min-width:0">' + C.personLink(u) +
                  '<p class="tiny muted">' + esc(tx(u.university || {})) + ' <span class="dot"></span> ' +
                    esc(I18N.t("cert.hoursShort", { n: I18N.num(prog.hours) })) + "</p>" +
                  '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' +
                    (u.skills || []).slice(0, 3).map(function (sk) {
                      return '<span class="tag">' + esc(tx(sk)) + "</span>";
                    }).join("") + "</div></div>" +
                '<div class="req-row__side">' + C.ratingLine(u.id) +
                  '<button class="btn btn--accent btn--sm" type="button" ' +
                    'data-pick-intern="' + esc(u.id) + '" data-for="' + esc(r.id) + '">' +
                    esc(I18N.t("inbox.pickApplicant")) + "</button></div></div>";
            }).join("") + "</div>"
          : '<p class="small muted">' + esc(I18N.t("inbox.noApplicants")) + "</p>") +
      "</div></section>";
  }

  /** The drafting surface. The assistant's text lands here and nowhere else. */
  function draftPanel(r) {
    var st = M.requestState(r);
    var t = M.serviceType(r.typeId) || {};
    var client = M.user(r.clientId);
    var body = st.body || (r.doc && global.SEED.draftBodies[r.doc] ? tx(global.SEED.draftBodies[r.doc]) : "");

    return '<section class="panel" style="margin:var(--s-2) 0 var(--s-5)">' +
      '<div class="panel__head row between wrap gap-3">' +
        "<div><h2 class=\"subtitle\">" + esc(tx(r.title)) + "</h2>" +
          '<p class="tiny muted">' + esc(client ? tx(client.name) : "") + ' <span class="dot"></span> ' +
            esc(tx(t.title || {})) +
            (r.ai ? ' <span class="dot"></span> ' + esc(I18N.t("ai.aiSource")) : "") + "</p></div>" +
        '<button class="icon-btn" type="button" data-draft-close>' + Icons.svg("close", "icon-sm") + "</button>" +
      "</div>" +
      (r.ai ? '<p class="disclaimer" style="border-top:0">' + Icons.svg("lock", "icon-sm") +
        "<span>" + esc(I18N.t("inbox.aiHidden")) + "</span></p>" : "") +
      '<textarea class="draft-text" data-draft-body spellcheck="false">' + esc(body) + "</textarea>" +
      '<div class="draft-foot">' +
        '<div><span class="tiny muted">' + esc(I18N.t("req.yourShare")) + "</span>" +
          '<strong style="display:block;color:var(--accent)">' +
            C.sar(M.distribute(r).lawyer) + "</strong>" +
          '<span class="tiny faint">' + esc(I18N.t("req.clientPays")) + " " +
            C.sar(M.distribute(r).client) + "</span></div>" +
        '<span class="grow"></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
          Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>" +
        '<button class="btn btn--accent" type="button" data-approve="' + esc(r.id) + '">' +
          Icons.svg("check", "icon-sm") + esc(I18N.t("ai.approve")) + "</button>" +
      "</div>" +
      // Two conversations, kept apart. The tabs are the honest way to show
      // that: one of them the client reads, and one of them they do not.
      '<div style="padding:0 var(--s-5) var(--s-5)">' +
        (M.requestState(r).assignedTo
          ? '<div class="row gap-2 wrap" style="margin-bottom:var(--s-4)">' +
              '<button type="button" class="chip' + (side === "parties" ? " is-active" : "") +
                '" data-thread-side="parties">' + esc(I18N.t("thread.withClient")) + "</button>" +
              '<button type="button" class="chip' + (side === "internal" ? " is-active" : "") +
                '" data-thread-side="internal">' + esc(I18N.t("thread.withIntern")) + "</button>" +
            "</div>"
          : "") +
        C.thread(r, M.requestState(r).assignedTo ? side : "parties",
                 { closed: M.requestState(r).status === "completed" }) +
        // The lawyer is on both threads, so their record shows both.
        C.timeline(r, { internal: true }) +
      "</div></section>";
  }

  /** Two ways to hand work down: name someone, or let them compete for it.
      Three names is not worth a modal, so this is an inline chooser. */
  function openAssign(id, anchor) {
    var existing = $(".assign-pop");
    if (existing) existing.remove();
    var pop = document.createElement("div");
    pop.className = "assign-pop";
    var me = Session.user();
    var r = M.request(id);
    pop.innerHTML =
      '<label class="field" style="padding:0 var(--s-2) var(--s-2)">' +
        '<span class="tiny muted">' + esc(I18N.t("pay.shareLabel")) + "</span>" +
        '<span class="tiny faint">' + esc(I18N.t("pay.shareFloor",
          { n: I18N.num(M.MIN_SHARE) })) + "</span>" +
        '<input class="input num" type="number" min="' + M.MIN_SHARE + '" max="100" step="5" ' +
          'dir="ltr" data-share value="' + M.DEFAULT_SHARE + '"></label>' +
      '<p class="tiny faint" style="padding:0 var(--s-2) var(--s-3)">' +
        esc(I18N.t("pay.shareHint")) + "</p>" +
      '<hr class="divider" style="margin:0 0 var(--s-2)">' +
      '<p class="tiny muted">' + esc(I18N.t("inbox.pickOne")) + "</p>" +
      M.interns().map(function (i) {
        // A standing agreement already settles the terms, so say so here.
        var deal = M.agreementFor(me.id, i.id);
        return '<button type="button" data-pick-intern="' + esc(i.id) + '" data-for="' + esc(id) + '">' +
          '<img class="avatar avatar--sm" alt="" width="28" height="28" src="' +
            App.avatarOf(i.name, i.id) + '">' +
          "<span>" + esc(tx(i.name)) +
            (deal ? '<span class="tiny muted" style="display:block">' +
              esc(I18N.t("pay.underAgreement", { kind: I18N.t("pay.kind" +
                deal.kind.charAt(0).toUpperCase() + deal.kind.slice(1)) })) + "</span>" : "") +
          "</span>" +
          '<span class="tiny muted num">' + I18N.num(M.hoursOf(i.id)) + "</span></button>";
      }).join("") +
      '<hr class="divider" style="margin:var(--s-2) 0">' +
      '<button type="button" data-broadcast="' + esc(id) + '">' +
        '<span class="stat__icon" style="width:28px;height:28px">' +
          Icons.svg("gavel", "icon-sm") + "</span>" +
        "<span><strong>" + esc(I18N.t("inbox.openToAll")) + "</strong>" +
        '<span class="tiny muted" style="display:block">' +
          esc(I18N.t("inbox.openToAllHint")) + "</span></span></button>";
    anchor.appendChild(pop);
  }

  /* ====================================================== intern ========== */
  /* ---------- supervision ----------
     One panel, drawn for both sides of it. A trainee sees who is teaching
     them, what it costs and what it has earned them in hours; a lawyer sees
     everyone they have taken on and what the sponsorships come to. Neither
     sees a screen written for the other, and both are looking at the same
     rows — which is the only way the hours on a certificate can be trusted. */
  function menState(m, mine) {
    if (m.status === "pending") {
      // The side that asked cannot also answer. Said here so the button is
      // not drawn, and in the database so it cannot be called around.
      var theirs = (m.openedBy === "intern" ? m.internId : m.mentorId) === mine;
      return theirs
        ? '<span class="tiny muted">' + esc(I18N.t("men.pending")) + "</span>"
        : '<span class="row gap-2">' +
            '<button class="btn btn--primary btn--sm" type="button" data-men-yes="' +
              esc(m.id) + '">' + esc(I18N.t("men.accept")) + "</button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-men-no="' +
              esc(m.id) + '">' + esc(I18N.t("men.decline")) + "</button></span>";
    }
    if (m.status === "active") {
      return '<button class="btn btn--ghost btn--sm" type="button" data-men-end="' +
        esc(m.id) + '">' + esc(I18N.t("men.end")) + "</button>";
    }
    return '<span class="tiny muted">' +
      esc(I18N.t(m.status === "ended" ? "men.ended" : "men.declined")) + "</span>";
  }

  function menRoom(m, me) {
    var log = Store.roomMessages(m.id);
    var mentor = me.id === m.mentorId;
    return '<section class="thread" data-room="' + esc(m.id) + '">' +
      '<h3 class="subtitle">' + esc(I18N.t("men.roomTitle")) + "</h3>" +
      '<div class="thread__log">' +
        (log.length
          ? log.map(function (x) {
              var who = M.user(x.authorId);
              return '<div class="bubble-row' + (x.authorId === me.id ? " bubble-row--mine" : "") + '">' +
                '<span class="bubble-row__gap"></span>' +
                '<article class="bubble' + (x.authorId === me.id ? " bubble--mine" : "") + '">' +
                  (x.authorId === me.id ? ""
                    : '<strong class="bubble__who">' + esc(who ? tx(who.name) : "") + "</strong>") +
                  '<p class="bubble__body">' + esc(x.body) + "</p>" +
                  '<time class="bubble__at tiny">' + esc(C.stamp(x.at)) + "</time>" +
                "</article></div>";
            }).join("")
          : '<p class="small muted center">' +
            esc(I18N.t(mentor ? "men.roomEmptyMentor" : "men.roomEmpty")) + "</p>") +
      "</div>" +
      '<form class="thread__compose" data-room-form="' + esc(m.id) + '">' +
        '<input class="input" data-room-body placeholder="' +
          esc(I18N.t("men.say")) + '">' +
        '<button class="btn btn--primary btn--sm" type="submit">' +
          esc(I18N.t("thread.send")) + "</button>" +
      "</form></section>";
  }

  function menSessions(m, me) {
    var mentor = me.id === m.mentorId;
    var list = Store.sessions().filter(function (x) { return x.mentorshipId === m.id; })
      .sort(function (a, b) {
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });

    return '<section style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle">' + esc(I18N.t("men.calendar")) + "</h3>" +
      (list.length
        ? '<div class="stack gap-2" style="margin-top:var(--s-3)">' + list.map(function (x) {
            return '<div class="row between wrap gap-3 admin-line">' +
              "<span><strong class=\"small\">" + esc(x.title) + "</strong>" +
              '<span class="tiny muted" style="display:block">' +
                esc(C.stamp(new Date(x.startsAt).getTime())) + " · " +
                esc(I18N.t("men.sessionHours")) + " " + I18N.num(x.hours || 1) + "</span></span>" +
              (x.attended
                ? '<span class="status status--ok">' + esc(I18N.t("men.attended")) + "</span>"
                : (mentor
                    ? '<button class="btn btn--outline btn--sm" type="button" data-men-attended="' +
                      esc(x.id) + '">' + esc(I18N.t("men.markAttended")) + "</button>"
                    : "")) +
            "</div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("men.noSessions")) + "</p>") +
      // Only the mentor writes the calendar, and only the mentor marks
      // attendance — a trainee who could tick their own hours is a trainee
      // writing their own certificate.
      (mentor
        ? '<form class="row gap-2 wrap" style="margin-top:var(--s-4)" data-session-form="' +
            esc(m.id) + '">' +
            '<input class="input" data-session-title style="flex:2 1 180px" placeholder="' +
              esc(I18N.t("men.sessionTitle")) + '">' +
            '<input class="input" type="datetime-local" dir="ltr" data-session-when ' +
              'style="flex:1 1 180px">' +
            '<input class="input" type="number" min="0" max="12" value="2" ' +
              'data-session-hours style="flex:0 1 90px">' +
            '<button class="btn btn--outline btn--sm" type="submit">' +
              esc(I18N.t("men.addSession")) + "</button></form>"
        : "") +
    "</section>";
  }

  function menCard(m, me) {
    var mentor = me.id === m.mentorId;
    var them = M.user(mentor ? m.internId : m.mentorId);
    var split = M.sponsorship(m);
    var prog = M.certProgress(m.internId);

    return '<article class="card card--pad" style="margin-bottom:var(--s-4)">' +
      '<div class="row between wrap gap-3">' +
        '<span class="row gap-3">' + C.avatar(them, "sm") +
          "<span><strong>" + esc(them ? tx(them.name) : "") + "</strong>" +
          '<span class="tiny muted" style="display:block">' +
            esc(I18N.t(mentor ? "men.activeBy" : "men.active")) + "</span></span></span>" +
        menState(m, me.id) +
      "</div>" +

      (m.status === "active"
        ? '<div class="meta-row" style="margin-top:var(--s-4)">' +
            '<span class="tiny muted">' + esc(I18N.t("men.monthly")) + ": " +
              C.sar(split.gross) + "</span>" +
            (mentor
              ? '<span class="dot"></span><span class="tiny muted">' +
                esc(I18N.t("men.netToYou")) + ": <strong>" + C.sar(split.lawyer) +
                "</strong></span>"
              : "") +
            '<span class="dot"></span>' +
            '<span class="tiny muted">' + esc(I18N.t("men.hoursTitle")) + ": " +
              esc(I18N.t("men.hoursOf", { n: I18N.num(prog.hours),
                                          t: I18N.num(prog.needed) })) + "</span>" +
          "</div>" +
          // The trainee is the one who pays, so the trainee is the one shown
          // the state of it — and shown it plainly rather than by a button
          // going missing.
          (!mentor && split.gross
            ? (split.current
                ? '<p class="tiny faint" style="margin-top:var(--s-3)">' +
                  esc(I18N.t("men.paidUntil", { d: I18N.date(m.paidUntil) })) + "</p>"
                : '<div class="row gap-3 wrap" style="margin-top:var(--s-3)">' +
                  '<span class="tiny" style="color:var(--warning);align-self:center">' +
                    esc(I18N.t("men.unpaid")) + "</span>" +
                  '<button class="btn btn--accent btn--sm" type="button" data-men-pay="' +
                    esc(m.id) + '">' + esc(I18N.t("men.pay")) + "</button></div>")
            : "") +
          menRoom(m, me) +
          menSessions(m, me)
        : "") +
    "</article>";
  }

  function mentorshipPanel(me) {
    var mine = Store.mentorships().filter(function (m) {
      return m.mentorId === me.id || m.internId === me.id;
    });
    var live = mine.filter(function (m) { return m.status !== "declined" && m.status !== "ended"; });
    var isIntern = Session.is("intern");

    if (!live.length) {
      return isIntern
        ? '<section style="margin-top:var(--s-12)">' +
            '<h2 class="headline">' + esc(I18N.t("men.title")) + "</h2>" +
            '<p class="lead" style="margin-bottom:var(--s-4)">' +
              esc(I18N.t("men.mentorNone")) + "</p>" +
            '<a class="btn btn--primary btn--sm" href="lawyers.html">' +
              esc(I18N.t("men.findMentor")) + "</a></section>"
        : "";
    }

    return '<section style="margin-top:var(--s-12)">' +
      '<h2 class="headline">' +
        esc(I18N.t(isIntern ? "men.title" : "men.myTrainees")) + "</h2>" +
      '<p class="lead" style="margin-bottom:var(--s-6)">' +
        esc(I18N.t(isIntern ? "men.applyHint" : "men.applications")) + "</p>" +
      live.map(function (m) { return menCard(m, me); }).join("") +
    "</section>";
  }

  function internView() {
    var me = Session.user();
    var mine = M.requestsForIntern(me.id);
    var pool = M.openInternTasks();

    var prog = M.certProgress(me.id);
    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      dashHead("task.heading", "task.lead",
               walletCards(me) + pileCards(mine) +
               kpi("dash.hours", C.num(prog.hours),
                   I18N.t("dash.toCert") + " " + prog.pct + "%") +
               standingCards(me, "intern")) +
      (mine.length
        ? mine.map(internRow).join("")
        : C.empty("inbox", "task.none")) +

      // A trainee with no standing mentor gets the two ways to fix that,
      // side by side, above the work they cannot take yet. Buying one
      // signature does not close the section: it is spent on one screening
      // and then gone, so the card stays and says what is in hand.
      (M.mentorOf(me.id) ? "" :
        '<section style="margin-top:var(--s-12)">' +
          '<div class="grid grid-2" style="gap:var(--s-4)">' +
            C.callCard(me) + C.caseSupervisionCard(me) + "</div></section>") +

      screeningPool(me) +

      '<section style="margin-top:var(--s-12)">' +
        '<h2 class="headline" data-i18n="task.openPool"></h2>' +
        '<p class="lead" style="margin-bottom:var(--s-6)" data-i18n="task.openPoolLead"></p>' +
        (pool.length
          ? pool.map(function (r) { return openTaskRow(r, me); }).join("")
          : C.empty("gavel", "task.noOpen")) +
      "</section>" +
      mentorshipPanel(me) + "</div>";
  }

  /* Free screenings nobody has picked up. Shown to every trainee, claimable
     only by one with a supervisor — and the reason why is written on the card
     rather than left to a disabled button. */
  function screeningPool(me) {
    var list = M.openScreenings();
    if (!list.length) return "";
    var supervised = M.canScreen(me.id);

    return '<section style="margin-top:var(--s-12)" data-screening-pool>' +
      '<h2 class="headline">' + esc(I18N.t("scr.pool")) + "</h2>" +
      '<p class="lead" style="margin-bottom:var(--s-6)">' +
        esc(I18N.t("scr.poolLead")) + "</p>" +
      (supervised ? "" :
        '<p class="small" style="margin-bottom:var(--s-4);color:var(--warning)">' +
        Icons.svg("lock", "icon-sm") + " " + esc(I18N.t("scr.needMentor")) +
        ' <a href="lawyers.html">' + esc(I18N.t("men.findMentor")) + "</a></p>") +
      list.map(function (r) {
        return '<article class="card card--pad card--rule-gold" style="margin-bottom:var(--s-4)">' +
          '<div class="row between wrap gap-4">' +
            '<div class="grow" style="min-width:0">' +
              '<div class="row gap-2 wrap"><h3 class="subtitle">' + esc(tx(r.title)) + "</h3>" +
                '<span class="tag">' + esc(I18N.t("scr.free")) + "</span></div>" +
              '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(r.brief)) + "</p>" +
              '<p class="tiny faint" style="margin-top:var(--s-2)">' +
                esc(C.stamp(M.whenOf(r))) + "</p>" +
            "</div>" +
            (supervised
              ? '<button class="btn btn--accent btn--sm" type="button" data-scr-take="' +
                esc(r.id) + '">' + Icons.svg("check", "icon-sm") +
                esc(I18N.t("scr.take")) + "</button>"
              : "") +
          "</div></article>";
      }).join("") +
    "</section>";
  }

  /** An opened task: every trainee sees it, applies, and the lawyer picks. */
  function openTaskRow(r, me) {
    var lawyer = M.user(r.lawyerId);
    var t = M.serviceType(r.typeId) || {};
    var applicants = Store.applicants(r.id);
    var applied = applicants.indexOf(me.id) !== -1;

    return '<article class="card card--pad card--rule-gold" style="margin-bottom:var(--s-4)">' +
      '<div class="row between wrap gap-4">' +
        '<div class="grow" style="min-width:0">' +
          '<div class="row gap-2 wrap"><h3 class="subtitle">' + esc(tx(r.title)) + "</h3>" +
            '<span class="tag">' + esc(tx(t.title || {})) + "</span></div>" +
          '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(r.brief)) + "</p>" +
          '<div class="meta-row" style="margin-top:var(--s-3)">' +
            '<span class="row gap-2">' + Icons.svg("scale", "icon-sm") +
              '<span class="tiny muted">' + esc(I18N.t("task.supervisor")) + ":</span> " +
              (lawyer ? C.personLink(lawyer) : "") + "</span>" +
            '<span class="dot"></span>' +
            '<span class="tiny muted">' + esc(I18N.t("task.hoursWorth", { n: I18N.num(r.hours || 4) })) + "</span>" +
            '<span class="dot"></span>' +
            '<span class="tiny muted">' +
              esc(I18N.t("task.competing", { n: I18N.num(applicants.length) })) + "</span>" +
          "</div>" +
        "</div>" +
        (applied
          ? '<span class="status status--ok">' + esc(I18N.t("task.applied")) + "</span>"
          : '<button class="btn btn--accent btn--sm" type="button" data-apply="' + esc(r.id) + '">' +
            Icons.svg("send", "icon-sm") + esc(I18N.t("task.apply")) + "</button>") +
      "</div></article>";
  }

  function internRow(r) {
    var st = M.requestState(r);
    var lawyer = M.user(r.lawyerId);
    var t = M.serviceType(r.typeId) || {};
    var done = st.status === "delivered" || st.status === "completed";
    var waiting = M.isScreening(r) && st.status === "drafted";

    return '<article class="card card--pad" style="margin-bottom:var(--s-4)">' +
      (waiting
        ? '<p class="small" style="margin-bottom:var(--s-3);color:var(--warning)">' +
          Icons.svg("clock", "icon-sm") + " " + esc(I18N.t("scr.forApproval")) + "</p>"
        : "") +
      '<div class="row between wrap gap-4">' +
        '<div class="grow" style="min-width:0">' +
          '<div class="row gap-2 wrap"><h2 class="subtitle">' + esc(tx(r.title)) + "</h2>" +
            '<span class="tag">' + esc(tx(t.title || {})) + "</span>" + C.statusPill(st.status) + "</div>" +
          '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(r.brief)) + "</p>" +
          '<div class="meta-row" style="margin-top:var(--s-3)">' +
            '<span class="row gap-2">' + Icons.svg("scale", "icon-sm") +
              '<span class="tiny muted">' + esc(I18N.t("task.supervisor")) + ":</span> " +
              (lawyer ? C.personLink(lawyer) : "") + "</span>" +
            '<span class="dot"></span>' +
            '<span class="tiny muted">' + esc(I18N.t("task.hoursWorth", { n: I18N.num(r.hours || 4) })) + "</span>" +
            '<span class="dot"></span>' + payLine(r, "pay.yourShare") +
          "</div>" +
        "</div>" +
        '<div class="row gap-2 wrap">' +
          (done ? ""
            : '<button class="btn btn--outline btn--sm" type="button" data-task-open="' + esc(r.id) + '">' +
              esc(I18N.t(st.status === "in_progress" ? "req.openDetails" : "task.start")) + "</button>") +
        "</div>" +
      "</div>" +
      (open === r.id && !done
        ? '<div style="margin-top:var(--s-5)">' +
            '<textarea class="draft-text" data-task-body spellcheck="false" ' +
              'data-i18n-attr="placeholder:task.writeHere">' + esc(st.body || "") + "</textarea>" +
            '<div class="row gap-2" style="margin-top:var(--s-3)">' +
              '<button class="btn btn--ghost btn--sm" type="button" data-task-save="' + esc(r.id) + '" ' +
                'data-i18n="dash.saveDraft"></button>' +
              // A screening goes UP, not out. The trainee wrote it; the lawyer
              // supervising them is the one who answers for it, so the lawyer
              // is the one who delivers it.
              (M.isScreening(r)
                ? '<button class="btn btn--accent btn--sm" type="button" data-scr-submit="' +
                  esc(r.id) + '">' + Icons.svg("send", "icon-sm") +
                  esc(I18N.t("scr.submit")) + "</button>"
                : '<button class="btn btn--accent btn--sm" type="button" data-task-deliver="' +
                  esc(r.id) + '">' + Icons.svg("send", "icon-sm") +
                  esc(I18N.t("task.deliver")) + "</button>") + "</div>" +

            // A trainee handed a case used to be handed a title and a
            // deadline. Everything that decides how to write the thing — what
            // the client actually asked for, what they sent, what the lawyer
            // has already told them — was on the other side of a wall built
            // for the client's privacy from strangers, which a trainee on
            // their own case is not.
            '<div class="admin-case" style="margin-top:var(--s-5)">' +
              '<div class="row between wrap gap-3">' +
                '<h3 class="subtitle">' + esc(I18N.t("tl.fromClient")) + "</h3>" +
                '<span class="tiny muted num" dir="ltr">' + esc(M.refOf(r)) + "</span></div>" +
              (tx(r.brief) ? '<p class="small" style="margin-top:var(--s-3)">' +
                esc(tx(r.brief)) + "</p>" : "") +
              C.parties(r) +
              '<p class="tiny faint" style="margin-top:var(--s-4)">' +
                esc(I18N.t("tl.readOnly")) + "</p>" +
              C.timeline(r, { internal: false, titleKey: "tl.everything" }) +
            "</div>" +

            // The supervising lawyer, and nobody else: the client is not in
            // this one and cannot be.
            C.thread(r, "internal", { closed: false }) + "</div>"
        : "") +
    "</article>";
  }

  /** The share typed into the routing chooser, if it is open. */
  function readShare() {
    var el = $("[data-share]", host);
    return el ? M.clampShare(+el.value) : null;
  }

  /** One line saying what this task pays, for whoever is entitled to see it. */
  function payLine(r, labelKey) {
    var pay = M.taskPay(r);
    if (!pay) return "";
    if (pay.kind === "share") {
      return '<span class="tiny muted">' + esc(I18N.t(labelKey)) + ": </span>" +
        '<strong class="tiny" style="color:var(--accent)"><span class="num">' +
          I18N.num(pay.amount) + "</span> " + esc(I18N.t("common.sar")) + "</strong>" +
        '<span class="tiny faint"> (' + esc(I18N.t("pay.ofPrice",
          { pct: I18N.num(pay.pct), price: I18N.num(r.price || 0) })) + ")</span>";
    }
    var kindKey = "pay.kind" + pay.kind.charAt(0).toUpperCase() + pay.kind.slice(1);
    return '<span class="tag">' +
      esc(I18N.t("pay.underAgreement", { kind: I18N.t(kindKey) })) + "</span>";
  }

  /* ====================================================== draw ============ */
  App.onRender(function () {
    var role = Session.role();
    host.innerHTML = Session.isGuest() ? guest()
                   : role === "lawyer" ? lawyerView()
                   : role === "intern" ? internView()
                   : clientView();
    I18N.apply(host);
    // Private files get their links, queued files get their chips, and an
    // open thread gets asked again while it is open.
    C.threadDraw(host);
  });
  C.wireThread(host);
  C.wireTimeline(host);

  /* The supervision room and its calendar. Their own listener: the case
     thread's wiring belongs to the case thread, and borrowing it would tie
     two things together that only look alike. */
  host.addEventListener("submit", function (ev) {
    var room = ev.target.closest("[data-room-form]");
    if (room) {
      ev.preventDefault();
      var box = $("[data-room-body]", room);
      var said = box ? box.value.trim() : "";
      if (!said) return;
      Store.sayInRoom({ mentorshipId: room.getAttribute("data-room-form"),
                        authorId: Session.user().id, body: said });
      if (box) box.value = "";
      App.rerender();
      return;
    }

    var cal = ev.target.closest("[data-session-form]");
    if (!cal) return;
    ev.preventDefault();
    var title = ($("[data-session-title]", cal) || {}).value || "";
    var when = ($("[data-session-when]", cal) || {}).value || "";
    var hours = +(($("[data-session-hours]", cal) || {}).value || 1);
    if (!title.trim() || !when) return;
    var m = Store.mentorship(cal.getAttribute("data-session-form"));
    Store.addSession({ mentorshipId: m.id, mentorId: m.mentorId, title: title.trim(),
                       startsAt: new Date(when).toISOString(), hours: hours,
                       kind: "training", attended: false });
    App.rerender();
  });

  /** Put the conversation where the eye is, and the cursor in it. */
  function goToThread() {
    var el = $("[data-thread]", host);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    var box = $("[data-thread-body]", host);
    if (box) box.focus({ preventScroll: true });
  }

  /* ====================================================== events ========== */
  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var me = Session.user();
    var hit = function (attr) {
      var el = t.closest("[" + attr + "]");
      return el ? el.getAttribute(attr) : null;
    };

    var f = t.closest("[data-filter]");
    if (f) { filter = f.getAttribute("data-filter"); App.rerender(); return; }

    /* --- looking for a supervisor --- */
    var bs = hit("data-buy-sup");
    if (bs) {
      Store.buySupervision(bs, function (word) {
        var say = { bought: "sup.bought", "already supervised": "sup.alreadySupervised",
                    "already bought": "sup.alreadyBought", "not offered": "sup.notOffered" };
        App.toast(I18N.t(say[word] || "sup.notOffered"),
                  word === "bought" ? "check" : "alert");
        App.rerender();
      });
      return;
    }
    if (t.closest("[data-call-send]")) {
      var box = $("[data-call-note]", host);
      var note = box ? box.value.trim() : "";
      var err = $("[data-call-error]", host);
      if (note.length < 5) {
        if (err) { err.textContent = I18N.t("call.need"); err.hidden = false; }
        return;
      }
      Store.callForMentor(note, null);
      App.toast(I18N.t("call.sent"), "check");
      App.rerender();
      return;
    }
    var cd = hit("data-call-drop");
    if (cd) { Store.withdrawCall(cd); App.rerender(); return; }
    var ca = hit("data-call-answer");
    if (ca) {
      // Answering a call is opening a mentorship out of it — the trainee
      // still has to accept, because the side that asked does not also
      // answer, and that rule is the same whichever end started it.
      var forWhom = t.closest("[data-call-intern]").getAttribute("data-call-intern");
      Store.openMentorship({ mentorId: me.id, internId: forWhom, openedBy: "mentor",
                             fee: (me.mentorshipFee || 0), inviteId: ca });
      App.toast(I18N.t("men.invited"), "check");
      App.rerender();
      return;
    }

    /* --- a free screening --- */
    var st2 = hit("data-scr-take");
    if (st2) {
      var word = Store.takeScreening(st2);
      App.toast(I18N.t(word === "yours" ? "scr.took" : "scr.needMentor"),
                word === "yours" ? "check" : "alert");
      App.rerender();
      return;
    }
    var ss = hit("data-scr-submit");
    if (ss) {
      // Up to the supervisor, not out to the client: a screening is delivered
      // by the lawyer who answers for it, never by the trainee who wrote it.
      Store.setRequest(ss, { status: "drafted" });
      Store.sendMessage({ requestId: ss, authorId: me.id, audience: "internal",
                          body: I18N.t("scr.submitted") });
      App.toast(I18N.t("scr.submitted"), "check");
      App.rerender();
      return;
    }
    var sa = hit("data-scr-approve");
    if (sa) {
      Store.setRequest(sa, { status: "delivered" });
      App.toast(I18N.t("scr.approved"), "check");
      App.rerender();
      return;
    }

    /* --- supervision --- */
    var my = hit("data-men-yes");
    if (my) { Store.setMentorship(my, { status: "active" }); App.rerender(); return; }
    var mn = hit("data-men-no");
    if (mn) { Store.setMentorship(mn, { status: "declined" }); App.rerender(); return; }
    var men = hit("data-men-end");
    if (men) { Store.setMentorship(men, { status: "ended" }); App.rerender(); return; }
    var mp = hit("data-men-pay");
    if (mp) {
      Store.chargeSponsorship(mp, function (word) {
        App.toast(I18N.t(word === "paid" ? "men.paid" : "men.unpaid"),
                  word === "paid" ? "check" : "alert");
        App.rerender();
      });
      return;
    }
    var ma = hit("data-men-attended");
    if (ma) { Store.setSession(ma, { attended: true }); App.rerender(); return; }

    /* --- a discount code --- */
    var pa = hit("data-promo-apply");
    if (pa) {
      var box = $('[data-promo="' + pa + '"] [data-promo-code]', host);
      var typed = box ? box.value.trim() : "";
      if (!typed) return;
      Store.redeemPromo(pa, typed, function (word, answer) {
        // The answer is kept so the box can say what happened. A refusal with
        // no sentence beside it tells somebody only that they are wrong.
        promoTried[pa] = answer;
        if (word === "applied") App.toast(I18N.t("promo.apply"), "check");
        App.rerender();
      });
      return;
    }
    var pc = hit("data-promo-clear");
    if (pc) {
      Store.clearPromo(pc);
      promoTried[pc] = null;
      App.rerender();
      return;
    }

    /* --- client --- */
    var bc = hit("data-brief-cancel");
    if (bc) {
      Store.setQuote(bc, { status: "cancelled" });
      App.toast(I18N.t("quotes.cancelled"), "close");
      return;
    }

    var gu = hit("data-guarantee");
    if (gu) {
      if (!global.confirm(I18N.t("guar.confirm"))) return;
      Store.refundUnderGuarantee(gu, function (word) {
        if (word === "refunded") { App.toast(I18N.t("guar.done"), "check"); App.rerender(); }
        else App.toast(I18N.t("guar.failed", { why: String(word || "") }), "alert");
      });
      return;
    }

    var pl = hit("data-pile");
    if (pl) { pile = pl; open = null; path = null; App.rerender(); return; }

    var ph = hit("data-path");
    if (ph) { path = path === ph ? null : ph; App.rerender(); return; }

    var det = hit("data-detail");
    if (det) {
      var wantsThread = !!t.closest("[data-go-thread]");
      open = (open === det && !wantsThread) ? null : det;
      App.rerender();
      if (wantsThread) goToThread();
      return;
    }
    if (t.closest("[data-detail-close]")) { open = null; App.rerender(); return; }

    var rt = hit("data-rate");
    if (rt) { open = rt; rating[rt] = rating[rt] || 0; App.rerender(); return; }

    var star = t.closest("[data-star]");
    if (star) {
      rating[star.getAttribute("data-for")] = +star.getAttribute("data-star");
      App.rerender();
      return;
    }

    var send = hit("data-rate-send");
    if (send) {
      if (!rating[send]) { App.toast(I18N.t("rate.needStars"), "star"); return; }
      var r = M.request(send);
      var box = $("[data-rate-body]", host);
      Store.addReview({
        targetId: r.lawyerId, authorId: Session.user().id, requestId: r.id,
        rating: rating[send], date: { ar: I18N.t("common.today"), en: I18N.t("common.today") },
        body: { ar: box ? box.value : "", en: box ? box.value : "" }
      });
      Store.setRequest(r.id, { rated: true, status: "completed" });
      Store.notify({ to: r.lawyerId, type: "rated", ref: r.id });
      delete rating[send];
      open = null;
      App.toast(I18N.t("rate.done"), "check");
      return;
    }

    /* --- accepting, revising, refusing --- */
    var acc = hit("data-accept");
    if (acc) {
      Store.setRequest(acc, { status: "completed", acceptedAt: Date.now() });
      M.partiesOf(M.request(acc), Session.user().id).forEach(function (id) {
        Store.notify({ to: id, type: "accepted", ref: acc });
      });
      App.toast(I18N.t("accept.done"), "check");
      return;
    }

    var rev = hit("data-revise");
    if (rev) { revising = rev; arguing = null; App.rerender(); return; }

    var arg = hit("data-argue");
    if (arg) { arguing = arg; revising = null; App.rerender(); return; }

    if (t.closest("[data-argue-cancel]")) { arguing = revising = null; App.rerender(); return; }

    var rs = hit("data-revise-send");
    if (rs) {
      var rbody = $("[data-argue-body]", host);
      var rwhat = rbody ? rbody.value.trim() : "";
      if (!rwhat) { App.toast(I18N.t("accept.reviseNeed"), "alert"); return; }
      // Back into the lawyer's hands, and the window starts again from the
      // next delivery — not from the first one.
      Store.setRequest(rs, {
        status: "in_progress", deliveredAt: null,
        revisions: (M.requestState(M.request(rs)).revisions || 0) + 1,
        revisionNote: rwhat
      });
      Store.notify({ to: M.request(rs).lawyerId, type: "revision", ref: rs });
      revising = null;
      App.toast(I18N.t("accept.reviseDone"), "check");
      return;
    }

    var as2 = hit("data-argue-send");
    if (as2) {
      var abody = $("[data-argue-body]", host);
      var why = abody ? abody.value.trim() : "";
      if (!why) { App.toast(I18N.t("accept.disputeNeed"), "alert"); return; }
      Store.openDispute({ requestId: as2, byId: Session.user().id, reason: why });
      // Everyone who has money or work in this, plus whoever has to decide it.
      M.partiesOf(M.request(as2), Session.user().id)
        .concat(M.users().filter(function (u) { return u.roles.indexOf("staff") !== -1; })
                         .map(function (u) { return u.id; }))
        .forEach(function (id) { Store.notify({ to: id, type: "disputed", ref: as2 }); });
      arguing = null;
      App.toast(I18N.t("accept.disputeSent"), "alert");
      return;
    }

    /* --- lawyer --- */
    var gen = t.closest("[data-gen]");
    if (gen) {
      var gid = gen.getAttribute("data-gen");
      gen.disabled = true;
      gen.textContent = I18N.t("ai.generating");
      setTimeout(function () {
        open = gid;
        Store.setRequest(gid, { status: "drafted" });
        App.toast(I18N.t("ai.generated"), "sparkle");
      }, 700);
      return;
    }

    var op = hit("data-open");
    if (op) {
      open = op;
      App.rerender();
      if (t.closest("[data-go-thread]")) goToThread();
      return;
    }
    if (t.closest("[data-draft-close]")) { open = null; App.rerender(); return; }

    var ap = hit("data-approve");
    if (ap) {
      var body = $("[data-draft-body]", host);
      Store.setRequest(ap, { status: "delivered", body: body ? body.value : null });
      Store.notify({ to: M.request(ap).clientId, type: "delivered", ref: ap });
      open = null;
      App.toast(I18N.t("inbox.completed"), "check");
      return;
    }

    var dl = hit("data-deliver");
    if (dl) {
      Store.setRequest(dl, { status: "delivered" });
      Store.notify({ to: M.request(dl).clientId, type: "delivered", ref: dl });
      App.toast(I18N.t("inbox.completed"), "check"); return;
    }

    var as = t.closest("[data-assign]");
    if (as) { openAssign(as.getAttribute("data-assign"), as.parentNode); return; }

    var bc = hit("data-broadcast");
    if (bc) {
      open = null;
      Store.clearApplicants(bc);
      Store.setRequest(bc, { assignedTo: null, status: "open_to_interns", internShare: readShare() });
      M.interns().forEach(function (u) {
        if (u.status === "verified") Store.notify({ to: u.id, type: "opened", ref: bc });
      });
      App.toast(I18N.t("inbox.broadcastDone"), "gavel");
      return;
    }

    var pick = t.closest("[data-pick-intern]");
    if (pick) {
      var who = M.user(pick.getAttribute("data-pick-intern"));
      var forId = pick.getAttribute("data-for");
      var share = readShare();
      open = null;
      Store.clearApplicants(forId);
      Store.setRequest(forId, share == null
        ? { assignedTo: who.id, status: "with_intern" }
        : { assignedTo: who.id, status: "with_intern", internShare: share });
      Store.notify({ to: who.id, type: "routed", ref: forId });
      App.toast(I18N.t("inbox.assignDone", { name: tx(who.name) }), "graduation");
      return;
    }

    var un = hit("data-unassign");
    if (un) {
      Store.clearApplicants(un);
      Store.setRequest(un, { assignedTo: null, status: "new" });
      App.toast(I18N.t("inbox.unassigned"), "arrow-back");
      return;
    }

    /* --- intern --- */
    var ap2 = hit("data-apply");
    if (ap2) {
      Store.apply(ap2, Session.user().id);
      App.toast(I18N.t("task.appliedToast"), "send");
      return;
    }

    var to = hit("data-task-open");
    if (to) {
      open = open === to ? null : to;
      if (M.requestState(M.request(to)).status === "with_intern") {
        Store.setRequest(to, { status: "in_progress" });
        App.toast(I18N.t("task.started"), "check");
      } else App.rerender();
      return;
    }

    var ts = hit("data-task-save");
    if (ts) {
      var tb = $("[data-task-body]", host);
      Store.setRequest(ts, { body: tb ? tb.value : "" });
      App.toast(I18N.t("task.saved"), "check");
      return;
    }

    var td = hit("data-task-deliver");
    if (td) {
      var tb2 = $("[data-task-body]", host);
      open = null;
      Store.setRequest(td, { status: "delivered", body: tb2 ? tb2.value : "" });
      App.toast(I18N.t("task.delivered"), "send");
      return;
    }

    /* --- the conversation --- */
    var sideTab = hit("data-thread-side");
    if (sideTab) { side = sideTab; App.rerender(); return; }

    var pop = $(".assign-pop");
    if (pop && !t.closest(".assign-pop")) pop.remove();
  });

});
