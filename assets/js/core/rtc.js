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

    // A word from the far end that is not negotiation — the tape starting,
    // for one. Whoever is not holding it has to be told, or the recording is
    // a trick played on them.
    if (msg.note) { self.emit("note", msg.note); return; }

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

  /* ---------- recording a call ----------
     One mixed stream out of two: both voices through an audio graph, and the
     far end's picture if there is one. Recorded by exactly one side — the two
     peers compare ids and the lower one takes it, the same trick that decides
     which of them is polite — so a call leaves one copy rather than two of
     the same conversation from opposite ends.

     Nothing starts without both people being told, on screen, for the length
     of the call. That is not a nicety: a recording nobody was told about is
     not evidence, it is a problem. */
  function Recorder(local, remote, wantsVideo) {
    this.chunks = [];
    this.started = 0;
    this.mr = null;
    this.ctx = null;
    this.local = local;
    this.remote = remote;
    this.video = !!wantsVideo;
  }

  Recorder.supported = function () {
    return !!(global.MediaRecorder && global.AudioContext);
  };

  /** The first type this browser will actually write. Chromium says webm,
      Safari says mp4, and asking for the wrong one fails silently.

      Asked for the kind that is being recorded, not for whatever comes first:
      a voice consultation written as video/webm is a file the site then shows
      with a black rectangle where a player should be. */
  Recorder.mime = function (video) {
    var picture = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    var sound = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    var want = video ? picture.concat(sound) : sound.concat(picture);
    for (var i = 0; i < want.length; i++) {
      if (global.MediaRecorder.isTypeSupported(want[i])) return want[i];
    }
    return "";
  };

  Recorder.prototype.start = function () {
    if (!Recorder.supported()) return false;
    var tracks = [];
    try {
      this.ctx = new (global.AudioContext || global.webkitAudioContext)();
      // A context built without a gesture starts suspended, and a suspended
      // graph produces no samples at all — a recording of a call that nobody
      // can hear, which is worse than no recording.
      if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
      var mix = this.ctx.createMediaStreamDestination();
      [this.local, this.remote].forEach(function (s) {
        if (s && s.getAudioTracks && s.getAudioTracks().length) {
          this.ctx.createMediaStreamSource(s).connect(mix);
        }
      }, this);
      tracks = mix.stream.getAudioTracks();
    } catch (e) {
      // No audio graph: record what there is rather than nothing.
      tracks = (this.local && this.local.getAudioTracks()) || [];
    }
    if (this.video) {
      // The far end's picture is the one worth keeping — but if it never
      // arrived, keeping this end's is still a record of the call, and a
      // recorder with no video track at all writes a file with no frames.
      var picture = ((this.remote && this.remote.getVideoTracks &&
                      this.remote.getVideoTracks()) || [])
        // A track that has not delivered a frame yet is `muted`, and an
        // encoder handed one waits for a keyframe that never comes: it writes
        // nothing at all, audio included. So it only goes in once it is live.
        .filter(function (t) { return !t.muted; });
      if (!picture.length) {
        picture = (this.local && this.local.getVideoTracks &&
                   this.local.getVideoTracks()) || [];
      }
      tracks = tracks.concat(picture);
    }
    if (!tracks.length) return false;

    var mime = Recorder.mime(this.video);
    try {
      this.mr = new global.MediaRecorder(new global.MediaStream(tracks),
                                         mime ? { mimeType: mime } : undefined);
    } catch (e) { return false; }

    var self = this;
    this.mr.ondataavailable = function (e) {
      if (e.data && e.data.size) self.chunks.push(e.data);
    };
    this.started = Date.now();
    this.mr.start(1000);            // a chunk a second, so a crash loses one
    return true;
  };

  /** The finished recording, or null if there was nothing to keep. */
  Recorder.prototype.stop = function () {
    var self = this;
    function finished() {
      try { if (self.ctx) self.ctx.close(); } catch (e) {}
      if (!self.chunks.length) return null;
      var type = (self.mr && self.mr.mimeType) || Recorder.mime(self.video) || "video/webm";
      return {
        blob: new global.Blob(self.chunks, { type: type }),
        seconds: Math.max(1, Math.round((Date.now() - self.started) / 1000)),
        type: type,
      };
    }
    return new Promise(function (done) {
      // Hanging up stops the tracks, and a recorder whose tracks have all
      // ended stops itself. Reaching here with it already inactive is that
      // race, not an empty tape — and throwing away a minute of chunks
      // because the recorder beat us to the stop is how a recording quietly
      // stops existing. Whatever was written by then is the recording.
      if (!self.mr || self.mr.state === "inactive") return done(finished());
      self.mr.onstop = function () { done(finished()); };
      try { self.mr.stop(); } catch (e) { done(finished()); }
    });
  };

  global.RTC = {
    Call: Call,
    Recorder: Recorder,
    supported: function () {
      return !!(global.RTCPeerConnection && global.navigator.mediaDevices &&
                global.navigator.mediaDevices.getUserMedia);
    }
  };
})(window);
