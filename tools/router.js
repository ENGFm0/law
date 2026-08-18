/* ==========================================================================
   Hash router — used only by the bundled single-file build.
   The multi-page site navigates with ordinary links; here every view lives in
   one document and is swapped in under #/route, then its page module is run
   again through Pages.run().
   ========================================================================== */
(function (global) {
  "use strict";

  var ROUTES = global.__ROUTES__;          // injected by tools/build-artifact.mjs
  var DEFAULT = "index";
  var I18N = global.I18N, App = global.App, Pages = global.Pages;
  var Layout = global.Layout;
  var host = document.getElementById("app");

  function parse() {
    var raw = (global.location.hash || "").replace(/^#\/?/, "");
    var mark = raw.indexOf("?");
    var name = mark === -1 ? raw : raw.slice(0, mark);
    var query = mark === -1 ? "" : raw.slice(mark + 1);
    var to = "";
    query.split("&").forEach(function (part) {
      var kv = part.split("=");
      if (kv[0] === "to") to = decodeURIComponent(kv[1] || "");
    });
    return { name: ROUTES[name] ? name : DEFAULT, to: to, query: query };
  }

  function syncNav(name) {
    var href = name + ".html";
    App.$$(".nav__link, .tabbar__link").forEach(function (a) {
      var match = a.getAttribute("href") === href ||
        (name === "lawyer" && a.getAttribute("href") === "lawyers.html");
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function render() {
    var at = parse();
    var route = ROUTES[at.name];

    document.documentElement.setAttribute("data-page", route.page);
    document.documentElement.setAttribute("data-title-key", route.titleKey);

    global.__ROUTE_QUERY__ = at.query;
    App.resetRenderers();
    host.innerHTML = route.html;
    I18N.apply(document);
    // The header is role-aware, so it is rebuilt with the view, not once.
    if (Layout && Layout.refresh) Layout.refresh();
    Pages.run(route.script);
    App.observeReveals();
    syncNav(at.name);

    var target = at.to && document.getElementById(at.to);
    if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
    else global.scrollTo(0, 0);
  }

  /* Turn the site's own "page.html" links into hash routes, so one set of
     markup serves both the multi-page site and this bundle. */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    var parts = (a.getAttribute("href") || "")
      .match(/^([\w-]+)\.html(?:\?([^#]*))?(?:#(.*))?$/);
    if (!parts) return;

    ev.preventDefault();
    var next = "#/" + parts[1];
    var query = parts[2] || "";
    if (parts[3]) query += (query ? "&" : "") + "to=" + encodeURIComponent(parts[3]);
    if (query) next += "?" + query;

    if (global.location.hash === next) render();       // same route, re-render
    else global.location.hash = next;
  });

  global.addEventListener("hashchange", function () {
    // In-page anchors (#main from the skip link) are not routes — leave them be.
    var h = global.location.hash;
    if (h && h.charAt(1) !== "/") return;
    render();
  });
  global.Router = { render: render };
  render();
})(window);
