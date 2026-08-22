/* ==========================================================================
   About — mission, values, the numbers, the people, and the questions that
   get asked before anyone signs up.
   ========================================================================== */
Pages.define("about", function (global) {
  "use strict";

  var I18N = global.I18N, Icons = global.Icons, App = global.App, C = global.C;
  var $ = App.$, esc = App.esc, tx = App.tx;

  var host = $("[data-about]");
  if (!host) return;

  function stats() {
    return '<div class="grid grid-4">' + global.SEED.stats.map(function (s) {
      return '<div class="card card--pad center">' +
        '<p class="display num" style="font-size:2rem">' + esc(s.value) + "</p>" +
        '<p class="small muted">' + esc(tx(s.label)) + "</p></div>";
    }).join("") + "</div>";
  }

  function values() {
    return '<div class="grid grid-2">' + global.SEED.values.map(function (v) {
      return '<article class="card card--pad feature">' +
        '<span class="feature__icon">' + Icons.svg(v.icon, "icon-lg") + "</span>" +
        '<h3 class="subtitle">' + esc(tx(v.title)) + "</h3>" +
        '<p class="small muted">' + esc(tx(v.body)) + "</p></article>";
    }).join("") + "</div>";
  }

  function team() {
    return '<div class="grid grid-4">' + global.SEED.team.map(function (m) {
      return '<article class="card card--pad center">' +
        '<img class="avatar avatar--lg" style="margin-inline:auto" alt="" ' +
          'src="' + App.avatarOf(m.name, tx(m.role)) + '">' +
        '<h3 class="subtitle" style="margin-top:var(--s-4)">' + esc(tx(m.name)) + "</h3>" +
        '<p class="small muted">' + esc(tx(m.role)) + "</p></article>";
    }).join("") + "</div>";
  }

  function faq() {
    return '<div class="stack gap-3">' + global.SEED.faq.map(function (f) {
      return '<details class="card faq-item"><summary class="faq-q">' +
        "<span>" + esc(tx(f.q)) + "</span>" +
        '<span class="faq-chevron">' + Icons.svg("chevron-down", "icon-sm") + "</span></summary>" +
        '<p class="faq-a">' + esc(tx(f.a)) + "</p></details>";
    }).join("") + "</div>";
  }

  App.onRender(function () {
    host.innerHTML =
      '<section class="section section--tight"><div class="container" style="max-width:820px">' +
        '<span class="eyebrow" data-i18n="nav.about"></span>' +
        '<h1 class="display" style="margin-top:var(--s-3)" data-i18n="about.heading"></h1>' +
        '<p class="lead" data-i18n="about.lead"></p></div></section>' +

      '<section class="section section--tight"><div class="container reveal">' +
        '<div class="grid grid-2">' +
          '<div class="card card--pad card--rule-navy">' +
            '<h2 class="title" data-i18n="about.missionTitle"></h2>' +
            '<p class="lead" style="margin-top:var(--s-3)" data-i18n="about.missionBody"></p></div>' +
          '<div class="card card--pad card--rule-gold">' +
            '<h2 class="title" data-i18n="about.visionTitle"></h2>' +
            '<p class="lead" style="margin-top:var(--s-3)" data-i18n="about.visionBody"></p></div>' +
        "</div></div></section>" +

      '<section class="section section--band"><div class="container reveal">' +
        '<h2 class="headline" style="margin-bottom:var(--s-8)" data-i18n="about.numbersTitle"></h2>' +
        stats() + "</div></section>" +

      '<section class="section section--tight"><div class="container reveal">' +
        C.sectionHead("about.valuesTitle", "about.valuesLead") + values() + "</div></section>" +

      '<section class="section section--tight"><div class="container reveal">' +
        C.sectionHead("about.teamTitle", "about.teamLead") + team() + "</div></section>" +

      '<section class="section section--band" id="faq"><div class="container reveal" style="max-width:820px">' +
        '<h2 class="headline" style="margin-bottom:var(--s-8)" data-i18n="about.faqTitle"></h2>' +
        faq() + "</div></section>" +

      '<section class="section section--tight" id="contact"><div class="container reveal" style="max-width:640px">' +
        '<h2 class="headline" data-i18n="about.contactTitle"></h2>' +
        '<p class="lead" data-i18n="about.contactLead"></p>' +
        '<form class="card card--pad stack gap-4" style="margin-top:var(--s-6)" data-contact novalidate>' +
          '<label class="field"><span class="label" data-i18n="about.name"></span>' +
            '<input class="input" name="name"></label>' +
          '<label class="field"><span class="label" data-i18n="about.email"></span>' +
            '<input class="input" name="email" type="email" dir="ltr"></label>' +
          '<label class="field"><span class="label" data-i18n="about.message"></span>' +
            '<textarea class="textarea" name="message"></textarea></label>' +
          '<button class="btn btn--primary" type="submit" data-i18n="about.send"></button>' +
        "</form></div></section>";

    I18N.apply(host);
    App.observeReveals(host);
  });

  host.addEventListener("submit", function (ev) {
    if (!ev.target.matches("[data-contact]")) return;
    ev.preventDefault();
    ev.target.reset();
    App.toast(I18N.t("about.sent"), "check");
  });
});
