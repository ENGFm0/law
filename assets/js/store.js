/* ==========================================================================
   Session store — request states, trainee assignments, draft edits.
   A request touched on the lawyer's dashboard has to still be there when the
   trainee opens their own page, so this outlives a navigation (sessionStorage)
   without pretending to be a backend.
   ========================================================================== */
(function (global) {
  "use strict";

  var KEY = "sanad.session";

  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function save(data) {
    try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  var state = load();
  if (!state.requests) state.requests = {};   // id -> { state, assignedTo, body }
  var listeners = [];

  function notify() {
    save(state);
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("storechange"));
  }

  global.Store = {
    /** Everything known about one request, with the seed values as defaults. */
    req: function (id, seed) {
      var live = state.requests[id] || {};
      return {
        state: live.state || (seed && seed.state) || "new",
        assignedTo: live.assignedTo || null,
        body: live.body || null
      };
    },

    set: function (id, patch) {
      var cur = state.requests[id] || {};
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      state.requests[id] = cur;
      notify();
    },

    /** Requests a lawyer has routed to a given trainee. */
    assignedTo: function (internId) {
      return Object.keys(state.requests).filter(function (id) {
        return state.requests[id].assignedTo === internId;
      });
    },

    assignedAny: function () {
      return Object.keys(state.requests).filter(function (id) {
        return !!state.requests[id].assignedTo;
      });
    },

    /* ---------------- open call for quotes ----------------
       One live request at a time: the client posts a brief, every lawyer may
       bid, and it dies on its own when the window closes. */
    getQuote: function () { return state.quote || null; },

    openQuote: function (q) {
      state.quote = q;
      notify();
      return q;
    },

    addOffer: function (offer) {
      if (!state.quote || state.quote.status !== "open") return false;
      var seen = state.quote.offers.some(function (o) { return o.lawyer === offer.lawyer; });
      if (seen) return false;                    // one bid per lawyer
      state.quote.offers.push(offer);
      notify();
      return true;
    },

    setQuoteStatus: function (status, extra) {
      if (!state.quote) return;
      state.quote.status = status;
      if (extra) Object.keys(extra).forEach(function (k) { state.quote[k] = extra[k]; });
      notify();
    },

    clearQuote: function () { delete state.quote; notify(); },

    reset: function () { state.requests = {}; delete state.quote; notify(); },

    onChange: function (fn) { listeners.push(fn); }
  };
})(window);
