/* ==========================================================================
   Sign-up — one wizard, three endings.
   Step 3 is where the roles diverge: a lawyer proves a licence, a trainee
   describes where they study and what they can do, a client skips it.
   ========================================================================== */
Pages.define("signup", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session;
  var $ = App.$, $$ = App.$$, esc = App.esc, tx = App.tx;

  var form = $("[data-signup]");
  if (!form) return;

  var state = { step: 1, role: null, avatar: null, skills: [], specialties: [] };
  var LAST = 4;

  /* A client needs no proof of standing, so their wizard is a step shorter. */
  function steps() {
    return state.role === "client" ? [1, 2, 4] : [1, 2, 3, 4];
  }
  function stepIndex() { return steps().indexOf(state.step); }

  function drawStepper() {
    var host = $("[data-stepper]");
    if (!host) return;
    var seq = steps();
    var labels = { 1: "signup.stepRole", 2: "signup.stepBasics", 3: "signup.stepProof", 4: "signup.stepReview" };
    host.innerHTML = seq.map(function (n, i) {
      var done = seq.indexOf(state.step) > i;
      var here = state.step === n;
      return '<li class="step-dot' + (here ? " is-here" : "") + (done ? " is-done" : "") + '">' +
        '<span class="step-dot__mark">' + (done ? Icons.svg("check", "icon-sm") : I18N.num(i + 1)) + "</span>" +
        '<span data-i18n="' + labels[n] + '"></span></li>';
    }).join("");
    I18N.apply(host);
  }

  function drawRoles() {
    var host = $("[data-role-picker]");
    if (!host) return;
    host.innerHTML = Session.allRoles().map(function (r) {
      var descKey = r.id === "client" ? "role.clientDesc"
                  : r.id === "lawyer" ? "role.lawyerDesc" : "role.internDesc";
      return '<button type="button" class="role-card' + (state.role === r.id ? " is-active" : "") +
        '" data-pick="' + r.id + '">' +
        '<span class="role-card__icon">' + Icons.svg(r.icon, "icon-lg") + "</span>" +
        "<strong>" + esc(I18N.t(r.nameKey)) + "</strong>" +
        '<span class="tiny muted">' + esc(I18N.t(descKey)) + "</span>" +
        (state.role === r.id ? '<span class="role-card__check">' + Icons.svg("check", "icon-sm") + "</span>" : "") +
        "</button>";
    }).join("");
  }

  function drawCities() {
    var sel = $("[data-city-options]");
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = SEEDCITIES().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(tx(c)) + "</option>";
    }).join("");
    if (cur) sel.value = cur;
  }
  function SEEDCITIES() { return global.SEED.cities; }

  /* ---------- step 3, per role ---------- */
  function drawProof() {
    var title = $("[data-step3-title]");
    var host = $("[data-step3-fields]");
    if (!host) return;

    if (state.role === "lawyer") {
      title.textContent = I18N.t("signup.licenceTitle");
      host.innerHTML =
        '<div class="grid grid-2" style="gap:var(--s-4)">' +
          field("licenceNumber", "signup.licenceNo", "text", "num") +
          field("licenceAuthority", "signup.licenceAuthority") +
          field("licenceExpiry", "signup.licenceExpiry", "date") +
          field("years", "signup.years", "number") +
        "</div>" +
        '<label class="field" style="margin-top:var(--s-4)">' +
          '<span class="label">' + esc(I18N.t("signup.licenceFile")) + "</span>" +
          '<input class="input" name="licenceFile" type="file" accept="image/*,.pdf"></label>' +
        '<p class="tiny faint" style="margin-top:var(--s-2)">' + esc(I18N.t("signup.uploadNote")) + "</p>" +
        '<div class="field" style="margin-top:var(--s-5)">' +
          '<span class="label">' + esc(I18N.t("signup.specialties")) + "</span>" +
          '<div class="row gap-2 wrap" data-spec-picker></div></div>' +
        '<label class="field" style="margin-top:var(--s-4)">' +
          '<span class="label">' + esc(I18N.t("signup.bio")) + "</span>" +
          '<textarea class="textarea" name="bio"></textarea></label>';
      drawSpecialties();
    } else {
      title.textContent = I18N.t("signup.internTitle");
      host.innerHTML =
        '<div class="grid grid-2" style="gap:var(--s-4)">' +
          field("university", "signup.university") +
          field("level", "signup.level") +
        "</div>" +
        '<label class="field" style="margin-top:var(--s-4)">' +
          '<span class="label">' + esc(I18N.t("signup.cv")) + "</span>" +
          '<input class="input" name="cvFile" type="file" accept=".pdf,.doc,.docx"></label>' +
        '<p class="tiny faint" style="margin-top:var(--s-2)">' + esc(I18N.t("signup.uploadNote")) + "</p>" +
        '<div class="field" style="margin-top:var(--s-5)">' +
          '<span class="label">' + esc(I18N.t("signup.skills")) + "</span>" +
          '<p class="tiny muted">' + esc(I18N.t("signup.skillsHint")) + "</p>" +
          '<div class="chip-input"><input class="input" data-skill-input ' +
            'placeholder="' + esc(I18N.t("signup.skillPlaceholder")) + '">' +
            '<button class="btn btn--outline btn--sm" type="button" data-skill-add>' +
              esc(I18N.t("signup.add")) + "</button></div>" +
          '<div class="row gap-2 wrap" style="margin-top:var(--s-3)" data-skill-list></div></div>' +
        '<label class="field" style="margin-top:var(--s-4)">' +
          '<span class="label">' + esc(I18N.t("signup.bio")) + "</span>" +
          '<textarea class="textarea" name="bio"></textarea></label>';
      drawSkills();
    }
  }

  function field(name, labelKey, type, cls) {
    return '<label class="field"><span class="label">' + esc(I18N.t(labelKey)) + "</span>" +
      '<input class="input' + (cls ? " " + cls : "") + '" name="' + name +
      '" type="' + (type || "text") + '"></label>';
  }

  function drawSpecialties() {
    var host = $("[data-spec-picker]");
    if (!host) return;
    host.innerHTML = global.SEED.specialties.map(function (s) {
      return '<button type="button" class="chip' + (state.specialties.indexOf(s.id) !== -1 ? " is-active" : "") +
        '" data-spec="' + esc(s.id) + '">' + esc(tx(s)) + "</button>";
    }).join("");
  }

  function drawSkills() {
    var host = $("[data-skill-list]");
    if (!host) return;
    host.innerHTML = state.skills.length
      ? state.skills.map(function (sk, i) {
          return '<span class="chip is-active">' + esc(sk) +
            '<button type="button" data-skill-del="' + i + '" aria-label="×">' +
            Icons.svg("close", "icon-sm") + "</button></span>";
        }).join("")
      : '<span class="tiny faint">' + esc(I18N.t("signup.noSkills")) + "</span>";
  }

  /* ---------- step 4 ---------- */
  function drawReview() {
    var host = $("[data-review]");
    if (!host) return;
    var d = collect();
    var rows = [
      ["signup.role", I18N.t(Session.roleDef(state.role).nameKey)],
      ["auth.fullName", d.name],
      ["auth.email", d.email],
      ["signup.phone", d.phone],
      ["home.city", d.city ? tx(M.city(d.city)) : ""]
    ];
    if (state.role === "lawyer") {
      rows.push(["signup.licenceNo", d.licenceNumber], ["signup.licenceExpiry", d.licenceExpiry]);
      rows.push(["signup.specialties", state.specialties.map(function (id) { return tx(M.specialty(id)); }).join("، ")]);
    }
    if (state.role === "intern") {
      rows.push(["signup.university", d.university], ["signup.level", d.level]);
      rows.push(["signup.skills", state.skills.join("، ")]);
    }
    host.innerHTML = '<dl class="review">' + rows.map(function (r) {
      return "<dt>" + esc(I18N.t(r[0])) + "</dt><dd>" + (esc(r[1]) || '<span class="faint">—</span>') + "</dd>";
    }).join("") + "</dl>" +
    (state.role !== "client"
      ? '<p class="note-inline">' + Icons.svg("clock", "icon-sm") + esc(I18N.t("signup.pendingNote")) + "</p>"
      : "");
  }

  function collect() {
    var d = {};
    $$("input,select,textarea", form).forEach(function (el) {
      if (el.name && el.type !== "file" && el.type !== "checkbox") d[el.name] = el.value.trim();
    });
    return d;
  }

  /* ---------- navigation ---------- */
  function show() {
    $$("[data-step]", form).forEach(function (sec) {
      sec.hidden = String(state.step) !== sec.getAttribute("data-step");
    });
    var seq = steps(), i = stepIndex();
    $("[data-back]").hidden = i <= 0;
    $("[data-next]").hidden = i >= seq.length - 1;
    $("[data-finish]").hidden = i < seq.length - 1;
    var gslot = $("[data-google-slot]");
    if (gslot) gslot.innerHTML = state.step === 1 ? global.C.googleButton() : "";
    if (state.step === 3) drawProof();
    if (state.step === 4) drawReview();
    drawStepper();
    error(null);
  }

  function error(key) {
    var el = $("[data-signup-error]");
    if (!el) return;
    el.hidden = !key;
    if (key) el.textContent = I18N.t(key);
  }

  function validate() {
    var d = collect();
    if (state.step === 1 && !state.role) return "signup.needRole";
    if (state.step === 2) {
      if (!d.name) return "signup.needName";
      if (!/^\S+@\S+\.\S+$/.test(d.email || "")) return "signup.needEmail";
      if (!d.password || d.password.length < 4) return "signup.needPassword";
      if (Store.findAccount(d.email)) return "signup.emailTaken";
    }
    if (state.step === 3 && state.role === "lawyer" && !d.licenceNumber) return "signup.needLicence";
    if (state.step === 3 && state.role === "intern" && !d.university) return "signup.needUniversity";
    return null;
  }

  App.onRender(function () {
    // Google returns a client, so the door only belongs on the first step —
    // a lawyer still has a licence to give us before anything else happens.
    var slot = $("[data-google-slot]");
    if (slot) slot.innerHTML = state.step === 1 ? global.C.googleButton() : "";

    drawRoles(); drawCities(); drawStepper();
    if (state.step === 3) drawProof();
    if (state.step === 4) drawReview();
  });

  form.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-google]")) {
      global.SB.signInWithGoogle(global.location.origin +
        global.location.pathname.replace(/signup\.html$/, "index.html"))
        .catch(function () { App.toast(I18N.t("auth.googleFailed"), "close"); });
      return;
    }

    var pick = ev.target.closest("[data-pick]");
    if (pick) { state.role = pick.getAttribute("data-pick"); drawRoles(); drawStepper(); return; }

    var sp = ev.target.closest("[data-spec]");
    if (sp) {
      var id = sp.getAttribute("data-spec");
      var at = state.specialties.indexOf(id);
      at === -1 ? state.specialties.push(id) : state.specialties.splice(at, 1);
      drawSpecialties();
      return;
    }

    if (ev.target.closest("[data-skill-add]")) { addSkill(); return; }
    var del = ev.target.closest("[data-skill-del]");
    if (del) { state.skills.splice(+del.getAttribute("data-skill-del"), 1); drawSkills(); return; }

    if (ev.target.closest("[data-next]")) {
      var bad = validate();
      if (bad) { error(bad); return; }
      var seq = steps();
      state.step = seq[Math.min(stepIndex() + 1, seq.length - 1)];
      show();
      return;
    }
    if (ev.target.closest("[data-back]")) {
      var s2 = steps();
      state.step = s2[Math.max(stepIndex() - 1, 0)];
      show();
    }
  });

  function addSkill() {
    var input = $("[data-skill-input]");
    var v = input.value.trim();
    if (!v) return;
    if (state.skills.indexOf(v) === -1) state.skills.push(v);
    input.value = "";
    drawSkills();
  }
  form.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && ev.target.matches("[data-skill-input]")) { ev.preventDefault(); addSkill(); }
  });

  /* A picked image is read into a data URI — there is nowhere to upload it. */
  form.addEventListener("change", function (ev) {
    if (ev.target.name === "avatar" && ev.target.files && ev.target.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { state.avatar = reader.result; };
      reader.readAsDataURL(ev.target.files[0]);
    }
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var bad = validate();
    if (bad) { error(bad); return; }
    if (!form.querySelector('[name="terms"]').checked) { error("signup.needTerms"); return; }

    var d = collect();
    var fileOf = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el && el.files && el.files[0] ? el.files[0].name : null;
    };
    var name = { ar: d.name, en: d.name };

    var button = $("[data-finish]");
    if (button) { button.disabled = true; button.textContent = I18N.t("auth.working"); }

    Store.register({
      role: state.role, name: name, email: d.email, phone: d.phone,
      city: d.city, password: d.password, avatar: state.avatar,
      licenceNumber: d.licenceNumber, licenceAuthority: d.licenceAuthority,
      licenceExpiry: d.licenceExpiry, licenceFile: fileOf("licenceFile"),
      specialties: state.specialties, years: +d.years || 0, bio: { ar: d.bio, en: d.bio },
      university: { ar: d.university, en: d.university }, level: { ar: d.level, en: d.level },
      skills: state.skills.map(function (s) { return { ar: s, en: s }; }),
      cvFile: fileOf("cvFile")
    }).then(function (res) {
      if (button) { button.disabled = false; I18N.apply(button.parentNode); }
      if (!res.ok) {
        // A backend can fail in ways the demo never could — a refused address,
        // an unconfirmed mailbox — so show what it said when we have no phrase
        // of our own for it.
        error("signup." + res.error);
        if (res.message && I18N.t("signup." + res.error) === "signup." + res.error) {
          var el = $("[data-signup-error]");
          if (el) { el.hidden = false; el.textContent = res.message; }
        }
        return;
      }
      App.toast(I18N.t("signup.welcome", { name: d.name.split(" ")[0] }), "check");
      setTimeout(function () { App.go("index.html"); }, 900);
    });
  });

  show();
});
