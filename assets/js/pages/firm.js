/* ==========================================================================
   A law firm's page, and the place a lawyer starts one.

   A directory of people cannot hold a partnership: a firm has a licence of
   its own, a team that comes and goes, and a listing that is a subscription
   rather than a profile. So it gets its own page rather than a section on
   somebody's.

   Two views out of one file, decided by ?id:
     firm.html            — your firms, the invitations waiting on you, and
                            the form that starts one
     firm.html?id=…       — the firm itself

   What it never does is put somebody on a team on their behalf. An invitation
   is an invitation both here and in guard_firm_member(): the firm writes the
   row, and only the person named may turn it into membership.
   ========================================================================== */
Pages.define("firm", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-firm-page]");
  if (!host) return;

  var id = App.param("id");
  var draft = { name: "", city: "", bio: "" };

  var ROLE_KEY = { owner: "firm.owner", partner: "firm.rolePartner",
                   associate: "firm.roleAssociate", trainee: "firm.roleTrainee" };

  function me() { return Session.user(); }
  function mine(f) { return !!(f && me() && f.ownerId === me().id); }

  /* ---------- the firm itself ---------- */
  function memberRow(x, owner) {
    return '<div class="row between wrap gap-3 admin-line">' +
      '<span class="row gap-3">' + C.avatar(x.user, "sm") +
        "<span>" + C.personLink(x.user) +
        '<span class="tiny muted" style="display:block">' +
          esc(I18N.t(ROLE_KEY[x.member.role] || "firm.roleAssociate")) +
          (x.member.title ? " · " + esc(tx(x.member.title)) : "") + "</span></span></span>" +
      (owner && x.member.status === "invited"
        ? '<span class="tag">' + esc(I18N.t("firm.pending")) + "</span>" : "") +
    "</div>";
  }

  function inviteBox(f) {
    return '<section class="card card--pad" style="margin-top:var(--s-6)" data-firm-invite>' +
      '<h2 class="subtitle">' + esc(I18N.t("firm.inviteTitle")) + "</h2>" +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4);max-width:60ch">' +
        esc(I18N.t("firm.inviteLead")) + "</p>" +
      '<div class="row gap-3 wrap">' +
        '<input class="input grow" data-invite-who placeholder="' +
          esc(I18N.t("firm.invitePlace")) + '">' +
        '<select class="select" data-invite-role>' +
          ["partner", "associate", "trainee"].map(function (r) {
            return '<option value="' + r + '">' + esc(I18N.t(ROLE_KEY[r])) + "</option>";
          }).join("") + "</select>" +
        '<button class="btn btn--primary btn--sm" type="button" data-invite-send="' +
          esc(f.id) + '">' + Icons.svg("send", "icon-sm") +
          esc(I18N.t("firm.invite")) + "</button>" +
      "</div></section>";
  }

  function editBox(f) {
    return '<section class="card card--pad" style="margin-top:var(--s-6)" data-firm-edit>' +
      '<h2 class="subtitle">' + esc(I18N.t("firm.manage")) + "</h2>" +
      '<label class="field" style="margin-top:var(--s-4)">' +
        '<span class="field__label">' + esc(I18N.t("firm.name")) + "</span>" +
        '<input class="input" data-firm-name value="' + esc(f.name || "") + '"></label>' +
      '<label class="field" style="margin-top:var(--s-3)">' +
        '<span class="field__label">' + esc(I18N.t("firm.city")) + "</span>" +
        cityPicker(f.city) + "</label>" +
      '<label class="field" style="margin-top:var(--s-3)">' +
        '<span class="field__label">' + esc(I18N.t("firm.bio")) + "</span>" +
        '<textarea class="input" rows="3" data-firm-bio>' + esc(f.bio || "") +
        "</textarea></label>" +
      '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-4)" type="button" ' +
        'data-firm-save="' + esc(f.id) + '">' + esc(I18N.t("account.save")) + "</button></section>";
  }

  function cityPicker(value) {
    return '<select class="select" data-firm-city>' +
      '<option value="">' + esc(I18N.t("dir.anyCity")) + "</option>" +
      (global.SEED.cities || []).map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === value ? " selected" : "") + ">" +
          esc(tx(c)) + "</option>";
      }).join("") + "</select>";
  }

  function firmView(f) {
    var owner = mine(f);
    var team = M.roster(f.id);
    var city = f.city ? M.city(f.city) : null;
    // Invited members are the owner's business and nobody else's — a page
    // that lists who was asked is a page that says who said no.
    var asked = owner
      ? ((Store.firmMembers && Store.firmMembers()) || []).filter(function (m) {
          return m.firmId === f.id && m.status === "invited";
        }).map(function (m) { return { member: m, user: M.user(m.profileId) }; })
         .filter(function (x) { return !!x.user; })
      : [];

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:900px">' +
      '<header class="card card--pad">' +
        '<div class="row between wrap gap-4">' +
          "<div>" +
            '<h1 class="headline row gap-3 wrap">' + esc(f.name || "") +
              '<span class="tag">' + esc(I18N.t("firm.badge")) + "</span></h1>" +
            '<p class="tiny muted num" dir="ltr">' + esc(f.ref || "") + "</p>" +
            (city ? '<p class="small muted row gap-1" style="margin-top:var(--s-2)">' +
              Icons.svg("location", "icon-sm") + esc(tx(city)) + "</p>" : "") +
          "</div>" +
          (owner && !M.firmListed(f)
            ? '<span class="note-inline">' +
              esc(I18N.t(f.status === "verified" ? "firm.notListed" : "firm.pending")) + "</span>"
            : "") +
        "</div>" +
        (f.bio ? '<p class="lead" style="margin-top:var(--s-5)">' + esc(f.bio) + "</p>" : "") +
      "</header>" +

      '<section style="margin-top:var(--s-8)">' +
        '<h2 class="subtitle">' + esc(I18N.t("firm.team")) + "</h2>" +
        (team.length
          ? '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
            team.map(function (x) { return memberRow(x, owner); }).join("") + "</div>"
          : '<p class="small muted" style="margin-top:var(--s-3)">' +
            esc(I18N.t("firm.noTeam")) + "</p>") +
      "</section>" +

      (asked.length
        ? '<section style="margin-top:var(--s-8)">' +
          '<h2 class="subtitle">' + esc(I18N.t("firm.pendingMembers")) + "</h2>" +
          '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
            asked.map(function (x) { return memberRow(x, true); }).join("") + "</div></section>"
        : "") +

      (owner ? editBox(f) + inviteBox(f) : "") +
    "</div>";
  }

  /* ---------- your firms, and the invitations waiting on you ---------- */
  function invitations() {
    var u = me();
    if (!u) return "";
    var rows = ((Store.firmMembers && Store.firmMembers()) || []).filter(function (m) {
      return m.profileId === u.id && m.status === "invited";
    });
    if (!rows.length) return "";
    return '<section class="card card--pad" style="margin-top:var(--s-6)" data-firm-invites>' +
      '<h2 class="subtitle">' + esc(I18N.t("firm.invitedTitle")) + "</h2>" +
      '<div class="stack gap-3" style="margin-top:var(--s-4)">' +
        rows.map(function (m) {
          var f = M.firm(m.firmId);
          if (!f) return "";
          return '<div class="row between wrap gap-3 admin-line">' +
            "<span>" + esc(I18N.t("firm.invitedBy", { name: f.name || "" })) +
              '<span class="tiny muted" style="display:block">' +
                esc(I18N.t(ROLE_KEY[m.role] || "firm.roleAssociate")) + "</span></span>" +
            '<span class="row gap-2">' +
              '<button class="btn btn--primary btn--sm" type="button" data-firm-yes="' +
                esc(f.id) + '">' + esc(I18N.t("firm.join")) + "</button>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-firm-no="' +
                esc(f.id) + '">' + esc(I18N.t("firm.declineInvite")) + "</button>" +
            "</span></div>";
        }).join("") + "</div></section>";
  }

  function createBox() {
    if (!Session.is("lawyer")) {
      return '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        '<p class="small muted">' + esc(I18N.t("firm.lawyersOnly")) + "</p></section>";
    }
    return '<section class="card card--pad" style="margin-top:var(--s-6)" data-firm-create>' +
      '<h2 class="subtitle">' + esc(I18N.t("firm.createTitle")) + "</h2>" +
      '<label class="field" style="margin-top:var(--s-4)">' +
        '<span class="field__label">' + esc(I18N.t("firm.name")) + "</span>" +
        '<input class="input" data-new-name value="' + esc(draft.name) + '" placeholder="' +
          esc(I18N.t("firm.namePlace")) + '"></label>' +
      '<label class="field" style="margin-top:var(--s-3)">' +
        '<span class="field__label">' + esc(I18N.t("firm.city")) + "</span>" +
        '<select class="select" data-new-city>' +
          '<option value="">' + esc(I18N.t("dir.anyCity")) + "</option>" +
          (global.SEED.cities || []).map(function (c) {
            return '<option value="' + esc(c.id) + '"' +
              (c.id === draft.city ? " selected" : "") + ">" + esc(tx(c)) + "</option>";
          }).join("") + "</select></label>" +
      '<label class="field" style="margin-top:var(--s-3)">' +
        '<span class="field__label">' + esc(I18N.t("firm.bio")) + "</span>" +
        '<textarea class="input" rows="3" data-new-bio placeholder="' +
          esc(I18N.t("firm.bioPlace")) + '">' + esc(draft.bio) + "</textarea></label>" +
      '<p class="tiny" data-firm-error hidden style="margin-top:var(--s-2);color:var(--danger)"></p>' +
      '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-4)" type="button" ' +
        'data-firm-new>' + esc(I18N.t("firm.create")) + "</button></section>";
  }

  function mineView() {
    var u = me();
    var list = u ? M.firmsOf(u.id) : [];
    return '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:900px">' +
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline">' + esc(I18N.t("firm.mineTitle")) + "</h1>" +
        '<p class="lead">' + esc(I18N.t("firm.mineLead")) + "</p></header>" +
      (list.length
        ? '<div class="stack gap-4">' + list.map(function (x) {
            return '<div class="row between wrap gap-3 admin-line">' +
              "<span><strong>" + esc(x.firm.name || "") + "</strong>" +
                '<span class="tiny muted" style="display:block">' +
                  esc(I18N.t(ROLE_KEY[x.role] || "firm.roleAssociate")) + " · " +
                  esc(I18N.t(M.firmListed(x.firm) ? "firm.badge" :
                    (x.firm.status === "verified" ? "firm.notListed" : "firm.pending"))) +
                "</span></span>" +
              '<a class="btn btn--outline btn--sm" href="firm.html?id=' + esc(x.firm.id) + '">' +
                esc(I18N.t("firm.open")) + "</a></div>";
          }).join("") + "</div>"
        : '<p class="small muted">' + esc(I18N.t("firm.none")) + "</p>") +
      invitations() +
      (list.length ? "" : createBox()) +
    "</div>";
  }

  App.onRender(function () {
    if (id) {
      var f = M.firm(id);
      // Unlisted is not the same as absent. What may be read here is what
      // the firms policy lets through: a verified firm — listed or not — is
      // public, and one still waiting on the desk belongs to its owner and
      // the desk alone.
      var visible = f && (f.status === "verified" || mine(f) || Session.is("staff"));
      host.innerHTML = visible ? firmView(f) :
        '<div class="container" style="padding-block:var(--s-16)">' +
          C.empty("search", "firm.notFound") +
          '<p class="center" style="margin-top:var(--s-6)">' +
            '<a class="btn btn--primary" href="lawyers.html">' +
              esc(I18N.t("dir.tabFirms")) + "</a></p></div>";
    } else if (Session.isGuest()) {
      host.innerHTML = '<div class="container" style="padding-block:var(--s-16)">' +
        C.empty("lock", "account.guest") +
        '<p class="center" style="margin-top:var(--s-6)">' +
          '<a class="btn btn--primary" href="login.html" data-i18n="nav.login"></a></p></div>';
    } else {
      host.innerHTML = mineView();
    }
    I18N.apply(host);
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (attr) {
      var el = t.closest("[" + attr + "]");
      return el ? el.getAttribute(attr) : null;
    };

    if (t.closest("[data-firm-new]")) {
      draft.name = ($("[data-new-name]", host) || {}).value || "";
      draft.city = ($("[data-new-city]", host) || {}).value || "";
      draft.bio = ($("[data-new-bio]", host) || {}).value || "";
      var err = $("[data-firm-error]", host);
      if (!draft.name.trim()) {
        if (err) { err.textContent = I18N.t("firm.needName"); err.hidden = false; }
        return;
      }
      Store.addFirm({ ownerId: me().id, name: draft.name.trim(),
                      city: draft.city || null, bio: draft.bio.trim() || null },
        function (made) { App.go("firm.html?id=" + made.id); });
      draft = { name: "", city: "", bio: "" };
      App.toast(I18N.t("firm.created"), "check");
      App.rerender();
      return;
    }

    var save = hit("data-firm-save");
    if (save) {
      Store.setFirm(save, {
        name: (($("[data-firm-name]", host) || {}).value || "").trim(),
        city: ($("[data-firm-city]", host) || {}).value || null,
        bio: (($("[data-firm-bio]", host) || {}).value || "").trim() || null
      });
      App.toast(I18N.t("firm.saved"), "check");
      App.rerender();
      return;
    }

    var send = hit("data-invite-send");
    if (send) {
      var who = (($("[data-invite-who]", host) || {}).value || "").trim();
      var role = ($("[data-invite-role]", host) || {}).value || "associate";
      if (!who) return;
      if (!M.user(who)) { App.toast(I18N.t("firm.inviteNotFound"), "alert"); return; }
      var word = Store.inviteToFirm(send, who, role);
      var say = { sent: "firm.inviteSent", already: "firm.inviteAlready",
                  "not yours": "firm.inviteNotYours" };
      App.toast(I18N.t(say[word] || "firm.inviteSent"), word === "sent" ? "check" : "alert");
      App.rerender();
      return;
    }

    var yes = hit("data-firm-yes"), no = hit("data-firm-no");
    if (yes || no) {
      Store.answerFirm(yes || no, !!yes);
      App.toast(I18N.t(yes ? "firm.joined" : "firm.declinedInvite"), yes ? "check" : "alert");
      App.rerender();
    }
  });
});
