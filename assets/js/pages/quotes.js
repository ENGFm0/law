/* ==========================================================================
   Reverse auction — one brief, many lawyers, a closing bell.

   The client says what work they need, how they want it done, and how long
   they will wait. Every lawyer who has listed that work through that channel
   sees the case and never the person. Offers arrive while the clock runs, the
   client takes the one they want, and the moment they do the agreement stops
   being an auction and becomes a request that both sides can see and follow.

   Two things changed here after the first version. The brief used to be a
   single object in this browser's own storage, so it was posted to nobody:
   no lawyer on another machine could see it, and accepting an offer set a
   flag and created nothing — which is why an agreed piece of work never
   turned up in either side's list. And the choice used to be "call, video or
   written", which is not work, it is a channel; the work is the statement of
   claim, and the channel is how it is handed over.
   ========================================================================== */
Pages.define("quotes", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var compose = $("[data-quote-compose]");
  if (!compose) return;

  var WINDOWS = [15, 30, 60];
  var remote = (global.SANAD_CONFIG || {}).backend === "supabase";

  var draft = { city: "", specialty: "", typeId: "", channel: "", window: 30 };
  var sort = "price";
  var offerTimers = [];

  // The clock outlives a view swap in the bundled build, so it is parked on
  // the window and cleared before a fresh run starts another one.
  clearInterval(global.__quoteTicker);
  var ticker = null;

  function me() { return Session.user(); }
  function mine() { return me() ? M.myQuote(me().id) : null; }
  function offers(cur) { return cur ? M.offersOn(cur.id) : []; }
  function remaining(cur) { return Math.max(0, Math.floor((cur.expiresAt - Date.now()) / 1000)); }
  function clock(total) {
    var m = Math.floor(total / 60), s = total % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function types() { return M.serviceTypes(); }
  function firstType() { return (types()[0] || {}).id || ""; }
  function typeOf(id) { return M.serviceType(id) || { title: {}, meta: {} }; }
  function channelsOf(typeId) {
    return M.channelsFor(typeId).map(function (id) { return M.channel(id); })
      .filter(Boolean);
  }
  /** Keep the draft answerable: a category always chosen, and a channel that
      the category actually allows. */
  function settle() {
    if (!draft.typeId || !M.serviceType(draft.typeId)) draft.typeId = firstType();
    var allowed = M.channelsFor(draft.typeId);
    if (allowed.indexOf(draft.channel) === -1) draft.channel = allowed[0] || "text";
  }

  /* ================================================== client: compose ===== */
  function drawCompose() {
    settle();
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
    settle();
    var kinds = $("[data-quote-types]");
    if (kinds) {
      kinds.innerHTML = types().map(function (t) {
        return '<button type="button" class="chip' + (draft.typeId === t.id ? " is-active" : "") +
          '" data-type="' + esc(t.id) + '">' + Icons.svg(t.icon || "tag", "icon-sm") +
          esc(tx(t.title)) + "</button>";
      }).join("");
    }
    var ways = $("[data-quote-modes]");
    if (ways) {
      ways.innerHTML = channelsOf(draft.typeId).map(function (c) {
        return '<button type="button" class="chip' + (draft.channel === c.id ? " is-active" : "") +
          '" data-mode="' + esc(c.id) + '">' + Icons.svg(c.icon, "icon-sm") +
          esc(tx(c.title)) + "</button>";
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
    settle();
    var city = draft.city ? tx(M.city(draft.city)) : I18N.t("quotes.anyCity");
    var sp = draft.specialty ? tx(M.specialty(draft.specialty)) : I18N.t("quotes.anySpecialty");
    var ch = M.channel(draft.channel);
    prev.innerHTML =
      '<p class="tiny muted">' + esc(I18N.t("bids.clientHidden")) + "</p>" +
      '<div class="anon-card" style="margin-top:var(--s-3)"><div class="row gap-3">' +
        '<span class="anon-card__mark">' + Icons.svg("user", "icon-sm") + "</span>" +
        "<div><strong class=\"small\">" + esc(I18N.t("quotes.anonId", { id: "4821" })) + "</strong>" +
        '<p class="tiny muted">' + esc(tx(typeOf(draft.typeId).title)) +
          ' <span class="dot"></span> ' + esc(ch ? tx(ch.title) : "") +
          ' <span class="dot"></span> ' + esc(city) +
          ' <span class="dot"></span> ' + esc(sp) + "</p></div>" +
      "</div></div>";
  }

  /* ================================================== client: the board === */
  function offerRow(cur, o) {
    var l = M.user(o.lawyer);
    if (!l) return "";
    var prices = M.offersOn(cur.id).map(function (x) { return x.price; });
    var best = o.price === Math.min.apply(null, prices);
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
        '<button class="btn btn--accent btn--sm" type="button" data-accept="' + esc(o.id) + '">' +
          esc(I18N.t("quotes.accept")) + "</button>" +
      "</div></article>";
  }

  function sortedOffers(cur) {
    return offers(cur).slice().sort(function (a, b) {
      if (sort === "rating") return M.ratingOf(b.lawyer).avg - M.ratingOf(a.lawyer).avg;
      if (sort === "speed") return a.eta - b.eta;
      return a.price - b.price;
    });
  }

  function drawLive() {
    var host = $("[data-quote-live]");
    var cur = mine();
    if (!host) return;

    compose.hidden = !!(cur && cur.status === "open");
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
          '<hr class="divider" style="width:100%">' +
          '<strong class="subtitle">' + esc(I18N.t("quotes.trackTitle")) + "</strong>" +
          '<p class="small muted">' + esc(I18N.t("quotes.trackBody")) + "</p>" +
          '<a class="btn btn--primary" href="requests.html' +
            (cur.requestId ? "?r=" + encodeURIComponent(cur.requestId) : "") + '">' +
            esc(I18N.t("quotes.openRequest")) + "</a>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-quote-reset>' +
            esc(I18N.t("quotes.newRequest")) + "</button></div>";
      return;
    }
    if (cur.status === "expired" || cur.status === "cancelled") {
      host.innerHTML =
        '<div class="card card--pad center stack gap-4" style="align-items:center">' +
          '<span class="feature__icon">' + Icons.svg("clock", "icon-xl") + "</span>" +
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
    var ch = M.channel(cur.channel);
    var list = offers(cur);
    host.innerHTML =
      '<div class="card card--rule-gold card--pad" style="margin-bottom:var(--s-6)">' +
        '<div class="row between wrap gap-6">' +
          '<div class="grow" style="min-width:220px">' +
            '<span class="status status--ok">' + esc(I18N.t("quotes.live")) + "</span>" +
            '<h1 class="title" style="margin-top:var(--s-3)">' + esc(cur.brief.slice(0, 90)) +
              (cur.brief.length > 90 ? "…" : "") + "</h1>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' +
              esc(tx(typeOf(cur.typeId).title)) + ' <span class="dot"></span> ' +
              esc(ch ? tx(ch.title) : "") + ' <span class="dot"></span> ' + esc(city) + "</p></div>" +
          '<div class="countdown" style="min-width:180px">' +
            '<div class="countdown__time" data-quote-clock>' + clock(left) + "</div>" +
            '<p class="tiny muted">' + esc(I18N.t("quotes.timeLeft")) + "</p></div>" +
        "</div>" +
        '<hr class="divider">' +
        '<div class="row between wrap gap-3">' +
          "<strong class=\"small\">" + esc(I18N.t("quotes.offersIn", { n: I18N.num(list.length) })) + "</strong>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-quote-cancel>' +
            esc(I18N.t("quotes.cancel")) + "</button></div>" +
      "</div>" +
      (list.length
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
  function briefCard(cur, who) {
    var city = cur.city ? tx(M.city(cur.city)) : I18N.t("quotes.anyCity");
    var spec = cur.specialty ? tx(M.specialty(cur.specialty)) : I18N.t("quotes.anySpecialty");
    var ch = M.channel(cur.channel);
    var list = M.offersOn(cur.id);
    var ours = list.filter(function (o) { return o.lawyer === who.id; })[0];
    var band = M.priceBand(cur.typeId);

    return '<article class="card card--pad" style="margin-bottom:var(--s-5)">' +
      '<div class="row between wrap gap-3" style="margin-bottom:var(--s-4)">' +
        '<strong class="subtitle">' + esc(tx(typeOf(cur.typeId).title)) + "</strong>" +
        '<span class="countdown__time" data-brief-clock="' + esc(cur.id) + '">' +
          esc(I18N.t("bids.closesIn")) + " " + clock(remaining(cur)) + "</span></div>" +

      '<div class="anon-card"><div class="row gap-3" style="align-items:flex-start">' +
        '<span class="anon-card__mark">' + Icons.svg("user", "icon-sm") + "</span>" +
        '<div class="grow" style="min-width:0">' +
          "<strong class=\"small\">" + esc(I18N.t("quotes.anonId", { id: String(cur.id).slice(0, 4) })) + "</strong>" +
          '<p class="tiny muted">' + esc(city) + ' <span class="dot"></span> ' + esc(spec) +
            ' <span class="dot"></span> ' + esc(ch ? tx(ch.title) : "") + "</p></div></div>" +
        '<p class="small" style="margin-top:var(--s-3)">' + esc(cur.brief) + "</p>" +
        '<p class="tiny faint row gap-2" style="margin-top:var(--s-3)">' + Icons.svg("lock", "icon-sm") +
          esc(I18N.t("bids.clientHidden")) + "</p></div>" +

      '<p class="tiny muted" style="margin-top:var(--s-4)">' +
        esc(I18N.t("bids.competing", { n: I18N.num(list.length) })) + "</p>" +

      (ours
        ? '<p class="status status--ok" style="width:100%;justify-content:center;margin-top:var(--s-4)">' +
            Icons.svg("check", "icon-sm") +
            esc(ours.auto ? I18N.t("bids.auto") : I18N.t("bids.already")) + " — " +
            '<span class="num">' + I18N.num(ours.price) + "</span> " + esc(I18N.t("common.sar")) + "</p>"
        : '<form class="bid-form" data-bid-form="' + esc(cur.id) + '">' +
            '<label class="field"><span class="tiny muted">' + esc(I18N.t("bids.yourPrice")) + "</span>" +
              '<input class="input num" type="number" min="' + band.min + '" max="' + band.max +
                '" step="5" data-bid-price value="' + M.quotePrice(who.id, cur.typeId) + '"></label>' +
            '<label class="field"><span class="tiny muted">' + esc(I18N.t("bids.yourEta")) + "</span>" +
              '<input class="input num" type="number" min="1" max="72" step="1" data-bid-eta value="4"></label>' +
            '<button class="btn btn--accent" type="submit">' + esc(I18N.t("bids.submit")) + "</button>" +
          "</form>") +
    "</article>";
  }

  function drawBids() {
    var host = $("[data-quote-bids]");
    if (!host) return;
    var who = me();
    host.hidden = false;

    var open = M.openQuotesFor(who.id);
    // What happened to the briefs they did bid on, whether or not they are
    // still open: a lawyer should not have to guess why a board went quiet.
    var settled = M.quotes().filter(function (q) {
      if (q.status === "open") return false;
      return M.offersOn(q.id).some(function (o) { return o.lawyer === who.id; });
    }).slice(0, 4);

    host.innerHTML =
      '<div class="row between wrap gap-3" style="margin-bottom:var(--s-5)">' +
        '<div><h1 class="headline" data-i18n="bids.title"></h1>' +
        '<p class="lead" data-i18n="bids.lead"></p></div>' +
        (who.autoBid
          ? '<span class="status status--ok">' + Icons.svg("check", "icon-sm") +
            esc(I18N.t("bids.autoOn")) + "</span>" : "") +
      "</div>" +
      (open.length
        ? '<p class="tiny muted" style="margin-bottom:var(--s-4)">' +
            esc(I18N.t("bids.openCount", { n: I18N.num(open.length) })) + "</p>" +
          open.map(function (q) { return briefCard(q, who); }).join("")
        : '<div class="card empty">' + Icons.svg("gavel", "icon-xl") +
          '<p class="subtitle">' + esc(I18N.t("bids.none")) + "</p></div>") +
      settled.map(function (q) {
        var won = q.status === "accepted" && q.acceptedBy === who.id;
        return '<p class="status ' + (won ? "status--ok" : "") + '" style="width:100%;' +
          'justify-content:center;margin-top:var(--s-3)">' +
          Icons.svg(won ? "trophy" : "clock", "icon-sm") +
          esc(I18N.t(won ? "bids.won" : "bids.lost")) + "</p>";
      }).join("");
    I18N.apply(host);
  }

  /* ================================================== the field ===========
     On the demo backend there is nobody else on the other end, so the rest of
     the board is simulated. On the real one it must not be: an offer is a row
     that belongs to the lawyer who made it, and a browser cannot write one in
     somebody else's name — nor should it. There, a lawyer who has said they
     take matching work automatically has already bid, from the database, by
     the time the brief is posted. */
  function scheduleOffers(cur) {
    offerTimers.forEach(clearTimeout);
    offerTimers = [];
    if (remote) return;

    var meId = me() ? me().id : null;
    var eligible = M.listedLawyers().filter(function (l) { return l.id !== meId; });
    var pool = eligible.filter(function (l) {
      if (cur.specialty && (l.specialties || []).indexOf(cur.specialty) === -1) return false;
      if (cur.city && l.city !== cur.city) return false;
      return true;
    });
    if (pool.length < 3) pool = eligible.slice();

    pool.slice(0, 5).forEach(function (l, i) {
      var base = M.quotePrice(l.id, cur.typeId);
      var band = M.priceBand(cur.typeId);
      // A competitive board: bids land between 25% under and 10% over list,
      // and never outside what the platform publishes.
      var factor = 0.75 + ((i * 37) % 35) / 100;
      var price = Math.min(band.max, Math.max(band.min, Math.round(base * factor / 5) * 5));
      var eta = 2 + ((i * 3) % 10);
      offerTimers.push(setTimeout(function () {
        if (Store.addOffer({ quoteId: cur.id, lawyer: l.id, price: price, eta: eta })) {
          if (cur.clientId) Store.notify({ to: cur.clientId, type: "offer", ref: l.id });
        }
      }, 2200 + i * 2600));
    });
  }

  function startTicker() {
    clearInterval(ticker);
    ticker = global.__quoteTicker = setInterval(function () {
      var cur = mine();
      var el = $("[data-quote-clock]");
      if (cur && cur.status === "open") {
        var left = remaining(cur);
        if (el) el.textContent = clock(left);
        if (left <= 0) {
          offerTimers.forEach(clearTimeout);
          Store.setQuote(cur.id, { status: "expired" });
          App.toast(I18N.t("quotes.expired"), "clock");
        }
      }
      // The lawyer's board is a list, so each brief carries its own clock.
      var any = false;
      App.$$("[data-brief-clock]").forEach(function (node) {
        var q = M.quote(node.getAttribute("data-brief-clock"));
        if (!q) return;
        any = true;
        node.textContent = I18N.t("bids.closesIn") + " " + clock(remaining(q));
      });
      if (!any && (!cur || cur.status !== "open")) clearInterval(ticker);
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
      startTicker();
      return;
    }

    if (bids) { bids.hidden = true; bids.innerHTML = ""; }
    drawCompose();
    drawLive();
    var cur = mine();
    if (cur && cur.status === "open") { startTicker(); scheduleOffers(cur); }
  });

  /* ================================================== events ============= */
  compose.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-type]");
    if (t) { draft.typeId = t.getAttribute("data-type"); drawChips(); drawPreview(); return; }
    var m = ev.target.closest("[data-mode]");
    if (m) { draft.channel = m.getAttribute("data-mode"); drawChips(); drawPreview(); return; }
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
      settle();
      if (!draft.typeId) { App.toast(I18N.t("quotes.needType"), "tag"); return; }
      if (!me()) { App.go("login.html"); return; }

      var cur = Store.openQuote({
        brief: brief, city: draft.city, specialty: draft.specialty,
        typeId: draft.typeId, channel: draft.channel, minutes: draft.window,
        expiresAt: Date.now() + draft.window * 60000,
        clientId: me().id, status: "open"
      });
      App.toast(I18N.t("quotes.published"), "check");
      startTicker();
      scheduleOffers(cur);
      global.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /** Taking an offer is where an auction stops being an auction. The work
      becomes a request carrying both names, at the price that was agreed, and
      from here on the two of them are looking at the same row. */
  function accept(offerId) {
    var cur = mine();
    if (!cur || cur.status !== "open") return;
    var offer = M.offersOn(cur.id).filter(function (o) { return o.id === offerId; })[0];
    if (!offer) return;

    offerTimers.forEach(clearTimeout);
    clearInterval(ticker);

    var kind = typeOf(cur.typeId);
    // The brief closes at once — nobody else may bid on work that has been
    // given away — and the link to the request is written when the request
    // has an id the database agrees with, which on the remote backend is one
    // round trip later.
    Store.setQuote(cur.id, { status: "accepted", acceptedBy: offer.lawyer });
    Store.addRequest({
      clientId: cur.clientId, lawyerId: offer.lawyer,
      typeId: cur.typeId, channel: cur.channel,
      title: kind.title, brief: { ar: cur.brief, en: cur.brief },
      price: offer.price, status: "new", hours: offer.eta || 4,
    }, function (saved) {
      Store.setQuote(cur.id, { requestId: saved.id });
      Store.notify({ to: offer.lawyer, type: "won", ref: saved.id });
    });

    var who = M.user(offer.lawyer);
    App.toast(I18N.t("quotes.accepted", { name: who ? tx(who.name) : "" }), "check");
  }

  var live = $("[data-quote-live]");
  if (live) {
    live.addEventListener("click", function (ev) {
      var so = ev.target.closest("[data-sort]");
      if (so) { sort = so.getAttribute("data-sort"); drawLive(); return; }

      var ac = ev.target.closest("[data-accept]");
      if (ac) { accept(ac.getAttribute("data-accept")); return; }

      if (ev.target.closest("[data-quote-cancel]")) {
        var cur = mine();
        offerTimers.forEach(clearTimeout);
        clearInterval(ticker);
        if (cur) Store.setQuote(cur.id, { status: "cancelled" });
        App.toast(I18N.t("quotes.cancelled"), "close");
        return;
      }
      // "Post another" leaves the old brief where it is. It is the record of
      // what was agreed and what it cost, and on the remote backend it is a
      // row with a request hanging off it — so this scrolls to the form
      // rather than deleting anything.
      if (ev.target.closest("[data-quote-reset]")) {
        compose.hidden = false;
        var box = $("#q-brief");
        if (box) { box.value = ""; box.focus(); }
        compose.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  var bidsHost = $("[data-quote-bids]");
  if (bidsHost) {
    bidsHost.addEventListener("submit", function (ev) {
      var f = ev.target.closest("[data-bid-form]");
      if (!f) return;
      ev.preventDefault();
      var cur = M.quote(f.getAttribute("data-bid-form"));
      if (!cur) return;
      var price = parseInt(f.querySelector("[data-bid-price]").value, 10);
      var eta = parseInt(f.querySelector("[data-bid-eta]").value, 10) || 4;
      var band = M.priceBand(cur.typeId);
      if (!price || price < band.min || price > band.max) {
        App.toast(I18N.t("bids.badPrice"), "file-text");
        return;
      }
      App.toast(I18N.t(Store.addOffer({
        quoteId: cur.id, lawyer: me().id, price: price, eta: eta,
      }) ? "bids.submitted" : "bids.already"), "check");
    });
  }
});
