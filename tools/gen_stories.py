# -*- coding: utf-8 -*-
"""Emit the product specification from tools/story_data.py.

Every document under user-stories/ is generated. Nothing there is edited by
hand: the matrices are derived from the same dicts the stories are rendered
from, so a permission or a dependency cannot say one thing in a story and
another in a table.

    python3 tools/gen_stories.py
"""

import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from story_data import STORIES, ROLES                       # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "user-stories")
MAT = os.path.join(OUT, "matrices")

PROJECT = u"سند — منصة الخدمات القانونية"
VERSION = u"1.0"

ROLE_AR = {
    "Guest": u"زائر", "Client": u"عميل", "Lawyer": u"محامٍ",
    "Trainee": u"متدرب", "Staff": u"موظف المنصة",
}

EPIC_AR = {
    "Identity": u"الهوية والحساب",
    "Trust": u"الثقة والاعتماد",
    "Discovery": u"الاكتشاف والبحث",
    "Marketplace": u"السوق والتسعير",
    "Delivery": u"التنفيذ والتسليم",
    "Knowledge": u"المعرفة والمحتوى",
    "Platform": u"أساس المنصة",
}


def w(path, text):
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    io.open(path, "w", encoding="utf-8").write(text.rstrip() + u"\n")


def table(headers, rows):
    out = [u"| " + u" | ".join(headers) + u" |",
           u"|" + u"|".join([u" --- "] * len(headers)) + u"|"]
    for r in rows:
        cells = [unicode_(c).replace(u"|", u"\\|").replace(u"\n", u" ") for c in r]
        out.append(u"| " + u" | ".join(cells) + u" |")
    return u"\n".join(out)


def unicode_(v):
    return v if isinstance(v, type(u"")) else str(v)


def bullets(items):
    return u"\n".join([u"- " + i for i in items]) if items else u"- لا ينطبق"


def numbered(items, prefix):
    return u"\n".join([u"%s-%02d. %s" % (prefix, i + 1, t)
                       for i, t in enumerate(items)])


def by_id(sid):
    for s in STORIES:
        if s["id"] == sid:
            return s
    return None


def short(sid):
    s = by_id(sid)
    return u"%s (%s)" % (sid, s["title"]) if s else sid


# ---------------------------------------------------------------------------
# subtasks — derived, never hand-kept
# ---------------------------------------------------------------------------

def subtasks(s):
    n = s["id"].split("-")[1]

    ux = [u"تصميم شاشة: %s" % x for x in s["screens"]]
    ux += [u"تصميم حالة %s: %s" % (k, s["ux_states"][k])
           for k in ("Empty", "Loading", "Error", "Success") if k in s["ux_states"]]
    ux += s.get("ux_extra", [])
    ux += [u"مراجعة الاتجاهين RTL/LTR ومطابقة النصوص العربية والإنجليزية",
           u"مراجعة الوصولية: تباين، تركيز ظاهر، تسميات للقارئ الشاشي"]

    fe = [u"بناء شاشة: %s" % x for x in s["screens"]]
    fe += [u"تنفيذ متطلب: %s" % f for f in s["frs"]]
    fe += [u"تحقق واجهة من «%s»: %s" % (f, r)
           for (f, r, layer) in s["validation"] if u"عميل" in layer]
    fe += [u"ربط الشاشة بـ %s %s" % (m, p) for (m, p, _d) in s["api"]]
    fe += [u"إضافة مفاتيح الترجمة للنصوص الجديدة في العربية والإنجليزية"]

    be = [u"تنفيذ %s %s — %s" % (m, p, d) for (m, p, d) in s["api"]]
    be += [u"فرض قاعدة %s: %s" % (b[0], b[1]) for b in s["brs"]]
    be += [u"تحقق خادم من «%s»: %s" % (f, r)
           for (f, r, layer) in s["validation"] if u"خادم" in layer]
    be += [u"تسجيل تدقيق: %s" % a for a in s["audit"]
           if u"لا تدقيق" not in a]
    if not s["api"]:
        be = be or [u"لا عمل خلفي — الحالة كلها على الجهاز"]

    sec = list(s["sec"])
    sec += [u"سياسة وصول على مستوى الصف تطابق: %s" % (
        u"، ".join([u"%s: %s" % (ROLE_AR[r], s["perms"][r]) for r in ROLES
                    if r in s["perms"]]))]
    sec += [u"اختبار اختراق للصلاحية: محاولة العملية من دور لا يملكها"]

    qa = [u"اختبار قبول: %s" % a for a in s["ac"]]
    qa += s.get("qa_extra", [])
    qa += [u"اختبار الشاشة في أربع تركيبات: عربي/إنجليزي × فاتح/داكن",
           u"اختبار على مقاسات: جوال، لوحي، مكتبي"]

    return [
        (u"UX", u"UX-%s" % n, ux),
        (u"FE", u"FE-%s" % n, fe),
        (u"BE", u"BE-%s" % n, be),
        (u"SEC", u"SEC-%s" % n, sec),
        (u"QA", u"QA-%s" % n, qa),
    ]


