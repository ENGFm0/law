/* ==========================================================================
   The assistant — a lawyer's tool, and only a lawyer's.

   A client never reaches this page and never sees the word. What they buy is
   a document at a stated price; how it gets written is the lawyer's business,
   and nothing here is published until the lawyer approves it.

   Two halves: the knowledge base the drafting reads from (the lawyer's own
   files plus the regulations they switch on), and the queue of their own
   requests waiting to be drafted.
   ========================================================================== */
Pages.define("assistant", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-assistant]");
  if (!host) return;

  var files = null;          // the lawyer's uploads, this session only
  var regs = {};             // regulation id -> on
  var uploads = 0;
  var openDraft = null;

  function ensure() {
    if (!files) files = global.SEED.lawyerFiles.slice();
    global.SEED.regulations.forEach(function (r) {
      if (!(r.id in regs)) regs[r.id] = r.on;
    });
  }

  function gate(key) {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", key || "ai.forLawyers") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="index.html" data-i18n="art.back"></a></p></div>';
  }

  /* ---------- knowledge base ---------- */
  function kb() {
    var on = global.SEED.regulations.filter(function (r) { return regs[r.id]; }).length;
    return '<aside class="stack gap-6">' +
      '<section class="card card--pad">' +
        '<div class="row between gap-3">' +
          '<h2 class="subtitle" data-i18n="ai.myFiles"></h2>' +
          '<button class="btn btn--outline btn--sm" type="button" data-kb-upload>' +
            Icons.svg("upload", "icon-sm") + '<span data-i18n="ai.upload"></span></button></div>' +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="ai.myFilesHint"></p>' +
        '<div style="margin-top:var(--s-4)">' + files.map(function (f) {
          return '<div class="list-row">' +
            '<span class="list-row__icon" style="color:var(--accent)">' +
              Icons.svg("file-text", "icon-sm") + "</span>" +
            '<div class="grow"><strong class="small">' + esc(tx(f)) + "</strong>" +
              '<p class="tiny muted">' + esc(I18N.t(f.kind === "template" ? "ai.template" : "ai.precedent")) +
                ' <span class="dot"></span> <span class="num">' + esc(f.size) + "</span></p></div>" +
            '<button class="icon-btn" type="button" data-kb-remove="' + esc(f.id) + '" ' +
              'data-i18n-attr="aria-label:ai.removeFile">' + Icons.svg("close", "icon-sm") + "</button></div>";
        }).join("") + "</div>" +
      "</section>" +

      '<section class="card card--pad">' +
        '<div class="row between gap-3">' +
          '<h2 class="subtitle" data-i18n="ai.regs"></h2>' +
          '<span class="tag">' + esc(I18N.t("ai.regsOn", { n: I18N.num(on) })) + "</span></div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="ai.regsHint"></p>' +
        '<div class="stack gap-2" style="margin-top:var(--s-4)">' +
          global.SEED.regulations.map(function (r) {
            return '<label class="check"><input type="checkbox" data-reg="' + esc(r.id) + '"' +
              (regs[r.id] ? " checked" : "") + "><span>" + esc(tx(r)) + "</span></label>";
          }).join("") + "</div>" +
      "</section></aside>";
  }

  /* ---------- the queue: this lawyer's own drafting work ---------- */
  function queue() {
    var me = Session.user();
    var rows = M.requestsForLawyer(me.id).filter(function (r) {
      var st = M.requestState(r).status;
      var type = M.serviceType(r.typeId);
      return type && type.mode !== "live" && st !== "delivered" && st !== "completed" &&
             st !== "cancelled" && !M.requestState(r).assignedTo;
    });

    return '<section class="card card--pad">' +
      '<div class="row between gap-3">' +
        '<h2 class="subtitle" data-i18n="ai.queue"></h2>' +
        '<span class="tag num">' + I18N.num(rows.length) + "</span></div>" +
      (rows.length
        ? '<div style="margin-top:var(--s-4)">' + rows.map(function (r) {
            var st = M.requestState(r).status;
            var ready = st === "drafted";
            var client = M.user(r.clientId);
            return '<div class="list-row">' +
              '<span class="list-row__icon">' + Icons.svg(ready ? "sparkle" : "clock", "icon-sm") + "</span>" +
              '<div class="grow" style="min-width:0"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
                '<p class="tiny muted">' + esc(client ? tx(client.name) : "") +
                  ' <span class="dot"></span> ' + esc(tx(r.ago)) + "</p>" +
                '<p class="tiny faint">' + esc(tx(r.brief)) + "</p></div>" +
              '<div class="stack gap-2" style="align-items:flex-end">' +
                '<span class="status status--' + (ready ? "ok" : "muted") + '">' +
                  esc(I18N.t(ready ? "ai.stateDrafted" : "ai.stateQueued")) + "</span>" +
                '<button class="btn btn--sm ' + (ready ? "btn--primary" : "btn--outline") +
                  '" type="button" data-req="' + esc(r.id) + '">' +
                  esc(I18N.t(ready ? "ai.openDraft" : "ai.generate")) + "</button></div></div>";
          }).join("") + "</div>"
        : '<p class="muted center" style="padding:var(--s-6)" data-i18n="ai.queueEmpty"></p>') +
    "</section>";
  }

  function editor() {
    if (!openDraft) return "";
    var r = M.request(openDraft);
    if (!r) return "";
    var client = M.user(r.clientId);
    var st = M.requestState(r);
    var body = st.body || (r.doc && global.SEED.draftBodies[r.doc] ? tx(global.SEED.draftBodies[r.doc]) : "");
    var onRegs = global.SEED.regulations.filter(function (x) { return regs[x.id]; })
      .slice(0, 3).map(function (x) { return tx(x); }).join("، ");

    return '<section class="panel" style="margin-top:var(--s-6)">' +
      '<div class="panel__head row between wrap gap-3">' +
        "<div><h2 class=\"subtitle\">" + esc(I18N.t("ai.draftFor")) + " " +
          esc(client ? tx(client.name) : "") + "</h2>" +
          '<p class="tiny muted">' + esc(tx(r.title)) + ' <span class="dot"></span> ' +
            esc(I18N.t("ai.aiSource")) + "</p></div>" +
        '<button class="icon-btn" type="button" data-draft-close ' +
          'data-i18n-attr="aria-label:ai.discard">' + Icons.svg("close", "icon-sm") + "</button>" +
      "</div>" +
      '<div style="padding:var(--s-4) var(--s-6) 0">' +
        '<p class="tiny muted">' + esc(I18N.t("ai.basedOn")) + ": " + esc(onRegs) + "</p>" +
        '<p class="tiny muted" style="margin-top:var(--s-1)" data-i18n="ai.editHint"></p></div>' +
      '<textarea class="draft-text" data-draft-body spellcheck="false">' + esc(body) + "</textarea>" +
      '<div class="draft-foot">' +
        '<div><span class="tiny muted" data-i18n="ai.earns"></span>' +
          '<strong style="display:block;color:var(--accent)"><span class="num">' +
            I18N.num(r.price) + "</span> " + esc(I18N.t("common.sar")) + "</strong></div>" +
        '<span class="tiny muted grow">' + esc(I18N.t("ai.reviewMinutes", { n: I18N.num(6) })) + "</span>" +
        '<button class="btn btn--accent" type="button" data-draft-approve>' +
          Icons.svg("check", "icon-sm") + '<span data-i18n="ai.approve"></span></button>' +
      "</div></section>";
  }

  function howItWorks() {
    return '<section class="section section--tight"><div class="container">' +
      '<h2 class="headline" data-i18n="ai.howTitle"></h2>' +
      '<div class="grid grid-4" style="margin-top:var(--s-6)">' +
        [1, 2, 3, 4].map(function (n) {
          return '<div class="card card--pad step"><span class="step__num num">' + I18N.num(n) + "</span>" +
            '<h3 class="subtitle" style="margin-top:var(--s-3)" data-i18n="ai.step' + n + '"></h3>' +
            '<p class="small muted" data-i18n="ai.step' + n + 'Body"></p></div>';
        }).join("") + "</div></div></section>";
  }

  App.onRender(function () {
    if (!Session.is("lawyer")) { host.innerHTML = gate(); I18N.apply(host); return; }
    // Sold, not given. A lawyer without a live subscription is told what it is
    // rather than shown an empty workspace they cannot use.
    if (!M.canDraft(Session.user().id)) {
      host.innerHTML = gate("ai.needsSub"); I18N.apply(host); return;
    }
    ensure();

    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-12)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="ai.lawyerHeading"></h1>' +
        '<p class="lead" data-i18n="ai.lawyerLead"></p>' +
        '<p class="disclaimer" style="margin-top:var(--s-4)">' + Icons.svg("lock", "icon-sm") +
          '<span data-i18n="ai.disclaimer"></span></p>' +
      "</header>" +
      '<div class="grid dash-split">' +
        "<div>" + queue() + editor() + "</div>" +
        kb() +
      "</div></div>" + howItWorks();

    I18N.apply(host);
  });

  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-kb-upload]")) {
      uploads++;
      files = files.concat([{ id: "up-" + uploads, kind: "template", size: "36 KB",
        ar: "ملف مرفوع " + uploads, en: "Uploaded file " + uploads }]);
      App.toast(I18N.t("ai.uploaded"), "check");
      App.rerender();
      return;
    }

    var rm = ev.target.closest("[data-kb-remove]");
    if (rm) {
      var fid = rm.getAttribute("data-kb-remove");
      files = files.filter(function (f) { return f.id !== fid; });
      App.toast(I18N.t("ai.removed"), "close");
      App.rerender();
      return;
    }

    var req = ev.target.closest("[data-req]");
    if (req) {
      var rid = req.getAttribute("data-req");
      if (M.requestState(M.request(rid)).status === "drafted") {
        openDraft = rid;
        App.rerender();
      } else {
        // Drafting takes a beat, so the state change reads as work happening.
        req.disabled = true;
        req.textContent = I18N.t("ai.generating");
        setTimeout(function () {
          openDraft = rid;
          Store.setRequest(rid, { status: "drafted" });
          App.toast(I18N.t("ai.generated"), "sparkle");
        }, 700);
      }
      return;
    }

    if (ev.target.closest("[data-draft-close]")) { openDraft = null; App.rerender(); return; }

    if (ev.target.closest("[data-draft-approve]")) {
      var box = $("[data-draft-body]", host);
      var id = openDraft;
      openDraft = null;
      Store.setRequest(id, { status: "delivered", body: box ? box.value : null });
      App.toast(I18N.t("ai.approved"), "check");
    }
  });

  host.addEventListener("change", function (ev) {
    var reg = ev.target.closest("[data-reg]");
    if (!reg) return;
    regs[reg.getAttribute("data-reg")] = reg.checked;
    App.rerender();
  });
});
