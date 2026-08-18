/* ==========================================================================
   Roles — client / lawyer / intern.
   The platform serves three audiences, and which one you are decides the
   navigation, the dashboard you land on, and which workspaces exist at all.
   Stored like the theme and the language, so the choice survives navigation.
   ========================================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "sanad.role";
  var DEFAULT_ROLE = "client";

  var ROLES = {
    client: {
      id: "client",
      icon: "user",
      nameKey: "role.client",
      /* The workspace this role lands on from the header badge. */
      home: "dashboard-client.html",
      /* Role-specific slot in the main navigation. */
      nav: { key: "nav.lawyers", tab: "tab.lawyers", href: "lawyers.html", id: "lawyers", icon: "search" }
    },
    lawyer: {
      id: "lawyer",
      icon: "scale",
      nameKey: "role.lawyer",
      home: "dashboard-lawyer.html",
      nav: { key: "dash.panel", tab: "tab.dashboard", href: "dashboard-lawyer.html", id: "dashboard", icon: "grid" }
    },
    intern: {
      id: "intern",
      icon: "graduation",
      nameKey: "role.intern",
      home: "tasks.html",
      nav: { key: "nav.tasks", tab: "tab.tasks", href: "tasks.html", id: "tasks", icon: "graduation" }
    }
  };

  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* private mode */ }
  }

  var stored = read();
  var current = ROLES[stored] ? stored : DEFAULT_ROLE;

  var listeners = [];

  global.Roles = {
    get current() { return current; },
    get info() { return ROLES[current]; },
    all: function () { return [ROLES.client, ROLES.lawyer, ROLES.intern]; },
    is: function (id) { return current === id; },
    get: function (id) { return ROLES[id] || null; },

    set: function (id) {
      if (!ROLES[id] || id === current) return;
      current = id;
      write(id);
      listeners.forEach(function (fn) { try { fn(id); } catch (e) { console.error(e); } });
      document.dispatchEvent(new CustomEvent("rolechange", { detail: { role: id } }));
    },

    onChange: function (fn, runNow) {
      listeners.push(fn);
      if (runNow !== false) { try { fn(current); } catch (e) { console.error(e); } }
    }
  };
})(window);
