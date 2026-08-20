/* ==========================================================================
   Home — one address, three landings.

   A client (and a guest) gets a deliberately short front page: what the
   platform is, three ways in, a few lawyers, a couple of articles.
   A lawyer and a trainee get a working dashboard instead, because for them
   this is where the day starts, not a brochure.
   ========================================================================== */
Pages.define("home", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-home]");
  if (!host) return;

  /* ---------- shared pieces ---------- */
  function stat(iconName, labelKey, value, rule) {
    return '<div class="card stat' + (rule ? " card--rule-" + rule : "") + '">' +
      '<div class="stat__top"><span class="small muted" data-i18n="' + labelKey + '"></span>' +
        '<span class="stat__icon">' + Icons.svg(iconName, "icon-sm") + "</span></div>" +
      '<span class="stat__value num">' + value + "</span></div>";
  }

  function sideLink(href, iconName, labelKey) {
    return '<a class="account-link" href="' + href + '">' +
      '<span class="stat__icon">' + Icons.svg(iconName, "icon-sm") + "</span>" +
      '<span class="grow" data-i18n="' + labelKey + '"></span>' +
      '<span class="account-link__go">' + Icons.svg("arrow", "icon-sm") + "</span></a>";
  }

  function pendingNotice() {
    return '<div class="card card--pad card--rule-gold" style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="dash.pendingTitle"></h2>' +
      '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="dash.pendingBody"></p></div>';
  }

  function greeting(leadKey) {
    var u = Session.user();
    return '<header style="margin-bottom:var(--s-8)">' +
      '<h1 class="headline" data-i18n="dash.hello" data-i18n-vars=\'' +
        JSON.stringify({ name: tx(u.name).split(" ").slice(0, 2).join(" ") }).replace(/'/g, "&#39;") +
      '\'></h1>' +
      '<p class="lead" data-i18n="' + leadKey + '"></p></header>';
  }

  function rankCard(role) {
    var u = Session.user();
    var r = M.rankOf(u.id, role);
    var s = M.scoreOf(u);
    return '<div class="card card--pad">' +
      '<h2 class="subtitle" data-i18n="dash.myRank"></h2>' +
      '<p class="display" style="margin:var(--s-3) 0">' +
        (r.rank
          ? '<span class="num">' + I18N.num(r.rank) + "</span>" +
            '<span class="lead" style="font-size:1rem"> ' + esc(I18N.t("dash.of")) + " " +
            '<span class="num">' + I18N.num(r.of) + "</span></span>"
          : "—") + "</p>" +
      C.progressBar(s.total) +
      '<p class="tiny muted" style="margin-top:var(--s-3)" data-i18n="dash.rankHint"></p></div>';
  }

  /* ---------- client / guest ---------- */
  function paths() {
    var items = [
      { href: "lawyers.html",  icon: "scale", t: "home.pathBrowse", b: "home.pathBrowseBody" },
      { href: "services.html", icon: "tag",   t: "home.pathOrder",  b: "home.pathOrderBody" },
      { href: "quotes.html",   icon: "gavel", t: "home.pathQuote",  b: "home.pathQuoteBody" }
    ];
    return '<div class="grid grid-3">' + items.map(function (it) {
      return '<a class="card card--hover feature" href="' + it.href + '">' +
        '<span class="feature__icon">' + Icons.svg(it.icon, "icon-lg") + "</span>" +
        '<h3 class="subtitle" data-i18n="' + it.t + '"></h3>' +
        '<p class="small muted" data-i18n="' + it.b + '"></p></a>';
    }).join("") + "</div>";
  }

  function clientHome() {
    var top = M.leaderboard("lawyer").slice(0, 3).map(function (row) { return row.user; });
    var posts = M.articles().slice(0, 2);

    return (
      '<section class="hero"><div class="container hero__inner">' +
        '<span class="eyebrow" data-i18n="home.eyebrow"></span>' +
        '<h1 class="display" data-i18n="home.heroTitle"></h1>' +
        '<p class="lead" data-i18n="home.heroLead"></p>' +
        '<form class="searchbar" data-home-search>' +
          '<input class="input" name="q" data-i18n-attr="placeholder:home.searchPlaceholder">' +
          '<select class="select" name="specialty" data-any-specialty></select>' +
          '<select class="select" name="city" data-any-city></select>' +
          '<button class="btn btn--primary" type="submit" data-i18n="home.search"></button>' +
        "</form>" +
        '<div class="trustbar">' +
          ["shield-check:home.trust1", "lock:home.trust2", "verified:home.trust3"].map(function (p) {
            var bits = p.split(":");
            return "<span>" + Icons.svg(bits[0], "icon-sm") + '<span data-i18n="' + bits[1] + '"></span></span>';
          }).join("") +
        "</div>" +
      "</div></section>" +

      '<section class="section section--tight"><div class="container reveal">' +
        C.sectionHead("home.pathsTitle", "home.pathsLead") + paths() +
      "</div></section>" +

      '<section class="section section--band"><div class="container reveal">' +
        '<div class="row between wrap gap-4" style="margin-bottom:var(--s-8)">' +
          '<div><h2 class="headline" data-i18n="home.featuredTitle"></h2>' +
            '<p class="lead" data-i18n="home.featuredLead"></p></div>' +
          '<a class="btn btn--outline" href="lawyers.html" data-i18n="home.viewAll"></a></div>' +
        '<div class="grid grid-3">' + top.map(C.lawyerCard).join("") + "</div>" +
      "</div></section>" +

      '<section class="section section--tight"><div class="container reveal">' +
        '<div class="row between wrap gap-4" style="margin-bottom:var(--s-8)">' +
          '<div><h2 class="headline" data-i18n="home.blogTitle"></h2>' +
            '<p class="lead" data-i18n="home.blogLead"></p></div>' +
          '<a class="btn btn--outline" href="blog.html" data-i18n="home.viewAll"></a></div>' +
        '<div class="grid grid-2">' + posts.map(C.articleCard).join("") + "</div>" +
      "</div></section>" +

      '<section class="section section--tight"><div class="container reveal">' +
        '<div class="cta-band">' +
          '<h2 class="headline" data-i18n="home.ctaTitle"></h2>' +
          '<p class="lead" data-i18n="home.ctaLead"></p>' +
          '<div class="row center gap-3 wrap" style="margin-top:var(--s-8)">' +
            '<a class="btn btn--accent btn--lg" href="lawyers.html" data-i18n="home.ctaPrimary"></a>' +
            '<a class="btn btn--ghost btn--lg" href="signup.html" data-i18n="home.ctaSecondary"></a>' +
          "</div></div>" +
      "</div></section>"
    );
  }

  /* ---------- lawyer ---------- */
  function lawyerHome() {
    var u = Session.user();
    var mine = M.requestsForLawyer(u.id);
    var live = mine.filter(function (r) {
      var st = M.requestState(r).status;
      return st !== "completed" && st !== "cancelled";
    });
    var needsMe = live.filter(function (r) {
      var st = M.requestState(r);
      return !st.assignedTo && (st.status === "new" || st.status === "drafted" || st.status === "assigned");
    });
    var revenue = mine.reduce(function (t, r) { return t + (r.price || 0); }, 0);
    var rating = M.ratingOf(u.id);
    // What has gone out to trainees is part of reading the month honestly.
    var toInterns = mine.reduce(function (t, r) {
      var pay = M.taskPay(r);
      return t + (pay && pay.kind === "share" ? pay.amount : 0);
    }, 0);

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      greeting("dash.lawyerLead") +
      (Session.isVerified() ? "" : pendingNotice()) +
      '<div class="grid grid-5">' +
        stat("inbox", "dash.awaitingYou", I18N.num(needsMe.length), "gold") +
        stat("file-text", "dash.activeRequests", I18N.num(live.length)) +
        stat("wallet", "dash.revenue", I18N.num(revenue)) +
        stat("graduation", "pay.paidOut", I18N.num(toInterns)) +
        stat("star", "dash.overallRating", rating.avg.toFixed(1)) +
      "</div>" +

      '<div class="grid dash-split" style="margin-top:var(--s-10)">' +
        '<section class="card card--pad">' +
          '<div class="row between gap-3" style="margin-bottom:var(--s-5)">' +
            '<h2 class="subtitle" data-i18n="dash.latestWork"></h2>' +
            '<a class="btn btn--outline btn--sm" href="requests.html" data-i18n="dash.openInbox"></a></div>' +
          (live.length
            ? '<div class="req-list">' + live.slice(0, 4).map(function (r) {
                return C.requestRow(r, { showClient: true });
              }).join("") + "</div>"
            : '<p class="small muted" data-i18n="dash.nothingYet"></p>') +
        "</section>" +

        '<aside class="stack gap-4">' +
          rankCard("lawyer") +
          '<div class="card card--pad">' +
            '<h2 class="subtitle" style="margin-bottom:var(--s-4)" data-i18n="dash.quickActions"></h2>' +
            '<div class="stack gap-2">' +
              sideLink("assistant.html", "sparkle", "dash.aiAssist") +
              sideLink("services.html", "tag", "dash.manageServices") +
              sideLink("editor.html", "edit", "dash.writeArticle") +
              sideLink("lawyer.html?id=" + encodeURIComponent(u.id), "user", "dash.completeProfile") +
            "</div></div>" +
        "</aside>" +
      "</div></div>";
  }

  /* ---------- trainee ---------- */
  function internHome() {
    var u = Session.user();
    var mine = M.requestsForIntern(u.id);
    var done = mine.filter(function (r) {
      var st = M.requestState(r).status;
      return st === "delivered" || st === "completed";
    });
    var prog = M.certProgress(u.id);

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      greeting("dash.internLead") +
      (Session.isVerified() ? "" : pendingNotice()) +
      '<div class="grid grid-4">' +
        stat("inbox", "dash.assignedCount", I18N.num(mine.length), "gold") +
        stat("check", "dash.doneCount", I18N.num(done.length)) +
        stat("clock", "dash.hoursLogged", I18N.num(prog.hours)) +
        stat("wallet", "pay.earned", I18N.num(M.earnedBy(u.id))) +
      "</div>" +

      '<div class="grid dash-split" style="margin-top:var(--s-10)">' +
        '<section class="card card--pad">' +
          '<div class="row between gap-3" style="margin-bottom:var(--s-5)">' +
            '<h2 class="subtitle" data-i18n="tasks.assignedToMe"></h2>' +
            '<a class="btn btn--outline btn--sm" href="requests.html" data-i18n="dash.openInbox"></a></div>' +
          (mine.length
            ? '<div class="req-list">' + mine.slice(0, 4).map(function (r) {
                return C.requestRow(r, { showClient: true });
              }).join("") + "</div>"
            : '<p class="small muted" data-i18n="dash.nothingYet"></p>') +
        "</section>" +

        '<aside class="stack gap-4">' +
          '<div class="card card--pad">' +
            '<h2 class="subtitle" data-i18n="cert.title"></h2>' +
            '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)" data-i18n="cert.progress"></p>' +
            C.progressBar(prog.pct) +
            '<p class="tiny muted" style="margin-top:var(--s-3)">' +
              esc(I18N.t(prog.eligible ? "cert.eligible" : "cert.remaining",
                         { n: I18N.num(Math.max(0, prog.needed - prog.hours)) })) + "</p></div>" +
          rankCard("intern") +
          '<div class="card card--pad">' +
            '<h2 class="subtitle" style="margin-bottom:var(--s-4)" data-i18n="dash.quickActions"></h2>' +
            '<div class="stack gap-2">' +
              sideLink("services.html", "graduation", "dash.mySkills") +
              sideLink("editor.html", "edit", "dash.writeArticle") +
              sideLink("intern.html?id=" + encodeURIComponent(u.id), "user", "dash.completeProfile") +
            "</div></div>" +
        "</aside>" +
      "</div></div>";
  }

  /* ---------- draw ---------- */
  /** Announcements the platform wants on the home page rather than in a bar.
      An image if there is one, markup of its own if the platform wrote some,
      and otherwise a clean card — three ways to say something, one shape. */
  function feature() {
    var list = (M.announcementsFor(Session.role()) || []).filter(function (a) {
      return a.placement === "home";
    });
    if (!list.length) return "";
    return '<section class="container" style="padding-block:var(--s-8) 0">' +
      list.map(function (a) {
        // Markup written by staff, through a table only staff can write to.
        // Nothing a visitor types reaches this.
        if (a.html) return '<div class="promo promo--raw">' + a.html + "</div>";
        return '<article class="promo' + (a.imageUrl ? " promo--image" : "") + '"' +
          (a.imageUrl ? ' style="background-image:url(' + esc(a.imageUrl) + ')"' : "") + ">" +
          '<div class="promo__body">' +
            '<h2 class="title">' + esc(a.title) + "</h2>" +
            (a.body ? '<p class="lead">' + esc(a.body) + "</p>" : "") +
            (a.link ? '<a class="btn btn--accent" href="' + esc(a.link) + '" rel="noopener">' +
              esc(I18N.t("notice.open")) + "</a>" : "") +
          "</div></article>";
      }).join("") +
    "</section>";
  }

  App.onRender(function () {
    var role = Session.role();
    host.innerHTML = feature() + (role === "lawyer" ? lawyerHome()
                   : role === "intern" ? internHome()
                   : clientHome());

    fillAny("[data-any-specialty]", global.SEED.specialties, "dir.anySpecialty");
    fillAny("[data-any-city]", global.SEED.cities, "dir.anyCity");
    I18N.apply(host);
    App.observeReveals(host);
  });

  function fillAny(sel, list, anyKey) {
    var el = $(sel, host);
    if (!el) return;
    el.innerHTML = '<option value="">' + esc(I18N.t(anyKey)) + "</option>" +
      list.map(function (o) {
        return '<option value="' + esc(o.id) + '">' + esc(tx(o)) + "</option>";
      }).join("");
  }

  /* The front-page search is just a shortcut into the directory's own filters. */
  host.addEventListener("submit", function (ev) {
    var form = ev.target.closest("[data-home-search]");
    if (!form) return;
    ev.preventDefault();
    var q = new URLSearchParams();
    ["q", "specialty", "city"].forEach(function (n) {
      var v = form.querySelector('[name="' + n + '"]').value;
      if (v) q.set(n, v);
    });
    App.go("lawyers.html" + (q.toString() ? "?" + q : ""));
  });
});
