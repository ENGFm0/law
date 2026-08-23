/* ==========================================================================
   A trainee's page — its own template. No price list and no licence: what a
   trainee has to show is skills, logged hours, and the lawyers who vouched.

   The certificate button appears only for a lawyer who actually supervised
   them, and only once the hours threshold is met.
   ========================================================================== */
Pages.define("intern", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-profile]");
  if (!host) return;

  // No ?id means your own page. A trainee's workspace and a trainee's public
  // profile are the same record read by different people, so this is one page
  // with two tabs the owner alone can see rather than a second address that
  // would drift out of step with the first.
  var id = App.param("id") || (Session.user() ? Session.user().id : null);
  var tab = "skills";
  var deal = { kind: "cases", amount: "", cases: "" };   // the form being filled
  var started = false;    // has the reader chosen a tab, or is this the first draw
  var asking = null;      // the mentor being asked, or "all" for the open call
  var askNote = "";       // what the trainee wrote in the modal

  /** Whose page is this, and is the person reading it the trainee themselves? */
  function isMine(u) {
    var me = Session.user();
    return !!(me && u && me.id === u.id && Session.is("intern"));
  }

  /** Pay is between the two parties, so the tab only exists for them. */
  function canSeePay(u) {
    var me = Session.user();
    if (!me) return false;
    return Session.is("lawyer") || me.id === u.id;
  }

  function tabsFor(u) {
    var t = [["skills", "profile.tabSkills"], ["cert", "profile.tabCert"]];
    // The two workspace tabs are the trainee's own and nobody else's — a
    // client reading a profile has no business in somebody's task queue, and
    // a lawyer looking at a candidate has no business in their fee decisions.
    if (isMine(u)) {
      t = [["hub", "hub.tab"], ["mentors", "hub.tabMentors"]].concat(t);
    }
    if (canSeePay(u)) t.push(["pay", "pay.tab"]);
    return t.concat([["reviews", "profile.tabReviews"], ["articles", "profile.tabArticles"]]);
  }

  function head(u) {
    // Same rule as a lawyer's page: the league table is for the profession.
    var rank = (Session.is("lawyer") || Session.is("intern"))
      ? M.rankOf(u.id, "intern") : { rank: null };
    var prog = M.certProgress(u.id);
    return '<header class="card card--pad" style="margin-bottom:var(--s-8)">' +
      '<div class="row gap-6 wrap" style="align-items:flex-start">' +
        C.avatar(u, "lg") +
        '<div class="grow" style="min-width:0">' +
          '<h1 class="headline row gap-3 wrap">' + esc(tx(u.name)) +
            (M.endorsementsFor(u.id).length
              ? '<span class="verified" data-i18n-attr="title:cert.holder">' +
                Icons.svg("badge", "icon-sm") + "</span>" : "") + "</h1>" +
          '<p class="lead">' + esc(tx(u.university || {})) +
            (u.level ? " · " + esc(tx(u.level)) : "") + "</p>" +
          '<div class="meta-row" style="margin-top:var(--s-4)">' +
            C.ratingLine(u.id) +
            '<span class="dot"></span><span class="muted">' +
              esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + "</span>" +
            (rank.rank ? '<span class="dot"></span><span class="muted">' + esc(I18N.t("profile.rank")) +
              ' <span class="num">' + I18N.num(rank.rank) + "/" + I18N.num(rank.of) + "</span></span>" : "") +
          "</div>" +
          // Who signs for them, and where they practise. Both are facts a
          // client and a supervising lawyer read before anything else — and
          // both are shown only where the platform can stand behind them:
          // the standing mentor, and a firm that is actually listed.
          (function () {
            var mentor = M.mentorOf(u.id);
            var at = M.firmsOf(u.id).filter(function (x) { return M.firmListed(x.firm); });
            if (!mentor && !at.length) return "";
            return '<p class="small muted row gap-2 wrap" style="margin-top:var(--s-3)">' +
              (mentor
                ? "<span>" + Icons.svg("shield-check", "icon-sm") + " " +
                  esc(I18N.t("cert.under", { name: tx(mentor.name) })) + "</span>"
                : "") +
              (mentor && at.length ? '<span class="dot"></span>' : "") +
              at.map(function (x) {
                return '<a href="firm.html?id=' + esc(x.firm.id) + '">' +
                  esc(x.firm.name || "") + "</a>";
              }).join('<span class="dot"></span>') + "</p>";
          })() +
          '<div style="margin-top:var(--s-5);max-width:420px">' + C.progressBar(prog.pct) + "</div>" +
        "</div>" +
      "</div></header>";
  }

  function skillsPanel(u) {
    var list = u.skills || [];
    if (!list.length) return '<p class="small muted" data-i18n="profile.noSkills"></p>';
    return '<div class="row gap-2 wrap">' + list.map(function (s) {
      return '<span class="chip is-active">' + esc(tx(s)) + "</span>";
    }).join("") + "</div>" +
      (u.bio ? '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="profile.bio"></h2>' +
        '<p class="lead" style="margin-top:var(--s-3)">' + esc(tx(u.bio)) + "</p>" : "");
  }

  /** Hours, endorsements, and — for the supervising lawyer — the issue button. */
  /* ================================================== the mentor directory
     Every way a trainee can end up with somebody answerable for their work,
     on one screen and priced in the open: a month of standing supervision, a
     signature on one case, or a call that reaches every mentor at once.

     Each row shows the lawyer's own figure after the platform's cut as well
     as the price. A trainee about to spend their own money should be able to
     see where it goes. */
  function mentorsPanel(u) {
    var standing = M.mentorOf(u.id);
    var held = M.openOrderOf(u.id);
    var call = M.callOf(u.id);
    var mentors = M.openMentors();
    var byCase = M.caseSupervisors(u.id);
    var cfg = M.platformSettings();

    var state = function () {
      if (standing) {
        return '<p class="small">' + Icons.svg("check", "icon-sm") + " " +
          esc(I18N.t("hub.have", { name: tx(standing.name) })) + "</p>";
      }
      if (held) {
        return '<p class="small">' + Icons.svg("check", "icon-sm") + " " +
          esc(I18N.t("sup.have", { name: tx((M.user(held.mentorId) || {}).name || "") })) +
          '</p><p class="tiny faint" style="margin-top:var(--s-2)">' +
          esc(I18N.t("sup.spend")) + "</p>";
      }
      return '<p class="small muted">' + esc(I18N.t("hub.none")) + "</p>";
    };

    var row = function (m) {
      var monthly = m.isMentor ? (m.mentorshipFee || 0) : 0;
      var single = m.supervisesCases ? (m.supervisionFee || 0) : 0;
      var net = function (fee) {
        return Math.round(fee - (fee * cfg.sponsorshipPct) / 100);
      };
      var pair = null;
      ((Store.mentorships && Store.mentorships()) || []).forEach(function (x) {
        if (x.mentorId === m.id && x.internId === u.id &&
            (x.status === "pending" || x.status === "active")) pair = x;
      });

      return '<article class="card card--pad" data-mentor-row="' + esc(m.id) + '">' +
        '<div class="row between wrap gap-4">' +
          '<span class="row gap-3">' + C.avatar(m, "md") +
            "<span>" + C.personLink(m) + C.featuredMark(m) +
              '<span class="tiny muted" style="display:block">' +
                esc(tx(m.title || {})) + "</span>" +
              '<span class="tiny faint" style="display:block">' +
                esc(I18N.t("lawyer.years", { n: I18N.num(m.years || 0) })) +
                // "supervising 0" is a worse answer than not answering: it
                // reads as a complaint about somebody with room to take you.
                (M.superviseeCount(m.id)
                  ? " · " + esc(I18N.t("hub.taking",
                      { n: I18N.num(M.superviseeCount(m.id)) }))
                  : "") +
              "</span></span></span>" +
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
          "</span>" +
        "</div>" +

        (m.mentorNote
          ? '<p class="small muted" style="margin-top:var(--s-4);white-space:pre-line">' +
            esc(tx(m.mentorNote)) + "</p>"
          : "") +

        '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
          (pair
            ? '<span class="tag">' + esc(I18N.t(pair.status === "active"
                ? "men.active" : "men.pending")) + "</span>"
            : (standing
                ? ""
                : (monthly
                    ? '<button class="btn btn--primary btn--sm" type="button" data-ask="' +
                      esc(m.id) + '">' + Icons.svg("graduation", "icon-sm") +
                      esc(I18N.t("hub.ask")) + "</button>"
                    : ""))) +
          (!standing && !held && single
            ? '<button class="btn btn--outline btn--sm" type="button" data-buy-sup="' +
              esc(m.id) + '">' + esc(I18N.t("sup.buy")) + "</button>"
            : "") +
        "</div></article>";
    };

    // One list, not two: a lawyer may take trainees by the month, sell the
    // signature by the case, or both, and a trainee comparing them wants the
    // whole field rather than the same person filed twice.
    var seen = {}, all = [];
    mentors.concat(byCase).forEach(function (m) {
      if (seen[m.id]) return;
      seen[m.id] = true;
      all.push(m);
    });

    return '<section class="card card--pad">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.status")) + "</h2>" +
      '<div style="margin-top:var(--s-3)">' + state() + "</div>" +
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

    '<h2 class="subtitle" style="margin-top:var(--s-8)">' +
      esc(I18N.t("hub.directory")) + "</h2>" +
    '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4);max-width:65ch">' +
      esc(I18N.t("hub.directoryLead")) + "</p>" +
    (all.length
      ? '<div class="stack gap-4">' + all.map(row).join("") + "</div>"
      : C.empty("search", "hub.noMentors"));
  }

  /* ====================================================== the workspace
     What a supervised trainee actually needs in front of them: who signs for
     them, what is on their desk, when they are due to meet, and how far off
     the certificate is. Everything here is drawn off the same rows the
     mentor's own screen reads, so the two cannot disagree. */
  function hubPanel(u) {
    var mentor = M.mentorOf(u.id);
    var signer = M.signerFor(u.id);
    var prog = M.certProgress(u.id);
    var tasks = M.requestsForIntern(u.id).filter(function (r) {
      var st = M.requestState(r);
      return st.status !== "completed" && st.status !== "cancelled" &&
             st.status !== "refunded";
    });
    var pair = mentor ? Store.mentorshipOf(u.id) : null;
    var meetings = pair
      ? ((Store.sessions && Store.sessions()) || []).filter(function (x) {
          return x.mentorshipId === pair.id;
        })
      : [];

    if (!signer) {
      return '<section class="card card--pad">' +
        '<h2 class="subtitle">' + esc(I18N.t("hub.title")) + "</h2>" +
        '<p class="small muted" style="margin:var(--s-3) 0 var(--s-4);max-width:60ch">' +
          esc(I18N.t("hub.needMentor")) + "</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-go-mentors>' +
          esc(I18N.t("hub.findOne")) + "</button></section>";
    }

    return '<section class="card card--pad card--rule-gold">' +
      '<div class="row between wrap gap-4">' +
        '<span class="row gap-3">' + C.avatar(signer, "md") +
          "<span>" +
            '<span class="tiny muted" style="display:block">' +
              esc(I18N.t(mentor ? "hub.yourMentor" : "hub.yourSigner")) + "</span>" +
            C.personLink(signer) + C.verifiedMark(signer) +
            '<span class="tiny faint" style="display:block">' +
              esc(tx(signer.title || {})) + "</span></span></span>" +
        '<a class="btn btn--outline btn--sm" href="requests.html">' +
          Icons.svg("chat", "icon-sm") + esc(I18N.t("hub.room")) + "</a>" +
      "</div>" +
      (mentor && pair
        ? '<p class="tiny faint" style="margin-top:var(--s-4)">' +
          (pair.paidUntil && pair.paidUntil > Date.now()
            ? esc(I18N.t("men.paidUntil", { d: I18N.date(pair.paidUntil) }))
            : esc(I18N.t("men.unpaid"))) + "</p>"
        : '<p class="tiny faint" style="margin-top:var(--s-4)">' +
          esc(I18N.t("hub.singleOnly")) + "</p>") +
    "</section>" +

    '<section class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.hours")) + "</h2>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)">' +
        esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + " / " +
        '<span class="num">' + I18N.num(prog.needed) + "</span></p>" +
      C.progressBar(prog.pct) +
      '<p class="tiny faint" style="margin-top:var(--s-3)">' +
        esc(I18N.t("cert.remaining",
          { n: I18N.num(Math.max(0, prog.needed - prog.hours)) })) + "</p></section>" +

    '<section style="margin-top:var(--s-8)">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.queue")) + "</h2>" +
      (tasks.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
          tasks.map(function (r) {
            var st = M.requestState(r);
            return '<div class="row between wrap gap-3 admin-line">' +
              "<span><strong class=\"small\">" + esc(tx(r.title)) + "</strong>" +
                '<span class="tiny muted num" dir="ltr" style="display:block">' +
                  esc(r.ref || "") + "</span></span>" +
              '<span class="row gap-3">' + C.statusPill(st.status) +
                '<a class="btn btn--ghost btn--sm" href="requests.html">' +
                  esc(I18N.t("hub.open")) + "</a></span></div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("hub.noTasks")) + "</p>") +
    "</section>" +

    '<section style="margin-top:var(--s-8)">' +
      '<h2 class="subtitle">' + esc(I18N.t("hub.calendar")) + "</h2>" +
      (meetings.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
          meetings.map(function (x) {
            return '<div class="row between wrap gap-3 admin-line">' +
              "<span><strong class=\"small\">" + esc(tx(x.title || "")) + "</strong>" +
                '<span class="tiny muted" style="display:block">' +
                  esc(x.startsAt ? I18N.date(x.startsAt) : "") +
                "</span></span>" +
              '<span class="tag">' +
                esc(I18N.t(x.attended ? "hub.attended" : "hub.booked")) + "</span></div>";
          }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)">' +
          esc(I18N.t("hub.noMeetings")) + "</p>") +
    "</section>";
  }

  /* ---------- asking, with the price in front of you ----------
     A modal rather than an inline form: this is a decision with money on it,
     and the one thing it must never do is take the decision quietly. Both
     routes end in a row somebody else has to answer — nobody is signed up by
     pressing this. */
  function askModal(u) {
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
          '<button class="modal__close" type="button" data-ask-close ' +
            'aria-label="' + esc(I18N.t("accept.cancel")) + '">' +
            Icons.svg("close", "icon-sm") + "</button>" +
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
            esc(I18N.t(all ? "call.what" : "hub.sayPlace")) + '">' +
            esc(askNote) + "</textarea></label>" +
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

  function certPanel(u) {
    var prog = M.certProgress(u.id);
    var given = M.endorsementsFor(u.id);
    var me = Session.user();
    // Only a lawyer who routed work to this trainee may sign for them.
    var supervised = me && Session.is("lawyer") &&
      M.requestsForIntern(u.id).some(function (r) { return r.lawyerId === me.id; });
    var already = me && given.some(function (e) { return e.lawyerId === me.id; });

    return '<div class="card card--pad">' +
      '<h2 class="subtitle" data-i18n="cert.title"></h2>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)">' +
        esc(I18N.t("cert.hoursDone", { n: I18N.num(prog.hours) })) + " / " +
        '<span class="num">' + I18N.num(prog.needed) + "</span></p>" +
      C.progressBar(prog.pct) +
      (supervised && !already
        ? '<div style="margin-top:var(--s-5)">' +
            '<button class="btn btn--accent btn--sm" type="button" data-issue' +
              (prog.eligible ? "" : " disabled") + ' data-i18n="cert.issueCta"></button>' +
            '<p class="tiny muted" style="margin-top:var(--s-2)">' +
              esc(I18N.t("cert.issueHint", { n: I18N.num(prog.needed) })) + "</p></div>"
        : "") +
    "</div>" +

    '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="profile.supervisors"></h2>' +
    (given.length
      ? '<div class="stack gap-4" style="margin-top:var(--s-4)">' + given.map(function (e) {
          var lw = M.user(e.lawyerId);
          return '<article class="testimony">' +
            '<div class="row gap-3">' + C.avatar(lw, "sm") +
              "<span><strong class=\"small\">" + esc(I18N.t("cert.issuedBy")) + " " +
                esc(lw ? tx(lw.name) : "") + "</strong>" +
              '<p class="tiny muted">' + esc(tx(e.date || {})) + " · " +
                esc(I18N.t("cert.hoursShort", { n: I18N.num(e.hours || 0) })) + "</p></span></div>" +
            (e.note ? '<p class="small" style="margin-top:var(--s-3)">' + esc(tx(e.note)) + "</p>" : "") +
          "</article>";
        }).join("") + "</div>"
      : '<p class="small muted" style="margin-top:var(--s-3)" data-i18n="cert.noneYet"></p>');
  }

  /* ---------- pay: a share per task, or terms settled in advance ---------- */
  function payPanel(u) {
    var me = Session.user();
    var mine = Session.is("lawyer") ? M.agreementFor(me.id, u.id) : null;
    var all = M.agreementsOfIntern(u.id);
    var isSelf = me.id === u.id;

    return '<p class="note-inline" data-i18n="pay.onlyParties"></p>' +

      '<div class="card card--pad" style="margin-top:var(--s-6)">' +
        '<div class="row between wrap gap-3">' +
          '<h2 class="subtitle" data-i18n="pay.earned"></h2>' +
          '<strong class="title" style="color:var(--accent)"><span class="num">' +
            I18N.num(M.earnedBy(u.id)) + "</span> " + esc(I18N.t("common.sar")) + "</strong>" +
        "</div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="pay.shareHint"></p></div>' +

      '<h2 class="subtitle" style="margin-top:var(--s-8)" data-i18n="pay.standing"></h2>' +
      (all.length
        ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
            all.map(function (a) { return agreementCard(a, u); }).join("") + "</div>"
        : '<p class="small muted" style="margin-top:var(--s-3)" data-i18n="pay.none"></p>') +

      (Session.is("lawyer") && !mine ? agreementForm(u) : "") +
      (isSelf ? "" : "");
  }

  function kindLabel(kind) {
    return I18N.t("pay.kind" + kind.charAt(0).toUpperCase() + kind.slice(1));
  }

  function agreementCard(a, u) {
    var lawyer = M.user(a.lawyerId);
    var me = Session.user();
    var perKey = a.kind === "cases" ? "pay.perCase" : a.kind === "monthly" ? "pay.perMonth" : "pay.perYear";
    return '<article class="card card--pad card--rule-gold">' +
      '<div class="row between wrap gap-4">' +
        '<div class="row gap-3">' + C.avatar(lawyer, "sm") +
          "<div><strong class=\"small\">" +
            esc(I18N.t("pay.with", { name: lawyer ? tx(lawyer.name) : "" })) + "</strong>" +
            '<p class="tiny muted">' + esc(kindLabel(a.kind)) +
              (a.kind === "cases"
                ? " · " + esc(I18N.t("pay.casesProgress",
                    { done: I18N.num(M.casesDone(a)), total: I18N.num(a.cases) }))
                : "") + "</p></div></div>" +
        '<div class="row gap-4">' +
          '<strong class="title" style="color:var(--accent)"><span class="num">' +
            I18N.num(a.amount) + "</span> " + esc(I18N.t("common.sar")) +
            ' <span class="tiny muted">' + esc(I18N.t(perKey)) + "</span></strong>" +
          (me && me.id === a.lawyerId
            ? '<button class="btn btn--ghost btn--sm" type="button" data-end-deal="' +
              esc(a.internId) + '" data-i18n="pay.end"></button>'
            : "") +
        "</div></div></article>";
  }

  function agreementForm(u) {
    return '<div class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle" data-i18n="pay.newAgreement"></h3>' +
      '<div class="grid grid-3" style="gap:var(--s-4);margin-top:var(--s-5)">' +
        '<label class="field"><span class="label" data-i18n="pay.kind"></span>' +
          '<select class="select" data-deal-kind>' +
            [["cases", "pay.kindCases"], ["monthly", "pay.kindMonthly"], ["yearly", "pay.kindYearly"]]
              .map(function (k) {
                return '<option value="' + k[0] + '"' + (deal.kind === k[0] ? " selected" : "") + ">" +
                  esc(I18N.t(k[1])) + "</option>";
              }).join("") + "</select></label>" +
        '<label class="field"><span class="label" data-i18n="pay.amount"></span>' +
          '<input class="input num" type="number" min="0" dir="ltr" data-deal-amount value="' +
            esc(deal.amount) + '"></label>' +
        (deal.kind === "cases"
          ? '<label class="field"><span class="label" data-i18n="pay.cases"></span>' +
            '<input class="input num" type="number" min="1" dir="ltr" data-deal-cases value="' +
              esc(deal.cases) + '"></label>'
          : "<span></span>") +
      "</div>" +
      '<p class="form-error" data-deal-error hidden></p>' +
      '<button class="btn btn--primary" type="button" style="margin-top:var(--s-5)" ' +
        'data-make-deal data-i18n="pay.create"></button></div>';
  }

  function reviewsPanel(u) {
    var list = M.reviewsFor(u.id).slice().reverse();
    return C.ratingSummary(u.id) +
      (list.length
        ? '<div class="stack gap-4" style="margin-top:var(--s-6)">' +
          list.map(C.reviewCard).join("") + "</div>"
        : "");
  }

  function articlesPanel(u) {
    var list = M.articlesBy(u.id);
    if (!list.length) return '<p class="small muted" data-i18n="profile.noArticles"></p>';
    return '<div class="grid grid-2">' + list.map(C.articleCard).join("") + "</div>";
  }

  App.onRender(function () {
    var u = id ? M.user(id) : null;
    if (!u || u.roles.indexOf("intern") === -1) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("search", "profile.notFound") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="lawyers.html" data-i18n="profile.backToDir"></a></p></div>';
      I18N.apply(host);
      return;
    }

    // A tab can disappear when the viewer changes, so fall back to the first.
    // And on your own page the first is the workspace: a trainee opening this
    // came to see who signs for them and what is on their desk, not to read
    // their own skills back to themselves.
    var allowed = tabsFor(u).map(function (t) { return t[0]; });
    if (!started) { tab = allowed[0]; started = true; }
    if (allowed.indexOf(tab) === -1) tab = allowed[0];

    var body = tab === "hub" ? hubPanel(u)
             : tab === "mentors" ? mentorsPanel(u)
             : tab === "skills" ? skillsPanel(u)
             : tab === "cert" ? certPanel(u)
             : tab === "pay" ? payPanel(u)
             : tab === "reviews" ? reviewsPanel(u)
             : articlesPanel(u);

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20);max-width:940px">' +
      head(u) +
      // The other end of the same relationship the lawyer's page offers: a
      // mentor looking at a trainee can invite them, at the fee they publish.
      (Session.is("lawyer") && Session.user() && Session.user().isMentor
        ? C.mentorCard(Session.user(), Session.user(),
                       { side: "mentor", internId: u.id, link: "requests.html" })
        : "") +
      '<div class="tabs" role="tablist">' + tabsFor(u).map(function (t) {
        return '<button class="tab' + (tab === t[0] ? " is-active" : "") + '" type="button" ' +
          'role="tab" data-tab="' + t[0] + '" data-i18n="' + t[1] + '"></button>';
      }).join("") + "</div>" +
      '<div style="margin-top:var(--s-6)">' + body + "</div></div>" +
      askModal(u);

    I18N.apply(host);
    document.title = tx(u.name) + " | " + I18N.t("brand.name");
    var note = $("[data-ask-note]", host);
    if (note) note.focus();
  });

  /* What the store answers with, said in words the trainee can act on. */
  var MENTOR_SAID = { sent: "men.sent", already: "men.haveOne",
                      "not offered": "men.notOffered", "not signed in": "men.signIn" };

  /** Whatever the modal is currently holding, so a re-render does not eat it. */
  function keepNote() {
    var el = $("[data-ask-note]", host);
    if (el) askNote = el.value;
  }

  // Esc closes the modal. A panel with no way out but the mouse is a panel
  // somebody on a keyboard is stuck inside.
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || !asking) return;
    asking = null; askNote = "";
    App.rerender();
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-tab]");
    if (t) { tab = t.getAttribute("data-tab"); App.rerender(); return; }

    /* --- looking for a supervisor --- */
    var ask = ev.target.closest("[data-ask]");
    if (ask) { asking = ask.getAttribute("data-ask"); askNote = ""; App.rerender(); return; }

    // The backdrop closes it, the panel does not.
    if (ev.target.closest("[data-ask-close]") ||
        (ev.target.matches("[data-ask-modal]"))) {
      asking = null; askNote = ""; App.rerender();
      return;
    }

    if (ev.target.closest("[data-ask-send]")) {
      keepNote();
      var err = $("[data-ask-error]", host);
      var say = function (key) { if (err) { err.hidden = false; err.textContent = I18N.t(key); } };

      if (asking === "all") {
        if (askNote.trim().length < 5) { say("call.need"); return; }
        var out = Store.callForMentor(askNote.trim(), null);
        if (out !== "sent") { say(out === "already supervised" ? "men.haveOne" : "call.need"); return; }
        App.toast(I18N.t("call.sent"), "check");
      } else {
        var word = Store.applyForMentorship(asking);
        if (word !== "sent") {
          say(MENTOR_SAID[word] || "men.notOffered");
          return;
        }
        App.toast(I18N.t("men.sent"), "check");
      }
      asking = null; askNote = "";
      App.rerender();
      return;
    }

    var drop = ev.target.closest("[data-call-drop]");
    if (drop) { Store.withdrawCall(drop.getAttribute("data-call-drop")); App.rerender(); return; }

    var bs = ev.target.closest("[data-buy-sup]");
    if (bs) {
      Store.buySupervision(bs.getAttribute("data-buy-sup"), function (out) {
        var words = { bought: "sup.bought", "already supervised": "sup.alreadySupervised",
                      "already bought": "sup.alreadyBought", "not offered": "sup.notOffered" };
        App.toast(I18N.t(words[out] || "sup.notOffered"), out === "bought" ? "check" : "alert");
        App.rerender();
      });
      return;
    }

    if (ev.target.closest("[data-go-mentors]")) { tab = "mentors"; App.rerender(); return; }

    var inv = ev.target.closest("[data-mentor-invite]");
    if (inv) {
      var word = Store.inviteToMentorship(inv.getAttribute("data-mentor-invite"));
      App.toast(I18N.t(word === "sent" ? "men.invited" : "men.haveOne"),
                word === "sent" ? "check" : "alert");
      App.rerender();
      return;
    }

    if (ev.target.closest("[data-make-deal]")) {
      var u2 = M.user(id);
      var amount = +($("[data-deal-amount]", host) || {}).value;
      var cases = +(($("[data-deal-cases]", host) || {}).value || 0);
      var err = $("[data-deal-error]", host);
      var fail = function (key) { if (err) { err.hidden = false; err.textContent = I18N.t(key); } };
      if (!amount || amount <= 0) { fail("pay.needAmount"); return; }
      if (deal.kind === "cases" && !cases) { fail("pay.needCases"); return; }
      if (err) err.hidden = true;
      Store.addAgreement({ lawyerId: Session.user().id, internId: u2.id,
                           kind: deal.kind, amount: amount, cases: cases });
      deal = { kind: "cases", amount: "", cases: "" };
      App.toast(I18N.t("pay.created", { name: tx(u2.name) }), "check");
      return;
    }

    var endDeal = ev.target.closest("[data-end-deal]");
    if (endDeal) {
      Store.endAgreement(Session.user().id, endDeal.getAttribute("data-end-deal"));
      App.toast(I18N.t("pay.ended"), "close");
      return;
    }

    if (ev.target.closest("[data-issue]")) {
      var u = M.user(id);
      Store.addEndorsement({
        internId: u.id, lawyerId: Session.user().id, hours: M.hoursOf(u.id),
        date: { ar: I18N.t("common.today"), en: I18N.t("common.today") },
        note: null
      });
      App.toast(I18N.t("cert.issuedToast"), "badge");
    }
  });

  host.addEventListener("change", function (ev) {
    var k = ev.target.closest("[data-deal-kind]");
    if (!k) return;
    // Keep what is already typed; only the "cases" field comes and goes.
    deal.kind = k.value;
    deal.amount = ($("[data-deal-amount]", host) || {}).value || "";
    App.rerender();
  });
});
