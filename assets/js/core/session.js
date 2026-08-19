/* ==========================================================================
   Session — who is signed in, and which of their roles is active.

   Replaces the old "pick a role" toggle. One account can hold several roles
   (the decision taken up front), so the active role is a view onto the same
   person, not a different person.

   A visitor who has not signed in is a GUEST: they browse the public site and
   are invited to sign up wherever a role is required.
   ========================================================================== */
(function (global) {
  "use strict";

  var Store = global.Store;
  var ROLE_KEY = "sanad.activeRole";

  var ROLES = {
    client: {
      id: "client", icon: "user", nameKey: "role.client",
      home: "index.html",
      nav: { key: "nav.requests", tab: "tab.requests", href: "requests.html", id: "requests", icon: "inbox" }
    },
    lawyer: {
      id: "lawyer", icon: "scale", nameKey: "role.lawyer",
      home: "index.html",
      nav: { key: "nav.requests", tab: "tab.requests", href: "requests.html", id: "requests", icon: "inbox" }
    },
    intern: {
      id: "intern", icon: "graduation", nameKey: "role.intern",
      home: "index.html",
      nav: { key: "nav.requests", tab: "tab.requests", href: "requests.html", id: "requests", icon: "inbox" }
    },
    // Staff is not a role anybody adds to themselves. It is granted on the
    // account and it never appears in the "add a role" list, because the
    // person who decides a dispute must not be a party who could grant
    // themselves the power to decide it.
    staff: {
      id: "staff", icon: "shield-check", nameKey: "role.staff",
      home: "admin.html",
      nav: { key: "nav.admin", tab: "tab.admin", href: "admin.html", id: "admin", icon: "shield-check" }
    }
  };

  var listeners = [];
  function notify() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("sessionchange"));
  }

  function readRole() {
    try { return localStorage.getItem(ROLE_KEY); } catch (e) { return null; }
  }
  function writeRole(r) {
    try { r ? localStorage.setItem(ROLE_KEY, r) : localStorage.removeItem(ROLE_KEY); } catch (e) {}
  }

  var Session = {
    /** The signed-in person, or null for a guest. */
    user: function () {
      var id = Store.currentId();
      if (!id) return null;
      return global.Models ? global.Models.user(id) : null;
    },

    isGuest: function () { return !Session.user(); },

    /** The role currently being viewed — always one the account actually holds. */
    role: function () {
      var u = Session.user();
      if (!u) return "guest";
      var saved = readRole();
      if (saved && u.roles.indexOf(saved) !== -1) return saved;
      return u.activeRole && u.roles.indexOf(u.activeRole) !== -1 ? u.activeRole : u.roles[0];
    },

    info: function () { return ROLES[Session.role()] || null; },
    is: function (r) { return Session.role() === r; },
    roleDef: function (r) { return ROLES[r] || null; },
    /** The roles a person may take on. Staff is deliberately absent. */
    allRoles: function () { return [ROLES.client, ROLES.lawyer, ROLES.intern]; },

    /** Roles this account holds, in a stable order. */
    myRoles: function () {
      var u = Session.user();
      if (!u) return [];
      return ["client", "lawyer", "intern", "staff"].filter(function (r) { return u.roles.indexOf(r) !== -1; });
    },

    switchRole: function (r) {
      var u = Session.user();
      if (!u || u.roles.indexOf(r) === -1) return false;
      writeRole(r);
      Store.updateAccount(u.id, { activeRole: r });
      notify();
      return true;
    },

    /** A lawyer or trainee is only "live" once verified. */
    isVerified: function () {
      var u = Session.user();
      if (!u) return false;
      return Session.is("client") || Session.is("staff") || u.status === "verified";
    },

    /* Signing in is asynchronous now, because on Supabase it always was. Both
       backends return a promise so the pages have one shape to handle, rather
       than a branch on which data source happens to be configured. */
    signIn: function (email, password) {
      var SB = global.SB;
      if (SB && SB.configured()) {
        return SB.signIn(email, password).then(function (res) {
          if (!res.ok) return res;
          Store.signIn(res.id);
          notify();
          return { ok: true };
        });
      }
      var acc = Store.findAccount(email);
      if (!acc) return Promise.resolve({ ok: false, error: "noAccount" });
      if (acc.password && password !== acc.password) {
        return Promise.resolve({ ok: false, error: "badPassword" });
      }
      Store.signIn(acc.id);
      writeRole(acc.activeRole || acc.roles[0]);
      notify();
      return Promise.resolve({ ok: true, user: acc });
    },

    signOut: function () {
      var SB = global.SB;
      var done = (SB && SB.configured()) ? SB.signOut() : Promise.resolve();
      return done.then(function () {
        Store.signOut();
        writeRole(null);
        notify();
      });
    },

    onChange: function (fn, runNow) {
      listeners.push(fn);
      if (runNow) { try { fn(); } catch (e) { console.error(e); } }
    }
  };

  document.addEventListener("storechange", function () { /* keep views in step */ });

  global.Session = Session;
})(window);