# ---------------------------------------------------------------------------
# one story document
# ---------------------------------------------------------------------------

def render_story(s):
    p = []
    a = p.append
    status = s.get("status", u"جاهزة للتنفيذ — النموذج العامل موجود")

    a(u"# %s — %s" % (s["id"], s["title"]))
    a(u"")
    a(u"> المشروع: %s · النسخة: %s · الملحمة: %s · الحالة: %s"
      % (PROJECT, VERSION, EPIC_AR.get(s["epic"], s["epic"]), status))
    a(u"")

    a(u"## 1. معرّف القصة والعنوان")
    a(u"")
    a(table([u"الحقل", u"القيمة"], [
        [u"المعرّف", s["id"]],
        [u"العنوان", s["title"]],
        [u"الملحمة", EPIC_AR.get(s["epic"], s["epic"])],
        [u"الأدوار الرئيسة", u"، ".join([ROLE_AR[r] for r in s["roles"]])],
        [u"الشاشات", u"، ".join(s["pages"])],
        [u"الحالة", status],
    ]))
    a(u"")

    a(u"## 2. قصة المستخدم")
    a(u"")
    a(s["story"])
    a(u"")

    a(u"## 3. الهدف من ناحية العمل")
    a(u"")
    a(s["goal"])
    a(u"")

    a(u"## 4. النطاق")
    a(u"")
    a(u"### داخل النطاق")
    a(u"")
    a(bullets(s["inscope"]))
    a(u"")
    a(u"### خارج النطاق")
    a(u"")
    a(bullets(s["outscope"]))
    a(u"")

    a(u"## 5. المتطلبات الوظيفية")
    a(u"")
    a(numbered(s["frs"], u"FR-%s" % s["id"].split("-")[1]))
    a(u"")

    a(u"## 6. قواعد العمل")
    a(u"")
    a(table([u"المعرّف", u"القاعدة", u"متى تُطبَّق", u"السلوك المتوقّع"],
            [[b[0], b[1], b[2], b[3]] for b in s["brs"]]))
    a(u"")

    a(u"## 7. قواعد العمليات")
    a(u"")
    a(u"### الإنشاء")
    a(u"")
    a(bullets(s["create"]))
    a(u"")
    a(u"### التعديل")
    a(u"")
    a(bullets(s["update"]))
    a(u"")
    a(u"### الحذف والموانع")
    a(u"")
    a(bullets(s["delete"]))
    a(u"")

    a(u"## 8. قواعد التحقق")
    a(u"")
    a(table([u"الحقل", u"القاعدة", u"طبقة التطبيق"],
            [[v[0], v[1], v[2]] for v in s["validation"]]))
    a(u"")

    a(u"## 9. الصلاحيات والتحكم بالوصول")
    a(u"")
    a(table([u"الدور", u"الصلاحية"],
            [[ROLE_AR[r], s["perms"].get(r, u"لا شيء")] for r in ROLES]))
    a(u"")

    a(u"## 10. متطلبات التدقيق")
    a(u"")
    a(bullets(s["audit"]))
    a(u"")

    a(u"## 11. معايير القبول")
    a(u"")
    n = s["id"].split("-")[1]
    a(u"\n".join([u"**AC-%s-%02d** — %s" % (n, i + 1, t)
                  for i, t in enumerate(s["ac"])]))
    a(u"")

    a(u"## 12. الاعتماديات")
    a(u"")
    if s["deps"]:
        a(bullets([short(d) for d in s["deps"]]))
    else:
        a(u"- لا اعتماديات — قصة أساس")
    dependents = [x["id"] for x in STORIES if s["id"] in x["deps"]]
    a(u"")
    a(u"**تعتمد عليها:** " +
      (u"، ".join([short(d) for d in dependents]) if dependents else u"لا شيء"))
    a(u"")

    a(u"## 13. مواصفة تجربة المستخدم والواجهة")
    a(u"")
    a(u"### الشاشات")
    a(u"")
    a(bullets(s["screens"]))
    a(u"")
    a(u"### حالات الشاشة")
    a(u"")
    a(table([u"الحالة", u"السلوك"],
            [[k, s["ux_states"].get(k, u"—")]
             for k in (u"Empty", u"Loading", u"Error", u"Success")]))
    a(u"")
    a(u"### ملاحظات التصميم")
    a(u"")
    a(bullets(s.get("ux_extra", [])))
    a(u"")
    a(u"### الاستجابة والاتجاه والوصولية")
    a(u"")
    a(u"- الشاشة تعمل على الجوال واللوحي والمكتبي بالتخطيط نفسه لا بنسخة مصغّرة")
    a(u"- الاتجاه ينعكس تلقائياً بين العربية والإنجليزية عبر الخصائص المنطقية")
    a(u"- كل نص ظاهر له مفتاح ترجمة في اللغتين")
    a(u"- التنقّل بلوحة المفاتيح ممكن، والتركيز ظاهر، والتباين يفي بالمستوى AA")
    a(u"")

    a(u"## 14. المهام الفرعية")
    a(u"")
    for label, prefix, items in subtasks(s):
        a(u"### %s" % label)
        a(u"")
        a(u"\n".join([u"- **%s-%02d** %s" % (prefix, i + 1, t)
                      for i, t in enumerate(items)]))
        a(u"")

    a(u"## 15. جاهزية البدء والإنجاز")
    a(u"")
    a(u"### تعريف الجاهزية (DoR)")
    a(u"")
    a(bullets([
        u"القصة والهدف والنطاق مكتوبة ومراجَعة",
        u"قواعد العمل والتحقق محدَّدة ولا تحتمل تأويلين",
        u"الصلاحيات لكل دور مذكورة ومتّسقة مع مصفوفة الصلاحيات",
        u"الاعتماديات %s منجزة أو مخطَّطة قبلها" % (
            u"، ".join(s["deps"]) if s["deps"] else u"(لا يوجد)"),
        u"معايير القبول قابلة للاختبار بصيغة Given/When/Then",
        u"الشاشات وحالاتها الأربع متّفق عليها",
    ]))
    a(u"")
    a(u"### تعريف الإنجاز (DoD)")
    a(u"")
    a(bullets([
        u"كل معايير القبول تمرّ",
        u"قواعد العمل مفروضة في الخادم لا في الواجهة فقط",
        u"التحقق مطبَّق في الطبقتين حيث نصّت الجدول",
        u"سياسات الوصول على مستوى الصف مكتوبة ومختبَرة",
        u"قيود التدقيق تُكتب فعلاً عند العمليات المذكورة",
        u"النصوص مترجمة في اللغتين والشاشة صحيحة في الاتجاهين والسمتين",
        u"اختبارات آلية تغطّي معايير القبول ومحاولات تجاوز الصلاحية",
    ]))
    return u"\n".join(p)


