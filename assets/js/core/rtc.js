/* ==========================================================================
   The call itself — getUserMedia for the local camera and microphone, and an
   RTCPeerConnection for the other side.

   Negotiation follows the "perfect negotiation" pattern rather than trying to
   decide who calls whom. Both sides may offer at the same moment; one of them
   is designated polite and rolls back when that happens, and the other ignores
   the colliding offer and lets its own stand. Politeness is derived from the
   two user ids, so each side works it out alone with nothing to exchange.

   An earlier attempt had whoever arrived first make the offer. It deadlocked:
   the first peer's announcement is sent into an empty room and nobody replays
   it, so when the second peer arrived neither believed it was their turn.

   ICE candidates are queued until a remote description exists, since a
   candidate that arrives early is dropped otherwise and the call silently
   never connects.
   ========================================================================== */
(function (global) {
  "use strict";

  var cfg = global.SANAD_CONFIG || {};

  /* STUN alone reaches most networks. A TURN relay is what carries the rest —
     symmetric NATs, strict corporate firewalls — and it is the one piece of
     call infrastructure that has to be paid for. */
  function iceServers() {
    var list = [{ urls: "stun:stun.l.google.com:19302" }];
    if (cfg.turn && cfg.turn.urls) list.push(cfg.turn);
    return list;
  }

  /** A description the transport can actually carry. */
  function plainSdp(desc) {
    return { type: desc.type, sdp: desc.sdp };
  }

  function Call(opts) {
    this.room = opts.room;
    this.video = opts.video !== false;
    this.on = opts.on || {};
    this.pc = null;
    this.local = null;
    this.signal = null;
    this.polite = !!opts.polite;  // rolls back when two offers collide
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.greeted = false;
    this.pending = [];            // ICE candidates that arrived too early
    this.started = 0;
  }

  Call.prototype.emit = function (name, payload) {
    if (this.on[name]) { try { this.on[name](payload); } catch (e) { console.error(e); } }
  };

  /** Ask for the camera and microphone. Rejects with a name we can translate. */
  Call.prototype.getMedia = function () {
    var self = this;
    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      return Promise.reject({ code: "unsupported" });
    }
    return global.navigator.mediaDevices
      .getUserMedia({ audio: true, video: self.video })
      .then(function (stream) {
        self.local = stream;
        self.emit("local", stream);
        return stream;
      })
      .catch(function (err) {
        var name = err && err.name;
        return Promise.reject({
          code: name === "NotAllowedError" || name === "SecurityError" ? "denied"
              : name === "NotFoundError" || name === "OverconstrainedError" ? "nodevice"
              : "failed",
          raw: err
        });
      });
  };

  Call.prototype.connect = function () {
    var self = this;
    self.pc = new RTCPeerConnection({ iceServers: iceServers() });

    self.local.getTracks().forEach(function (track) {
      self.pc.addTrack(track, self.local);
    });

    self.pc.ontrack = function (ev) {
      self.emit("remote", ev.streams[0]);
      if (!self.started) { self.started = Date.now(); self.emit("connected"); }
    };
    self.pc.onicecandidate = function (ev) {
      // RTCIceCandidate and RTCSessionDescription are not structured-cloneable
      // and will not survive a BroadcastChannel or a JSON transport, so both go
      // over the wire as plain objects.
      if (ev.candidate) self.post({ ice: ev.candidate.toJSON() });
    };
    self.pc.onnegotiationneeded = function () { self.negotiate(); };
    self.pc.onconnectionstatechange = function () {
      self.emit("state", self.pc.connectionState);
      if (self.pc.connectionState === "failed") self.emit("failed");
    };

    self.signal = global.Signal.open(self.room, function (msg) { self.receive(msg); });
    // Say we are here. Whoever is already in the room answers with their own
    // hello, so both sides know to negotiate no matter who arrived first.
    self.post({ hello: true });
  };

  Call.prototype.post = function (msg) {
    if (this.signal) this.signal.send(msg);
  };

  Call.prototype.receive = function (msg) {
    var self = this;

    if (msg.hello) {
      // Answer once, so a peer that arrived first learns of the newcomer.
      if (!self.greeted) { self.greeted = true; self.post({ hello: true }); }
      // A peer that was here first already offered into an empty room. Resend
      // that offer rather than building another: renegotiating from scratch is
      // what produced spurious rounds and "called in wrong state" errors.
      if (self.pc.signalingState === "have-local-offer" && self.pc.localDescription) {
        self.post({ sdp: plainSdp(self.pc.localDescription) });
      } else {
        self.negotiate();
      }
      return;
    }

    if (msg.sdp) {
      var collision = msg.sdp.type === "offer" &&
        (self.makingOffer || self.pc.signalingState !== "stable");
      self.ignoreOffer = !self.polite && collision;
      if (self.ignoreOffer) return;          // ours stands; theirs is dropped

      self.pc.setRemoteDescription(msg.sdp).then(function () {
        self.flush();
        if (msg.sdp.type !== "offer") return;
        return self.pc.setLocalDescription().then(function () {
          self.post({ sdp: plainSdp(self.pc.localDescription) });
        });
      }).catch(function (e) {
        // Two peers negotiating at once will sometimes deliver a description
        // that no longer applies. That is the pattern working, not a fault —
        // the connection state is what says whether the call is in trouble.
        if (self.pc && self.pc.connectionState === "failed") console.error(e);
      });
      return;
    }

    if (msg.ice) {
      var candidate = new RTCIceCandidate(msg.ice);
      if (self.pc.remoteDescription && self.pc.remoteDescription.type) {
        self.pc.addIceCandidate(candidate).catch(function (e) {
          if (!self.ignoreOffer) console.error(e);
        });
      } else {
        self.pending.push(candidate);
      }
      return;
    }

    if (msg.bye) self.emit("ended", "peer");
  };

  Call.prototype.flush = function () {
    var self = this;
    var queued = self.pending;
    self.pending = [];
    queued.forEach(function (c) { self.pc.addIceCandidate(c).catch(function () {}); });
  };

  /** Ask for a round of negotiation. Safe to call more than once. */
  Call.prototype.negotiate = function () {
    var self = this;
    if (self.makingOffer || !self.pc) return;
    self.makingOffer = true;
    self.pc.setLocalDescription().then(function () {
      self.post({ sdp: plainSdp(self.pc.localDescription) });
    }).catch(function (e) {
      console.error(e);
    }).then(function () {
      self.makingOffer = false;
    });
  };

  /* ---------- controls ---------- */
  Call.prototype.setMuted = function (muted) {
    if (!this.local) return;
    this.local.getAudioTracks().forEach(function (t) { t.enabled = !muted; });
  };
  Call.prototype.setCameraOff = function (off) {
    if (!this.local) return;
    this.local.getVideoTracks().forEach(function (t) { t.enabled = !off; });
  };
  Call.prototype.hasVideo = function () {
    return !!(this.local && this.local.getVideoTracks().length);
  };

  Call.prototype.hangUp = function () {
    if (this.signal) { this.post({ bye: true }); this.signal.close(); this.signal = null; }
    if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
    if (this.local) {
      this.local.getTracks().forEach(function (t) { t.stop(); });
      this.local = null;
    }
    this.emit("ended", "self");
  };

  global.RTC = {
    Call: Call,
    supported: function () {
      return !!(global.RTCPeerConnection && global.navigator.mediaDevices &&
                global.navigator.mediaDevices.getUserMedia);
    }
  };
})(window);
