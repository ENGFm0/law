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
  var conn = "new";       // the connection state, kept so a redraw does not lose it
  // The recording, and what to do with it once the call ends.
  var recorder = null, claimed = false, taped = null, asking = false, peerTaping = false;

  function request() { return requestId ? M.request(requestId) : null; }

  /** Voice or video, taken from the channel the client chose when they
      ordered. It used to read the service type and compare it to "call" — a
      category that stopped existing when the catalogue became legal work, so
      every voice consultation was asking for a camera. */
  function wantsVideo() {
    var r = request();
    return !!(r && r.channel === "video");
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
    return '<div class="call-stage" data-conn="' + esc(conn) + '">' +
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
      (recorder || peerTaping
        ? '<p class="call-taping">' + Icons.svg("bell", "icon-sm") +
          "<span>" + esc(I18N.t("call.taping")) + "</span></p>"
        : "") +
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
      (asking
        ? '<div class="card card--pad" style="margin-top:var(--s-6);text-align:start">' +
            '<strong>' + esc(I18N.t("call.keepTitle")) + "</strong>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' +
              esc(I18N.t("call.keepBody", { n: I18N.num(taped ? taped.seconds : 0) })) + "</p>" +
            '<p class="tiny faint" style="margin-top:var(--s-2)">' +
              esc(I18N.t("call.keepPlatform")) + "</p>" +
            '<div class="row gap-3 wrap" style="margin-top:var(--s-4)">' +
              '<button class="btn btn--primary btn--sm" type="button" data-keep-call>' +
                Icons.svg("check", "icon-sm") + esc(I18N.t("call.keepYes")) + "</button>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-drop-call>' +
                esc(I18N.t("call.keepNo")) + "</button>" +
            "</div></div>"
        : "") +
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

    var r = request();
    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-16)">' +
      (phase === "live" ? liveScreen() : phase === "ended" ? endedScreen() : readyScreen()) +
      // A call is not the whole of a consultation. Whatever has to be sent —
      // the contract being argued about, a photo of the notice, the note
      // written while talking — belongs to the same case, in the same thread
      // the two of them already have, before the call, during it and after.
      (r ? '<div class="call-card card card--pad" style="margin-top:var(--s-6)">' +
             C.thread(r, "parties", { closed: M.requestState(r).status === "completed" }) +
           "</div>"
         : "") +
      "</div>";
    I18N.apply(host);
    if (phase === "live") attachStreams();
    syncButtons();
    C.threadDraw(host);
  });
  C.wireThread(host);

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
        remote: function (s) {
          remoteStream = s; attachStreams(); status("call.connected");
          // Both ends are now on the line, which is the first moment there is
          // anything worth keeping. Exactly one of them records: the lower id
          // takes it, so the call leaves one copy rather than two.
          startTaping();
        },
        connected: function () { startTimer(); },
        state: function (st) {
          // Surfaced on the element so the state is inspectable, not only
          // felt. Held in a variable as well as written to the node, because
          // anything else on this page that redraws would otherwise wipe it.
          conn = st;
          var stage = $(".call-stage", host);
          if (stage) stage.setAttribute("data-conn", st);
          if (st === "connecting") status("call.connecting");
          if (st === "disconnected") status("call.reconnecting");
        },
        note: function (n) {
          // The other side started the tape. Say so here too, for as long as
          // it runs — being recorded is not something you find out afterwards.
          if (n === "taping") { peerTaping = true; App.rerender(); }
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
    phase = "ended";
    // Stop the tape before the streams go, and hold what it caught until the
    // question below is answered.
    stopTaping().then(function () {
      localStream = null;
      remoteStream = null;
      App.rerender();
    });
    App.rerender();
  }

  /* ---------- the tape ----------
     One side records, chosen the same way politeness is: the lower id takes
     it. Both sides are told, on screen, for the whole call — that disclosure
     is what makes the recording worth anything, and it is not optional.

     What happens to it afterwards is two decisions, not one. The parties
     choose whether a copy is kept on their request. The platform keeps its
     own copy either way, for the day one of them says the call went
     differently — and that is said in the same breath as the first sentence,
     not buried. */
  function recorderIsMine() {
    var them = other(), me = Session.user();
    if (!them || !me) return true;
    return me.id < them.id;
  }

  /** The far end's track exists from the moment the description is applied,
      but carries no picture until frames actually arrive. Starting the tape
      in that gap produces a file with nothing in it, so the tape waits — and
      does not wait forever. */
  function whenPictureArrives(then) {
    var track = wantsVideo() && remoteStream && remoteStream.getVideoTracks
      ? remoteStream.getVideoTracks()[0] : null;
    if (!track || !track.muted) return then();
    var done = false;
    var go = function () {
      if (done) return;
      done = true;
      track.removeEventListener("unmute", go);
      then();
    };
    track.addEventListener("unmute", go);
    setTimeout(go, 4000);      // no picture coming: record the call anyway
  }

  function startTaping() {
    if (claimed || !recorderIsMine()) return;
    if (!global.RTC.Recorder || !global.RTC.Recorder.supported()) return;
    claimed = true;            // taken, so a second remote track does not race
    whenPictureArrives(function () {
      if (phase !== "live") return;
      var mine = new global.RTC.Recorder(localStream, remoteStream, wantsVideo());
      if (!mine.start()) return;
      recorder = mine;
      if (call) call.post({ note: "taping" });
      App.rerender();
    });
  }

  function stopTaping() {
    if (!recorder) return Promise.resolve(null);
    var mine = recorder;
    recorder = null;
    return mine.stop().then(function (out) {
      // A tape that caught nothing is worth saying out loud: both people were
      // told for the whole call that it was being recorded, and finding out
      // afterwards that there is no recording is exactly the kind of thing
      // they would otherwise learn on the day they needed it.
      if (!out) { App.toast(I18N.t("call.noTape"), "alert"); return null; }
      taped = out;
      asking = true;
      // The platform's copy goes at once and regardless. The parties' copy
      // waits on their answer.
      keep("staff");
      App.rerender();
      return out;
    }).catch(function (e) { console.error(e); return null; });
  }

  /** Put the recording on the request, for the audience given. It goes in as
      a message with the file on it rather than as a loose attachment: a
      conversation shows what was said, and the call is part of what was
      said. A file with no line to sit on would not appear there at all. */
  function keep(audience) {
    var r = request(), me = Session.user();
    if (!taped || !r || !me) return;
    var ext = /mp4/.test(taped.type) ? "mp4" : "webm";
    var name = I18N.t(wantsVideo() ? "call.recVideoName" : "call.recAudioName",
                      { n: I18N.num(taped.seconds) }) + "." + ext;
    var file = new global.File([taped.blob], name, { type: taped.type });
    var blob = taped;
    Store.sendMessage({
      requestId: r.id, audience: audience, authorId: me.id,
      body: I18N.t("call.recNote"),
    }, function (saved) {
      Store.attachFile({
        requestId: r.id, messageId: saved.id, audience: audience, authorId: me.id,
        name: name, size: blob.blob.size, mime: blob.type,
        kind: "call", seconds: blob.seconds, file: file,
      });
    });
  }

  /* ---------- events ---------- */
  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-join]")) { join(); return; }

    if (ev.target.closest("[data-keep-call]")) {
      keep("parties");
      asking = false; taped = null;
      App.toast(I18N.t("call.kept"), "check");
      App.rerender();
      return;
    }
    if (ev.target.closest("[data-drop-call]")) {
      asking = false; taped = null;
      App.toast(I18N.t("call.dropped"), "close");
      App.rerender();
      return;
    }

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
