/* ==========================================================================
   A lawyer's own page. Its own template, deliberately — a lawyer sells
   services and shows a licence; a trainee shows skills and hours. Forcing one
   layout to do both would have made each half of it apologise for the other.
   ========================================================================== */
Pages.define("lawyer", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-profile]");
  if (!host) return;

  var id = App.param("id");
  var tab = "services";

  function head(u) {
    var city = M.city(u.city);
    // Rank is a professional's business; a client sees the rating instead.
    var rank = Session.is("lawyer") ? M.rankOf(u.id, "lawyer") : { rank: null };
    return '<header class="card card--pad" style="margin-bottom:var(--s-8)">' +
      '<div class="row gap-6 wrap" style="align-items:flex-start">' +
        C.avatar(u, "lg") +
        '<div class="grow" style="min-width:0">' +
          '<h1 class="headline row gap-3 wrap">' + esc(tx(u.name)) + C.verifiedMark(u) + "</h1>" +
          '<p class="lead">' + esc(tx(u.title || {})) + "</p>" +
          '<div class="meta-row" style="margin-top:var(--s-4)">' +
            C.ratingLine(u.id) +
            '<span class="dot"></span><span class="muted">' +
              esc(I18N.t("lawyer.years", { n: I18N.num(u.years || 0) })) + "</span>" +
            (city ? '<span class="dot"></span><span class="muted row gap-1">' +
              Icons.svg("location", "icon-sm") + esc(tx(city)) + "</span>" : "") +
            (u.licence && u.licence.number
              ? '<span class="dot"></span><span class="muted row gap-1">' + Icons.svg("shield-check", "icon-sm") +
                esc(I18N.t("lawyer.license")) + ' <span class="num">' + esc(u.licence.number) + "</span></span>"
              : "") +
            (rank.rank ? '<span class="dot"></span><span class="muted">' + esc(I18N.t("profile.rank")) +
              ' <span class="num">' + I18N.num(rank.rank) + "/" + I18N.num(rank.of) + "</span></span>" : "") +
          "</div>" +
          '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
            (u.specialties || []).map(function (sid) {
              var s = M.specialty(sid);
              return s ? '<span class="tag">' + esc(tx(s)) + "</span>" : "";
            }).join("") + "</div>" +
        "</div>" +
      "</div></header>";
  }

  var TABS = [["services", "profile.tabServices"], ["experience", "profile.tabExperience"],
              ["reviews", "profile.tabReviews"], ["articles", "profile.tabArticles"]];

  function panel(u) {
    if (tab === "services") return servicesPanel(u);
    if (tab === "experience") return experiencePanel(u);
    if (tab === "reviews") return reviewsPanel(u);
    return articlesPanel(u);
  }

  function servicesPanel(u) {
    var list = M.servicesOf(u.id);
    if (!list.length) return '<p class="small muted" data-i18n="profile.noServices"></p>';
    return '<div class="req-list">' + list.map(function (s) {
      return '<div class="req-row">' +
        '<span class="req-row__icon">' + Icons.svg(M.serviceIcon(s), "icon-sm") + "</span>" +
        '<div class="grow"><strong class="small">' + esc(tx(M.serviceTitle(s))) + "</strong>" +
          '<p class="tiny muted">' + esc(tx(M.serviceMeta(s))) + "</p></div>" +
        '<div class="req-row__side"><strong class="small"><span class="num">' +
          I18N.num(s.price) + "</span> " + esc(I18N.t("common.sar")) + "</strong>" +
          '<button class="btn btn--primary btn--sm" type="button" data-order="' + esc(s.id) + '" ' +
            'data-i18n="profile.orderNow"></button></div></div>';
    }).join("") + "</div>";
  }

  function experiencePanel(u) {
    return (u.bio ? '<h2 class="subtitle" data-i18n="profile.bio"></h2>' +
        '<p class="lead" style="margin:var(--s-3) 0 var(--s-8)">' + esc(tx(u.bio)) + "</p>" : "") +
      (u.focus && u.focus.length
        ? '<h2 class="subtitle" data-i18n="profile.subSpecialties"></h2>' +
          '<ul class="bullets" style="margin:var(--s-3) 0 var(--s-8)">' +
            u.focus.map(function (f) { return "<li>" + esc(tx(f)) + "</li>"; }).join("") + "</ul>"
        : "") +
      (u.education && u.education.length
        ? '<h2 class="subtitle" data-i18n="profile.education"></h2>' +
          '<ul class="timeline" style="margin:var(--s-4) 0 var(--s-8)">' +
            u.education.map(function (e) {
              return "<li><strong class=\"small\">" + esc(tx(e.degree)) + "</strong>" +
                '<p class="tiny muted">' + esc(tx(e.place)) + "</p></li>";
            }).join("") + "</ul>"
        : "") +
      (u.career && u.career.length
        ? '<h2 class="subtitle" data-i18n="profile.career"></h2>' +
          '<ul class="timeline" style="margin-top:var(--s-4)">' +
            u.career.map(function (c) {
              return "<li><strong class=\"small\">" + esc(tx(c.role)) + "</strong>" +
                '<p class="tiny muted">' + esc(tx(c.period)) + "</p>" +
                '<p class="small">' + esc(tx(c.note)) + "</p></li>";
            }).join("") + "</ul>"
        : "");
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

  /** The rail: order a service without leaving the page. */
  function rail(u) {
    var list = M.servicesOf(u.id);
    return '<aside class="booking card card--pad">' +
      '<h2 class="subtitle" data-i18n="profile.book"></h2>' +
      '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="profile.bookHint"></p>' +
      (list.length
        ? '<div class="stack gap-2" style="margin-top:var(--s-5)">' + list.map(function (s) {
            return '<button type="button" class="doc-option" data-order="' + esc(s.id) + '">' +
              '<span class="row gap-3">' + Icons.svg(M.serviceIcon(s), "icon-sm") +
                "<span>" + esc(tx(M.serviceTitle(s))) + "</span></span>" +
              '<span class="doc-option__price"><span class="num">' + I18N.num(s.price) + "</span> " +
                esc(I18N.t("common.sar")) + "</span></button>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-4)" data-i18n="profile.noServices"></p>') +
      '<p class="disclaimer" style="margin-top:var(--s-5)">' + Icons.svg("lock", "icon-sm") +
        '<span data-i18n="profile.securePay"></span></p>' +
    "</aside>";
  }

  App.onRender(function () {
    var u = id ? M.user(id) : null;
    if (!u || u.roles.indexOf("lawyer") === -1) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("search", "profile.notFound") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="lawyers.html" data-i18n="profile.backToDir"></a></p></div>';
      I18N.apply(host);
      return;
    }

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20)">' +
      head(u) +
      '<div class="profile-layout">' +
        "<section>" +
          '<div class="tabs" role="tablist">' + TABS.map(function (t) {
            return '<button class="tab' + (tab === t[0] ? " is-active" : "") + '" type="button" ' +
              'role="tab" data-tab="' + t[0] + '" data-i18n="' + t[1] + '"></button>';
          }).join("") + "</div>" +
          '<div style="margin-top:var(--s-6)">' + panel(u) + "</div>" +
        "</section>" +
        rail(u) +
      "</div></div>";

    I18N.apply(host);
    document.title = tx(u.name) + " | " + I18N.t("brand.name");
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-tab]");
    if (t) { tab = t.getAttribute("data-tab"); App.rerender(); return; }

    var ord = ev.target.closest("[data-order]");
    if (!ord) return;
    if (Session.isGuest()) {
      App.toast(I18N.t("svc.orderSignIn"), "lock");
      setTimeout(function () { App.go("login.html"); }, 900);
      return;
    }
    var u = M.user(id);
    var svc = M.servicesOf(u.id).filter(function (s) { return s.id === ord.getAttribute("data-order"); })[0];
    if (!svc) return;
    var type = M.serviceType(svc.typeId) || {};
    // One at a time. The database refuses a second one anyway; this is so the
    // person is told why rather than shown an error about a row.
    var blocking = M.blockingRequest(Session.user().id);
    if (blocking) {
      App.toast(I18N.t("req.oneAtATimeBody"), "lock");
      App.go("requests.html");
      return;
    }
    Store.addRequest({
      clientId: Session.user().id, lawyerId: u.id, typeId: svc.typeId, price: svc.price,
      status: "new", ai: type.tier === "quick", hours: 3,
      title: M.serviceTitle(svc), brief: { ar: "", en: "" },
      ago: { ar: I18N.t("common.today"), en: I18N.t("common.today") }
    });
    App.toast(I18N.t("req.ordered", { name: tx(u.name) }), "check");
    setTimeout(function () { App.go("requests.html"); }, 1000);
  });
});
