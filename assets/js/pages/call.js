/* ==========================================================================
   The call room. Three states and nothing else: before you join, in the call,
   and after it ended. Everything the browser can refuse — permission, a
   missing device, an insecure origin — is caught and said in plain words,
   because "nothing happened" is the worst possible answer to a click.
   ========================================================================== */
Pages.define("call", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-call]");
  if (!host) return;

  var requestId = App.param("id");
  var phase = "ready";        // ready | live | ended
  var error = null;
  var call = null;
  var muted = false, camOff = false;
  var timer = null, seconds = 0, endedBy = null;

  function request() { return requestId ? M.request(requestId) : null; }

  /** Voice or video, taken from the service the client actually bought. */
  function wantsVideo() {
    var r = request();
    var t = r && M.serviceType(r.typeId);
    return !t || t.id !== "call";
  }

  function other() {
    var r = request();
    if (!r) return null;
    var me = Session.user();
    if (!me) return null;
    return M.user(me.id === r.clientId ? r.lawyerId : r.clientId);
  }

  function mayJoin() {
    var r = request(), me = Session.user();
    if (!r || !me) return false;
    var st = M.requestState(r);
    return me.id === r.clientId || me.id === r.lawyerId || st.assignedTo === me.id;
  }

  function clock() {
    var m = Math.floor(seconds / 60), s = seconds % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- the three screens ---------- */
  function readyScreen() {
    var r = request(), them = other();
    return '<div class="call-card card card--pad">' +
      '<span class="feature__icon" style="margin-inline:auto">' +
        Icons.svg(wantsVideo() ? "video" : "phone", "icon-lg") + "</span>" +
      '<h1 class="headline center" style="margin-top:var(--s-4)" data-i18n="' +
        (wantsVideo() ? "call.video" : "call.audio") + '"></h1>' +
      (them
        ? '<p class="lead center">' + esc(I18N.t("call.with", { name: tx(them.name) })) + "</p>" +
          '<div class="row center" style="margin-top:var(--s-5)">' + C.avatar(them, "lg") + "</div>"
        : "") +
      (r ? '<p class="small muted center" style="margin-top:var(--s-4)">' + esc(tx(r.title)) + "</p>" : "") +
      (error ? '<p class="form-error center" style="margin-top:var(--s-5)">' +
        esc(I18N.t("call." + error)) + "</p>" : "") +
      '<div class="row center gap-3 wrap" style="margin-top:var(--s-8)">' +
        '<button class="btn btn--accent btn--lg" type="button" data-join>' +
          Icons.svg(wantsVideo() ? "video" : "phone", "icon-sm") +
          "<span>" + esc(I18N.t(error ? "call.retry" : "call.join")) + "</span></button>" +
        '<a class="btn btn--ghost" href="requests.html" data-i18n="call.back"></a>' +
      "</div>" +
      '<p class="tiny faint center" style="margin-top:var(--s-4)" data-i18n="call.joinHint"></p>' +
      (global.Signal.isRemote() ? "" :
        '<p class="note-inline" style="margin-top:var(--s-6)">' +
          '<span><span data-i18n="call.localOnly"></span> ' +
          '<span data-i18n="call.openSecond"></span></span></p>' +
        '<div class="row center" style="margin-top:var(--s-3)">' +
          '<button class="btn btn--outline btn--sm" type="button" data-copy-link>' +
            Icons.svg("file-text", "icon-sm") +
            '<span data-i18n="call.copyLink"></span></button></div>') +
    "</div>";
  }

  function liveScreen() {
    var them = other();
    return '<div class="call-stage">' +
      '<div class="call-stage__remote">' +
        '<video data-remote autoplay playsinline></video>' +
        '<div class="call-stage__placeholder" data-placeholder>' +
          (them ? C.avatar(them, "lg") : "") +
          '<p class="subtitle" style="margin-top:var(--s-4)">' +
            esc(them ? tx(them.name) : "") + "</p>" +
          '<p class="small" data-call-status>' + esc(I18N.t("call.waiting")) + "</p>" +
        "</div>" +
        '<div class="call-stage__badge"><span class="num" data-clock>00:00</span></div>' +
        '<div class="call-stage__self' + (wantsVideo() ? "" : " is-audio") + '">' +
          '<video data-local autoplay playsinline muted></video>' +
          '<span class="tiny" data-i18n="call.you"></span>' +
        "</div>" +
      "</div>" +
      '<div class="call-bar">' +
        '<button class="call-btn" type="button" data-mute ' +
          'data-i18n-attr="aria-label:call.mute">' + Icons.svg("mic") + "</button>" +
        (wantsVideo()
          ? '<button class="call-btn" type="button" data-cam ' +
            'data-i18n-attr="aria-label:call.camOff">' + Icons.svg("video") + "</button>"
          : "") +
        '<button class="call-btn call-btn--end" type="button" data-hang ' +
          'data-i18n-attr="aria-label:call.hangUp">' + Icons.svg("phone-off") + "</button>" +
      "</div></div>";
  }

  function endedScreen() {
    var r = request();
    var me = Session.user();
    var canDeliver = r && me && me.id === r.lawyerId &&
      ["delivered", "completed"].indexOf(M.requestState(r).status) === -1;
    return '<div class="call-card card card--pad center">' +
      '<span class="feature__icon" style="margin-inline:auto">' + Icons.svg("check", "icon-lg") + "</span>" +
      '<h1 class="headline" style="margin-top:var(--s-4)" data-i18n="call.ended"></h1>' +
      (endedBy === "peer" ? '<p class="lead" data-i18n="call.endedByPeer"></p>' : "") +
      '<p class="small muted" style="margin-top:var(--s-4)">' + esc(I18N.t("call.duration")) +
        ': <strong class="num">' + esc(clock()) + "</strong></p>" +
      '<div class="row center gap-3 wrap" style="margin-top:var(--s-8)">' +
        (canDeliver
          ? '<button class="btn btn--accent" type="button" data-deliver data-i18n="call.markDone"></button>'
          : "") +
        '<a class="btn btn--outline" href="requests.html" data-i18n="call.back"></a>' +
      "</div></div>";
  }

  function gate(key) {
    return '<div class="call-card card card--pad center">' +
      C.empty("lock", key) +
      '<p style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="requests.html" data-i18n="call.back"></a></p></div>';
  }

  /* ---------- draw ---------- */
  App.onRender(function () {
    if (Session.isGuest()) { host.innerHTML = gate("auth.guestHint"); I18N.apply(host); return; }
    if (requestId && !mayJoin()) { host.innerHTML = gate("call.notYours"); I18N.apply(host); return; }

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-16)">' +
      (phase === "live" ? liveScreen() : phase === "ended" ? endedScreen() : readyScreen()) +
      "</div>";
    I18N.apply(host);
    if (phase === "live") attachStreams();
    syncButtons();
  });

  /* The <video> elements are recreated by every redraw, so the streams have to
     be re-attached rather than set once at join time. */
  var localStream = null, remoteStream = null;
  function attachStreams() {
    var l = $("[data-local]", host), r = $("[data-remote]", host);
    if (l && localStream) l.srcObject = localStream;
    if (r && remoteStream) r.srcObject = remoteStream;
    var ph = $("[data-placeholder]", host);
    if (ph) ph.hidden = !!remoteStream;
  }

  function syncButtons() {
    var mb = $("[data-mute]", host), cb = $("[data-cam]", host);
    if (mb) {
      mb.classList.toggle("is-off", muted);
      mb.setAttribute("aria-label", I18N.t(muted ? "call.unmute" : "call.mute"));
      mb.innerHTML = Icons.svg(muted ? "mic-off" : "mic");
    }
    if (cb) {
      cb.classList.toggle("is-off", camOff);
      cb.setAttribute("aria-label", I18N.t(camOff ? "call.camOn" : "call.camOff"));
      cb.innerHTML = Icons.svg(camOff ? "video-off" : "video");
    }
  }

  function status(key) {
    var el = $("[data-call-status]", host);
    if (el) el.textContent = I18N.t(key);
  }

  /* ---------- joining ---------- */
  function join() {
    error = null;

    if (!global.RTC.supported()) { error = "unsupported"; App.rerender(); return; }
    // getUserMedia is only handed out on a secure origin; localhost counts.
    if (!global.isSecureContext) { error = "insecure"; App.rerender(); return; }

    var them = other();
    call = new global.RTC.Call({
      room: requestId || "lobby",
      video: wantsVideo(),
      // Two offers can collide; the polite side yields. Comparing the two user
      // ids gives each peer the opposite answer with nothing to exchange.
      polite: !!(them && Session.user().id < them.id),
      on: {
        local: function (s) { localStream = s; },
        remote: function (s) { remoteStream = s; attachStreams(); status("call.connected"); },
        connected: function () { startTimer(); },
        state: function (st) {
          // Surfaced on the element so the state is inspectable, not only felt.
          var stage = $(".call-stage", host);
          if (stage) stage.setAttribute("data-conn", st);
          if (st === "connecting") status("call.connecting");
          if (st === "disconnected") status("call.reconnecting");
        },
        ended: function (who) { endedBy = who; finish(); }
      }
    });

    call.getMedia().then(function () {
      phase = "live";
      App.rerender();
      call.connect();
      status("call.waiting");
      startTimer();
    }).catch(function (e) {
      error = e.code || "failed";
      App.rerender();
    });
  }

  function startTimer() {
    if (timer) return;
    timer = setInterval(function () {
      seconds++;
      var el = $("[data-clock]", host);
      if (el) el.textContent = clock();
    }, 1000);
  }

  function finish() {
    clearInterval(timer);
    timer = null;
    localStream = null;
    remoteStream = null;
    phase = "ended";
    App.rerender();
  }

  /* ---------- events ---------- */
  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-join]")) { join(); return; }

    if (ev.target.closest("[data-copy-link]")) {
      var url = global.location.href;
      if (global.navigator.clipboard) global.navigator.clipboard.writeText(url);
      App.toast(I18N.t("call.copied"), "check");
      return;
    }

    if (ev.target.closest("[data-mute]")) {
      muted = !muted;
      if (call) call.setMuted(muted);
      syncButtons();
      return;
    }

    if (ev.target.closest("[data-cam]")) {
      camOff = !camOff;
      if (call) call.setCameraOff(camOff);
      syncButtons();
      return;
    }

    if (ev.target.closest("[data-hang]")) {
      if (call) call.hangUp(); else finish();
      return;
    }

    if (ev.target.closest("[data-deliver]")) {
      Store.setRequest(requestId, { status: "delivered" });
      App.toast(I18N.t("inbox.completed"), "check");
      setTimeout(function () { App.go("requests.html"); }, 800);
    }
  });

  // Leaving the page must release the camera; the light staying on is alarming.
  global.addEventListener("pagehide", function () { if (call) call.hangUp(); });
});
