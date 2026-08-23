/* ==========================================================================
   People — the directory a client browses and the board a professional is
   ranked on, in one page because they are two views of the same list.

   The rank is never stored; it is recomputed from ratings, delivered work and
   response speed every time this page draws.
   ========================================================================== */
Pages.define("lawyers", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-people]");
  if (!host) return;

  var state = {
    tab: Session.is("intern") ? "intern" : "lawyer",
    q: App.param("q") || "",
    specialty: App.param("specialty") || "",
    city: App.param("city") || "",
    minRating: 0,
    sort: "rating"
  };

  /* ---------- filtering ---------- */
  function lawyerList() {
    var text = state.q.trim().toLowerCase();
    var sorted = M.listedLawyers().filter(function (u) {
      if (state.specialty && (u.specialties || []).indexOf(state.specialty) === -1) return false;
      if (state.city && u.city !== state.city) return false;
      if (M.ratingOf(u.id).avg < state.minRating) return false;
      if (text) {
        var hay = (tx(u.name) + " " + tx(u.title || {}) + " " + tx(u.bio || {})).toLowerCase();
        if (hay.indexOf(text) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (state.sort === "experience") return (b.years || 0) - (a.years || 0);
      if (state.sort === "priceAsc") return cheapest(a) - cheapest(b);
      if (state.sort === "priceDesc") return cheapest(b) - cheapest(a);
      return M.ratingOf(b.id).avg - M.ratingOf(a.id).avg;
    });
    // Placement is applied last, over whatever order was asked for: a lawyer
    // the platform is putting forward stays in front of the list, and the rest
    // keep the sort the reader chose.
    return M.byPlacement(sorted);
  }

  /* A directory of people cannot hold a partnership, so the firms are a third
     list rather than rows mixed into the first two. Only listed firms: a firm
     the desk has not verified, or whose subscription has lapsed, is not a
     firm the directory says exists. */
  function firmList() {
    var text = state.q.trim().toLowerCase();
    return M.listedFirms().filter(function (f) {
      if (state.city && f.city !== state.city) return false;
      if (!text) return true;
      return (String(f.name || "") + " " + String(f.bio || "")).toLowerCase()
        .indexOf(text) !== -1;
    });
  }

  function cheapest(u) {
    var s = M.servicesOf(u.id);
    return s.length ? Math.min.apply(null, s.map(function (x) { return x.price; })) : Infinity;
  }

  /* ---------- pieces ---------- */
  function tabs() {
    return '<div class="tabs" role="tablist">' +
      [["lawyer", "dir.tabLawyers"], ["intern", "dir.tabInterns"],
       ["firm", "dir.tabFirms"]].map(function (t) {
        return '<button class="tab' + (state.tab === t[0] ? " is-active" : "") + '" role="tab" ' +
          'type="button" data-tab="' + t[0] + '" data-i18n="' + t[1] + '"></button>';
      }).join("") + "</div>";
  }

  /* A firm has no rating, no years and no price list, so it is not filtered
     by any of them — a dropdown that cannot change the list is a dropdown
     that makes the reader wonder what they got wrong. */
  function filters(forFirms) {
    function sel(name, list, value, anyKey) {
      return '<select class="select" data-f="' + name + '">' +
        '<option value="">' + esc(I18N.t(anyKey)) + "</option>" +
        list.map(function (o) {
          return '<option value="' + esc(o.id) + '"' + (o.id === value ? " selected" : "") + ">" +
            esc(tx(o)) + "</option>";
        }).join("") + "</select>";
    }
    return '<div class="results-bar">' +
      '<div class="row gap-3 wrap">' +
        '<label class="field"><span class="label" data-i18n="blog.search"></span>' +
          '<input class="input" data-f="q" value="' + esc(state.q) + '" ' +
            'data-i18n-attr="placeholder:home.searchPlaceholder"></label>' +
        (forFirms ? "" :
          '<label class="field"><span class="label" data-i18n="dir.specialties"></span>' +
            sel("specialty", global.SEED.specialties, state.specialty, "dir.anySpecialty") +
          "</label>") +
        '<label class="field"><span class="label" data-i18n="dir.cities"></span>' +
          sel("city", global.SEED.cities, state.city, "dir.anyCity") + "</label>" +
        (forFirms ? "" :
          '<label class="field"><span class="label" data-i18n="dir.sortBy"></span>' +
            '<select class="select" data-f="sort">' +
              [["rating", "dir.sortRating"], ["experience", "dir.sortExperience"],
               ["priceAsc", "dir.sortPriceAsc"], ["priceDesc", "dir.sortPriceDesc"]].map(function (o) {
                return '<option value="' + o[0] + '"' + (state.sort === o[0] ? " selected" : "") + ">" +
                  esc(I18N.t(o[1])) + "</option>";
              }).join("") + "</select></label>") +
        '<button class="btn btn--ghost btn--sm" type="button" data-reset data-i18n="dir.reset"></button>' +
      "</div></div>";
  }

  /** The board is a professional's own scoreboard, not a client's shopping
      aid — a client judges a lawyer by rating and price, never by a league
      position. So it is drawn for lawyers and trainees only. A trainee sees
      their own cohort; a lawyer sees both, because they supervise one of them. */
  function canSeeBoard(role) {
    if (Session.is("lawyer")) return true;
    return Session.is("intern") && role === "intern";
  }

  function board(role) {
    var me = Session.user();
    var rows = M.leaderboard(role);
    return '<section class="card" style="margin-top:var(--s-10);overflow:hidden">' +
      '<div class="panel__head"><h2 class="subtitle" data-i18n="rank.title"></h2>' +
        '<p class="tiny muted" style="margin-top:var(--s-1)" data-i18n="rank.lead"></p></div>' +
      '<div style="overflow-x:auto"><table class="rank-table">' +
        "<thead><tr>" +
          '<th data-i18n="rank.pos"></th><th data-i18n="rank.name"></th>' +
          '<th data-i18n="rank.rating"></th>' +
          '<th data-i18n="' + (role === "intern" ? "rank.hours" : "rank.done") + '"></th>' +
          '<th data-i18n="rank.score"></th>' +
        "</tr></thead><tbody>" +
        rows.map(function (row, i) {
          var mine = me && row.user.id === me.id;
          return "<tr" + (mine ? ' class="is-me"' : "") + ">" +
            '<td class="num">' + I18N.num(i + 1) + "</td>" +
            '<td><span class="row gap-2">' + C.avatar(row.user, "sm") + C.personLink(row.user) +
              (mine ? ' <span class="tag">' + esc(I18N.t("rank.you")) + "</span>" : "") + "</span></td>" +
            '<td class="num">' + I18N.num(row.rating.avg.toFixed(1)) + "</td>" +
            '<td class="num">' + I18N.num(role === "intern" ? M.hoursOf(row.user.id) : (row.user.completed || 0)) + "</td>" +
            '<td><strong class="num">' + I18N.num(row.score.total) + "</strong></td>" +
          "</tr>";
        }).join("") +
      "</tbody></table></div></section>";
  }

  /* ---------- draw ---------- */
  var HEADS = { lawyer: ["dir.heading", "dir.lead", "dir.found"],
                intern: ["dir.headingInterns", "dir.internsLead", "dir.foundInterns"],
                firm:   ["dir.headingFirms", "dir.firmsLead", "dir.foundFirms"] };

  App.onRender(function () {
    var isLawyers = state.tab === "lawyer";
    var isFirms = state.tab === "firm";
    var list = isFirms ? firmList() : (isLawyers ? lawyerList() : M.interns());
    var head = HEADS[state.tab] || HEADS.lawyer;
    var card = isFirms ? C.firmCard : (isLawyers ? C.lawyerCard : C.internCard);

    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-6)">' +
        '<h1 class="headline" data-i18n="' + head[0] + '"></h1>' +
        '<p class="lead" data-i18n="' + head[1] + '"></p></header>' +
      tabs() +
      (isLawyers || isFirms ? filters(isFirms) : "") +
      '<p class="small muted" style="margin:var(--s-4) 0">' +
        esc(I18N.t(head[2], { n: I18N.num(list.length) })) + "</p>" +
      (list.length
        ? '<div class="grid grid-3">' + list.map(card).join("") + "</div>"
        : C.empty("search", isFirms ? "dir.noFirms" : "dir.empty")) +
      (canSeeBoard(state.tab) ? board(state.tab) : "") +
    "</div>";

    I18N.apply(host);
    App.observeReveals(host);
  });

  /* ---------- events ---------- */
  host.addEventListener("click", function (ev) {
    var tab = ev.target.closest("[data-tab]");
    if (tab) { state.tab = tab.getAttribute("data-tab"); App.rerender(); return; }
    if (ev.target.closest("[data-reset]")) {
      state.q = ""; state.specialty = ""; state.city = ""; state.sort = "rating";
      App.rerender();
    }
  });

  host.addEventListener("change", function (ev) {
    var f = ev.target.closest("[data-f]");
    if (!f) return;
    state[f.getAttribute("data-f")] = f.value;
    App.rerender();
  });

  // Typing filters as you go; the select handler above covers the dropdowns.
  host.addEventListener("input", function (ev) {
    var f = ev.target.closest('[data-f="q"]');
    if (!f) return;
    state.q = f.value;
    clearTimeout(f._t);
    f._t = setTimeout(function () {
      App.rerender();
      var again = $('[data-f="q"]', host);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }, 250);
  });
});
