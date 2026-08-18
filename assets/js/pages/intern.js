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
  var TABS = [["skills", "profile.tabSkills"], ["cert", "profile.tabCert"],
              ["reviews", "profile.tabReviews"], ["articles", "profile.tabArticles"]];

  function head(u) {
    var rank = M.rankOf(u.id, "intern");
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

  function reviewsPanel(u) {
    var list = M.reviewsFor(u.id);
    if (!list.length) return '<p class="small muted" data-i18n="profile.noReviews"></p>';
    return '<div class="stack gap-4">' + list.map(function (r) {
      var author = M.user(r.authorId);
      return '<article class="testimony">' +
        '<div class="row between wrap gap-3">' +
          '<span class="row gap-3">' + C.avatar(author, "sm") +
            "<span><strong class=\"small\">" + esc(author ? tx(author.name) : "") + "</strong>" +
            '<p class="tiny muted">' + esc(tx(r.date)) + "</p></span></span>" + C.stars(r.rating) +
        "</div>" +
        '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(r.body)) + "</p></article>";
    }).join("") + "</div>";
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

    var body = tab === "skills" ? skillsPanel(u)
             : tab === "cert" ? certPanel(u)
             : tab === "reviews" ? reviewsPanel(u)
             : articlesPanel(u);

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20);max-width:940px">' +
      head(u) +
      '<div class="tabs" role="tablist">' + TABS.map(function (t) {
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
});
