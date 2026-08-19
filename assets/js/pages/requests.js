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
  var rating = {};      // requestId -> stars picked but not yet sent
  var arguing = null;   // requestId whose refusal form is open
  var revising = null;  // requestId whose revision form is open

  function guest() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", "auth.guestHint") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="login.html" data-i18n="auth.signIn"></a></p></div>';
  }

  /* ====================================================== client ========== */
  function clientView() {
    var me = Session.user();
    var live = M.requestsForClient(me.id, "open");
    var past = M.requestsForClient(me.id, "past");

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="req.heading"></h1>' +
        '<p class="lead" data-i18n="req.leadClient"></p></header>' +

      '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
        '<h2 class="subtitle" style="margin-bottom:var(--s-5)" data-i18n="req.current"></h2>' +
        (live.length
          ? '<div class="req-list">' + live.map(clientRow).join("") + "</div>"
          : '<p class="small muted" data-i18n="req.noneCurrent"></p>') +
      "</section>" +

      '<section class="card card--pad">' +
        '<h2 class="subtitle" style="margin-bottom:var(--s-5)" data-i18n="req.past"></h2>' +
        (past.length
          ? '<div class="req-list">' + past.map(clientRow).join("") + "</div>"
          : '<p class="small muted" data-i18n="req.nonePast"></p>') +
      "</section></div>";
  }

  /* What the client is allowed to see. Drafting, assistant queues and trainee
     routing are how the work gets done, not something the client ordered — so
     all three collapse into one honest word: in progress. */
  var CLIENT_STATUS = {
    drafted: "in_progress", with_intern: "in_progress", assigned: "in_progress",
    open_to_interns: "in_progress"
  };

  function clientRow(r) {
    var st = M.requestState(r);
    var lawyer = M.user(r.lawyerId);
    var canRate = (st.status === "delivered" || st.status === "completed") && !st.rated;

    return '<div>' + C.requestRow(r, {
      status: CLIENT_STATUS[st.status] || st.status,
      actions: function () {
        var type = M.serviceType(r.typeId);
        var live = type && type.mode === "live" &&
          ["delivered", "completed", "cancelled"].indexOf(st.status) === -1;
        return (live
            ? '<a class="btn btn--primary btn--sm" href="call.html?id=' + esc(r.id) + '">' +
              Icons.svg(type.icon, "icon-sm") + esc(I18N.t("inbox.join")) + "</a>"
            : "") +
          '<button class="btn btn--ghost btn--sm" type="button" data-detail="' + esc(r.id) + '">' +
            esc(I18N.t("req.openDetails")) + "</button>" +
          (canRate
            ? '<button class="btn btn--outline btn--sm" type="button" data-rate="' + esc(r.id) + '">' +
              Icons.svg("star", "icon-sm") + esc(I18N.t("rate.cta")) + "</button>"
            : st.rated
              ? '<span class="tiny muted">' + esc(I18N.t("rate.already")) + "</span>"
              : "");
      }
    }) +
    (open === r.id ? clientDetail(r, st, lawyer) : "") + "</div>";
  }

  function clientDetail(r, st, lawyer) {
    return '<div class="card card--pad" style="margin:var(--s-2) 0 var(--s-4)">' +
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
      acceptPanel(r) +
      (rating[r.id] !== undefined ? rateForm(r) : "") +
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
      "</div>");
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

  function lawyerActions(r) {
    var st = M.requestState(r);
    var t = M.serviceType(r.typeId) || {};
    if (st.status === "delivered" || st.status === "completed") return "";

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

    return main +
      '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
        Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>";
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
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline" data-i18n="inbox.title"></h1>' +
        '<p class="lead" data-i18n="inbox.lead"></p></header>' +
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
                  '<strong class="tiny"><span class="num">' + I18N.num(r.price) + "</span> " +
                    esc(I18N.t("common.sar")) + "</strong>" +
                  '<div class="inbox-row__actions">' + lawyerActions(r) + "</div>" +
                "</div></div>" +
              (open === r.id
                ? (M.requestState(r).status === "open_to_interns" && !M.requestState(r).assignedTo
                    ? applicantsPanel(r)
                    : draftPanel(r))
                : "") + "</div>";
          }).join("")
        : '<p class="muted center" style="padding:var(--s-8)">' + esc(I18N.t("inbox.empty")) + "</p>") +
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
        '<div><span class="tiny muted">' + esc(I18N.t("inbox.revenue")) + "</span>" +
          '<strong style="display:block;color:var(--accent)"><span class="num">' +
            I18N.num(r.price) + "</span> " + esc(I18N.t("common.sar")) + "</strong></div>" +
        '<span class="grow"></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
          Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>" +
        '<button class="btn btn--accent" type="button" data-approve="' + esc(r.id) + '">' +
          Icons.svg("check", "icon-sm") + esc(I18N.t("ai.approve")) + "</button>" +
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
  function internView() {
    var me = Session.user();
    var mine = M.requestsForIntern(me.id);
    var pool = M.openInternTasks();

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="task.heading"></h1>' +
        '<p class="lead" data-i18n="task.lead"></p></header>' +
      (mine.length
        ? mine.map(internRow).join("")
        : C.empty("inbox", "task.none")) +

      '<section style="margin-top:var(--s-12)">' +
        '<h2 class="headline" data-i18n="task.openPool"></h2>' +
        '<p class="lead" style="margin-bottom:var(--s-6)" data-i18n="task.openPoolLead"></p>' +
        (pool.length
          ? pool.map(function (r) { return openTaskRow(r, me); }).join("")
          : C.empty("gavel", "task.noOpen")) +
      "</section></div>";
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

    return '<article class="card card--pad" style="margin-bottom:var(--s-4)">' +
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
              '<button class="btn btn--accent btn--sm" type="button" data-task-deliver="' + esc(r.id) + '">' +
                Icons.svg("send", "icon-sm") + esc(I18N.t("task.deliver")) + "</button></div></div>"
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
  });

  /* ====================================================== events ========== */
  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (attr) {
      var el = t.closest("[" + attr + "]");
      return el ? el.getAttribute(attr) : null;
    };

    var f = t.closest("[data-filter]");
    if (f) { filter = f.getAttribute("data-filter"); App.rerender(); return; }

    /* --- client --- */
    var det = hit("data-detail");
    if (det) { open = open === det ? null : det; App.rerender(); return; }
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
      delete rating[send];
      open = null;
      App.toast(I18N.t("rate.done"), "check");
      return;
    }

    /* --- accepting, revising, refusing --- */
    var acc = hit("data-accept");
    if (acc) {
      Store.setRequest(acc, { status: "completed", acceptedAt: Date.now() });
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
    if (op) { open = op; App.rerender(); return; }
    if (t.closest("[data-draft-close]")) { open = null; App.rerender(); return; }

    var ap = hit("data-approve");
    if (ap) {
      var body = $("[data-draft-body]", host);
      Store.setRequest(ap, { status: "delivered", body: body ? body.value : null });
      open = null;
      App.toast(I18N.t("inbox.completed"), "check");
      return;
    }

    var dl = hit("data-deliver");
    if (dl) { Store.setRequest(dl, { status: "delivered" }); App.toast(I18N.t("inbox.completed"), "check"); return; }

    var as = t.closest("[data-assign]");
    if (as) { openAssign(as.getAttribute("data-assign"), as.parentNode); return; }

    var bc = hit("data-broadcast");
    if (bc) {
      open = null;
      Store.clearApplicants(bc);
      Store.setRequest(bc, { assignedTo: null, status: "open_to_interns", internShare: readShare() });
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

    var pop = $(".assign-pop");
    if (pop && !t.closest(".assign-pop")) pop.remove();
  });
});
