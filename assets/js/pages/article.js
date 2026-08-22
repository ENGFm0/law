/* ==========================================================================
   One article. The author's name is a link everywhere it appears — that was
   the point of the whole blog: read something, then reach the person who
   wrote it. Comments carry real names for the same reason.
   ========================================================================== */
Pages.define("article", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-article]");
  if (!host) return;

  var id = App.param("id");

  function paragraphs(body) {
    return String(tx(body) || "").split(/\n\s*\n/).map(function (p) {
      return "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function authorCard(u) {
    if (!u) return "";
    var isLawyer = u.roles.indexOf("lawyer") !== -1;
    return '<aside class="card card--pad" style="margin-top:var(--s-10)">' +
      '<div class="row gap-4 wrap" style="align-items:flex-start">' +
        C.avatar(u, "md") +
        '<div class="grow" style="min-width:0">' +
          '<span class="tiny muted" data-i18n="blog.by"></span>' +
          "<h3 class=\"subtitle\">" + C.personLink(u) + "</h3>" +
          '<p class="small muted">' + esc(tx(isLawyer ? (u.title || {}) : (u.university || {}))) + "</p>" +
          '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(u.bio || {})) + "</p>" +
        "</div>" +
        '<a class="btn btn--outline btn--sm" href="' + M.profileHref(u) + '" ' +
          'data-i18n="art.talkToAuthor"></a>' +
      "</div></aside>";
  }

  function comments(a) {
    var list = M.commentsOn(a.id);
    return '<section style="margin-top:var(--s-10)">' +
      '<h2 class="title">' + esc(I18N.t("art.comments")) +
        ' <span class="num muted">(' + I18N.num(list.length) + ")</span></h2>" +
      (list.length
        ? '<div class="stack gap-4" style="margin-top:var(--s-5)">' + list.map(function (c) {
            var who = M.user(c.authorId);
            return '<article class="testimony">' +
              '<div class="row gap-3">' + C.avatar(who, "sm") +
                "<span>" + (who && (who.roles.indexOf("lawyer") !== -1 || who.roles.indexOf("intern") !== -1)
                  ? C.personLink(who)
                  : "<strong class=\"small\">" + esc(who ? tx(who.name) : "") + "</strong>") + "</span></div>" +
              '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(c.body)) + "</p></article>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-4)" data-i18n="art.noComments"></p>') +

      (Session.isGuest()
        ? '<p class="note-inline" style="margin-top:var(--s-6)">' +
            '<span data-i18n="art.signInToComment"></span> ' +
            '<a href="login.html" style="color:var(--accent);font-weight:700" data-i18n="auth.signIn"></a></p>'
        : '<div style="margin-top:var(--s-6)">' +
            '<textarea class="textarea" data-comment ' +
              'data-i18n-attr="placeholder:art.commentPlaceholder"></textarea>' +
            '<button class="btn btn--primary btn--sm" type="button" style="margin-top:var(--s-3)" ' +
              'data-comment-send data-i18n="art.send"></button></div>') +
    "</section>";
  }

  App.onRender(function () {
    var a = id ? M.article(id) : null;
    if (!a) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("search", "art.notFound") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="blog.html" data-i18n="art.back"></a></p></div>';
      I18N.apply(host);
      return;
    }

    var author = M.user(a.authorId);
    var cat = M.specialty(a.cat);
    var likes = M.likesOf(a.id);
    var status = Store.articleState(a.id).status || a.status || "published";
    var more = M.articlesBy(a.authorId).filter(function (x) { return x.id !== a.id; }).slice(0, 3);

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20);max-width:800px">' +
      '<a class="breadcrumb" href="blog.html">' + Icons.svg("arrow-back", "icon-sm") +
        '<span data-i18n="art.back"></span></a>' +

      '<header style="margin:var(--s-6) 0 var(--s-8)">' +
        (cat ? '<span class="eyebrow">' + esc(tx(cat)) + "</span>" : "") +
        '<h1 class="display" style="font-size:clamp(1.75rem,1.2rem+2vw,2.5rem)">' +
          esc(tx(a.title)) + "</h1>" +
        (status === "pending"
          ? '<p class="note-inline" style="margin-top:var(--s-4)" data-i18n="blog.pending"></p>' : "") +
        '<div class="row gap-3 wrap" style="margin-top:var(--s-5);align-items:center">' +
          C.avatar(author, "sm") + C.personLink(author) +
          '<span class="dot"></span><span class="small muted">' + esc(tx(a.date)) + "</span>" +
          '<span class="dot"></span><span class="small muted row gap-1">' + Icons.svg("clock", "icon-sm") +
            esc(I18N.t("blog.readTime", { n: I18N.num(a.read) })) + "</span>" +
        "</div>" +
      "</header>" +

      '<img class="card" src="' + App.asset(a.cover) + '" alt="" width="800" height="450" ' +
        'style="width:100%;height:auto;margin-bottom:var(--s-8)">' +

      '<div class="article-body">' + paragraphs(a.body) + "</div>" +

      '<div class="row gap-3 wrap" style="margin-top:var(--s-8);padding-top:var(--s-6);' +
        'border-top:1px solid var(--border)">' +
        '<button class="btn ' + (likes.mine ? "btn--accent" : "btn--outline") + ' btn--sm" type="button" ' +
          'data-like>' + Icons.svg("heart", "icon-sm") +
          "<span>" + esc(I18N.t(likes.mine ? "art.liked" : "art.like")) + "</span>" +
          ' <span class="num">' + I18N.num(likes.count) + "</span></button>" +
      "</div>" +

      authorCard(author) +
      comments(a) +

      (more.length
        ? '<section style="margin-top:var(--s-12)">' +
            '<h2 class="title">' + esc(I18N.t("art.moreBy", { name: tx(author.name) })) + "</h2>" +
            '<div class="grid grid-3" style="margin-top:var(--s-5)">' + more.map(C.articleCard).join("") +
          "</div></section>"
        : "") +
    "</div>";

    I18N.apply(host);
    document.title = tx(a.title) + " | " + I18N.t("brand.name");
  });

  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-like]")) {
      var st = Store.articleState(id);
      Store.setArticle(id, { liked: !st.liked });
      return;
    }
    if (ev.target.closest("[data-comment-send]")) {
      var box = $("[data-comment]", host);
      var text = box ? box.value.trim() : "";
      if (!text) return;
      Store.addComment({
        articleId: id, authorId: Session.user().id,
        body: { ar: text, en: text }
      });
      App.toast(I18N.t("art.commentSent"), "check");
    }
  });
});
