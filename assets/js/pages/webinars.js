/* ==========================================================================
   Workshops — a lawyer teaching a room rather than answering one person.

   It is not a request and could not be squeezed into one: what is sold is a
   seat, the room has a ceiling, and the money splits at the door rather than
   on delivery. So it has its own page, its own tables, and one rule that
   shapes the whole of it — the seat carries the price it was bought at, so a
   host raising theirs cannot reach the people already booked.
   ========================================================================== */
Pages.define("webinars", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-webinars]");
  if (!host) return;

  var opening = false;          // the host's form, open or not
  var error = null;
  /* What has been typed so far. Held here because the page redraws whenever
     anything changes — and a form that empties itself to tell you the date is
     wrong makes you type the whole thing again to fix one field. */
  var draft = { title: "", brief: "", when: "", seats: "20", price: "0",
                minutes: "60", audience: "intern" };

  var AUD = { intern: "web.forInterns", client: "web.forClients", all: "web.forAll" };

  function when(w) {
    var at = new Date(w.startsAt).getTime();
    return C.stamp(at) + " · " + esc(I18N.t("web.minutes", { n: I18N.num(w.minutes || 60) }));
  }

  /* ---------- one workshop, as somebody who might attend sees it ---------- */
  function card(w, me) {
    var lawyer = M.user(w.hostId);
    var split = M.ticketSplit(w);
    var seat = me ? Store.seatOf(w.id, me.id) : null;
    var gone = w.status === "cancelled";
    var started = new Date(w.startsAt).getTime() <= Date.now();

    return '<article class="card card--pad" style="margin-bottom:var(--s-4)" ' +
        'data-webinar="' + esc(w.id) + '">' +
      '<div class="row between wrap gap-3">' +
        "<div><h2 class=\"subtitle\">" + esc(tx(w.title)) + "</h2>" +
          '<span class="tiny muted num" dir="ltr">' + esc(w.ref || "") + "</span></div>" +
        '<span class="row gap-2">' +
          '<span class="tag">' + esc(I18N.t(AUD[w.audience] || "web.forAll")) + "</span>" +
          "<strong>" + (w.price ? C.sar(Math.round(w.price * 100))
                                : esc(I18N.t("web.free"))) + "</strong>" +
        "</span>" +
      "</div>" +

      (tx(w.brief) ? '<p class="small muted" style="margin-top:var(--s-2)">' +
        esc(tx(w.brief)) + "</p>" : "") +

      '<div class="meta-row" style="margin-top:var(--s-3)">' +
        '<span class="row gap-2">' + Icons.svg("scale", "icon-sm") +
          '<span class="tiny muted">' + esc(I18N.t("web.host")) + ":</span> " +
          (lawyer ? C.personLink(lawyer) : "") + "</span>" +
        '<span class="dot"></span>' +
        '<span class="tiny muted">' + esc(I18N.t("web.when")) + ": " + when(w) + "</span>" +
        '<span class="dot"></span>' +
        // How many are left, not how many were sold: the number somebody
        // deciding whether to book actually needs.
        '<span class="tiny ' + (split.left ? "muted" : "") + '"' +
          (split.left ? "" : ' style="color:var(--warning)"') + ">" +
          esc(split.left ? I18N.t("web.seats", { n: I18N.num(split.left) })
                         : I18N.t("web.full")) + "</span>" +
      "</div>" +

      '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
        (gone
          ? '<span class="status status--muted">' + esc(I18N.t("web.cancelled")) + "</span>"
          : seat
            ? '<span class="status status--ok">' + esc(I18N.t("web.booked")) + "</span>" +
              (started
                ? '<a class="btn btn--primary btn--sm" href="call.html?room=' + esc(w.id) + '">' +
                  Icons.svg("video", "icon-sm") + esc(I18N.t("web.join")) + "</a>"
                : '<button class="btn btn--ghost btn--sm" type="button" data-web-drop="' +
                  esc(w.id) + '">' + esc(I18N.t("web.drop")) + "</button>")
            : (started || !split.left
                ? '<span class="status status--muted">' +
                  esc(I18N.t(started ? "web.started" : "web.full")) + "</span>"
                : '<button class="btn btn--primary btn--sm" type="button" data-web-book="' +
                  esc(w.id) + '">' + Icons.svg("check", "icon-sm") +
                  esc(I18N.t("web.book")) + "</button>")) +
      "</div>" +
    "</article>";
  }

  /* ---------- and as the person running it sees it ---------- */
  function hostCard(w) {
    var split = M.ticketSplit(w);
    var seats = Store.seats(w.id);
    return '<article class="card card--pad" style="margin-bottom:var(--s-4)">' +
      '<div class="row between wrap gap-3">' +
        "<div><h3 class=\"subtitle\">" + esc(tx(w.title)) + "</h3>" +
          '<span class="tiny muted">' + when(w) + "</span></div>" +
        '<span class="status status--' + (w.status === "cancelled" ? "muted" : "ok") + '">' +
          esc(I18N.t(w.status === "cancelled" ? "web.cancelled"
                     : "web.sold", { n: I18N.num(split.sold), t: I18N.num(split.seats) })) +
        "</span>" +
      "</div>" +
      '<div class="meta-row" style="margin-top:var(--s-3)">' +
        '<span class="tiny muted">' + esc(I18N.t("web.takings")) + ": " +
          C.sar(split.gross) + "</span>" +
        '<span class="dot"></span>' +
        // What reaches them, said the same way it is said everywhere else on
        // this platform: their share, never the gross.
        '<span class="tiny muted">' + esc(I18N.t("web.yours")) + ": <strong>" +
          C.sar(split.host) + "</strong></span>" +
      "</div>" +
      '<p class="tiny faint" style="margin-top:var(--s-3)">' +
        esc(I18N.t("web.attending")) + "</p>" +
      (seats.length
        ? '<div class="row gap-2 wrap" style="margin-top:var(--s-2)">' +
          seats.map(function (s) {
            var u = M.user(s.holderId);
            return '<span class="row gap-2 small">' + C.avatar(u, "sm") +
              esc(u ? tx(u.name) : "") + "</span>";
          }).join("") + "</div>"
        : '<p class="small muted">' + esc(I18N.t("web.noSeats")) + "</p>") +
      (w.status !== "cancelled"
        ? '<button class="btn btn--ghost btn--sm" style="margin-top:var(--s-4)" ' +
          'type="button" data-web-cancel="' + esc(w.id) + '">' +
          esc(I18N.t("web.cancel")) + "</button>"
        : "") +
    "</article>";
  }

  function form() {
    return '<section class="card card--pad" style="margin-bottom:var(--s-6)">' +
      '<div class="grid grid-2" style="gap:var(--s-3)">' +
        '<label class="field"><span class="label" data-i18n="web.newTitle"></span>' +
          '<input class="input" data-web-title value="' + esc(draft.title) + '"></label>' +
        '<label class="field"><span class="label" data-i18n="web.newWhen"></span>' +
          '<input class="input" type="datetime-local" dir="ltr" data-web-when value="' +
            esc(draft.when) + '"></label>' +
      "</div>" +
      '<label class="field" style="margin-top:var(--s-3)">' +
        '<span class="label" data-i18n="web.newBrief"></span>' +
        '<textarea class="input" rows="2" data-web-brief>' + esc(draft.brief) +
        "</textarea></label>" +
      '<div class="grid grid-2" style="gap:var(--s-3);margin-top:var(--s-3)">' +
        '<label class="field"><span class="label" data-i18n="web.newSeats"></span>' +
          '<input class="input" type="number" min="1" max="500" data-web-seats value="' +
            esc(draft.seats) + '"></label>' +
        '<label class="field"><span class="label" data-i18n="web.newPrice"></span>' +
          '<input class="input" type="number" min="0" data-web-price value="' +
            esc(draft.price) + '"></label>' +
      "</div>" +
      '<div class="grid grid-2" style="gap:var(--s-3);margin-top:var(--s-3)">' +
        '<label class="field"><span class="label" data-i18n="web.newMinutes"></span>' +
          '<input class="input" type="number" min="15" max="480" data-web-minutes value="' +
            esc(draft.minutes) + '"></label>' +
        '<label class="field"><span class="label" data-i18n="web.newAudience"></span>' +
          '<select class="select" data-web-audience>' +
            ["intern", "client", "all"].map(function (a) {
              return '<option value="' + a + '"' +
                (draft.audience === a ? " selected" : "") + ">" +
                esc(I18N.t(AUD[a])) + "</option>";
            }).join("") +
          "</select></label>" +
      "</div>" +
      (error ? '<p class="tiny" style="margin-top:var(--s-3);color:var(--danger)">' +
        esc(I18N.t(error)) + "</p>" : "") +
      '<button class="btn btn--primary btn--sm" style="margin-top:var(--s-4)" ' +
        'type="button" data-web-publish>' + Icons.svg("send", "icon-sm") +
        esc(I18N.t("web.publish")) + "</button>" +
    "</section>";
  }

  App.onRender(function () {
    var me = Session.user();
    var canHost = me && Session.is("lawyer") && me.status === "verified";
    var list = M.webinarsFor(me);
    var mine = canHost
      ? Store.webinars().filter(function (w) { return w.hostId === me.id; })
        .sort(function (a, b) {
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        })
      : [];

    host.innerHTML =
      '<header style="margin-bottom:var(--s-8);max-width:660px">' +
        '<h1 class="headline" data-i18n="web.heading"></h1>' +
        '<p class="lead" data-i18n="web.lead"></p></header>' +

      (canHost
        ? '<div class="row between wrap gap-3" style="margin-bottom:var(--s-4)">' +
            '<h2 class="subtitle" data-i18n="web.mine"></h2>' +
            '<button class="btn btn--outline btn--sm" type="button" data-web-open>' +
              Icons.svg("plus", "icon-sm") + esc(I18N.t("web.create")) + "</button></div>" +
          (opening ? form() : "") +
          mine.map(hostCard).join("")
        : "") +

      (list.length
        ? list.map(function (w) { return card(w, me); }).join("")
        : (canHost ? "" : C.empty("calendar", "web.none"))) +

      (!me
        ? '<p class="disclaimer" style="margin-top:var(--s-5)">' + Icons.svg("lock", "icon-sm") +
          "<span>" + esc(I18N.t("web.signIn")) + "</span></p>"
        : "");

    I18N.apply(host);
  });

  /* Every field, into the draft, so a redraw does not lose it. */
  var FIELDS = { "data-web-title": "title", "data-web-brief": "brief",
                 "data-web-when": "when", "data-web-seats": "seats",
                 "data-web-price": "price", "data-web-minutes": "minutes",
                 "data-web-audience": "audience" };

  function keep() {
    Object.keys(FIELDS).forEach(function (attr) {
      var el = $("[" + attr + "]", host);
      if (el) draft[FIELDS[attr]] = el.value;
    });
  }

  host.addEventListener("input", keep);
  host.addEventListener("change", keep);

  host.addEventListener("click", function (ev) {
    var t = ev.target;
    var hit = function (a) { var el = t.closest("[" + a + "]"); return el ? el.getAttribute(a) : null; };
    var me = Session.user();

    if (t.closest("[data-web-open]")) { opening = !opening; error = null; App.rerender(); return; }

    var book = hit("data-web-book");
    if (book) {
      if (!me) { App.toast(I18N.t("web.signIn"), "lock"); return; }
      var got = Store.takeSeat(book, me.id);
      if (typeof got === "string") {
        App.toast(I18N.t(got === "full" ? "web.wasFull" : "web.started"), "alert");
      } else {
        App.toast(I18N.t("web.tookSeat"), "check");
      }
      App.rerender();
      return;
    }

    var drop = hit("data-web-drop");
    if (drop) { Store.dropSeat(drop, me.id); App.rerender(); return; }

    var cancel = hit("data-web-cancel");
    if (cancel) { Store.setWebinar(cancel, { status: "cancelled" }); App.rerender(); return; }

    if (t.closest("[data-web-publish]")) {
      keep();
      var title = draft.title, at = draft.when, seats = +draft.seats;
      if (!title.trim() || !at || !(seats >= 1)) { error = "web.bad"; App.rerender(); return; }
      // A room somebody has already missed is not a room. Said here as well
      // as in the trigger, so the form answers rather than the server.
      if (new Date(at).getTime() <= Date.now()) { error = "web.past"; App.rerender(); return; }

      Store.addWebinar({
        hostId: me.id,
        title: { ar: title.trim(), en: title.trim() },
        brief: { ar: draft.brief.trim(), en: draft.brief.trim() },
        seats: seats,
        price: +draft.price || 0,
        minutes: +draft.minutes || 60,
        audience: draft.audience || "intern",
        channel: "video",
        startsAt: new Date(at).toISOString()
      });
      opening = false; error = null;
      draft = { title: "", brief: "", when: "", seats: "20", price: "0",
                minutes: "60", audience: "intern" };
      App.toast(I18N.t("web.done"), "check");
      App.rerender();
    }
  });
});