# ---------------------------------------------------------------------------
# foundation documents
# ---------------------------------------------------------------------------

def doc_overview():
    epics = []
    for e in [x["epic"] for x in STORIES]:
        if e not in epics:
            epics.append(e)
    rows = [[EPIC_AR.get(e, e),
             unicode_(len([s for s in STORIES if s["epic"] == e])),
             u"، ".join([s["id"] for s in STORIES if s["epic"] == e])]
            for e in epics]
    gaps = [s for s in STORIES if "status" in s]
    return u"""# 00 — نظرة عامة على المنتج

> المشروع: %s · النسخة: %s

## المشكلة

طلب الخدمة القانونية في السعودية يمرّ اليوم بوسيط بشري: توصية من معارف، أو
مكتب يُسأل عن سعره بالهاتف. العميل لا يعرف السعر قبل أن يسأل، ولا يعرف كفاءة
المحامي قبل أن يجرّب. والمحامي المبتدئ لا يجد أول عميل، والمتدرب لا يجد
ساعات تدريب موثّقة تُحتسب له.

## ما تقدّمه المنصة

سوق للخدمة القانونية بثلاثة مسارات لا مسار واحد:

1. **خدمة مسعّرة** — المحامي يسجّل خدماته وأسعارها ضمن نطاق تحدّده المنصة،
   والعميل يشتري كما يشتري منتجاً معلوم الثمن.
2. **مزايدة عكسية** — العميل ينشر استشارته ويترك المحامين يتنافسون عليها
   بعروضهم، فيصل السعر إلى قيمته الحقيقية.
3. **تنفيذ بالوكالة** — المحامي يوجّه أجزاء من العمل إلى متدربين، إمّا
   بتكليف متدرب بعينه أو بطرح المهمة للجميع، ويحصل المتدرب على حصة لا تقلّ
   عن ٣٠%% ويُحتسب له وقته نحو شهادة يوقّعها من أشرف عليه.

## المبادئ التي تحكم كل قصة

- **المشتقّ لا يُخزَّن.** الترتيب والتقييم والساعات والمستحقّات تُحسب وقت
  العرض من مصادرها، فلا يوجد رقم محفوظ يخالف واقعه.
- **الصلاحية في قاعدة البيانات.** إخفاء الزر ليس حماية؛ كل قاعدة وصول
  مفروضة على مستوى الصف.
- **الترتيب للمحامين، والتقييم للناس.** الترتيب حافز مهني داخلي، والتقييم
  معلومة يستحقّها كل من يبحث عن محامٍ.
- **العربية هي الأصل.** الاتجاه من اليمين لليسار افتراض لا استثناء، وكل نص
  ظاهر له مقابله في اللغتين.

## الأدوار

%s

## الملاحم

%s

## الفجوات المعلومة

%s

هذه ليست قصصاً منسيّة بل مسجَّلة بوعي: المنصة تسعّر وتتّفق وتحاسب وتوثّق، لكنها
لا تنقل مالاً ولا ترسل تنبيهاً بعد. لا إطلاق تجاري قبل إغلاقهما.
""" % (
        PROJECT, VERSION,
        table([u"الدور", u"من هو", u"ما يفعله"], [
            [ROLE_AR["Guest"], u"زائر غير مسجّل",
             u"يقرأ المحتوى ويتصفّح المحامين ولا يتفاعل"],
            [ROLE_AR["Client"], u"طالب الخدمة",
             u"يشتري خدمة أو ينشر استشارة، يتابع طلبه، يقيّم"],
            [ROLE_AR["Lawyer"], u"محامٍ مرخّص موثَّق",
             u"يسجّل خدماته، يقدّم عروضاً، ينفّذ، يوجّه للمتدربين، يوقّع الشهادات والمقالات"],
            [ROLE_AR["Trainee"], u"متدرب قانوني",
             u"يستقبل المهام أو ينافس عليها، يسلّم، يجمع ساعات نحو شهادة"],
            [ROLE_AR["Staff"], u"موظف المنصة",
             u"يعتمد الرخص، يضبط نطاقات الأسعار، يعالج النزاعات والمحتوى المسيء"],
        ]),
        table([u"الملحمة", u"عدد القصص", u"القصص"], rows),
        bullets([u"**%s — %s**: %s" % (g["id"], g["title"], g["status"])
                 for g in gaps]) if gaps else u"- لا فجوات",
    )


