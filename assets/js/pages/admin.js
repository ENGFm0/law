/* ==========================================================================
   The staff console.

   Six sections behind one page, because running a platform is not one job:
   who is allowed in, what is being asked for, where the money went, what the
   platform is saying to people, and what it charges.

   Two rules shape all of it. Every action is written to a record that is
   appended to and never edited — a decision nobody can be asked about later
   is not a decision. And every figure is derived from the requests that
   actually happened rather than from a running total somebody has to remember
   to update, so the books cannot quietly drift from the work.
   ========================================================================== */
Pages.define("admin", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, $$ = App.$$, esc = App.esc, tx = App.tx;

  var host = $("[data-admin]");
  if (!host) return;

  var TABS = [
    { id: "overview", key: "adm.tabOverview", icon: "grid" },
    { id: "people",   key: "adm.tabPeople",   icon: "user" },
    { id: "requests", key: "adm.tabRequests", icon: "inbox" },
    { id: "money",    key: "adm.tabMoney",    icon: "wallet" },
    { id: "ads",      key: "adm.tabAds",      icon: "bell" },
    { id: "catalogue",key: "admin.tabCat",    icon: "tag" },
    { id: "settings", key: "adm.tabSettings", icon: "settings" }
  ];

  var tab = App.param("tab") || "overview";
  var months = 1;
  var filter = "all";
  var query = "";
  var rejecting = null;
  var openCase = null;      // the request whose whole file is on screen
  var whoFile = null;       // the person whose file is on screen
  var outcome = {};

  var sar = function (halalas) {
    return C.num(Math.round(halalas / 100)) + " " + C.sar();
  };

  function head(titleKey, leadKey) {
    return '<header style="margin-bottom:var(--s-6)">' +
      '<h2 class="subtitle" data-i18n="' + titleKey + '"></h2>' +
      (leadKey ? '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="' +
        leadKey + '"></p>' : "") + "</header>";
  }

  function denied() {
    return '<div class="container" style="padding-block:var(--s-16)">' +
      C.empty("lock", "admin.denied") +
      '<p class="center" style="margin-top:var(--s-6)">' +
        '<a class="btn btn--ghost" href="index.html" data-i18n="nav.home"></a></p></div>';
  }

  /* ================================================================ overview */
  function stat(labelKey, value, tone) {
    return '<div class="kpi' + (tone ? " kpi--" + tone : "") + '">' +
      '<span class="kpi__label" data-i18n="' + labelKey + '"></span>' +
      '<strong class="kpi__value">' + value + "</strong></div>";
  }

  function windowPicker() {
    return '<div class="row gap-2 wrap" style="margin-bottom:var(--s-5)">' +
      '<span class="tiny muted" style="align-self:center" data-i18n="adm.window"></span>' +
      [[1, "adm.month1"], [3, "adm.month3"], [12, "adm.month12"]].map(function (m) {
        return '<button class="btn btn--sm ' + (months === m[0] ? "btn--primary" : "btn--outline") +
          '" type="button" data-months="' + m[0] + '">' + esc(I18N.t(m[1])) + "</button>";
      }).join("") + "</div>";
  }

  function overview() {
    var b = M.books(months);
    var waiting = M.pendingVerification();
    var open = M.openDisputes();

    return windowPicker() +
      '<div class="kpi-grid">' +
        stat("adm.kpiOrders", C.num(b.orders)) +
        stat("adm.kpiVolume", sar(b.clientPaid)) +
        stat("adm.kpiRevenue", sar(b.revenue)) +
        stat("adm.kpiProfit", sar(b.profit), b.profit < 0 ? "bad" : "good") +
        stat("adm.kpiPending", C.num(waiting.length), waiting.length ? "warn" : "") +
        stat("adm.kpiDisputes", C.num(open.length), open.length ? "warn" : "") +
      "</div>" +

      '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        head("adm.needsYou") +
        (waiting.length || open.length
          ? '<div class="stack gap-3">' +
              waiting.map(function (u) {
                return '<div class="row between wrap gap-3 admin-line">' +
                  '<span class="row gap-3">' + C.avatar(u, "sm") +
                    "<span><strong>" + esc(tx(u.name)) + "</strong>" +
                    '<span class="tiny muted" style="display:block">' +
                      esc(I18N.t(u.roles.indexOf("lawyer") !== -1 ? "role.lawyer" : "role.intern")) +
                    "</span></span></span>" +
                  '<a class="btn btn--outline btn--sm" href="admin.html?tab=people">' +
                    esc(I18N.t("admin.queue")) + "</a></div>";
              }).join("") +
              open.map(function (d) {
                var r = M.request(d.requestId);
                return '<div class="row between wrap gap-3 admin-line">' +
                  "<span><strong>" + esc(r ? tx(r.title) : d.requestId) + "</strong>" +
                  '<span class="tiny muted" style="display:block">' + esc(d.reason) + "</span></span>" +
                  '<a class="btn btn--outline btn--sm" href="admin.html?tab=requests">' +
                    esc(I18N.t("admin.decide")) + "</a></div>";
              }).join("") +
            "</div>"
          : '<p class="small muted" data-i18n="adm.allClear"></p>') +
      "</section>";
  }

  /* ================================================================== people */
  function matches(u) {
    if (filter === "lawyers" && u.roles.indexOf("lawyer") === -1) return false;
    if (filter === "interns" && u.roles.indexOf("intern") === -1) return false;
    if (filter === "clients" && u.roles.indexOf("client") === -1) return false;
    if (filter === "pending" && u.status !== "pending") return false;
    if (!query) return true;
    var q = query.toLowerCase();
    return (tx(u.name) || "").toLowerCase().indexOf(q) !== -1 ||
           (u.email || "").toLowerCase().indexOf(q) !== -1;
  }

  function people() {
    // One name asked about beats a list scrolled through: everything that
    // person has done, in one place, with every request they touched.
    if (whoFile) return personFile(whoFile);

    var all = M.users().filter(function (u) {
      return u.roles.indexOf("staff") === -1;
    }).filter(matches);

    return head("adm.people", "adm.peopleLead") +
      '<div class="row gap-2 wrap" style="margin-bottom:var(--s-4)">' +
        [["all","adm.filterAll"],["pending","adm.filterPending"],["lawyers","adm.filterLawyers"],
         ["interns","adm.filterInterns"],["clients","adm.filterClients"]].map(function (f) {
          return '<button class="btn btn--sm ' + (filter === f[0] ? "btn--primary" : "btn--outline") +
            '" type="button" data-filter="' + f[0] + '">' + esc(I18N.t(f[1])) + "</button>";
        }).join("") +
      "</div>" +
      '<input class="input" style="margin-bottom:var(--s-5)" data-search value="' + esc(query) +
        '" data-i18n-attr="placeholder:adm.search">' +
      (all.length ? all.map(personRow).join("") : '<p class="small muted" data-i18n="adm.noPeople"></p>');
  }

  /* Everything one person has done here. The question the desk actually asks
     is never "what is their status" — it is "what happened with them", and
     that answer was spread across four tabs and a database. */
  function personFile(id) {
    var u = M.user(id);
    if (!u) return head("adm.people") + '<p class="small muted" data-i18n="adm.noPeople"></p>';

    var asClient = M.requests().filter(function (r) { return r.clientId === id; });
    var asLawyer = M.requests().filter(function (r) { return r.lawyerId === id; });
    var asIntern = M.requests().filter(function (r) {
      return M.requestState(r).assignedTo === id;
    });
    var theirs = asClient.concat(asLawyer).concat(asIntern);
    var raised = Store.disputes().filter(function (d) { return d.byId === id; });
    var against = theirs.map(function (r) { return M.disputeFor(r.id); })
      .filter(function (d) { return d && d.byId !== id; });
    var reviews = M.reviewsFor(id);
    var briefs = M.quotesForClient(id);
    var bids = (Store.offers ? Store.offers() : []).filter(function (o) { return o.lawyer === id; });
    var rating = M.ratingOf(id);

    var row = function (r) {
      var st = M.requestState(r);
      var d = M.disputeFor(r.id);
      var role = r.clientId === id ? "tl.roleClient"
               : r.lawyerId === id ? "tl.roleLawyer" : "tl.roleIntern";
      return '<div class="row between wrap gap-3 admin-line">' +
        '<span><span class="tiny muted num" dir="ltr">' + esc(M.refOf(r)) + "</span> " +
          "<strong class=\"small\">" + esc(tx(r.title || {})) + "</strong> " +
          '<span class="tag">' + esc(I18N.t(role)) + "</span>" +
          (d ? ' <span class="status status--warn">' + esc(M.refOf(d)) + "</span>" : "") +
        "</span>" +
        '<span class="row gap-3">' + C.statusPill(st.status) + sar(M.distribute(r).client) +
          '<button class="btn btn--ghost btn--sm" type="button" data-case="' + esc(r.id) + '">' +
            esc(I18N.t("adm.openCase")) + "</button></span>" +
      "</div>" +
      (openCase === r.id ? caseFile(r) : "");
    };

    var stat = function (labelKey, value) {
      return '<div class="kpi"><span class="kpi__label">' + esc(I18N.t(labelKey)) + "</span>" +
        '<strong class="kpi__value">' + value + "</strong></div>";
    };

    return '<button class="btn btn--ghost btn--sm" style="margin-bottom:var(--s-4)" ' +
        'type="button" data-back-people>' + esc(I18N.t("adm.backToPeople")) + "</button>" +

      '<section class="card card--pad">' +
        '<div class="row between wrap gap-4">' +
          '<div class="row gap-4">' + C.avatar(u, "md") +
            "<div><h2 class=\"subtitle\">" + esc(tx(u.name)) + "</h2>" +
              '<p class="tiny muted num" dir="ltr">' + esc(u.email || "") +
                (u.phone ? " · " + esc(u.phone) : "") + "</p>" +
              '<p class="tiny muted">' + esc(u.roles.map(function (rr) {
                return I18N.t("role." + rr);
              }).join(" · ")) + "</p></div></div>" +
          C.statusPill(u.status) +
        "</div>" +
        '<div class="kpi-row" style="margin-top:var(--s-5)">' +
          stat("adm.filesTotal", C.num(theirs.length)) +
          stat("adm.filesDisputed", C.num(raised.length + against.length)) +
          stat("adm.filesRating", rating.count ? C.num(rating.avg.toFixed(1)) : "—") +
          stat("adm.filesBriefs", C.num(briefs.length + bids.length)) +
        "</div>" +
      "</section>" +

      '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        '<h3 class="subtitle">' + esc(I18N.t("adm.filesRequests")) + "</h3>" +
        (theirs.length
          ? '<div style="margin-top:var(--s-4)">' + theirs.map(row).join("") + "</div>"
          : '<p class="small muted" style="margin-top:var(--s-3)">' +
            esc(I18N.t("adm.filesNone")) + "</p>") +
      "</section>" +

      (raised.length || against.length
        ? '<section class="card card--pad" style="margin-top:var(--s-6)">' +
            '<h3 class="subtitle">' + esc(I18N.t("adm.filesComplaints")) + "</h3>" +
            '<div style="margin-top:var(--s-4)">' +
            raised.concat(against).map(function (d) {
              var r = M.request(d.requestId);
              return '<div class="row between wrap gap-3 admin-line">' +
                '<span><span class="tiny muted num" dir="ltr">' + esc(M.refOf(d)) + "</span> " +
                  '<span class="small">' + esc(d.reason || "") + "</span></span>" +
                '<span class="row gap-3"><span class="tiny muted">' + esc(C.stamp(d.at)) + "</span>" +
                  '<span class="status status--' + (d.status === "open" ? "warn" : "muted") + '">' +
                    esc(I18N.t(d.status === "open" ? "adm.disputeOpen" : "adm.disputeDone")) +
                  "</span>" +
                  (r ? '<button class="btn btn--ghost btn--sm" type="button" data-case="' +
                    esc(r.id) + '">' + esc(I18N.t("adm.openCase")) + "</button>" : "") +
                "</span></div>" +
                (r && openCase === r.id ? caseFile(r) : "");
            }).join("") + "</div>" +
          "</section>"
        : "") +

      (reviews.length
        ? '<section class="card card--pad" style="margin-top:var(--s-6)">' +
            '<h3 class="subtitle">' + esc(I18N.t("adm.filesReviews")) + "</h3>" +
            '<div style="margin-top:var(--s-4)">' + reviews.map(function (rv) {
              return '<div class="admin-line"><div class="row gap-3">' +
                C.stars(rv.rating) + '<span class="small">' + esc(tx(rv.body || {})) + "</span>" +
              "</div></div>";
            }).join("") + "</div></section>"
        : "");
  }

  function personRow(u) {
    var lawyer = u.roles.indexOf("lawyer") !== -1;
    var intern = u.roles.indexOf("intern") !== -1;
    var pro = lawyer || intern;
    var lic = u.licence;
    var ai = lawyer ? M.subscriptionOf(u.id) : null;
    var placed = u.featuredRank != null;

    return '<div class="card card--pad admin-card">' +
      '<div class="row between wrap gap-3">' +
        '<div class="row gap-3">' + C.avatar(u, "sm") +
          '<div><button class="linklike" type="button" data-person="' + esc(u.id) + '">' +
            "<strong>" + esc(tx(u.name)) + "</strong></button>" +
            '<div class="tiny muted num" dir="ltr">' + esc(u.email || "") + "</div></div></div>" +
        '<div class="row gap-2 wrap">' +
          (placed ? '<span class="status status--ok">' +
            esc(I18N.t("adm.featuredAt", { n: I18N.num(u.featuredRank) })) + "</span>" : "") +
          C.statusPill(u.status) +
        "</div>" +
      "</div>" +

      (pro && lic
        ? '<div class="row gap-6 wrap small" style="margin-top:var(--s-4)">' +
            '<span><span class="tiny muted" data-i18n="admin.licence"></span> ' +
              '<span class="num">' + esc(lic.number || "") + "</span></span>" +
            '<span><span class="tiny muted" data-i18n="admin.expiry"></span> ' +
              esc(lic.expiry || "") + "</span>" +
          "</div>"
        : "") +

      (rejecting === u.id
        ? '<div style="margin-top:var(--s-4)">' +
            '<p class="small" data-i18n="admin.rejectWhy"></p>' +
            '<textarea class="input" rows="3" style="margin-top:var(--s-2)" data-why></textarea>' +
            '<div class="row gap-3" style="margin-top:var(--s-3)">' +
              '<button class="btn btn--primary btn--sm" type="button" data-reject-send="' + esc(u.id) + '">' +
                esc(I18N.t("admin.reject")) + "</button>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-cancel>' +
                esc(I18N.t("accept.cancel")) + "</button></div></div>"
        : '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
            (u.status !== "verified"
              ? '<button class="btn btn--primary btn--sm" type="button" data-approve="' + esc(u.id) + '">' +
                  Icons.svg("check", "icon-sm") + esc(I18N.t("admin.approve")) + "</button>"
              : "") +
            (pro && u.status !== "rejected"
              ? '<button class="btn btn--ghost btn--sm" type="button" data-reject="' + esc(u.id) + '">' +
                  esc(I18N.t("admin.reject")) + "</button>"
              : "") +
            (lawyer && u.status === "verified"
              ? '<button class="btn btn--outline btn--sm" type="button" data-feature="' + esc(u.id) + '">' +
                  Icons.svg("star", "icon-sm") +
                  esc(I18N.t(placed ? "adm.unfeature" : "adm.feature")) + "</button>"
              : "") +
            (lawyer
              ? '<button class="btn btn--outline btn--sm" type="button" data-ai="' + esc(u.id) + '">' +
                  Icons.svg("sparkle", "icon-sm") +
                  esc(I18N.t(ai && ai.active ? "adm.aiOn" : "adm.aiOff")) + "</button>"
              : "") +
          "</div>") +
    "</div>";
  }

  /* ================================================================ requests */
  function requests() {
    var all = M.requests().slice().reverse();
    if (!all.length) return head("adm.requests", "adm.requestsLead") +
      '<p class="small muted" data-i18n="adm.noRequests"></p>';

    return head("adm.requests", "adm.requestsLead") +
      all.map(function (r) {
        var st = M.requestState(r);
        var d = M.distribute(r);
        var client = M.user(r.clientId), lawyer = M.user(r.lawyerId);
        var dis = M.disputeFor(r.id);
        var showing = openCase === r.id;
        return '<div class="card card--pad admin-card' +
          (dis && dis.status === "open" ? " card--rule-gold" : "") + '">' +
          '<div class="row between wrap gap-3">' +
            "<strong>" + esc(tx(r.title || {})) + "</strong>" +
            '<span class="row gap-2">' +
              '<span class="tiny muted num" dir="ltr">' + esc(M.refOf(r)) + "</span>" +
              C.statusPill(st.status) +
              "<strong>" + sar(d.client) + "</strong></span>" +
          "</div>" +
          // Everyone with a part in it, each name a way into their file.
          C.parties(r, { asFile: true }) +
          '<div class="row gap-2 wrap" style="margin-top:var(--s-3)">' +
            '<button class="btn btn--outline btn--sm" type="button" data-case="' + esc(r.id) + '">' +
              Icons.svg("eye", "icon-sm") + esc(I18N.t(showing ? "adm.hideCase" : "adm.openCase")) +
            "</button></div>" +
          (dis && dis.status === "open" ? disputePanel(dis, r, d) : "") +
          (showing ? caseFile(r) : "") +
        "</div>";
      }).join("");
  }

  function choice(id, value, key, pick) {
    return '<button class="btn btn--sm ' + (pick === value ? "btn--primary" : "btn--outline") +
      '" type="button" data-outcome="' + esc(value) + '" data-for="' + esc(id) + '">' +
      esc(I18N.t(key)) + "</button>";
  }

  /* Everything that was said and sent on a case, both threads and the record,
     with nothing left out. This is what deciding an objection needs: not a
     summary of the complaint, but the whole file — including the half the
     client never saw, because the lawyer and the trainee arguing about the
     forum is often exactly where the answer is. */
  function caseFile(r) {
    var st = M.requestState(r);
    return '<div class="admin-case">' +
      '<div class="row between wrap gap-3">' +
        '<h4 class="subtitle">' + esc(I18N.t("tl.everything")) + "</h4>" +
        '<span class="tiny muted num" dir="ltr">' + esc(M.refOf(r)) + "</span>" +
      "</div>" +
      C.parties(r, { asFile: true }) +
      (r.brief && tx(r.brief)
        ? '<p class="tiny muted" style="margin-top:var(--s-4)">' +
          esc(I18N.t("tl.fromClient")) + "</p>" +
          '<p class="small">' + esc(tx(r.brief)) + "</p>"
        : "") +
      (st.body
        ? '<p class="tiny muted" style="margin-top:var(--s-4)" data-i18n="admin.delivered"></p>' +
          '<pre class="draft-text" style="min-height:auto" readonly>' + esc(st.body) + "</pre>"
        : "") +
      C.timeline(r, { internal: true }) +
    "</div>";
  }

  function disputePanel(d, r, split) {
    var st = M.requestState(r);
    var who = M.user(d.byId), pick = outcome[d.id] || "";
    return '<div style="margin-top:var(--s-5);border-top:1px solid var(--border);padding-top:var(--s-5)">' +
      '<div class="row between wrap gap-3">' +
        '<strong class="small num" dir="ltr">' + esc(M.refOf(d)) + "</strong>" +
        '<span class="tiny muted">' + esc(C.stamp(d.at)) + "</span></div>" +
      C.parties(r, { asFile: true }) +
      '<p class="tiny muted" style="margin-top:var(--s-3)">' + esc(I18N.t("admin.raisedBy")) + ": " +
        esc(who ? tx(who.name) : d.byId) + "</p>" +
      '<p class="tiny muted" style="margin-top:var(--s-3)" data-i18n="admin.claim"></p>' +
      '<p class="small">' + esc(d.reason) + "</p>" +
      '<p class="tiny muted" style="margin-top:var(--s-4)" data-i18n="admin.delivered"></p>' +
      (st.body
        ? '<pre class="draft-text" style="min-height:auto" readonly>' + esc(st.body) + "</pre>"
        : '<p class="small muted" data-i18n="admin.nothingDelivered"></p>') +
      (split.intern > 0
        ? '<div class="card card--pad" style="margin-top:var(--s-4);background:var(--surface-2)">' +
            '<p class="small">' + esc(I18N.t("admin.internNote")) + "</p>" +
            '<p class="small" style="margin-top:var(--s-2)"><strong>' +
              esc(I18N.t("admin.internOwed")) + ": " + sar(split.intern) + "</strong></p></div>"
        : "") +
      // The whole file, opened where the decision is made rather than a click
      // away from it.
      caseFile(r) +
      '<h4 class="subtitle" style="margin-top:var(--s-5)" data-i18n="admin.decide"></h4>' +
      '<div class="row gap-3 wrap" style="margin-top:var(--s-3)">' +
        choice(d.id, "release", "admin.forLawyer", pick) +
        choice(d.id, "refund", "admin.forClient", pick) +
        choice(d.id, "split", "admin.split", pick) +
      "</div>" +
      (pick === "split"
        ? '<div style="margin-top:var(--s-3)"><label class="tiny muted" data-i18n="admin.lawyerPct"></label>' +
          '<input class="input" type="number" min="0" max="100" value="60" data-pct></div>'
        : "") +
      (pick
        ? '<div style="margin-top:var(--s-4)">' +
            '<p class="small" data-i18n="admin.reasonLabel"></p>' +
            '<textarea class="input" rows="3" style="margin-top:var(--s-2)" data-why></textarea>' +
            '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-3)" type="button" ' +
              'data-resolve="' + esc(d.id) + '">' + esc(I18N.t("admin.decide")) + "</button></div>"
        : "") +
    "</div>";
  }

  /* =================================================================== money */
  function line(labelKey, value, strong) {
    return '<div class="row between gap-3 admin-line">' +
      '<span class="' + (strong ? "" : "small muted") + '" data-i18n="' + labelKey + '"></span>' +
      "<" + (strong ? "strong" : "span") + ">" + value + "</" + (strong ? "strong" : "span") + "></div>";
  }

  function money() {
    var b = M.books(months);
    var over = b.partners.reduce(function (t, p) { return t + (p.sharePct || 0); }, 0) > 100;

    return head("adm.money", "adm.moneyLead") + windowPicker() +

      '<div class="grid grid-2" style="gap:var(--s-6)">' +
        '<section class="card card--pad">' +
          '<h3 class="subtitle" data-i18n="adm.inflow"></h3>' +
          '<div style="margin-top:var(--s-4)">' +
            line("adm.kpiVolume", sar(b.clientPaid), true) +
            line("adm.commission", sar(b.commission)) +
            line("adm.subs", sar(b.subscriptions)) +
            line("adm.kpiRevenue", sar(b.revenue), true) +
          "</div></section>" +

        '<section class="card card--pad">' +
          '<h3 class="subtitle" data-i18n="adm.outflow"></h3>' +
          '<div style="margin-top:var(--s-4)">' +
            line("adm.toLawyers", sar(b.toLawyers)) +
            line("adm.toTrainees", sar(b.toTrainees)) +
            // What went back to clients. It used to be invisible here: a
            // fully refunded order still read as revenue, commission and all.
            (b.refunded ? line("adm.refunded", sar(b.refunded)) : "") +
            line("adm.gateway", sar(b.gateway)) +
            line("adm.costs", sar(b.costs)) +
          "</div>" +
          '<p class="tiny muted" style="margin-top:var(--s-3)" data-i18n="adm.gatewayNote"></p>' +
        "</section>" +
      "</div>" +

      '<section class="card card--pad" style="margin-top:var(--s-6);' +
        'border-top:4px solid var(--' + (b.profit < 0 ? "danger" : "accent") + ')">' +
        '<div class="row between wrap gap-3">' +
          '<h3 class="subtitle" data-i18n="adm.profit"></h3>' +
          '<strong class="display">' + sar(b.profit) + "</strong>" +
        "</div></section>" +

      costsSection(b) + partnersSection(b, over);
  }

  function costsSection(b) {
    var list = Store.costs();
    return '<section class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle" data-i18n="adm.costs"></h3>' +
      '<div class="grid grid-3" style="gap:var(--s-3);margin-top:var(--s-4)">' +
        '<label class="field"><span class="label" data-i18n="adm.costName"></span>' +
          '<input class="input" data-cost-name></label>' +
        '<label class="field"><span class="label" data-i18n="adm.costAmount"></span>' +
          '<input class="input" type="number" min="0" data-cost-amount></label>' +
        '<label class="field"><span class="label" data-i18n="adm.costPeriod"></span>' +
          '<select class="select" data-cost-period>' +
            ["once","monthly","quarterly","yearly"].map(function (p) {
              return '<option value="' + p + '"' + (p === "monthly" ? " selected" : "") + ">" +
                esc(I18N.t("adm.per" + p.charAt(0).toUpperCase() + p.slice(1))) + "</option>";
            }).join("") +
          "</select></label>" +
      "</div>" +
      '<button class="btn btn--outline btn--sm" style="margin-top:var(--s-3)" type="button" ' +
        'data-add-cost>' + Icons.svg("plus", "icon-sm") + esc(I18N.t("adm.addCost")) + "</button>" +

      '<div style="margin-top:var(--s-5)">' +
        (list.length
          ? list.map(function (c) {
              return '<div class="row between wrap gap-3 admin-line">' +
                "<span><strong>" + esc(c.name) + "</strong>" +
                  '<span class="tiny muted" style="display:block">' +
                    esc(I18N.t("adm.per" + (c.period||"monthly").charAt(0).toUpperCase() +
                        (c.period||"monthly").slice(1))) + " · " +
                    esc(I18N.t("adm.perMonth")) + " " + sar(M.monthlyCost(c)) + "</span></span>" +
                '<span class="row gap-3">' + sar(Math.round((c.amount||0)*100)) +
                  '<button class="icon-btn" type="button" data-del-cost="' + esc(c.id) + '">' +
                    Icons.svg("trash", "icon-sm") + "</button></span></div>";
            }).join("")
          : '<p class="small muted" data-i18n="adm.noCosts"></p>') +
      "</div></section>";
  }

  function partnersSection(b, over) {
    return '<section class="card card--pad" style="margin-top:var(--s-6)">' +
      '<h3 class="subtitle" data-i18n="adm.partners"></h3>' +
      '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="adm.partnersLead"></p>' +
      (over ? '<p class="note-inline" style="margin-top:var(--s-3)">' +
        esc(I18N.t("adm.sharesOver")) + "</p>" : "") +
      '<div class="grid grid-2" style="gap:var(--s-3);margin-top:var(--s-4)">' +
        '<label class="field"><span class="label" data-i18n="adm.partnerName"></span>' +
          '<input class="input" data-partner-name></label>' +
        '<label class="field"><span class="label" data-i18n="adm.share"></span>' +
          '<input class="input" type="number" min="0" max="100" data-partner-share></label>' +
      "</div>" +
      '<button class="btn btn--outline btn--sm" style="margin-top:var(--s-3)" type="button" ' +
        'data-add-partner>' + Icons.svg("plus", "icon-sm") + esc(I18N.t("adm.addPartner")) + "</button>" +

      '<div style="margin-top:var(--s-5)">' +
        (b.partners.length
          ? b.partners.map(function (p) {
              return '<div class="row between wrap gap-3 admin-line">' +
                "<span><strong>" + esc(p.name) + "</strong>" +
                  '<span class="tiny muted" style="display:block">' +
                    C.num(p.sharePct) + "%</span></span>" +
                '<span class="row gap-3"><strong>' + sar(p.amount) + "</strong>" +
                  '<button class="icon-btn" type="button" data-del-partner="' + esc(p.id) + '">' +
                    Icons.svg("trash", "icon-sm") + "</button></span></div>";
            }).join("") +
            line("adm.unassigned", sar(b.unassigned), true)
          : '<p class="small muted" data-i18n="adm.noPartners"></p>') +
      "</div></section>";
  }

  /* =================================================================== ads */
  function ads() {
    var list = Store.announcements();
    return head("adm.ads", "adm.adsLead") +
      '<section class="card card--pad">' +
        '<label class="field"><span class="label" data-i18n="adm.adTitle"></span>' +
          '<input class="input" data-ad-title></label>' +
        '<label class="field" style="margin-top:var(--s-3)"><span class="label" data-i18n="adm.adBody"></span>' +
          '<textarea class="input" rows="2" data-ad-body></textarea></label>' +
        '<div class="grid grid-2" style="gap:var(--s-3);margin-top:var(--s-3)">' +
          '<label class="field"><span class="label" data-i18n="adm.adLink"></span>' +
            '<input class="input" dir="ltr" data-ad-link></label>' +
          '<label class="field"><span class="label" data-i18n="adm.adAudience"></span>' +
            '<select class="select" data-ad-audience>' +
              '<option value="all">' + esc(I18N.t("adm.audAll")) + "</option>" +
              '<option value="client">' + esc(I18N.t("role.client")) + "</option>" +
              '<option value="lawyer">' + esc(I18N.t("role.lawyer")) + "</option>" +
              '<option value="intern">' + esc(I18N.t("role.intern")) + "</option>" +
            "</select></label>" +
        "</div>" +
        '<div class="grid grid-2" style="gap:var(--s-3);margin-top:var(--s-3)">' +
          '<label class="field"><span class="label" data-i18n="adm.adImage"></span>' +
            '<input class="input" dir="ltr" data-ad-image></label>' +
          '<label class="field"><span class="label" data-i18n="adm.adPlacement"></span>' +
            '<select class="select" data-ad-placement>' +
              '<option value="bar">' + esc(I18N.t("adm.placeBar")) + "</option>" +
              '<option value="home">' + esc(I18N.t("adm.placeHome")) + "</option>" +
            "</select></label>" +
        "</div>" +
        '<label class="field" style="margin-top:var(--s-3)">' +
          '<span class="label" data-i18n="adm.adHtml"></span>' +
          '<textarea class="input" rows="3" dir="ltr" data-ad-html></textarea>' +
          '<span class="tiny faint" data-i18n="adm.adHtmlHint"></span></label>' +
        '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-4)" type="button" data-add-ad>' +
          Icons.svg("send", "icon-sm") + esc(I18N.t("adm.addAd")) + "</button>" +
      "</section>" +

      '<div style="margin-top:var(--s-6)">' +
        (list.length
          ? list.map(function (a) {
              return '<div class="card card--pad admin-card">' +
                '<div class="row between wrap gap-3">' +
                  "<strong>" + esc(a.title) + "</strong>" +
                  '<span class="status status--' + (a.active ? "ok" : "muted") + '">' +
                    esc(I18N.t(a.active ? "adm.adLive" : "adm.adHidden")) + "</span>" +
                "</div>" +
                (a.body ? '<p class="small muted" style="margin-top:var(--s-2)">' +
                  esc(a.body) + "</p>" : "") +
                '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
                  '<button class="btn btn--outline btn--sm" type="button" data-toggle-ad="' + esc(a.id) + '">' +
                    esc(I18N.t(a.active ? "adm.hide" : "adm.show")) + "</button>" +
                  '<button class="btn btn--ghost btn--sm" type="button" data-del-ad="' + esc(a.id) + '">' +
                    esc(I18N.t("adm.remove")) + "</button>" +
                "</div></div>";
            }).join("")
          : '<p class="small muted" data-i18n="adm.noAds"></p>') +
      "</div>";
  }

  /* ============================================================== settings */
  /* ============================================================= catalogue
     What a lawyer is allowed to offer to do. This used to be six entries
     compiled into the page, so the platform could not add a kind of work
     without a release — and the one thing a legal marketplace does as it
     grows is add kinds of work. */
  function catalogue() {
    var all = M.allServiceTypes();
    var chans = M.channels();

    var row = function (t) {
      var band = M.priceBand(t.id);
      return '<div class="card card--pad" style="margin-bottom:var(--s-3)">' +
        '<div class="row between wrap gap-3">' +
          "<div><strong>" + esc(tx(t.title)) + "</strong>" +
            '<p class="tiny muted" style="margin-top:var(--s-1)">' + esc(t.id) +
              ' <span class="dot"></span> <span class="num">' + I18N.num(band.min) + "</span>–" +
              '<span class="num">' + I18N.num(band.max) + "</span> " +
              esc(I18N.t("common.sar")) + "</p></div>" +
          '<span class="row gap-2 wrap">' +
            '<span class="status' + (t.active === false ? "" : " status--ok") + '">' +
              esc(I18N.t(t.active === false ? "admin.catHidden" : "admin.catShown")) + "</span>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-cat-toggle="' + esc(t.id) + '">' +
              esc(I18N.t(t.active === false ? "admin.catShown" : "admin.catHidden")) + "</button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-cat-remove="' + esc(t.id) + '">' +
              esc(I18N.t("adm.remove")) + "</button>" +
          "</span></div>" +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-3)">' +
          chans.map(function (c) {
            var on = (t.channels || []).indexOf(c.id) !== -1;
            return '<label class="chip' + (on ? " is-active" : "") + '">' +
              '<input type="checkbox" style="margin-inline-end:var(--s-2)"' + (on ? " checked" : "") +
              ' data-cat-channel="' + esc(t.id) + '" value="' + esc(c.id) + '">' +
              esc(tx(c.title)) + "</label>";
          }).join("") +
        "</div></div>";
    };

    return head("admin.catTitle", "admin.catLead") +
      '<div style="margin-bottom:var(--s-8)">' + all.map(row).join("") + "</div>" +

      '<section class="card card--pad">' +
        '<h3 class="subtitle" data-i18n="admin.catAdd"></h3>' +
        '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-4)">' +
          '<label class="field"><span class="label" data-i18n="admin.catName"></span>' +
            '<input class="input" data-cat-ar></label>' +
          '<label class="field"><span class="label" data-i18n="admin.catNameEn"></span>' +
            '<input class="input" dir="ltr" data-cat-en></label>' +
          '<label class="field"><span class="label" data-i18n="admin.catId"></span>' +
            '<input class="input" dir="ltr" data-cat-id></label>' +
          '<label class="field"><span class="label" data-i18n="admin.catMeta"></span>' +
            '<input class="input" data-cat-meta></label>' +
          num("adm.min", "data-cat-min", 100, 0) +
          num("adm.max", "data-cat-max", 1000, 0) +
        "</div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="admin.catIdHint"></p>' +
        '<span class="label" style="margin-top:var(--s-4);display:block" data-i18n="admin.catChannels"></span>' +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' +
          chans.map(function (c) {
            return '<label class="chip"><input type="checkbox" checked value="' + esc(c.id) +
              '" style="margin-inline-end:var(--s-2)" data-cat-new-channel>' +
              esc(tx(c.title)) + "</label>";
          }).join("") +
        "</div>" +
        '<button class="btn btn--primary" style="margin-top:var(--s-5)" type="button" data-cat-save>' +
          esc(I18N.t("admin.catAdd")) + "</button>" +
      "</section>";
  }

  function num(labelKey, attr, value, min, max, step) {
    return '<label class="field"><span class="label" data-i18n="' + labelKey + '"></span>' +
      '<input class="input" type="number"' +
      (min != null ? ' min="' + min + '"' : "") + (max != null ? ' max="' + max + '"' : "") +
      (step ? ' step="' + step + '"' : "") + ' value="' + value + '" ' + attr + "></label>";
  }

  function settings() {
    var s = M.platformSettings();
    return head("adm.tabSettings") +

      '<section class="card card--pad">' +
        '<h3 class="subtitle" data-i18n="admin.settings"></h3>' +
        '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-4)">' +
          num("admin.commission", "data-commission", s.commissionPct, 0, M.COMMISSION_MAX_PCT) +
          num("adm.aiPrice", "data-ai-price", s.aiPrice, 0) +
        "</div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="admin.commissionNote"></p>' +
        '<label class="row gap-3" style="margin-top:var(--s-5)">' +
          '<input type="checkbox" data-vat' + (s.vatEnabled ? " checked" : "") + ">" +
          '<span data-i18n="admin.vat"></span></label>' +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="admin.vatNote"></p>' +
        '<div style="margin-top:var(--s-4);max-width:220px">' +
          num("admin.vatPct", "data-vatpct", s.vatPct, 0, 100) + "</div>" +
      "</section>" +

      '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        '<h3 class="subtitle" data-i18n="adm.guarantee"></h3>' +
        '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="adm.guaranteeLead"></p>' +
        '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-4)">' +
          num("adm.guaranteeHours", "data-guar-hours", s.guaranteeHours, 0, 168) +
          num("adm.minYears", "data-min-years", s.minYears, 0, 50) +
        "</div>" +
        '<label class="row gap-3" style="margin-top:var(--s-5)">' +
          '<input type="checkbox" data-guar-open' + (s.guaranteeUnconditional ? " checked" : "") + ">" +
          '<span data-i18n="adm.guaranteeOpen"></span></label>' +
      "</section>" +

      '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        '<h3 class="subtitle" data-i18n="adm.rates"></h3>' +
        '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="adm.ratesLead"></p>' +
        '<div class="grid grid-2" style="gap:var(--s-4);margin-top:var(--s-4)">' +
          num("adm.madaPct", "data-mada-pct", s.madaPct, 0, 100, "0.01") +
          num("adm.madaFixed", "data-mada-fixed", s.madaFixed, 0, null, "0.01") +
          num("adm.cardPct", "data-card-pct", s.cardPct, 0, 100, "0.01") +
          num("adm.cardFixed", "data-card-fixed", s.cardFixed, 0, null, "0.01") +
        "</div>" +
        '<div style="margin-top:var(--s-4);max-width:260px">' +
          num("adm.madaShare", "data-mada-share", s.madaSharePct, 0, 100) + "</div>" +
        '<p class="tiny muted" style="margin-top:var(--s-2)" data-i18n="adm.madaShareNote"></p>' +
      "</section>" +

      '<section class="card card--pad" style="margin-top:var(--s-6)">' +
        '<h3 class="subtitle" data-i18n="adm.bands"></h3>' +
        '<p class="small muted" style="margin-top:var(--s-2)" data-i18n="adm.bandsLead"></p>' +
        '<div style="margin-top:var(--s-4)">' +
          M.serviceTypes().map(function (t) {
            var band = M.priceBand(t.id);
            return '<div class="row between wrap gap-3 admin-line">' +
              "<strong>" + esc(tx(t.title)) + "</strong>" +
              '<span class="row gap-3">' +
                '<input class="input" style="width:110px" type="number" min="0" value="' +
                  band.min + '" data-band-min="' + esc(t.id) + '">' +
                '<input class="input" style="width:110px" type="number" min="0" value="' +
                  band.max + '" data-band-max="' + esc(t.id) + '">' +
              "</span></div>";
          }).join("") +
        "</div>" +
      "</section>" +

      '<button class="btn btn--primary" style="margin-top:var(--s-6)" type="button" data-save-settings>' +
        esc(I18N.t("admin.save")) + "</button>";
  }

  /* =============================================================== record */
  var ACT = { approve: "admin.actApprove", reject: "admin.actReject",
              resolve: "admin.actResolve", settings: "admin.actSettings",
              feature: "adm.feature", ai: "adm.aiOff", ad: "adm.ads",
              cost: "adm.costs", partner: "adm.partners", band: "adm.bands",
              catalogue: "admin.catTitle" };

  function record() {
    var log = Store.audit().slice(0, 40);
    return '<section class="card card--pad" style="margin-top:var(--s-8)">' +
      '<h3 class="subtitle" data-i18n="admin.audit"></h3>' +
      '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)" data-i18n="admin.auditLead"></p>' +
      (log.length
        ? log.map(function (e) {
            var by = M.user(e.byId);
            return '<div class="row between wrap gap-3 small admin-line">' +
              "<span>" + esc(I18N.t(ACT[e.action] || e.action)) +
                (e.subject ? " — " + esc(e.subject) : "") + "</span>" +
              '<span class="tiny muted">' + esc(by ? tx(by.name) : "") + "</span></div>";
          }).join("")
        : '<p class="small muted" data-i18n="admin.auditEmpty"></p>') +
    "</section>";
  }

  /* =============================================================== render */
  var VIEWS = { overview: overview, people: people, requests: requests,
                money: money, ads: ads, catalogue: catalogue, settings: settings };

  C.wireTimeline(host);

  App.onRender(function () {
    if (!Session.is("staff")) { host.innerHTML = denied(); I18N.apply(host); return; }
    var view = VIEWS[tab] || overview;

    host.innerHTML = '<div class="container" style="padding-block:var(--s-8) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline" data-i18n="admin.heading"></h1>' +
        '<p class="lead" data-i18n="admin.lead"></p></header>' +

      '<nav class="adm-tabs">' + TABS.map(function (t) {
        return '<button type="button" class="adm-tab' + (tab === t.id ? " is-active" : "") +
          '" data-tab="' + t.id + '">' + Icons.svg(t.icon, "icon-sm") +
          '<span data-i18n="' + t.key + '"></span></button>';
      }).join("") + "</nav>" +

      '<div class="adm-view">' + view() + "</div>" +
      (tab === "overview" ? record() : "") +
    "</div>";

    I18N.apply(host);
    // Private files carry links that expire, so they are filled in after the
    // draw rather than written into it.
    C.linkFiles(host);
    var s = $("[data-search]", host);
    if (s) { s.value = query; if (query) { s.focus(); s.setSelectionRange(query.length, query.length); } }
  });

  /* =============================================================== events */
  function val(sel) { var el = $(sel, host); return el ? el.value.trim() : ""; }

  host.addEventListener("input", function (ev) {
    if (ev.target.matches("[data-search]")) { query = ev.target.value.trim(); App.rerender(); }
  });

  // Which channels a category allows. Ticking one is the whole edit — there
  // is no save button, because a half-saved catalogue is worse than none.
  host.addEventListener("change", function (ev) {
    var box = ev.target.closest("[data-cat-channel]");
    if (!box || !Session.is("staff")) return;
    var id = box.getAttribute("data-cat-channel");
    var picked = $$('[data-cat-channel="' + id + '"]', host)
      .filter(function (b) { return b.checked; })
      .map(function (b) { return b.value; });
    if (!picked.length) { App.toast(I18N.t("admin.catNeed"), "alert"); box.checked = true; return; }
    Store.setType(id, { channels: picked });
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (a) { var el = t.closest("[" + a + "]"); return el ? el.getAttribute(a) : null; };
    var me = Session.user();
    if (!me || !Session.is("staff")) return;

    var tb = hit("data-tab");
    if (tb) { tab = tb; rejecting = null; whoFile = null; openCase = null; App.rerender(); return; }

    var pf = hit("data-person");
    if (pf) { whoFile = pf; tab = "people"; openCase = null; App.rerender(); return; }
    if (t.closest("[data-back-people]")) { whoFile = null; App.rerender(); return; }

    var cs = hit("data-case");
    if (cs) { openCase = openCase === cs ? null : cs; App.rerender(); return; }

    var mo = hit("data-months");
    if (mo) { months = +mo; App.rerender(); return; }

    var f = hit("data-filter");
    if (f) { filter = f; App.rerender(); return; }

    /* --- people --- */
    var ap = hit("data-approve");
    if (ap) {
      Store.updateAccount(ap, { status: "verified" });
      Store.log({ action: "approve", byId: me.id, targetId: ap,
                  subject: tx((M.user(ap) || {}).name || {}) });
      Store.notify({ to: ap, type: "approved", ref: ap });
      App.toast(I18N.t("admin.approved"), "check");
      return;
    }

    var rj = hit("data-reject");
    if (rj) { rejecting = rj; App.rerender(); return; }
    if (t.closest("[data-cancel]")) { rejecting = null; App.rerender(); return; }

    var rs = hit("data-reject-send");
    if (rs) {
      var why = val("[data-why]");
      if (!why) { App.toast(I18N.t("admin.rejectNeed"), "alert"); return; }
      Store.updateAccount(rs, { status: "rejected", rejectedReason: why });
      Store.log({ action: "reject", byId: me.id, targetId: rs, reason: why,
                  subject: tx((M.user(rs) || {}).name || {}) });
      Store.notify({ to: rs, type: "rejected", ref: rs });
      rejecting = null;
      App.toast(I18N.t("admin.rejected"), "check");
      return;
    }

    var fe = hit("data-feature");
    if (fe) {
      var u = M.user(fe);
      var placed = u && u.featuredRank != null;
      // Appended to the end rather than dropped on top of somebody: placement
      // is an ordering, and two lawyers both put first is not an answer.
      var next = placed ? null : M.featured().length + 1;
      Store.updateAccount(fe, { featuredRank: next });
      Store.log({ action: "feature", byId: me.id, targetId: fe,
                  subject: tx((u || {}).name || {}) });
      return;
    }

    var aiId = hit("data-ai");
    if (aiId) {
      var cur = M.subscriptionOf(aiId);
      Store.setSubscription(aiId, {
        price: M.platformSettings().aiPrice, active: !cur.active
      });
      Store.log({ action: "ai", byId: me.id, targetId: aiId,
                  subject: tx((M.user(aiId) || {}).name || {}) });
      App.toast(I18N.t(cur.active ? "adm.aiRevoked" : "adm.aiGranted"), "sparkle");
      return;
    }

    /* --- disputes --- */
    var oc = hit("data-outcome");
    if (oc) { outcome[t.closest("[data-for]").getAttribute("data-for")] = oc; App.rerender(); return; }

    var rv = hit("data-resolve");
    if (rv) {
      var reason = val("[data-why]"), pctEl = $("[data-pct]", host);
      if (!reason) { App.toast(I18N.t("admin.reasonNeed"), "alert"); return; }
      var pick = outcome[rv];
      Store.resolveDispute(rv, {
        outcome: pick,
        lawyerPct: pctEl ? Math.max(0, Math.min(100, +pctEl.value || 0)) : null,
        reason: reason, byId: me.id
      });
      Store.log({ action: "resolve", byId: me.id, targetId: rv, reason: reason, subject: pick });
      var dq = Store.disputes().filter(function (x) { return x.id === rv; })[0];
      if (dq) {
        M.partiesOf(M.request(dq.requestId), null).forEach(function (id) {
          Store.notify({ to: id, type: "resolved", ref: dq.requestId });
        });
      }
      delete outcome[rv];
      App.toast(I18N.t("admin.decided"), "check");
      return;
    }

    /* --- money --- */
    if (t.closest("[data-add-cost]")) {
      var cn = val("[data-cost-name]"), ca = +val("[data-cost-amount]");
      if (!cn || !(ca >= 0)) { App.toast(I18N.t("adm.costName"), "alert"); return; }
      Store.addCost({ name: cn, amount: ca, period: val("[data-cost-period]") || "monthly" });
      Store.log({ action: "cost", byId: me.id, subject: cn });
      return;
    }
    var dc = hit("data-del-cost");
    if (dc) { Store.removeCost(dc); return; }

    if (t.closest("[data-add-partner]")) {
      var pn = val("[data-partner-name]"), ps = +val("[data-partner-share]");
      if (!pn || !(ps >= 0 && ps <= 100)) { App.toast(I18N.t("adm.share"), "alert"); return; }
      Store.addPartner({ name: pn, sharePct: ps });
      Store.log({ action: "partner", byId: me.id, subject: pn });
      return;
    }
    var dp = hit("data-del-partner");
    if (dp) { Store.removePartner(dp); return; }

    /* --- announcements --- */
    if (t.closest("[data-add-ad]")) {
      var at = val("[data-ad-title]");
      if (!at) { App.toast(I18N.t("adm.needTitle"), "alert"); return; }
      Store.addAnnouncement({
        title: at, body: val("[data-ad-body]"), link: val("[data-ad-link]"),
        imageUrl: val("[data-ad-image]"), html: val("[data-ad-html]"),
        placement: val("[data-ad-placement]") || "bar",
        audience: val("[data-ad-audience]") || "all", active: true
      });
      Store.log({ action: "ad", byId: me.id, subject: at });
      App.toast(I18N.t("adm.saved"), "check");
      return;
    }
    var ta = hit("data-toggle-ad");
    if (ta) {
      var found = Store.announcements().filter(function (a) { return a.id === ta; })[0];
      Store.setAnnouncement(ta, { active: !(found && found.active) });
      return;
    }
    var da = hit("data-del-ad");
    if (da) { Store.removeAnnouncement(da); return; }

    /* --- the catalogue --- */
    if (t.closest("[data-cat-save]")) {
      var id = val("[data-cat-id]").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      var ar = val("[data-cat-ar]"), en = val("[data-cat-en]");
      if (!id || !ar) { App.toast(I18N.t("admin.catNeed"), "alert"); return; }
      if (M.serviceType(id)) { App.toast(I18N.t("admin.catNeed"), "alert"); return; }
      var picked = $$("[data-cat-new-channel]", host)
        .filter(function (b) { return b.checked; })
        .map(function (b) { return b.value; });
      var min = +val("[data-cat-min]") || 0;
      var max = +val("[data-cat-max]") || 0;
      // The band goes in first. A category with no band is one a lawyer
      // cannot price anything under, so it would appear in the picker and
      // refuse every number typed into it.
      Store.setBand(id, { min: min, max: Math.max(min, max) });
      Store.addType({
        id: id, icon: "tag", active: true,
        title: { ar: ar, en: en || ar },
        meta: { ar: val("[data-cat-meta]"), en: val("[data-cat-meta]") },
        channels: picked.length ? picked : ["text"],
        sort: (M.allServiceTypes().length + 1) * 10,
      });
      Store.log({ action: "catalogue", byId: me.id, subject: ar });
      App.toast(I18N.t("admin.catAdded"), "check");
      return;
    }
    var ct = hit("data-cat-toggle");
    if (ct) {
      var cur = M.serviceType(ct);
      Store.setType(ct, { active: !(cur && cur.active !== false) });
      Store.log({ action: "catalogue", byId: me.id, subject: tx((cur || {}).title || {}) });
      return;
    }
    var cr = hit("data-cat-remove");
    if (cr) {
      // Refused by the database when anything is sold under it, and the
      // message says so rather than the row quietly coming back.
      var used = M.services().some(function (sv) { return sv.typeId === cr; }) ||
                 M.requests().some(function (rq) { return rq.typeId === cr; });
      if (used) { App.toast(I18N.t("admin.catInUse"), "alert"); return; }
      Store.removeType(cr);
      Store.log({ action: "catalogue", byId: me.id, subject: cr });
      return;
    }

    /* --- settings --- */
    if (t.closest("[data-save-settings]")) {
      var pct = +val("[data-commission]");
      if (pct > M.COMMISSION_MAX_PCT) { App.toast(I18N.t("admin.overCap"), "alert"); return; }

      // Read the whole form before writing any of it. The first write announces
      // a change, the page redraws on the spot, and every input still waiting
      // to be read is replaced by a fresh one carrying the old value — so the
      // bands were saved back exactly as they had been.
      var next = {
        commissionPct: M.clampCommission(pct),
        vatEnabled: !!$("[data-vat]", host).checked,
        vatPct: Math.max(0, Math.min(100, +val("[data-vatpct]") || 0)),
        madaPct: +val("[data-mada-pct]") || 0, madaFixed: +val("[data-mada-fixed]") || 0,
        cardPct: +val("[data-card-pct]") || 0, cardFixed: +val("[data-card-fixed]") || 0,
        madaSharePct: Math.max(0, Math.min(100, +val("[data-mada-share]") || 0)),
        aiPrice: +val("[data-ai-price]") || 0,
        guaranteeHours: Math.max(0, Math.min(168, +val("[data-guar-hours]") || 0)),
        guaranteeUnconditional: !!$("[data-guar-open]", host).checked,
        minYears: Math.max(0, +val("[data-min-years]") || 0)
      };
      var bands = $$("[data-band-min]", host).map(function (el) {
        var id = el.getAttribute("data-band-min");
        var max = $('[data-band-max="' + id + '"]', host);
        return { id: id, min: +el.value || 0, max: max ? +max.value || 0 : 0 };
      });

      Store.setSettings(next);
      bands.forEach(function (band) { Store.setBand(band.id, band); });
      Store.log({ action: "settings", byId: me.id, subject: M.clampCommission(pct) + "%" });
      App.toast(I18N.t("adm.saved"), "check");
      return;
    }
  });
});
