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
  var skills = null;   // trainee's working copy, loaded on first draw

  /* ====================================================== client ========== */
  function offers() {
    var out = [];
    M.listedLawyers().forEach(function (u) {
      M.servicesOf(u.id).forEach(function (s) {
        out.push({ svc: s, owner: u, type: M.serviceType(s.typeId) });
      });
    });
    return out.filter(function (o) {
      if (!o.type) return false;
      if (filters.type && o.svc.typeId !== filters.type) return false;
      if (filters.specialty && (o.owner.specialties || []).indexOf(filters.specialty) === -1) return false;
      return true;
    }).sort(function (a, b) {
      return filters.sort === "rating"
        ? M.ratingOf(b.owner.id).avg - M.ratingOf(a.owner.id).avg
        : a.svc.price - b.svc.price;
    });
  }

  function clientView() {
    var list = offers();
    return '<div class="container" style="padding-block:var(--s-10) var(--s-20)">' +
      '<header style="margin-bottom:var(--s-8)">' +
        '<h1 class="headline" data-i18n="svc.heading"></h1>' +
        '<p class="lead" data-i18n="svc.lead"></p></header>' +

      '<div class="results-bar">' +
        '<div class="row gap-3 wrap">' +
          '<label class="field"><span class="label" data-i18n="svc.filterType"></span>' +
            select("type", M.serviceTypes().map(function (t) { return { id: t.id, label: tx(t.title) }; }),
                   filters.type, "svc.allTypes") + "</label>" +
          '<label class="field"><span class="label" data-i18n="dir.specialties"></span>' +
            select("specialty", global.SEED.specialties.map(function (s) { return { id: s.id, label: tx(s) }; }),
                   filters.specialty, "dir.anySpecialty") + "</label>" +
          '<label class="field"><span class="label" data-i18n="dir.sortBy"></span>' +
            select("sort", [{ id: "price", label: I18N.t("svc.sortPrice") },
                            { id: "rating", label: I18N.t("svc.sortRating") }], filters.sort) + "</label>" +
        "</div>" +
        '<p class="small muted">' + esc(I18N.t("svc.found", { n: I18N.num(list.length) })) + "</p>" +
      "</div>" +

      (list.length
        ? '<div class="grid grid-2" style="margin-top:var(--s-6)">' + list.map(offerCard).join("") + "</div>"
        : C.empty("tag", "svc.none")) +
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

  function offerCard(o) {
    return '<article class="card card--pad card--hover">' +
      '<div class="row between wrap gap-3">' +
        '<div class="row gap-3"><span class="stat__icon">' + Icons.svg(o.type.icon, "icon-sm") + "</span>" +
          '<div><h3 class="subtitle">' + esc(tx(o.type.title)) + "</h3>" +
            '<p class="tiny muted">' + esc(tx(o.type.meta)) + "</p></div></div>" +
        '<strong class="title"><span class="num">' + I18N.num(o.svc.price) + "</span> " +
          esc(I18N.t("common.sar")) + "</strong>" +
      "</div>" +
      '<div class="row between wrap gap-3" style="margin-top:var(--s-5);padding-top:var(--s-4);' +
        'border-top:1px solid var(--border)">' +
        '<span class="row gap-2 small">' + C.avatar(o.owner, "sm") + C.personLink(o.owner) +
          '<span class="dot"></span>' + C.ratingLine(o.owner.id) + "</span>" +
        '<button class="btn btn--primary btn--sm" type="button" data-order="' + esc(o.svc.id) + '" ' +
          'data-i18n="req.order"></button>' +
      "</div></article>";
  }

  /* ====================================================== lawyer ========== */
  function lawyerView() {
    var me = Session.user();
    var mine = M.servicesOf(me.id);
    var taken = mine.map(function (s) { return s.typeId; });
    var open = M.serviceTypes().filter(function (t) { return taken.indexOf(t.id) === -1; });

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

        '<aside class="card card--pad">' +
          '<h2 class="subtitle" data-i18n="svc.addTitle"></h2>' +
          (open.length
            ? '<div class="stack gap-4" style="margin-top:var(--s-5)">' +
                '<label class="field"><span class="label" data-i18n="svc.filterType"></span>' +
                  '<select class="select" data-new-type>' + open.map(function (t) {
                    return '<option value="' + esc(t.id) + '">' + esc(tx(t.title)) + "</option>";
                  }).join("") + "</select></label>" +
                '<label class="field"><span class="label" data-i18n="svc.priceLabel"></span>' +
                  '<input class="input num" type="number" data-new-price dir="ltr"></label>' +
                '<p class="tiny muted" data-band></p>' +
                '<p class="form-error" data-svc-error hidden></p>' +
                '<button class="btn btn--primary" type="button" data-add-svc data-i18n="svc.add"></button>' +
              "</div>"
            : '<p class="small muted" style="margin-top:var(--s-4)" data-i18n="svc.allTaken"></p>') +
        "</aside>" +
      "</div></div>";
  }

  function myServiceRow(s) {
    var t = M.serviceType(s.typeId) || {};
    var band = M.priceBand(s.typeId);
    return '<div class="req-row">' +
      '<span class="req-row__icon">' + Icons.svg(t.icon || "tag", "icon-sm") + "</span>" +
      '<div class="grow" style="min-width:0">' +
        "<strong class=\"small\">" + esc(tx(t.title || {})) + "</strong>" +
        '<p class="tiny muted">' + esc(tx(t.meta || {})) + "</p>" +
        '<p class="tiny faint">' + esc(I18N.t("svc.band",
          { min: I18N.num(band.min), max: I18N.num(band.max) })) + "</p>" +
      "</div>" +
      '<div class="req-row__side"><div class="row gap-2">' +
        '<input class="input num" type="number" dir="ltr" style="width:96px" ' +
          'value="' + s.price + '" data-price-for="' + esc(s.id) + '">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-del-svc="' + esc(s.id) + '" ' +
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
    if (ev.target.closest("[data-new-type]")) { showBand(); return; }

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

    var ord = t.closest("[data-order]");
    if (ord) {
      if (Session.isGuest()) { App.toast(I18N.t("svc.orderSignIn"), "lock");
        setTimeout(function () { App.go("login.html"); }, 900); return; }
      var all = offers();
      var pick = null;
      for (var i = 0; i < all.length; i++) if (all[i].svc.id === ord.getAttribute("data-order")) pick = all[i];
      if (!pick) return;
      Store.addRequest({
        clientId: Session.user().id, lawyerId: pick.owner.id, typeId: pick.svc.typeId,
        price: pick.svc.price, status: "new", ai: pick.type.tier === "quick", hours: 3,
        title: pick.type.title,
        brief: { ar: "", en: "" },
        ago: { ar: I18N.t("common.today"), en: I18N.t("common.today") }
      });
      App.toast(I18N.t("req.ordered", { name: tx(pick.owner.name) }), "check");
      setTimeout(function () { App.go("requests.html"); }, 1000);
      return;
    }

    if (t.closest("[data-add-svc]")) {
      var sel = $("[data-new-type]", host), input = $("[data-new-price]", host);
      var price = +input.value;
      var bad = M.checkPrice(sel.value, price);
      if (bad) { svcError(bad === "low" ? "svc.tooLow" : bad === "high" ? "svc.tooHigh" : "svc.empty"); return; }
      svcError(null);
      Store.addService({ ownerId: Session.user().id, typeId: sel.value, price: price, active: true });
      App.toast(I18N.t("svc.added"), "check");
      return;
    }

    var del = t.closest("[data-del-svc]");
    if (del) { Store.removeService(del.getAttribute("data-del-svc"));
      App.toast(I18N.t("svc.removed"), "trash"); return; }

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