def doc_roles():
    return u"""# 01 — الأدوار والصلاحيات

> المشروع: %s · النسخة: %s

## نموذج الأدوار

الحساب واحد والأدوار متعدّدة. المستخدم قد يكون عميلاً ومحامياً في الوقت نفسه،
فيحمل حسابه قائمة أدوار ودوراً نشطاً واحداً ينظر من خلاله. تبديل الدور يبدّل
الواجهة والصلاحيات معاً، ولا يمنح دوراً لم يُعتمد.

## حالة الحساب

%s

## قواعد ثابتة عبر كل القصص

- إضافة دور محامٍ أو متدرب إلى حساب قائم تُعيد حالته إلى «قيد المراجعة»
  تلقائياً، ولا يستطيع المستخدم رفع حالته بنفسه إلى «موثَّق».
- الدور النشط لا يتجاوز الأدوار المملوكة.
- الاعتماد فعل موظف لا فعل صاحب الحساب.
- الزائر يقرأ ولا يكتب في أي مورد.
- كل قاعدة هنا مفروضة في قاعدة البيانات، ومكرَّرة في الواجهة للراحة لا للحماية.

## مصفوفة الأدوار المختصرة

انظر التفصيل الكامل في `matrices/permission-matrix.dm`.
""" % (
        PROJECT, VERSION,
        table([u"الحالة", u"المعنى", u"ما يُسمح به"], [
            [u"قيد المراجعة", u"سجّل كمحامٍ أو متدرب ولم تُعتمد وثائقه",
             u"الدخول وتعديل ملفه فقط؛ لا يظهر في نتائج البحث ولا يقدّم عروضاً"],
            [u"موثَّق", u"اعتمده موظف المنصة",
             u"كل صلاحيات دوره"],
            [u"موقوف", u"أوقفه موظف",
             u"الدخول فقط، بلا نشاط"],
        ]),
    )


