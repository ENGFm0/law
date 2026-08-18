/* ==========================================================================
   App core — global behaviour shared by every page: theme and language
   controls, toasts, scroll reveals, and the render registry that lets a
   language or session change redraw the view in place.
   ========================================================================== */
(function (global) {
  "use strict";

  var I18N = global.I18N;
  var Icons = global.Icons;

  /* ---------- tiny DOM helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function tx(pair) { return I18N.pick(pair); }

  /* ---------- image paths ----------
     A bundled single-file build has no assets/ directory to reach, so it
     pre-populates window.__ASSETS__ with inlined data URIs. */
  function asset(name) {
    var map = global.__ASSETS__;
    return (map && map[name]) || "assets/img/" + name;
  }

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
  /** Single-page mode swaps the whole view, so drop the outgoing page's
      renderers before the incoming page registers its own. */
  function resetRenderers() { renderers.length = 0; }
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
    } else if (action === "scroll-top") {
      global.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      return; // not ours — let other handlers see it
    }
    if (target.tagName === "A" || target.tagName === "BUTTON") ev.preventDefault();
  });

  document.addEventListener("langchange", function () {
    syncLangButtons();
    syncThemeButtons();
    rerender();
  });

  // Signing in, signing out or switching role rewrites the navigation and
  // everything drawn for that person.
  document.addEventListener("sessionchange", function () {
    if (global.Layout && global.Layout.refresh) global.Layout.refresh();
    syncLangButtons();
    syncThemeButtons();
    rerender();
  });

  document.addEventListener("storechange", function () { rerender(); });

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

  /* ---------- addressing ----------
     The multi-page site keeps parameters in the query string; the bundled
     build keeps them in the hash. Pages ask these two rather than reading
     location themselves, so the same code serves both. */
  function param(name) {
    var src = global.__ROUTE_QUERY__ != null
      ? global.__ROUTE_QUERY__
      : global.location.search.replace(/^\?/, "");
    return new URLSearchParams(src).get(name);
  }

  function go(href) {
    if (!global.__SPA__) { global.location.href = href; return; }
    var m = String(href).match(/^([\w-]+)\.html(?:\?(.*))?$/);
    global.location.hash = m ? "#/" + m[1] + (m[2] ? "?" + m[2] : "") : href;
  }

  /* ---------- page modules ----------
     A page's script is a function, not a side effect, so the bundled
     single-file build can re-run it each time its router swaps that view in.
     The multi-page site has one view per document and runs it straight away. */
  var pages = {};
  global.Pages = {
    define: function (name, fn) {
      pages[name] = fn;
      if (!global.__SPA__) fn(global);
    },
    run: function (name) { if (pages[name]) pages[name](global); },
    has: function (name) { return !!pages[name]; }
  };

  global.App = {
    $: $, $$: $$, esc: esc, tx: tx,
    avatar: avatar, avatarOf: avatarOf, toast: toast, stars: stars,
    param: param, go: go,
    observeReveals: observeReveals,
    onRender: onRender,
    resetRenderers: resetRenderers,
    rerender: rerender,
    asset: asset
  };
})(window);
