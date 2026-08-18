/* ==========================================================================
   Icons — inline SVG so nothing depends on an icon font arriving.
   ========================================================================== */
(function (global) {
  "use strict";

  var PATHS = {
    search:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    scale:     '<path d="M12 3v18M7 21h10M3 8l4-3 4 3M3 8l2 5h4l-2-5M13 8l4-3 4 3M13 8l2 5h4l-2-5"/>',
    location:  '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone:     '<path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/>',
    chat:      '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    video:     '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3v9l-6-3z"/>',
    "file-text":'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    "shield-check":'<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    payments:  '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    lock:      '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    sparkle:   '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    star:      '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    verified:  '<path d="m12 2.5 2.3 1.7 2.8-.2.9 2.7 2.3 1.6-1 2.7 1 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.5l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6 1-2.7-1-2.7 2.3-1.6.9-2.7 2.8.2z"/><path d="m9 12 2 2 4-4" stroke="#fff" fill="none" stroke-width="2"/>',
    arrow:     '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-back":'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevron:   '<path d="m9 6 6 6-6 6"/>',
    "chevron-down":'<path d="m6 9 6 6 6-6"/>',
    sun:       '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    moon:      '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    globe:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
    home:      '<path d="m3 10.5 9-7 9 7V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/><path d="M9.5 21.5v-7h5v7"/>',
    close:     '<path d="m6 6 12 12M18 6 6 18"/>',
    calendar:  '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    download:  '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/>',
    graduation:'<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="M6.5 10.5V15c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5"/>',
    eye:       '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    trend:     '<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
    "trend-down":'<path d="M3 7l6 6 4-4 8 8"/><path d="M16 17h5v-5"/>',
    bell:      '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z"/><path d="M10 21h4"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    grid:      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    logout:    '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4M6 12h9"/>',
    image:     '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/>',
    check:     '<path d="m5 12.5 4.5 4.5L19 7"/>',
    mail:      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    user:      '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    filter:    '<path d="M4 6h16M7 12h10M10 18h4"/>',
    gavel:     '<path d="M3.5 20.5h9"/><path d="m6.5 18 7-7"/><path d="M11.5 8.5 15 5l4 4-3.5 3.5z"/><path d="m16.5 3.5 4 4"/>',
    settings:  '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    wallet:    '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a2 2 0 0 1 2 2v1"/><rect x="3.5" y="7.5" width="17" height="12" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
    bold:      '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic:    '<path d="M15 5H9M15 19H9M14 5l-4 14"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    "align-start":'<path d="M4 6h16M4 11h10M4 16h13M4 21h8"/>',
    "align-center":'<path d="M4 6h16M7 11h10M5 16h14M8 21h8"/>',
    "align-end":'<path d="M4 6h16M10 11h10M7 16h13M12 21h8"/>',
    list:      '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    "list-num":'<path d="M9 6h11M9 12h11M9 18h11M4 5h1v4M4 13h2l-2 3h2"/>'
  ,
    inbox:     '<path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4"/><path d="M5.5 5h13l3 8.5V19a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-5.5z"/>',
    heart:     '<path d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/>',
    comment:   '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M9 11h6M9 14h4"/>',
    upload:    '<path d="M12 20V8M7 12l5-5 5 5M4 4h16"/>',
    badge:     '<path d="m12 2.5 2.4 1.6 2.9-.2.9 2.8 2.4 1.7-1 2.8 1 2.8-2.4 1.7-.9 2.8-2.9-.2L12 20.1l-2.4-1.6-2.9.2-.9-2.8L3.4 14l1-2.8-1-2.8 2.4-1.7.9-2.8 2.9.2z"/><path d="m9.2 11.9 2 2 3.6-3.6"/>',
    trophy:    '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M10 14h4l.6 4h2.4v2H7v-2h2.4z"/>',
    bolt:      '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
    plus2:     '<path d="M12 5v14M5 12h14"/>',
    edit:      '<path d="M15.5 4.5 19.5 8.5 8 20H4v-4z"/><path d="m13.5 6.5 4 4"/>',
    trash:     '<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.5 7 7.5 20h9L17.5 7"/>',
    clockFill: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    tag:       '<path d="M3.5 11.5V4.5h7l9.5 9.5-7 7z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
    send:      '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4z"/>'
  };

  global.Icons = {
    has: function (n) { return Object.prototype.hasOwnProperty.call(PATHS, n); },
    svg: function (name, cls) {
      var body = PATHS[name] || PATHS.chevron;
      return '<svg class="icon' + (cls ? " " + cls : "") +
        '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + "</svg>";
    }
  };
})(window);