def doc_architecture():
    return u"""# 02 — معمارية النظام

> المشروع: %s · النسخة: %s

## الوضع القائم

المنصة اليوم موقع متعدّد الصفحات مكتوب بـ HTML و CSS و JavaScript خالصة، بلا
خطوة بناء وبلا إطار عمل، منشور على استضافة ثابتة. هذا اختيار وليس نقصاً: لا
شيء بين المتصفّح والشيفرة، ووقت التحميل قريب من الحدّ الأدنى، والصيانة لا
تحتاج سلسلة أدوات.

## الطبقات

%s

## قرارات معمارية

- **مفتاح خلفية واحد.** `config.backend` يقرّر: `browser` يعمل على تخزين
  المتصفّح للعرض، و`supabase` يعمل على قاعدة بيانات حقيقية. الشيفرة نفسها في
  الحالتين، والفرق في مُنفِّذ واحد خلف واجهة موحّدة.
- **ذاكرة مُرطَّبة أمام واجهة غير متزامنة.** الصفحات تقرأ الحالة قراءة
  متزامنة، والطبقة الخلفية تجلب مرة واحدة وتكتب فوراً، فلا تُعاد كتابة كل
  صفحة لأجل تبديل الخلفية.
- **الاشتقاق لا التخزين.** الترتيب والتقييم والساعات والمستحقّات لا تُخزَّن.
- **الأمن على مستوى الصف.** كل جدول محكوم بسياسات وصول، ودوال المشغّلات
  الحسّاسة تعمل بمسار بحث مثبّت.
- **الإشارات قابلة للتبديل.** قناة المكالمة إمّا داخل المتصفّح للتجربة أو
  عبر القناة الحيّة في الإنتاج، والشيفرة لا تفرّق.
- **الوسائط بين الطرفين مباشرة.** محتوى المكالمة لا يمرّ بخادم ولا يُسجَّل.

## الخطوات نحو الإنتاج

%s
""" % (
        PROJECT, VERSION,
        table([u"الطبقة", u"ما هي", u"مسؤوليتها"], [
            [u"العرض", u"صفحات HTML ووحدات صفحات مسجَّلة",
             u"الرسم والتفاعل وحده"],
            [u"الأساس", u"i18n، السمة، الجلسة، المخزن، التطبيق",
             u"اللغة والاتجاه والسمة والجلسة والتوجيه"],
            [u"النموذج", u"دوال اشتقاق خالصة",
             u"الترتيب والتقييم والساعات والمستحقّات وقت العرض"],
            [u"المخزن", u"واجهة واحدة، مُنفِّذان",
             u"تخزين المتصفّح للعرض، وقاعدة البيانات للإنتاج"],
            [u"الخلفية", u"قاعدة بيانات علائقية بمصادقة وسياسات صفّية",
             u"الحقيقة الوحيدة والصلاحيات"],
            [u"الاتصال الحي", u"اتصال ندّي بين المتصفّحين وقناة إشارات",
             u"الصوت والصورة بين طرفي الطلب"],
        ]),
        bullets([
            u"إغلاق فجوة الدفع (US-020) — لا تسليم تجاري بدونها",
            u"إغلاق فجوة التنبيهات (US-021)",
            u"خادم عبور للشبكات المغلقة حتى تكتمل المكالمات خلف الجدران",
            u"إزالة أدوات التحقق التطويرية من النسخة المنشورة",
            u"شروط الاستخدام وسياسة الخصوصية",
            u"تطبيق جوال يعيد استخدام الطبقة نفسها",
        ]),
    )


def doc_story_map():
    lines = [u"# 03 — خارطة القصص", u"",
             u"> المشروع: %s · النسخة: %s" % (PROJECT, VERSION), u"",
             u"القصص مرتّبة على رحلة المستخدم لا على ترتيب التنفيذ.", u""]
    epics = []
    for e in [x["epic"] for x in STORIES]:
        if e not in epics:
            epics.append(e)
    for e in epics:
        lines.append(u"## %s" % EPIC_AR.get(e, e))
        lines.append(u"")
        lines.append(table(
            [u"القصة", u"العنوان", u"الأدوار", u"تعتمد على"],
            [[s["id"], s["title"],
              u"، ".join([ROLE_AR[r] for r in s["roles"]]),
              u"، ".join(s["deps"]) or u"—"]
             for s in STORIES if s["epic"] == e]))
        lines.append(u"")
    lines.append(u"## رحلة العميل")
    lines.append(u"")
    lines.append(u"US-019 يصل → US-014 يقرأ → US-001 يسجّل → US-004 يبحث → "
                 u"US-006 يشتري خدمة **أو** US-007 ينشر استشارة → "
                 u"US-008 يتابع → US-016 يتكلّم → US-020 يدفع → US-013 يقيّم")
    lines.append(u"")
    lines.append(u"## رحلة المحامي")
    lines.append(u"")
    lines.append(u"US-001 يسجّل → US-003 تُعتمد رخصته → US-005 يسجّل خدماته → "
                 u"US-007 يزايد → US-008 ينفّذ → US-009 يصوغ → "
                 u"US-010 يوجّه للمتدربين → US-011 يتّفق على الحصة → "
                 u"US-012 يوقّع الشهادة → US-017 يرى ترتيبه")
    lines.append(u"")
    lines.append(u"## رحلة المتدرب")
    lines.append(u"")
    lines.append(u"US-001 يسجّل → US-003 يُعتمد → US-010 يستقبل مهمة أو ينافس → "
                 u"US-008 يسلّم → US-011 يستحقّ حصته → US-012 يجمع ساعاته وشهادته "
                 u"→ US-015 يكتب مقالاً يوقّعه محامٍ")
    return u"\n".join(lines)


# ---------------------------------------------------------------------------
# matrices — all derived
# ---------------------------------------------------------------------------

