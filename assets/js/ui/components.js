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
    delivered: "ok", completed: "muted", cancelled: "muted", refunded: "muted",
    pending: "warn", verified: "ok", rejected: "muted"
  };

  /* ---------- how a request is going ----------
     One track, and both parties see the same one. A client watching a request
     and a lawyer working it were reading two different vocabularies for the
     same thing; this is the shared answer to "where are we". */
  var TRACK = ["placed", "accepted", "working", "delivered", "settled"];

  var STAGE_OF = {
    new: "placed", quoting: "placed",
    assigned: "accepted", scheduled: "accepted",
    drafted: "working", with_intern: "working", open_to_interns: "working",
    in_progress: "working",
    delivered: "delivered", completed: "settled", cancelled: "cancelled",
    // Refunded work was delivered and then undone. It ends the track rather
    // than sitting in it.
    refunded: "settled"
  };

  /** Whose move it is. Saying this is most of what somebody wants from a
      progress bar — the bar itself only says how far along it is. */
  function waitingOn(stage, mine) {
    if (stage === "placed") return mine === "lawyer" ? "prog.you" : "prog.theLawyer";
    if (stage === "accepted" || stage === "working") {
      return mine === "lawyer" ? "prog.you" : "prog.theLawyer";
    }
    if (stage === "delivered") return mine === "client" ? "prog.you" : "prog.theClient";
    return null;
  }

  function progress(r, mine) {
    var st = M.requestState(r);
    var dis = M.disputeFor && M.disputeFor(r.id);
    var open = dis && dis.status === "open";
    var stage = STAGE_OF[st.status] || "placed";
    if (open) stage = "disputed";

    var at = TRACK.indexOf(stage);
    var waiting = open ? "prog.staff" : waitingOn(stage, mine);

    return '<div class="track' + (open ? " track--held" : "") + '">' +
      '<div class="row between wrap gap-3">' +
        '<strong class="small" data-i18n="prog.title"></strong>' +
        (waiting
          ? '<span class="tiny muted">' +
            esc(I18N.t("prog.waitingOn", { who: I18N.t(waiting) })) + "</span>"
          : "") +
      "</div>" +
      '<ol class="track__steps">' +
        TRACK.map(function (key, i) {
          var done = at > i, here = at === i;
          return '<li class="track__step' + (done ? " is-done" : "") + (here ? " is-here" : "") + '">' +
            '<span class="track__dot">' +
              (done ? Icons.svg("check", "icon-sm") : "") + "</span>" +
            '<span class="track__label">' + esc(I18N.t("prog." + key)) + "</span></li>";
        }).join("") +
      "</ol>" +
      (stage === "disputed"
        ? '<p class="small" style="margin-top:var(--s-3)">' +
          Icons.svg("clock", "icon-sm") + " " + esc(I18N.t("prog.disputed")) + "</p>"
        : "") +
      (stage === "cancelled"
        ? '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("prog.cancelled")) + "</p>"
        : "") +
    "</div>";
  }

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

  /* ---------- the conversation on a case ----------
     Two threads live on a request and this draws either of them. The audience
     is not decoration: `internal` is the lawyer and the trainee, and the
     client is not in it — enforced by a row policy, said out loud here so
     whoever is typing knows who will read it.

     Files are part of the conversation rather than a feature beside it. The
     bucket is private, so an attachment is drawn as a placeholder and its
     link filled in afterwards from a URL that expires. */
  function bytes(n) {
    if (!n) return "";
    if (n < 1024) return I18N.num(n) + " B";
    if (n < 1024 * 1024) return I18N.num(Math.round(n / 1024)) + " KB";
    return I18N.num(Math.round(n / 104857.6) / 10) + " MB";
  }

  function fileChip(a) {
    var image = /^image\//.test(a.mime || "");
    var sound = /^audio\//.test(a.mime || "");
    var pending = String(a.id || "").slice(0, 7) === "pending";
    // A voice note is played where it was sent, not downloaded and opened
    // somewhere else — which is the whole difference between a recording and
    // an attachment that happens to be audio.
    if (sound && !pending) {
      return '<span class="file-chip file-chip--sound" data-file="' + App.esc(a.id) + '">' +
        Icons.svg("mic", "icon-sm") +
        '<audio controls preload="none" data-file-audio="' + App.esc(a.id) + '"></audio>' +
        "</span>";
    }
    return '<span class="file-chip' + (pending ? " is-pending" : "") + '" data-file="' +
      App.esc(a.id) + '">' +
      Icons.svg(sound ? "mic" : image ? "image" : "file-text", "icon-sm") +
      '<span class="file-chip__name">' + App.esc(a.name) + "</span>" +
      '<span class="tiny faint">' + App.esc(pending ? I18N.t("thread.sending") : bytes(a.size)) +
        "</span>" +
      (image ? '<img class="file-chip__thumb" alt="" hidden data-file-img="' + App.esc(a.id) + '">' : "") +
      "</span>";
  }

  function bubble(m, meId) {
    var who = M.user(m.authorId);
    var mine = m.authorId === meId;
    var files = Store.attachmentsOn(m.id);
    return '<article class="bubble' + (mine ? " bubble--mine" : "") + '">' +
      '<div class="bubble__who">' +
        (mine ? "" : avatar(who, "sm")) +
        "<strong class=\"tiny\">" + App.esc(mine ? I18N.t("thread.you") : (who ? App.tx(who.name) : "")) +
          "</strong>" +
        '<span class="tiny faint">' + App.esc(I18N.date(m.at)) + "</span></div>" +
      (m.body ? '<p class="bubble__body">' + App.esc(m.body) + "</p>" : "") +
      (files.length ? '<div class="bubble__files">' + files.map(fileChip).join("") + "</div>" : "") +
    "</article>";
  }

  function thread(r, audience, opts) {
    var o = opts || {};
    var me = global.Session.user();
    var kind = audience || "parties";
    var log = Store.messages(r.id, kind);
    var closed = !!o.closed;

    return '<section class="thread" data-thread="' + App.esc(r.id) +
        '" data-audience="' + App.esc(kind) + '">' +
      '<div class="row between wrap gap-3">' +
        '<h3 class="subtitle">' + App.esc(I18N.t("thread.title")) + "</h3>" +
        (o.tabs || "") +
      "</div>" +
      (kind === "internal"
        ? '<p class="tiny faint row gap-2" style="margin-top:var(--s-2)">' +
          Icons.svg("lock", "icon-sm") + App.esc(I18N.t("thread.internalNote")) + "</p>"
        : "") +
      '<div class="thread__log">' +
        (log.length
          ? log.map(function (m) { return bubble(m, me ? me.id : null); }).join("")
          : '<p class="small muted center">' + App.esc(I18N.t("thread.empty")) + "</p>") +
      "</div>" +
      (closed
        ? '<p class="tiny muted" style="margin-top:var(--s-3)">' +
          App.esc(I18N.t("thread.closed")) + "</p>"
        : '<div class="thread__pending" data-thread-pending hidden></div>' +
          '<form class="thread__compose" data-thread-form>' +
            '<label class="icon-btn" title="' + App.esc(I18N.t("thread.attach")) + '">' +
              Icons.svg("upload", "icon-sm") +
              '<input type="file" multiple hidden data-thread-file></label>' +
            '<button class="icon-btn" type="button" data-thread-record ' +
              'title="' + App.esc(I18N.t("thread.record")) + '">' +
              Icons.svg("mic", "icon-sm") + "</button>" +
            '<input class="input" data-thread-body placeholder="' +
              App.esc(I18N.t("thread.placeholder")) + '">' +
            '<button class="btn btn--primary btn--sm" type="submit">' +
              App.esc(I18N.t("thread.send")) + "</button>" +
          "</form>") +
    "</section>";
  }

  /** Fill in the links for whatever the last draw put on screen. The bucket
      is private, so every one of these is a URL that expires — which is also
      why they cannot simply be rendered as hrefs in the first place. */
  function linkFiles(root) {
    var all = (Store.attachments && Store.attachments()) || [];
    App.$$("[data-file]", root || document).forEach(function (node) {
      var id = node.getAttribute("data-file");
      if (node.getAttribute("data-linked") === id) return;
      var att = null;
      all.forEach(function (a) { if (a.id === id) att = a; });
      if (!att) return;
      node.setAttribute("data-linked", id);
      Store.fileUrl(att).then(function (url) {
        if (!url) return;
        var img = node.querySelector("[data-file-img]");
        if (img) { img.src = url; img.hidden = false; }
        var sound = node.querySelector("[data-file-audio]");
        if (sound) { sound.src = url; return; }   // played here, not opened away
        node.setAttribute("data-href", url);
        node.setAttribute("tabindex", "0");
        node.title = I18N.t("thread.openFile");
      });
    });
  }

  /* ---------- making the thread work ----------
     Two pages carry one: the request list and the call. Rather than two
     copies of the same handlers — which is how the two drift apart — the
     wiring lives here and each page says where its own thread is.

     Files chosen do not send themselves. They wait for the message, so a line
     of text and three attachments arrive as one thing rather than four. */
  var MAX_FILE = 25 * 1024 * 1024;
  var pending = {};                 // files queued, keyed by thread and audience
  var watching = null;              // the thread currently being asked again

  function threadEl(host) { return App.$("[data-thread]", host); }
  function threadKey(host) {
    var el = threadEl(host);
    return el ? el.getAttribute("data-thread") + ":" + el.getAttribute("data-audience") : "";
  }

  function drawPending(host) {
    var box = App.$("[data-thread-pending]", host);
    if (!box) return;
    var list = pending[threadKey(host)] || [];
    box.hidden = !list.length;
    box.innerHTML = list.map(function (f, i) {
      return '<span class="file-chip">' + Icons.svg("file-text", "icon-sm") +
        '<span class="file-chip__name">' + App.esc(f.name) + "</span>" +
        '<span class="tiny faint">' + App.esc(bytes(f.size)) + "</span>" +
        '<button class="icon-btn" type="button" data-drop-file="' + i + '">' +
          Icons.svg("close", "icon-sm") + "</button></span>";
    }).join("");
  }

  /** A thread is two people waiting on each other, so it is asked again while
      it is open — and only while it is open. */
  function watchThread(host) {
    var el = threadEl(host);
    var id = el ? el.getAttribute("data-thread") : null;
    if (watching && watching.id === id) return;
    if (watching) { clearInterval(watching.timer); watching = null; }
    if (!id || !Store.refreshThread) return;
    watching = { id: id, timer: setInterval(function () {
      if (!threadEl(host)) { clearInterval(watching.timer); watching = null; return; }
      Store.refreshThread(id);
    }, 6000) };
  }

  /** Called after every draw: private files get their links, queued files get
      their chips, and the open thread gets watched. */
  function threadDraw(host) {
    linkFiles(host);
    drawPending(host);
    watchThread(host);
  }

  function wireThread(host) {
    if (!host || host.getAttribute("data-thread-wired")) return;
    host.setAttribute("data-thread-wired", "1");

    host.addEventListener("change", function (ev) {
      if (!ev.target.matches("[data-thread-file]")) return;
      var key = threadKey(host);
      pending[key] = pending[key] || [];
      Array.prototype.forEach.call(ev.target.files, function (f) {
        if (f.size > MAX_FILE) { App.toast(I18N.t("thread.tooBig"), "alert"); return; }
        pending[key].push(f);
      });
      ev.target.value = "";
      drawPending(host);
    });

    host.addEventListener("click", function (ev) {
      var rec = ev.target.closest("[data-thread-record]");
      if (rec) { toggleRecording(host, rec); return; }

      var drop = ev.target.closest("[data-drop-file]");
      if (drop) {
        (pending[threadKey(host)] || []).splice(+drop.getAttribute("data-drop-file"), 1);
        drawPending(host);
        return;
      }
      // A file in a private bucket is opened through the link signed for it,
      // which is put on the chip once it comes back.
      var chip = ev.target.closest("[data-href]");
      if (chip) global.open(chip.getAttribute("data-href"), "_blank", "noopener");
    });

    host.addEventListener("submit", function (ev) {
      if (!ev.target.matches("[data-thread-form]")) return;
      ev.preventDefault();
      var el = threadEl(host);
      if (!el) return;
      var requestId = el.getAttribute("data-thread");
      var audience = el.getAttribute("data-audience");
      var key = threadKey(host);
      var files = pending[key] || [];
      var box = App.$("[data-thread-body]", host);
      var body = box ? box.value.trim() : "";
      if (!body && !files.length) return;

      var me = global.Session.user();
      Store.sendMessage({
        requestId: requestId, audience: audience, authorId: me.id, body: body,
      }, function (saved) {
        files.forEach(function (f) {
          Store.attachFile({
            requestId: requestId, messageId: saved.id, audience: audience,
            authorId: me.id, name: f.name, size: f.size,
            mime: f.type || "application/octet-stream", file: f,
          });
        });
      });

      // Tell the other side, so a message does not wait on somebody happening
      // to open the page.
      var r = M.request(requestId);
      if (r) {
        var st = M.requestState(r);
        var to = audience === "internal"
          ? (me.id === r.lawyerId ? st.assignedTo : r.lawyerId)
          : (me.id === r.clientId ? (st.assignedTo || r.lawyerId) : r.clientId);
        if (to && to !== me.id) Store.notify({ to: to, type: "message", ref: requestId });
      }

      pending[key] = [];
      if (box) box.value = "";
      App.rerender();
    });
  }

  /* ---------- a voice note ----------
     Said rather than typed, which for a legal question is often the only way
     somebody will actually say it. It joins the queue like any other file, so
     one message can carry a recording, a photo and a sentence.

     Nothing is uploaded until the message is sent, and nothing is recorded
     without the browser's own permission prompt. */
  var recorder = null;
  function toggleRecording(host, button) {
    if (recorder) return stopRecording(host, button);
    if (!global.navigator || !global.navigator.mediaDevices || !global.MediaRecorder) {
      App.toast(I18N.t("thread.noMic"), "alert");
      return;
    }
    global.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var mr = new global.MediaRecorder(stream);
      recorder = { mr: mr, stream: stream, chunks: chunks, at: Date.now() };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new global.Blob(chunks, { type: mr.mimeType || "audio/webm" });
        var seconds = Math.max(1, Math.round((Date.now() - recorder.at) / 1000));
        recorder = null;
        button.classList.remove("is-recording");
        if (blob.size < 200) return;                  // a slip of the finger
        var name = I18N.t("thread.voiceName", { n: I18N.num(seconds) }) + ".webm";
        var file = new global.File([blob], name, { type: blob.type });
        var key = threadKey(host);
        pending[key] = pending[key] || [];
        pending[key].push(file);
        drawPending(host);
      };
      mr.start();
      button.classList.add("is-recording");
      App.toast(I18N.t("thread.recording"), "mic");
    }).catch(function () { App.toast(I18N.t("thread.noMic"), "alert"); });
  }
  function stopRecording(host, button) {
    if (!recorder) return;
    try { recorder.mr.stop(); }
    catch (e) { recorder = null; button.classList.remove("is-recording"); }
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
    statusPill: statusPill, progress: progress,
    requestRow: requestRow, empty: empty, sectionHead: sectionHead,
    thread: thread, bubble: bubble, fileChip: fileChip, linkFiles: linkFiles,
    bytes: bytes, wireThread: wireThread, threadDraw: threadDraw,
    googleButton: googleButton
  };
})(window);
