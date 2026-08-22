/* ==========================================================================
   Blog — the reading list. Everyone reads; only lawyers and trainees write.
   A trainee's article is held until a lawyer signs it, and the queue of
   unsigned pieces appears here for lawyers, not on a separate page.
   ========================================================================== */
Pages.define("blog", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-blog]");
  if (!host) return;

  var state = { q: "", cat: "" };

  function list() {
    var text = state.q.trim().toLowerCase();
    return M.articles().filter(function (a) {
      if (state.cat && a.cat !== state.cat) return false;
      if (!text) return true;
      return (tx(a.title) + " " + tx(a.excerpt)).toLowerCase().indexOf(text) !== -1;
    });
  }

  function cats() {
    return '<div class="row gap-2 wrap">' +
      '<button type="button" class="chip' + (state.cat ? "" : " is-active") + '" data-cat="" ' +
        'data-i18n="blog.all"></button>' +
      global.SEED.specialties.map(function (s) {
        return '<button type="button" class="chip' + (state.cat === s.id ? " is-active" : "") +
          '" data-cat="' + esc(s.id) + '">' + esc(tx(s)) + "</button>";
      }).join("") + "</div>";
  }

  /** Only lawyers see this, and only when something is actually waiting. */
  function signQueue() {
    if (!Session.is("lawyer")) return "";
    var pending = M.pendingArticles();
    if (!pending.length) return "";
    return '<section class="card card--pad card--rule-gold" style="margin-bottom:var(--s-8)">' +
      '<h2 class="subtitle" data-i18n="blog.pendingTitle"></h2>' +
      '<div class="req-list" style="margin-top:var(--s-4)">' + pending.map(function (a) {
        var author = M.user(a.authorId);
        return '<div class="req-row">' +
          '<span class="req-row__icon">' + Icons.svg("file-text", "icon-sm") + "</span>" +
          '<div class="grow" style="min-width:0"><strong class="small">' + esc(tx(a.title)) + "</strong>" +
            '<p class="tiny muted">' + esc(author ? tx(author.name) : "") + "</p></div>" +
          '<div class="req-row__side"><div class="row gap-2">' +
            '<a class="btn btn--ghost btn--sm" href="article.html?id=' + esc(a.id) + '" ' +
              'data-i18n="blog.readMore"></a>' +
            '<button class="btn btn--accent btn--sm" type="button" data-sign="' + esc(a.id) + '" ' +
              'data-i18n="blog.sign"></button></div></div></div>';
      }).join("") + "</div></section>";
  }

  App.onRender(function () {
    var rows = list();
    var canWrite = Session.is("lawyer") || Session.is("intern");

    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header class="row between wrap gap-4" style="margin-bottom:var(--s-8)">' +
        '<div><h1 class="headline" data-i18n="blog.heading"></h1>' +
          '<p class="lead" data-i18n="blog.lead"></p></div>' +
        (canWrite ? '<a class="btn btn--primary" href="editor.html">' + Icons.svg("edit", "icon-sm") +
          '<span data-i18n="blog.write"></span></a>' : "") +
      "</header>" +

      signQueue() +

      '<div class="results-bar">' +
        '<label class="field" style="min-width:260px"><span class="label" data-i18n="blog.search"></span>' +
          '<input class="input" data-q value="' + esc(state.q) + '" ' +
            'data-i18n-attr="placeholder:blog.searchPlaceholder"></label>' +
        cats() +
      "</div>" +

      (rows.length
        ? '<div class="grid grid-3" style="margin-top:var(--s-8)">' + rows.map(C.articleCard).join("") + "</div>"
        : C.empty("search", "blog.noResults")) +
    "</div>";

    I18N.apply(host);
    App.observeReveals(host);
  });

  host.addEventListener("click", function (ev) {
    var c = ev.target.closest("[data-cat]");
    if (c) { state.cat = c.getAttribute("data-cat"); App.rerender(); return; }

    var sg = ev.target.closest("[data-sign]");
    if (sg) {
      Store.setArticle(sg.getAttribute("data-sign"),
        { status: "published", signedBy: Session.user().id });
      App.toast(I18N.t("blog.signed"), "check");
    }
  });

  host.addEventListener("input", function (ev) {
    var f = ev.target.closest("[data-q]");
    if (!f) return;
    state.q = f.value;
    clearTimeout(f._t);
    f._t = setTimeout(function () {
      App.rerender();
      var again = $("[data-q]", host);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }, 250);
  });
});
