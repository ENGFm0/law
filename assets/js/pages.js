/* ==========================================================================
   Page controllers. Everything that draws from DATA is registered through
   App.onRender, so flipping the language redraws it in place — no reload.
   ========================================================================== */
(function (global) {
  "use strict";

  var I18N = global.I18N, DATA = global.DATA, Icons = global.Icons, App = global.App;
  var $ = App.$, $$ = App.$$, esc = App.esc, tx = App.tx;

  /* ---------------------------------------------------------------- utils */
  function fillSelect(sel, list, anyLabelKey) {
    var current = sel.value;
    var opts = ['<option value="">' + esc(I18N.t(anyLabelKey)) + "</option>"];
    list.forEach(function (item) {
      opts.push('<option value="' + esc(item.id) + '">' + esc(tx(item)) + "</option>");
    });
    sel.innerHTML = opts.join("");
    if (current) sel.value = current;
  }

  function checkList(container, list, name) {
    // Preserve ticks across a language re-render.
    var checked = {};
    $$("input", container).forEach(function (i) { if (i.checked) checked[i.value] = true; });
    container.innerHTML = list.map(function (item) {
      return '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(item.id) + '"' +
        (checked[item.id] ? " checked" : "") + "><span>" + esc(tx(item)) + "</span></label>";
    }).join("");
  }

  function params() {
    var out = {};
    // #/lawyer?id=x in the bundled build, ?id=x when served as separate files
    var hash = global.location.hash || "";
    var mark = hash.indexOf("?");
    var q = mark !== -1 ? hash.slice(mark + 1) : global.location.search.replace(/^\?/, "");
    if (!q) return out;
    q.split("&").forEach(function (part) {
      var kv = part.split("=");
      out[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
    });
    return out;
  }

  /* ------------------------------------------------------------ shared bits */
  function renderStats(host) {
    host.innerHTML = DATA.stats.map(function (s) {
      var v = I18N.lang === "ar" ? s.value : s.valueEn;
      return '<div class="reveal"><div class="display" style="color:var(--accent);font-size:2.5rem">' + esc(v) + "</div>" +
        '<p class="muted small">' + esc(tx(s.label)) + "</p></div>";
    }).join("");
    App.observeReveals(host);
  }

  /* ================================================================== HOME */
  function initHome() {
    var specSel = $('[data-fill="specialties"]');
    var citySel = $('[data-fill="cities"]');
    var form = $("[data-search-form]");

    App.onRender(function () {
      if (specSel) fillSelect(specSel, DATA.specialties, "home.specialty");
      if (citySel) fillSelect(citySel, DATA.cities, "home.city");

      var trust = $("[data-trustbar]");
      if (trust) {
        trust.innerHTML = [
          ["shield-check", "home.trust1"], ["lock", "home.trust2"], ["payments", "home.trust3"]
        ].map(function (pair) {
          return "<span>" + Icons.svg(pair[0], "icon-sm") + esc(I18N.t(pair[1])) + "</span>";
        }).join("");
      }

      var roleCards = $("[data-role-cards]");
      if (roleCards) {
        roleCards.innerHTML = global.Roles.all().map(function (r) {
          var descKey = r.id === "client" ? "role.clientDesc"
                      : r.id === "lawyer" ? "role.lawyerDesc" : "role.internDesc";
          return '<article class="card card--hover card--rule-' +
              (r.id === "lawyer" ? "gold" : "navy") + ' feature reveal">' +
            '<span class="feature__icon">' + Icons.svg(r.icon, "icon-lg") + "</span>" +
            '<h3 class="subtitle">' + esc(I18N.t(r.nameKey)) + "</h3>" +
            '<p class="small muted">' + esc(I18N.t(descKey)) + "</p>" +
            '<a class="btn btn--outline btn--sm" style="margin-top:auto;align-self:flex-start" href="' +
              r.home + '">' + esc(I18N.t("home.enterWorkspace")) +
              Icons.svg("arrow", "icon-sm icon-flip") + "</a></article>";
        }).join("");
      }

      var teasers = $("[data-doc-teasers]");
      if (teasers) {
        teasers.innerHTML = DATA.docTypes.slice(0, 4).map(function (d) {
          return '<li><span class="grow"><strong>' + esc(tx(d.title)) + "</strong>" +
            '<span class="tiny muted" style="display:block">' + esc(tx(d.body)) + "</span></span>" +
            '<span class="offer__price"><span class="tiny muted">' + esc(I18N.t("home.from")) +
              '</span><strong><span class="num">' + I18N.num(d.price) + "</span> " +
              esc(I18N.t("profile.sar")) + "</strong></span></li>";
        }).join("");
      }

      var statsHost = $("[data-stats]");
      if (statsHost) renderStats(statsHost);

      App.observeReveals();
    });

    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var qs = [];
        var q = form.querySelector('[name="q"]').value.trim();
        if (q) qs.push("q=" + encodeURIComponent(q));
        if (specSel && specSel.value) qs.push("specialty=" + encodeURIComponent(specSel.value));
        if (citySel && citySel.value) qs.push("city=" + encodeURIComponent(citySel.value));
        global.location.href = "lawyers.html" + (qs.length ? "?" + qs.join("&") : "");
      });
    }
  }

  /* ============================================================= DIRECTORY */
  function initDirectory() {
    var form = $("[data-filters]");
    var results = $("[data-results]");
    var countEl = $("[data-results-count]");
    var sortSel = $("[data-sort]");
    var pager = $("[data-pagination]");
    if (!results) return;

    var PER_PAGE = 4;
    var state = { page: 1, q: "" };
    var initial = params();
    state.q = initial.q || "";

    App.onRender(function () {
      checkList($("[data-filter-specialties]"), DATA.specialties, "specialty");
      checkList($("[data-filter-cities]"), DATA.cities, "city");
      checkList($("[data-filter-consults]"), DATA.consultTypes, "consult");
      // Preselect whatever the home-page search asked for
      if (initial.specialty) tick("specialty", initial.specialty);
      if (initial.city) tick("city", initial.city);
      draw();
    });

    function tick(name, value) {
      var input = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
      if (input) input.checked = true;
    }

    function selected(name) {
      return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
    }

    function matches(l) {
      var specs = selected("specialty");
      if (specs.length && !specs.some(function (s) { return l.specialties.indexOf(s) !== -1; })) return false;

      var cities = selected("city");
      if (cities.length && cities.indexOf(l.city) === -1) return false;

      var consults = selected("consult");
      if (consults.length && !consults.some(function (c) { return l.consults.indexOf(c) !== -1; })) return false;

      var min = parseFloat(form.querySelector('[name="min"]').value);
      var max = parseFloat(form.querySelector('[name="max"]').value);
      if (!isNaN(min) && l.price < min) return false;
      if (!isNaN(max) && l.price > max) return false;

      var ratingInput = form.querySelector('input[name="rating"]:checked');
      var minRating = ratingInput ? parseFloat(ratingInput.value) : 0;
      if (minRating && l.rating < minRating) return false;

      if (state.q) {
        var hay = [tx(l.name), tx(l.title), tx(l.short)].join(" ").toLowerCase();
        var specNames = l.specialties.map(function (id) {
          var s = DATA.labelOf(DATA.specialties, id);
          return s ? tx(s) : "";
        }).join(" ").toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1 && specNames.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    }

    function sortBy(list) {
      var mode = sortSel ? sortSel.value : "rating";
      var copy = list.slice();
      copy.sort(function (a, b) {
        if (mode === "priceAsc") return a.price - b.price;
        if (mode === "priceDesc") return b.price - a.price;
        if (mode === "experience") return b.years - a.years;
        return b.rating - a.rating || b.reviews - a.reviews;
      });
      return copy;
    }

    function draw() {
      var list = sortBy(DATA.lawyers.filter(matches));
      var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      if (state.page > pages) state.page = pages;

      if (countEl) countEl.textContent = I18N.t("dir.found", { n: I18N.num(list.length) });

      if (!list.length) {
        results.innerHTML = '<div class="card empty" style="grid-column:1/-1">' +
          Icons.svg("search", "icon-xl") +
          '<p class="subtitle">' + esc(I18N.t("dir.empty")) + "</p>" +
          '<p class="small">' + esc(I18N.t("dir.emptyHint")) + "</p></div>";
        if (pager) pager.innerHTML = "";
        return;
      }

      var slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
      results.innerHTML = slice.map(App.lawyerCardWide).join("");

      if (pager) {
        if (pages < 2) { pager.innerHTML = ""; return; }
        var html = '<button class="page-btn" type="button" data-page-to="' + (state.page - 1) + '"' +
          (state.page === 1 ? " disabled" : "") + ' aria-label="' + esc(I18N.t("common.prev")) + '">' +
          Icons.svg("chevron", "icon-sm") + "</button>";
        for (var p = 1; p <= pages; p++) {
          html += '<button class="page-btn' + (p === state.page ? " is-active" : "") +
            '" type="button" data-page-to="' + p + '">' + I18N.num(p) + "</button>";
        }
        html += '<button class="page-btn" type="button" data-page-to="' + (state.page + 1) + '"' +
          (state.page === pages ? " disabled" : "") + ' aria-label="' + esc(I18N.t("common.next")) + '">' +
          Icons.svg("chevron", "icon-sm icon-flip") + "</button>";
        pager.innerHTML = html;
      }
    }

    form.addEventListener("change", function () { state.page = 1; draw(); });
    form.addEventListener("input", function (ev) {
      if (ev.target.type === "number") { state.page = 1; draw(); }
    });
    form.addEventListener("reset", function () {
      // reset() clears inputs after the event, so redraw on the next tick
      setTimeout(function () { state.page = 1; state.q = ""; draw(); }, 0);
    });
    form.addEventListener("submit", function (ev) { ev.preventDefault(); });

    if (sortSel) sortSel.addEventListener("change", function () { state.page = 1; draw(); });

    if (pager) {
      pager.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-page-to]");
        if (!btn || btn.disabled) return;
        state.page = parseInt(btn.getAttribute("data-page-to"), 10);
        draw();
        var top = $("[data-results]").getBoundingClientRect().top + global.scrollY - 100;
        global.scrollTo({ top: top, behavior: "smooth" });
      });
    }

    // Filters collapse into a toggle on narrow screens
    var toggle = $("[data-toggle-filters]");
    if (toggle) {
      var syncToggle = function () {
        var narrow = global.matchMedia("(max-width: 1024px)").matches;
        toggle.classList.toggle("hidden", !narrow);
        form.classList.toggle("hidden", narrow && !toggle.classList.contains("is-on"));
      };
      toggle.addEventListener("click", function () {
        toggle.classList.toggle("is-on");
        form.classList.toggle("hidden");
      });
      global.addEventListener("resize", syncToggle);
      syncToggle();
    }
  }

  /* =============================================================== PROFILE */
  function initProfile() {
    var head = $("[data-profile-head]");
    if (!head) return;

    var id = params().id;
    var lawyer = (id && DATA.lawyerById(id)) || DATA.lawyers[0];

    /* -- tabs -- */
    var tabsHost = $("[data-tabs]");
    if (tabsHost) {
      tabsHost.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-tab]");
        if (!btn) return;
        $$("[data-tab]", tabsHost).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        var want = btn.getAttribute("data-tab");
        $$("[data-panel]").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== want;
        });
      });
    }

    /* -- request picker: what this lawyer offers and at what price -- */
    var picked = null;

    function renderRequests() {
      var host = $("[data-req-types]");
      if (host) {
        host.innerHTML = DATA.requestTypes.map(function (t) {
          var price = DATA.priceFor(lawyer, t.id);
          return '<button type="button" class="req-item' + (picked === t.id ? " is-active" : "") +
            '" data-req-type="' + esc(t.id) + '">' +
            '<span class="req-item__icon">' + Icons.svg(t.icon, "icon-sm") + "</span>" +
            '<span class="grow"><strong>' + esc(tx(t.title)) + "</strong>" +
              (t.tier === "quick" ? '<span class="pill-fast">' + esc(I18N.t("req.express")) + "</span>" : "") +
              '<span class="tiny muted" style="display:block">' + esc(tx(t.meta)) + "</span></span>" +
            '<span class="req-item__price"><span class="num">' + I18N.num(price) + "</span> " +
              esc(I18N.t("profile.sar")) + "</span></button>";
        }).join("");
      }

      var detail = $("[data-req-detail]");
      if (detail) {
        var t = picked ? DATA.requestTypeById(picked) : null;
        if (!t) {
          detail.innerHTML = '<p class="muted center small" style="padding:var(--s-3) 0">' +
            esc(I18N.t("req.pickType")) + "</p>";
        } else {
          var price = DATA.priceFor(lawyer, t.id);
          detail.innerHTML =
            '<p class="tiny muted">' + esc(I18N.t("req.selected")) + "</p>" +
            '<strong class="subtitle">' + esc(tx(t.title)) + "</strong>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(t.body)) + "</p>" +
            (t.tier === "quick"
              ? '<p class="small" style="margin-top:var(--s-3);color:var(--success);font-weight:600">' +
                esc(I18N.t("req.expressNote")) + "</p>"
              : "") +
            '<div class="row between" style="margin-top:var(--s-4)">' +
              '<span class="muted">' + esc(I18N.t("req.lawyerFee")) + "</span>" +
              '<strong style="font-size:1.5rem"><span class="num">' + I18N.num(price) + "</span> " +
                '<span class="small muted">' + esc(I18N.t("profile.sar")) + "</span></strong></div>" +
            '<p class="row gap-2 tiny muted" style="margin-top:var(--s-2)">' +
              Icons.svg("clock", "icon-sm") + esc(I18N.t("req.deliveryIn")) + ": " + esc(tx(t.meta)) + "</p>";
        }
      }
    }

    App.onRender(function () {
      var city = DATA.labelOf(DATA.cities, lawyer.city);
      var crumb = $("[data-crumb-name]");
      if (crumb) crumb.textContent = tx(lawyer.name);

      /* header card */
      head.innerHTML =
        '<div class="row gap-6 wrap" style="align-items:flex-start">' +
          '<img class="avatar" style="width:112px;height:112px" src="' + App.avatarOf(lawyer.name, lawyer.id) +
            '" alt="" width="112" height="112">' +
          '<div class="grow" style="min-width:240px">' +
            '<div class="row between gap-4 wrap">' +
              "<div><h1 class=\"headline row gap-2\">" + esc(tx(lawyer.name)) +
                '<span class="verified">' + Icons.svg("verified") + "</span></h1>" +
                '<p class="lead" style="font-size:1rem">' + esc(tx(lawyer.title)) + "</p></div>" +
              '<span class="status status--warn" style="font-size:.9375rem;padding:6px 14px">' +
                Icons.svg("star", "icon-sm") + '<span class="num">' + lawyer.rating.toFixed(1) + "</span>" +
                '<span class="tiny">' + esc(I18N.t("lawyer.reviews", { n: I18N.num(lawyer.reviews) })) + "</span></span>" +
            "</div>" +
            '<hr class="divider">' +
            '<div class="stat-strip">' +
              '<div>' + Icons.svg("briefcase") + "<div><p class=\"tiny muted\">" + esc(I18N.t("lawyer.experience")) +
                '</p><strong class="small">' + esc(I18N.t("lawyer.years", { n: I18N.num(lawyer.years) })) + "</strong></div></div>" +
              '<div>' + Icons.svg("gavel") + "<div><p class=\"tiny muted\">" + esc(I18N.t("lawyer.consultations")) +
                '</p><strong class="small num">+' + I18N.num(lawyer.consultations) + "</strong></div></div>" +
              '<div>' + Icons.svg("location") + "<div><p class=\"tiny muted\">" + esc(I18N.t("lawyer.location")) +
                '</p><strong class="small">' + esc(tx(city)) + "</strong></div></div>" +
              '<div>' + Icons.svg("shield-check") + "<div><p class=\"tiny muted\">" + esc(I18N.t("lawyer.license")) +
                '</p><strong class="small num">' + esc(lawyer.license) + "</strong></div></div>" +
            "</div>" +
          "</div>" +
        "</div>";

      /* experience panel */
      $("[data-panel=experience]").innerHTML =
        '<section class="card card--pad">' +
          '<h2 class="subtitle row gap-2">' + Icons.svg("user") + esc(I18N.t("profile.bio")) + "</h2>" +
          '<p class="lead" style="margin-top:var(--s-4)">' + esc(tx(lawyer.bio)) + "</p>" +
        "</section>" +
        '<div class="grid grid-2">' +
          '<section class="card card--pad">' +
            '<h2 class="subtitle row gap-2">' + Icons.svg("graduation") + esc(I18N.t("profile.education")) + "</h2>" +
            '<ul class="bullets" style="margin-top:var(--s-4)">' +
              lawyer.education.map(function (e) {
                return "<li><strong class=\"small\">" + esc(tx(e.degree)) + "</strong>" +
                  '<p class="tiny muted">' + esc(tx(e.place)) + "</p></li>";
              }).join("") +
            "</ul></section>" +
          '<section class="card card--pad">' +
            '<h2 class="subtitle row gap-2">' + Icons.svg("scale") + esc(I18N.t("profile.subSpecialties")) + "</h2>" +
            '<div class="row gap-2 wrap" style="margin-top:var(--s-4)">' +
              lawyer.focus.map(function (f) { return '<span class="tag">' + esc(tx(f)) + "</span>"; }).join("") +
            "</div></section>" +
        "</div>" +
        '<section class="card card--pad">' +
          '<h2 class="subtitle row gap-2">' + Icons.svg("briefcase") + esc(I18N.t("profile.career")) + "</h2>" +
          '<ul class="timeline" style="margin-top:var(--s-5)">' +
            lawyer.career.map(function (c) {
              return "<li><strong class=\"small\">" + esc(tx(c.role)) + "</strong>" +
                '<p class="tiny muted">' + esc(tx(c.period)) + "</p>" +
                '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(c.note)) + "</p></li>";
            }).join("") +
          "</ul></section>";

      /* services panel — the same offering, priced from this lawyer's own rate */
      $("[data-panel=services]").innerHTML =
        '<h2 class="title" style="grid-column:1/-1">' + esc(I18N.t("profile.services")) + "</h2>" +
        DATA.requestTypes.map(function (t) {
          var price = DATA.priceFor(lawyer, t.id);
          return '<article class="card card--rule-' + (t.tier === "quick" ? "gold" : "navy") +
            ' card--pad stack gap-3">' +
            '<span class="feature__icon">' + Icons.svg(t.icon) + "</span>" +
            '<h3 class="subtitle row gap-2 wrap">' + esc(tx(t.title)) +
              (t.tier === "quick" ? '<span class="pill-fast">' + esc(I18N.t("req.express")) + "</span>" : "") +
            "</h3>" +
            '<p class="small muted">' + esc(tx(t.body)) + "</p>" +
            '<div class="row between" style="margin-top:auto;padding-top:var(--s-3)">' +
              '<strong style="font-size:1.25rem"><span class="num">' + I18N.num(price) + "</span> " +
                '<span class="small muted">' + esc(I18N.t("profile.sar")) + "</span></strong>" +
              '<span class="tiny muted">' + esc(tx(t.meta)) + "</span>" +
            "</div></article>";
        }).join("");

      /* articles panel */
      var mine = DATA.articles.filter(function (a) { return a.author === lawyer.id; });
      if (!mine.length) mine = DATA.articles.slice(0, 2);
      $("[data-panel=articles]").innerHTML =
        '<h2 class="title" style="grid-column:1/-1">' + esc(I18N.t("profile.articlesTitle")) + "</h2>" +
        mine.map(App.articleCard).join("");

      /* reviews panel */
      $("[data-panel=reviews]").innerHTML =
        '<h2 class="title">' + esc(I18N.t("profile.reviewsTitle")) + "</h2>" +
        DATA.reviews.map(function (r) {
        var s = "";
        for (var i = 0; i < 5; i++) {
          s += '<span style="color:' + (i < r.rating ? "var(--accent)" : "var(--border-strong)") + '">' +
            Icons.svg("star", "icon-sm") + "</span>";
        }
        return '<article class="card card--pad stack gap-3">' +
          '<div class="row between gap-3 wrap">' +
            '<span class="row gap-3">' +
              '<img class="avatar avatar--sm" src="' + App.avatarOf(r.name, tx(r.name)) + '" alt="" width="40" height="40">' +
              "<strong class=\"small\">" + esc(tx(r.name)) + "</strong></span>" +
            '<span class="row gap-1">' + s + "</span>" +
          "</div>" +
          '<p class="small muted">' + esc(tx(r.body)) + "</p>" +
          '<p class="tiny faint">' + esc(tx(r.date)) + "</p></article>";
      }).join("");

      renderRequests();
    });

    var bookingForm = $("[data-booking]");
    if (bookingForm) {
      bookingForm.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-req-type]");
        if (!btn) return;
        picked = btn.getAttribute("data-req-type");
        renderRequests();
      });

      bookingForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!picked) { App.toast(I18N.t("req.pickType"), "file-text"); return; }
        App.toast(I18N.t("req.ordered", { name: tx(lawyer.name) }), "check");
      });
    }
  }

  /* ================================================================== BLOG */
  function initBlog() {
    var list = $("[data-blog-list]");
    if (!list) return;

    var state = { cat: "all", q: "", shown: 4 };

    function filtered() {
      return DATA.articles.filter(function (a) {
        if (state.cat !== "all" && a.cat !== state.cat) return false;
        if (state.q) {
          var hay = (tx(a.title) + " " + tx(a.excerpt)).toLowerCase();
          if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
        }
        return true;
      });
    }

    function draw() {
      var all = filtered();
      var slice = all.slice(0, state.shown);

      list.innerHTML = slice.length
        ? slice.map(App.articleCard).join("")
        : '<div class="card empty" style="grid-column:1/-1">' + Icons.svg("search", "icon-xl") +
          '<p class="subtitle">' + esc(I18N.t("blog.noResults")) + "</p></div>";

      var countEl = $("[data-blog-count]");
      if (countEl) countEl.textContent = I18N.num(slice.length) + " / " + I18N.num(all.length);

      var more = $("[data-blog-more]");
      if (more) more.classList.toggle("hidden", state.shown >= all.length);
    }

    App.onRender(function () {
      var cats = $("[data-blog-cats]");
      if (cats) {
        var chips = ['<button type="button" class="chip' + (state.cat === "all" ? " is-active" : "") +
          '" data-cat="all">' + esc(I18N.t("blog.all")) + "</button>"];
        // only offer categories that actually have articles
        DATA.specialties.forEach(function (s) {
          var n = DATA.articles.filter(function (a) { return a.cat === s.id; }).length;
          if (!n) return;
          chips.push('<button type="button" class="chip' + (state.cat === s.id ? " is-active" : "") +
            '" data-cat="' + esc(s.id) + '">' + esc(tx(s)) + "</button>");
        });
        cats.innerHTML = chips.join("");
      }

      var expert = $("[data-blog-expert]");
      if (expert) {
        var l = DATA.lawyers[0];
        var s = "";
        for (var i = 0; i < 5; i++) {
          s += '<span style="color:' + (i < Math.round(l.rating) ? "var(--accent)" : "var(--border-strong)") + '">' +
            Icons.svg("star", "icon-sm") + "</span>";
        }
        expert.innerHTML =
          '<div class="row gap-3">' +
            '<img class="avatar avatar--md" src="' + App.avatarOf(l.name, l.id) + '" alt="" width="64" height="64">' +
            "<div><strong class=\"small\">" + esc(tx(l.name)) + "</strong>" +
              '<p class="tiny muted">' + esc(tx(l.title)) + "</p>" +
              '<div class="row gap-1" style="margin-top:var(--s-1)">' + s + "</div></div>" +
          "</div>" +
          '<p class="small muted" style="margin-top:var(--s-4)">' + esc(tx(l.short)) + "</p>";
      }

      var refs = $("[data-blog-refs]");
      if (refs) {
        refs.innerHTML = DATA.references.map(function (r) {
          return '<li class="row gap-3">' + Icons.svg("file-text", "icon-sm") +
            "<div><strong class=\"small\">" + esc(tx(r.title)) + "</strong>" +
            '<p class="tiny muted">' + esc(tx(r.note)) + "</p></div></li>";
        }).join("");
      }

      draw();
    });

    var cats = $("[data-blog-cats]");
    if (cats) {
      cats.addEventListener("click", function (ev) {
        var chip = ev.target.closest("[data-cat]");
        if (!chip) return;
        state.cat = chip.getAttribute("data-cat");
        state.shown = 4;
        $$("[data-cat]", cats).forEach(function (c) { c.classList.toggle("is-active", c === chip); });
        draw();
      });
    }

    var searchForm = $("[data-blog-search]");
    if (searchForm) {
      var input = searchForm.querySelector("input");
      searchForm.addEventListener("submit", function (ev) { ev.preventDefault(); });
      input.addEventListener("input", function () {
        state.q = input.value.trim();
        state.shown = 4;
        draw();
      });
    }

    var more = $("[data-blog-more]");
    if (more) {
      more.addEventListener("click", function () { state.shown += 4; draw(); });
    }

    var news = $("[data-newsletter]");
    if (news) {
      news.addEventListener("submit", function (ev) {
        ev.preventDefault();
        App.toast(I18N.t("blog.subscribed"), "mail");
        news.reset();
      });
    }
  }

  /* ================================================================= ABOUT */
  function initAbout() {
    App.onRender(function () {
      var vals = $("[data-values]");
      if (vals) {
        vals.innerHTML = DATA.values.map(function (v, i) {
          return '<article class="card card--hover card--rule-' + (i % 2 ? "gold" : "navy") + ' feature reveal">' +
            '<span class="feature__icon">' + Icons.svg(v.icon, "icon-lg") + "</span>" +
            '<h3 class="subtitle">' + esc(tx(v.title)) + "</h3>" +
            '<p class="small muted">' + esc(tx(v.body)) + "</p></article>";
        }).join("");
      }

      var feat = $("[data-features]");
      if (feat) {
        feat.innerHTML = DATA.features.map(function (f) {
          return '<article class="card card--hover card--rule-' + f.rule + ' feature reveal">' +
            '<span class="feature__icon">' + Icons.svg(f.icon, "icon-lg") + "</span>" +
            '<h3 class="subtitle">' + esc(tx(f.title)) + "</h3>" +
            '<p class="small muted">' + esc(tx(f.body)) + "</p></article>";
        }).join("");
      }

      var steps = $("[data-steps]");
      if (steps) {
        steps.innerHTML = DATA.steps.map(function (s, i) {
          return '<article class="card card--pad step reveal">' +
            '<span class="step__num">' + I18N.num(i + 1) + "</span>" +
            '<h3 class="subtitle" style="margin-top:var(--s-4)">' + esc(tx(s.title)) + "</h3>" +
            '<p class="small muted" style="margin-top:var(--s-2)">' + esc(tx(s.body)) + "</p></article>";
        }).join("");
      }

      var tHost = $("[data-testimonials]");
      if (tHost) {
        tHost.innerHTML = DATA.testimonials.map(function (t) {
          var filled = "";
          for (var i = 0; i < 5; i++) {
            filled += '<span style="color:' + (i < t.rating ? "var(--accent)" : "var(--border-strong)") + '">' +
              Icons.svg("star", "icon-sm") + "</span>";
          }
          return '<article class="card card--pad reveal stack gap-4">' +
            '<div class="row gap-1">' + filled + "</div>" +
            '<p class="lead small">“' + esc(tx(t.body)) + '”</p>' +
            '<div class="row gap-3" style="margin-top:auto">' +
              '<img class="avatar avatar--sm" src="' + App.avatarOf(t.name, tx(t.name)) + '" alt="" width="40" height="40">' +
              "<div><strong class=\"small\">" + esc(tx(t.name)) + "</strong>" +
              '<p class="tiny muted">' + esc(tx(t.role)) + "</p></div>" +
            "</div></article>";
        }).join("");
      }

      var statsHost = $("[data-stats]");
      if (statsHost) renderStats(statsHost);

      var team = $("[data-team]");
      if (team) {
        team.innerHTML = DATA.team.map(function (m) {
          return '<article class="card card--pad center reveal stack gap-3" style="align-items:center">' +
            '<img class="avatar avatar--lg avatar--round" src="' + App.avatarOf(m.name, tx(m.name)) +
              '" alt="" width="88" height="88">' +
            "<div><strong>" + esc(tx(m.name)) + "</strong>" +
            '<p class="small muted">' + esc(tx(m.role)) + "</p></div></article>";
        }).join("");
      }

      var faq = $("[data-faq]");
      if (faq) {
        faq.innerHTML = DATA.faq.map(function (f) {
          return '<details class="card faq-item"><summary class="faq-q">' +
            "<span>" + esc(tx(f.q)) + "</span>" + Icons.svg("chevron-down", "faq-chevron") + "</summary>" +
            '<div class="faq-a">' + esc(tx(f.a)) + "</div></details>";
        }).join("");
      }

      App.observeReveals();
    });

    var contact = $("[data-contact]");
    if (contact) {
      contact.addEventListener("submit", function (ev) {
        ev.preventDefault();
        App.toast(I18N.t("about.sent"), "mail");
        contact.reset();
      });
    }
  }

  /* ================================================================== AUTH */
  function initAuth() {
    var seg = $("[data-auth-seg]");
    var form = $("[data-auth-form]");
    if (!form) return;
    var mode = "login";

    function sync() {
      $$("[data-only]").forEach(function (el) {
        el.hidden = el.getAttribute("data-only") !== mode;
      });
      $$("[data-only=register] input").forEach(function (i) { i.required = mode === "register"; });
      $("[data-auth-title]").textContent = I18N.t(mode === "login" ? "auth.welcome" : "auth.register");
      $("[data-auth-lead]").textContent = I18N.t(mode === "login" ? "auth.welcomeLead" : "auth.registerLead");
      $("[data-auth-submit]").textContent = I18N.t(mode === "login" ? "auth.submitLogin" : "auth.submitRegister");
    }

    App.onRender(function () {
      var points = $("[data-auth-points]");
      if (points) {
        points.innerHTML = ["auth.asidePoint1", "auth.asidePoint2", "auth.asidePoint3"].map(function (k) {
          return '<li class="row gap-3">' + Icons.svg("check") + "<span>" + esc(I18N.t(k)) + "</span></li>";
        }).join("");
      }
      sync();
    });

    if (seg) {
      seg.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-mode]");
        if (!btn) return;
        mode = btn.getAttribute("data-mode");
        $$("[data-mode]", seg).forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        sync();
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      // Demo build: no backend, so land the visitor on the matching dashboard.
      global.location.href = "dashboard-lawyer.html";
    });
  }

  /* ============================================================ DASHBOARDS */
  var DASH_NAV = [
    { key: "dash.overview",  icon: "grid",     href: "#" },
    { key: "dash.requests",  icon: "file-text",href: "#" },
    { key: "dash.calendar",  icon: "calendar", href: "#" },
    { key: "dash.documents", icon: "wallet",   href: "#" },
    { key: "dash.settings",  icon: "settings", href: "#" }
  ];

  function renderSidebar(el) {
    var role = el.getAttribute("data-role");
    var person = role === "lawyer" ? DATA.lawyers[0] : { name: { ar: "أحمد عبدالله", en: "Ahmed Abdullah" }, id: "client-1" };
    var name = tx(person.name);

    el.innerHTML =
      '<div class="sidebar__user">' +
        '<img src="' + App.avatarOf(person.name, person.id) + '" alt="" width="84" height="84">' +
        "<div><strong>" + esc(name) + "</strong>" +
        '<p class="small" style="opacity:.6">' + esc(I18N.t("dash.welcome")) + "</p></div>" +
      "</div>" +
      "<nav class=\"stack gap-1\">" +
        DASH_NAV.map(function (item, i) {
          return '<a class="side-link' + (i === 0 ? " is-active" : "") + '" href="' + item.href + '">' +
            Icons.svg(item.icon) + "<span>" + esc(I18N.t(item.key)) + "</span></a>";
        }).join("") +
      "</nav>" +
      '<div class="sidebar__foot stack gap-2">' +
        '<a class="side-link" href="index.html">' + Icons.svg("arrow-back", "icon-flip") +
          "<span>" + esc(I18N.t("dash.backToSite")) + "</span></a>" +
        '<a class="side-link" href="login.html">' + Icons.svg("logout") +
          "<span>" + esc(I18N.t("dash.logout")) + "</span></a>" +
      "</div>";
  }

  var signedDrafts = [];

  /* ------------------------------------------------- lawyer request inbox */
  var INBOX_FILTERS = [
    { id: "all",      key: "inbox.all" },
    { id: "ai",       key: "inbox.withAi" },
    { id: "manual",   key: "inbox.withoutAi" },
    { id: "live",     key: "inbox.live" },
    { id: "assigned", key: "inbox.assigned" }
  ];

  function initInbox() {
    var host = $("[data-inbox]");
    if (!host) return;
    var filter = "all";
    var openId = null;

    function stateOf(r) { return global.Store.req(r.id, r); }

    function bucket(r) {
      var st = stateOf(r);
      if (st.assignedTo) return "assigned";
      if (DATA.requestTypeById(r.type).mode === "live") return "live";
      return r.ai ? "ai" : "manual";
    }

    function statusOf(r) {
      var st = stateOf(r);
      if (st.state === "done") return { cls: "ok", key: "inbox.done" };
      if (st.assignedTo) return { cls: "info", key: "inbox.assigned" };
      if (DATA.requestTypeById(r.type).mode === "live") return { cls: "info", key: "inbox.scheduled" };
      if (r.ai && st.state === "drafted") return { cls: "ok", key: "inbox.aiReady" };
      if (r.ai) return { cls: "muted", key: "inbox.aiQueued" };
      return { cls: "warn", key: "inbox.needsYou" };
    }

    function actionsFor(r) {
      var st = stateOf(r);
      var type = DATA.requestTypeById(r.type);
      if (st.state === "done") return "";

      if (st.assignedTo) {
        var who = DATA.internById(st.assignedTo);
        return '<span class="tiny muted">' +
            esc(I18N.t("inbox.assignedTo", { name: who ? tx(who.name) : "" })) + "</span>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-unassign="' + esc(r.id) + '">' +
            esc(I18N.t("inbox.unassign")) + "</button>";
      }

      if (type.mode === "live") {
        return '<button class="btn btn--primary btn--sm" type="button" data-done="' + esc(r.id) + '">' +
          Icons.svg(type.icon, "icon-sm") + esc(I18N.t("inbox.join")) + "</button>";
      }

      var main = r.ai
        ? (st.state === "drafted"
            ? '<button class="btn btn--primary btn--sm" type="button" data-open="' + esc(r.id) + '">' +
              esc(I18N.t("inbox.review")) + "</button>"
            : '<button class="btn btn--outline btn--sm" type="button" data-gen="' + esc(r.id) + '">' +
              Icons.svg("sparkle", "icon-sm") + esc(I18N.t("inbox.generate")) + "</button>")
        : '<button class="btn btn--outline btn--sm" type="button" data-open="' + esc(r.id) + '">' +
          esc(I18N.t("inbox.writeSelf")) + "</button>";

      return main +
        '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
          Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>";
    }

    function draw() {
      var rows = DATA.inbox.filter(function (r) {
        return filter === "all" || bucket(r) === filter;
      });

      var fh = $("[data-inbox-filters]");
      if (fh) {
        fh.innerHTML = INBOX_FILTERS.map(function (f) {
          var n = f.id === "all" ? DATA.inbox.length
            : DATA.inbox.filter(function (r) { return bucket(r) === f.id; }).length;
          return '<button type="button" class="chip' + (filter === f.id ? " is-active" : "") +
            '" data-filter="' + f.id + '">' + esc(I18N.t(f.key)) +
            ' <span class="num">' + I18N.num(n) + "</span></button>";
        }).join("");
      }

      var count = $("[data-inbox-count]");
      if (count) count.textContent = I18N.t("inbox.count", { n: I18N.num(rows.length) });

      host.innerHTML = rows.length ? rows.map(function (r) {
        var type = DATA.requestTypeById(r.type);
        var st = statusOf(r);
        return '<div class="inbox-row' + (openId === r.id ? " is-open" : "") + '">' +
          '<span class="inbox-row__icon">' + Icons.svg(type.icon, "icon-sm") + "</span>" +
          '<div class="grow" style="min-width:0">' +
            '<div class="row gap-2 wrap"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
              '<span class="tag">' + esc(tx(type.title)) + "</span></div>" +
            '<p class="tiny muted">' + esc(tx(r.client)) + ' <span class="dot"></span> ' +
              esc(tx(r.ago)) + "</p>" +
            '<p class="tiny faint">' + esc(I18N.t("inbox.clientNote")) + ": " + esc(tx(r.note)) + "</p>" +
          "</div>" +
          '<div class="inbox-row__side">' +
            '<span class="status status--' + st.cls + '">' + esc(I18N.t(st.key)) + "</span>" +
            '<strong class="tiny"><span class="num">' + I18N.num(r.price) + "</span> " +
              esc(I18N.t("profile.sar")) + "</strong>" +
            '<div class="inbox-row__actions">' + actionsFor(r) + "</div>" +
          "</div></div>";
      }).join("")
        : '<p class="muted center" style="padding:var(--s-8)">' + esc(I18N.t("inbox.empty")) + "</p>";
    }

    function drawDraft() {
      var box = $("[data-inbox-draft]");
      if (!box) return;
      if (!openId) { box.hidden = true; box.innerHTML = ""; return; }

      var r = DATA.inbox.filter(function (x) { return x.id === openId; })[0];
      if (!r) { box.hidden = true; return; }
      var st = global.Store.req(r.id, r);
      var type = DATA.requestTypeById(r.type);
      var seed = st.body || (r.doc && DATA.draftBodies[r.doc] ? tx(DATA.draftBodies[r.doc]) : "");

      box.hidden = false;
      box.innerHTML =
        '<div class="panel__head row between wrap gap-3">' +
          "<div><h2 class=\"subtitle\">" + esc(tx(r.title)) + "</h2>" +
            '<p class="tiny muted">' + esc(tx(r.client)) + ' <span class="dot"></span> ' +
              esc(tx(type.title)) +
              (r.ai ? ' <span class="dot"></span> ' + esc(I18N.t("ai.aiSource")) : "") + "</p></div>" +
          '<button class="icon-btn" type="button" data-draft-close>' + Icons.svg("close", "icon-sm") + "</button>" +
        "</div>" +
        (r.ai ? '<p class="disclaimer" style="border-top:0">' +
            Icons.svg("lock", "icon-sm") + "<span>" + esc(I18N.t("inbox.aiHidden")) + "</span></p>" : "") +
        '<textarea class="draft-text" data-inbox-body spellcheck="false">' + esc(seed) + "</textarea>" +
        '<div class="draft-foot">' +
          '<div><span class="tiny muted">' + esc(I18N.t("inbox.revenue")) + "</span>" +
            '<strong style="display:block;color:var(--accent)"><span class="num">' +
              I18N.num(r.price) + "</span> " + esc(I18N.t("profile.sar")) + "</strong></div>" +
          '<span class="grow"></span>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-assign="' + esc(r.id) + '">' +
            Icons.svg("graduation", "icon-sm") + esc(I18N.t("inbox.assign")) + "</button>" +
          '<button class="btn btn--accent" type="button" data-approve="' + esc(r.id) + '">' +
            Icons.svg("check", "icon-sm") + esc(I18N.t("ai.approve")) + "</button>" +
        "</div>";
    }

    /** Small inline chooser rather than a modal — it is three names. */
    function openAssign(id, anchor) {
      var existing = $(".assign-pop");
      if (existing) existing.remove();
      var pop = document.createElement("div");
      pop.className = "assign-pop";
      pop.innerHTML = '<p class="tiny muted">' + esc(I18N.t("inbox.assignTo")) + "</p>" +
        DATA.interns.map(function (i) {
          return '<button type="button" data-pick-intern="' + esc(i.id) + '" data-for="' + esc(id) + '">' +
            '<img class="avatar avatar--sm" alt="" width="28" height="28" src="' +
              App.avatarOf(i.name, i.id) + '">' +
            "<span>" + esc(tx(i.name)) + "</span>" +
            '<span class="tiny muted num">' + I18N.num(i.done) + "</span></button>";
        }).join("");
      anchor.appendChild(pop);
    }

    App.onRender(function () { draw(); drawDraft(); });
    global.Store.onChange(function () { draw(); drawDraft(); });

    var root = $("[data-inbox]").closest("main");
    root.addEventListener("click", function (ev) {
      var f = ev.target.closest("[data-filter]");
      if (f) { filter = f.getAttribute("data-filter"); draw(); return; }

      var gen = ev.target.closest("[data-gen]");
      if (gen) {
        var gid = gen.getAttribute("data-gen");
        gen.disabled = true;
        gen.textContent = I18N.t("ai.generating");
        setTimeout(function () {
          global.Store.set(gid, { state: "drafted" });
          openId = gid;
          App.toast(I18N.t("ai.generated"), "sparkle");
          draw(); drawDraft();
        }, 700);
        return;
      }

      var op = ev.target.closest("[data-open]");
      if (op) {
        openId = op.getAttribute("data-open");
        draw(); drawDraft();
        var box = $("[data-inbox-draft]");
        if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (ev.target.closest("[data-draft-close]")) { openId = null; draw(); drawDraft(); return; }

      var ap = ev.target.closest("[data-approve]");
      if (ap) {
        var body = $("[data-inbox-body]");
        global.Store.set(ap.getAttribute("data-approve"),
          { state: "done", body: body ? body.value : null });
        openId = null;
        App.toast(I18N.t("inbox.completed"), "check");
        draw(); drawDraft();
        return;
      }

      var dn = ev.target.closest("[data-done]");
      if (dn) {
        global.Store.set(dn.getAttribute("data-done"), { state: "done" });
        App.toast(I18N.t("inbox.completed"), "check");
        return;
      }

      var as = ev.target.closest("[data-assign]");
      if (as) { openAssign(as.getAttribute("data-assign"), as.parentNode); return; }

      var pick = ev.target.closest("[data-pick-intern]");
      if (pick) {
        var who = DATA.internById(pick.getAttribute("data-pick-intern"));
        global.Store.set(pick.getAttribute("data-for"), { assignedTo: who.id, state: "assigned" });
        openId = null;
        App.toast(I18N.t("inbox.assignDone", { name: tx(who.name) }), "graduation");
        draw(); drawDraft();
        return;
      }

      var un = ev.target.closest("[data-unassign]");
      if (un) {
        global.Store.set(un.getAttribute("data-unassign"), { assignedTo: null, state: "new" });
        App.toast(I18N.t("inbox.unassigned"), "arrow-back");
        draw(); drawDraft();
        return;
      }

      var pop = $(".assign-pop");
      if (pop && !ev.target.closest(".assign-pop")) pop.remove();
    });
  }

  function initLawyerDash() {
    initInbox();
    var TOOLS = [
      ["bold", "italic", "underline"],
      ["align-start", "align-center", "align-end"],
      ["list", "list-num"]
    ];

    App.onRender(function () {
      var side = $("[data-dash-sidebar]");
      if (side) renderSidebar(side);

      var stats = $("[data-dash-stats]");
      if (stats) {
        var items = [
          { icon: "eye",      labelKey: "dash.profileViews",  value: I18N.num(1204), trend: -2, rule: "navy" },
          { icon: "star",     labelKey: "dash.overallRating", value: "4.8", note: I18N.t("dash.basedOn", { n: I18N.num(156) }), rule: "navy" },
          { icon: "payments", labelKey: "dash.revenue",       value: I18N.num(45200), trend: 8, rule: "gold" },
          { icon: "gavel",    labelKey: "dash.activeRequests",value: I18N.num(24), trend: 12, rule: "navy" }
        ];
        stats.innerHTML = items.map(function (s) {
          var foot = s.note
            ? '<span class="tiny muted">' + esc(s.note) + "</span>"
            : '<span class="trend trend--' + (s.trend >= 0 ? "up" : "down") + '">' +
              Icons.svg(s.trend >= 0 ? "trend" : "trend-down", "icon-sm") +
              '<span class="num">' + (s.trend >= 0 ? "+" : "") + s.trend + "%</span> " +
              esc(I18N.t("dash.vsLastMonth")) + "</span>";
          return '<article class="card card--rule-' + s.rule + ' stat">' +
            '<div class="stat__top"><span class="small muted">' + esc(I18N.t(s.labelKey)) + "</span>" +
              '<span class="stat__icon">' + Icons.svg(s.icon) + "</span></div>" +
            '<div class="stat__value">' + esc(s.value) + "</div>" + foot + "</article>";
        }).join("");
      }

      var toolbar = $("[data-editor-toolbar]");
      if (toolbar) {
        toolbar.innerHTML = TOOLS.map(function (group) {
          return group.map(function (n) {
            return '<button class="tool" type="button" data-tool="' + n + '" aria-label="' + n + '">' +
              Icons.svg(n, "icon-sm") + "</button>";
          }).join("");
        }).join('<span class="toolbar__sep"></span>') +
        '<span class="grow"></span>' +
        '<button class="btn btn--sm" type="button" style="background:var(--accent-soft);color:var(--accent-soft-text)">' +
          Icons.svg("sparkle", "icon-sm") + esc(I18N.t("dash.aiAssist")) + "</button>" +
        '<button class="btn btn--sm btn--ghost" type="button">' + Icons.svg("image", "icon-sm") +
          esc(I18N.t("dash.image")) + "</button>";
      }

      /* drafts prepared by trainees, waiting on this lawyer's signature */
      var drafts = $("[data-drafts]");
      if (drafts) {
        var pending = DATA.drafts.filter(function (d) { return signedDrafts.indexOf(d.id) === -1; });
        var badge = $("[data-drafts-count]");
        if (badge) badge.textContent = I18N.num(pending.length);

        drafts.innerHTML = pending.length
          ? pending.map(function (d) {
              var who = DATA.internById(d.by);
              var spec = DATA.labelOf(DATA.specialties, d.specialty);
              return '<div class="list-row">' +
                '<span class="list-row__icon" style="color:var(--accent)">' +
                  Icons.svg("file-text", "icon-sm") + "</span>" +
                '<div class="grow"><strong class="small">' + esc(tx(d.title)) + "</strong>" +
                  '<p class="tiny muted">' + esc(I18N.t("drafts.preparedBy")) + ": " +
                    esc(who ? tx(who.name) : "—") + ' <span class="dot"></span> ' +
                    esc(tx(spec)) + ' <span class="dot"></span> ' +
                    esc(I18N.t("drafts.submittedAgo")) + " " + esc(tx(d.ago)) + "</p></div>" +
                '<button class="btn btn--primary btn--sm" type="button" data-sign="' + esc(d.id) + '">' +
                  Icons.svg("check", "icon-sm") + esc(I18N.t("drafts.sign")) + "</button></div>";
            }).join("")
          : '<p class="muted center" style="padding:var(--s-6)">' + esc(I18N.t("drafts.empty")) + "</p>";
      }

    });

    var toolbar = $("[data-editor-toolbar]");
    if (toolbar) {
      toolbar.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-tool]");
        if (btn) btn.classList.toggle("is-active");
      });
    }
    var draftsHost = $("[data-drafts]");
    if (draftsHost) {
      draftsHost.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-sign]");
        if (!btn) return;
        signedDrafts.push(btn.getAttribute("data-sign"));
        App.toast(I18N.t("drafts.signed"), "check");
        App.rerender();
      });
    }

    var pub = $("[data-editor-publish]");
    if (pub) pub.addEventListener("click", function () { App.toast(I18N.t("dash.published"), "check"); });
    var draft = $("[data-editor-draft]");
    if (draft) draft.addEventListener("click", function () { App.toast(I18N.t("dash.draftSaved"), "file-text"); });
  }

  var countdownTimer = null;

  function initClientDash() {
    var remaining = 45 * 60 + 20; // seconds until the next video consultation

    function clockText() {
      var h = Math.floor(remaining / 3600);
      var m = Math.floor((remaining % 3600) / 60);
      var s = remaining % 60;
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      return pad(h) + ":" + pad(m) + ":" + pad(s);
    }

    App.onRender(function () {
      var side = $("[data-dash-sidebar]");
      if (side) renderSidebar(side);

      var stats = $("[data-client-stats]");
      if (stats) {
        var items = [
          { icon: "gavel",    label: I18N.t("client.activeConsults"), value: I18N.num(2), rule: "navy" },
          { icon: "wallet",   label: I18N.t("client.spent"),          value: I18N.num(1850) + " " + I18N.t("profile.sar"), rule: "gold" },
          { icon: "file-text",label: I18N.t("client.docCenter"),      value: I18N.num(6) + " " + I18N.t("client.documents"), rule: "navy" }
        ];
        stats.innerHTML = items.map(function (s) {
          return '<article class="card card--rule-' + s.rule + ' stat">' +
            '<div class="stat__top"><span class="small muted">' + esc(s.label) + "</span>" +
              '<span class="stat__icon">' + Icons.svg(s.icon) + "</span></div>" +
            '<div class="stat__value">' + esc(s.value) + "</div></article>";
        }).join("");
      }

      var upcoming = $("[data-client-upcoming]");
      if (upcoming) {
        upcoming.innerHTML =
          '<div class="row between gap-6 wrap">' +
            '<div class="row gap-4">' +
              '<span class="list-row__icon" style="width:52px;height:52px;background:var(--info-soft);color:var(--info)">' +
                Icons.svg("video") + "</span>" +
              "<div><h2 class=\"subtitle\">" + esc(I18N.t("client.upcoming")) + "</h2>" +
                '<p class="small muted">' + esc(tx({ ar: "مع د. خالد المنصور – قضايا تجارية", en: "With Dr. Khalid Al-Mansour – commercial matters" })) + "</p>" +
                '<a class="btn btn--primary btn--sm" style="margin-top:var(--s-3)" href="#">' +
                  Icons.svg("video", "icon-sm") + esc(I18N.t("client.joinCall")) + "</a></div>" +
            "</div>" +
            '<div class="countdown grow" style="max-width:280px">' +
              '<div class="countdown__time" data-countdown>' + clockText() + "</div>" +
              '<p class="tiny muted">' + esc(I18N.t("client.timeLeft")) + "</p>" +
            "</div>" +
          "</div>";
      }

      var consults = $("[data-client-consults]");
      if (consults) {
        var rows = [
          { icon: "gavel", title: { ar: "مراجعة عقد شراكة تجارية", en: "Partnership agreement review" }, no: "C-8924", status: "warn", key: "client.statusReview", when: "common.hoursAgo" },
          { icon: "file-text", title: { ar: "استشارة عقارية – نقل ملكية", en: "Property consultation – title transfer" }, no: "C-8810", status: "info", key: "client.statusPending", when: "common.yesterday" }
        ];
        consults.innerHTML = rows.map(function (r) {
          return '<div class="list-row">' +
            '<span class="list-row__icon">' + Icons.svg(r.icon, "icon-sm") + "</span>" +
            '<div class="grow"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
              '<p class="tiny muted">' + esc(I18N.t("client.requestNo")) + ': <span class="num">#' + r.no + "</span></p></div>" +
            '<div class="stack gap-1" style="align-items:flex-end">' +
              '<span class="status status--' + r.status + '">' + esc(I18N.t(r.key)) + "</span>" +
              '<span class="tiny faint">' + esc(I18N.t("client.updated")) + ": " + esc(I18N.t(r.when)) + "</span>" +
            "</div></div>";
        }).join("");
      }

      var docs = $("[data-client-docs]");
      if (docs) {
        var files = [
          { name: "consultation-8924.pdf", label: { ar: "تقرير الاستشارة", en: "Consultation report" } },
          { name: "final-contract.pdf",    label: { ar: "مسودة العقد النهائي", en: "Final contract draft" } }
        ];
        docs.innerHTML = files.map(function (f) {
          return '<div class="list-row">' +
            '<span class="list-row__icon" style="color:var(--accent)">' + Icons.svg("file-text", "icon-sm") + "</span>" +
            '<div class="grow"><strong class="small">' + esc(tx(f.label)) + "</strong>" +
              '<p class="tiny muted" style="direction:ltr;text-align:start">' + esc(f.name) + "</p></div>" +
            '<button class="icon-btn" type="button" aria-label="' + esc(I18N.t("client.download")) + '">' +
              Icons.svg("download", "icon-sm") + "</button></div>";
        }).join("");
      }

      var saved = $("[data-client-saved]");
      if (saved) {
        saved.innerHTML = DATA.articles.slice(0, 2).map(function (a) {
          return '<div class="list-row"><div class="grow">' +
            '<a class="small" style="font-weight:700" href="blog.html#' + esc(a.id) + '">' + esc(tx(a.title)) + "</a>" +
            '<p class="tiny muted">' + esc(I18N.t("client.savedOn")) + ": " + esc(tx(a.date)) + "</p></div></div>";
        }).join("");
      }
    });

    clearInterval(countdownTimer);
    countdownTimer = setInterval(function () {
      if (remaining > 0) remaining--;
      var el = $("[data-countdown]");
      if (el) el.textContent = clockText();
      else clearInterval(countdownTimer);   // view was swapped out
    }, 1000);
  }

  /* ============================================================= TASK BANK */
  // Accepted tasks live for the session only — there is no backend to persist to.
  var acceptedTasks = [];

  function levelKey(level) {
    return level === "advanced" ? "tasks.levelAdvanced"
         : level === "mid" ? "tasks.levelMid" : "tasks.levelBasic";
  }

  function initTasks() {
    var list = $("[data-task-list]");
    if (!list) return;
    var filter = "all";

    function taskCard(t) {
      var sup = DATA.lawyerById(t.supervisor);
      var spec = DATA.labelOf(DATA.specialties, t.specialty);
      var taken = acceptedTasks.indexOf(t.id) !== -1;

      return '<article class="card card--hover task-card' + (taken ? " is-taken" : "") + '">' +
        '<div class="task-card__body">' +
          '<div class="row between gap-3 wrap">' +
            '<span class="tag">' + esc(tx(spec)) + "</span>" +
            '<span class="status status--' + (t.level === "advanced" ? "warn" : t.level === "mid" ? "info" : "muted") + '">' +
              esc(I18N.t(levelKey(t.level))) + "</span>" +
          "</div>" +
          '<h3 class="subtitle">' + esc(tx(t.title)) + "</h3>" +
          '<p class="small muted">' + esc(tx(t.body)) + "</p>" +
          '<div class="task-card__meta">' +
            '<div><span class="tiny muted">' + esc(I18N.t("tasks.reward")) + "</span>" +
              '<strong class="reward"><span class="num">' + I18N.num(t.reward) + "</span> " +
              esc(I18N.t("profile.sar")) + "</strong></div>" +
            '<div><span class="tiny muted">' + esc(I18N.t("tasks.deadline")) + "</span>" +
              "<strong>" + esc(I18N.t("tasks.days", { n: I18N.num(t.days) })) + "</strong></div>" +
            '<div><span class="tiny muted">' + esc(I18N.t("tasks.supervisor")) + "</span>" +
              "<strong>" + esc(sup ? tx(sup.name) : "—") + "</strong></div>" +
          "</div>" +
        "</div>" +
        '<div class="task-card__foot">' +
          (taken
            ? '<span class="status status--ok" style="width:100%;justify-content:center;height:44px">' +
              Icons.svg("check", "icon-sm") + esc(I18N.t("tasks.inProgress")) + "</span>"
            : '<button class="btn btn--primary btn--block" type="button" data-accept="' + esc(t.id) + '">' +
              esc(I18N.t("tasks.accept")) + "</button>") +
        "</div></article>";
    }

    function draw() {
      var open = DATA.tasks.filter(function (t) {
        return filter === "all" || t.specialty === filter;
      });
      list.innerHTML = open.map(taskCard).join("");

      /* headline figures */
      var stats = $("[data-task-stats]");
      if (stats) {
        var earned = DATA.tasks.reduce(function (sum, t) {
          return acceptedTasks.indexOf(t.id) !== -1 ? sum + t.reward : sum;
        }, 0);
        var cells = [
          { icon: "file-text", label: I18N.t("tasks.openCount"), value: I18N.num(DATA.tasks.length), rule: "navy" },
          { icon: "check",     label: I18N.t("tasks.mine"),      value: I18N.num(acceptedTasks.length), rule: "navy" },
          { icon: "wallet",    label: I18N.t("tasks.earnings"),
            value: I18N.num(earned) + " " + I18N.t("profile.sar"), rule: "gold" }
        ];
        stats.innerHTML = cells.map(function (c) {
          return '<article class="card card--rule-' + c.rule + ' stat">' +
            '<div class="stat__top"><span class="small muted">' + esc(c.label) + "</span>" +
              '<span class="stat__icon">' + Icons.svg(c.icon) + "</span></div>" +
            '<div class="stat__value">' + esc(c.value) + "</div></article>";
        }).join("");
      }

      /* accepted list */
      var mine = $("[data-task-mine]");
      if (mine) {
        var taken = DATA.tasks.filter(function (t) { return acceptedTasks.indexOf(t.id) !== -1; });
        mine.innerHTML = taken.length
          ? taken.map(function (t) {
              var sup = DATA.lawyerById(t.supervisor);
              return '<div class="list-row">' +
                '<span class="list-row__icon">' + Icons.svg("file-text", "icon-sm") + "</span>" +
                '<div class="grow"><strong class="small">' + esc(tx(t.title)) + "</strong>" +
                  '<p class="tiny muted">' + esc(I18N.t("tasks.supervisor")) + ": " +
                  esc(sup ? tx(sup.name) : "—") + "</p></div>" +
                '<div class="stack gap-1" style="align-items:flex-end">' +
                  '<span class="status status--info">' + esc(I18N.t("tasks.inProgress")) + "</span>" +
                  '<span class="tiny faint num">' + I18N.num(t.reward) + " " + esc(I18N.t("profile.sar")) + "</span>" +
                "</div></div>";
            }).join("")
          : '<p class="muted center" style="padding:var(--s-6)">' + esc(I18N.t("tasks.noneAccepted")) + "</p>";
      }
    }

    /* Requests a lawyer routed here from their inbox. */
    function drawAssigned() {
      var host = $("[data-assigned-list]");
      if (!host) return;
      var mine = DATA.inbox.filter(function (r) {
        var st = global.Store.req(r.id, r);
        return !!st.assignedTo && st.state !== "done";
      });

      var badge = $("[data-assigned-count]");
      if (badge) badge.textContent = I18N.num(mine.length);

      host.innerHTML = mine.length ? mine.map(function (r) {
        var type = DATA.requestTypeById(r.type);
        var sup = DATA.lawyers[0];
        var st = global.Store.req(r.id, r);
        var started = st.state === "started";
        return '<div class="list-row">' +
          '<span class="list-row__icon" style="color:var(--info)">' +
            Icons.svg(type.icon, "icon-sm") + "</span>" +
          '<div class="grow" style="min-width:0"><strong class="small">' + esc(tx(r.title)) + "</strong>" +
            '<p class="tiny muted">' + esc(I18N.t("tasks.fromLawyer")) + ": " + esc(tx(sup.name)) +
              ' <span class="dot"></span> ' + esc(tx(type.title)) + "</p>" +
            '<p class="tiny faint">' + esc(tx(r.note)) + "</p></div>" +
          '<div class="stack gap-2" style="align-items:flex-end">' +
            '<span class="status status--' + (started ? "warn" : "info") + '">' +
              esc(I18N.t(started ? "tasks.inProgress" : "inbox.assigned")) + "</span>" +
            '<button class="btn btn--sm ' + (started ? "btn--accent" : "btn--primary") +
              '" type="button" data-task-action="' + esc(r.id) + '" data-started="' + started + '">' +
              esc(I18N.t(started ? "tasks.submit" : "tasks.openTask")) + "</button>" +
          "</div></div>";
      }).join("")
        : '<p class="muted center" style="padding:var(--s-6)">' + esc(I18N.t("tasks.noneAssigned")) + "</p>";
    }

    global.Store.onChange(drawAssigned);

    var assignedHost = $("[data-assigned-list]");
    if (assignedHost) {
      assignedHost.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-task-action]");
        if (!btn) return;
        var id = btn.getAttribute("data-task-action");
        if (btn.getAttribute("data-started") === "true") {
          global.Store.set(id, { state: "submitted", assignedTo: null });
          App.toast(I18N.t("tasks.submittedOk"), "check");
        } else {
          global.Store.set(id, { state: "started" });
          App.toast(I18N.t("tasks.started"), "check");
        }
        drawAssigned();
      });
    }

    App.onRender(function () {
      drawAssigned();
      var sel = $("[data-task-filter]");
      if (sel) {
        var used = {};
        DATA.tasks.forEach(function (t) { used[t.specialty] = true; });
        sel.innerHTML = '<option value="all">' + esc(I18N.t("tasks.filterAll")) + "</option>" +
          DATA.specialties.filter(function (sp) { return used[sp.id]; }).map(function (sp) {
            return '<option value="' + esc(sp.id) + '">' + esc(tx(sp)) + "</option>";
          }).join("");
        sel.value = filter;
      }

      // The bank is a trainee workspace; anyone else gets an invitation to switch.
      var gate = $("[data-role-gate]");
      if (gate) gate.classList.toggle("hidden", global.Roles.is("intern"));

      draw();
    });

    list.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-accept]");
      if (!btn) return;
      var id = btn.getAttribute("data-accept");
      if (acceptedTasks.indexOf(id) === -1) acceptedTasks.push(id);
      App.toast(I18N.t("tasks.accepted"), "check");
      draw();
    });

    var sel = $("[data-task-filter]");
    if (sel) sel.addEventListener("change", function () { filter = sel.value; draw(); });

    var become = $("[data-become-intern]");
    if (become) {
      become.addEventListener("click", function () {
        global.Roles.set("intern");
        App.toast(I18N.t("role.changed", { role: I18N.t("role.intern") }), "graduation");
      });
    }
  }

  /* ============================================================= ASSISTANT
     One page, three faces: a client orders a draft, a lawyer tunes the
     knowledge base and approves what the assistant wrote, a trainee is
     pointed at the task bank instead. Session state only — no backend. */
  var kbFiles = null;             // lazily cloned from DATA so edits are local
  var kbRegs = {};
  var requestState = {};          // id -> "queued" | "drafted" | "approved"
  var uploadCounter = 0;

  function initAssistant() {
    var lawyerPane = $("[data-ai-lawyer]");
    if (!lawyerPane) return;

    if (!kbFiles) kbFiles = DATA.lawyerFiles.slice();
    DATA.regulations.forEach(function (r) {
      if (!(r.id in kbRegs)) kbRegs[r.id] = r.on;
    });
    DATA.aiRequests.forEach(function (r) {
      if (!(r.id in requestState)) requestState[r.id] = r.state;
    });

    var openDraft = null;

    /* ---------------- lawyer ---------------- */
    function drawKb() {
      var host = $("[data-kb-files]");
      if (host) {
        host.innerHTML = kbFiles.map(function (f) {
          return '<div class="list-row">' +
            '<span class="list-row__icon" style="color:var(--accent)">' +
              Icons.svg("file-text", "icon-sm") + "</span>" +
            '<div class="grow"><strong class="small">' + esc(tx(f)) + "</strong>" +
              '<p class="tiny muted">' +
                esc(I18N.t(f.kind === "template" ? "ai.template" : "ai.precedent")) +
                ' <span class="dot"></span> <span class="num">' + esc(f.size) + "</span></p></div>" +
            '<button class="icon-btn" type="button" data-kb-remove="' + esc(f.id) + '" ' +
              'aria-label="' + esc(I18N.t("ai.removeFile")) + '">' +
              Icons.svg("close", "icon-sm") + "</button></div>";
        }).join("");
      }

      var regsHost = $("[data-kb-regs]");
      if (regsHost) {
        regsHost.innerHTML = DATA.regulations.map(function (r) {
          return '<label class="check"><input type="checkbox" data-reg="' + esc(r.id) + '"' +
            (kbRegs[r.id] ? " checked" : "") + "><span>" + esc(tx(r)) + "</span></label>";
        }).join("");
      }
      var badge = $("[data-regs-count]");
      if (badge) {
        var on = DATA.regulations.filter(function (r) { return kbRegs[r.id]; }).length;
        badge.textContent = I18N.t("ai.regsOn", { n: I18N.num(on) });
      }
    }

    function drawQueue() {
      var host = $("[data-ai-queue]");
      if (!host) return;
      var live = DATA.aiRequests.filter(function (r) { return requestState[r.id] !== "approved"; });

      var badge = $("[data-queue-count]");
      if (badge) badge.textContent = I18N.num(live.length);

      host.innerHTML = live.length ? live.map(function (r) {
        var d = DATA.docTypeById(r.doc);
        var state = requestState[r.id];
        var ready = state === "drafted";
        return '<div class="list-row">' +
          '<span class="list-row__icon">' + Icons.svg(ready ? "sparkle" : "clock", "icon-sm") + "</span>" +
          '<div class="grow"><strong class="small">' + esc(d ? tx(d.title) : "") + "</strong>" +
            '<p class="tiny muted">' + esc(tx(r.client)) + ' <span class="dot"></span> ' +
              esc(tx(r.ago)) + "</p>" +
            '<p class="tiny faint">' + esc(tx(r.note)) + "</p></div>" +
          '<div class="stack gap-2" style="align-items:flex-end">' +
            '<span class="status status--' + (ready ? "ok" : "muted") + '">' +
              esc(I18N.t(ready ? "ai.stateDrafted" : "ai.stateQueued")) + "</span>" +
            '<button class="btn btn--sm ' + (ready ? "btn--primary" : "btn--outline") +
              '" type="button" data-req="' + esc(r.id) + '">' +
              esc(I18N.t(ready ? "ai.openDraft" : "ai.generate")) + "</button>" +
          "</div></div>";
      }).join("")
        : '<p class="muted center" style="padding:var(--s-6)">' + esc(I18N.t("ai.queueEmpty")) + "</p>";
    }

    function drawEditor() {
      var host = $("[data-draft-editor]");
      if (!host) return;
      if (!openDraft) { host.hidden = true; host.innerHTML = ""; return; }

      var req = DATA.aiRequests.filter(function (r) { return r.id === openDraft; })[0];
      if (!req) { host.hidden = true; return; }
      var d = DATA.docTypeById(req.doc);
      var body = DATA.draftBodies[req.doc];
      var onRegs = DATA.regulations.filter(function (r) { return kbRegs[r.id]; })
        .slice(0, 3).map(function (r) { return tx(r); }).join("، ");

      host.hidden = false;
      host.innerHTML =
        '<div class="panel__head row between wrap gap-3">' +
          "<div><h2 class=\"subtitle\">" + esc(I18N.t("ai.draftFor")) + " " + esc(tx(req.client)) + "</h2>" +
            '<p class="tiny muted">' + esc(d ? tx(d.title) : "") + ' <span class="dot"></span> ' +
              esc(I18N.t("ai.aiSource")) + "</p></div>" +
          '<button class="icon-btn" type="button" data-draft-close ' +
            'aria-label="' + esc(I18N.t("ai.discard")) + '">' + Icons.svg("close", "icon-sm") + "</button>" +
        "</div>" +
        '<div style="padding:var(--s-4) var(--s-6) 0">' +
          '<p class="tiny muted">' + esc(I18N.t("ai.basedOn")) + ": " + esc(onRegs) + "</p>" +
          '<p class="tiny muted" style="margin-top:var(--s-1)">' + esc(I18N.t("ai.editHint")) + "</p>" +
        "</div>" +
        '<textarea class="draft-text" data-draft-body spellcheck="false">' +
          esc(body ? tx(body) : "") + "</textarea>" +
        '<div class="draft-foot">' +
          '<div><span class="tiny muted">' + esc(I18N.t("ai.earns")) + "</span>" +
            '<strong style="display:block;color:var(--accent)"><span class="num">' +
              I18N.num(d ? Math.round(d.price * 0.7) : 0) + "</span> " +
              esc(I18N.t("profile.sar")) + "</strong></div>" +
          '<span class="tiny muted grow">' +
            esc(I18N.t("ai.reviewMinutes", { n: I18N.num(6) })) + "</span>" +
          '<button class="btn btn--accent" type="button" data-draft-approve>' +
            Icons.svg("check", "icon-sm") + esc(I18N.t("ai.approve")) + "</button>" +
        "</div>";
    }

    App.onRender(function () {
      var isLawyer = global.Roles.is("lawyer");
      lawyerPane.hidden = !isLawyer;
      var gate = $("[data-ai-gate]");
      if (gate) gate.hidden = isLawyer;
      if (isLawyer) { drawKb(); drawQueue(); drawEditor(); }
    });

    /* ---------------- interactions ---------------- */
    var lawyerView = lawyerPane;
    if (lawyerView) {
      lawyerView.addEventListener("click", function (ev) {
        var up = ev.target.closest("[data-kb-upload]");
        if (up) {
          uploadCounter++;
          kbFiles = kbFiles.concat([{
            id: "up-" + uploadCounter, kind: "template", size: "36 KB",
            ar: "ملف مرفوع " + uploadCounter, en: "Uploaded file " + uploadCounter
          }]);
          App.toast(I18N.t("ai.uploaded"), "check");
          drawKb();
          return;
        }

        var rm = ev.target.closest("[data-kb-remove]");
        if (rm) {
          var id = rm.getAttribute("data-kb-remove");
          kbFiles = kbFiles.filter(function (f) { return f.id !== id; });
          App.toast(I18N.t("ai.removed"), "close");
          drawKb();
          return;
        }

        var req = ev.target.closest("[data-req]");
        if (req) {
          var rid = req.getAttribute("data-req");
          if (requestState[rid] === "queued") {
            // Writing takes a beat, so the state change reads as work happening.
            req.disabled = true;
            req.textContent = I18N.t("ai.generating");
            setTimeout(function () {
              requestState[rid] = "drafted";
              openDraft = rid;
              App.toast(I18N.t("ai.generated"), "sparkle");
              drawQueue(); drawEditor();
            }, 700);
          } else {
            openDraft = rid;
            drawEditor();
            var ed = $("[data-draft-editor]");
            if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }

        if (ev.target.closest("[data-draft-close]")) { openDraft = null; drawEditor(); return; }

        if (ev.target.closest("[data-draft-approve]")) {
          requestState[openDraft] = "approved";
          openDraft = null;
          App.toast(I18N.t("ai.approved"), "check");
          drawQueue(); drawEditor();
        }
      });

      lawyerView.addEventListener("change", function (ev) {
        var reg = ev.target.closest("[data-reg]");
        if (!reg) return;
        kbRegs[reg.getAttribute("data-reg")] = reg.checked;
        drawKb();
      });
    }
  }

  /* =============================================================== ACCOUNT */
  function initAccount() {
    var switcher = $("[data-role-switcher]");
    if (!switcher) return;

    App.onRender(function () {
      var role = global.Roles.info;

      var ident = $("[data-account-identity]");
      if (ident) {
        ident.innerHTML =
          '<div class="row gap-5 wrap" style="align-items:center">' +
            '<img class="avatar avatar--lg avatar--round" alt="" width="88" height="88" src="' +
              App.avatarOf({ ar: "فهد", en: "Fahad Al-Otaibi" }, "account") + '">' +
            '<div class="grow"><p class="tiny muted" data-i18n="account.signedInAs"></p>' +
              '<h2 class="title">' + esc(tx({ ar: "فهد العتيبي", en: "Fahad Al-Otaibi" })) + "</h2>" +
              '<p class="small muted">' + esc(I18N.t("role.current")) + ": " +
                '<strong style="color:var(--accent)">' + esc(I18N.t(role.nameKey)) + "</strong></p></div>" +
            '<a class="btn btn--primary" href="' + role.home + '">' +
              esc(I18N.t("role.workspace")) + Icons.svg("arrow", "icon-sm icon-flip") + "</a>" +
          "</div>";
        I18N.apply(ident);
      }

      switcher.innerHTML = global.Roles.all().map(function (r) {
        var on = r.id === role.id;
        return '<button type="button" class="role-card' + (on ? " is-active" : "") + '" data-pick-role="' + r.id + '">' +
          '<span class="role-card__icon">' + Icons.svg(r.icon, "icon-lg") + "</span>" +
          "<strong>" + esc(I18N.t(r.nameKey)) + "</strong>" +
          '<span class="tiny muted">' + esc(I18N.t(r.id === "client" ? "role.clientDesc"
            : r.id === "lawyer" ? "role.lawyerDesc" : "role.internDesc")) + "</span>" +
          (on ? '<span class="role-card__check">' + Icons.svg("check", "icon-sm") + "</span>" : "") +
          "</button>";
      }).join("");

      var links = $("[data-account-links]");
      if (links) {
        var items = [
          { href: "dashboard-client.html", key: "nav.dashboardClient", icon: "grid" },
          { href: "dashboard-lawyer.html", key: "nav.dashboardLawyer", icon: "briefcase" },
          { href: "tasks.html",            key: "nav.tasks",           icon: "graduation" },
          { href: "assistant.html",        key: "nav.assistant",       icon: "sparkle" },
          { href: "about.html",            key: "nav.about",           icon: "shield-check" },
          { href: "login.html",            key: "dash.logout",         icon: "logout" }
        ];
        links.innerHTML = items.map(function (it) {
          return '<a class="account-link" href="' + it.href + '">' +
            Icons.svg(it.icon, "icon-sm") + "<span>" + esc(I18N.t(it.key)) + "</span>" +
            Icons.svg("chevron", "icon-sm account-link__go") + "</a>";
        }).join("");
      }
    });

    switcher.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-pick-role]");
      if (!btn) return;
      var id = btn.getAttribute("data-pick-role");
      if (global.Roles.is(id)) return;
      global.Roles.set(id);
      App.toast(I18N.t("role.changed", { role: I18N.t(global.Roles.info.nameKey) }), "check");
    });
  }

  /* ================================================================= route */
  function mount() {
    var page = document.documentElement.getAttribute("data-page") || "";
    if (page === "home") initHome();
    else if (page === "lawyers" && $("[data-results]")) initDirectory();
    else if (page === "lawyers") initProfile();
    else if (page === "blog") initBlog();
    else if (page === "about") initAbout();
    else if (page === "login") initAuth();
    else if (page === "dashboard") initLawyerDash();
    else if (page === "dashboard-client") initClientDash();
    else if (page === "tasks") initTasks();
    else if (page === "assistant") initAssistant();
    else if (page === "account") initAccount();
  }

  global.Pages = { mount: mount };

  // Served as separate HTML files, each document mounts itself. The bundled
  // single-file build sets __SPA__ and lets its router call mount() per route.
  if (!global.__SPA__) mount();
})(window);