def m_permission():
    rows = [[s["id"], s["title"]] + [s["perms"].get(r, u"لا شيء") for r in ROLES]
            for s in STORIES]
    return u"""# مصفوفة الصلاحيات

> مشتقّة من `tools/story_data.py` — لا تُحرَّر يدوياً.

%s

## قاعدة عامة

كل خلية في هذا الجدول يقابلها فرض في قاعدة البيانات. إخفاء العنصر في الواجهة
راحة للمستخدم، والحماية هي السياسة الصفّية وحدها.
""" % table([u"القصة", u"العنوان"] + [ROLE_AR[r] for r in ROLES], rows)


def m_dependency():
    rows = []
    for s in STORIES:
        dependents = [x["id"] for x in STORIES if s["id"] in x["deps"]]
        rows.append([s["id"], s["title"],
                     u"، ".join(s["deps"]) or u"—",
                     u"، ".join(dependents) or u"—",
                     unicode_(len(dependents))])
    roots = [s["id"] for s in STORIES if not s["deps"]]
    leaves = [s["id"] for s in STORIES
              if not [x for x in STORIES if s["id"] in x["deps"]]]
    return u"""# مصفوفة الاعتماديات

> مشتقّة من `tools/story_data.py` — لا تُحرَّر يدوياً.

%s

## قصص الأساس (بلا اعتماديات)

%s

## قصص طرفية (لا شيء يعتمد عليها)

%s

## فحص الدوران

لا توجد اعتمادية دائرية: %s
""" % (
        table([u"القصة", u"العنوان", u"تعتمد على", u"يعتمد عليها", u"عدد التابعين"], rows),
        bullets(roots), bullets(leaves), cycle_check(),
    )


def cycle_check():
    seen, stack = set(), set()
    found = []

    def visit(sid, path):
        if sid in stack:
            found.append(u" → ".join(path + [sid]))
            return
        if sid in seen:
            return
        stack.add(sid)
        s = by_id(sid)
        for d in (s["deps"] if s else []):
            visit(d, path + [sid])
        stack.discard(sid)
        seen.add(sid)

    for s in STORIES:
        visit(s["id"], [])
    return u"تم الفحص على %d قصة" % len(STORIES) if not found \
        else u"**دوران مكتشف:** " + u"؛ ".join(found)


def m_api():
    rows = []
    for s in STORIES:
        for (m, p, d) in s["api"]:
            rows.append([m, p, d, s["id"],
                         u"، ".join([ROLE_AR[r] for r in ROLES
                                     if s["perms"].get(r, u"لا شيء") != u"لا شيء"]) or u"—"])
    rows.sort(key=lambda r: (r[1], r[0]))
    return u"""# مصفوفة الواجهات البرمجية

> مشتقّة من `tools/story_data.py` — لا تُحرَّر يدوياً.

هذه الواجهات هي العقد المطلوب، لا وصف لما هو منفَّذ اليوم: النموذج العامل
يعمل على مخزن المتصفّح أو على قاعدة البيانات مباشرة بسياساتها.

عدد المسارات: %d

%s

عمود «أدوار القصة» يذكر من له نشاط في القصة عموماً؛ الصلاحية الدقيقة لكل
مسار هي المذكورة في القسم ٩ من ملف القصة نفسها — مسار إداري في قصة يشارك
فيها المحامي لا يعني أن المحامي يبلغه.

## قواعد عامة

- كل مسار يتحقّق من الهوية أولاً ثم من الصلاحية على الصف المعنيّ.
- الأخطاء تُعاد بصيغة موحّدة تحمل رمزاً ورسالة قابلة للترجمة.
- لا يُعاد في الاستجابة حقل لا يملك الطالب حقّ رؤيته.
""" % (len(rows), table([u"الطريقة", u"المسار", u"الوصف", u"القصة", u"أدوار القصة"], rows))


def m_coverage():
    rows = []
    for s in STORIES:
        st = subtasks(s)
        rows.append([
            s["id"], s["title"],
            unicode_(len(s["frs"])), unicode_(len(s["brs"])),
            unicode_(len(s["validation"])), unicode_(len(s["ac"])),
            unicode_(len(s["api"])),
            u"، ".join([u"%s:%d" % (lbl, len(items)) for (lbl, _p, items) in st]),
        ])
    tot = lambda k: sum(len(s[k]) for s in STORIES)
    return u"""# مصفوفة تغطية المزايا

> مشتقّة من `tools/story_data.py` — لا تُحرَّر يدوياً.

%s

## الإجمالي

%s
""" % (
        table([u"القصة", u"العنوان", u"متطلبات", u"قواعد عمل", u"تحقّق",
               u"معايير قبول", u"واجهات", u"مهام فرعية"], rows),
        table([u"البند", u"العدد"], [
            [u"القصص", unicode_(len(STORIES))],
            [u"المتطلبات الوظيفية", unicode_(tot("frs"))],
            [u"قواعد العمل", unicode_(tot("brs"))],
            [u"قواعد التحقق", unicode_(tot("validation"))],
            [u"معايير القبول", unicode_(tot("ac"))],
            [u"مسارات الواجهات", unicode_(tot("api"))],
            [u"المهام الفرعية",
             unicode_(sum(len(i) for s in STORIES for (_l, _p, i) in subtasks(s)))],
        ]),
    )


