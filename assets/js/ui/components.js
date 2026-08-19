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

  function stars(value, size) {
    var full = Math.round(value);
    var out = "";
    for (var i = 0; i < 5; i++) {
      var on = i < full;
      out += '<span style="color:' + (on ? "var(--accent)" : "var(--border-strong)") + '">' +
        Icons.svg("star", (size || "icon-sm") + (on ? " icon--solid" : "")) + "</span>";
    }
    return '<span class="row gap-1">' + out + "</span>";
  }

  /** A star row you can actually use: hover previews the whole scale up to the
      star under the pointer, keyboard reaches it, and the number is spelled out
      in words so 4 versus 5 is not a guess.

      The stars are emitted 5→1 and the row is reversed. CSS has no
      previous-sibling combinator, so that is what lets `:hover ~ *` light every
      star BELOW the one hovered — and reversing the row rather than the reading
      direction keeps star 1 at the start in Arabic and English alike. */
  function starPicker(picked, forId) {
    var out = "";
    for (var i = 5; i >= 1; i--) {
      out += '<button type="button" class="star-pick' + (i <= picked ? " is-on" : "") +
        '" data-star="' + i + '" data-for="' + esc(forId) + '" ' +
        'aria-label="' + esc(I18N.t("rate.starsN", { n: I18N.num(i) })) + '"' +
        (i === picked ? ' aria-pressed="true"' : "") + ">" +
        Icons.svg("star", i <= picked ? "icon--solid" : "") + "</button>";
    }
    return '<div class="stars-pick" role="group" ' +
      'aria-label="' + esc(I18N.t("rate.pick")) + '">' +
      '<div class="stars-pick__row">' + out + "</div>" +
      '<span class="stars-pick__word' + (picked ? " is-set" : "") + '">' +
        esc(picked ? I18N.t("rate.v" + picked) : I18N.t("rate.pick")) + "</span></div>";
  }

  /** The average, and — more usefully — how the ratings actually fall. */
  function ratingSummary(userId) {
    var r = M.ratingOf(userId);
    if (!r.count) return '<p class="small muted">' + esc(I18N.t("rate.noneYet")) + "</p>";

    var spread = M.ratingSpread(userId);
    var rows = "";
    for (var star = 5; star >= 1; star--) {
      var n = spread[star] || 0;
      var pct = r.count ? Math.round(n / r.count * 100) : 0;
      rows += '<div class="rating-bar">' +
        '<span class="rating-bar__label"><span class="num">' + I18N.num(star) + "</span>" +
          Icons.svg("star", "icon-sm") + "</span>" +
        '<span class="rating-bar__track"><span style="width:' + pct + '%"></span></span>' +
        '<span class="rating-bar__n num">' + I18N.num(n) + "</span></div>";
    }

    return '<div class="rating-summary">' +
      '<div class="rating-summary__score">' +
        '<span class="display num">' + I18N.num(r.avg.toFixed(1)) + "</span>" +
        '<span class="tiny muted">' + esc(I18N.t("rate.outOf", { n: I18N.num(5) })) + "</span>" +
        stars(r.avg, "icon-lg") +
        '<span class="tiny muted" style="margin-top:var(--s-2)">' +
          esc(I18N.t("rate.count", { n: I18N.num(r.count) })) + "</span>" +
      "</div>" +
      '<div class="rating-summary__spread">' +
        '<p class="tiny muted" style="margin-bottom:var(--s-2)">' +
          esc(I18N.t("rate.spread")) + "</p>" + rows +
      "</div></div>";
  }

  /** One written review, with the stars it carried. */
  function reviewCard(rev) {
    var author = M.user(rev.authorId);
    return '<article class="testimony">' +
      '<div class="row between wrap gap-3">' +
        '<span class="row gap-3">' + avatar(author, "sm") +
          "<span><strong class=\"small\">" + esc(author ? tx(author.name) : "") + "</strong>" +
          '<p class="tiny muted">' + esc(tx(rev.date)) + "</p></span></span>" +
        '<span class="row gap-2">' + stars(rev.rating) +
          '<strong class="small num">' + I18N.num(rev.rating) + "</strong></span>" +
      "</div>" +
      (tx(rev.body)
        ? '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(rev.body)) + "</p>"
        : "") + "</article>";
  }

  function ratingLine(userId) {
    var r = M.ratingOf(userId);
    return '<span class="rating">' + Icons.svg("star", "icon-sm icon--solid") +
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

  /* ---------- signing in with Google ----------
     Shown always, so the page does not change shape between the demo and the
     connected project. On the demo it says why it cannot work yet rather than
     failing silently when pressed. */
  function googleButton() {
    var live = global.SB && global.SB.configured();
    var mark =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" style="stroke:none">' +
        '<path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/>' +
        '<path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/>' +
        '<path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.8L6.4 14z"/>' +
        '<path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.6 9.4 5.9 12 5.9z"/>' +
      "</svg>";
    return '<button class="btn btn--outline btn--block" type="button" data-google' +
      (live ? "" : " disabled") + ">" + mark +
      '<span data-i18n="auth.google"></span></button>' +
      (live ? "" : '<p class="tiny faint center" style="margin-top:var(--s-2)" ' +
        'data-i18n="auth.googleOnly"></p>') +
      '<div class="or-rule"><span data-i18n="auth.or"></span></div>';
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
    starPicker: starPicker, ratingSummary: ratingSummary, reviewCard: reviewCard,
    lawyerCard: lawyerCard, internCard: internCard, articleCard: articleCard,
    statusPill: statusPill, requestRow: requestRow, empty: empty, sectionHead: sectionHead,
    googleButton: googleButton
  };
})(window);
