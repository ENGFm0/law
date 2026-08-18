/* ==========================================================================
   Reverse auction — one brief, many lawyers, a closing bell.

   The client writes once; every matching lawyer sees the case but never the
   person. Offers arrive while the clock runs, the client takes the one they
   want, and if nobody is taken before the window closes the request cancels
   itself. A signed-in lawyer sees the same board from the other side and
   bids by hand; the rest of the field is simulated.
   ========================================================================== */
Pages.define("quotes", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var compose = $("[data-quote-compose]");
  if (!compose) return;

  var MODES = [
    { id: "call", icon: "phone", key: "lawyer.call", typeId: "call" },
    { id: "video", icon: "video", key: "req.video", typeId: "video" },
    { id: "written", icon: "chat", key: "req.written", typeId: "written" }
  ];
  var WINDOWS = [15, 30, 60];

  var draft = { city: "", specialty: "", mode: "call", window: 30 };
  var sort = "price";
  var offerTimers = [];

  // The clock outlives a view swap in the bundled build, so it is parked on
  // the window and cleared before a fresh run starts another one.
  clearInterval(global.__quoteTicker);
  var ticker = null;

  function q() { return Store.getQuote(); }
  function remaining(cur) { return Math.max(0, Math.floor((cur.expiresAt - Date.now()) / 1000)); }
  function clock(total) {
    var m = Math.floor(total / 60), s = total % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function modeOf(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return MODES[0];
  }
  /** A lawyer's own price for that mode, or the middle of the band if unlisted. */
  function priceFor(u, modeId) {
    var typeId = modeOf(modeId).typeId;
    var own = M.servicesOf(u.id).filter(function (s) { return s.typeId === typeId; })[0];
    if (own) return own.price;
    var band = M.priceBand(typeId);
    return Math.round((band.min + band.max) / 2 / 5) * 5;
  }

  /* ================================================== client: compose ===== */
  function drawCompose() {
    var citySel = $("[data-quote-city]");
    if (citySel) {
      citySel.innerHTML = '<option value="">' + esc(I18N.t("quotes.anyCity")) + "</option>" +
        global.SEED.cities.map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(tx(c)) + "</option>";
        }).join("");
      citySel.value = draft.city;
    }
    var specSel = $("[data-quote-spec]");
    if (specSel) {
      specSel.innerHTML = '<option value="">' + esc(I18N.t("quotes.anySpecialty")) + "</option>" +
        global.SEED.specialties.map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(tx(s)) + "</option>";
        }).join("");
      specSel.value = draft.specialty;
    }
    drawChips();
    drawPreview();
  }

  function drawChips() {
    var modes = $("[data-quote-modes]");
    if (modes) {
      modes.innerHTML = MODES.map(function (m) {
        return '<button type="button" class="chip' + (draft.mode === m.id ? " is-active" : "") +
          '" data-mode="' + m.id + '">' + Icons.svg(m.icon, "icon-sm") + esc(I18N.t(m.key)) + "</button>";
      }).join("");
    }
    var win = $("[data-quote-window]");
    if (win) {
      win.innerHTML = WINDOWS.map(function (n) {
        return '<button type="button" class="chip' + (draft.window === n ? " is-active" : "") +
          '" data-window="' + n + '">' + esc(I18N.t("quotes.minutes", { n: I18N.num(n) })) + "</button>";
      }).join("");
    }
  }

  /** Exactly what a lawyer will receive — proof the client is not in it. */
  function drawPreview() {
    var prev = $("[data-quote-preview]");
    if (!prev) return;
    var city = draft.city ? tx(M.city(draft.city)) : I18N.t("quotes.anyCity");
    var sp = draft.specialty ? tx(M.specialty(draft.specialty)) : I18N.t("quotes.anySpecialty");
    prev.innerHTML =
      '<p class="tiny muted">' + esc(I18N.t("bids.clientHidden")) + "</p>" +
      '<div class="anon-card" style="margin-top:var(--s-3)"><div class="row gap-3">' +
        '<span class="anon-card__mark">' + Icons.svg("user", "icon-sm") + "</span>" +
        "<div><strong class=\"small\">" + esc(I18N.t("quotes.anonId", { id: "4821" })) + "</strong>" +
        '<p class="tiny muted">' + esc(city) + ' <span class="dot"></span> ' + esc(sp) +
          ' <span class="dot"></span> ' + esc(I18N.t(modeOf(draft.mode).key)) + "</p></div>" +
      "</div></div>";
  }

  /* ================================================== client: the board === */
  function offerRow(cur, o) {
    var l = M.user(o.lawyer);
    if (!l) return "";
    var best = o.price === Math.min.apply(null, cur.offers.map(function (x) { return x.price; }));
    return '<article class="offer-card' + (best ? " is-best" : "") + '">' +
      (best ? '<span class="offer-card__flag">' + esc(I18N.t("quotes.bestPrice")) + "</span>" : "") +
      C.avatar(l, "md") +
      '<div class="grow" style="min-width:0">' +
        "<strong class=\"small\">" + esc(tx(l.name)) + "</strong>" +
        '<p class="tiny muted">' + esc(tx(l.title || {})) + "</p>" +
        '<div class="meta-row" style="margin-top:var(--s-2)">' + C.ratingLine(l.id) +
          '<span class="dot"></span><span class="muted">' +
            esc(I18N.t("lawyer.years", { n: I18N.num(l.years || 0) })) + "</span>" +
          '<span class="dot"></span><span class="muted">' +
            esc(I18N.t("quotes.within", { n: I18N.num(o.eta) })) + "</span></div>" +
      "</div>" +
      '<div class="offer-card__end">' +
        '<strong class="offer-card__price"><span class="num">' + I18N.num(o.price) + "</span> " +
          '<span class="small muted">' + esc(I18N.t("common.sar")) + "</span></strong>" +
        '<button class="btn btn--accent btn--sm" type="button" data-accept="' + esc(o.lawyer) + '">' +
          esc(I18N.t("quotes.accept")) + "</button>" +
      "</div></article>";
  }

  function sortedOffers(cur) {
    return cur.offers.slice().sort(function (a, b) {
      if (sort === "rating") return M.ratingOf(b.lawyer).avg - M.ratingOf(a.lawyer).avg;
      if (sort === "speed") return a.eta - b.eta;
      return a.price - b.price;
    });
  }

  function drawLive() {
    var host = $("[data-quote-live]");
    var cur = q();
    if (!host) return;

    compose.hidden = !!cur;
    host.hidden = !cur;
    if (!cur) return;

    if (cur.status === "accepted") {
      var won = M.user(cur.acceptedBy);
      host.innerHTML =
        '<div class="card card--rule-gold card--pad center stack gap-4" style="align-items:center">' +
          '<span class="feature__icon" style="background:var(--success-soft);color:var(--success)">' +
            Icons.svg("check", "icon-lg") + "</span>" +
          '<h1 class="headline">' + esc(I18N.t("quotes.acceptedTitle")) + "</h1>" +
          '<p class="lead">' + esc(I18N.t("quotes.acceptedBody", { name: won ? tx(won.name) : "" })) + "</p>" +
          '<a class="btn btn--primary" href="' + (won ? M.profileHref(won) : "#") + '">' +
            esc(I18N.t("dir.viewProfile")) + "</a>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-quote-reset>' +
            esc(I18N.t("quotes.newRequest")) + "</button></div>";
      return;
    }
    if (cur.status === "expired" || cur.status === "cancelled") {
      host.innerHTML =
        '<div class="card card--pad center stack gap-4" style="align-items:center">' +
          '<span class="feature__icon">' + Icons.svg("clock", "icon-lg") + "</span>" +
          '<h1 class="headline">' +
            esc(I18N.t(cur.status === "expired" ? "quotes.expired" : "quotes.cancelled")) + "</h1>" +
          '<p class="lead">' +
            esc(I18N.t(cur.status === "expired" ? "quotes.expiredBody" : "quotes.cancelled")) + "</p>" +
          '<button class="btn btn--accent" type="button" data-quote-reset>' +
            esc(I18N.t("quotes.repost")) + "</button></div>";
      return;
    }

    var left = remaining(cur);
    var city = cur.city ? tx(M.city(cur.city)) : I18N.t("quotes.anyCity");
    host.innerHTML =
      '<div class="card card--rule-gold card--pad" style="margin-bottom:var(--s-6)">' +
        '<div class="row between wrap gap-6">' +
          '<div class="grow" style="min-width:220px">' +
            '<span class="status status--ok">' + esc(I18N.t("quotes.live")) + "</span>" +
            '<h1 class="title" style="margin-top:var(--s-3)">' + esc(cur.brief.slice(0, 90)) +
              (cur.brief.length > 90 ? "…" : "") + "</h1>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' + esc(city) +
              ' <span class="dot"></span> ' + esc(I18N.t(modeOf(cur.mode).key)) + "</p></div>" +
          '<div class="countdown" style="min-width:180px">' +
            '<div class="countdown__time" data-quote-clock>' + clock(left) + "</div>" +
            '<p class="tiny muted">' + esc(I18N.t("quotes.timeLeft")) + "</p></div>" +
        "</div>" +
        '<hr class="divider">' +
        '<div class="row between wrap gap-3">' +
          "<strong class=\"small\">" + esc(I18N.t("quotes.offersIn", { n: I18N.num(cur.offers.length) })) + "</strong>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-quote-cancel>' +
            esc(I18N.t("quotes.cancel")) + "</button></div>" +
      "</div>" +
      (cur.offers.length
        ? '<div class="row gap-2 wrap" style="margin-bottom:var(--s-4)">' +
            [["price", "quotes.sortPrice"], ["rating", "quotes.sortRating"], ["speed", "quotes.sortSpeed"]]
              .map(function (p) {
                return '<button type="button" class="chip' + (sort === p[0] ? " is-active" : "") +
                  '" data-sort="' + p[0] + '">' + esc(I18N.t(p[1])) + "</button>";
              }).join("") + "</div>" +
          '<div class="stack gap-3">' + sortedOffers(cur).map(function (o) {
            return offerRow(cur, o);
          }).join("") + "</div>"
        : '<div class="card empty">' + Icons.svg("clock", "icon-xl") +
          '<p class="subtitle">' + esc(I18N.t("quotes.waiting")) + "</p></div>");
  }

  /* ================================================== lawyer: bidding ===== */
  function drawBids() {
    var host = $("[data-quote-bids]");
    if (!host) return;
    var cur = q();
    var me = Session.user();

    host.hidden = false;
    if (!cur) {
      host.innerHTML = '<div class="card empty">' + Icons.svg("gavel", "icon-xl") +
        '<p class="subtitle">' + esc(I18N.t("bids.none")) + "</p></div>";
      return;
    }

    var open = cur.status === "open" && remaining(cur) > 0;
    var mine = cur.offers.filter(function (o) { return o.lawyer === me.id; })[0];

    if (!open) {
      var won = cur.status === "accepted" && cur.acceptedBy === me.id;
      host.innerHTML = '<div class="card empty">' + Icons.svg(won ? "trophy" : "clock", "icon-xl") +
        '<p class="subtitle">' +
        esc(I18N.t(won ? "bids.won" : (cur.status === "accepted" && mine) ? "bids.lost" : "bids.none")) +
        "</p></div>";
      return;
    }

    var city = cur.city ? tx(M.city(cur.city)) : I18N.t("quotes.anyCity");
    var spec = cur.specialty ? tx(M.specialty(cur.specialty)) : I18N.t("quotes.anySpecialty");

    host.innerHTML = '<div class="card card--pad">' +
      '<div class="row between wrap gap-3" style="margin-bottom:var(--s-5)">' +
        '<h1 class="headline" data-i18n="bids.title"></h1>' +
        '<span class="countdown__time" data-bids-clock>' +
          esc(I18N.t("bids.closesIn")) + " " + clock(remaining(cur)) + "</span></div>" +
      '<p class="lead" data-i18n="bids.lead"></p>' +

      '<div class="anon-card" style="margin-top:var(--s-6)">' +
        '<div class="row gap-3" style="align-items:flex-start">' +
          '<span class="anon-card__mark">' + Icons.svg("user", "icon-sm") + "</span>" +
          '<div class="grow" style="min-width:0">' +
            "<strong class=\"small\">" + esc(I18N.t("quotes.anonId", { id: esc(cur.id) })) + "</strong>" +
            '<p class="tiny muted">' + esc(city) + ' <span class="dot"></span> ' + esc(spec) +
              ' <span class="dot"></span> ' + esc(I18N.t(modeOf(cur.mode).key)) + "</p></div></div>" +
        '<p class="small" style="margin-top:var(--s-3)">' + esc(cur.brief) + "</p>" +
        '<p class="tiny faint row gap-2" style="margin-top:var(--s-3)">' + Icons.svg("lock", "icon-sm") +
          esc(I18N.t("bids.clientHidden")) + "</p></div>" +

      '<p class="tiny muted" style="margin-top:var(--s-4)">' +
        esc(I18N.t("bids.competing", { n: I18N.num(cur.offers.length) })) + "</p>" +

      (mine
        ? '<p class="status status--ok" style="width:100%;justify-content:center;margin-top:var(--s-4)">' +
          Icons.svg("check", "icon-sm") + esc(I18N.t("bids.already")) + " — " +
          '<span class="num">' + I18N.num(mine.price) + "</span> " + esc(I18N.t("common.sar")) + "</p>"
        : '<form class="bid-form" data-bid-form>' +
            '<label class="field"><span class="tiny muted">' + esc(I18N.t("bids.yourPrice")) + "</span>" +
              '<input class="input num" type="number" min="40" step="5" data-bid-price value="' +
                priceFor(me, cur.mode) + '"></label>' +
            '<label class="field"><span class="tiny muted">' + esc(I18N.t("bids.yourEta")) + "</span>" +
              '<input class="input num" type="number" min="1" max="72" step="1" data-bid-eta value="4"></label>' +
            '<button class="btn btn--accent" type="submit">' + esc(I18N.t("bids.submit")) + "</button>" +
          "</form>") +
    "</div>";
    I18N.apply(host);
  }

  /* ================================================== the field =========== */
  function scheduleOffers(cur) {
    offerTimers.forEach(clearTimeout);
    offerTimers = [];

    // Whoever is signed in bids by hand; the simulation stands in for the rest.
    var meId = Session.user() ? Session.user().id : null;
    var eligible = M.listedLawyers().filter(function (l) { return l.id !== meId; });
    var pool = eligible.filter(function (l) {
      if (cur.specialty && (l.specialties || []).indexOf(cur.specialty) === -1) return false;
      if (cur.city && l.city !== cur.city) return false;
      return true;
    });
    if (pool.length < 3) pool = eligible.slice();

    pool.slice(0, 5).forEach(function (l, i) {
      var base = priceFor(l, cur.mode);
      // A competitive board: bids land between 25% under and 10% over list.
      var factor = 0.75 + ((i * 37) % 35) / 100;
      var price = Math.max(40, Math.round(base * factor / 5) * 5);
      var eta = 2 + ((i * 3) % 10);
      offerTimers.push(setTimeout(function () {
        Store.addOffer({ lawyer: l.id, price: price, eta: eta });
      }, 2200 + i * 2600));
    });
  }

  function startTicker() {
    clearInterval(ticker);
    ticker = global.__quoteTicker = setInterval(function () {
      var cur = q();
      if (!cur || cur.status !== "open") { clearInterval(ticker); return; }
      var left = remaining(cur);
      var el = $("[data-quote-clock]");
      if (el) el.textContent = clock(left);
      var bel = $("[data-bids-clock]");
      if (bel) bel.textContent = I18N.t("bids.closesIn") + " " + clock(left);
      if (left <= 0) {
        clearInterval(ticker);
        offerTimers.forEach(clearTimeout);
        Store.setQuoteStatus("expired");
        App.toast(I18N.t("quotes.expired"), "clock");
      }
    }, 1000);
  }

  /* ================================================== draw =============== */
  App.onRender(function () {
    var isLawyer = Session.is("lawyer");
    var bids = $("[data-quote-bids]");
    var live = $("[data-quote-live]");

    if (isLawyer) {
      compose.hidden = true;
      if (live) live.hidden = true;
      drawBids();
    } else {
      if (bids) { bids.hidden = true; bids.innerHTML = ""; }
      drawCompose();
      drawLive();
    }

    var cur = q();
    if (cur && cur.status === "open") { startTicker(); if (!isLawyer) scheduleOffers(cur); }
  });

  /* ================================================== events ============= */
  compose.addEventListener("click", function (ev) {
    var m = ev.target.closest("[data-mode]");
    if (m) { draft.mode = m.getAttribute("data-mode"); drawChips(); drawPreview(); return; }
    var w = ev.target.closest("[data-window]");
    if (w) { draft.window = parseInt(w.getAttribute("data-window"), 10); drawChips(); }
  });

  compose.addEventListener("change", function (ev) {
    var isCity = ev.target.matches("[data-quote-city]");
    var isSpec = ev.target.matches("[data-quote-spec]");
    // The textarea also fires `change` when it loses focus — which happens on
    // the way to clicking a chip. Redrawing then would tear the chip out from
    // under the pointer and swallow the click, so only the selects redraw.
    if (!isCity && !isSpec) return;
    if (isCity) draft.city = ev.target.value;
    if (isSpec) draft.specialty = ev.target.value;
    drawPreview();
  });

  var form = $("[data-quote-form]");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var brief = $("#q-brief").value.trim();
      if (brief.length < 10) { App.toast(I18N.t("quotes.needBrief"), "file-text"); return; }
      var cur = Store.openQuote({
        id: "4821", brief: brief, city: draft.city, specialty: draft.specialty,
        mode: draft.mode, minutes: draft.window,
        expiresAt: Date.now() + draft.window * 60000,
        status: "open", offers: []
      });
      App.toast(I18N.t("quotes.published"), "check");
      startTicker();
      scheduleOffers(cur);
      global.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  var live = $("[data-quote-live]");
  if (live) {
    live.addEventListener("click", function (ev) {
      var so = ev.target.closest("[data-sort]");
      if (so) { sort = so.getAttribute("data-sort"); drawLive(); return; }

      var ac = ev.target.closest("[data-accept]");
      if (ac) {
        var id = ac.getAttribute("data-accept");
        offerTimers.forEach(clearTimeout);
        clearInterval(ticker);
        Store.setQuoteStatus("accepted", { acceptedBy: id });
        var who = M.user(id);
        App.toast(I18N.t("quotes.accepted", { name: who ? tx(who.name) : "" }), "check");
        return;
      }
      if (ev.target.closest("[data-quote-cancel]")) {
        offerTimers.forEach(clearTimeout);
        clearInterval(ticker);
        Store.setQuoteStatus("cancelled");
        App.toast(I18N.t("quotes.cancelled"), "close");
        return;
      }
      if (ev.target.closest("[data-quote-reset]")) Store.clearQuote();
    });
  }

  var bidsHost = $("[data-quote-bids]");
  if (bidsHost) {
    bidsHost.addEventListener("submit", function (ev) {
      if (!ev.target.matches("[data-bid-form]")) return;
      ev.preventDefault();
      var price = parseInt($("[data-bid-price]").value, 10);
      var eta = parseInt($("[data-bid-eta]").value, 10) || 4;
      if (!price || price < 40) { App.toast(I18N.t("bids.badPrice"), "file-text"); return; }
      App.toast(I18N.t(Store.addOffer({ lawyer: Session.user().id, price: price, eta: eta })
        ? "bids.submitted" : "bids.already"), "check");
    });
  }
});
