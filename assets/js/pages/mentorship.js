/* ==========================================================================
   Supervision — its own place, because it is its own thing.

   It used to hang off the bottom of the requests page, which made it look
   like a footnote to somebody's inbox. It is not: for a trainee it is the
   whole reason they are here, and for a lawyer it is a standing relationship
   with a fee and a calendar, not a task.

   One address, two workspaces, the same rows underneath:

     trainee   مساحتي · ابحث عن مشرف · طلباتي
     lawyer    من تشرف عليهم · الطلبات · النداءات · عرضي

   Every rule the database enforces is drawn rather than argued with: the
   side that asked never answers, only the mentor writes the calendar and
   marks attendance, and nobody joins anybody by pressing a button here.
   ========================================================================== */
Pages.define("mentorship", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-mentorship]");
  if (!host) return;

  var tab = App.param("tab") || null;
  var query = "";          // the mentor search
  var asking = null;       // the mentor being asked, or "all" for the open call
  var askNote = "";
  var draft = { hours: "2", day: 0, from: "17:00", to: "19:00" };

  /* What the store answers with, said in words the person can act on. */
  var SAID = { sent: "men.sent", already: "men.haveOne",
               "not offered": "men.notOffered", "not signed in": "men.signIn" };

  /* ---------- one live supervision, drawn for whichever side is reading ----
     A trainee sees who is teaching them, what it costs and what it has
     earned them in hours; a lawyer sees the same relationship from the other
     end. Neither sees a screen written for the other, and both are looking
     at the same rows — which is the only way the hours on a certificate can
     be trusted. */
  function menState(m, mine) {
    if (m.status === "pending") {
      // The side that asked cannot also answer. Said here so the button is
      // not drawn, and in the database so it cannot be called around.
      var theirs = (m.openedBy === "intern" ? m.internId : m.mentorId) === mine;
      return theirs
        ? '<span class="tiny muted">' + esc(I18N.t("men.pending")) + "</span>"
        : '<span class="row gap-2">' +
            '<button class="btn btn--primary btn--sm" type="button" data-men-yes="' +
              esc(m.id) + '">' + esc(I18N.t("men.accept")) + "</button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-men-no="' +
              esc(m.id) + '">' + esc(I18N.t("men.decline")) + "</button></span>";
    }
    if (m.status === "active") {
      return '<button class="btn btn--ghost btn--sm" type="button" data-men-end="' +
        esc(m.id) + '">' + esc(I18N.t("men.end")) + "</button>";
    }
    return '<span class="tiny muted">' +
      esc(I18N.t(m.status === "ended" ? "men.ended" : "men.declined")) + "</span>";
  }

  function menRoom(m, me) {
    var log = Store.roomMessages(m.id);
    var mentor = me.id === m.mentorId;
    var files = C.roomFiles(m.id);
    // The room is a thread whose subject is the mentorship. Marked as one so
    // the compose bar, the file queue and the voice recorder all work here
    // exactly as they do on a case, rather than being written twice.
    return '<section class="thread" data-thread="' + esc(m.id) + '" data-audience="room" ' +
      'data-room="' + esc(m.id) + '">' +
      '<h3 class="subtitle">' + esc(I18N.t("men.roomTitle")) + "</h3>" +
      '<div class="thread__log">' +
        (log.length
          ? log.map(function (x) {
              var who = M.user(x.authorId);
              return '<div class="bubble-row' + (x.authorId === me.id ? " bubble-row--mine" : "") + '">' +
                '<span class="bubble-row__gap"></span>' +
                '<article class="bubble' + (x.authorId === me.id ? " bubble--mine" : "") + '">' +
                  (x.authorId === me.id ? ""
                    : '<strong class="bubble__who">' + esc(who ? tx(who.name) : "") + "</strong>") +
                  (x.body ? '<p class="bubble__body">' + esc(x.body) + "</p>" : "") +
                  (function () {
                    var mine = files.filter(function (f) { return f.messageId === x.id; });
                    return mine.length
                      ? '<div class="bubble__files">' + mine.map(C.fileChip).join("") + "</div>"
                      : "";
                  })() +
                  '<time class="bubble__at tiny">' + esc(C.stamp(x.at)) + "</time>" +
                "</article></div>";
            }).join("")
          : '<p class="small muted center">' +
            esc(I18N.t(mentor ? "men.roomEmptyMentor" : "men.roomEmpty")) + "</p>") +
      "</div>" +
      C.composeBar() + "</section>";
  }

  function menSessions(m, me) {
    var mentor = me.id === m.mentorId;
    var list = Store.sessions().filter(function (x) { return x.mentorshipId === m.id; })
      .sort(function (a, b) {
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });

    return '<section style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle">' + esc(I18N.t("men.calendar")) + "</h3>" +
      (list.length
        ? '<div class="stack gap-2" style="margin-top:var(--s-3)">' + list.map(function (x) {
            return '<div class="row between wrap gap-3 admin-line">' +
              "<span><strong class=\"small\">" + esc(x.title) + "</strong>" +
              '<span class="tiny muted" style="display:block">' +
                esc(C.stamp(new Date(x.startsAt).getTime())) + " · " +
                esc(I18N.t("men.sessionHours")) + " " + I18N.num(x.hours || 1) + "</span></span>" +
              (x.attended
                ? '<span class="status status--ok">' + esc(I18N.t("men.attended")) + "</span>"
                : (mentor
                    ? '<button class="btn btn--outline btn--sm" type="button" data-men-attended="' +
                      esc(x.id) + '">' + esc(I18N.t("men.markAttended")) + "</button>"
                    : "")) +
            "</div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("men.noSessions")) + "</p>") +
      // Only the mentor writes the calendar, and only the mentor marks
      // attendance — a trainee who could tick their own hours is a trainee
      // writing their own certificate.
      (mentor
        ? '<form class="row gap-2 wrap" style="margin-top:var(--s-4)" data-session-form="' +
            esc(m.id) + '">' +
            '<input class="input" data-session-title style="flex:2 1 180px" placeholder="' +
              esc(I18N.t("men.sessionTitle")) + '">' +
            '<input class="input" type="datetime-local" dir="ltr" data-session-when ' +
              'style="flex:1 1 180px">' +
            '<input class="input" type="number" min="0" max="12" value="2" ' +
              'data-session-hours style="flex:0 1 90px">' +
            '<button class="btn btn--outline btn--sm" type="submit">' +
              esc(I18N.t("men.addSession")) + "</button></form>"
        : "") +
    "</section>";
  }

  function menCard(m, me) {
    var mentor = me.id === m.mentorId;
    var them = M.user(mentor ? m.internId : m.mentorId);
    var split = M.sponsorship(m);
    var prog = M.certProgress(m.internId);

    return '<article class="card card--pad" style="margin-bottom:var(--s-4)">' +
      '<div class="row between wrap gap-3">' +
        '<span class="row gap-3">' + C.avatar(them, "sm") +
          "<span><strong>" + esc(them ? tx(them.name) : "") + "</strong>" +
          '<span class="tiny muted" style="display:block">' +
            esc(I18N.t(mentor ? "men.activeBy" : "men.active")) + "</span></span></span>" +
        menState(m, me.id) +
      "</div>" +

      (m.status === "active"
        ? '<div class="meta-row" style="margin-top:var(--s-4)">' +
            '<span class="tiny muted">' + esc(I18N.t("men.monthly")) + ": " +
              C.sar(split.gross) + "</span>" +
            (mentor
              ? '<span class="dot"></span><span class="tiny muted">' +
                esc(I18N.t("men.netToYou")) + ": <strong>" + C.sar(split.lawyer) +
                "</strong></span>"
              : "") +
            '<span class="dot"></span>' +
            '<span class="tiny muted">' + esc(I18N.t("men.hoursTitle")) + ": " +
              esc(I18N.t("men.hoursOf", { n: I18N.num(prog.hours),
                                          t: I18N.num(prog.needed) })) + "</span>" +
          "</div>" +
          // The trainee is the one who pays, so the trainee is the one shown
          // the state of it — and shown it plainly rather than by a button
          // going missing.
          (!mentor && split.gross
            ? (split.current
                ? '<p class="tiny faint" style="margin-top:var(--s-3)">' +
                  esc(I18N.t("men.paidUntil", { d: I18N.date(m.paidUntil) })) + "</p>"
                : '<div class="row gap-3 wrap" style="margin-top:var(--s-3)">' +
                  '<span class="tiny" style="color:var(--warning);align-self:center">' +
                    esc(I18N.t("men.unpaid")) + "</span>" +
                  '<button class="btn btn--accent btn--sm" type="button" data-men-pay="' +
                    esc(m.id) + '">' + esc(I18N.t("men.pay")) + "</button></div>")
            : "") +
          menRoom(m, me) +
          menSessions(m, me)
        : "") +
    "</article>";
  }


  /* ====================================================== the trainee ===== */
  function traineeTabs() {
    return [["space", "men.tabSpace"], ["find", "men.tabFind"], ["sent", "men.tabSent"]];
  }

  /** Who signs for this trainee, and everything that follows from it. */
  function spacePanel(me) {
    var live = Store.mentorships().filter(function (m) {
      return m.internId === me.id && m.status === "active";
    });
    var signer = M.signerFor(me.id);
    var held = M.openOrderOf(me.id);
    var prog = M.certProgress(me.id);

    if (!signer) {
      return '<section class="card card--pad">' +
        '<h2 class="subtitle">' + esc(I18N.t("men.noneTitle")) + "</h2>" +
        '<p class="small muted" style="margin:var(--s-3) 0 var(--s-4);max-width:60ch">' +
          esc(I18N.t("men.noneLead")) + "</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-go="find">' +
          Icons.svg("search", "icon-sm") + esc(I18N.t("men.findMentor")) + "</button></section>";
    }

    return hoursCard(prog) +
      (live.length
        ? live.map(function (m) { return menCard(m, me); }).join("")
        : '<section class="card card--pad card--rule-gold" style="margin-top:var(--s-6)">' +
            '<div class="row between wrap gap-4">' +
              '<span class="row gap-3">' + C.avatar(signer, "md") +
                "<span>" +
                  '<span class="tiny muted" style="display:block">' +
                    esc(I18N.t("hub.yourSigner")) + "</span>" +
                  C.personLink(signer) + C.verifiedMark(signer) + "</span></span>" +
            "</div>" +
            '<p class="tiny faint" style="margin-top:var(--s-4)">' +
              esc(I18N.t("hub.singleOnly")) + "</p>" +
            (held ? '<p class="tiny faint" style="margin-top:var(--s-2)">' +
              esc(I18N.t("sup.spend")) + "</p>" : "") + "</section>") +
      queueCard(me);
  }

  function hoursCard(prog) {
    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.hours")) + "</h2>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)">' +
        esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + " / " +
        '<span class="num">' + I18N.num(prog.needed) + "</span></p>" +
      C.progressBar(prog.pct) +
      '<p class="tiny faint" style="margin-top:var(--s-3)">' +
        esc(I18N.t("cert.remaining",
          { n: I18N.num(Math.max(0, prog.needed - prog.hours)) })) + "</p></section>";
  }

  /** The work itself stays on the requests page; this is the way back to it. */
  function queueCard(me) {
    var tasks = M.requestsForIntern(me.id).filter(function (r) {
      var st = M.requestState(r);
      return st.status !== "completed" && st.status !== "cancelled" && st.status !== "refunded";
    });
    return '<section class="card card--pad" style="margin-top:var(--s-6)">' +
      '<div class="row between wrap gap-3">' +
        '<h2 class="subtitle">' + esc(I18N.t("hub.queue")) + "</h2>" +
        '<a class="btn btn--outline btn--sm" href="requests.html">' +
          esc(I18N.t("hub.open")) + "</a></div>" +
      '<p class="small muted" style="margin-top:var(--s-3)">' +
        (tasks.length
          ? esc(I18N.t("men.queueCount", { n: I18N.num(tasks.length) }))
          : esc(I18N.t("hub.noTasks"))) + "</p></section>";
  }

  /* ---------- finding one ---------- */
  function findPanel(me) {
    var standing = M.mentorOf(me.id);
    var held = M.openOrderOf(me.id);
    var call = M.callOf(me.id);
    var cfg = M.platformSettings();
    var text = query.trim().toLowerCase();

    var seen = {}, all = [];
    M.openMentors().concat(M.caseSupervisors(me.id)).forEach(function (u) {
      if (seen[u.id]) return;
      seen[u.id] = true;
      if (text) {
        var hay = (tx(u.name) + " " + tx(u.title || {}) + " " + (u.mentorNote || "") + " " +
                   (u.specialties || []).map(function (id) {
                     var sp = M.specialty(id); return sp ? tx(sp) : "";
                   }).join(" ")).toLowerCase();
        if (hay.indexOf(text) === -1) return;
      }
      all.push(u);
    });

    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.status")) + "</h2>" +
      '<div style="margin-top:var(--s-3)">' +
        (standing
          ? '<p class="small">' + Icons.svg("check", "icon-sm") + " " +
            esc(I18N.t("hub.have", { name: tx(standing.name) })) + "</p>"
          : (held
              ? '<p class="small">' + Icons.svg("check", "icon-sm") + " " +
                esc(I18N.t("sup.have",
                  { name: tx((M.user(held.mentorId) || {}).name || "") })) + "</p>"
              : '<p class="small muted">' + esc(I18N.t("hub.none")) + "</p>")) +
      "</div>" +
      (standing ? "" :
        '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
          (call
            ? '<span class="tag">' + esc(I18N.t("call.out")) + "</span>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-call-drop="' +
                esc(call.id) + '">' + esc(I18N.t("call.withdraw")) + "</button>"
            : '<button class="btn btn--outline btn--sm" type="button" data-ask="all">' +
              Icons.svg("send", "icon-sm") + esc(I18N.t("hub.broadcast")) + "</button>") +
        "</div>") +
    "</section>" +

    '<div class="results-bar" style="margin-top:var(--s-6)">' +
      '<label class="field grow"><span class="label">' +
        esc(I18N.t("men.search")) + "</span>" +
        '<input class="input" data-men-search value="' + esc(query) + '" placeholder="' +
          esc(I18N.t("men.searchPlace")) + '"></label></div>' +

    '<p class="small muted" style="margin:var(--s-4) 0">' +
      esc(I18N.t("men.found", { n: I18N.num(all.length) })) + "</p>" +
    (all.length
      ? '<div class="stack gap-4">' + all.map(function (u) {
          return mentorRow(u, me, standing, held, cfg);
        }).join("") + "</div>"
      : C.empty("search", "hub.noMentors"));
  }

  function mentorRow(m, me, standing, held, cfg) {
    var monthly = m.isMentor ? (m.mentorshipFee || 0) : 0;
    var single = m.supervisesCases ? (m.supervisionFee || 0) : 0;
    var net = function (fee) { return Math.round(fee - (fee * cfg.sponsorshipPct) / 100); };
    var pair = null;
    Store.mentorships().forEach(function (x) {
      if (x.mentorId === m.id && x.internId === me.id &&
          (x.status === "pending" || x.status === "active")) pair = x;
    });

    return '<article class="card card--pad" data-mentor-row="' + esc(m.id) + '">' +
      '<div class="row between wrap gap-4">' +
        '<span class="row gap-3">' + C.avatar(m, "md") +
          "<span>" + C.personLink(m) + C.featuredMark(m) +
            '<span class="tiny muted" style="display:block">' + esc(tx(m.title || {})) + "</span>" +
            '<span class="tiny faint" style="display:block">' +
              esc(I18N.t("lawyer.years", { n: I18N.num(m.years || 0) })) +
              (M.superviseeCount(m.id)
                ? " · " + esc(I18N.t("hub.taking", { n: I18N.num(M.superviseeCount(m.id)) }))
                : "") + "</span></span></span>" +
        '<span class="stack gap-1" style="text-align:end">' +
          (monthly
            ? "<strong class=\"small\">" + esc(I18N.t("men.fee", { n: I18N.num(monthly) })) +
              '</strong><span class="tiny faint">' +
              esc(I18N.t("sup.after", { n: I18N.num(net(monthly)) })) + "</span>"
            : "") +
          (single
            ? "<strong class=\"small\">" + esc(I18N.t("sup.fee", { n: I18N.num(single) })) +
              '</strong><span class="tiny faint">' +
              esc(I18N.t("sup.after", { n: I18N.num(net(single)) })) + "</span>"
            : "") +
        "</span></div>" +

      '<div class="row gap-2 wrap" style="margin-top:var(--s-3)">' +
        (m.specialties || []).slice(0, 4).map(function (id) {
          var sp = M.specialty(id);
          return sp ? '<span class="tag">' + esc(tx(sp)) + "</span>" : "";
        }).join("") + "</div>" +

      // The two questions a trainee has to answer before spending anything:
      // how much of this person do I get, and can we ever actually meet.
      (function () {
        var bits = [];
        if (m.mentorHours) bits.push(I18N.t("offer.hoursOn", { n: I18N.num(m.mentorHours) }));
        if (m.mentorMonths) bits.push(I18N.t("offer.monthsOn", { n: I18N.num(m.mentorMonths) }));
        var week = M.mentorWeek(m.id);
        if (!bits.length && !week.length) return "";
        return '<div style="margin-top:var(--s-4)">' +
          (bits.length ? '<p class="small">' + Icons.svg("clock", "icon-sm") + " " +
            esc(bits.join(" · ")) + "</p>" : "") +
          (week.length
            ? '<p class="tiny muted" style="margin-top:var(--s-2)">' +
              esc(I18N.t("week.free")) + " " +
              week.slice(0, 4).map(function (x) {
                return esc(I18N.t(DAYS[x.weekday])) + ' <span class="num" dir="ltr">' +
                  esc(x.from) + "–" + esc(x.to) + "</span>";
              }).join(" · ") +
              (week.length > 4 ? " …" : "") + "</p>"
            : '<p class="tiny faint" style="margin-top:var(--s-2)">' +
              esc(I18N.t("week.unstated")) + "</p>") +
        "</div>";
      })() +

      (m.mentorNote
        ? '<p class="small muted" style="margin-top:var(--s-4);white-space:pre-line">' +
          esc(tx(m.mentorNote)) + "</p>"
        : "") +

      '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
        (pair
          ? '<span class="tag">' +
            esc(I18N.t(pair.status === "active" ? "men.active" : "men.pending")) + "</span>"
          : (standing || !monthly ? ""
              : '<button class="btn btn--primary btn--sm" type="button" data-ask="' +
                esc(m.id) + '">' + Icons.svg("graduation", "icon-sm") +
                esc(I18N.t("hub.ask")) + "</button>")) +
        (!standing && !held && single
          ? '<button class="btn btn--outline btn--sm" type="button" data-buy-sup="' +
            esc(m.id) + '">' + esc(I18N.t("sup.buy")) + "</button>"
          : "") +
        '<a class="btn btn--ghost btn--sm" href="' + esc(M.profileHref(m)) + '">' +
          esc(I18N.t("dir.viewProfile")) + "</a>" +
      "</div></article>";
  }

  /** What this trainee has asked for and not yet been answered on. */
  function sentPanel(me) {
    var waiting = Store.mentorships().filter(function (m) {
      return m.internId === me.id && m.status !== "active";
    });
    var call = M.callOf(me.id);

    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("men.tabSent")) + "</h2>" +
      (waiting.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
          waiting.map(function (m) {
            var who = M.user(m.mentorId);
            return '<div class="row between wrap gap-3 admin-line">' +
              '<span class="row gap-3">' + C.avatar(who, "sm") +
                "<span>" + C.personLink(who) +
                '<span class="tiny muted" style="display:block">' +
                  esc(I18N.t("offer.atFee", { n: I18N.num(m.fee || 0) })) + "</span></span></span>" +
              menState(m, me.id) + "</div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("men.nothingSent")) + "</p>") +
    "</section>" +

    '<section class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h2 class="subtitle">' + esc(I18N.t("call.out")) + "</h2>" +
      (call
        ? '<p class="small muted" style="margin-top:var(--s-3)">' + esc(call.note || "") + "</p>" +
          '<button class="btn btn--ghost btn--sm" style="margin-top:var(--s-3)" type="button" ' +
            'data-call-drop="' + esc(call.id) + '">' + esc(I18N.t("call.withdraw")) + "</button>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("call.none")) + "</p>") + "</section>";
  }

  /* ====================================================== the lawyer ====== */
  function lawyerTabs() {
    return [["mentees", "men.myTrainees"], ["inbox", "offer.inbox"],
            ["calls", "call.inbox"], ["offer", "men.tabOffer"]];
  }

  function menteesPanel(me) {
    var live = Store.mentorships().filter(function (m) {
      return m.mentorId === me.id && m.status === "active";
    });
    if (!live.length) {
      return '<section class="card card--pad">' +
        '<h2 class="subtitle">' + esc(I18N.t("men.myTrainees")) + "</h2>" +
        '<p class="small muted" style="margin-top:var(--s-3);max-width:60ch">' +
          esc(I18N.t("men.noTrainees")) + "</p></section>";
    }
    return live.map(function (m) { return menCard(m, me); }).join("");
  }

  function inboxPanel(me) {
    // Applications only. An invitation this lawyer sent is not theirs to
    // accept — guard_mentorship()'s rule, kept by drawing no button.
    var waiting = Store.mentorships().filter(function (m) {
      return m.mentorId === me.id && m.status === "pending" && m.openedBy === "intern";
    });
    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("offer.inbox")) + "</h2>" +
      (waiting.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
          waiting.map(function (m) {
            var who = M.user(m.internId);
            return '<div class="row between wrap gap-3 admin-line">' +
              '<span class="row gap-3">' + C.avatar(who, "sm") +
                "<span>" + C.personLink(who) +
                '<span class="tiny muted" style="display:block">' +
                  esc(I18N.t("cert.hoursDone", { n: I18N.num(M.hoursOf(m.internId)) })) +
                  " · " + esc(I18N.t("offer.atFee", { n: I18N.num(m.fee || 0) })) +
                "</span></span></span>" +
              '<span class="row gap-2">' +
                '<button class="btn btn--primary btn--sm" type="button" data-men-yes="' +
                  esc(m.id) + '">' + esc(I18N.t("men.accept")) + "</button>" +
                '<button class="btn btn--ghost btn--sm" type="button" data-men-no="' +
                  esc(m.id) + '">' + esc(I18N.t("men.decline")) + "</button></span></div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("offer.noneWaiting")) + "</p>") + "</section>";
  }

  function callsPanel(me) {
    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("call.inbox")) + "</h2>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4);max-width:60ch">' +
        esc(I18N.t("call.inboxLead")) + "</p>" +
      (M.callsFor(me.id).length
        ? C.callInbox(me)
        : '<p class="small muted">' + esc(I18N.t("call.none")) + "</p>") + "</section>";
  }

  /** The offer itself is edited on the account page; this says what it is
      and where to change it, rather than keeping a second copy of the form
      that would drift out of step with the first. */
  /* ---------- everything a lawyer publishes about training ----------
     The prices, how much of them a trainee gets, the terms, and the week
     they are free — on the page where they do the teaching, not buried in
     account settings two clicks away from any of it.

     The bands are the platform's, the same two numbers guard_supervision_fee()
     reads, so a price this form accepts is a price the database accepts. */
  function money(v) {
    var n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
    return isFinite(n) ? Math.round(n) : 0;
  }

  var DAYS = ["day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat"];

  function offerPanel(me) {
    var cfg = M.platformSettings();
    var net = function (fee) { return Math.round(fee - (fee * cfg.sponsorshipPct) / 100); };

    var check = function (name, on, labelKey) {
      return '<label class="row gap-3" style="align-items:flex-start">' +
        '<input type="checkbox" data-offer="' + name + '"' + (on ? " checked" : "") + ">" +
        '<span class="small">' + esc(I18N.t(labelKey)) + "</span></label>";
    };
    var fee = function (name, on, value, labelKey, lo, hi) {
      return '<div data-offer-when="' + name + '"' + (on ? "" : " hidden") + ">" +
        '<label class="field" style="margin-top:var(--s-3)">' +
          '<span class="field__label">' + esc(I18N.t(labelKey)) + "</span>" +
          '<input class="input num" dir="ltr" inputmode="numeric" data-offer="' + name +
            '" value="' + esc(value || "") + '">' +
          '<span class="tiny muted">' +
            esc(I18N.t("offer.band", { lo: I18N.num(lo), hi: I18N.num(hi) })) + "</span></label>" +
        (value ? '<span class="tiny faint">' +
          esc(I18N.t("offer.net", { n: I18N.num(net(value)) })) + "</span>" : "") + "</div>";
    };
    var num = function (name, value, labelKey, hintKey) {
      return '<label class="field">' +
        '<span class="field__label">' + esc(I18N.t(labelKey)) + "</span>" +
        '<input class="input num" dir="ltr" inputmode="numeric" data-offer="' + name +
          '" value="' + esc(value == null ? "" : value) + '">' +
        '<span class="tiny muted">' + esc(I18N.t(hintKey)) + "</span></label>";
    };

    return '<section class="card card--pad" data-offer-card>' +
      '<h2 class="subtitle">' + esc(I18N.t("offer.title")) + "</h2>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-5);max-width:65ch">' +
        esc(I18N.t("offer.lead")) + "</p>" +
      (Session.isVerified() ? "" :
        '<p class="note-inline" style="margin-bottom:var(--s-4)">' +
          esc(I18N.t("offer.pending")) + "</p>") +

      '<div class="grid grid-2" style="gap:var(--s-6)">' +
        "<div>" + check("isMentor", me.isMentor, "offer.monthly") +
          fee("mentorshipFee", me.isMentor, me.mentorshipFee, "offer.monthlyFee",
              cfg.sponsorshipMin, cfg.sponsorshipMax) + "</div>" +
        "<div>" + check("supervisesCases", me.supervisesCases, "offer.byCase") +
          fee("supervisionFee", me.supervisesCases, me.supervisionFee, "offer.caseFee",
              cfg.supervisionMin, cfg.supervisionMax) + "</div>" +
      "</div>" +

      // What a trainee is actually buying. Two numbers rather than a
      // sentence, because a sentence cannot be compared between mentors.
      '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-6)">' +
        num("mentorHours", me.mentorHours, "offer.hours", "offer.hoursHint") +
        num("mentorMonths", me.mentorMonths, "offer.months", "offer.monthsHint") +
      "</div>" +

      '<label class="field" style="margin-top:var(--s-5)">' +
        '<span class="field__label">' + esc(I18N.t("offer.note")) + "</span>" +
        '<textarea class="input" rows="4" data-offer="mentorNote" placeholder="' +
          esc(I18N.t("offer.notePlace")) + '">' + esc(tx(me.mentorNote || "")) +
        "</textarea>" +
        '<span class="tiny faint">' + esc(I18N.t("offer.noteHint")) + "</span></label>" +

      '<p class="tiny" data-offer-error hidden style="margin-top:var(--s-2);color:var(--danger)"></p>' +
      '<button class="btn btn--primary btn--sm" type="button" style="margin-top:var(--s-4)" ' +
        'data-offer-save>' + esc(I18N.t("account.save")) + "</button></section>" +

      weekPanel(me);
  }

  /* ---------- the week ----------
     Windows, not appointments. What this says is when the calendar is open,
     so a trainee can tell whether the two of them can ever meet before they
     pay anything — and so a mentor is not asked for a Sunday morning they
     never offered. */
  function weekPanel(me) {
    var week = M.mentorWeek(me.id);
    var open = M.openHours(me.id);
    var offers = me.isMentor || me.supervisesCases;

    return '<section class="card card--pad" style="margin-top:var(--s-6)" data-week>' +
      '<div class="row between wrap gap-3">' +
        '<h2 class="subtitle">' + esc(I18N.t("week.title")) + "</h2>" +
        (open ? '<span class="tag">' +
          esc(I18N.t("week.open", { n: I18N.num(open) })) + "</span>" : "") +
      "</div>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4);max-width:65ch">' +
        esc(I18N.t("week.lead")) + "</p>" +

      (!offers
        ? '<p class="note-inline">' + esc(I18N.t("week.needOffer")) + "</p>"
        : (week.length
            ? '<div class="stack gap-2">' + week.map(function (x) {
                return '<div class="row between wrap gap-3 admin-line">' +
                  "<span><strong class=\"small\">" +
                    esc(I18N.t(DAYS[x.weekday])) + "</strong>" +
                    ' <span class="num" dir="ltr">' + esc(x.from) + " – " + esc(x.to) +
                  "</span></span>" +
                  '<button class="btn btn--ghost btn--sm" type="button" data-slot-drop="' +
                    esc(x.id) + '">' + Icons.svg("trash", "icon-sm") +
                    esc(I18N.t("week.remove")) + "</button></div>";
              }).join("") + "</div>"
            : '<p class="small muted">' + esc(I18N.t("week.none")) + "</p>") +

          '<div class="row gap-2 wrap" style="margin-top:var(--s-5);align-items:flex-end">' +
            '<label class="field" style="flex:1 1 130px">' +
              '<span class="field__label">' + esc(I18N.t("week.day")) + "</span>" +
              '<select class="select" data-slot-day>' + DAYS.map(function (k, i) {
                return '<option value="' + i + '"' + (i === (draft.day || 0) ? " selected" : "") +
                  ">" + esc(I18N.t(k)) + "</option>";
              }).join("") + "</select></label>" +
            '<label class="field" style="flex:1 1 110px">' +
              '<span class="field__label">' + esc(I18N.t("week.from")) + "</span>" +
              '<input class="input" type="time" dir="ltr" data-slot-from value="' +
                esc(draft.from || "17:00") + '"></label>' +
            '<label class="field" style="flex:1 1 110px">' +
              '<span class="field__label">' + esc(I18N.t("week.to")) + "</span>" +
              '<input class="input" type="time" dir="ltr" data-slot-to value="' +
                esc(draft.to || "19:00") + '"></label>' +
            '<button class="btn btn--outline btn--sm" type="button" data-slot-add>' +
              Icons.svg("plus", "icon-sm") + esc(I18N.t("week.add")) + "</button>" +
          "</div>" +
          '<p class="tiny" data-slot-error hidden style="margin-top:var(--s-2);color:var(--danger)"></p>') +
    "</section>";
  }

  /** Reads the offer form back. Answers with a patch, or a reason it refused. */
  function readOffer() {
    var cfg = M.platformSettings();
    var on = function (name) {
      var el = $('[data-offer="' + name + '"]', host);
      return !!(el && el.checked);
    };
    var val = function (name) {
      var el = $('[data-offer="' + name + '"]', host);
      return el ? el.value : "";
    };
    var patch = { isMentor: on("isMentor"), supervisesCases: on("supervisesCases"),
                  mentorNote: val("mentorNote").trim() || null };

    if (patch.isMentor) {
      patch.mentorshipFee = money(val("mentorshipFee"));
      if (patch.mentorshipFee < cfg.sponsorshipMin || patch.mentorshipFee > cfg.sponsorshipMax) {
        return { error: I18N.t("offer.outOfBand",
          { lo: I18N.num(cfg.sponsorshipMin), hi: I18N.num(cfg.sponsorshipMax) }) };
      }
    }
    if (patch.supervisesCases) {
      patch.supervisionFee = money(val("supervisionFee"));
      if (patch.supervisionFee < cfg.supervisionMin || patch.supervisionFee > cfg.supervisionMax) {
        return { error: I18N.t("offer.outOfBand",
          { lo: I18N.num(cfg.supervisionMin), hi: I18N.num(cfg.supervisionMax) }) };
      }
    }

    // The same two bounds the columns carry, so the form refuses what the
    // database would refuse rather than letting the write fail silently.
    var hours = val("mentorHours").trim();
    var months = val("mentorMonths").trim();
    patch.mentorHours = hours === "" ? null : money(hours);
    patch.mentorMonths = months === "" ? null : money(months);
    if (patch.mentorHours !== null && (patch.mentorHours < 0 || patch.mentorHours > 40)) {
      return { error: I18N.t("offer.hoursRange") };
    }
    if (patch.mentorMonths !== null && (patch.mentorMonths < 1 || patch.mentorMonths > 24)) {
      return { error: I18N.t("offer.monthsRange") };
    }
    return { patch: patch };
  }

  /* ---------- asking, with the price in front of you ---------- */
  function askModal(me) {
    if (!asking) return "";
    var all = asking === "all";
    var m = all ? null : M.user(asking);
    if (!all && !m) return "";
    var cfg = M.platformSettings();
    var fee = m ? (m.mentorshipFee || 0) : 0;

    return '<div class="modal" data-ask-modal>' +
      '<div class="modal__panel" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          "<div><h2 class=\"title\">" +
            esc(I18N.t(all ? "hub.broadcastTitle" : "hub.askTitle")) + "</h2>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' +
              esc(I18N.t(all ? "hub.broadcastLead" : "hub.askLead",
                         { name: m ? tx(m.name) : "" })) + "</p></div>" +
          '<button class="modal__close" type="button" data-ask-close aria-label="' +
            esc(I18N.t("accept.cancel")) + '">' + Icons.svg("close", "icon-sm") + "</button>" +
        "</div>" +
        (all ? "" :
          '<div class="row between wrap gap-3 admin-line">' +
            "<span>" + esc(I18N.t("men.fee", { n: I18N.num(fee) })) + "</span>" +
            '<span class="tiny faint">' +
              esc(I18N.t("sup.after",
                { n: I18N.num(Math.round(fee - (fee * cfg.sponsorshipPct) / 100)) })) +
            "</span></div>") +
        '<label class="field" style="margin-top:var(--s-5)">' +
          '<span class="field__label">' + esc(I18N.t("hub.say")) + "</span>" +
          '<textarea class="input" rows="3" data-ask-note placeholder="' +
            esc(I18N.t(all ? "call.what" : "hub.sayPlace")) + '">' + esc(askNote) +
          "</textarea></label>" +
        '<p class="tiny" data-ask-error hidden style="margin-top:var(--s-2);color:var(--danger)"></p>' +
        '<p class="tiny faint" style="margin-top:var(--s-3)">' +
          esc(I18N.t(all ? "hub.broadcastNote" : "men.applyHint")) + "</p>" +
        '<div class="modal__foot">' +
          '<button class="btn btn--primary btn--sm" type="button" data-ask-send>' +
            esc(I18N.t(all ? "call.send" : "hub.send")) + "</button>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-ask-close>' +
            esc(I18N.t("accept.cancel")) + "</button>" +
        "</div></div></div>";
  }

  /* ====================================================== draw =========== */
  function guest() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", "men.signedOut") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="login.html" data-i18n="nav.login"></a></p></div>';
  }

  function notForYou() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("graduation", "men.notForYou") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--primary" href="requests.html" data-i18n="men.toRequests"></a></p></div>';
  }

  App.onRender(function () {
    if (Session.isGuest()) { host.innerHTML = guest(); I18N.apply(host); return; }
    var me = Session.user();
    var isIntern = Session.is("intern");
    var isLawyer = Session.is("lawyer");
    if (!isIntern && !isLawyer) { host.innerHTML = notForYou(); I18N.apply(host); return; }

    var tabs = isIntern ? traineeTabs() : lawyerTabs();
    var allowed = tabs.map(function (t) { return t[0]; });
    if (allowed.indexOf(tab) === -1) tab = allowed[0];

    var body = isIntern
      ? (tab === "find" ? findPanel(me) : tab === "sent" ? sentPanel(me) : spacePanel(me))
      : (tab === "inbox" ? inboxPanel(me) : tab === "calls" ? callsPanel(me)
         : tab === "offer" ? offerPanel(me) : menteesPanel(me));

    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline">' + esc(I18N.t("men.pageTitle")) + "</h1>" +
        '<p class="lead">' +
          esc(I18N.t(isIntern ? "men.pageLeadIntern" : "men.pageLeadMentor")) + "</p></header>" +

      '<div class="tabs" role="tablist">' + tabs.map(function (t) {
        return '<button class="tab' + (tab === t[0] ? " is-active" : "") + '" type="button" ' +
          'role="tab" data-tab="' + t[0] + '">' + esc(I18N.t(t[1])) + "</button>";
      }).join("") + "</div>" +
      '<div style="margin-top:var(--s-6)">' + body + "</div></div>" +
      askModal(me);

    I18N.apply(host);
    C.threadDraw(host);
    var note = $("[data-ask-note]", host);
    if (note) note.focus();
    var box = $("[data-men-search]", host);
    if (box && query) { box.focus(); box.setSelectionRange(query.length, query.length); }
  });

  /* ====================================================== events =========
     The room borrows the case thread's wiring whole: attaching, the queue of
     chosen files, the size limit and the voice note are the same behaviour
     and should not be two implementations of it. */
  C.wireThread(host);

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || !asking) return;
    asking = null; askNote = ""; App.rerender();
  });

  // Ticking an offer opens its price straight away. Not on the next save,
  // which would mean ticking a box, saving nothing, and being told 0 is
  // outside the band.
  host.addEventListener("change", function (ev) {
    var box = ev.target.closest('[data-offer="isMentor"], [data-offer="supervisesCases"]');
    if (!box) return;
    var slot = $('[data-offer-when="' +
      (box.getAttribute("data-offer") === "isMentor" ? "mentorshipFee" : "supervisionFee") +
      '"]', host);
    if (slot) slot.hidden = !box.checked;
  });

  host.addEventListener("input", function (ev) {
    var box = ev.target.closest("[data-men-search]");
    if (!box) return;
    query = box.value;
    clearTimeout(box._t);
    box._t = setTimeout(function () { App.rerender(); }, 250);
  });

  /* The room and the calendar, both forms, both scoped to the one they are
     inside — a mentor with two trainees has two of each on screen. */
  host.addEventListener("submit", function (ev) {
    var cal = ev.target.closest("[data-session-form]");
    if (!cal) return;
    ev.preventDefault();
    var title = (($("[data-session-title]", cal) || {}).value || "").trim();
    var when = ($("[data-session-when]", cal) || {}).value || "";
    var hours = +(($("[data-session-hours]", cal) || {}).value || 1);
    if (!title || !when) { App.toast(I18N.t("men.sessionNeed"), "alert"); return; }
    var m = Store.mentorship(cal.getAttribute("data-session-form"));
    if (!m) return;
    Store.addSession({ mentorshipId: m.id, mentorId: m.mentorId, title: title,
                       startsAt: new Date(when).toISOString(), hours: hours,
                       kind: "training", attended: false });
    App.rerender();
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (attr) {
      var el = t.closest("[" + attr + "]");
      return el ? el.getAttribute(attr) : null;
    };
    var me = Session.user();

    var tb = hit("data-tab");
    if (tb) { tab = tb; App.rerender(); return; }
    var go = hit("data-go");
    if (go) { tab = go; App.rerender(); return; }

    /* --- asking --- */
    var ask = hit("data-ask");
    if (ask) { asking = ask; askNote = ""; App.rerender(); return; }
    if (t.closest("[data-ask-close]") || t.matches("[data-ask-modal]")) {
      asking = null; askNote = ""; App.rerender();
      return;
    }
    if (t.closest("[data-ask-send]")) {
      var box = $("[data-ask-note]", host);
      askNote = box ? box.value : "";
      var err = $("[data-ask-error]", host);
      var say = function (key) { if (err) { err.hidden = false; err.textContent = I18N.t(key); } };

      if (asking === "all") {
        if (askNote.trim().length < 5) { say("call.need"); return; }
        var out = Store.callForMentor(askNote.trim(), null);
        if (out !== "sent") { say(out === "already supervised" ? "men.haveOne" : "call.need"); return; }
        App.toast(I18N.t("call.sent"), "check");
      } else {
        var word = Store.applyForMentorship(asking);
        if (word !== "sent") { say(SAID[word] || "men.notOffered"); return; }
        App.toast(I18N.t("men.sent"), "check");
      }
      asking = null; askNote = "";
      App.rerender();
      return;
    }

    /* --- answering --- */
    var my = hit("data-men-yes");
    if (my) {
      Store.setMentorship(my, { status: "active" });
      App.toast(I18N.t("men.accepted"), "check");
      App.rerender();
      return;
    }
    var mn = hit("data-men-no");
    if (mn) {
      Store.setMentorship(mn, { status: "declined" });
      App.toast(I18N.t("men.declinedIt"), "alert");
      App.rerender();
      return;
    }
    var men = hit("data-men-end");
    if (men) { Store.setMentorship(men, { status: "ended" }); App.rerender(); return; }
    var mp = hit("data-men-pay");
    if (mp) {
      Store.chargeSponsorship(mp, function (word) {
        App.toast(I18N.t(word === "paid" ? "men.paid" : "men.unpaid"),
                  word === "paid" ? "check" : "alert");
        App.rerender();
      });
      return;
    }
    var at = hit("data-men-attended");
    if (at) { Store.setSession(at, { attended: true }); App.rerender(); return; }

    /* --- the open call --- */
    var cd = hit("data-call-drop");
    if (cd) { Store.withdrawCall(cd); App.rerender(); return; }
    var ca = hit("data-call-answer");
    if (ca) {
      var forWhom = t.closest("[data-call-intern]").getAttribute("data-call-intern");
      Store.openMentorship({ mentorId: me.id, internId: forWhom, openedBy: "mentor",
                             fee: (me.mentorshipFee || 0), inviteId: ca });
      App.toast(I18N.t("men.invited"), "check");
      App.rerender();
      return;
    }

    /* --- publishing the offer --- */
    if (t.closest("[data-offer-save]")) {
      var read = readOffer();
      var oerr = $("[data-offer-error]", host);
      if (read.error) {
        if (oerr) { oerr.textContent = read.error; oerr.hidden = false; }
        return;
      }
      Store.updateAccount(me.id, read.patch);
      App.toast(I18N.t("offer.saved"), "check");
      App.rerender();
      return;
    }

    /* --- the week --- */
    if (t.closest("[data-slot-add]")) {
      draft.day = +(($("[data-slot-day]", host) || {}).value || 0);
      draft.from = ($("[data-slot-from]", host) || {}).value || "";
      draft.to = ($("[data-slot-to]", host) || {}).value || "";
      var serr = $("[data-slot-error]", host);
      var fail = function (key) { if (serr) { serr.textContent = I18N.t(key); serr.hidden = false; } };
      if (!draft.from || !draft.to) { fail("week.needBoth"); return; }
      var word = Store.addSlot(draft.day, draft.from, draft.to);
      var says = { backwards: "week.backwards", already: "week.already",
                   "not offering": "week.needOffer" };
      if (word !== "added") { fail(says[word] || "week.needBoth"); return; }
      App.toast(I18N.t("week.added"), "check");
      App.rerender();
      return;
    }
    var sd = hit("data-slot-drop");
    if (sd) { Store.removeSlot(sd); App.rerender(); return; }

    /* --- one signature, bought --- */
    var bs = hit("data-buy-sup");
    if (bs) {
      Store.buySupervision(bs, function (out) {
        var words = { bought: "sup.bought", "already supervised": "sup.alreadySupervised",
                      "already bought": "sup.alreadyBought", "not offered": "sup.notOffered" };
        App.toast(I18N.t(words[out] || "sup.notOffered"), out === "bought" ? "check" : "alert");
        App.rerender();
      });
      return;
    }
  });
});