def m_traceability():
    rows = []
    for s in STORIES:
        n = s["id"].split("-")[1]
        st = dict([(lbl, (pre, items)) for (lbl, pre, items) in subtasks(s)])
        rows.append([
            s["id"],
            u"FR-%s-01..%02d" % (n, len(s["frs"])),
            u"، ".join([b[0] for b in s["brs"]]) or u"—",
            u"AC-%s-01..%02d" % (n, len(s["ac"])),
            u"%s-01..%02d" % (st[u"UX"][0], len(st[u"UX"][1])),
            u"%s-01..%02d" % (st[u"FE"][0], len(st[u"FE"][1])),
            u"%s-01..%02d" % (st[u"BE"][0], len(st[u"BE"][1])),
            u"%s-01..%02d" % (st[u"SEC"][0], len(st[u"SEC"][1])),
            u"%s-01..%02d" % (st[u"QA"][0], len(st[u"QA"][1])),
        ])
    return u"""# مصفوفة التتبّع

> مشتقّة من `tools/story_data.py` — لا تُحرَّر يدوياً.

كل متطلب يقود إلى قاعدة عمل، وكل قاعدة إلى معيار قبول، وكل معيار إلى مهمة
فرعية واختبار. لا متطلب بلا اختبار، ولا اختبار بلا متطلب.

%s

## قاعدة الإغلاق

القصة لا تُغلق حتى يكون لكل معيار قبول اختبار آلي يمرّ، ولكل قاعدة عمل فرض
في الخادم، ولكل صلاحية محاولة تجاوز مختبَرة ومرفوضة.
""" % table([u"القصة", u"المتطلبات", u"قواعد العمل", u"معايير القبول",
             u"UX", u"FE", u"BE", u"SEC", u"QA"], rows)


def doc_open_questions():
    return u"""# 04 — الافتراضات والأسئلة المفتوحة

> المشروع: %s · النسخة: %s

## افتراضات اتُّخذت لإكمال المواصفة

%s

## أسئلة مفتوحة تحتاج قراراً

%s

## مخاطر

%s
""" % (
        PROJECT, VERSION,
        bullets([
            u"عملة واحدة: الريال السعودي، وكل مبلغ في المواصفة به.",
            u"لغتان فقط: العربية أصلاً والإنجليزية ثانية.",
            u"حصة المتدرب أرضية عند ٣٠٪ تُرفع ولا تُخفض، وهذا فرض لا اتفاق.",
            u"عتبة شهادة التدريب أربعون ساعة.",
            u"التقييم لا يُعدَّل بعد نشره في هذه المرحلة.",
            u"التعليق على المقال لا يُعدَّل بعد نشره.",
            u"المكالمة بين طرفين فقط ولا تُسجَّل.",
            u"اعتماد الرخصة عمل بشري من موظف المنصة لا تحقّق آلي من جهة خارجية.",
        ]),
        bullets([
            u"**بوّابة الدفع**: أيّها تُعتمد، وما نسبة عمولة المنصة، ومن يتحمّل رسوم البوّابة؟",
            u"**الضريبة**: هل تُحتسب ضريبة القيمة المضافة على قيمة الخدمة أم على العمولة؟",
            u"**التحقق من الرخصة**: هل يوجد مصدر رسمي يمكن الربط به بدل المراجعة اليدوية؟",
            u"**النزاعات**: ما مسار الاعتراض إذا رفض العميل التسليم؟ ومن يقرّر؟",
            u"**نطاقات الأسعار**: من يحدّدها ابتداءً، وكيف تُراجَع؟",
            u"**حفظ البيانات**: كم تبقى الطلبات والمستندات بعد الاكتمال؟",
            u"**شروط الاستخدام والخصوصية**: نصّان قانونيان مطلوبان قبل أي مستخدم حقيقي.",
        ]),
        bullets([
            u"المكالمات خلف الشبكات المغلقة لن تكتمل بلا خادم عبور — يجب توفيره قبل الاعتماد عليها.",
            u"غياب الدفع يجعل كل اتفاق مالي في المنصة وعداً غير منفَّذ.",
            u"غياب التنبيهات يجعل المزايدات والتسليمات تفوت أصحابها.",
            u"أدوات التحقق التطويرية المنشورة تنشئ حسابات وتكتب صفوفاً — تُزال قبل الإطلاق.",
        ]),
    )


