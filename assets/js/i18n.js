/* ==========================================================================
   i18n — Arabic (RTL, default) / English (LTR)
   Loaded synchronously in <head> so the very first paint is already in the
   right language and direction. Dictionaries live inline (not fetched) so the
   site also works when opened straight from disk with file://.
   ========================================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "sanad.lang";
  var DEFAULT_LANG = "ar";

  var DICT = {
    ar: {
      /* --- chrome --- */
      "brand.name": "سند",
      "brand.latin": "SANAD",
      "nav.home": "الرئيسية",
      "nav.lawyers": "دليل المحامين",
      "nav.blog": "المدونة",
      "nav.about": "عن سند",
      "nav.login": "دخول المحامين",
      "nav.cta": "طلب استشارة",
      "nav.dashboardLawyer": "لوحة المحامي",
      "nav.dashboardClient": "لوحة العميل",
      "a11y.menu": "القائمة",
      "a11y.close": "إغلاق",
      "a11y.theme": "تبديل الوضع الليلي",
      "a11y.lang": "تغيير اللغة",
      "a11y.skip": "تخطي إلى المحتوى",
      "theme.toDark": "الوضع الليلي",
      "theme.toLight": "الوضع النهاري",

      /* --- footer --- */
      "footer.about": "منصة سعودية تجمع نخبة من المحامين المرخصين لتقديم استشارات قانونية سريعة وموثوقة وبأسعار واضحة.",
      "footer.platform": "المنصة",
      "footer.legal": "قانوني",
      "footer.contact": "تواصل معنا",
      "footer.privacy": "سياسة الخصوصية",
      "footer.terms": "الشروط والأحكام",
      "footer.license": "الترخيص",
      "footer.help": "مركز المساعدة",
      "footer.faq": "الأسئلة الشائعة",
      "footer.careers": "الوظائف",
      "footer.rights": "© 2024 سند للتقنية القانونية. جميع الحقوق محفوظة.",
      "footer.madeIn": "صُنع في المملكة العربية السعودية",

      /* --- home --- */
      "home.title": "سند | سندك القانوني الموثوق",
      "home.eyebrow": "منصة قانونية معتمدة",
      "home.heroTitle": "سندك القانوني الموثوق.. استشارات وعقود بأبسط طريقة",
      "home.heroLead": "منصة تجمع نخبة من المحامين المعتمدين لتقديم استشارات قانونية سريعة، موثوقة، وبأسعار تنافسية.",
      "home.searchPlaceholder": "كلمة البحث (مثال: طلاق، تأسيس شركة)",
      "home.specialty": "التخصص القانوني",
      "home.city": "المدينة",
      "home.search": "ابحث الآن",
      "home.bookNow": "احجز استشارتك الآن",
      "home.trust1": "أكثر من 140 محامياً مرخصاً",
      "home.trust2": "دفع آمن ومشفّر",
      "home.trust3": "سرية تامة للبيانات",
      "home.whyTitle": "لماذا تختار سند؟",
      "home.whyLead": "نقدم لك تجربة قانونية متكاملة ترتكز على الثقة والكفاءة.",
      "home.stepsTitle": "كيف تعمل المنصة؟",
      "home.stepsLead": "من البحث إلى الاستشارة في أربع خطوات واضحة.",
      "home.featuredTitle": "محامون متميزون",
      "home.featuredLead": "تعرف على نخبة المحامين المتاحين لتقديم الاستشارة.",
      "home.viewAll": "عرض الكل",
      "home.statsTitle": "أرقام تتحدث عنا",
      "home.testimonialsTitle": "ماذا يقول عملاؤنا",
      "home.testimonialsLead": "تجارب حقيقية من أفراد وشركات وثقوا بسند.",
      "home.blogTitle": "أحدث المقالات القانونية",
      "home.blogLead": "تحليلات وإرشادات يكتبها محامون ممارسون.",
      "home.ctaTitle": "هل تحتاج استشارة قانونية اليوم؟",
      "home.ctaLead": "احجز موعدك خلال دقائق واحصل على رأي قانوني موثوق.",
      "home.ctaPrimary": "احجز استشارة",
      "home.ctaSecondary": "انضم كمحامٍ",

      /* --- directory --- */
      "dir.title": "دليل المحامين | سند",
      "dir.heading": "دليل المحامين",
      "dir.lead": "ابحث بين نخبة من المحامين المرخصين واختر الأنسب لقضيتك.",
      "dir.filters": "تصفية النتائج",
      "dir.reset": "إعادة ضبط",
      "dir.specialties": "التخصصات",
      "dir.cities": "المدينة",
      "dir.priceRange": "نطاق السعر (ريال)",
      "dir.from": "من",
      "dir.to": "إلى",
      "dir.consultType": "نوع الاستشارة",
      "dir.rating": "التقييم",
      "dir.anyRating": "كل التقييمات",
      "dir.stars4": "4+ نجوم",
      "dir.stars45": "4.5+ نجوم",
      "dir.found": "تم العثور على {n} محامٍ",
      "dir.sortBy": "ترتيب حسب:",
      "dir.sortRating": "الأعلى تقييماً",
      "dir.sortPriceAsc": "الأقل سعراً",
      "dir.sortPriceDesc": "الأعلى سعراً",
      "dir.sortExperience": "الأكثر خبرة",
      "dir.viewProfile": "عرض الملف",
      "dir.book": "حجز موعد",
      "dir.empty": "لا توجد نتائج مطابقة",
      "dir.emptyHint": "جرّب توسيع نطاق البحث أو إزالة بعض عوامل التصفية.",
      "dir.showFilters": "عوامل التصفية",

      /* --- shared lawyer bits --- */
      "lawyer.license": "رقم الترخيص",
      "lawyer.years": "خبرة {n} سنة",
      "lawyer.reviews": "({n} تقييم)",
      "lawyer.call": "مكالمة",
      "lawyer.chat": "محادثة",
      "lawyer.contract": "صياغة عقود",
      "lawyer.litigation": "ترافع",
      "lawyer.perHalfHour": "ر.س / نصف ساعة",
      "lawyer.perConsult": "ر.س / استشارة",
      "lawyer.startsAt": "تبدأ من {n} ر.س",
      "lawyer.byCase": "حسب القضية",
      "lawyer.unavailable": "غير متاح",
      "lawyer.consultations": "استشارة",
      "lawyer.experience": "الخبرة",
      "lawyer.location": "الموقع",

      /* --- profile --- */
      "profile.title": "الملف الشخصي للمحامي | سند",
      "profile.tabExperience": "الخبرات والمؤهلات",
      "profile.tabServices": "الخدمات والباقات",
      "profile.tabArticles": "المقالات",
      "profile.tabReviews": "التقييمات",
      "profile.bio": "نبذة تعريفية",
      "profile.education": "المؤهلات العلمية",
      "profile.subSpecialties": "التخصصات الدقيقة",
      "profile.career": "الخبرات المهنية",
      "profile.services": "الخدمات المتاحة",
      "profile.reviewsTitle": "آراء العملاء",
      "profile.articlesTitle": "مقالات المحامي",
      "profile.book": "حجز استشارة",
      "profile.bookHint": "اختر الخدمة والوقت المناسبين لك.",
      "profile.consultType": "نوع الاستشارة",
      "profile.date": "تاريخ الاستشارة",
      "profile.availableTimes": "الأوقات المتاحة",
      "profile.total": "إجمالي التكلفة",
      "profile.pay": "متابعة الدفع",
      "profile.securePay": "دفع آمن ومشفّر",
      "profile.pickSlot": "اختر وقتاً متاحاً أولاً",
      "profile.booked": "تم تأكيد الحجز مبدئياً — سنرسل لك التفاصيل.",
      "profile.sar": "ر.س",

      /* --- blog --- */
      "blog.title": "المدونة القانونية | سند",
      "blog.heading": "رؤى قانونية وتحديثات",
      "blog.lead": "ابق على اطلاع بأحدث التطورات في المشهد القانوني، تحليلات الخبراء، وإرشادات عملية لحماية أعمالك وحقوقك.",
      "blog.searchPlaceholder": "ابحث في المقالات، المواضيع، أو القوانين...",
      "blog.search": "بحث",
      "blog.all": "الكل",
      "blog.latest": "أحدث المقالات",
      "blog.readMore": "اقرأ المزيد",
      "blog.readTime": "{n} دقائق قراءة",
      "blog.loadMore": "تحميل المزيد",
      "blog.askExpert": "تحدث مع خبير",
      "blog.askExpertCta": "حجز استشارة مبدئية",
      "blog.refs": "مراجع قانونية هامة",
      "blog.newsletter": "النشرة القانونية",
      "blog.newsletterLead": "احصل على أحدث التحليلات والتحديثات التنظيمية مباشرة في بريدك الإلكتروني.",
      "blog.email": "البريد الإلكتروني",
      "blog.subscribe": "اشتراك",
      "blog.subscribed": "تم تسجيل اشتراكك في النشرة القانونية.",
      "blog.noResults": "لا توجد مقالات مطابقة لبحثك.",

      /* --- about --- */
      "about.title": "عن سند | منصة التقنية القانونية",
      "about.heading": "نبني الثقة بين الناس والقانون",
      "about.lead": "سند منصة سعودية للتقنية القانونية تجعل الوصول إلى محامٍ مرخص أمراً بسيطاً وشفافاً وآمناً.",
      "about.missionTitle": "رسالتنا",
      "about.missionBody": "أن يحصل كل فرد وكل منشأة في المملكة على استشارة قانونية موثوقة خلال دقائق، بسعر معلوم مسبقاً ودون وساطة.",
      "about.visionTitle": "رؤيتنا",
      "about.visionBody": "أن نكون البنية التحتية الرقمية للخدمات القانونية في المنطقة، بما ينسجم مع مستهدفات رؤية المملكة 2030 في التحول الرقمي.",
      "about.valuesTitle": "قيمنا",
      "about.valuesLead": "أربعة مبادئ توجه كل قرار نتخذه.",
      "about.numbersTitle": "سند بالأرقام",
      "about.teamTitle": "فريق القيادة",
      "about.teamLead": "خبرة قانونية وتقنية تحت سقف واحد.",
      "about.faqTitle": "الأسئلة الشائعة",
      "about.contactTitle": "تواصل معنا",
      "about.contactLead": "فريقنا جاهز للإجابة على استفساراتك خلال يوم عمل واحد.",
      "about.name": "الاسم",
      "about.email": "البريد الإلكتروني",
      "about.message": "رسالتك",
      "about.send": "إرسال",
      "about.sent": "تم استلام رسالتك، سنعود إليك قريباً.",

      /* --- auth --- */
      "auth.title": "تسجيل الدخول | سند",
      "auth.asideTitle": "انضم إلى شبكة سند للمحامين",
      "auth.asideBody": "أدر طلباتك، انشر مقالاتك، واستقبل عملاء جدداً من خلال لوحة تحكم واحدة.",
      "auth.asidePoint1": "عملاء موثقون وطلبات جاهزة",
      "auth.asidePoint2": "تحصيل آمن للأتعاب",
      "auth.asidePoint3": "أدوات كتابة ونشر قانونية",
      "auth.login": "تسجيل الدخول",
      "auth.register": "حساب جديد",
      "auth.welcome": "مرحباً بعودتك",
      "auth.welcomeLead": "سجّل الدخول للوصول إلى لوحة التحكم.",
      "auth.registerLead": "أنشئ حسابك للانضمام إلى المنصة.",
      "auth.fullName": "الاسم الكامل",
      "auth.email": "البريد الإلكتروني",
      "auth.licenseNo": "رقم ترخيص المحاماة",
      "auth.password": "كلمة المرور",
      "auth.forgot": "نسيت كلمة المرور؟",
      "auth.remember": "تذكرني",
      "auth.submitLogin": "دخول",
      "auth.submitRegister": "إنشاء الحساب",
      "auth.orGoTo": "أو اذهب مباشرة إلى:",
      "auth.demoLawyer": "تجربة لوحة المحامي",
      "auth.demoClient": "تجربة لوحة العميل",
      "auth.terms": "بإنشاء الحساب فإنك توافق على الشروط والأحكام وسياسة الخصوصية.",

      /* --- dashboards --- */
      "dash.title": "لوحة التحكم | سند",
      "dash.panel": "لوحة التحكم",
      "dash.welcome": "مرحباً بك مجدداً",
      "dash.overview": "نظرة عامة",
      "dash.requests": "الطلبات",
      "dash.calendar": "التقويم",
      "dash.documents": "المحفظة والوثائق",
      "dash.settings": "الإعدادات",
      "dash.logout": "تسجيل الخروج",
      "dash.backToSite": "العودة للموقع",
      "dash.overviewLead": "متابعة الأداء وإدارة المحتوى القانوني.",
      "dash.profileViews": "مشاهدات الملف",
      "dash.overallRating": "التقييم العام",
      "dash.revenue": "الإيرادات (ر.س)",
      "dash.activeRequests": "الطلبات النشطة",
      "dash.vsLastMonth": "من الشهر الماضي",
      "dash.basedOn": "بناءً على {n} مراجعة",
      "dash.editorTitle": "محرر المقالات القانونية",
      "dash.publish": "نشر المقال",
      "dash.saveDraft": "حفظ كمسودة",
      "dash.aiAssist": "مساعد الذكاء الاصطناعي",
      "dash.image": "صورة",
      "dash.articleTitlePlaceholder": "عنوان المقال القانوني...",
      "dash.articleBodyPlaceholder": "ابدأ بكتابة مقالك هنا. يمكنك استخدام أدوات التنسيق أعلاه لترتيب المحتوى، أو استدعاء مساعد الذكاء الاصطناعي لتحسين الصياغة القانونية.",
      "dash.published": "تم نشر المقال بنجاح.",
      "dash.draftSaved": "تم حفظ المسودة.",
      "dash.upcoming": "المواعيد القادمة",
      "dash.newRequests": "أحدث الطلبات",

      "client.title": "لوحة العميل | سند",
      "client.lead": "نظرة سريعة على نشاطاتك القانونية.",
      "client.newRequest": "طلب استشارة جديدة",
      "client.upcoming": "استشارة فيديو قادمة",
      "client.timeLeft": "الوقت المتبقي",
      "client.joinCall": "انضم للمكالمة",
      "client.activeConsults": "الاستشارات النشطة",
      "client.viewAll": "عرض الكل",
      "client.requestNo": "رقم الطلب",
      "client.updated": "تحديث",
      "client.docCenter": "مركز الوثائق",
      "client.savedArticles": "مقالات محفوظة",
      "client.savedOn": "تاريخ الحفظ",
      "client.download": "تنزيل",
      "client.statusReview": "قيد المراجعة",
      "client.statusPending": "بانتظار الإجراء",
      "client.statusDone": "مكتملة",
      "client.spent": "إجمالي المصروف",
      "client.documents": "وثيقة",

      /* --- generic --- */
      "common.hoursAgo": "منذ ساعتين",
      "common.yesterday": "أمس",
      "common.today": "اليوم",
      "common.next": "التالي",
      "common.prev": "السابق",
      "common.notFound": "الصفحة غير موجودة"
    },

    en: {
      "brand.name": "Sanad",
      "brand.latin": "SANAD",
      "nav.home": "Home",
      "nav.lawyers": "Find a Lawyer",
      "nav.blog": "Insights",
      "nav.about": "About",
      "nav.login": "Lawyer Login",
      "nav.cta": "Request a consultation",
      "nav.dashboardLawyer": "Lawyer dashboard",
      "nav.dashboardClient": "Client dashboard",
      "a11y.menu": "Menu",
      "a11y.close": "Close",
      "a11y.theme": "Toggle dark mode",
      "a11y.lang": "Change language",
      "a11y.skip": "Skip to content",
      "theme.toDark": "Dark mode",
      "theme.toLight": "Light mode",

      "footer.about": "A Saudi platform connecting you with licensed lawyers for fast, reliable legal advice at transparent prices.",
      "footer.platform": "Platform",
      "footer.legal": "Legal",
      "footer.contact": "Contact",
      "footer.privacy": "Privacy Policy",
      "footer.terms": "Terms & Conditions",
      "footer.license": "Licensing",
      "footer.help": "Help Center",
      "footer.faq": "FAQ",
      "footer.careers": "Careers",
      "footer.rights": "© 2024 Sanad Legal Technology. All rights reserved.",
      "footer.madeIn": "Made in Saudi Arabia",

      "home.title": "Sanad | Your trusted legal backing",
      "home.eyebrow": "Licensed legal platform",
      "home.heroTitle": "Your trusted legal backing — consultations and contracts, made simple",
      "home.heroLead": "A platform bringing together top licensed lawyers to deliver fast, reliable legal advice at competitive prices.",
      "home.searchPlaceholder": "Search term (e.g. divorce, company setup)",
      "home.specialty": "Practice area",
      "home.city": "City",
      "home.search": "Search now",
      "home.bookNow": "Book your consultation",
      "home.trust1": "140+ licensed lawyers",
      "home.trust2": "Secure encrypted payments",
      "home.trust3": "Complete data confidentiality",
      "home.whyTitle": "Why choose Sanad?",
      "home.whyLead": "A complete legal experience built on trust and competence.",
      "home.stepsTitle": "How it works",
      "home.stepsLead": "From search to consultation in four clear steps.",
      "home.featuredTitle": "Featured lawyers",
      "home.featuredLead": "Meet the top lawyers available for consultation.",
      "home.viewAll": "View all",
      "home.statsTitle": "The numbers speak",
      "home.testimonialsTitle": "What our clients say",
      "home.testimonialsLead": "Real experiences from individuals and companies who trusted Sanad.",
      "home.blogTitle": "Latest legal insights",
      "home.blogLead": "Analysis and guidance written by practising lawyers.",
      "home.ctaTitle": "Need legal advice today?",
      "home.ctaLead": "Book in minutes and get a trusted legal opinion.",
      "home.ctaPrimary": "Book a consultation",
      "home.ctaSecondary": "Join as a lawyer",

      "dir.title": "Find a Lawyer | Sanad",
      "dir.heading": "Lawyer directory",
      "dir.lead": "Search licensed lawyers and pick the right fit for your case.",
      "dir.filters": "Filter results",
      "dir.reset": "Reset",
      "dir.specialties": "Practice areas",
      "dir.cities": "City",
      "dir.priceRange": "Price range (SAR)",
      "dir.from": "From",
      "dir.to": "To",
      "dir.consultType": "Consultation type",
      "dir.rating": "Rating",
      "dir.anyRating": "Any rating",
      "dir.stars4": "4+ stars",
      "dir.stars45": "4.5+ stars",
      "dir.found": "{n} lawyers found",
      "dir.sortBy": "Sort by:",
      "dir.sortRating": "Highest rated",
      "dir.sortPriceAsc": "Lowest price",
      "dir.sortPriceDesc": "Highest price",
      "dir.sortExperience": "Most experienced",
      "dir.viewProfile": "View profile",
      "dir.book": "Book",
      "dir.empty": "No matching results",
      "dir.emptyHint": "Try widening your search or removing some filters.",
      "dir.showFilters": "Filters",

      "lawyer.license": "License no.",
      "lawyer.years": "{n} years",
      "lawyer.reviews": "({n} reviews)",
      "lawyer.call": "Call",
      "lawyer.chat": "Chat",
      "lawyer.contract": "Contracts",
      "lawyer.litigation": "Litigation",
      "lawyer.perHalfHour": "SAR / 30 min",
      "lawyer.perConsult": "SAR / consult",
      "lawyer.startsAt": "from {n} SAR",
      "lawyer.byCase": "Per case",
      "lawyer.unavailable": "Unavailable",
      "lawyer.consultations": "Consultations",
      "lawyer.experience": "Experience",
      "lawyer.location": "Location",

      "profile.title": "Lawyer profile | Sanad",
      "profile.tabExperience": "Experience & credentials",
      "profile.tabServices": "Services & packages",
      "profile.tabArticles": "Articles",
      "profile.tabReviews": "Reviews",
      "profile.bio": "About",
      "profile.education": "Education",
      "profile.subSpecialties": "Focus areas",
      "profile.career": "Professional experience",
      "profile.services": "Available services",
      "profile.reviewsTitle": "Client reviews",
      "profile.articlesTitle": "Articles by this lawyer",
      "profile.book": "Book a consultation",
      "profile.bookHint": "Pick the service and time that suit you.",
      "profile.consultType": "Consultation type",
      "profile.date": "Consultation date",
      "profile.availableTimes": "Available times",
      "profile.total": "Total cost",
      "profile.pay": "Continue to payment",
      "profile.securePay": "Secure encrypted payment",
      "profile.pickSlot": "Please pick an available time first",
      "profile.booked": "Booking provisionally confirmed — details are on the way.",
      "profile.sar": "SAR",

      "blog.title": "Legal Insights | Sanad",
      "blog.heading": "Legal insights & updates",
      "blog.lead": "Stay current with developments in the legal landscape, expert analysis, and practical guidance to protect your business and rights.",
      "blog.searchPlaceholder": "Search articles, topics, or regulations...",
      "blog.search": "Search",
      "blog.all": "All",
      "blog.latest": "Latest articles",
      "blog.readMore": "Read more",
      "blog.readTime": "{n} min read",
      "blog.loadMore": "Load more",
      "blog.askExpert": "Talk to an expert",
      "blog.askExpertCta": "Book an intro consultation",
      "blog.refs": "Key legal references",
      "blog.newsletter": "The legal brief",
      "blog.newsletterLead": "Get the latest analysis and regulatory updates straight to your inbox.",
      "blog.email": "Email address",
      "blog.subscribe": "Subscribe",
      "blog.subscribed": "You're subscribed to the legal brief.",
      "blog.noResults": "No articles match your search.",

      "about.title": "About Sanad | Legal technology platform",
      "about.heading": "Building trust between people and the law",
      "about.lead": "Sanad is a Saudi legal-technology platform that makes reaching a licensed lawyer simple, transparent and secure.",
      "about.missionTitle": "Our mission",
      "about.missionBody": "Every individual and business in the Kingdom should reach trustworthy legal advice within minutes, at a price known upfront and without intermediaries.",
      "about.visionTitle": "Our vision",
      "about.visionBody": "To become the digital infrastructure for legal services in the region, in line with Saudi Vision 2030 digital transformation goals.",
      "about.valuesTitle": "Our values",
      "about.valuesLead": "Four principles guide every decision we make.",
      "about.numbersTitle": "Sanad in numbers",
      "about.teamTitle": "Leadership team",
      "about.teamLead": "Legal and technical expertise under one roof.",
      "about.faqTitle": "Frequently asked questions",
      "about.contactTitle": "Get in touch",
      "about.contactLead": "Our team replies to enquiries within one business day.",
      "about.name": "Name",
      "about.email": "Email address",
      "about.message": "Your message",
      "about.send": "Send",
      "about.sent": "Message received — we'll get back to you shortly.",

      "auth.title": "Sign in | Sanad",
      "auth.asideTitle": "Join the Sanad lawyer network",
      "auth.asideBody": "Manage requests, publish articles and reach new clients from a single dashboard.",
      "auth.asidePoint1": "Verified clients and ready requests",
      "auth.asidePoint2": "Secure fee collection",
      "auth.asidePoint3": "Legal writing and publishing tools",
      "auth.login": "Sign in",
      "auth.register": "Create account",
      "auth.welcome": "Welcome back",
      "auth.welcomeLead": "Sign in to reach your dashboard.",
      "auth.registerLead": "Create your account to join the platform.",
      "auth.fullName": "Full name",
      "auth.email": "Email address",
      "auth.licenseNo": "Bar license number",
      "auth.password": "Password",
      "auth.forgot": "Forgot password?",
      "auth.remember": "Remember me",
      "auth.submitLogin": "Sign in",
      "auth.submitRegister": "Create account",
      "auth.orGoTo": "Or jump straight to:",
      "auth.demoLawyer": "Lawyer dashboard demo",
      "auth.demoClient": "Client dashboard demo",
      "auth.terms": "By creating an account you agree to the Terms & Conditions and Privacy Policy.",

      "dash.title": "Dashboard | Sanad",
      "dash.panel": "Dashboard",
      "dash.welcome": "Welcome back",
      "dash.overview": "Overview",
      "dash.requests": "Requests",
      "dash.calendar": "Calendar",
      "dash.documents": "Wallet & documents",
      "dash.settings": "Settings",
      "dash.logout": "Sign out",
      "dash.backToSite": "Back to site",
      "dash.overviewLead": "Track performance and manage your legal content.",
      "dash.profileViews": "Profile views",
      "dash.overallRating": "Overall rating",
      "dash.revenue": "Revenue (SAR)",
      "dash.activeRequests": "Active requests",
      "dash.vsLastMonth": "vs. last month",
      "dash.basedOn": "based on {n} reviews",
      "dash.editorTitle": "Legal article editor",
      "dash.publish": "Publish",
      "dash.saveDraft": "Save draft",
      "dash.aiAssist": "AI assistant",
      "dash.image": "Image",
      "dash.articleTitlePlaceholder": "Legal article title...",
      "dash.articleBodyPlaceholder": "Start writing here. Use the toolbar above to structure your content, or call the AI assistant to refine the legal phrasing.",
      "dash.published": "Article published successfully.",
      "dash.draftSaved": "Draft saved.",
      "dash.upcoming": "Upcoming appointments",
      "dash.newRequests": "Latest requests",

      "client.title": "Client dashboard | Sanad",
      "client.lead": "A quick look at your legal activity.",
      "client.newRequest": "New consultation request",
      "client.upcoming": "Upcoming video consultation",
      "client.timeLeft": "Time remaining",
      "client.joinCall": "Join call",
      "client.activeConsults": "Active consultations",
      "client.viewAll": "View all",
      "client.requestNo": "Request no.",
      "client.updated": "Updated",
      "client.docCenter": "Document centre",
      "client.savedArticles": "Saved articles",
      "client.savedOn": "Saved on",
      "client.download": "Download",
      "client.statusReview": "Under review",
      "client.statusPending": "Action required",
      "client.statusDone": "Completed",
      "client.spent": "Total spent",
      "client.documents": "documents",

      "common.hoursAgo": "2 hours ago",
      "common.yesterday": "Yesterday",
      "common.today": "Today",
      "common.next": "Next",
      "common.prev": "Previous",
      "common.notFound": "Page not found"
    }
  };

  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* private mode */ }
  }

  // Arabic-first by design: the layout, typography and content are authored RTL,
  // so a first-time visitor always lands on Arabic. Only an explicit choice —
  // the language button — moves them to English, and that choice is remembered.
  var current = (function () {
    var saved = read();
    return (saved === "ar" || saved === "en") ? saved : DEFAULT_LANG;
  })();

  var listeners = [];

  var I18N = {
    get lang() { return current; },
    get dir() { return current === "ar" ? "rtl" : "ltr"; },
    other: function () { return current === "ar" ? "en" : "ar"; },

    /** Translate a key. `vars` fills {placeholders}. Missing keys return the key. */
    t: function (key, vars) {
      var table = DICT[current] || DICT[DEFAULT_LANG];
      var s = table[key];
      if (s == null) s = (DICT[DEFAULT_LANG][key] != null ? DICT[DEFAULT_LANG][key] : key);
      if (vars) {
        s = s.replace(/\{(\w+)\}/g, function (m, name) {
          return vars[name] != null ? vars[name] : m;
        });
      }
      return s;
    },

    /** Pick the right side of a { ar, en } pair coming from data.js */
    pick: function (pair) {
      if (pair == null) return "";
      if (typeof pair === "string") return pair;
      return pair[current] != null ? pair[current] : pair[DEFAULT_LANG];
    },

    /** Localised digits stay Latin — legal/financial figures read better that way. */
    num: function (n) {
      return new Intl.NumberFormat(current === "ar" ? "ar-SA-u-nu-latn" : "en-US").format(n);
    },

    /**
     * Walk a subtree and translate everything tagged with:
     *   data-i18n            → textContent
     *   data-i18n-html       → innerHTML (for strings carrying inline markup)
     *   data-i18n-attr="placeholder:key, aria-label:key"
     *   data-i18n-vars='{"n":12}'
     */
    apply: function (root) {
      root = root || document;

      root.querySelectorAll("[data-i18n]").forEach(function (el) {
        var vars = parseVars(el);
        el.textContent = I18N.t(el.getAttribute("data-i18n"), vars);
      });

      root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
        el.innerHTML = I18N.t(el.getAttribute("data-i18n-html"), parseVars(el));
      });

      root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
        el.getAttribute("data-i18n-attr").split(",").forEach(function (pairStr) {
          var bits = pairStr.split(":");
          if (bits.length !== 2) return;
          el.setAttribute(bits[0].trim(), I18N.t(bits[1].trim(), parseVars(el)));
        });
      });

      if (root === document) {
        var titleKey = document.documentElement.getAttribute("data-title-key");
        if (titleKey) document.title = I18N.t(titleKey);
      }
      return root;
    },

    /** Flip language: updates <html lang/dir>, re-translates, notifies listeners. */
    set: function (lang, opts) {
      if (lang !== "ar" && lang !== "en") return;
      current = lang;
      write(lang);
      var html = document.documentElement;
      html.setAttribute("lang", lang);
      html.setAttribute("dir", I18N.dir);
      I18N.apply(document);
      listeners.forEach(function (fn) { try { fn(lang); } catch (e) { console.error(e); } });
      if (!opts || !opts.silent) {
        document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
      }
    },

    toggle: function () { I18N.set(I18N.other()); },

    /** Register a re-render hook; fires immediately so callers get first paint too. */
    onChange: function (fn, runNow) {
      listeners.push(fn);
      if (runNow !== false) { try { fn(current); } catch (e) { console.error(e); } }
    }
  };

  function parseVars(el) {
    var raw = el.getAttribute("data-i18n-vars");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // Set lang/dir before first paint so RTL never flashes as LTR.
  document.documentElement.setAttribute("lang", current);
  document.documentElement.setAttribute("dir", I18N.dir);

  global.I18N = I18N;
})(window);
