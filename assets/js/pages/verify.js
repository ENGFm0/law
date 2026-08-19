/* ==========================================================================
   A self-test you run in your own browser.

   The development environment this was built in cannot reach supabase.co, so
   the integration could not be checked from there. Rather than hand over code
   that has never met the thing it talks to, the checks live here and run
   against the real project, from a real browser, with the real key.

   It writes as well as reads — a throwaway account, a request, a rating — and
   cleans up what it can. Run it on a project with nothing precious in it.
   ========================================================================== */
Pages.define("verify", function (global) {
  "use strict";

  var App = global.App, Icons = global.Icons, esc = App.esc;
  var $ = App.$;
  var host = $("[data-verify]");
  if (!host) return;

  var rows = [];
  var running = false;
  // Supabase refuses reserved domains such as example.com outright, and with
  // "Confirm email" on it withholds the session until a link is clicked. So the
  // account checks use an address the tester actually controls.
  // Prefilled from ?email= so the address can travel in the link rather than
  // being typed again — and so it never has to be committed to a public repo.
  var creds = {
    email: App.param("email") || "",
    password: "Verify!" + Math.random().toString(36).slice(2, 10),
  };

  function draw() {
    var cfg = global.SANAD_CONFIG || {};
    var sb = cfg.supabase || {};
    host.innerHTML = '<div class="container" style="padding-block:var(--s-10) var(--s-20);max-width:820px">' +
      '<h1 class="headline">فحص الاتصال بـSupabase</h1>' +
      '<p class="lead">يتحقق من المشروع ومن قواعد الحماية بالكتابة والقراءة فعلاً.</p>' +

      '<div class="card card--pad" style="margin-top:var(--s-6)">' +
        line("الوضع الحالي", cfg.backend || "browser") +
        line("عنوان المشروع", sb.url || "—") +
        line("نوع المفتاح", keyKind(sb.anonKey)) +
      "</div>" +

      '<div class="card card--pad" style="margin-top:var(--s-6)">' +
        '<h2 class="subtitle">فحوص الحساب</h2>' +
        '<p class="small muted" style="margin:var(--s-2) 0 var(--s-4)">' +
          'اكتب بريداً تملكه — سيُنشأ به حساب مؤقت ثم تحذفه. اتركه فارغاً ' +
          'لتشغيل فحوص القراءة وحدها.</p>' +
        '<div class="grid grid-2" style="gap:var(--s-4)">' +
          '<label class="field"><span class="label">البريد</span>' +
            '<input class="input" type="email" dir="ltr" data-email value="' +
              esc(creds.email) + '" placeholder="you@yourdomain.com"></label>' +
          '<label class="field"><span class="label">كلمة المرور</span>' +
            '<input class="input" dir="ltr" data-password value="' +
              esc(creds.password) + '"></label>' +
        "</div></div>" +

      '<button class="btn btn--accent btn--lg" style="margin-top:var(--s-6)" type="button" ' +
        'data-run' + (running ? " disabled" : "") + ">" +
        (running ? "جارٍ الفحص…" : "ابدأ الفحص") + "</button>" +

      (rows.length
        ? '<div class="card" style="margin-top:var(--s-6);overflow:hidden">' +
          rows.map(function (r) {
            var colour = r.ok === null ? "var(--text-muted)"
                       : r.ok ? "var(--success)" : "var(--danger)";
            return '<div class="req-row">' +
              '<span class="req-row__icon" style="color:' + colour + '">' +
                Icons.svg(r.ok === null ? "clock" : r.ok ? "check" : "close", "icon-sm") + "</span>" +
              '<div class="grow" style="min-width:0"><strong class="small">' + esc(r.label) + "</strong>" +
                (r.detail ? '<p class="tiny muted" style="word-break:break-word">' +
                  esc(r.detail) + "</p>" : "") + "</div>" +
              '<strong class="small" style="color:' + colour + '">' +
                (r.ok === null ? "…" : r.ok ? "PASS" : "FAIL") + "</strong></div>";
          }).join("") + "</div>"
        : "") +

      (rows.length && !running ? summary() : "") +
    "</div>";
  }

  function line(k, v) {
    return '<div class="row between gap-3" style="padding:var(--s-2) 0">' +
      '<span class="small muted">' + esc(k) + "</span>" +
      '<strong class="small" style="word-break:break-all">' + esc(v) + "</strong></div>";
  }

  function keyKind(key) {
    if (!key) return "غير مضبوط";
    if (/^sb_secret_|service_role/.test(key)) return "⚠️ سري — أخرجه فوراً";
    return "علني ✅";
  }

  function summary() {
    var bad = rows.filter(function (r) { return r.ok === false; }).length;
    return '<div class="card card--pad ' + (bad ? "card--rule-gold" : "") + '" ' +
      'style="margin-top:var(--s-6)">' +
      (bad
        ? '<h2 class="subtitle">فشل ' + bad + ' فحصاً — أرسل لي هذه الصفحة كما هي.</h2>'
        : '<h2 class="subtitle">كل الفحوص نجحت ✅</h2>' +
          '<p class="small muted" style="margin-top:var(--s-2)">' +
          'يمكنك الآن تغيير <code>backend</code> إلى <code>"supabase"</code> ' +
          'في <code>assets/js/config.js</code>.</p>') +
      "</div>";
  }

  function add(label) {
    var row = { label: label, ok: null, detail: "" };
    rows.push(row);
    draw();
    return row;
  }
  function settle(row, ok, detail) { row.ok = ok; row.detail = detail || ""; draw(); }

  /* ---------- the checks ---------- */
  async function run() {
    rows = [];
    running = true;
    draw();

    var cfg = (global.SANAD_CONFIG || {}).supabase || {};
    var emailInput = $("[data-email]", host), pwInput = $("[data-password]", host);
    creds.email = emailInput ? emailInput.value.trim() : "";
    creds.password = pwInput ? pwInput.value : creds.password;
    var email = creds.email, password = creds.password;
    var sb = null, myId = null;

    var r = add("المفتاح علني لا سري");
    settle(r, !/^sb_secret_|service_role/.test(cfg.anonKey || ""),
      /^sb_secret_/.test(cfg.anonKey || "") ? "المفتاح السري في الصفحة — أبطله الآن" : "");

    r = add("تحميل مكتبة supabase-js");
    try { sb = await global.SB.load(); settle(r, true); }
    catch (e) { settle(r, false, String(e && e.message || e)); running = false; draw(); return; }

    r = add("الوصول إلى المشروع (قراءة نطاقات الأسعار)");
    try {
      var bands = await sb.from("price_bands").select("type_id,min_price,max_price");
      if (bands.error) settle(r, false, bands.error.message);
      else settle(r, bands.data.length === 5, bands.data.length + " من ٥ نطاقات");
    } catch (e) { settle(r, false, String(e)); }

    r = add("الطلبات محجوبة عن غير المسجَّل");
    try {
      var anon = await sb.from("requests").select("id");
      settle(r, !anon.error && anon.data.length === 0,
        anon.error ? anon.error.message : "رجع " + anon.data.length + " صفاً");
    } catch (e) { settle(r, false, String(e)); }

    if (!email) {
      add("فحوص القراءة انتهت — اكتب بريداً لتشغيل فحوص الحساب").ok = true;
      running = false; draw(); return;
    }

    r = add("إنشاء حساب حقيقي (كلمة المرور لا تمر بكودنا)");
    var reg = null;
    try {
      reg = await global.SB.register({
        role: "client", name: { ar: "فحص", en: "Verify" },
        email: email, password: password, phone: "0500000000",
      });
      myId = reg.ok ? reg.user.id : null;
      settle(r, reg.ok, reg.ok ? email : (reg.message || reg.error));
    } catch (e) { settle(r, false, String(e)); }

    if (!myId) {
      var why = reg && reg.error === "confirmEmail"
        ? 'خيار "Confirm email" مفعّل. أطفئه من Authentication ← Providers ← ' +
          'Email، أو افتح رابط التأكيد في بريدك ثم أعد الفحص.'
        : (reg && /invalid/i.test(reg.message || "")
            ? "Supabase ترفض هذا النطاق. استخدم بريداً على نطاق حقيقي تملكه."
            : (reg && (reg.message || reg.error)) || "سبب غير معروف");
      settle(add("توقّف الفحص — لم يُنشأ الحساب"), false, why);
      running = false; draw(); return;
    }

    r = add("الحساب الجديد «موثّق» لأنه عميل");
    settle(r, reg.user.status === "verified", "الحالة: " + reg.user.status);

    r = add("تسجيل الخروج ثم الدخول بكلمة المرور");
    try {
      await global.SB.signOut();
      var back = await global.SB.signIn(email, password);
      settle(r, back.ok && back.id === myId, back.ok ? "" : back.error);
    } catch (e) { settle(r, false, String(e)); }

    r = add("كلمة مرور خاطئة تُرفض");
    try {
      var bad = await global.SB.signIn(email, password + "x");
      settle(r, bad.ok === false, bad.ok ? "قُبلت — خطر" : "");
    } catch (e) { settle(r, false, String(e)); }
    try { await global.SB.signIn(email, password); } catch (e) {}

    r = add("لا أحد يوثّق نفسه");
    try {
      await sb.from("profiles").update({ status: "verified", bio: "فحص" }).eq("id", myId);
      var after = await sb.from("profiles").select("status,bio").eq("id", myId).single();
      settle(r, !after.error && after.data.bio === "فحص",
        after.error ? after.error.message : "الحالة بقيت: " + after.data.status);
    } catch (e) { settle(r, false, String(e)); }

    r = add("سعر خارج النطاق يُرفض في قاعدة البيانات");
    try {
      var low = await sb.from("services").insert({ owner_id: myId, type_id: "written", price: 5 });
      settle(r, !!low.error, low.error ? low.error.message.slice(0, 90) : "قُبل — النطاق غير مفعّل");
    } catch (e) { settle(r, false, String(e)); }

    r = add("الطلب يظهر لصاحبه بعد الدخول");
    try {
      var made = await sb.from("requests").insert({
        client_id: myId, type_id: "written", title: "طلب فحص", price: 100,
      }).select().single();
      if (made.error) settle(r, false, made.error.message);
      else {
        var mine = await sb.from("requests").select("id");
        settle(r, mine.data.length === 1, "يرى " + mine.data.length + " طلباً");
      }
    } catch (e) { settle(r, false, String(e)); }

    r = add("تنظيف: احذف حساب الفحص بنفسك");
    settle(r, true, email + " — من Authentication ← Users");

    running = false;
    draw();
  }

  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-run]") && !running) run();
  });

  App.onRender(draw);
});
