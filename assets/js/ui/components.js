/* ==========================================================================
   Components — the pieces more than one page draws.
   Each takes entities from Models and returns markup; none of them fetch or
   mutate, so a page can compose them freely.
   ========================================================================== */
(function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models, App = global.App;
  var esc = App.esc, tx = App.tx;

  function sar() { return esc(I18N.t("common.sar")); }
  function num(n) { return '<span class="num">' + I18N.num(n) + "</span>"; }

  /* ---------- people ---------- */
  function avatar(u, size) {
    var cls = "avatar avatar--" + (size || "md");
    if (u && u.avatar) {
      return '<img class="' + cls + '" src="' + esc(u.avatar) + '" alt="" loading="lazy">';
    }
    return '<img class="' + cls + '" src="' + App.avatarOf(u ? u.name : "", u ? u.id : "") +
      '" alt="" loading="lazy">';
  }

  /** A name that always links to that person's own page. */
  function personLink(u, extraClass) {
    if (!u) return "";
    return '<a class="person-link' + (extraClass ? " " + extraClass : "") +
      '" href="' + M.profileHref(u) + '">' + esc(tx(u.name)) + "</a>";
  }

  function stars(value) {
    var out = "";
    for (var i = 0; i < 5; i++) {
      out += '<span style="color:' + (i < Math.round(value) ? "var(--accent)" : "var(--border-strong)") +
        '">' + Icons.svg("star", "icon-sm") + "</span>";
    }
    return '<span class="row gap-1">' + out + "</span>";
  }

  function ratingLine(userId) {
    var r = M.ratingOf(userId);
    return '<span class="rating">' + Icons.svg("star", "icon-sm") +
      num(r.avg.toFixed(1)) + '<span class="muted tiny">' +
      esc(I18N.t("lawyer.reviews", { n: I18N.num(r.count) })) + "</span></span>";
  }

  function verifiedMark(u) {
    return u.status === "verified"
      ? '<span class="verified" data-i18n-attr="title:auth.verified">' + Icons.svg("verified", "icon-sm") + "</span>"
      : '<span class="status status--warn tiny" data-i18n="auth.pending"></span>';
  }

  /* ---------- lawyer / trainee cards ---------- */
  function lawyerCard(u) {
    var city = M.city(u.city);
    var svcs = M.servicesOf(u.id);
    var from = svcs.length ? Math.min.apply(null, svcs.map(function (s) { return s.price; })) : null;
    return '<article class="card card--hover person-card card--rule-navy">' +
      '<a class="person-card__body" href="' + M.profileHref(u) + '">' +
        '<div class="row gap-4" style="align-items:flex-start">' +
          avatar(u, "md") +
          '<div class="grow" style="min-width:0">' +
            '<h3 class="subtitle row gap-2 wrap">' + esc(tx(u.name)) + verifiedMark(u) + "</h3>" +
            '<p class="small muted">' + esc(tx(u.title || {})) + "</p>" +
            '<div class="meta-row" style="margin-top:var(--s-2)">' + ratingLine(u.id) +
              '<span class="dot"></span><span class="muted">' +
              esc(I18N.t("lawyer.years", { n: I18N.num(u.years || 0) })) + "</span>" +
              (city ? '<span class="dot"></span><span class="muted">' + esc(tx(city)) + "</span>" : "") +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
          (u.specialties || []).slice(0, 3).map(function (id) {
            var s = M.specialty(id);
            return s ? '<span class="tag">' + esc(tx(s)) + "</span>" : "";
          }).join("") +
        "</div>" +
      "</a>" +
      '<div class="person-card__foot row between gap-3">' +
        (from !== null
          ? '<span class="small muted">' + esc(I18N.t("req.startingFrom")) + " <strong>" + num(from) + " " + sar() + "</strong></span>"
          : '<span class="small muted"></span>') +
        '<a class="btn btn--primary btn--sm" href="' + M.profileHref(u) + '" data-i18n="dir.viewProfile"></a>' +
      "</div></article>";
  }

  function internCard(u) {
    var prog = M.certProgress(u.id);
    return '<article class="card card--hover person-card card--rule-gold">' +
      '<a class="person-card__body" href="' + M.profileHref(u) + '">' +
        '<div class="row gap-4" style="align-items:flex-start">' +
          avatar(u, "md") +
          '<div class="grow" style="min-width:0">' +
            '<h3 class="subtitle row gap-2 wrap">' + esc(tx(u.name)) +
              (M.endorsementsFor(u.id).length
                ? '<span class="verified" data-i18n-attr="title:cert.holder">' + Icons.svg("badge", "icon-sm") + "</span>"
                : "") + "</h3>" +
            '<p class="small muted">' + esc(tx(u.university || {})) + "</p>" +
            '<div class="meta-row" style="margin-top:var(--s-2)">' + ratingLine(u.id) +
              '<span class="dot"></span><span class="muted">' +
              esc(I18N.t("cert.hoursShort", { n: I18N.num(prog.hours) })) + "</span></div>" +
          "</div>" +
        "</div>" +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
          (u.skills || []).slice(0, 3).map(function (s) {
            return '<span class="tag">' + esc(tx(s)) + "</span>";
          }).join("") +
        "</div>" +
      "</a>" +
      '<div class="person-card__foot">' + progressBar(prog.pct) + "</div></article>";
  }

  function progressBar(pct) {
    return '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
      '<span style="width:' + pct + '%"></span></div>';
  }

  /* ---------- articles ---------- */
  function articleCard(a) {
    var author = M.user(a.authorId);
    var cat = M.specialty(a.cat);
    var likes = M.likesOf(a.id);
    var comments = M.commentsOn(a.id).length;
    return '<article class="card card--hover article-card">' +
      '<a class="article-card__media" href="article.html?id=' + esc(a.id) + '">' +
        '<img src="' + App.asset(a.cover) + '" alt="" loading="lazy" width="800" height="450">' +
        (cat ? '<span class="article-card__cat">' + esc(tx(cat)) + "</span>" : "") +
      "</a>" +
      '<div class="article-card__body">' +
        '<div class="meta-row"><span>' + esc(tx(a.date)) + "</span><span class=\"dot\"></span>" +
          '<span class="row gap-1">' + Icons.svg("clock", "icon-sm") +
          esc(I18N.t("blog.readTime", { n: I18N.num(a.read) })) + "</span></div>" +
        '<h3 class="subtitle"><a href="article.html?id=' + esc(a.id) + '">' + esc(tx(a.title)) + "</a></h3>" +
        '<p class="small muted">' + esc(tx(a.excerpt)) + "</p>" +
      "</div>" +
      '<div class="article-card__foot">' +
        '<span class="row gap-2 small">' + avatar(author, "sm") + personLink(author) + "</span>" +
        '<span class="row gap-3 small muted">' +
          '<span class="row gap-1">' + Icons.svg("heart", "icon-sm") + num(likes.count) + "</span>" +
          '<span class="row gap-1">' + Icons.svg("comment", "icon-sm") + num(comments) + "</span>" +
        "</span>" +
      "</div></article>";
  }

  /* ---------- requests ---------- */
  var STATUS_STYLE = {
    new: "warn", quoting: "info", assigned: "info", scheduled: "info",
    drafted: "ok", open_to_interns: "warn", with_intern: "info", in_progress: "warn",
    delivered: "ok", completed: "muted", cancelled: "muted"
  };

  function statusPill(status) {
    return '<span class="status status--' + (STATUS_STYLE[status] || "muted") + '">' +
      esc(I18N.t("status." + status)) + "</span>";
  }

  function requestRow(r, opts) {
    opts = opts || {};
    var st = M.requestState(r);
    var type = M.serviceType(r.typeId);
    var other = M.user(opts.showClient ? r.clientId : r.lawyerId);
    // A caller may show a different status than the one stored — the client's
    // view deliberately hides how the work is being produced.
    var shown = opts.status || st.status;
    return '<div class="req-row">' +
      '<span class="req-row__icon">' + Icons.svg(type ? type.icon : "file-text", "icon-sm") + "</span>" +
      '<div class="grow" style="min-width:0">' +
        '<div class="row gap-2 wrap"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
          (type ? '<span class="tag">' + esc(tx(type.title)) + "</span>" : "") + "</div>" +
        '<p class="tiny muted">' + (other ? esc(tx(other.name)) + ' <span class="dot"></span> ' : "") +
          esc(tx(r.ago)) + "</p>" +
        (r.brief ? '<p class="tiny faint">' + esc(tx(r.brief)) + "</p>" : "") +
      "</div>" +
      '<div class="req-row__side">' + statusPill(shown) +
        '<strong class="tiny">' + num(r.price) + " " + sar() + "</strong>" +
        (opts.actions ? '<div class="req-row__actions">' + opts.actions(r, st) + "</div>" : "") +
      "</div></div>";
  }

  /* ---------- misc ---------- */
  function empty(iconName, textKey) {
    return '<div class="card empty">' + Icons.svg(iconName, "icon-xl") +
      '<p class="subtitle">' + esc(I18N.t(textKey)) + "</p></div>";
  }

  function sectionHead(titleKey, leadKey) {
    return '<div class="section-head"><h2 class="headline" data-i18n="' + titleKey + '"></h2>' +
      (leadKey ? '<p class="lead" data-i18n="' + leadKey + '"></p>' : "") + "</div>";
  }

  global.C = {
    sar: sar, num: num, avatar: avatar, personLink: personLink, stars: stars,
    ratingLine: ratingLine, verifiedMark: verifiedMark, progressBar: progressBar,
    lawyerCard: lawyerCard, internCard: internCard, articleCard: articleCard,
    statusPill: statusPill, requestRow: requestRow, empty: empty, sectionHead: sectionHead
  };
})(window);
