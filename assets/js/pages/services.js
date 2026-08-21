/* ==========================================================================
   Services — a marketplace, a price list, or a skills sheet.

     client : every service every verified lawyer offers, filterable, orderable.
     lawyer : the same list narrowed to their own, with the price control —
              free to set, bounded by the band the platform publishes.
     intern : no services at all. A trainee lists skills instead, which is why
              the navigation slot is renamed rather than reused.
   ========================================================================== */
Pages.define("services", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-services]");
  if (!host) return;

  var filters = { type: "", specialty: "", sort: "price" };
  var skills = null;    // trainee's working copy, loaded on first draw
  var draft = {};       // the service being written
  var editing = null;   // the service being changed, if any
  var ordering = {};    // serviceId -> the channel the client has picked

  /* ====================================================== client ==========
     Two ways in, stated up front. Either the client names the service and the
     lawyers who offer it line up by price, or they describe the case once and
     let the lawyers come to them — that second road is the auction. */
  function routeCards() {
    return '<div class="grid grid-2" style="margin-bottom:var(--s-10)">' +
      '<div class="card card--pad card--rule-navy feature">' +
        '<span class="feature__icon">' + Icons.svg("tag", "icon-lg") + "</span>" +
        '<h2 class="subtitle" data-i18n="svc.routePick"></h2>' +
        '<p class="small muted" data-i18n="svc.routePickBody"></p></div>' +
      '<a class="card card--pad card--hover card--rule-gold feature" href="quotes.html">' +
        '<span class="feature__icon">' + Icons.svg("gavel", "icon-lg") + "</span>" +
        '<h2 class="subtitle" data-i18n="svc.routeAuction"></h2>' +
        '<p class="small muted" data-i18n="svc.routeAuctionBody"></p></a>' +
    "</div>";
  }

  /** Everyone who offers one service type, cheapest first by default. */
  function offersOfType(typeId) {
    var out = [];
    M.listedLawyers().forEach(function (u) {
      M.servicesOf(u.id).forEach(function (svc) {
        if (svc.typeId !== typeId) return;
        if (filters.specialty && (u.specialties || []).indexOf(filters.specialty) === -1) return;
        out.push({ svc: svc, owner: u });
      });
    });
    return out.sort(function (a, b) {
      return filters.sort === "rating"
        ? M.ratingOf(b.owner.id).avg - M.ratingOf(a.owner.id).avg
        : a.svc.price - b.svc.price;
    });
  }

  function countFor(typeId) {
    return M.listedLawyers().filter(function (u) {
      return M.servicesOf(u.id).some(function (s) { return s.typeId === typeId; });
    }).length;
  }

  function cheapestFor(typeId) {
    var all = [];
    M.listedLawyers().forEach(function (u) {
      M.servicesOf(u.id).forEach(function (s) { if (s.typeId === typeId) all.push(s.price); });
    });
    return all.length ? Math.min.apply(null, all) : null;
  }

  /* --- step one: which service --- */
  function typePicker() {
    return '<h2 class="title" style="margin-bottom:var(--s-5)" data-i18n="svc.pickType"></h2>' +
      '<div class="grid grid-3">' + M.serviceTypes().map(function (t) {
        var from = cheapestFor(t.id);
        return '<button type="button" class="card card--pad card--hover feature" ' +
          'data-pick-type="' + esc(t.id) + '" style="text-align:start">' +
          '<span class="feature__icon">' + Icons.svg(t.icon, "icon-lg") + "</span>" +
          '<h3 class="subtitle">' + esc(tx(t.title)) + "</h3>" +
          '<p class="small muted">' + esc(tx(t.meta)) + "</p>" +
          '<p class="small" style="margin-top:auto;padding-top:var(--s-3)">' +
            (from !== null
              ? esc(I18N.t("svc.fromPrice")) + ' <strong class="num">' + I18N.num(from) + "</strong> " +
                esc(I18N.t("common.sar")) + ' <span class="dot"></span> <span class="muted">' +
                esc(I18N.t("svc.offeredBy", { n: I18N.num(countFor(t.id)) })) + "</span>"
              : '<span class="muted">' + esc(I18N.t("svc.noneForType")) + "</span>") +
          "</p></button>";
      }).join("") + "</div>";
  }

  /* --- step two: who offers it --- */
  function lawyersForType() {
    var type = M.serviceType(filters.type);
    var list = offersOfType(filters.type);

    return '<div class="row between wrap gap-4" style="margin-bottom:var(--s-6)">' +
        '<h2 class="title">' + esc(I18N.t("svc.lawyersFor", { name: tx(type.title) })) + "</h2>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-clear-type>' +
          Icons.svg("arrow-back", "icon-sm") + esc(I18N.t("svc.changeType")) + "</button>" +
      "</div>" +

      '<div class="results-bar">' +
        '<div class="row gap-3 wrap">' +
          '<label class="field"><span class="label" data-i18n="dir.specialties"></span>' +
            select("specialty", global.SEED.specialties.map(function (sp) {
              return { id: sp.id, label: tx(sp) };
            }), filters.specialty, "dir.anySpecialty") + "</label>" +
          '<label class="field"><span class="label" data-i18n="dir.sortBy"></span>' +
            select("sort", [{ id: "price", label: I18N.t("svc.sortPrice") },
                            { id: "rating", label: I18N.t("svc.sortRating") }], filters.sort) + "</label>" +
        "</div>" +
        '<p class="small muted">' + esc(I18N.t("svc.found", { n: I18N.num(list.length) })) + "</p>" +
      "</div>" +

      (list.length
        ? '<div class="grid grid-2" style="margin-top:var(--s-6)">' +
          list.map(function (o, i) { return offerCard(o, type, i === 0 && filters.sort === "price"); }).join("") +
          "</div>"
        : C.empty("tag", "svc.noneForType"));
  }

  function clientView() {
    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="svc.routeTitle"></h1>' +
        '<p class="lead" data-i18n="svc.routeLead"></p></header>' +
      routeCards() +
      (filters.type ? lawyersForType() : typePicker()) +
    "</div>";
  }

  function select(name, items, value, anyKey) {
    return '<select class="select" data-filter="' + name + '">' +
      (anyKey ? '<option value="">' + esc(I18N.t(anyKey)) + "</option>" : "") +
      items.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === value ? " selected" : "") + ">" +
          esc(o.label) + "</option>";
      }).join("") + "</select>";
  }

  function offerCard(o, type, best) {
    var named = M.serviceTitle(o.svc);
    return '<article class="card card--pad card--hover' + (best ? " card--rule-gold" : "") + '">' +
      '<div class="row between wrap gap-3">' +
        '<span class="row gap-3">' + C.avatar(o.owner, "sm") +
          "<span>" + C.personLink(o.owner) +
            '<p class="tiny muted">' + esc(tx(named)) + "</p></span></span>" +
        '<strong class="title"><span class="num">' + I18N.num(o.svc.price) + "</span> " +
          esc(I18N.t("common.sar")) + "</strong>" +
      "</div>" +
      '<div class="meta-row" style="margin-top:var(--s-4)">' + C.ratingLine(o.owner.id) +
        '<span class="dot"></span><span class="muted">' +
          esc(I18N.t("lawyer.years", { n: I18N.num(o.owner.years || 0) })) + "</span>" +
        (best ? '<span class="dot"></span><span class="tag">' +
          esc(I18N.t("quotes.bestPrice")) + "</span>" : "") +
      "</div>" +
      '<div style="margin-top:var(--s-4)">' +
        '<span class="tiny muted" data-i18n="svc.pickChannel"></span>' +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' +
          M.serviceChannels(o.svc).map(function (id, i) {
            var c = M.channel(id);
            var on = (ordering[o.svc.id] || M.serviceChannels(o.svc)[0]) === id;
            return '<button type="button" class="chip' + (on ? " is-active" : "") +
              '" data-order-channel="' + esc(id) + '" data-svc="' + esc(o.svc.id) + '">' +
              Icons.svg(c.icon, "icon-sm") + esc(tx(c.title)) + "</button>";
          }).join("") +
        "</div></div>" +
      '<div class="row between wrap gap-3" style="margin-top:var(--s-5);padding-top:var(--s-4);' +
        'border-top:1px solid var(--border)">' +
        '<span class="tiny muted">' + esc(tx(M.serviceMeta(o.svc))) + "</span>" +
        '<button class="btn btn--primary btn--sm" type="button" data-order="' + esc(o.svc.id) + '" ' +
          'data-i18n="req.order"></button>' +
      "</div></article>";
  }

  /* ====================================================== lawyer ==========
     The lawyer writes the service themselves — its name and its turnaround.
     The category behind it is not a label, it is the price band: whatever they
     charge has to sit between the platform's floor and ceiling for that kind
     of work, which is what stops both undercutting and gouging. */
  /** The channels the lawyer is offering on the service being written. Starts
      from whatever the category allows, so the common case needs no clicks. */
  function draftChannels(cat) {
    if (!draft.channels) draft.channels = M.channelsFor(cat).slice();
    return draft.channels.filter(function (c) {
      return M.channelsFor(cat).indexOf(c) !== -1;
    });
  }

  function channelPicker(cat) {
    var on = draftChannels(cat);
    return '<div class="field"><span class="label" data-i18n="svc.channels"></span>' +
      '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' +
        M.channelsFor(cat).map(function (id) {
          var c = M.channel(id);
          return '<button type="button" class="chip' +
            (on.indexOf(id) !== -1 ? " is-active" : "") + '" data-channel="' + esc(id) + '">' +
            Icons.svg(c.icon, "icon-sm") + esc(tx(c.title)) + "</button>";
        }).join("") +
      "</div>" +
      '<span class="tiny faint" data-i18n="svc.channelsHint"></span></div>';
  }

  function lawyerView() {
    var me = Session.user();
    var mine = M.servicesOf(me.id);
    var types = M.serviceTypes();
    var cat = editing ? editing.typeId : (draft.typeId || types[0].id);
    var band = M.priceBand(cat);

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="svc.mine"></h1>' +
        '<p class="lead" data-i18n="svc.mineLead"></p></header>' +
      (Session.isVerified() ? "" :
        '<p class="note-inline" style="margin-bottom:var(--s-6)" data-i18n="svc.pendingNote"></p>') +

      '<div class="grid dash-split">' +
        '<section class="card card--pad">' +
          (mine.length
            ? '<div class="req-list">' + mine.map(myServiceRow).join("") + "</div>"
            : '<p class="small muted" data-i18n="svc.noneMine"></p>') +
        "</section>" +

        '<aside class="stack gap-4">' +
        '<section class="card card--pad">' +
          '<label class="row between gap-3">' +
            '<span><strong data-i18n="svc.autoBid"></strong>' +
              '<span class="tiny muted" style="display:block" data-i18n="svc.autoBidHint"></span></span>' +
            '<input type="checkbox" data-auto-bid' + (me.autoBid ? " checked" : "") + "></label>" +
          '<p class="tiny ' + (me.autoBid ? "" : "muted") + '" style="margin-top:var(--s-3)" data-i18n="' +
            (me.autoBid ? "svc.autoBidOn" : "svc.autoBidOff") + '"></p>' +
          // Switching it on is not enough on its own: the database only bids
          // on behalf of an account whose licence has been checked. Saying so
          // here beats a lawyer watching a board that will never call them.
          (me.autoBid && me.status !== "verified"
            ? '<p class="note-inline" style="margin-top:var(--s-3)" data-i18n="svc.autoNeedsApproval"></p>'
            : "") +
        "</section>" +
        '<section class="card card--pad">' +
          '<h2 class="subtitle" data-i18n="' + (editing ? "svc.editTitle" : "svc.addTitle") + '"></h2>' +
          '<div class="stack gap-4" style="margin-top:var(--s-5)">' +
            '<label class="field"><span class="label" data-i18n="svc.category"></span>' +
              '<select class="select" data-new-type>' + types.map(function (t) {
                return '<option value="' + esc(t.id) + '"' + (cat === t.id ? " selected" : "") + ">" +
                  esc(tx(t.title)) + "</option>";
              }).join("") + "</select>" +
              '<span class="tiny faint" data-i18n="svc.categoryHint"></span></label>' +

            '<label class="field"><span class="label" data-i18n="svc.customTitle"></span>' +
              '<input class="input" data-new-title value="' + esc(draft.title || "") + '" ' +
                'placeholder="' + esc(tx(M.serviceType(cat).title)) + '">' +
              '<span class="tiny faint" data-i18n="svc.customTitleHint"></span></label>' +

            '<label class="field"><span class="label" data-i18n="svc.customMeta"></span>' +
              '<input class="input" data-new-meta value="' + esc(draft.meta || "") + '" ' +
                'placeholder="' + esc(tx(M.serviceType(cat).meta)) + '"></label>' +

            '<label class="field"><span class="label" data-i18n="svc.priceLabel"></span>' +
              '<input class="input num" type="number" data-new-price dir="ltr" ' +
                'min="' + band.min + '" max="' + band.max + '" ' +
                'value="' + (draft.price != null ? draft.price : "") + '"></label>' +
            channelPicker(cat) +
            '<p class="tiny muted" data-band></p>' +
            '<p class="form-error" data-svc-error hidden></p>' +
            '<div class="row gap-2">' +
              '<button class="btn btn--primary" type="button" data-add-svc data-i18n="' +
                (editing ? "svc.saveChanges" : "svc.add") + '"></button>' +
              (editing ? '<button class="btn btn--ghost" type="button" data-cancel-edit ' +
                'data-i18n="signup.back"></button>' : "") +
            "</div>" +
          "</div>" +
        "</section></aside>" +
      "</div></div>";
  }

  function myServiceRow(s) {
    var band = M.priceBand(s.typeId);
    var type = M.serviceType(s.typeId) || {};
    var name = tx(M.serviceTitle(s));
    var category = tx(type.title || {});
    return '<div class="req-row">' +
      '<span class="req-row__icon">' + Icons.svg(M.serviceIcon(s), "icon-sm") + "</span>" +
      '<div class="grow" style="min-width:0">' +
        '<div class="row gap-2 wrap"><strong class="small">' + esc(name) + "</strong>" +
          // The category tag only earns its place when it says something new.
          (name === category ? "" : '<span class="tag">' + esc(category) + "</span>") + "</div>" +
        '<p class="tiny muted">' + esc(tx(M.serviceMeta(s))) + "</p>" +
        '<p class="tiny faint">' + esc(I18N.t("svc.band",
          { min: I18N.num(band.min), max: I18N.num(band.max) })) + "</p>" +
      "</div>" +
      '<div class="req-row__side"><div class="row gap-2">' +
        '<strong class="small"><span class="num">' + I18N.num(s.price) + "</span> " +
          esc(I18N.t("common.sar")) + "</strong>" +
        '<button class="icon-btn" type="button" data-edit-svc="' + esc(s.id) + '" ' +
          'data-i18n-attr="aria-label:svc.editTitle">' + Icons.svg("edit", "icon-sm") + "</button>" +
        '<button class="icon-btn" type="button" data-del-svc="' + esc(s.id) + '" ' +
          'data-i18n-attr="aria-label:svc.remove">' + Icons.svg("trash", "icon-sm") + "</button>" +
      "</div></div></div>";
  }

  /* ====================================================== intern ========== */
  function internView() {
    var me = Session.user();
    if (skills === null) skills = (me.skills || []).map(function (s) { return tx(s); });

    return '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:760px">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="skills.heading"></h1>' +
        '<p class="lead" data-i18n="skills.lead"></p></header>' +
      '<section class="card card--pad">' +
        '<div class="chip-input">' +
          '<input class="input" data-skill-input data-i18n-attr="placeholder:skills.placeholder">' +
          '<button class="btn btn--outline btn--sm" type="button" data-skill-add data-i18n="svc.add"></button>' +
        "</div>" +
        '<div class="row gap-2 wrap" style="margin-top:var(--s-5)">' +
          (skills.length
            ? skills.map(function (sk, i) {
                return '<span class="chip is-active">' + esc(sk) +
                  '<button type="button" data-skill-del="' + i + '" aria-label="x">' +
                  Icons.svg("close", "icon-sm") + "</button></span>";
              }).join("")
            : '<span class="tiny faint" data-i18n="skills.none"></span>') +
        "</div>" +
        '<button class="btn btn--primary" type="button" style="margin-top:var(--s-6)" ' +
          'data-skill-save data-i18n="skills.save"></button>' +
      "</section></div>";
  }

  /* ====================================================== draw ============ */
  App.onRender(function () {
    var role = Session.role();
    host.innerHTML = role === "lawyer" ? lawyerView()
                   : role === "intern" ? internView()
                   : clientView();
    I18N.apply(host);
    showBand();
  });

  function showBand() {
    var sel = $("[data-new-type]", host), out = $("[data-band]", host);
    if (!sel || !out) return;
    var band = M.priceBand(sel.value);
    out.textContent = I18N.t("svc.band", { min: I18N.num(band.min), max: I18N.num(band.max) });
  }

  function readForm() {
    var g = function (sel) { var el = $(sel, host); return el ? el.value.trim() : ""; };
    return {
      typeId: g("[data-new-type]"),
      title: g("[data-new-title]"),
      meta: g("[data-new-meta]"),
      price: +g("[data-new-price]")
    };
  }

  function svcError(key) {
    var el = $("[data-svc-error]", host);
    if (!el) return;
    el.hidden = !key;
    if (key) el.textContent = I18N.t(key);
  }

  /* ====================================================== events ========== */
  host.addEventListener("change", function (ev) {
    var f = ev.target.closest("[data-filter]");
    if (f) { filters[f.getAttribute("data-filter")] = f.value; App.rerender(); return; }
    if (ev.target.closest("[data-auto-bid]")) {
      Store.updateAccount(Session.user().id, { autoBid: !!ev.target.checked });
      App.toast(I18N.t(ev.target.checked ? "svc.autoBidOn" : "svc.autoBidOff"), "check");
      return;
    }
    if (ev.target.closest("[data-new-type]")) {
      var keep = draft.channels;
      draft = readForm();
      // A category change resets the channels to whatever the new one allows,
      // rather than carrying over a choice that may no longer be permitted.
      draft.channels = null;
      showBand();
      App.rerender();
      return;
    }

    // Editing a live price in place: validated against the band, saved at once.
    var pf = ev.target.closest("[data-price-for]");
    if (pf) {
      var id = pf.getAttribute("data-price-for");
      var s = M.servicesOf(Session.user().id).filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var price = +pf.value;
      var bad = M.checkPrice(s.typeId, price);
      if (bad) {
        App.toast(I18N.t(bad === "low" ? "svc.tooLow" : bad === "high" ? "svc.tooHigh" : "svc.empty"), "close");
        pf.value = s.price;
        return;
      }
      Store.removeService(s.id);
      Store.addService({ id: s.id, ownerId: s.ownerId, typeId: s.typeId, price: price, active: true });
      App.toast(I18N.t("svc.added"), "check");
    }
  });

  host.addEventListener("click", function (ev) {
    var t = ev.target;

    var pt = t.closest("[data-pick-type]");
    if (pt) { filters.type = pt.getAttribute("data-pick-type"); App.rerender(); return; }
    if (t.closest("[data-clear-type]")) { filters.type = ""; App.rerender(); return; }

    var oc = t.closest("[data-order-channel]");
    if (oc) {
      ordering[oc.getAttribute("data-svc")] = oc.getAttribute("data-order-channel");
      App.rerender();
      return;
    }

    var ord = t.closest("[data-order]");
    if (ord) {
      if (Session.isGuest()) { App.toast(I18N.t("svc.orderSignIn"), "lock");
        setTimeout(function () { App.go("login.html"); }, 900); return; }
      var all = offersOfType(filters.type);
      var pick = null;
      for (var i = 0; i < all.length; i++) if (all[i].svc.id === ord.getAttribute("data-order")) pick = all[i];
      if (!pick) return;
      var chosen = ordering[pick.svc.id] || M.serviceChannels(pick.svc)[0];
      // One at a time. The database refuses a second one anyway; this is so
      // the person is told why rather than shown an error about a row.
      var blocking = M.blockingRequest(Session.user().id);
      if (blocking) {
        App.toast(I18N.t("req.oneAtATimeBody"), "lock");
        App.go("requests.html");
        return;
      }
      Store.addRequest({
        clientId: Session.user().id, lawyerId: pick.owner.id, typeId: pick.svc.typeId,
        channel: chosen,
        // Something to draft is something written; a call is not.
        price: pick.svc.price, status: "new", ai: !M.channel(chosen).live, hours: 3,
        title: M.serviceTitle(pick.svc),
        brief: { ar: "", en: "" },
        ago: { ar: I18N.t("common.today"), en: I18N.t("common.today") }
      });
      App.toast(I18N.t("req.ordered", { name: tx(pick.owner.name) }), "check");
      setTimeout(function () { App.go("requests.html"); }, 1000);
      return;
    }

    if (t.closest("[data-add-svc]")) {
      var f = readForm();
      var bad = M.checkPrice(f.typeId, f.price);
      if (bad) { svcError(bad === "low" ? "svc.tooLow" : bad === "high" ? "svc.tooHigh" : "svc.empty"); return; }
      var chosen = draftChannels(f.typeId);
      // A service nobody can be reached through is not a service.
      if (!chosen.length) { svcError("svc.needChannel"); return; }
      svcError(null);
      var record = {
        ownerId: Session.user().id, typeId: f.typeId, price: f.price, active: true,
        channels: chosen,
        title: f.title ? { ar: f.title, en: f.title } : null,
        meta: f.meta ? { ar: f.meta, en: f.meta } : null
      };
      if (editing) {
        record.id = editing.id;
        Store.removeService(editing.id);
        editing = null;
      }
      Store.addService(record);
      draft = {};
      App.toast(I18N.t(record.id ? "svc.updated" : "svc.added"), "check");
      return;
    }

    var ed = t.closest("[data-edit-svc]");
    if (ed) {
      var found = M.servicesOf(Session.user().id)
        .filter(function (x) { return x.id === ed.getAttribute("data-edit-svc"); })[0];
      if (!found) return;
      editing = found;
      draft = { typeId: found.typeId, price: found.price,
                channels: M.serviceChannels(found).slice(),
                title: found.title ? tx(found.title) : "", meta: found.meta ? tx(found.meta) : "" };
      App.rerender();
      return;
    }

    var ch = t.closest("[data-channel]");
    if (ch) {
      var id = ch.getAttribute("data-channel");
      var cat = editing ? editing.typeId : (draft.typeId || M.serviceTypes()[0].id);
      var list = draftChannels(cat);
      var at = list.indexOf(id);
      draft.channels = at === -1 ? list.concat([id])
                                 : list.filter(function (x) { return x !== id; });
      App.rerender();
      return;
    }

    if (t.closest("[data-cancel-edit]")) { editing = null; draft = {}; App.rerender(); return; }

    var del = t.closest("[data-del-svc]");
    if (del) {
      if (editing && editing.id === del.getAttribute("data-del-svc")) { editing = null; draft = {}; }
      Store.removeService(del.getAttribute("data-del-svc"));
      App.toast(I18N.t("svc.removed"), "trash");
      return;
    }

    if (t.closest("[data-skill-add]")) { addSkill(); return; }

    var sd = t.closest("[data-skill-del]");
    if (sd) { skills.splice(+sd.getAttribute("data-skill-del"), 1); App.rerender(); return; }

    if (t.closest("[data-skill-save]")) {
      Store.updateAccount(Session.user().id, {
        skills: skills.map(function (s) { return { ar: s, en: s }; })
      });
      App.toast(I18N.t("skills.saved"), "check");
    }
  });

  host.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && ev.target.matches("[data-skill-input]")) { ev.preventDefault(); addSkill(); }
  });

  function addSkill() {
    var input = $("[data-skill-input]", host);
    var v = input.value.trim();
    if (!v || skills.indexOf(v) !== -1) return;
    skills.push(v);
    App.rerender();
  }
});
