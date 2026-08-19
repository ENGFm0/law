/* ==========================================================================
   Signalling — how two browsers agree on a call before the media flows.

   WebRTC carries audio and video directly between two peers, but the two have
   to exchange an offer, an answer and a handful of ICE candidates first, and
   that exchange needs a channel neither peer owns. This module is that
   channel, behind one small interface:

       Signal.open(room, onMessage) -> { send(msg), close() }

   The transport underneath is swappable, and only one of them is real:

     • "local"    — BroadcastChannel between tabs of the same browser. Enough to
                    build and test the whole call flow, and enough for a demo,
                    but it will never reach another device.
     • "supabase" — a Realtime channel. Same shape, works across the internet.
                    Fill in SANAD_CONFIG.supabase and it takes over by itself.

   Everything above this file is written against the interface, so moving to
   production is a configuration change rather than a rewrite.
   ========================================================================== */
(function (global) {
  "use strict";

  var cfg = global.SANAD_CONFIG || {};

  /* ---------- transport 1: this browser only ---------- */
  function localTransport(room, onMessage) {
    var name = "sanad.call." + room;
    var me = Math.random().toString(36).slice(2, 10);

    if (typeof BroadcastChannel === "function") {
      var bc = new BroadcastChannel(name);
      bc.onmessage = function (ev) {
        if (ev.data && ev.data.from !== me) onMessage(ev.data.body, ev.data.from);
      };
      return {
        id: me,
        send: function (body) { bc.postMessage({ from: me, body: body }); },
        close: function () { try { bc.close(); } catch (e) {} }
      };
    }

    // Older browsers: storage events fire in the OTHER tabs, which is exactly
    // the delivery we need. The key is rewritten each time so it always fires.
    function onStorage(ev) {
      if (ev.key !== name || !ev.newValue) return;
      var msg;
      try { msg = JSON.parse(ev.newValue); } catch (e) { return; }
      if (msg && msg.from !== me) onMessage(msg.body, msg.from);
    }
    global.addEventListener("storage", onStorage);
    return {
      id: me,
      send: function (body) {
        try {
          localStorage.setItem(name, JSON.stringify({ from: me, body: body, at: Date.now() }));
        } catch (e) {}
      },
      close: function () { global.removeEventListener("storage", onStorage); }
    };
  }

  /* ---------- transport 2: Supabase Realtime ----------
     Loaded only when configured, so the site keeps working with no network. */
  function supabaseTransport(room, onMessage) {
    var sb = global.supabase && global.supabase.createClient(cfg.supabase.url, cfg.supabase.anonKey);
    if (!sb) return null;
    var me = Math.random().toString(36).slice(2, 10);
    var channel = sb.channel("call:" + room, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "signal" }, function (payload) {
      var msg = payload.payload;
      if (msg && msg.from !== me) onMessage(msg.body, msg.from);
    }).subscribe();
    return {
      id: me,
      send: function (body) {
        channel.send({ type: "broadcast", event: "signal", payload: { from: me, body: body } });
      },
      close: function () { try { sb.removeChannel(channel); } catch (e) {} }
    };
  }

  var Signal = {
    /** Which transport is actually carrying messages right now. */
    kind: function () {
      return (cfg.supabase && cfg.supabase.url && global.supabase) ? "supabase" : "local";
    },

    /** True when a call can reach a different device. */
    isRemote: function () { return Signal.kind() === "supabase"; },

    open: function (room, onMessage) {
      if (Signal.kind() === "supabase") {
        var t = supabaseTransport(room, onMessage);
        if (t) return t;
      }
      return localTransport(room, onMessage);
    }
  };

  global.Signal = Signal;
})(window);
