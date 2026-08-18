/* ==========================================================================
   Shared chrome — icon set, brand mark, header, bottom tab bar, footer.
   Injected by script rather than copy-pasted into eight HTML files, so the
   nav only ever has to be corrected in one place.
   ========================================================================== */
(function (global) {
  "use strict";

  /* ---------- Icons (inline SVG: no icon font to fail to load) ---------- */
  var PATHS = {
    search:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    scale:     '<path d="M12 3v18M7 21h10M3 8l4-3 4 3M3 8l2 5h4l-2-5M13 8l4-3 4 3M13 8l2 5h4l-2-5"/>',
    location:  '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone:     '<path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/>',
    chat:      '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    video:     '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3v9l-6-3z"/>',
    "file-text":'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    "shield-check":'<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    payments:  '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    lock:      '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    sparkle:   '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    star:      '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    verified:  '<path d="m12 2.5 2.3 1.7 2.8-.2.9 2.7 2.3 1.6-1 2.7 1 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.5l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6 1-2.7-1-2.7 2.3-1.6.9-2.7 2.8.2z"/><path d="m9 12 2 2 4-4" stroke="#fff" fill="none" stroke-width="2"/>',
    arrow:     '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-back":'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevron:   '<path d="m9 6 6 6-6 6"/>',
    "chevron-down":'<path d="m6 9 6 6 6-6"/>',
    sun:       '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    moon:      '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    globe:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
    home:      '<path d="m3 10.5 9-7 9 7V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/><path d="M9.5 21.5v-7h5v7"/>',
    close:     '<path d="m6 6 12 12M18 6 6 18"/>',
    calendar:  '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    download:  '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/>',
    graduation:'<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="M6.5 10.5V15c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5"/>',
    eye:       '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    trend:     '<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
    "trend-down":'<path d="M3 7l6 6 4-4 8 8"/><path d="M16 17h5v-5"/>',
    bell:      '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z"/><path d="M10 21h4"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    grid:      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    logout:    '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4M6 12h9"/>',
    image:     '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/>',
    check:     '<path d="m5 12.5 4.5 4.5L19 7"/>',
    mail:      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    user:      '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    filter:    '<path d="M4 6h16M7 12h10M10 18h4"/>',
    gavel:     '<path d="M3.5 20.5h9"/><path d="m6.5 18 7-7"/><path d="M11.5 8.5 15 5l4 4-3.5 3.5z"/><path d="m16.5 3.5 4 4"/>',
    settings:  '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    wallet:    '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a2 2 0 0 1 2 2v1"/><rect x="3.5" y="7.5" width="17" height="12" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
    bold:      '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic:    '<path d="M15 5H9M15 19H9M14 5l-4 14"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    "align-start":'<path d="M4 6h16M4 11h10M4 16h13M4 21h8"/>',
    "align-center":'<path d="M4 6h16M7 11h10M5 16h14M8 21h8"/>',
    "align-end":'<path d="M4 6h16M10 11h10M7 16h13M12 21h8"/>',
    list:      '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    "list-num":'<path d="M9 6h11M9 12h11M9 18h11M4 5h1v4M4 13h2l-2 3h2"/>'
  };

  var Icons = {
    has: function (n) { return Object.prototype.hasOwnProperty.call(PATHS, n); },
    svg: function (name, cls) {
      var body = PATHS[name] || PATHS.chevron;
      var extra = cls ? " " + cls : "";
      return '<svg class="icon' + extra + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + "</svg>";
    }
  };

  /* ---------- Brand mark ---------- */
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
      '</span></a>';
  }

  /* ---------- Nav model ---------- */
  /* The middle slot belongs to whichever role you are signed in as — a client
     browses lawyers, a lawyer works their dashboard, a trainee the task bank.
     Everything else is common to all three. */
  function navItems() {
    var role = global.Roles ? global.Roles.info : null;
    var items = [{ key: "nav.home", tab: "tab.home", href: "index.html", id: "home", icon: "home" }];
    if (role) {
      items.push(role.nav);
      // The assistant is the lawyer's own tool. Clients never see it offered,
      // because they are never told a machine touched their document.
      if (role.id === "lawyer") {
        items.push({ key: "nav.assistant", tab: "tab.assistant",
                     href: "assistant.html", id: "assistant", icon: "sparkle" });
      }
    }
    items.push({ key: "nav.blog", tab: "tab.blog", href: "blog.html", id: "blog", icon: "file-text" });
    return items;
  }

  function themeButton() {
    return '<button class="icon-btn" type="button" data-action="toggle-theme" ' +
      'data-i18n-attr="aria-label:a11y.theme">' +
      Icons.svg("moon", "icon-moon") + Icons.svg("sun", "icon-sun") + "</button>";
  }

  function langButton() {
    return '<button class="icon-btn icon-btn--wide" type="button" data-action="toggle-lang" ' +
      'data-i18n-attr="aria-label:a11y.lang, title:a11y.lang">' +
      Icons.svg("globe", "icon-sm") + '<span class="lang-btn__code" data-lang-code>EN</span></button>';
  }

  /** The header badge: who you are, and a way into your own workspace. */
  function roleBadge() {
    var role = global.Roles ? global.Roles.info : null;
    if (!role) return "";
    return '<a class="role-badge" href="account.html" data-role-badge>' +
      '<span class="role-badge__mark">' + Icons.svg(role.icon, "icon-sm") + "</span>" +
      '<span class="role-badge__text"><strong data-i18n="account.signedInAs"></strong>' +
        '<span data-i18n="' + role.nameKey + '"></span></span></a>';
  }

  function header(active) {
    var links = navItems().map(function (item) {
      return '<a class="nav__link' + (item.id === active ? " is-active" : "") + '" href="' + item.href +
        '" data-i18n="' + item.key + '"' + (item.id === active ? ' aria-current="page"' : "") + "></a>";
    }).join("");

    return '<header class="site-header"><div class="container site-header__inner">' +
      brand() +
      '<nav class="nav" data-i18n-attr="aria-label:a11y.menu">' + links + "</nav>" +
      '<div class="header-actions">' +
        themeButton() + langButton() + roleBadge() +
      "</div></div></header>";
  }

  /** Phone navigation: a bottom tab bar, where a thumb actually reaches. */
  function tabbar(active) {
    var items = navItems().concat([
      { key: "account.heading", tab: "tab.account", href: "account.html", id: "account", icon: "user" }
    ]);
    return '<nav class="tabbar" data-tabbar data-i18n-attr="aria-label:a11y.menu">' +
      items.map(function (item) {
        var on = item.id === active;
        return '<a class="tabbar__link' + (on ? " is-active" : "") + '" href="' + item.href + '"' +
          (on ? ' aria-current="page"' : "") + ">" +
          Icons.svg(item.icon || "grid") +
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
          { href: "lawyers.html",   key: "nav.lawyers" },
          { href: "tasks.html",     key: "nav.tasks" },
          { href: "blog.html",      key: "nav.blog" },
          { href: "about.html",     key: "nav.about" },
          { href: "login.html",     key: "nav.login" }
        ]) +
        col("footer.legal", [
          { href: "about.html#faq", key: "footer.faq" },
          { href: "about.html#faq", key: "footer.privacy" },
          { href: "about.html#faq", key: "footer.terms" },
          { href: "about.html#faq", key: "footer.license" }
        ]) +
        col("footer.contact", [
          { href: "about.html#contact", key: "about.contactTitle" },
          { href: "about.html#faq",     key: "footer.help" },
          { href: "about.html#team",    key: "footer.careers" }
        ]) +
      "</div>" +
      '<div class="site-footer__bottom">' +
        '<span data-i18n="footer.rights"></span>' +
        '<span class="row gap-2">' + Icons.svg("shield-check", "icon-sm") + '<span data-i18n="footer.madeIn"></span></span>' +
      "</div></div></footer>";
  }

  /* ---------- Mount ----------
     This script sits directly after the header slot, so the header is built
     while the page is still parsing — no flash of a missing navbar. The footer
     slot doesn't exist yet at that point, so it is filled once parsing ends. */
  function mount() {
    var page = document.documentElement.getAttribute("data-page") || "";
    var filled = false;

    var headerSlot = document.querySelector("[data-slot=header]");
    if (headerSlot) { headerSlot.outerHTML = header(page) + tabbar(page); filled = true; }

    var footerSlot = document.querySelector("[data-slot=footer]");
    if (footerSlot) { footerSlot.outerHTML = footer(); filled = true; }

    if (filled && global.I18N) global.I18N.apply(document);
    return filled;
  }

  /** Rebuild the chrome in place — the nav changes when the role does. */
  function refresh() {
    var page = document.documentElement.getAttribute("data-page") || "";
    var oldHeader = document.querySelector(".site-header");
    var oldTabbar = document.querySelector("[data-tabbar]");
    if (!oldHeader) return;

    var holder = document.createElement("div");
    holder.innerHTML = header(page) + tabbar(page);
    var newHeader = holder.firstChild, newTabbar = holder.lastChild;

    oldHeader.replaceWith(newHeader);
    if (oldTabbar) oldTabbar.replaceWith(newTabbar);
    else document.body.appendChild(newTabbar);

    if (global.I18N) global.I18N.apply(newHeader), global.I18N.apply(newTabbar);
  }

  global.Layout = {
    mount: mount, refresh: refresh, header: header, footer: footer,
    tabbar: tabbar, brand: brand, navItems: navItems
  };
  global.Icons = Icons;

  mount();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); });
  }
})(window);
