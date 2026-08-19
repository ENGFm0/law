/* ==========================================================================
   Sign-in. Also offers the seeded demo people, so the three interfaces can be
   seen without registering three times.
   ========================================================================== */
Pages.define("login", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, M = global.Models,
      App = global.App, Store = global.Store, Session = global.Session;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var form = $("[data-login]");
  if (!form) return;

  function error(key) {
    var el = $("[data-login-error]");
    el.hidden = !key;
    if (key) el.textContent = I18N.t(key);
  }

  App.onRender(function () {
    var points = $("[data-auth-points]");
    if (points) {
      points.innerHTML = ["auth.asidePoint1", "auth.asidePoint2", "auth.asidePoint3"].map(function (k) {
        return '<li class="row gap-3">' + Icons.svg("check") + "<span>" + esc(I18N.t(k)) + "</span></li>";
      }).join("");
    }

    var demo = $("[data-demo-accounts]");
    if (demo) {
      // One seeded person per role, so each interface is one click away.
      var picks = [
        { id: "u-fahad", roleKey: "role.client" },
        { id: "u-ahmed", roleKey: "role.lawyer" },
        { id: "u-jaid",  roleKey: "role.intern" }
      ];
      demo.innerHTML = picks.map(function (p) {
        var u = M.user(p.id);
        return '<button type="button" class="demo-card" data-demo="' + esc(p.id) + '">' +
          global.C.avatar(u, "sm") +
          "<strong>" + esc(tx(u.name).split(" ").slice(0, 2).join(" ")) + "</strong>" +
          '<span class="tiny muted">' + esc(I18N.t(p.roleKey)) + "</span></button>";
      }).join("");
    }
  });

  var demoHost = $("[data-demo-accounts]");
  if (demoHost) {
    demoHost.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-demo]");
      if (!btn) return;
      Store.signIn(btn.getAttribute("data-demo"));
      App.go("index.html");
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = form.querySelector('[name="email"]').value.trim();
    var pass = form.querySelector('[name="password"]').value;
    if (!email) { error("signup.needEmail"); return; }
    var button = form.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = I18N.t("auth.working"); }
    Session.signIn(email, pass).then(function (res) {
      if (button) { button.disabled = false; button.textContent = I18N.t("auth.signIn"); }
      if (!res.ok) { error("login." + res.error); return; }
      App.go("index.html");
    });
  });
});
