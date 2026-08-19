/* ==========================================================================
   A trainee's page — its own template. No price list and no licence: what a
   trainee has to show is skills, logged hours, and the lawyers who vouched.

   The certificate button appears only for a lawyer who actually supervised
   them, and only once the hours threshold is met.
   ========================================================================== */
Pages.define("intern", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-profile]");
  if (!host) return;

  var id = App.param("id");
  var tab = "skills";
  var deal = { kind: "cases", amount: "", cases: "" };   // the form being filled

  /** Pay is between the two parties, so the tab only exists for them. */
  function canSeePay(u) {
    var me = Session.user();
    if (!me) return false;
    return Session.is("lawyer") || me.id === u.id;
  }

  function tabsFor(u) {
    var t = [["skills", "profile.tabSkills"], ["cert", "profile.tabCert"]];
    if (canSeePay(u)) t.push(["pay", "pay.tab"]);
    return t.concat([["reviews", "profile.tabReviews"], ["articles", "profile.tabArticles"]]);
  }

  function head(u) {
    // Same rule as a lawyer's page: the league table is for the profession.
    var rank = (Session.is("lawyer") || Session.is("intern"))
      ? M.rankOf(u.id, "intern") : { rank: null };
    var prog = M.certProgress(u.id);
    return '<header class="card card--pad" style="margin-bottom:var(--s-8)">' +
      '<div class="row gap-6 wrap" style="align-items:flex-start">' +
        C.avatar(u, "lg") +
        '<div class="grow" style="min-width:0">' +
          '<h1 class="headline row gap-3 wrap">' + esc(tx(u.name)) +
            (M.endorsementsFor(u.id).length
              ? '<span class="verified" data-i18n-attr="title:cert.holder">' +
                Icons.svg("badge", "icon-sm") + "</span>" : "") + "</h1>" +
          '<p class="lead">' + esc(tx(u.university || {})) +
            (u.level ? " · " + esc(tx(u.level)) : "") + "</p>" +
          '<div class="meta-row" style="margin-top:var(--s-4)">' +
            C.ratingLine(u.id) +
            '<span class="dot"></span><span class="muted">' +
              esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + "</span>" +
            (rank.rank ? '<span class="dot"></span><span class="muted">' + esc(I18N.t("profile.rank")) +
              ' <span class="num">' + I18N.num(rank.rank) + "/" + I18N.num(rank.of) + "</span></span>" : "") +
          "</div>" +
          '<div style="margin-top:var(--s-5);max-width:420px">' + C.progressBar(prog.pct) + "</div>" +
        "</div>" +
      "</div></header>";
  }

  function skillsPanel(u) {
    var list = u.skills || [];
    if (!list.length) return '<p class="small muted" data-i18n="profile.noSkills"></p>';
    return '<div class="row gap-2 wrap">' + list.map(function (s) {
      return '<span class="chip is-active">' + esc(tx(s)) + "</span>";
    }).join("") + "</div>" +
      (u.bio ? '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="profile.bio"></h2>' +
        '<p class="lead" style="margin-top:var(--s-3)">' + esc(tx(u.bio)) + "</p>" : "");
  }

  /** Hours, endorsements, and — for the supervising lawyer — the issue button. */
  function certPanel(u) {
    var prog = M.certProgress(u.id);
    var given = M.endorsementsFor(u.id);
    var me = Session.user();
    // Only a lawyer who routed work to this trainee may sign for them.
    var supervised = me && Session.is("lawyer") &&
      M.requestsForIntern(u.id).some(function (r) { return r.lawyerId === me.id; });
    var already = me && given.some(function (e) { return e.lawyerId === me.id; });

    return '<div class="card card--pad">' +
      '<h2 class="subtitle" data-i18n="cert.title"></h2>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)">' +
        esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + " / " +
        '<span class="num">' + I18N.num(prog.needed) + "</span></p>" +
      C.progressBar(prog.pct) +
      (supervised && !already
        ? '<div style="margin-top:var(--s-5)">' +
            '<button class="btn btn--accent btn--sm" type="button" data-issue' +
              (prog.eligible ? "" : " disabled") + ' data-i18n="cert.issueCta"></button>' +
            '<p class="tiny muted" style="margin-top:var(--s-2)">' +
              esc(I18N.t("cert.issueHint", { n: I18N.num(prog.needed) })) + "</p></div>"
        : "") +
    "</div>" +

    '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="profile.supervisors"></h2>' +
    (given.length
      ? '<div class="stack gap-4" style="margin-top:var(--s-4)">' + given.map(function (e) {
          var lw = M.user(e.lawyerId);
          return '<article class="testimony">' +
            '<div class="row gap-3">' + C.avatar(lw, "sm") +
              "<span><strong class=\"small\">" + esc(I18N.t("cert.issuedBy")) + " " +
                esc(lw ? tx(lw.name) : "") + "</strong>" +
              '<p class="tiny muted">' + esc(tx(e.date || {})) + " · " +
                esc(I18N.t("cert.hoursShort", { n: I18N.num(e.hours || 0) })) + "</p></span></div>" +
            (e.note ? '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(e.note)) + "</p>" : "") +
          "</article>";
        }).join("") + "</div>"
      : '<p class="small muted" style="margin-top:var(--s-3)" data-i18n="cert.noneYet"></p>');
  }

  /* ---------- pay: a share per task, or terms settled in advance ---------- */
  function payPanel(u) {
    var me = Session.user();
    var mine = Session.is("lawyer") ? M.agreementFor(me.id, u.id) : null;
    var all = M.agreementsOfIntern(u.id);
    var isSelf = me.id === u.id;

    return '<p class="note-inline" data-i18n="pay.onlyParties"></p>' +

      '<div class="card card--pad" style="margin-top:var(--s-6)">' +
        '<div class="row between wrap gap-3">' +
          '<h2 class="subtitle" data-i18n="pay.earned"></h2>' +
          '<strong class="title" style="color:var(--accent)"><span class="num">' +
            I18N.num(M.earnedBy(u.id)) + "</span> " + esc(I18N.t("common.sar")) + "</strong>" +
        "</div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="pay.shareHint"></p></div>' +

      '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="pay.standing"></h2>' +
      (all.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
            all.map(function (a) { return agreementCard(a, u); }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)" data-i18n="pay.none"></p>') +

      (Session.is("lawyer") && !mine ? agreementForm(u) : "") +
      (isSelf ? "" : "");
  }

  function kindLabel(kind) {
    return I18N.t("pay.kind" + kind.charAt(0).toUpperCase() + kind.slice(1));
  }

  function agreementCard(a, u) {
    var lawyer = M.user(a.lawyerId);
    var me = Session.user();
    var perKey = a.kind === "cases" ? "pay.perCase" : a.kind === "monthly" ? "pay.perMonth" : "pay.perYear";
    return '<article class="card card--pad card--rule-gold">' +
      '<div class="row between wrap gap-4">' +
        '<div class="row gap-3">' + C.avatar(lawyer, "sm") +
          "<div><strong class=\"small\">" +
            esc(I18N.t("pay.with", { name: lawyer ? tx(lawyer.name) : "" })) + "</strong>" +
            '<p class="tiny muted">' + esc(kindLabel(a.kind)) +
              (a.kind === "cases"
                ? " · " + esc(I18N.t("pay.casesProgress",
                    { done: I18N.num(M.casesDone(a)), total: I18N.num(a.cases) }))
                : "") + "</p></div></div>" +
        '<div class="row gap-4">' +
          '<strong class="title" style="color:var(--accent)"><span class="num">' +
            I18N.num(a.amount) + "</span> " + esc(I18N.t("common.sar")) +
            ' <span class="tiny muted">' + esc(I18N.t(perKey)) + "</span></strong>" +
          (me && me.id === a.lawyerId
            ? '<button class="btn btn--ghost btn--sm" type="button" data-end-deal="' +
              esc(a.internId) + '" data-i18n="pay.end"></button>'
            : "") +
        "</div></div></article>";
  }

  function agreementForm(u) {
    return '<div class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle" data-i18n="pay.newAgreement"></h3>' +
      '<div class="grid grid-3" style="gap:var(--s-4);margin-top:var(--s-5)">' +
        '<label class="field"><span class="label" data-i18n="pay.kind"></span>' +
          '<select class="select" data-deal-kind>' +
            [["cases", "pay.kindCases"], ["monthly", "pay.kindMonthly"], ["yearly", "pay.kindYearly"]]
              .map(function (k) {
                return '<option value="' + k[0] + '"' + (deal.kind === k[0] ? " selected" : "") + ">" +
                  esc(I18N.t(k[1])) + "</option>";
              }).join("") + "</select></label>" +
        '<label class="field"><span class="label" data-i18n="pay.amount"></span>' +
          '<input class="input num" type="number" min="0" dir="ltr" data-deal-amount value="' +
            esc(deal.amount) + '"></label>' +
        (deal.kind === "cases"
          ? '<label class="field"><span class="label" data-i18n="pay.cases"></span>' +
            '<input class="input num" type="number" min="1" dir="ltr" data-deal-cases value="' +
              esc(deal.cases) + '"></label>'
          : "<span></span>") +
      "</div>" +
      '<p class="form-error" data-deal-error hidden></p>' +
      '<button class="btn btn--primary" type="button" style="margin-top:var(--s-5)" ' +
        'data-make-deal data-i18n="pay.create"></button></div>';
  }

  function reviewsPanel(u) {
    var list = M.reviewsFor(u.id).slice().reverse();
    return C.ratingSummary(u.id) +
      (list.length
        ? '<div class="stack gap-4" style="margin-top:var(--s-6)">' +
          list.map(C.reviewCard).join("") + "</div>"
        : "");
  }

  function articlesPanel(u) {
    var list = M.articlesBy(u.id);
    if (!list.length) return '<p class="small muted" data-i18n="profile.noArticles"></p>';
    return '<div class="grid grid-2">' + list.map(C.articleCard).join("") + "</div>";
  }

  App.onRender(function () {
    var u = id ? M.user(id) : null;
    if (!u || u.roles.indexOf("intern") === -1) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("search", "profile.notFound") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="lawyers.html" data-i18n="profile.backToDir"></a></p></div>';
      I18N.apply(host);
      return;
    }

    // A tab can disappear when the viewer changes, so fall back to the first.
    var allowed = tabsFor(u).map(function (t) { return t[0]; });
    if (allowed.indexOf(tab) === -1) tab = allowed[0];

    var body = tab === "skills" ? skillsPanel(u)
             : tab === "cert" ? certPanel(u)
             : tab === "pay" ? payPanel(u)
             : tab === "reviews" ? reviewsPanel(u)
             : articlesPanel(u);

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20);max-width:940px">' +
      head(u) +
      '<div class="tabs" role="tablist">' + tabsFor(u).map(function (t) {
        return '<button class="tab' + (tab === t[0] ? " is-active" : "") + '" type="button" ' +
          'role="tab" data-tab="' + t[0] + '" data-i18n="' + t[1] + '"></button>';
      }).join("") + "</div>" +
      '<div style="margin-top:var(--s-6)">' + body + "</div></div>";

    I18N.apply(host);
    document.title = tx(u.name) + " | " + I18N.t("brand.name");
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-tab]");
    if (t) { tab = t.getAttribute("data-tab"); App.rerender(); return; }

    if (ev.target.closest("[data-make-deal]")) {
      var u2 = M.user(id);
      var amount = +($("[data-deal-amount]", host) || {}).value;
      var cases = +(($("[data-deal-cases]", host) || {}).value || 0);
      var err = $("[data-deal-error]", host);
      var fail = function (key) { if (err) { err.hidden = false; err.textContent = I18N.t(key); } };
      if (!amount || amount <= 0) { fail("pay.needAmount"); return; }
      if (deal.kind === "cases" && !cases) { fail("pay.needCases"); return; }
      if (err) err.hidden = true;
      Store.addAgreement({ lawyerId: Session.user().id, internId: u2.id,
                           kind: deal.kind, amount: amount, cases: cases });
      deal = { kind: "cases", amount: "", cases: "" };
      App.toast(I18N.t("pay.created", { name: tx(u2.name) }), "check");
      return;
    }

    var endDeal = ev.target.closest("[data-end-deal]");
    if (endDeal) {
      Store.endAgreement(Session.user().id, endDeal.getAttribute("data-end-deal"));
      App.toast(I18N.t("pay.ended"), "close");
      return;
    }

    if (ev.target.closest("[data-issue]")) {
      var u = M.user(id);
      Store.addEndorsement({
        internId: u.id, lawyerId: Session.user().id, hours: M.hoursOf(u.id),
        date: { ar: I18N.t("common.today"), en: I18N.t("common.today") },
        note: null
      });
      App.toast(I18N.t("cert.issuedToast"), "badge");
    }
  });

  host.addEventListener("change", function (ev) {
    var k = ev.target.closest("[data-deal-kind]");
    if (!k) return;
    // Keep what is already typed; only the "cases" field comes and goes.
    deal.kind = k.value;
    deal.amount = ($("[data-deal-amount]", host) || {}).value || "";
    App.rerender();
  });
});
