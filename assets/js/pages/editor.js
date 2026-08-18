/* ==========================================================================
   The editor. A lawyer publishes straight away; a trainee's piece is held as
   "pending" until a lawyer signs it in the blog's queue — the signature is
   the professional guarantee behind anything published here.
   ========================================================================== */
Pages.define("editor", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-editor]");
  if (!host) return;

  var draft = { title: "", cat: "labour", excerpt: "", body: "" };

  // The artwork is local SVG, so a new article borrows the closest existing
  // cover rather than shipping without one.
  var COVERS = {
    family: "cover-family.svg", commercial: "cover-corporate.svg",
    realestate: "cover-realestate.svg", labour: "cover-labour.svg",
    ip: "cover-ip.svg"
  };

  function error(key) {
    var el = $("[data-ed-error]", host);
    if (!el) return;
    el.hidden = !key;
    if (key) el.textContent = I18N.t(key);
  }

  function mine() {
    var me = Session.user();
    var list = M.articlesBy(me.id);
    if (!list.length) return "";
    return '<section style="margin-top:var(--s-10)">' +
      '<h2 class="subtitle" data-i18n="ed.mine"></h2>' +
      '<div class="req-list" style="margin-top:var(--s-4)">' + list.map(function (a) {
        var status = Store.articleState(a.id).status || a.status || "published";
        return '<div class="req-row">' +
          '<span class="req-row__icon">' + Icons.svg("file-text", "icon-sm") + "</span>" +
          '<div class="grow" style="min-width:0">' +
            '<a class="small" href="article.html?id=' + esc(a.id) + '"><strong>' +
              esc(tx(a.title)) + "</strong></a>" +
            '<p class="tiny muted">' + esc(tx(a.date || {})) + "</p></div>" +
          '<div class="req-row__side"><span class="status status--' +
            (status === "published" ? "ok" : "warn") + '" data-i18n="' +
            (status === "published" ? "dash.published" : "blog.pending") + '"></span></div></div>';
      }).join("") + "</div></section>";
  }

  App.onRender(function () {
    if (!Session.is("lawyer") && !Session.is("intern")) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("lock", "ed.onlyPros") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="blog.html" data-i18n="art.back"></a></p></div>';
      I18N.apply(host);
      return;
    }

    var isLawyer = Session.is("lawyer");
    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:820px">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="ed.heading"></h1>' +
        '<p class="lead" data-i18n="' + (isLawyer ? "ed.leadLawyer" : "ed.leadIntern") + '"></p></header>' +

      '<div class="card card--pad stack gap-4">' +
        '<label class="field"><span class="label" data-i18n="ed.title"></span>' +
          '<input class="input" data-ed="title" value="' + esc(draft.title) + '"></label>' +
        '<label class="field"><span class="label" data-i18n="ed.cat"></span>' +
          '<select class="select" data-ed="cat">' + global.SEED.specialties.map(function (s) {
            return '<option value="' + esc(s.id) + '"' + (draft.cat === s.id ? " selected" : "") + ">" +
              esc(tx(s)) + "</option>";
          }).join("") + "</select></label>" +
        '<label class="field"><span class="label" data-i18n="ed.excerpt"></span>' +
          '<textarea class="textarea" data-ed="excerpt" rows="2">' + esc(draft.excerpt) + "</textarea></label>" +
        '<label class="field"><span class="label" data-i18n="ed.body"></span>' +
          '<textarea class="draft-text" data-ed="body">' + esc(draft.body) + "</textarea></label>" +
        '<p class="form-error" data-ed-error hidden></p>' +
        '<div class="row gap-3">' +
          '<button class="btn btn--primary" type="button" data-ed-save data-i18n="' +
            (isLawyer ? "ed.publish" : "ed.submit") + '"></button></div>' +
      "</div>" +

      mine() +
    "</div>";

    I18N.apply(host);
  });

  host.addEventListener("input", function (ev) {
    var f = ev.target.closest("[data-ed]");
    if (f) draft[f.getAttribute("data-ed")] = f.value;
  });
  host.addEventListener("change", function (ev) {
    var f = ev.target.closest("[data-ed]");
    if (f) draft[f.getAttribute("data-ed")] = f.value;
  });

  host.addEventListener("click", function (ev) {
    if (!ev.target.closest("[data-ed-save]")) return;
    if (!draft.title.trim()) { error("ed.needTitle"); return; }
    if (draft.body.trim().length < 40) { error("ed.needBody"); return; }
    error(null);

    var isLawyer = Session.is("lawyer");
    var excerpt = draft.excerpt.trim() || draft.body.trim().slice(0, 140) + "…";
    Store.addArticle({
      authorId: Session.user().id,
      cat: draft.cat,
      cover: COVERS[draft.cat] || "cover-contracts.svg",
      read: Math.max(1, Math.round(draft.body.split(/\s+/).length / 200)),
      status: isLawyer ? "published" : "pending",
      likes: 0,
      date: { ar: I18N.t("common.today"), en: I18N.t("common.today") },
      title: { ar: draft.title, en: draft.title },
      excerpt: { ar: excerpt, en: excerpt },
      body: { ar: draft.body, en: draft.body }
    });
    draft = { title: "", cat: draft.cat, excerpt: "", body: "" };
    App.toast(I18N.t(isLawyer ? "ed.published" : "ed.sent"), "check");
  });
});
