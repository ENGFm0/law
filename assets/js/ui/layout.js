/* ==========================================================================
   Shared chrome — brand, header, bottom tab bar, footer.

   The navigation is five fixed slots whose meaning changes with the signed-in
   role. That is the whole architecture in one function: navItems().
   A guest gets the public shape of the same five.
   ========================================================================== */
(function (global) {
  "use strict";

  var Icons = global.Icons, I18N = global.I18N, Session = global.Session;

  var MARK =
    '<svg class="brand__mark" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="currentColor" stroke-width="4"/>' +
      '<path d="M32 14v34M16 22h32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M16 22l-7 13h14z" fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M48 22l-7 13h14z" fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M24 50h16" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="32" cy="14" r="3.6" fill="var(--accent)"/>' +
    '</svg>';

  function brand(href) {
    return '<a class="brand" href="' + (href || "index.html") + '" style="color:var(--brand-navy)">' +
      MARK +
      '<span class="brand__text" style="color:var(--text)">' +
        '<span data-i18n="brand.name">سند</span>' +
        '<span class="brand__sep" aria-hidden="true"></span>' +
        '<span class="brand__latin">SANAD</span>' +
      "</span></a>";
  }

  /* ---------- the five slots ----------
     Slot 1 and 3-5 are the same destination for everyone; only what the page
     shows differs by role. Slot 2 is requests, which a guest does not have. */
  function navItems() {
    var role = Session.role();

    var home     = { key: "nav.home",     tab: "tab.home",     href: "index.html",   id: "home",     icon: "home" };
    var requests = { key: "nav.requests", tab: "tab.requests", href: "requests.html",id: "requests", icon: "inbox" };
    var services = { key: "nav.services", tab: "tab.services", href: "services.html",id: "services", icon: "tag" };
    var blog     = { key: "nav.blog",     tab: "tab.blog",     href: "blog.html",    id: "blog",     icon: "file-text" };
    var people   = { key: "nav.lawyers",  tab: "tab.lawyers",  href: "lawyers.html", id: "lawyers",  icon: "scale" };
    var drafting = { key: "nav.assistant",tab: "tab.assistant",href: "assistant.html",id: "assistant",icon: "sparkle" };

    if (role === "intern") {
      // A trainee sells no services; the slot carries their skills instead.
      services = { key: "nav.skills", tab: "tab.skills", href: "services.html", id: "services", icon: "graduation" };
    }
    if (role === "guest") {
      return [home, people, services, blog];
    }
    // Staff have one job on this site and the navigation says so: the desk,
    // and the public pages they moderate. No inbox, no services to sell.
    if (role === "staff") {
      return [{ key: "nav.admin", tab: "tab.admin", href: "admin.html", id: "admin", icon: "shield-check" },
              people, blog, home];
    }
    // The drafting workspace is a lawyer's daily tool, so it earns a slot of
    // its own rather than hiding behind a link on the dashboard.
    if (role === "lawyer") {
      return [home, requests, drafting, services, blog, people];
    }
    return [home, requests, services, blog, people];
  }

  function themeButton() {
    return '<button class="icon-btn" type="button" data-action="toggle-theme" ' +
      'data-i18n-attr="aria-label:a11y.theme">' +
      Icons.svg("moon", "icon-moon") + Icons.svg("sun", "icon-sun") + "</button>";
  }

  function langButton() {
    return '<button class="icon-btn icon-btn--wide" type="button" data-action="toggle-lang" ' +
      'data-i18n-attr="aria-label:a11y.lang">' +
      Icons.svg("globe", "icon-sm") + '<span class="lang-btn__code" data-lang-code>EN</span></button>';
  }

  /** Signed in: who you are and a way to your account. Guest: a way in. */
  function identity() {
    var u = Session.user();
    if (!u) {
      return '<a class="btn btn--ghost btn--sm" href="login.html" data-i18n="auth.signIn"></a>' +
             '<a class="btn btn--primary btn--sm" href="signup.html" data-i18n="auth.createAccount"></a>';
    }
    var role = Session.info();
    var pending = !Session.isVerified();
    return '<a class="role-badge" href="account.html" data-role-badge>' +
      '<span class="role-badge__mark">' +
        (u.avatar ? '<img src="' + u.avatar + '" alt="" width="30" height="30">'
                  : Icons.svg(role ? role.icon : "user", "icon-sm")) + "</span>" +
      '<span class="role-badge__text">' +
        "<strong>" + global.App.esc(global.App.tx(u.name).split(" ")[0]) + "</strong>" +
        '<span data-i18n="' + (role ? role.nameKey : "role.client") + '"></span></span>' +
      (pending ? '<span class="role-badge__dot" data-i18n-attr="title:auth.pending"></span>' : "") +
      "</a>";
  }

  function header(active) {
    var links = navItems().map(function (item) {
      return '<a class="nav__link' + (item.id === active ? " is-active" : "") + '" href="' + item.href +
        '" data-i18n="' + item.key + '"' + (item.id === active ? ' aria-current="page"' : "") + "></a>";
    }).join("");

    return '<header class="site-header"><div class="container site-header__inner">' +
      brand() +
      '<nav class="nav" data-i18n-attr="aria-label:a11y.menu">' + links + "</nav>" +
      '<div class="header-actions">' + themeButton() + langButton() + identity() + "</div>" +
      "</div></header>";
  }

  /** Phones navigate from the bottom; the account tab closes the set. */
  function tabbar(active) {
    // Six targets is what fits legibly at 390px, so the phone bar takes the
    // first five and always ends with the account. Anything cut here is still
    // in the header on wider screens and in the footer everywhere.
    var items = navItems().slice(0, 5);
    items.push(Session.isGuest()
      ? { key: "auth.signIn", tab: "auth.signIn", href: "login.html", id: "login", icon: "user" }
      : { key: "account.heading", tab: "tab.account", href: "account.html", id: "account", icon: "user" });

    return '<nav class="tabbar" data-tabbar data-i18n-attr="aria-label:a11y.menu">' +
      items.map(function (item) {
        var on = item.id === active;
        return '<a class="tabbar__link' + (on ? " is-active" : "") + '" href="' + item.href + '"' +
          (on ? ' aria-current="page"' : "") + ">" + Icons.svg(item.icon || "grid") +
          '<span data-i18n="' + (item.tab || item.key) + '"></span></a>';
      }).join("") + "</nav>";
  }

  function footer() {
    function col(titleKey, items) {
      return '<div><h3 class="footer-title" data-i18n="' + titleKey + '"></h3>' +
        items.map(function (it) {
          return '<a class="footer-link" href="' + it.href + '" data-i18n="' + it.key + '"></a>';
        }).join("") + "</div>";
    }
    return '<footer class="site-footer"><div class="container">' +
      '<div class="site-footer__grid">' +
        '<div style="max-width:340px">' + brand() +
          '<p class="lead small" style="margin-top:var(--s-4)" data-i18n="footer.about"></p>' +
        "</div>" +
        col("footer.platform", [
          { href: "lawyers.html",  key: "nav.lawyers" },
          { href: "services.html", key: "nav.services" },
          { href: "quotes.html",   key: "nav.quotes" },
          { href: "blog.html",     key: "nav.blog" }
        ]) +
        col("footer.legal", [
          { href: "about.html",      key: "nav.about" },
          { href: "about.html#faq",  key: "footer.faq" },
          { href: "about.html#faq",  key: "footer.privacy" },
          { href: "about.html#faq",  key: "footer.terms" }
        ]) +
        col("footer.contact", [
          { href: "signup.html",        key: "auth.createAccount" },
          { href: "login.html",         key: "auth.signIn" },
          { href: "about.html#contact", key: "about.contactTitle" }
        ]) +
      "</div>" +
      '<div class="site-footer__bottom">' +
        '<span data-i18n="footer.rights"></span>' +
        '<span class="row gap-2">' + Icons.svg("shield-check", "icon-sm") +
          '<span data-i18n="footer.madeIn"></span></span>' +
      "</div></div></footer>";
  }

  function mount() {
    var page = document.documentElement.getAttribute("data-page") || "";
    var filled = false;
    var h = document.querySelector("[data-slot=header]");
    if (h) { h.outerHTML = header(page) + tabbar(page); filled = true; }
    var f = document.querySelector("[data-slot=footer]");
    if (f) { f.outerHTML = footer(); filled = true; }
    if (filled && I18N) I18N.apply(document);
    return filled;
  }

  /** Rebuild in place — the nav changes when the role or the session does. */
  function refresh() {
    var page = document.documentElement.getAttribute("data-page") || "";
    var oldHeader = document.querySelector(".site-header");
    var oldTab = document.querySelector("[data-tabbar]");
    if (!oldHeader) return;
    var holder = document.createElement("div");
    holder.innerHTML = header(page) + tabbar(page);
    var newHeader = holder.firstChild, newTab = holder.lastChild;
    oldHeader.replaceWith(newHeader);
    if (oldTab) oldTab.replaceWith(newTab); else document.body.appendChild(newTab);
    if (I18N) { I18N.apply(newHeader); I18N.apply(newTab); }
  }

  global.Layout = { mount: mount, refresh: refresh, header: header, tabbar: tabbar,
                    footer: footer, brand: brand, navItems: navItems };

  mount();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); });
  }
})(window);
