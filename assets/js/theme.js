/* ==========================================================================
   Theme — light / dark
   Runs synchronously in <head>, before any pixel is painted, so a dark-mode
   visitor never gets a white flash on load.
   ========================================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "sanad.theme";
  var media = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;

  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function write(v) {
    try {
      if (v) localStorage.setItem(STORAGE_KEY, v); else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
  }

  // An explicit choice wins; otherwise follow the OS.
  var stored = read();
  var current = (stored === "dark" || stored === "light")
    ? stored
    : (media && media.matches ? "dark" : "light");

  function paint(theme) {
    var html = document.documentElement;
    if (theme === "dark") html.setAttribute("data-theme", "dark");
    else html.setAttribute("data-theme", "light");
    // Keeps the mobile browser chrome in step with the page.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0a1020" : "#f7f8fd");
  }

  paint(current);

  // No explicit choice yet? Then keep tracking the OS while the tab is open.
  if (media && !stored) {
    var onSystem = function (e) {
      if (read()) return;
      current = e.matches ? "dark" : "light";
      paint(current);
      notify();
    };
    if (media.addEventListener) media.addEventListener("change", onSystem);
    else if (media.addListener) media.addListener(onSystem);
  }

  var listeners = [];
  function notify() {
    listeners.forEach(function (fn) { try { fn(current); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: current } }));
  }

  global.Theme = {
    get current() { return current; },
    get isDark() { return current === "dark"; },
    set: function (theme) {
      if (theme !== "dark" && theme !== "light") return;
      current = theme;
      write(theme);
      paint(theme);
      notify();
    },
    toggle: function () { global.Theme.set(current === "dark" ? "light" : "dark"); },
    /** Drop the saved preference and hand control back to the OS. */
    useSystem: function () {
      write(null);
      current = media && media.matches ? "dark" : "light";
      paint(current);
      notify();
    },
    onChange: function (fn, runNow) {
      listeners.push(fn);
      if (runNow !== false) { try { fn(current); } catch (e) { console.error(e); } }
    }
  };
})(window);