def doc_order():
    waves = [
        (u"الموجة ١ — الأساس", [u"US-018", u"US-001", u"US-002", u"US-003"],
         u"بلا هوية موثوقة وهيكل يعمل باللغتين لا معنى لأي قصة بعدها."),
        (u"الموجة ٢ — السوق", [u"US-004", u"US-005", u"US-006", u"US-007"],
         u"الاكتشاف والتسعير والمساران: شراء خدمة أو نشر استشارة."),
        (u"الموجة ٣ — التنفيذ", [u"US-008", u"US-009", u"US-010", u"US-011"],
         u"دورة حياة الطلب والتوجيه للمتدربين وحصصهم."),
        (u"الموجة ٤ — الثقة", [u"US-013", u"US-012", u"US-017"],
         u"التقييم أولاً لأن الترتيب مبنيّ عليه، ثم الشهادة ثم الترتيب."),
        (u"الموجة ٥ — المحتوى والاتصال", [u"US-014", u"US-015", u"US-016", u"US-019"],
         u"المحتوى يجذب، والمكالمة تُكمل الاستشارة."),
        (u"الموجة ٦ — ما قبل الإطلاق التجاري", [u"US-020", u"US-021"],
         u"الفجوتان المعلومتان: لا إطلاق تجاري قبل إغلاقهما."),
    ]
    rows = []
    for name, ids, why in waves:
        rows.append([name, u"، ".join(ids), why])
    return u"""# 05 — ترتيب التنفيذ

> المشروع: %s · النسخة: %s

الترتيب محكوم بمصفوفة الاعتماديات لا بالرغبة: لا تبدأ قصة قبل أن تنجز ما
تعتمد عليه.

%s

## قاعدة

قبل بدء أي موجة، تُراجَع جاهزية قصصها (DoR)؛ وقبل إغلاقها، تُراجَع مصفوفة
التتبّع للتأكّد أن كل معيار قبول له اختبار يمرّ.
""" % (PROJECT, VERSION, table([u"الموجة", u"القصص", u"لماذا هنا"], rows))


def doc_index():
    rows = [[s["id"], s["title"], EPIC_AR.get(s["epic"], s["epic"]),
             u"`%s-%s.dm`" % (s["id"], s["slug"])] for s in STORIES]
    return u"""# مواصفة المنتج — الفهرس

> المشروع: %s · النسخة: %s

كل ما في هذا المجلّد مولَّد من `tools/story_data.py` عبر
`python3 tools/gen_stories.py`. لا يُحرَّر ملف هنا يدوياً — يُحرَّر المصدر
ويُعاد التوليد، حتى لا تختلف القصة عن المصفوفة التي تصفها.

## الوثائق الأساسية

- `00-project-overview.dm` — المشكلة والحل والمبادئ والفجوات
- `01-roles-and-permissions.dm` — نموذج الأدوار وحالات الحساب
- `02-system-architecture.dm` — الطبقات والقرارات المعمارية
- `03-story-map.dm` — خارطة القصص ورحلات المستخدمين
- `04-open-questions.dm` — الافتراضات والأسئلة المفتوحة والمخاطر
- `05-implementation-order.dm` — موجات التنفيذ

## المصفوفات

- `matrices/permission-matrix.dm`
- `matrices/dependency-matrix.dm`
- `matrices/api-matrix.dm`
- `matrices/feature-coverage-matrix.dm`
- `matrices/traceability-matrix.dm`

## القصص (%d)

%s
""" % (PROJECT, VERSION, len(STORIES),
       table([u"المعرّف", u"العنوان", u"الملحمة", u"الملف"], rows))


def main():
    written = []

    def emit(path, text):
        w(path, text)
        written.append(os.path.relpath(path, ROOT))

    emit(os.path.join(OUT, "README.dm"), doc_index())
    emit(os.path.join(OUT, "00-project-overview.dm"), doc_overview())
    emit(os.path.join(OUT, "01-roles-and-permissions.dm"), doc_roles())
    emit(os.path.join(OUT, "02-system-architecture.dm"), doc_architecture())
    emit(os.path.join(OUT, "03-story-map.dm"), doc_story_map())
    emit(os.path.join(OUT, "04-open-questions.dm"), doc_open_questions())
    emit(os.path.join(OUT, "05-implementation-order.dm"), doc_order())

    for s in STORIES:
        emit(os.path.join(OUT, "%s-%s.dm" % (s["id"], s["slug"])), render_story(s))

    emit(os.path.join(MAT, "permission-matrix.dm"), m_permission())
    emit(os.path.join(MAT, "dependency-matrix.dm"), m_dependency())
    emit(os.path.join(MAT, "api-matrix.dm"), m_api())
    emit(os.path.join(MAT, "feature-coverage-matrix.dm"), m_coverage())
    emit(os.path.join(MAT, "traceability-matrix.dm"), m_traceability())

    for f in written:
        print(f)
    print("%d files" % len(written))


if __name__ == "__main__":
    main()
