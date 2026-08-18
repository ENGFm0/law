/* ==========================================================================
   Seed content — people, work and writing the demo starts with.
   Every row carries an id, and every reference is by id, so the model layer
   can walk the relations instead of guessing.
   ========================================================================== */
(function (global) {
  "use strict";

  var SPECIALTIES = [
    { id: "family",     ar: "أحوال شخصية",  en: "Family law" },
    { id: "commercial", ar: "تجاري وشركات", en: "Commercial & corporate" },
    { id: "realestate", ar: "عقاري",        en: "Real estate" },
    { id: "labour",     ar: "عمالي",         en: "Labour" },
    { id: "criminal",   ar: "جنائي",         en: "Criminal" },
    { id: "ip",         ar: "ملكية فكرية",  en: "Intellectual property" },
    { id: "estates",    ar: "تركات",         en: "Estates & inheritance" },
    { id: "admin",      ar: "إداري",         en: "Administrative" }
  ];

  var CITIES = [
    { id: "riyadh",  ar: "الرياض", en: "Riyadh" },
    { id: "jeddah",  ar: "جدة",    en: "Jeddah" },
    { id: "dammam",  ar: "الدمام", en: "Dammam" },
    { id: "makkah",  ar: "مكة المكرمة", en: "Makkah" },
    { id: "madinah", ar: "المدينة المنورة", en: "Madinah" },
    { id: "khobar",  ar: "الخبر",  en: "Khobar" }
  ];

  /* Service types with the platform's published price band.
     A lawyer prices inside the band — the anti-manipulation decision. */
  var SERVICE_TYPES = [
    { id: "call",   icon: "phone", minPrice: 80,  maxPrice: 400,  mode: "live",
      title: { ar: "استشارة هاتفية", en: "Phone consultation" },
      meta:  { ar: "30 دقيقة", en: "30 minutes" } },
    { id: "video",  icon: "video", minPrice: 150, maxPrice: 800,  mode: "live",
      title: { ar: "استشارة فيديو", en: "Video consultation" },
      meta:  { ar: "60 دقيقة", en: "60 minutes" } },
    { id: "written",icon: "chat",  minPrice: 50,  maxPrice: 300,  mode: "written",
      title: { ar: "استشارة مكتوبة", en: "Written consultation" },
      meta:  { ar: "خلال 24 ساعة", en: "Within 24 hours" } },
    { id: "express",icon: "bolt",  minPrice: 60,  maxPrice: 250,  mode: "doc", tier: "quick",
      title: { ar: "صياغة مستند — سريعة", en: "Document drafting — express" },
      meta:  { ar: "خلال ساعات", en: "Within hours" } },
    { id: "drafting",icon: "file-text", minPrice: 300, maxPrice: 2000, mode: "doc", tier: "full",
      title: { ar: "صياغة مستند — كاملة", en: "Document drafting — full" },
      meta:  { ar: "3 – 5 أيام", en: "3 – 5 days" } }
  ];

  /* ---------- people ---------- */
  var USERS = [
    /* --- lawyers --- */
    { id: "u-ahmed", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "د. أحمد عبدالله المحمدي", en: "Dr. Ahmed Abdullah Al-Mohammadi" },
      title: { ar: "محامي استئناف ومستشار قانوني", en: "Appellate lawyer & legal counsel" },
      email: "ahmed@sanad.sa", city: "riyadh", years: 15, completed: 96, responseHours: 3,
      seedRating: 4.9, seedReviews: 120, specialties: ["commercial", "realestate"],
      licence: { number: "4321", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2027-04-01" },
      bio: { ar: "محامٍ مرخص ومستشار قانوني ذو خبرة واسعة في القضايا التجارية والعمالية. عمل مستشاراً لعدد من الشركات الكبرى في المملكة.",
             en: "A licensed lawyer and counsel with deep experience in commercial and labour matters, having advised several of the Kingdom's largest companies." },
      focus: [{ ar: "القانون التجاري", en: "Commercial law" }, { ar: "الشركات", en: "Corporate" },
              { ar: "العقود والمقاولات", en: "Contracts & construction" }],
      education: [
        { degree: { ar: "ماجستير في القانون التجاري", en: "LL.M. in Commercial Law" }, place: { ar: "جامعة الملك سعود – 2010", en: "King Saud University – 2010" } },
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الإمام – 2007", en: "Imam University – 2007" } }
      ],
      career: [
        { role: { ar: "شريك مؤسس – مكتب المحمدي", en: "Founding partner – Al-Mohammadi Law Firm" },
          period: { ar: "2018 – الحاضر", en: "2018 – Present" },
          note: { ar: "إدارة فريق من المحامين وتمثيل كبرى الشركات.", en: "Leads a team of lawyers, representing major corporates." } },
        { role: { ar: "مستشار قانوني أول – شركة الاتصالات", en: "Senior counsel – Telecom company" },
          period: { ar: "2012 – 2018", en: "2012 – 2018" },
          note: { ar: "صياغة ومراجعة عقود التقنية والاتصالات.", en: "Drafted and reviewed technology and telecom contracts." } }
      ] },

    { id: "u-sara", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "أ. سارة بنت طارق", en: "Sara bint Tariq" },
      title: { ar: "محامية ومستشارة قانونية", en: "Lawyer & legal consultant" },
      email: "sara@sanad.sa", city: "jeddah", years: 8, completed: 61, responseHours: 5,
      seedRating: 4.8, seedReviews: 85, specialties: ["family", "labour", "estates"],
      licence: { number: "8765", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2026-11-15" },
      bio: { ar: "محامية مرخصة تركز على قضايا الأسرة والتركات، وتؤمن بأن التسوية الودية تحمي العلاقات قبل أن تحمي الحقوق.",
             en: "A licensed lawyer focused on family and inheritance matters, who believes amicable settlement protects relationships before it protects rights." },
      focus: [{ ar: "الطلاق والحضانة", en: "Divorce & custody" }, { ar: "النفقة", en: "Alimony" },
              { ar: "قسمة التركات", en: "Estate division" }],
      education: [
        { degree: { ar: "ماجستير في الأنظمة", en: "LL.M. in Law" }, place: { ar: "جامعة الملك عبدالعزيز – 2016", en: "King Abdulaziz University – 2016" } }
      ],
      career: [
        { role: { ar: "مديرة قسم الأسرة – مكتب طارق", en: "Head of family practice – Tariq Law Office" },
          period: { ar: "2019 – الحاضر", en: "2019 – Present" },
          note: { ar: "الإشراف على ملفات الأحوال الشخصية.", en: "Oversees family-law files." } }
      ] },

    { id: "u-mohammed", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "أ. محمد الفهد", en: "Mohammed Al-Fahd" },
      title: { ar: "مستشار عقاري ومنازعات", en: "Real estate & disputes counsel" },
      email: "mohammed@sanad.sa", city: "dammam", years: 12, completed: 88, responseHours: 6,
      seedRating: 5.0, seedReviews: 210, specialties: ["realestate", "admin", "commercial"],
      licence: { number: "2341", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2028-02-20" },
      bio: { ar: "مستشار قانوني متخصص في السوق العقاري ومنازعات المقاولات، وله مساهمات في صياغة عقود التطوير العقاري.",
             en: "A counsel specialised in the real-estate market and construction disputes, with a record drafting development agreements." },
      focus: [{ ar: "نقل الملكية", en: "Title transfer" }, { ar: "التحكيم", en: "Arbitration" }],
      education: [
        { degree: { ar: "ماجستير في التحكيم التجاري", en: "LL.M. in Commercial Arbitration" }, place: { ar: "جامعة الملك فهد – 2015", en: "King Fahd University – 2015" } }
      ],
      career: [
        { role: { ar: "مستشار أول – مجموعة تطوير عقاري", en: "Senior counsel – Real-estate developer" },
          period: { ar: "2017 – الحاضر", en: "2017 – Present" },
          note: { ar: "مراجعة عقود التطوير والبيع على الخارطة.", en: "Reviews development and off-plan sale contracts." } }
      ] },

    { id: "u-khalid", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "أ. خالد عبدالرحمن", en: "Khalid Abdulrahman" },
      title: { ar: "محامي جنائي وإداري", en: "Criminal & administrative lawyer" },
      email: "khalid@sanad.sa", city: "riyadh", years: 22, completed: 74, responseHours: 9,
      seedRating: 4.7, seedReviews: 96, specialties: ["criminal", "admin"],
      licence: { number: "5590", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2026-08-30" },
      bio: { ar: "سجل حافل بالنجاحات أمام المحكمة العليا وديوان المظالم، مع أكثر من عشرين عاماً في الترافع.",
             en: "A strong record before the Supreme Court and the Board of Grievances, with over twenty years in advocacy." },
      focus: [{ ar: "الدفاع الجنائي", en: "Criminal defence" }, { ar: "ديوان المظالم", en: "Board of Grievances" }],
      education: [
        { degree: { ar: "دبلوم عالٍ في القضاء", en: "Higher diploma in judicial studies" }, place: { ar: "المعهد العالي للقضاء – 2005", en: "Higher Judicial Institute – 2005" } }
      ],
      career: [
        { role: { ar: "مؤسس – مكتب عبدالرحمن", en: "Founder – Abdulrahman Law Office" },
          period: { ar: "2010 – الحاضر", en: "2010 – Present" },
          note: { ar: "الترافع في القضايا الجنائية الكبرى.", en: "Leads major criminal defence work." } }
      ] },

    { id: "u-noura", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "أ. نورة القحطاني", en: "Noura Al-Qahtani" },
      title: { ar: "مستشارة ملكية فكرية وتقنية", en: "IP & technology counsel" },
      email: "noura@sanad.sa", city: "khobar", years: 9, completed: 52, responseHours: 4,
      seedRating: 4.9, seedReviews: 64, specialties: ["ip", "commercial"],
      licence: { number: "7712", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2027-09-10" },
      bio: { ar: "مستشارة قانونية تجمع بين القانون والتقنية، وتعمل مع الشركات الناشئة على حماية أصولها الرقمية.",
             en: "A counsel at the intersection of law and technology, working with startups to protect digital assets." },
      focus: [{ ar: "العلامات التجارية", en: "Trademarks" }, { ar: "خصوصية البيانات", en: "Data privacy" }],
      education: [
        { degree: { ar: "ماجستير في قانون التقنية", en: "LL.M. in Technology Law" }, place: { ar: "جامعة الملك فهد – 2018", en: "King Fahd University – 2018" } }
      ],
      career: [
        { role: { ar: "مستشارة – حاضنة أعمال تقنية", en: "Counsel – Tech incubator" },
          period: { ar: "2019 – الحاضر", en: "2019 – Present" },
          note: { ar: "دعم أكثر من 40 شركة ناشئة.", en: "Supported 40+ startups." } }
      ] },

    { id: "u-faisal", roles: ["lawyer"], activeRole: "lawyer", status: "verified",
      name: { ar: "أ. فيصل العتيبي", en: "Faisal Al-Otaibi" },
      title: { ar: "مستشار عمالي وحوكمة", en: "Labour & governance consultant" },
      email: "faisal@sanad.sa", city: "jeddah", years: 11, completed: 45, responseHours: 8,
      seedRating: 4.6, seedReviews: 141, specialties: ["labour", "commercial"],
      licence: { number: "3308", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2026-05-05" },
      bio: { ar: "مستشار عمالي يعمل مع أقسام الموارد البشرية على مواءمة اللوائح الداخلية مع نظام العمل السعودي.",
             en: "A labour consultant aligning internal policies with the Saudi Labour Law." },
      focus: [{ ar: "اللوائح الداخلية", en: "Internal policies" }, { ar: "إنهاء الخدمة", en: "Termination" }],
      education: [
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الملك عبدالعزيز – 2012", en: "King Abdulaziz University – 2012" } }
      ],
      career: [
        { role: { ar: "مستشار عمالي مستقل", en: "Independent labour consultant" },
          period: { ar: "2016 – الحاضر", en: "2016 – Present" },
          note: { ar: "مراجعة عقود العمل لأكثر من 60 منشأة.", en: "Reviewed contracts for 60+ organisations." } }
      ] },

    /* --- trainees --- */
    { id: "u-jaid", roles: ["intern"], activeRole: "intern", status: "verified",
      name: { ar: "أحمد الجعيد", en: "Ahmed Al-Jaid" },
      title: { ar: "متدرب قانوني", en: "Legal trainee" },
      email: "jaid@sanad.sa", city: "riyadh", completed: 24, responseHours: 6,
      seedRating: 4.6, seedReviews: 18, seedHours: 26,
      university: { ar: "جامعة الملك سعود", en: "King Saud University" },
      level: { ar: "السنة الرابعة", en: "Fourth year" },
      supervisorId: "u-ahmed",
      skills: [
        { ar: "صياغة العقود", en: "Contract drafting" },
        { ar: "البحث في الأنظمة", en: "Statutory research" },
        { ar: "تلخيص القضايا", en: "Case summarising" }
      ],
      bio: { ar: "متدرب قانوني يركز على العقود التجارية والبحث النظامي، ويعمل تحت إشراف د. أحمد المحمدي.",
             en: "A legal trainee focused on commercial contracts and statutory research, supervised by Dr. Ahmed Al-Mohammadi." } },

    { id: "u-layan", roles: ["intern"], activeRole: "intern", status: "verified",
      name: { ar: "ليان الحربي", en: "Layan Al-Harbi" },
      title: { ar: "مساعدة قانونية", en: "Legal assistant" },
      email: "layan@sanad.sa", city: "jeddah", completed: 41, responseHours: 4,
      seedRating: 4.9, seedReviews: 29, seedHours: 52,
      university: { ar: "جامعة الملك عبدالعزيز", en: "King Abdulaziz University" },
      level: { ar: "خريجة", en: "Graduate" },
      supervisorId: "u-sara",
      skills: [
        { ar: "لوائح الدعاوى", en: "Pleadings" },
        { ar: "قضايا الأسرة", en: "Family matters" },
        { ar: "الترجمة القانونية", en: "Legal translation" },
        { ar: "التوثيق", en: "Documentation" }
      ],
      bio: { ar: "مساعدة قانونية أنجزت أكثر من أربعين مهمة موثقة، وحاصلة على اعتماد تدريب.",
             en: "A legal assistant with over forty documented tasks and a training endorsement." } },

    { id: "u-turki", roles: ["intern"], activeRole: "intern", status: "pending",
      name: { ar: "تركي السبيعي", en: "Turki Al-Subaie" },
      title: { ar: "متدرب قانوني", en: "Legal trainee" },
      email: "turki@sanad.sa", city: "dammam", completed: 7, responseHours: 11,
      seedRating: 4.3, seedReviews: 5, seedHours: 9,
      university: { ar: "جامعة الإمام عبدالرحمن بن فيصل", en: "Imam Abdulrahman Bin Faisal University" },
      level: { ar: "السنة الثالثة", en: "Third year" },
      supervisorId: "u-mohammed",
      skills: [{ ar: "مراجعة المستندات", en: "Document review" }, { ar: "العقارات", en: "Real estate" }],
      bio: { ar: "متدرب في بداية مساره، يعمل على مراجعة المستندات العقارية.",
             en: "A trainee early in his path, working on real-estate document review." } },

    /* --- clients --- */
    { id: "u-fahad", roles: ["client"], activeRole: "client", status: "verified",
      name: { ar: "فهد العتيبي", en: "Fahad Al-Otaibi" },
      email: "fahad@example.com", city: "riyadh" },
    { id: "u-munira", roles: ["client"], activeRole: "client", status: "verified",
      name: { ar: "منيرة العنزي", en: "Munira Al-Anazi" },
      email: "munira@example.com", city: "jeddah" }
  ];

  /* ---------- services each lawyer publishes, priced inside the band ---------- */
  function svc(id, ownerId, typeId, price) {
    return { id: id, ownerId: ownerId, typeId: typeId, price: price, active: true };
  }
  var SERVICES = [
    svc("s-1", "u-ahmed", "call", 150), svc("s-2", "u-ahmed", "video", 300),
    svc("s-3", "u-ahmed", "written", 100), svc("s-4", "u-ahmed", "express", 99),
    svc("s-5", "u-ahmed", "drafting", 500),
    svc("s-6", "u-sara", "call", 120), svc("s-7", "u-sara", "written", 80),
    svc("s-8", "u-sara", "express", 79), svc("s-9", "u-sara", "drafting", 420),
    svc("s-10", "u-mohammed", "call", 200), svc("s-11", "u-mohammed", "video", 400),
    svc("s-12", "u-mohammed", "drafting", 650),
    svc("s-13", "u-khalid", "call", 250), svc("s-14", "u-khalid", "video", 500),
    svc("s-15", "u-noura", "written", 120), svc("s-16", "u-noura", "express", 110),
    svc("s-17", "u-noura", "drafting", 480),
    svc("s-18", "u-faisal", "call", 100), svc("s-19", "u-faisal", "written", 65),
    svc("s-20", "u-faisal", "express", 70)
  ];

  /* ---------- requests already in flight ---------- */
  var REQUESTS = [
    { id: "r-1", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "express", price: 99,
      status: "drafted", ai: true, doc: "employment", hours: 4,
      title: { ar: "عقد عمل لموظف تسويق", en: "Employment contract, marketing hire" },
      brief: { ar: "راتب 9,000 ريال، فترة تجربة 90 يوماً.", en: "SAR 9,000 salary, 90-day probation." },
      ago: { ar: "منذ 12 دقيقة", en: "12 minutes ago" } },
    { id: "r-2", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "express", price: 89,
      status: "drafted", ai: true, doc: "demand", hours: 4,
      title: { ar: "إنذار بالمطالبة بمبلغ", en: "Formal demand for payment" },
      brief: { ar: "45,000 ريال مستحقة منذ ثلاثة أشهر.", en: "SAR 45,000 outstanding for three months." },
      ago: { ar: "منذ ساعة", en: "An hour ago" } },
    { id: "r-3", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "express", price: 79,
      status: "new", ai: true, doc: "nda", hours: 3,
      title: { ar: "اتفاقية عدم إفشاء", en: "Non-disclosure agreement" },
      brief: { ar: "مع مطوّر مستقل لمدة سنتين.", en: "With a freelance developer, two-year term." },
      ago: { ar: "منذ 5 دقائق", en: "5 minutes ago" } },
    { id: "r-4", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "written", price: 100,
      status: "new", ai: true, hours: 3,
      title: { ar: "استشارة مكتوبة — نهاية الخدمة", en: "Written query — end-of-service" },
      brief: { ar: "استقالة بعد 4 سنوات، ما مستحقاتي؟", en: "Resigning after 4 years — what am I owed?" },
      ago: { ar: "منذ 3 ساعات", en: "3 hours ago" } },
    { id: "r-5", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "drafting", price: 500,
      status: "new", ai: false, hours: 8,
      title: { ar: "عقد شراكة تجارية", en: "Commercial partnership agreement" },
      brief: { ar: "ثلاثة شركاء، حصص متفاوتة، وبند خروج.", en: "Three partners, uneven shares, exit clause." },
      ago: { ar: "أمس", en: "Yesterday" } },
    { id: "r-6", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "drafting", price: 650,
      status: "new", ai: false, hours: 10,
      title: { ar: "مراجعة عقد مقاولة", en: "Construction contract review" },
      brief: { ar: "مشروع بقيمة 8 ملايين، مراجعة بنود الغرامات.", en: "SAR 8m project; review the penalty clauses." },
      ago: { ar: "أمس", en: "Yesterday" } },
    { id: "r-7", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "call", price: 150,
      status: "scheduled", ai: false, hours: 1,
      title: { ar: "استشارة هاتفية", en: "Phone consultation" },
      brief: { ar: "نزاع إيجاري مع المالك.", en: "Tenancy dispute with the landlord." },
      ago: { ar: "اليوم 14:00", en: "Today 14:00" } },
    { id: "r-8", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "video", price: 300,
      status: "scheduled", ai: false, hours: 1,
      title: { ar: "استشارة فيديو", en: "Video consultation" },
      brief: { ar: "مراجعة مستندات قبل جلسة المحكمة.", en: "Document review ahead of a hearing." },
      ago: { ar: "غداً 11:30", en: "Tomorrow 11:30" } },
    /* delivered history, so "past requests" is not empty on first visit */
    { id: "r-9", clientId: "u-fahad", lawyerId: "u-sara", typeId: "written", price: 80,
      status: "completed", ai: false, hours: 3,
      title: { ar: "استشارة حول حضانة", en: "Custody consultation" },
      brief: { ar: "ترتيب الزيارة بعد الطلاق.", en: "Visitation arrangements after divorce." },
      ago: { ar: "قبل أسبوعين", en: "Two weeks ago" } },
    { id: "r-10", clientId: "u-fahad", lawyerId: "u-mohammed", typeId: "drafting", price: 650,
      status: "completed", ai: false, hours: 9,
      title: { ar: "مراجعة عقد إيجار تجاري", en: "Commercial lease review" },
      brief: { ar: "محل تجاري في الدمام، مدة خمس سنوات.", en: "Retail unit in Dammam, five-year term." },
      ago: { ar: "الشهر الماضي", en: "Last month" } }
  ];

  /* ---------- writing ---------- */
  var ARTICLES = [
    { id: "a-1", authorId: "u-ahmed", cover: "cover-corporate.svg", cat: "commercial", read: 5,
      status: "published", likes: 34, date: { ar: "15 أكتوبر 2023", en: "15 October 2023" },
      title: { ar: "تأثير نظام الشركات الجديد على حوكمة الشركات المساهمة",
               en: "How the new Companies Law reshapes joint-stock governance" },
      excerpt: { ar: "تحليل شامل للتعديلات الأخيرة في نظام الشركات وتأثيرها على التزامات مجالس الإدارة وحقوق المساهمين.",
                 en: "A full analysis of the recent amendments and their effect on board duties and shareholder rights." },
      body: { ar: "جاء نظام الشركات الجديد بتعديلات جوهرية تمسّ حوكمة الشركات المساهمة، أبرزها إعادة تعريف مسؤولية أعضاء مجلس الإدارة تجاه الشركة والمساهمين.\n\nأولاً: واجب العناية\nصار على العضو أن يثبت أنه اتخذ قراره على أساس معلومات كافية وبحسن نية، لا أن يكتفي بحضور الاجتماع. وهذا ينقل عبء الإثبات في كثير من الدعاوى.\n\nثانياً: تعارض المصالح\nألزم النظام بالإفصاح المسبق عن أي مصلحة مباشرة أو غير مباشرة، وجعل العقد المبرم بالمخالفة قابلاً للإبطال.\n\nثالثاً: حقوق الأقلية\nخُفّضت النسبة اللازمة لطلب عقد جمعية عامة، وهو تحوّل عملي يمنح صغار المساهمين أداة فعلية.\n\nالخلاصة العملية: راجع لائحتك الداخلية ومحاضر مجلسك قبل نهاية السنة المالية.",
              en: "The new Companies Law brings substantive changes to joint-stock governance, most notably a redefinition of directors' duties toward the company and its shareholders.\n\nFirst: the duty of care\nA director must now show the decision rested on sufficient information and good faith, not merely that they attended. That shifts the burden of proof in many claims.\n\nSecond: conflicts of interest\nPrior disclosure of any direct or indirect interest is mandatory, and a contract concluded in breach is voidable.\n\nThird: minority rights\nThe threshold to convene a general assembly was lowered — a practical shift giving smaller shareholders a real instrument.\n\nThe practical takeaway: review your internal regulations and board minutes before the financial year closes." } },

    { id: "a-2", authorId: "u-mohammed", cover: "cover-realestate.svg", cat: "realestate", read: 3,
      status: "published", likes: 21, date: { ar: "10 أكتوبر 2023", en: "10 October 2023" },
      title: { ar: "دليل المستثمر الأجنبي للتملك العقاري وفق الأنظمة المحدثة",
               en: "The foreign investor's guide to property ownership" },
      excerpt: { ar: "نظرة على الإجراءات والشروط التنظيمية الجديدة التي تحكم استثمارات غير المواطنين في القطاع العقاري.",
                 en: "An overview of the new procedures governing non-citizen investment in real estate." },
      body: { ar: "تغيّر المشهد التنظيمي للتملك العقاري لغير المواطنين تغيراً ملموساً، ويمكن تلخيص ما يهم المستثمر في ثلاث نقاط.\n\nالترخيص المسبق\nالاستثمار العقاري بغرض التطوير يتطلب ترخيصاً من الجهة المختصة، ولا يُغني عنه السجل التجاري.\n\nالمناطق المستثناة\nتبقى حدود مكة والمدينة خاضعة لأحكام خاصة، فلا يُقاس عليها.\n\nالبيع على الخارطة\nالمشاريع المرخصة تمرّ دفعاتها عبر حساب ضمان، وهذا أهم ما يحمي المشتري عملياً.",
              en: "The regulatory landscape for non-citizen ownership has shifted noticeably; what matters to an investor reduces to three points.\n\nPrior licensing\nInvesting for development purposes requires a licence from the competent authority; a commercial registration is not a substitute.\n\nExcluded areas\nThe boundaries of Makkah and Madinah remain subject to special provisions and cannot be reasoned by analogy.\n\nOff-plan sales\nLicensed projects route payments through an escrow account — practically the strongest protection a buyer has." } },

    { id: "a-3", authorId: "u-noura", cover: "cover-ip.svg", cat: "ip", read: 7,
      status: "published", likes: 47, date: { ar: "05 أكتوبر 2023", en: "05 October 2023" },
      title: { ar: "حماية البرمجيات والتطبيقات الذكية: تحديات الملكية الفكرية",
               en: "Protecting software and apps: IP challenges in the digital age" },
      excerpt: { ar: "التحديات القانونية لحماية الأصول الرقمية، وكيف تبني الشركات الناشئة استراتيجية متينة.",
                 en: "The legal challenges of protecting digital assets, and how startups build a durable strategy." },
      body: { ar: "الشيفرة المصدرية محمية بحق المؤلف تلقائياً، لكن هذه الحماية أضيق مما يظن كثير من المؤسسين.\n\nما يحميه حق المؤلف\nالتعبير لا الفكرة. فمنافسك يستطيع بناء التطبيق نفسه بشيفرة مختلفة دون أن يخالف.\n\nما تحتاجه إضافةً\nالعلامة التجارية للاسم والهوية، والأسرار التجارية للخوارزميات، واتفاقيات نقل الملكية مع كل مطوّر ومقاول من الباطن — وهذا أكثر ما يُغفل.\n\nخطأ شائع\nتوظيف مطوّر مستقل بلا بند نقل ملكية يعني أن الشيفرة قد تبقى ملكاً له.",
              en: "Source code is protected by copyright automatically, but that protection is narrower than most founders assume.\n\nWhat copyright covers\nExpression, not the idea. A competitor may build the same application with different code without infringing.\n\nWhat you need besides\nTrademarks for the name and identity, trade secrets for algorithms, and assignment agreements with every developer and subcontractor — the most commonly skipped item.\n\nA common mistake\nEngaging a freelance developer without an assignment clause can leave the code belonging to them." } },

    { id: "a-4", authorId: "u-faisal", cover: "cover-labour.svg", cat: "labour", read: 4,
      status: "published", likes: 63, date: { ar: "28 سبتمبر 2023", en: "28 September 2023" },
      title: { ar: "إنهاء عقد العمل: متى يكون مشروعاً ومتى يُعد فصلاً تعسفياً؟",
               en: "Ending an employment contract: lawful vs. arbitrary" },
      excerpt: { ar: "قراءة عملية في المادتين 75 و77 من نظام العمل، مع أمثلة على الأحكام القضائية.",
                 en: "A practical reading of Articles 75 and 77, with the case law that drew the line." },
      body: { ar: "الخلط بين المادتين 75 و77 هو أكثر ما يُوقع أصحاب العمل في التعويض.\n\nالمادة 75\nتعالج إنهاء العقد غير محدد المدة بإشعار مسبق. الإنهاء هنا مشروع متى استُوفيت مدة الإشعار.\n\nالمادة 77\nتعالج ثمن الإنهاء إذا كان بلا سبب مشروع: تعويض متفق عليه، وإن لم يوجد فأجر خمسة عشر يوماً عن كل سنة.\n\nخلاصة\n75 عن الكيفية، و77 عن الثمن. والإشعار وحده لا يجعل الإنهاء مبرراً.",
              en: "Confusing Articles 75 and 77 is what most often costs an employer compensation.\n\nArticle 75\nGoverns ending an open-ended contract with notice. Termination is lawful once the notice period is served.\n\nArticle 77\nGoverns the price of termination without a valid reason: agreed compensation, failing which fifteen days' wages per year of service.\n\nIn short\n75 is the how; 77 is the cost. Serving notice alone does not make a termination justified." } },

    { id: "a-5", authorId: "u-layan", cover: "cover-family.svg", cat: "family", read: 6,
      status: "published", likes: 29, date: { ar: "20 سبتمبر 2023", en: "20 September 2023" },
      title: { ar: "نظام الأحوال الشخصية: ما الذي تغيّر في أحكام الحضانة والنفقة؟",
               en: "The Personal Status Law: what changed in custody and alimony" },
      excerpt: { ar: "ملخص للأحكام الجديدة التي نظّمت الحضانة والنفقة والزيارة، وأثرها على الدعاوى المنظورة.",
                 en: "A summary of the new provisions on custody, alimony and visitation." },
      body: { ar: "نظّم النظام الجديد مسائل كانت متروكة للاجتهاد، وأهم ما يعني المتقاضي ثلاثة أمور.\n\nالحضانة\nصارت للأم ما لم يثبت ما يسقطها، وهذا يقلب عبء الإثبات.\n\nالنفقة\nربطها النظام بيسار المنفق وحال المنفق عليه، مع إمكان طلب زيادتها عند تغيّر الظروف.\n\nالزيارة\nنُظّمت آلياتها بما يقلل النزاع التنفيذي، وهو أكثر ما كان يُرهق الأطراف.",
              en: "The new law codified matters previously left to judicial discretion; three points matter most to a litigant.\n\nCustody\nNow vests with the mother unless a disqualifying ground is proven — reversing the burden of proof.\n\nAlimony\nTied to the payer's means and the recipient's circumstances, with room to seek an increase when conditions change.\n\nVisitation\nIts mechanics were regularised, reducing the enforcement disputes that exhausted parties most." } },

    { id: "a-6", authorId: "u-jaid", cover: "cover-contracts.svg", cat: "commercial", read: 5,
      status: "published", likes: 12, date: { ar: "12 سبتمبر 2023", en: "12 September 2023" },
      endorsedBy: "u-ahmed",
      title: { ar: "خمسة أخطاء شائعة في صياغة العقود التجارية", en: "Five common commercial drafting mistakes" },
      excerpt: { ar: "من بند التحكيم الغامض إلى غياب تعريف الإخلال الجوهري، أخطاء تكلّف الشركات أكثر مما تتوقع.",
                 en: "From a vague arbitration clause to an undefined material breach — mistakes that cost more than expected." },
      body: { ar: "راجعت خلال تدريبي عشرات العقود، وتتكرر فيها خمسة أخطاء.\n\nأولاً: بند تحكيم بلا مقر ولا لغة ولا عدد محكمين — فيصير النزاع على البند نفسه.\n\nثانياً: «الإخلال الجوهري» بلا تعريف، فيُترك تقديره للقاضي.\n\nثالثاً: القوة القاهرة منسوخة دون مراجعة، ولا تشمل ما حدث فعلاً.\n\nرابعاً: غياب بند السرية في عقود يُتبادل فيها معلومات حساسة.\n\nخامساً: عدم تحديد القانون الواجب التطبيق في العقود العابرة للحدود.",
              en: "Reviewing dozens of contracts during my training, five mistakes keep recurring.\n\nFirst: an arbitration clause with no seat, language or number of arbitrators — so the dispute becomes about the clause itself.\n\nSecond: 'material breach' left undefined, handing the judgement to the court.\n\nThird: force majeure copied without review, not covering what actually happened.\n\nFourth: no confidentiality clause where sensitive information changes hands.\n\nFifth: no governing law named in cross-border contracts." } }
  ];

  var COMMENTS = [
    { id: "c-1", articleId: "a-4", authorId: "u-munira", at: 1,
      body: { ar: "شرح واضح جداً. سؤالي: هل تسري المادة 77 على العقد محدد المدة أيضاً؟",
              en: "Very clear. My question: does Article 77 apply to fixed-term contracts too?" } },
    { id: "c-2", articleId: "a-4", authorId: "u-faisal", at: 2,
      body: { ar: "نعم، لكن التعويض فيها يكون أجر المدة المتبقية لا خمسة عشر يوماً عن كل سنة.",
              en: "Yes, but there the compensation is the wages for the remaining term, not fifteen days per year." } },
    { id: "c-3", articleId: "a-1", authorId: "u-fahad", at: 3,
      body: { ar: "هل هذا يشمل الشركات ذات المسؤولية المحدودة أم المساهمة فقط؟",
              en: "Does this cover limited liability companies or only joint-stock ones?" } },
    { id: "c-4", articleId: "a-3", authorId: "u-jaid", at: 4,
      body: { ar: "نقطة اتفاقيات نقل الملكية مع المطورين المستقلين مهمة جداً وتُغفل كثيراً.",
              en: "The point about assignment agreements with freelance developers is critical and often missed." } }
  ];

  var REVIEWS = [
    { id: "rv-1", targetId: "u-ahmed", authorId: "u-fahad", rating: 5, requestId: "r-9",
      date: { ar: "قبل أسبوع", en: "A week ago" },
      body: { ar: "شرح لي الخيارات القانونية بلغة مفهومة ووفّر عليّ دعوى لم أكن بحاجة لها.",
              en: "He explained my options in plain language and spared me a claim I did not need." } },
    { id: "rv-2", targetId: "u-sara", authorId: "u-munira", rating: 5, requestId: "r-9",
      date: { ar: "قبل أسبوعين", en: "Two weeks ago" },
      body: { ar: "دقيقة في المواعيد، والمخرجات وصلتني مكتوبة وموثقة في حسابي.",
              en: "Punctual, and the output arrived written up and documented in my account." } },
    { id: "rv-3", targetId: "u-mohammed", authorId: "u-fahad", rating: 5, requestId: "r-10",
      date: { ar: "قبل شهر", en: "A month ago" },
      body: { ar: "مراجعة ممتازة لعقد الإيجار، مع ملاحظات عملية قابلة للتطبيق فوراً.",
              en: "An excellent lease review, with practical notes we could apply immediately." } },
    { id: "rv-4", targetId: "u-layan", authorId: "u-sara", rating: 5,
      date: { ar: "قبل أسبوع", en: "A week ago" },
      body: { ar: "تسلّم قبل الموعد دائماً، وصياغتها تحتاج تعديلاً يسيراً.",
              en: "Always delivers early, and her drafting needs only light editing." } }
  ];

  var ENDORSEMENTS = [
    { id: "end-1", internId: "u-layan", lawyerId: "u-sara", hours: 52,
      date: { ar: "أكتوبر 2023", en: "October 2023" },
      note: { ar: "أنجزت أكثر من أربعين مهمة قانونية بإشرافي بمستوى يفوق مرحلتها.",
              en: "Completed over forty supervised legal tasks at a standard beyond her stage." } }
  ];

  global.SEED = {
    specialties: SPECIALTIES,
    cities: CITIES,
    serviceTypes: SERVICE_TYPES,
    users: USERS,
    services: SERVICES,
    requests: REQUESTS,
    articles: ARTICLES,
    comments: COMMENTS,
    reviews: REVIEWS,
    endorsements: ENDORSEMENTS
  };
})(window);
