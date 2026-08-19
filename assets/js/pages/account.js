/* ==========================================================================
   Account — who you are, and the way out.

   The role switcher that used to live here was a demo affordance: it invited
   you to add a role and "try its interface", which on a real platform means
   tapping a card to become a lawyer. Roles are decided at sign-up and changed
   by staff; nothing on this page grants one.
   ========================================================================== */
Pages.define("account", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-account]");
  if (!host) return;

  function demo() { return !(global.SB && global.SB.configured()); }

  function guest() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("user", "account.guest") +
      '<div class="row center gap-3" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="login.html" data-i18n="auth.signIn"></a>' +
        '<a class="btn btn--outline" href="signup.html" data-i18n="auth.createAccount"></a></div></div>';
  }

  /* Switching between capacities the account ALREADY holds. This is not the
     role picker that used to live here: there is no card that adds one, and
     nothing on this page can. A staff member who is also a client should be
     able to look at the site the way a client sees it without signing out. */
  function viewAs() {
    var mine = Session.myRoles();
    if (mine.length < 2) return "";
    var active = Session.role();
    return '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="account.viewAs"></h2>' +
      '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="account.viewAsHint"></p>' +
      '<div class="row gap-3 wrap" style="margin-top:var(--s-5)">' +
        mine.map(function (id) {
          var def = Session.roleDef(id);
          return '<button type="button" class="btn btn--sm ' +
            (active === id ? "btn--primary" : "btn--outline") + '" data-view-as="' + id + '">' +
            Icons.svg(def.icon, "icon-sm") + esc(I18N.t(def.nameKey)) + "</button>";
        }).join("") +
      "</div></section>";
  }

  function details(u) {
    function row(labelKey, value) {
      return "<div><span class=\"tiny muted\">" + esc(I18N.t(labelKey)) + "</span>" +
        '<p class="small"><strong>' + esc(value || "—") + "</strong></p></div>";
    }
    return '<section class="card card--pad">' +
      '<h2 class="subtitle" data-i18n="account.details"></h2>' +
      '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-5)">' +
        row("auth.fullName", tx(u.name)) +
        row("auth.email", u.email) +
        row("account.phone", u.phone) +
        row("account.city", u.city ? tx(M.city(u.city) || {}) : "") +
      "</div></section>";
  }

  App.onRender(function () {
    if (Session.isGuest()) { host.innerHTML = guest(); I18N.apply(host); return; }

    var u = Session.user();
    var pro = Session.is("lawyer") || Session.is("intern");

    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:900px">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="account.heading"></h1>' +
        '<p class="lead" data-i18n="account.lead"></p></header>' +

      '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
        '<div class="row gap-5 wrap">' + C.avatar(u, "lg") +
          '<div class="grow" style="min-width:0">' +
            '<span class="tiny muted" data-i18n="account.signedInAs"></span>' +
            '<h2 class="title">' + esc(tx(u.name)) + "</h2>" +
            '<p class="small muted num" dir="ltr">' + esc(u.email) + "</p>" +
            (Session.isVerified() ? "" :
              '<p class="note-inline" style="margin-top:var(--s-3)" data-i18n="signup.pendingNote"></p>') +
          "</div>" +
          '<div class="stack gap-2">' +
            (pro ? '<a class="btn btn--outline btn--sm" href="' + M.profileHref(u) + '" ' +
              'data-i18n="account.viewProfile"></a>' : "") +
            '<button class="btn btn--ghost btn--sm" type="button" data-signout>' +
              Icons.svg("logout", "icon-sm") + '<span data-i18n="dash.logout"></span></button>' +
          "</div>" +
        "</div></section>" +

      viewAs() +

      details(u) +

      // Wiping the visit is a thing you do to a demo. On a real database it
      // would be either meaningless or alarming, so it is not offered there.
      (demo()
        ? '<section class="card card--pad" style="margin-top:var(--s-6)">' +
            '<h2 class="subtitle" data-i18n="account.reset"></h2>' +
            '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)" data-i18n="account.resetHint"></p>' +
            '<button class="btn btn--outline btn--sm" type="button" data-reset>' +
              Icons.svg("trash", "icon-sm") + '<span data-i18n="account.reset"></span></button></section>'
        : "") +
    "</div>";

    I18N.apply(host);
  });

  host.addEventListener("click", function (ev) {
    var v = ev.target.closest("[data-view-as]");
    if (v) {
      var id = v.getAttribute("data-view-as");
      // switchRole refuses anything the account does not hold, so this cannot
      // become a way to acquire one.
      if (Session.switchRole(id)) {
        App.toast(I18N.t("role.changed", { role: I18N.t(Session.roleDef(id).nameKey) }), "check");
      }
      return;
    }

    if (ev.target.closest("[data-signout]")) {
      Session.signOut().then(function () { App.go("index.html"); });
      return;
    }

    if (ev.target.closest("[data-reset]")) {
      Store.resetWork();
      App.toast(I18N.t("account.resetDone"), "trash");
    }
  });
});
