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
    drafted: "in_progress", with_intern: "in_progress", assigned: "in_progress"
  };

  function clientRow(r) {
    var st = M.requestState(r);
    var lawyer = M.user(r.lawyerId);
    var canRate = (st.status === "delivered" || st.status === "completed") && !st.rated;

    return '<div>' + C.requestRow(r, {
      status: CLIENT_STATUS[st.status] || st.status,
      actions: function () {
        return '<button class="btn btn--ghost btn--sm" type="button" data-detail="' + esc(r.id) + '">' +
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
      (rating[r.id] !== undefined ? rateForm(r) : "") +
    "</div>";
  }

  function rateForm(r) {
    var picked = rating[r.id] || 0;
    var buttons = "";
    for (var i = 1; i <= 5; i++) {
      buttons += '<button type="button" class="icon-btn" data-star="' + i + '" data-for="' + esc(r.id) + '" ' +
        'style="color:' + (i <= picked ? "var(--accent)" : "var(--border-strong)") + '">' +
        Icons.svg("star") + "</button>";
    }
    return '<div style="margin-top:var(--s-6);border-top:1px solid var(--border);padding-top:var(--s-5)">' +
      '<h3 class="subtitle" data-i18n="rate.title"></h3>' +
      '<div class="row gap-1" style="margin:var(--s-3) 0">' + buttons + "</div>" +
      '<textarea class="textarea" data-rate-body data-i18n-attr="placeholder:rate.placeholder"></textarea>' +
      '<button class="btn btn--accent btn--sm" type="button" style="margin-top:var(--s-3)" ' +
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

    if (st.assignedTo) {
      var who = M.user(st.assignedTo);
      return '<span class="tiny muted">' +
          esc(I18N.t("inbox.assignedTo", { name: who ? tx(who.name) : "" })) + "</span>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-unassign="' + esc(r.id) + '">' +
          esc(I18N.t("inbox.unassign")) + "</button>";
    }

    if (t.mode === "live") {
      return '<button class="btn btn--primary btn--sm" type="button" data-deliver="' + esc(r.id) + '">' +
        Icons.svg(t.icon, "icon-sm") + esc(I18N.t("inbox.join")) + "</button>";
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
              (open === r.id ? draftPanel(r) : "") + "</div>";
          }).join("")
        : '<p class="muted center" style="padding:var(--s-8)">' + esc(I18N.t("inbox.empty")) + "</p>") +
    "</div>";
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

  /** Three names is not worth a modal. */
  function openAssign(id, anchor) {
    var existing = $(".assign-pop");
    if (existing) existing.remove();
    var pop = document.createElement("div");
    pop.className = "assign-pop";
    pop.innerHTML = '<p class="tiny muted">' + esc(I18N.t("inbox.assignTo")) + "</p>" +
      M.interns().map(function (i) {
        return '<button type="button" data-pick-intern="' + esc(i.id) + '" data-for="' + esc(id) + '">' +
          '<img class="avatar avatar--sm" alt="" width="28" height="28" src="' +
            App.avatarOf(i.name, i.id) + '">' +
          "<span>" + esc(tx(i.name)) + "</span>" +
          '<span class="tiny muted num">' + I18N.num(M.hoursOf(i.id)) + "</span></button>";
      }).join("");
    anchor.appendChild(pop);
  }

  /* ====================================================== intern ========== */
  function internView() {
    var me = Session.user();
    var mine = M.requestsForIntern(me.id);

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="task.heading"></h1>' +
        '<p class="lead" data-i18n="task.lead"></p></header>' +
      (mine.length
        ? mine.map(internRow).join("")
        : C.empty("inbox", "task.none")) +
    "</div>";
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

    var pick = t.closest("[data-pick-intern]");
    if (pick) {
      var who = M.user(pick.getAttribute("data-pick-intern"));
      open = null;
      Store.setRequest(pick.getAttribute("data-for"), { assignedTo: who.id, status: "with_intern" });
      App.toast(I18N.t("inbox.assignDone", { name: tx(who.name) }), "graduation");
      return;
    }

    var un = hit("data-unassign");
    if (un) {
      Store.setRequest(un, { assignedTo: null, status: "new" });
      App.toast(I18N.t("inbox.unassigned"), "arrow-back");
      return;
    }

    /* --- intern --- */
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
