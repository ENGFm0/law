/* ==========================================================================
   The staff desk.

   Three jobs that all come down to the same thing — somebody neutral has to
   decide, and has to be answerable for it afterwards:

     • who is allowed to work here at all (the licence queue)
     • what happens to money the client has refused to release (disputes)
     • what the platform takes, and whether tax is being charged

   Every action here is written to a record that is appended to and never
   edited, because a decision nobody can be asked about later is not a
   decision — it is just something that happened.
   ========================================================================== */
Pages.define("admin", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-admin]");
  if (!host) return;

  var rejecting = null;    // account id whose rejection reason is being written
  var deciding = null;     // dispute id being decided
  var outcome = {};        // disputeId -> release | refund | split

  function denied() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", "admin.denied") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--ghost" href="index.html" data-i18n="nav.home"></a></p></div>';
  }

  /* ------------------------------------------------ the licence queue ---- */
  function queue() {
    var waiting = M.pendingVerification();
    return '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="admin.queue"></h2>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-5)" data-i18n="admin.queueLead"></p>' +
      (waiting.length
        ? waiting.map(waitingRow).join("")
        : '<p class="small muted" data-i18n="admin.queueEmpty"></p>') +
      "</section>";
  }

  function expired(licence) {
    if (!licence || !licence.expiry) return false;
    return new Date(licence.expiry).getTime() < Date.now();
  }

  function waitingRow(u) {
    var lic = u.licence, lawyer = u.roles.indexOf("lawyer") !== -1;
    return '<div class="card card--pad" style="margin-bottom:var(--s-3)">' +
      '<div class="row between wrap gap-3">' +
        '<div class="row gap-3">' + C.avatar(u, "sm") +
          "<div><strong>" + esc(tx(u.name)) + "</strong>" +
          '<div class="tiny muted">' + esc(tx(u.title || {})) + "</div></div></div>" +
        C.statusPill("pending") +
      "</div>" +

      '<div class="row gap-6 wrap small" style="margin-top:var(--s-4)">' +
        (lawyer && lic
          ? '<span><span class="tiny muted" data-i18n="admin.licence"></span> ' +
              '<span class="num">' + esc(lic.number) + "</span></span>" +
            '<span><span class="tiny muted" data-i18n="admin.authority"></span> ' +
              esc(tx(lic.authority || {})) + "</span>" +
            '<span><span class="tiny muted" data-i18n="admin.expiry"></span> ' +
              esc(lic.expiry || "") + "</span>"
          : '<span><span class="tiny muted" data-i18n="admin.university"></span> ' +
              esc(tx(u.university || {})) + "</span>") +
      "</div>" +

      // An expired licence is the one thing that must never be missed, so it
      // is said out loud rather than left for the reviewer to notice.
      (expired(lic)
        ? '<p class="small" style="margin-top:var(--s-3);color:var(--danger)">' +
          Icons.svg("clock", "icon-sm") + " " + esc(I18N.t("admin.expired")) + "</p>"
        : "") +

      (rejecting === u.id
        ? '<div style="margin-top:var(--s-4)">' +
            '<p class="small" data-i18n="admin.rejectWhy"></p>' +
            '<textarea class="input" rows="3" style="margin-top:var(--s-2)" data-why></textarea>' +
            '<div class="row gap-3" style="margin-top:var(--s-3)">' +
              '<button class="btn btn--primary btn--sm" type="button" data-reject-send="' + esc(u.id) + '">' +
                esc(I18N.t("admin.reject")) + "</button>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-cancel>' +
                esc(I18N.t("accept.cancel")) + "</button>" +
            "</div></div>"
        : '<div class="row gap-3" style="margin-top:var(--s-4)">' +
            '<button class="btn btn--primary btn--sm" type="button" data-approve="' + esc(u.id) + '">' +
              Icons.svg("check", "icon-sm") + esc(I18N.t("admin.approve")) + "</button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-reject="' + esc(u.id) + '">' +
              esc(I18N.t("admin.reject")) + "</button>" +
          "</div>") +
    "</div>";
  }

  /* ---------------------------------------------------- open disputes ---- */
  function disputes() {
    var open = M.openDisputes();
    return '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="admin.disputes"></h2>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-5)" data-i18n="admin.disputesLead"></p>' +
      (open.length
        ? open.map(disputeRow).join("")
        : '<p class="small muted" data-i18n="admin.disputesEmpty"></p>') +
      "</section>";
  }

  function disputeRow(d) {
    var r = M.request(d.requestId);
    if (!r) return "";
    var st = M.requestState(r), split = M.distribute(r);
    var who = M.user(d.byId), pick = outcome[d.id] || "";

    return '<div class="card card--pad card--rule-gold" style="margin-bottom:var(--s-4)">' +
      '<div class="row between wrap gap-3">' +
        "<strong>" + esc(tx(r.title || {})) + "</strong>" +
        "<span>" + C.num(r.price) + " " + C.sar() + "</span>" +
      "</div>" +
      '<p class="tiny muted" style="margin-top:var(--s-2)">' +
        esc(I18N.t("admin.raisedBy")) + ": " + esc(who ? tx(who.name) : d.byId) + "</p>" +

      '<p class="tiny muted" style="margin-top:var(--s-4)" data-i18n="admin.claim"></p>' +
      '<p class="small">' + esc(d.reason) + "</p>" +

      '<p class="tiny muted" style="margin-top:var(--s-4)" data-i18n="admin.delivered"></p>' +
      (st.body
        ? '<pre class="draft-text" style="min-height:auto" readonly>' + esc(st.body) + "</pre>"
        : '<p class="small muted" data-i18n="admin.nothingDelivered"></p>') +

      // The trainee is not in this argument and cannot speak in it, so their
      // position is put in front of whoever decides rather than left to be
      // remembered.
      (split.intern > 0
        ? '<div class="card card--pad" style="margin-top:var(--s-4);background:var(--surface-2)">' +
            '<p class="small">' + esc(I18N.t("admin.internNote")) + "</p>" +
            '<p class="small" style="margin-top:var(--s-2)"><strong>' +
              esc(I18N.t("admin.internOwed")) + ": " +
              C.num(Math.round(split.intern / 100)) + " " + C.sar() + "</strong></p>" +
          "</div>"
        : "") +

      '<h4 class="subtitle" style="margin-top:var(--s-5)" data-i18n="admin.decide"></h4>' +
      '<div class="row gap-3 wrap" style="margin-top:var(--s-3)">' +
        choice(d.id, "release", "admin.forLawyer", pick) +
        choice(d.id, "refund", "admin.forClient", pick) +
        choice(d.id, "split", "admin.split", pick) +
      "</div>" +

      (pick === "split"
        ? '<div style="margin-top:var(--s-3)">' +
            '<label class="tiny muted" data-i18n="admin.lawyerPct"></label>' +
            '<input class="input" type="number" min="0" max="100" value="60" data-pct>' +
          "</div>"
        : "") +

      (pick
        ? '<div style="margin-top:var(--s-4)">' +
            '<p class="small" data-i18n="admin.reasonLabel"></p>' +
            '<textarea class="input" rows="3" style="margin-top:var(--s-2)" data-why></textarea>' +
            '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-3)" type="button" ' +
              'data-resolve="' + esc(d.id) + '">' + esc(I18N.t("admin.decide")) + "</button>" +
          "</div>"
        : "") +
    "</div>";
  }

  function choice(id, value, key, pick) {
    return '<button class="btn btn--sm ' + (pick === value ? "btn--primary" : "btn--outline") +
      '" type="button" data-outcome="' + esc(value) + '" data-for="' + esc(id) + '">' +
      esc(I18N.t(key)) + "</button>";
  }

  /* -------------------------------------------------------- settings ----- */
  function settings() {
    var s = M.platformSettings();
    return '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="admin.settings"></h2>' +

      '<div style="margin-top:var(--s-5)">' +
        '<label class="tiny muted" data-i18n="admin.commission"></label>' +
        '<input class="input" type="number" min="0" max="' + M.COMMISSION_MAX_PCT +
          '" value="' + s.commissionPct + '" data-commission>' +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="admin.commissionNote"></p>' +
      "</div>" +

      '<div style="margin-top:var(--s-5)">' +
        '<label class="row gap-3"><input type="checkbox" data-vat' + (s.vatEnabled ? " checked" : "") +
          '><span data-i18n="admin.vat"></span></label>' +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="admin.vatNote"></p>' +
      "</div>" +

      '<div style="margin-top:var(--s-5)">' +
        '<label class="tiny muted" data-i18n="admin.vatPct"></label>' +
        '<input class="input" type="number" min="0" max="100" value="' + s.vatPct + '" data-vatpct>' +
      "</div>" +

      '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-5)" type="button" ' +
        'data-save-settings>' + esc(I18N.t("admin.save")) + "</button>" +
    "</section>";
  }

  /* ----------------------------------------------------------- record ---- */
  var ACT = { approve: "admin.actApprove", reject: "admin.actReject",
              resolve: "admin.actResolve", settings: "admin.actSettings" };

  function record() {
    var log = Store.audit().slice().reverse();
    return '<section class="card card--pad">' +
      '<h2 class="subtitle" data-i18n="admin.audit"></h2>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-5)" data-i18n="admin.auditLead"></p>' +
      (log.length
        ? log.map(function (e) {
            var by = M.user(e.byId);
            return '<div class="row between wrap gap-3 small" style="padding-block:var(--s-3);' +
              'border-block-end:1px solid var(--border)">' +
              "<span>" + esc(I18N.t(ACT[e.action] || e.action)) +
                (e.subject ? " — " + esc(e.subject) : "") + "</span>" +
              '<span class="tiny muted">' + esc(by ? tx(by.name) : "") + "</span></div>";
          }).join("")
        : '<p class="small muted" data-i18n="admin.auditEmpty"></p>') +
    "</section>";
  }

  /* ------------------------------------------------------------ render --- */
  App.onRender(function () {
    if (!Session.is("staff")) { host.innerHTML = denied(); I18N.apply(host); return; }
    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="admin.heading"></h1>' +
        '<p class="lead" data-i18n="admin.lead"></p></header>' +
      queue() + disputes() + settings() + record() + "</div>";
    I18N.apply(host);
  });

  /* ------------------------------------------------------------ events --- */
  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (a) { var el = t.closest("[" + a + "]"); return el ? el.getAttribute(a) : null; };
    var me = Session.user();
    if (!me || !Session.is("staff")) return;

    var ap = hit("data-approve");
    if (ap) {
      Store.updateAccount(ap, { status: "verified" });
      Store.log({ action: "approve", byId: me.id, targetId: ap,
                  subject: tx((M.user(ap) || {}).name || {}) });
      Store.notify({ to: ap, type: "approved", ref: ap });
      App.toast(I18N.t("admin.approved"), "check");
      return;
    }

    var rj = hit("data-reject");
    if (rj) { rejecting = rj; App.rerender(); return; }
    if (t.closest("[data-cancel]")) { rejecting = null; App.rerender(); return; }

    var rs = hit("data-reject-send");
    if (rs) {
      var box = $("[data-why]", host);
      var why = box ? box.value.trim() : "";
      if (!why) { App.toast(I18N.t("admin.rejectNeed"), "alert"); return; }
      Store.updateAccount(rs, { status: "rejected", rejectedReason: why });
      Store.log({ action: "reject", byId: me.id, targetId: rs, reason: why,
                  subject: tx((M.user(rs) || {}).name || {}) });
      Store.notify({ to: rs, type: "rejected", ref: rs });
      rejecting = null;
      App.toast(I18N.t("admin.rejected"), "check");
      return;
    }

    var oc = hit("data-outcome");
    if (oc) { outcome[t.closest("[data-for]").getAttribute("data-for")] = oc; App.rerender(); return; }

    var rv = hit("data-resolve");
    if (rv) {
      var why2 = $("[data-why]", host), pctEl = $("[data-pct]", host);
      var reason = why2 ? why2.value.trim() : "";
      // A ruling with no reason is not reviewable, so it is not accepted.
      if (!reason) { App.toast(I18N.t("admin.reasonNeed"), "alert"); return; }
      var pick = outcome[rv];
      Store.resolveDispute(rv, {
        outcome: pick,
        lawyerPct: pctEl ? Math.max(0, Math.min(100, +pctEl.value || 0)) : null,
        reason: reason, byId: me.id
      });
      Store.log({ action: "resolve", byId: me.id, targetId: rv, reason: reason,
                  subject: pick });
      // Both sides are told, and they are told the same thing.
      var dq = Store.disputes().filter(function (x) { return x.id === rv; })[0];
      if (dq) {
        M.partiesOf(M.request(dq.requestId), null).forEach(function (id) {
          Store.notify({ to: id, type: "resolved", ref: dq.requestId });
        });
      }
      delete outcome[rv];
      deciding = null;
      App.toast(I18N.t("admin.decided"), "check");
      return;
    }

    if (t.closest("[data-save-settings]")) {
      var cm = $("[data-commission]", host), vt = $("[data-vat]", host),
          vp = $("[data-vatpct]", host);
      var pct = cm ? +cm.value : 10;
      if (pct > M.COMMISSION_MAX_PCT) { App.toast(I18N.t("admin.overCap"), "alert"); return; }
      Store.setSettings({
        commissionPct: M.clampCommission(pct),
        vatEnabled: vt ? vt.checked : false,
        vatPct: vp ? Math.max(0, Math.min(100, +vp.value || 0)) : M.DEFAULT_VAT_PCT
      });
      Store.log({ action: "settings", byId: me.id,
                  subject: M.clampCommission(pct) + "%" });
      App.toast(I18N.t("admin.saved"), "check");
      return;
    }
  });
});
