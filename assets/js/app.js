/* ==========================================================================
   App core — global behaviour + render helpers shared by every page.
   ========================================================================== */
(function (global) {
  "use strict";

  var I18N = global.I18N;
  var Icons = global.Icons;
  var DATA = global.DATA;

  /* ---------- tiny DOM helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function tx(pair) { return I18N.pick(pair); }

  /* ---------- avatars ----------
     Stock photography isn't shipped with the project, so each person gets a
     deterministic initials mark instead — it never 404s and it themes itself. */
  var AVATAR_TINTS = [
    ["#0f172a", "#2c4a7c"], ["#7a4a12", "#c8912a"], ["#123b32", "#2f7d63"],
    ["#3b1450", "#7a4a9e"], ["#4a1220", "#a3465e"], ["#123047", "#2f6f9e"]
  ];
  function initialsOf(name) {
    var parts = String(name).replace(/^(د\.|أ\.|Dr\.|Mr\.|Ms\.)\s*/i, "").trim().split(/\s+/);
    var a = parts[0] ? parts[0].charAt(0) : "";
    var b = parts.length > 1 ? parts[1].charAt(0) : "";
    return (a + b).toUpperCase();
  }
  function hashOf(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return h;
  }
  /** Pass a { ar, en } pair; monograms always come from the Latin spelling,
      because word-initial Arabic letters don't form a readable monogram. */
  function avatarOf(pair, seed) {
    var latin = (pair && typeof pair === "object" && pair.en) ? pair.en : pair;
    return avatar(latin, seed || latin);
  }

  function avatar(name, seed) {
    var tint = AVATAR_TINTS[hashOf(seed || name) % AVATAR_TINTS.length];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + tint[0] + '"/><stop offset="1" stop-color="' + tint[1] + '"/>' +
      "</linearGradient></defs>" +
      '<rect width="120" height="120" fill="url(#g)"/>' +
      '<text x="60" y="60" fill="#ffffff" font-family="Inter,Segoe UI,sans-serif" font-size="42" ' +
      'font-weight="700" text-anchor="middle" dominant-baseline="central">' + initialsOf(name) + "</text>" +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(message, iconName) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = Icons.svg(iconName || "check") + "<span>" + esc(message) + "</span>";
    // force reflow so the transition replays on rapid repeat calls
    void toastEl.offsetWidth;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 3600);
  }

  /* ---------- shared render fragments ---------- */
  function stars(rating) {
    return '<span class="rating">' + Icons.svg("star", "icon-sm") +
      '<span class="num">' + rating.toFixed(1) + "</span></span>";
  }

  function specialtyTags(lawyer, limit) {
    return lawyer.specialties.slice(0, limit || 3).map(function (id) {
      var s = DATA.labelOf(DATA.specialties, id);
      return '<span class="tag">' + esc(tx(s)) + "</span>";
    }).join("");
  }

  function priceCell(iconName, labelKey, value, sub, off) {
    return '<div' + (off ? ' class="off"' : "") + ">" +
      Icons.svg(iconName, "icon-sm") +
      '<span class="tiny muted">' + esc(I18N.t(labelKey)) + "</span>" +
      "<strong>" + value + "</strong>" +
      (sub ? '<span class="tiny muted">' + esc(sub) + "</span>" : "") +
      "</div>";
  }

  /** Compact card used on the home page grid. */
  function lawyerCardCompact(l) {
    var city = DATA.labelOf(DATA.cities, l.city);
    return '<article class="card card--hover lawyer-card card--rule-navy">' +
      '<div class="lawyer-card__body center" style="align-items:center">' +
        '<img class="avatar avatar--lg" src="' + avatarOf(l.name, l.id) + '" alt="" loading="lazy" width="88" height="88">' +
        '<h3 class="subtitle row gap-2" style="justify-content:center">' + esc(tx(l.name)) +
          '<span class="verified" title="verified">' + Icons.svg("verified", "icon-sm") + "</span></h3>" +
        '<span class="tag">' + esc(I18N.t("lawyer.license")) + ": <span class=\"num\">" + esc(l.license) + "</span></span>" +
        '<div class="row gap-2 wrap" style="justify-content:center">' + specialtyTags(l, 2) + "</div>" +
        '<div class="meta-row" style="justify-content:center">' +
          stars(l.rating) +
          '<span class="muted">' + esc(I18N.t("lawyer.reviews", { n: I18N.num(l.reviews) })) + "</span>" +
          '<span class="dot"></span>' +
          '<span class="row gap-1">' + Icons.svg("location", "icon-sm") + esc(tx(city)) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="lawyer-card__foot">' +
        '<a class="btn btn--primary btn--block" href="lawyer.html?id=' + encodeURIComponent(l.id) + '">' +
          esc(I18N.t("dir.book")) + "</a>" +
      "</div></article>";
  }

  /** Wide card used in the directory listing. */
  function lawyerCardWide(l) {
    var city = DATA.labelOf(DATA.cities, l.city);
    var has = function (t) { return l.consults.indexOf(t) !== -1; };

    var cells =
      priceCell("phone", "lawyer.call",
        has("call") ? '<span class="num">' + I18N.num(l.price) + "</span>" : esc(I18N.t("lawyer.unavailable")),
        has("call") ? I18N.t("lawyer.perHalfHour") : "", !has("call")) +
      priceCell("chat", "lawyer.chat",
        has("chat") ? '<span class="num">' + I18N.num(Math.round(l.price * 0.65)) + "</span>" : esc(I18N.t("lawyer.unavailable")),
        has("chat") ? I18N.t("lawyer.perConsult") : "", !has("chat")) +
      (has("contract")
        ? priceCell("file-text", "lawyer.contract", esc(I18N.t("lawyer.startsAt", { n: I18N.num(l.price * 3) })), "")
        : priceCell("gavel", "lawyer.litigation", esc(I18N.t("lawyer.byCase")), ""));

    return '<article class="card card--hover lawyer-card card--rule-navy">' +
      '<div class="lawyer-card__body">' +
        '<div class="row gap-4" style="align-items:flex-start">' +
          '<img class="avatar avatar--md" src="' + avatarOf(l.name, l.id) + '" alt="" loading="lazy" width="64" height="64">' +
          '<div class="grow">' +
            '<div class="row between gap-3">' +
              '<h3 class="subtitle" style="min-width:0">' + esc(tx(l.name)) + "</h3>" +
              '<span class="status status--warn">' + Icons.svg("star", "icon-sm") +
                '<span class="num">' + l.rating.toFixed(1) + "</span></span>" +
            "</div>" +
            '<p class="small muted">' + esc(tx(l.title)) + "</p>" +
            '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' + specialtyTags(l, 2) +
              '<span class="tag">' + esc(I18N.t("lawyer.years", { n: I18N.num(l.years) })) + "</span>" +
              '<span class="tag">' + esc(tx(city)) + "</span>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<p class="small muted">' + esc(tx(l.short)) + "</p>" +
      "</div>" +
      '<div class="price-grid">' + cells + "</div>" +
      '<div class="lawyer-card__foot row gap-3">' +
        '<a class="btn btn--primary grow" href="lawyer.html?id=' + encodeURIComponent(l.id) + '">' +
          Icons.svg("calendar", "icon-sm") + esc(I18N.t("dir.book")) + "</a>" +
        '<a class="btn btn--outline grow" href="lawyer.html?id=' + encodeURIComponent(l.id) + '#profile">' +
          Icons.svg("user", "icon-sm") + esc(I18N.t("dir.viewProfile")) + "</a>" +
      "</div></article>";
  }

  function articleCard(a) {
    var cat = DATA.labelOf(DATA.specialties, a.cat);
    var author = DATA.lawyerById(a.author);
    var authorName = author ? tx(author.name) : "";
    return '<article class="card card--hover article-card">' +
      '<a class="article-card__media" href="blog.html#' + esc(a.id) + '">' +
        '<img src="assets/img/' + esc(a.cover) + '" alt="" loading="lazy" width="800" height="450">' +
        '<span class="article-card__cat">' + esc(tx(cat)) + "</span>" +
      "</a>" +
      '<div class="article-card__body">' +
        '<div class="meta-row">' +
          "<span>" + esc(tx(a.date)) + "</span><span class=\"dot\"></span>" +
          '<span class="row gap-1">' + Icons.svg("clock", "icon-sm") +
            esc(I18N.t("blog.readTime", { n: I18N.num(a.read) })) + "</span>" +
        "</div>" +
        '<h3 class="subtitle"><a href="blog.html#' + esc(a.id) + '">' + esc(tx(a.title)) + "</a></h3>" +
        '<p class="small muted">' + esc(tx(a.excerpt)) + "</p>" +
      "</div>" +
      '<div class="article-card__foot">' +
        '<span class="row gap-2 small muted">' +
          '<img class="avatar avatar--sm" src="' + avatarOf(author ? author.name : authorName, a.author) + '" alt="" width="40" height="40">' +
          esc(authorName) + "</span>" +
        '<a class="row gap-1 small" style="color:var(--accent);font-weight:700" href="blog.html#' + esc(a.id) + '">' +
          esc(I18N.t("blog.readMore")) + Icons.svg("arrow", "icon-sm icon-flip") + "</a>" +
      "</div></article>";
  }

  /* ---------- scroll reveal ---------- */
  function observeReveals(root) {
    var nodes = $$(".reveal:not(.is-in)", root || document);
    if (!nodes.length) return;
    if (!("IntersectionObserver" in global)) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- drawer ---------- */
  function setDrawer(open) {
    var d = $("[data-drawer]");
    if (!d) return;
    d.classList.toggle("is-open", open);
    d.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.style.overflow = open ? "hidden" : "";
  }

  /* ---------- theme button tooltip ---------- */
  function syncThemeButtons() {
    var key = global.Theme.isDark ? "theme.toLight" : "theme.toDark";
    $$('[data-action="toggle-theme"]').forEach(function (el) {
      el.setAttribute("title", I18N.t(key));
    });
  }

  /* ---------- language button label ---------- */
  function syncLangButtons() {
    // The button advertises the language you'd switch TO, not the current one.
    $$("[data-lang-code]").forEach(function (el) {
      el.textContent = I18N.other().toUpperCase();
    });
  }

  /* ---------- render registry ----------
     Anything drawn from DATA registers here, so a language switch redraws it
     without a page reload. */
  var renderers = [];
  function onRender(fn) {
    renderers.push(fn);
    try { fn(); } catch (e) { console.error(e); }
  }
  function rerender() {
    renderers.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    observeReveals();
  }

  /* ---------- global delegated actions ---------- */
  document.addEventListener("click", function (ev) {
    var target = ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!target) return;
    var action = target.getAttribute("data-action");

    if (action === "toggle-theme") {
      global.Theme.toggle();
    } else if (action === "toggle-lang") {
      I18N.toggle();
    } else if (action === "open-drawer") {
      setDrawer(true);
    } else if (action === "close-drawer") {
      setDrawer(false);
    } else if (action === "scroll-top") {
      global.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      return; // not ours — let other handlers see it
    }
    if (target.tagName === "A" || target.tagName === "BUTTON") ev.preventDefault();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") setDrawer(false);
  });

  // Close the drawer when a link inside it navigates within the page
  document.addEventListener("click", function (ev) {
    var link = ev.target.closest ? ev.target.closest(".drawer__link") : null;
    if (link) setDrawer(false);
  });

  document.addEventListener("langchange", function () {
    syncLangButtons();
    syncThemeButtons();
    rerender();
  });

  document.addEventListener("themechange", syncThemeButtons);

  /* ---------- boot ---------- */
  function boot() {
    // Dashboard pages carry no header/footer slot, so layout.js never triggers
    // a translation pass for them. Do it here so every page is covered.
    I18N.apply(document);
    syncLangButtons();
    syncThemeButtons();
    observeReveals();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.App = {
    $: $, $$: $$, esc: esc, tx: tx,
    avatar: avatar, avatarOf: avatarOf, toast: toast, stars: stars,
    lawyerCardCompact: lawyerCardCompact,
    lawyerCardWide: lawyerCardWide,
    articleCard: articleCard,
    specialtyTags: specialtyTags,
    observeReveals: observeReveals,
    onRender: onRender,
    rerender: rerender
  };
})(window);
