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
  /* ---------- what a lawyer actually does ----------
     These used to be delivery channels — "phone consultation", "video
     consultation" — which made the catalogue a list of ways to talk rather
     than a list of legal work, and made the price band answer the wrong
     question. A statement of claim is a statement of claim whether it is
     discussed by voice or delivered as a file.

     So a category is the WORK, the platform sets its band, and the channels a
     lawyer offers on it are theirs to choose from the ones the work allows. */
  var CHANNELS = [
    { id: "voice", icon: "phone", live: true,
      title: { ar: "صوت", en: "Voice" } },
    { id: "video", icon: "video", live: true,
      title: { ar: "فيديو", en: "Video" } },
    { id: "text",  icon: "chat",  live: false,
      title: { ar: "كتابة", en: "In writing" } }
  ];

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var SERVICE_TYPES = [
    /* Free, and priced at nothing at both ends — the same row migration 020
       writes into service_types and price_bands. It was missing here, so the
       demo and the real database disagreed about what the platform offers:
       everything below was testable and this one was not, which is why the
       band of nothing to nothing was only ever hit in production. */
    { id: "free_screening", icon: "search", minPrice: 0, maxPrice: 0, sort: 5,
      channels: ["text", "voice"],
      title: { ar: "جلسة فرز وتحليل قضية", en: "Case screening and analysis" },
      meta:  { ar: "نظرة أولى مجانية: هل لديك قضية، وما الطريق أمامها.",
               en: "A free first look: whether you have a case, and what the road looks like." } },
    { id: "consult", icon: "chat", minPrice: 80, maxPrice: 500,
      channels: ["voice", "video", "text"],
      title: { ar: "استشارة قانونية", en: "Legal consultation" },
      meta:  { ar: "رأي في مسألة قائمة", en: "An opinion on a live question" } },
    { id: "claim", icon: "gavel", minPrice: 400, maxPrice: 3000,
      channels: ["text", "voice", "video"],
      title: { ar: "صحيفة دعوى", en: "Statement of claim" },
      meta:  { ar: "إعداد الدعوى وقيدها", en: "Preparing and filing the claim" } },
    { id: "memo", icon: "file-text", minPrice: 300, maxPrice: 2500,
      channels: ["text", "voice", "video"],
      title: { ar: "مذكرة قانونية", en: "Legal memorandum" },
      meta:  { ar: "رد أو دفاع مكتوب", en: "A written reply or defence" } },
    { id: "contract", icon: "briefcase", minPrice: 300, maxPrice: 4000,
      channels: ["text", "voice", "video"],
      title: { ar: "صياغة عقد", en: "Contract drafting" },
      meta:  { ar: "عقد جديد بشروطك", en: "A new contract on your terms" } },
    { id: "review", icon: "eye", minPrice: 150, maxPrice: 1200,
      channels: ["text", "voice", "video"],
      title: { ar: "مراجعة مستند", en: "Document review" },
      meta:  { ar: "قراءة وملاحظات", en: "Read, with notes" } },
    { id: "represent", icon: "scale", minPrice: 1000, maxPrice: 20000,
      channels: ["voice", "video", "text"],
      title: { ar: "ترافع وتمثيل", en: "Representation" },
      meta:  { ar: "المتابعة أمام الجهة المختصة", en: "Carried before the competent body" } }
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

    { id: "u-rania", roles: ["lawyer"], activeRole: "lawyer", status: "pending",
      name: { ar: "رانية الحربي", en: "Rania Al-Harbi" },
      title: { ar: "محامية", en: "Lawyer" },
      email: "rania@sanad.sa", city: "jeddah", years: 4, completed: 0, responseHours: 12,
      seedRating: 0, seedReviews: 0, specialties: ["family", "labour"],
      licence: { number: "8842", authority: { ar: "وزارة العدل", en: "Ministry of Justice" }, expiry: "2029-09-01" },
      bio: { ar: "محامية حديثة القيد، تنتظر اعتماد رخصتها للظهور في الدليل.",
             en: "A newly admitted lawyer waiting for her licence to be checked before she is listed." } },

    /* --- the platform's own side of the desk --- */
    { id: "u-staff", roles: ["staff"], activeRole: "staff", status: "verified",
      name: { ar: "إدارة المنصة", en: "Platform staff" },
      title: { ar: "مراجعة واعتماد", en: "Review & approval" },
      email: "staff@sanad.sa", city: "riyadh" },

    /* --- clients --- */
    { id: "u-fahad", roles: ["client"], activeRole: "client", status: "verified",
      name: { ar: "فهد العتيبي", en: "Fahad Al-Otaibi" },
      email: "fahad@example.com", city: "riyadh" },
    { id: "u-munira", roles: ["client"], activeRole: "client", status: "verified",
      name: { ar: "منيرة العنزي", en: "Munira Al-Anazi" },
      email: "munira@example.com", city: "jeddah" }
  ];

  /* ---------- services each lawyer publishes, priced inside the band ---------- */
  function svc(id, ownerId, typeId, price, channels) {
    return { id: id, ownerId: ownerId, typeId: typeId, price: price, active: true,
             channels: channels || (byId(SERVICE_TYPES, typeId) || {}).channels || ["text"] };
  }
  /* Each lawyer's own catalogue: the work, their price inside the platform's
     band, and the channels they will take it through. */
  var SERVICES = [
    svc("s-1",  "u-ahmed", "consult",   250, ["voice", "video", "text"]),
    svc("s-2",  "u-ahmed", "contract",  900, ["text", "video"]),
    svc("s-3",  "u-ahmed", "memo",      750, ["text"]),
    svc("s-4",  "u-ahmed", "review",    300, ["text", "voice"]),
    svc("s-5",  "u-ahmed", "represent", 4500, ["voice", "video", "text"]),
    svc("s-6",  "u-sara", "consult",    180, ["voice", "text"]),
    svc("s-7",  "u-sara", "claim",      1200, ["text", "voice"]),
    svc("s-8",  "u-sara", "review",     220, ["text"]),
    svc("s-9",  "u-sara", "contract",   700, ["text"]),
    svc("s-10", "u-mohammed", "consult", 400, ["video", "voice"]),
    svc("s-11", "u-mohammed", "represent", 8000, ["voice", "video", "text"]),
    svc("s-12", "u-mohammed", "memo",   1100, ["text"]),
    svc("s-13", "u-khalid", "consult",  320, ["voice", "video"]),
    svc("s-14", "u-khalid", "claim",    1600, ["text", "video"]),
    svc("s-15", "u-noura", "consult",   150, ["text", "voice"]),
    svc("s-16", "u-noura", "review",    200, ["text"]),
    svc("s-17", "u-noura", "contract",  600, ["text"]),
    svc("s-18", "u-faisal", "consult",  120, ["voice", "text"]),
    svc("s-19", "u-faisal", "review",   170, ["text"]),
    svc("s-20", "u-faisal", "memo",     450, ["text"])
  ];
  /* ---------- requests already in flight ---------- */
  var REQUESTS = [
    { id: "r-1", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "review", channel: "text", price: 99,
      status: "drafted", ai: true, doc: "employment", hours: 4,
      title: { ar: "عقد عمل لموظف تسويق", en: "Employment contract, marketing hire" },
      brief: { ar: "راتب 9,000 ريال، فترة تجربة 90 يوماً.", en: "SAR 9,000 salary, 90-day probation." },
      daysAgo: 0, ago: { ar: "منذ 12 دقيقة", en: "12 minutes ago" } },
    { id: "r-2", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "review", channel: "text", price: 89,
      status: "drafted", ai: true, doc: "demand", hours: 4,
      title: { ar: "إنذار بالمطالبة بمبلغ", en: "Formal demand for payment" },
      brief: { ar: "45,000 ريال مستحقة منذ ثلاثة أشهر.", en: "SAR 45,000 outstanding for three months." },
      daysAgo: 0, ago: { ar: "منذ ساعة", en: "An hour ago" } },
    { id: "r-3", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "review", channel: "text", price: 79,
      status: "new", ai: true, doc: "nda", hours: 3,
      title: { ar: "اتفاقية عدم إفشاء", en: "Non-disclosure agreement" },
      brief: { ar: "مع مطوّر مستقل لمدة سنتين.", en: "With a freelance developer, two-year term." },
      daysAgo: 0, ago: { ar: "منذ 5 دقائق", en: "5 minutes ago" } },
    { id: "r-4", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "consult", channel: "text", price: 100,
      status: "new", ai: true, hours: 3,
      title: { ar: "استشارة مكتوبة — نهاية الخدمة", en: "Written query — end-of-service" },
      brief: { ar: "استقالة بعد 4 سنوات، ما مستحقاتي؟", en: "Resigning after 4 years — what am I owed?" },
      daysAgo: 0, ago: { ar: "منذ 3 ساعات", en: "3 hours ago" } },
    { id: "r-5", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "contract", channel: "text", price: 500,
      status: "new", ai: false, hours: 8,
      title: { ar: "عقد شراكة تجارية", en: "Commercial partnership agreement" },
      brief: { ar: "ثلاثة شركاء، حصص متفاوتة، وبند خروج.", en: "Three partners, uneven shares, exit clause." },
      daysAgo: 1, ago: { ar: "أمس", en: "Yesterday" } },
    { id: "r-6", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "contract", channel: "text", price: 650,
      status: "new", ai: false, hours: 10,
      title: { ar: "مراجعة عقد مقاولة", en: "Construction contract review" },
      brief: { ar: "مشروع بقيمة 8 ملايين، مراجعة بنود الغرامات.", en: "SAR 8m project; review the penalty clauses." },
      daysAgo: 1, ago: { ar: "أمس", en: "Yesterday" } },
    { id: "r-7", clientId: "u-fahad", lawyerId: "u-ahmed", typeId: "consult", channel: "voice", price: 150,
      status: "scheduled", ai: false, hours: 1,
      title: { ar: "استشارة هاتفية", en: "Phone consultation" },
      brief: { ar: "نزاع إيجاري مع المالك.", en: "Tenancy dispute with the landlord." },
      daysAgo: 0, ago: { ar: "اليوم 14:00", en: "Today 14:00" } },
    { id: "r-8", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "consult", channel: "video", price: 300,
      status: "scheduled", ai: false, hours: 1,
      title: { ar: "استشارة فيديو", en: "Video consultation" },
      brief: { ar: "مراجعة مستندات قبل جلسة المحكمة.", en: "Document review ahead of a hearing." },
      daysAgo: -1, ago: { ar: "غداً 11:30", en: "Tomorrow 11:30" } },
    /* delivered history, so "past requests" is not empty on first visit */
    { id: "r-9", clientId: "u-fahad", lawyerId: "u-sara", typeId: "consult", channel: "text", price: 80,
      status: "completed", ai: false, hours: 3,
      title: { ar: "استشارة حول حضانة", en: "Custody consultation" },
      brief: { ar: "ترتيب الزيارة بعد الطلاق.", en: "Visitation arrangements after divorce." },
      daysAgo: 14, ago: { ar: "قبل أسبوعين", en: "Two weeks ago" } },
    { id: "r-10", clientId: "u-fahad", lawyerId: "u-mohammed", typeId: "contract", channel: "text", price: 650,
      status: "completed", ai: false, hours: 9,
      title: { ar: "مراجعة عقد إيجار تجاري", en: "Commercial lease review" },
      brief: { ar: "محل تجاري في الدمام، مدة خمس سنوات.", en: "Retail unit in Dammam, five-year term." },
      daysAgo: 34, ago: { ar: "الشهر الماضي", en: "Last month" } },

    /* work already routed to a trainee, so their side is not empty on arrival */
    { id: "r-11", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "contract", channel: "text", price: 420,
      status: "with_intern", assignedTo: "u-jaid", ai: false, hours: 6,
      title: { ar: "مذكرة بحث عن أحكام الوكالة", en: "Research memo on agency rulings" },
      brief: { ar: "جمع السوابق القضائية في نزاع وكالة تجارية.", en: "Collect the precedents in a commercial agency dispute." },
      daysAgo: 2, ago: { ar: "منذ يومين", en: "Two days ago" } },
    { id: "r-12", clientId: "u-fahad", lawyerId: "u-sara", typeId: "consult", channel: "text", price: 90,
      status: "with_intern", assignedTo: "u-layan", ai: false, hours: 4,
      title: { ar: "تلخيص لائحة اعتراضية", en: "Summary of an appeal brief" },
      brief: { ar: "تلخيص اللائحة في صفحتين قبل الجلسة.", en: "Two-page summary of the brief before the hearing." },
      daysAgo: 1, ago: { ar: "أمس", en: "Yesterday" } },
    { id: "r-13", clientId: "u-munira", lawyerId: "u-ahmed", typeId: "contract", channel: "text", price: 380,
      status: "delivered", assignedTo: "u-jaid", ai: false, hours: 5,
      title: { ar: "صياغة إنذار عدلي", en: "Drafting a notarised notice" },
      brief: { ar: "إنذار بإخلاء عقار مؤجر.", en: "Notice to vacate a leased property." },
      daysAgo: 7, ago: { ar: "الأسبوع الماضي", en: "Last week" } },

    /* other lawyers carry live work too, so every signed-in lawyer has a desk */
    { id: "r-14", clientId: "u-fahad", lawyerId: "u-sara", typeId: "consult", channel: "voice", price: 120,
      status: "scheduled", ai: false, hours: 1,
      title: { ar: "استشارة هاتفية — تركة", en: "Phone consultation — estate" },
      brief: { ar: "قسمة تركة بين خمسة ورثة.", en: "Dividing an estate among five heirs." },
      daysAgo: -1, ago: { ar: "غداً 09:30", en: "Tomorrow 09:30" } },
    { id: "r-15", clientId: "u-munira", lawyerId: "u-sara", typeId: "review", channel: "text", price: 79,
      status: "drafted", ai: true, doc: "demand", hours: 3,
      title: { ar: "خطاب مطالبة بأجرة متأخرة", en: "Letter claiming unpaid rent" },
      brief: { ar: "ثلاثة أشهر متأخرة عن مستأجر.", en: "Three months overdue from a tenant." },
      daysAgo: 0, ago: { ar: "منذ 40 دقيقة", en: "40 minutes ago" } },
    { id: "r-16", clientId: "u-fahad", lawyerId: "u-mohammed", typeId: "consult", channel: "video", price: 400,
      status: "new", ai: false, hours: 2,
      title: { ar: "استشارة فيديو — عقار", en: "Video consultation — property" },
      brief: { ar: "شراء أرض بمخطط غير معتمد.", en: "Buying land on an unapproved plan." },
      daysAgo: 0, ago: { ar: "منذ ساعتين", en: "Two hours ago" } }
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

  /* ------------------------------------------------------------------------
     Content that is authored, not relational: the assistant's knowledge base
     and draft templates, and the copy the About page renders.
     ------------------------------------------------------------------------ */

  var DRAFT_BODIES = {
    employment: {
      ar: "عقد عمل\n\nأولاً: طرفا العقد\nالطرف الأول (صاحب العمل): ...\nالطرف الثاني (العامل): ...\n\nثانياً: طبيعة العمل ومدته\nيلتزم الطرف الثاني بالعمل لدى الطرف الأول بوظيفة (أخصائي تسويق)، ومدة العقد سنة ميلادية تبدأ من تاريخ المباشرة، وتتجدد تلقائياً ما لم يخطر أحد الطرفين الآخر بخلاف ذلك قبل ثلاثين يوماً من انتهائها.\n\nثالثاً: فترة التجربة\nيخضع الطرف الثاني لفترة تجربة مدتها تسعون يوماً وفق المادة (53) من نظام العمل، لا تدخل ضمنها إجازات العيدين والإجازة المرضية.\n\nرابعاً: الأجر\nيستحق الطرف الثاني أجراً شهرياً قدره (9,000) تسعة آلاف ريال، يُصرف في نهاية كل شهر ميلادي عبر نظام حماية الأجور.\n\nخامساً: ساعات العمل\nثماني ساعات يومياً بما لا يتجاوز ثمانياً وأربعين ساعة أسبوعياً، وفق المادة (98) من نظام العمل.\n\nسادساً: إنهاء العقد\nيخضع إنهاء هذا العقد لأحكام المادتين (75) و(77) من نظام العمل.",
      en: "EMPLOYMENT CONTRACT\n\n1. Parties\nFirst party (employer): ...\nSecond party (employee): ...\n\n2. Role and term\nThe employee shall serve as Marketing Specialist for a term of one calendar year from the start date, renewing automatically unless either party gives thirty days' notice before expiry.\n\n3. Probation\nA probationary period of ninety days applies under Article 53 of the Labour Law, excluding Eid holidays and sick leave.\n\n4. Pay\nA monthly salary of SAR 9,000, paid at the end of each calendar month through the Wage Protection System.\n\n5. Working hours\nEight hours daily, not exceeding forty-eight hours weekly, under Article 98 of the Labour Law.\n\n6. Termination\nTermination is governed by Articles 75 and 77 of the Labour Law."
    },
    demand: {
      ar: "إنذار بالمطالبة بمبلغ\n\nالمرسل إليه: ...\nالتاريخ: ...\n\nبالإشارة إلى التعامل القائم بيننا بموجب (الفاتورة/العقد) رقم (...) بتاريخ (...)، فإن بذمتكم مبلغاً وقدره (45,000) خمسة وأربعون ألف ريال، مستحق الأداء منذ ثلاثة أشهر ولم يُسدَّد حتى تاريخه رغم المطالبات الودية.\n\nوعليه، فإننا ننذركم بسداد المبلغ كاملاً خلال (خمسة عشر) يوماً من تاريخ تسلمكم هذا الإنذار.\n\nوفي حال عدم السداد خلال المهلة المذكورة، فسنضطر آسفين إلى اتخاذ الإجراءات النظامية، بما في ذلك رفع الدعوى والمطالبة بالمبلغ والتعويض عن الضرر والمصاريف.\n\nهذا إنذار، وما بعده إجراء.",
      en: "FORMAL DEMAND FOR PAYMENT\n\nTo: ...\nDate: ...\n\nFurther to our dealings under invoice/contract no. (...) dated (...), an amount of SAR 45,000 remains due and has been outstanding for three months despite amicable requests for payment.\n\nWe therefore formally demand payment in full within fifteen (15) days of your receipt of this notice.\n\nShould payment not be made within that period, we will regrettably proceed with legal action, including filing a claim for the amount, damages and costs.\n\nThis is a formal notice; action will follow."
    },
    nda: {
      ar: "اتفاقية عدم إفشاء\n\nالبند الأول: تعريف المعلومات السرية\nكل معلومة تقنية أو تجارية أو مالية يفصح عنها أحد الطرفين للآخر، كتابةً أو شفاهةً، بما في ذلك الشيفرة المصدرية وقوائم العملاء والخطط التسويقية.\n\nالبند الثاني: الالتزام\nيلتزم الطرف المتلقي بعدم إفشاء المعلومات السرية أو استخدامها لغير الغرض المتفق عليه، وباتخاذ العناية ذاتها التي يتخذها لحماية معلوماته.\n\nالبند الثالث: المدة\nيسري هذا الالتزام طوال مدة التعاقد ولمدة سنتين من تاريخ انتهائه.\n\nالبند الرابع: الاستثناءات\nلا يشمل الالتزام المعلومات المتاحة للعموم دون إخلال، أو التي يوجب نظام أو أمر قضائي الإفصاح عنها.",
      en: "NON-DISCLOSURE AGREEMENT\n\n1. Definition of confidential information\nAny technical, commercial or financial information disclosed by either party to the other, in writing or orally, including source code, client lists and marketing plans.\n\n2. Undertaking\nThe receiving party shall not disclose the confidential information or use it for any purpose other than the agreed one, and shall apply the same care it applies to its own information.\n\n3. Term\nThis undertaking runs for the term of the engagement and for two years after it ends.\n\n4. Carve-outs\nThe undertaking does not cover information already public without breach, or which a law or court order requires be disclosed."
    }
  };

  var REGULATIONS = [
    { id: "labour",   on: true,  ar: "نظام العمل ولائحته التنفيذية", en: "Labour Law & implementing regulations" },
    { id: "civil",    on: true,  ar: "نظام المعاملات المدنية",        en: "Civil Transactions Law" },
    { id: "companies",on: true,  ar: "نظام الشركات",                  en: "Companies Law" },
    { id: "status",   on: false, ar: "نظام الأحوال الشخصية",          en: "Personal Status Law" },
    { id: "execution",on: false, ar: "نظام التنفيذ",                  en: "Enforcement Law" },
    { id: "ecommerce",on: false, ar: "نظام التجارة الإلكترونية",      en: "E-Commerce Law" },
    { id: "ip",       on: false, ar: "أنظمة الملكية الفكرية",         en: "Intellectual property laws" },
    { id: "data",     on: false, ar: "نظام حماية البيانات الشخصية",   en: "Personal Data Protection Law" }
  ];

  var LAWYER_FILES = [
    { id: "f-1", kind: "template", size: "48 KB", ar: "نموذج عقد عمل — مكتبي",        en: "Employment contract template — my office" },
    { id: "f-2", kind: "template", size: "31 KB", ar: "نموذج اتفاقية عدم إفشاء",       en: "NDA template" },
    { id: "f-3", kind: "precedent",size: "112 KB",ar: "مذكرة دفاع — دعوى عمالية سابقة", en: "Defence memo — earlier labour claim" },
    { id: "f-4", kind: "template", size: "27 KB", ar: "نموذج إنذار بإخلاء مأجور",       en: "Notice to vacate template" },
    { id: "f-5", kind: "precedent",size: "64 KB", ar: "صيغة تسوية ودية معتمدة",        en: "Approved settlement wording" }
  ];

  var DOC_TYPES = [
    { id: "employment", price: 99,  full: 500, hours: 4, specialty: "labour",
      title: { ar: "عقد عمل", en: "Employment contract" },
      body:  { ar: "عقد عمل محدد أو غير محدد المدة، متوافق مع نظام العمل السعودي.",
               en: "A fixed- or open-term employment contract compliant with the Saudi Labour Law." } },
    { id: "nda", price: 79, full: 400, hours: 3, specialty: "commercial",
      title: { ar: "اتفاقية عدم إفشاء (NDA)", en: "Non-disclosure agreement (NDA)" },
      body:  { ar: "اتفاقية سرية ثنائية أو أحادية الطرف مع تحديد مدة الالتزام.",
               en: "A mutual or one-way confidentiality agreement with a defined term." } },
    { id: "resignation", price: 49, full: 250, hours: 2, specialty: "labour",
      title: { ar: "خطاب استقالة أو إنهاء خدمة", en: "Resignation or termination letter" },
      body:  { ar: "خطاب مصاغ نظامياً يحفظ حقوقك ويحدد تاريخ آخر يوم عمل.",
               en: "A properly worded letter that protects your rights and fixes the last working day." } },
    { id: "demand", price: 89, full: 450, hours: 4, specialty: "commercial",
      title: { ar: "إنذار بالمطالبة بمبلغ", en: "Formal demand for payment" },
      body:  { ar: "إنذار رسمي بالسداد قبل رفع الدعوى، مع تحديد المهلة والأثر النظامي.",
               en: "A formal pre-litigation demand, stating the deadline and the legal consequence." } },
    { id: "lease", price: 99, full: 500, hours: 5, specialty: "realestate",
      title: { ar: "عقد إيجار", en: "Lease agreement" },
      body:  { ar: "عقد إيجار سكني أو تجاري مع بنود الصيانة والإخلاء.",
               en: "A residential or commercial lease covering maintenance and termination." } },
    { id: "poa", price: 69, full: 300, hours: 2, specialty: "commercial",
      title: { ar: "صيغة وكالة", en: "Power of attorney wording" },
      body:  { ar: "صياغة نطاق الوكالة وحدود الصلاحيات قبل توثيقها.",
               en: "Wording for the scope of the mandate and its limits, ready for notarisation." } }
  ];

  var ASSISTANT = [
    { id: "nda",
      q: { ar: "كيف أصيغ بند سرية في عقد عمل؟", en: "How do I word a confidentiality clause in an employment contract?" },
      a: { ar: "بند السرية الجيد يحدد ثلاثة أشياء بوضوح: ما الذي يُعد سراً (تعريف المعلومة السرية)، ومدى الالتزام أثناء العلاقة وبعد انتهائها، والاستثناءات كالمعلومات المتاحة للعموم أو المطلوبة بأمر نظامي. اجعل المدة محددة برقم — «ثلاث سنوات من تاريخ انتهاء العقد» أوضح من «إلى الأبد» وأقرب للقبول أمام القضاء. وتجنّب الصياغات المطلقة التي تمنع الموظف من العمل في المجال كلياً، لأنها قد تُقرأ كشرط تقييد مبالغ فيه.",
           en: "A solid confidentiality clause pins down three things: what counts as confidential (a definition), how long the duty runs both during and after the relationship, and the carve-outs — information already public, or disclosure required by law. Put a number on the term: \u2018three years from the end of the contract\u2019 reads better before a court than \u2018in perpetuity\u2019. Avoid absolute wording that bars the employee from the field entirely; that tends to be read as an excessive restraint." } },
    { id: "termination",
      q: { ar: "ما الفرق بين المادة 75 والمادة 77 في نظام العمل؟", en: "What is the difference between Articles 75 and 77 of the Labour Law?" },
      a: { ar: "المادة 75 تعالج إنهاء العقد غير محدد المدة بإشعار مسبق من أي من الطرفين — أي إنهاء مشروع متى استوفى مدة الإشعار. أما المادة 77 فتعالج ما يحدث إذا أُنهي العقد لسبب غير مشروع، وتقرر تعويضاً يُتفق عليه في العقد، وإن لم يُتفق فأجر خمسة عشر يوماً عن كل سنة للعقد غير محدد المدة، وأجر المدة المتبقية للعقد محدد المدة. باختصار: 75 عن كيفية الإنهاء، و77 عن ثمنه إذا كان بلا مبرر.",
           en: "Article 75 covers ending an open-ended contract with prior notice from either side — lawful termination, provided the notice period is served. Article 77 covers what happens when a contract is ended without a valid reason: compensation as agreed in the contract, and failing that, fifteen days' wages per year of service for an open-ended contract, or the wages for the remaining term of a fixed-term one. In short: 75 is about how you end it, 77 is about what it costs when there was no good reason." } },
    { id: "company",
      q: { ar: "ما الخطوات النظامية لتأسيس شركة ذات مسؤولية محدودة؟", en: "What are the steps to set up a limited liability company?" },
      a: { ar: "المسار العملي: حجز الاسم التجاري، ثم إعداد عقد التأسيس وتوثيقه، ثم إصدار السجل التجاري، ثم التسجيل لدى الزكاة والضريبة والجمارك والتأمينات الاجتماعية، وأخيراً فتح الحساب البنكي للشركة. أهم ما يُغفل عادة هو عقد التأسيس نفسه: حدّد فيه آلية اتخاذ القرار، وكيفية تقييم الحصة عند خروج شريك، وآلية فض النزاع. البنود هذه رخيصة اليوم وباهظة إن تُركت للاحقاً.",
           en: "The practical path: reserve the trade name, draft and notarise the articles of association, issue the commercial registration, register with ZATCA and the social insurance authority, then open the company bank account. What most founders skip is the articles themselves: set out how decisions get made, how a departing partner's share is valued, and how disputes are resolved. Those clauses are cheap now and expensive later." } },
    { id: "property",
      q: { ar: "ما الذي أتحقق منه قبل شراء عقار؟", en: "What should I check before buying a property?" },
      a: { ar: "ابدأ بالصك: تأكد من مطابقة بياناته للواقع (المساحة والحدود والأطوال)، ومن خلوه من الرهن أو الحجز عبر الاستعلام النظامي. ثم تحقق من مخطط البلدية ومن أن الاستخدام المصرح به يطابق غرضك، ومن عدم وجود نزع ملكية مخطط له. وإذا كان البيع على الخارطة، فتأكد من ترخيص المشروع ومن أن الدفعات تمر عبر حساب الضمان. اطلب من البائع إفادة بخلو العقار من الالتزامات المالية قبل التوقيع.",
           en: "Start with the title deed: check that its details match reality (area, boundaries, dimensions) and that it is free of mortgage or attachment via the official search. Then check the municipal plan, that the permitted use matches your purpose, and that no expropriation is planned. For an off-plan sale, confirm the project's licence and that payments run through the escrow account. Ask the seller for written confirmation that the property carries no outstanding financial obligations before you sign." } }
  ];

  var FAQ = [
    { q: { ar: "هل المحامون على المنصة مرخصون رسمياً؟", en: "Are the lawyers on the platform officially licensed?" },
      a: { ar: "نعم. نتحقق من رقم ترخيص كل محامٍ لدى الجهة المختصة قبل تفعيل ملفه، ونعيد التحقق سنوياً.",
           en: "Yes. We verify each lawyer's licence number with the competent authority before activating their profile, and re-verify annually." } },
    { q: { ar: "كيف يتم تحديد سعر الاستشارة؟", en: "How is the consultation price set?" },
      a: { ar: "يحدد كل محامٍ أسعاره حسب نوع الخدمة ومدتها، وتظهر لك كاملة قبل الدفع دون أي رسوم إضافية.",
           en: "Each lawyer sets their own rates by service type and duration. You see the full price before paying, with no add-ons." } },
    { q: { ar: "ماذا لو لم تتم الاستشارة في موعدها؟", en: "What if the consultation does not take place?" },
      a: { ar: "تبقى الأتعاب محفوظة لدى المنصة حتى اكتمال الاستشارة. إذا لم تتم، يُعاد المبلغ كاملاً خلال ثلاثة أيام عمل.",
           en: "Fees are held by the platform until the consultation is complete. If it does not happen, you are refunded in full within three business days." } },
    { q: { ar: "هل يمكنني اختيار محامٍ في مدينة أخرى؟", en: "Can I choose a lawyer in another city?" },
      a: { ar: "بالتأكيد. معظم الاستشارات تتم عن بُعد عبر المكالمة أو الفيديو، ويمكنك اختيار أي محامٍ في المملكة.",
           en: "Certainly. Most consultations happen remotely by call or video, so you can choose any lawyer in the Kingdom." } },
    { q: { ar: "كيف أنضم كمحامٍ إلى سند؟", en: "How do I join Sanad as a lawyer?" },
      a: { ar: "أنشئ حساباً من صفحة دخول المحامين، وأرفق رقم الترخيص. يستغرق التحقق من يوم إلى ثلاثة أيام عمل.",
           en: "Create an account from the lawyer login page and attach your licence number. Verification takes one to three business days." } }
  ];

  var VALUES = [
    { icon: "scale",  title: { ar: "النزاهة", en: "Integrity" },
      body: { ar: "لا نرجّح مصلحة على أخرى، ولا نوصي بخدمة لا يحتاجها العميل.", en: "We favour no side, and never recommend a service a client does not need." } },
    { icon: "eye",    title: { ar: "الشفافية", en: "Transparency" },
      body: { ar: "السعر والمدة والمخرجات معروفة قبل الدفع، لا مفاجآت لاحقاً.", en: "Price, duration and deliverables are known before payment. No surprises." } },
    { icon: "lock",   title: { ar: "السرية", en: "Confidentiality" },
      body: { ar: "بيانات العميل وقضيته محمية بمعايير تشفير مصرفية.", en: "Client data and case details are protected to banking-grade encryption standards." } },
    { icon: "sparkle",title: { ar: "الإتقان", en: "Craft" },
      body: { ar: "نراجع جودة كل استشارة، ونستبعد من لا يلتزم بمعاييرنا.", en: "We review the quality of every consultation, and remove those who fall short." } }
  ];

  var TEAM = [
    { name: { ar: "د. أحمد المحمدي", en: "Dr. Ahmed Al-Mohammadi" }, role: { ar: "الرئيس التنفيذي", en: "Chief Executive Officer" } },
    { name: { ar: "سارة بنت طارق", en: "Sara bint Tariq" },       role: { ar: "رئيسة الشؤون القانونية", en: "Chief Legal Officer" } },
    { name: { ar: "نورة القحطاني", en: "Noura Al-Qahtani" },       role: { ar: "رئيسة المنتج", en: "Chief Product Officer" } },
    { name: { ar: "محمد الفهد", en: "Mohammed Al-Fahd" },          role: { ar: "رئيس شبكة المحامين", en: "Head of Lawyer Network" } }
  ];

  var STATS = [
    { value: "1,500+", valueEn: "1,500+", label: { ar: "استشارة منجزة", en: "Consultations delivered" } },
    { value: "240+", valueEn: "240+", label: { ar: "محامٍ معتمد", en: "Licensed lawyers" } },
    { value: "180+", valueEn: "180+", label: { ar: "مساعد ومتدرب قانوني", en: "Assistants & trainees" } },
    { value: "99%", valueEn: "99%", label: { ar: "نسبة رضا العملاء", en: "Client satisfaction" } }
  ];

  var REFERENCES = [
    { title: { ar: "نظام الشركات الجديد (1443هـ)", en: "The new Companies Law (1443 AH)" },
      note:  { ar: "النسخة المحدثة الصادرة عن وزارة التجارة.", en: "Updated edition issued by the Ministry of Commerce." } },
    { title: { ar: "لائحة حوكمة الشركات", en: "Corporate Governance Regulations" },
      note:  { ar: "الصادرة عن هيئة السوق المالية.", en: "Issued by the Capital Market Authority." } },
    { title: { ar: "نظام العمل ولائحته التنفيذية", en: "Labour Law & implementing regulations" },
      note:  { ar: "المرجع الأساسي لعلاقات العمل.", en: "The primary reference for employment relationships." } }
  ];

  var FEATURES = [
    { icon: "shield-check", rule: "navy",
      title: { ar: "محامون معتمدون", en: "Licensed lawyers" },
      body:  { ar: "نخبة من المحامين المرخصين من وزارة العدل ذوي الخبرة الواسعة في مختلف التخصصات.",
               en: "Ministry-licensed lawyers with deep experience across every practice area." } },
    { icon: "payments", rule: "gold",
      title: { ar: "أسعار شفافة", en: "Transparent pricing" },
      body:  { ar: "تكاليف واضحة ومعلومة مسبقاً دون رسوم خفية، لضمان راحة بالك.",
               en: "Clear costs known upfront, with no hidden fees." } },
    { icon: "file-text", rule: "navy",
      title: { ar: "عقود ذكية", en: "Smart contracts" },
      body:  { ar: "صياغة عقود قانونية محكمة ودقيقة باستخدام قوالب مراجعة من محامين ممارسين.",
               en: "Precise legal drafting built on templates reviewed by practising lawyers." } },
    { icon: "lock", rule: "gold",
      title: { ar: "خصوصية تامة", en: "Total confidentiality" },
      body:  { ar: "حماية كاملة لبياناتك وتفاصيل قضاياك بأعلى معايير الأمان والتشفير.",
               en: "Your data and case details are protected by the highest encryption standards." } }
  ];

  var STEPS = [
    { title: { ar: "ابحث واختر", en: "Search & choose" },
      body:  { ar: "حدد التخصص والمدينة والميزانية، وقارن بين المحامين حسب التقييم والخبرة.",
               en: "Set the practice area, city and budget, then compare lawyers by rating and experience." } },
    { title: { ar: "احجز الموعد", en: "Book a slot" },
      body:  { ar: "اختر نوع الاستشارة والوقت المناسب من التقويم المتاح مباشرة.",
               en: "Pick the consultation type and a time that suits you from the live calendar." } },
    { title: { ar: "ادفع بأمان", en: "Pay securely" },
      body:  { ar: "ادفع عبر بوابة مشفّرة، وتبقى الأتعاب محفوظة حتى اكتمال الاستشارة.",
               en: "Pay through an encrypted gateway; the fee is held until the consultation is complete." } },
    { title: { ar: "استشر واستلم", en: "Consult & receive" },
      body:  { ar: "تحدث مع المحامي عبر المكالمة أو المحادثة، واستلم مخرجاتك موثقة في حسابك.",
               en: "Talk to your lawyer by call or chat, and receive documented output in your account." } }
  ];

  var TESTIMONIALS = [
    { name: { ar: "عبدالعزيز الشمري", en: "Abdulaziz Al-Shammari" },
      role: { ar: "مؤسس شركة ناشئة", en: "Startup founder" }, rating: 5,
      body: { ar: "حصلت على مراجعة كاملة لعقد التأسيس خلال يومين، بسعر واضح من البداية ودون مفاوضات.",
              en: "I got a full review of our founders' agreement in two days, at a price that was clear from the start." } },
    { name: { ar: "منيرة العنزي", en: "Munira Al-Anazi" },
      role: { ar: "موظفة قطاع خاص", en: "Private-sector employee" }, rating: 5,
      body: { ar: "كنت مترددة في رفع قضية عمالية، والاستشارة الأولى وضّحت لي حقوقي بالضبط قبل أن أخطو أي خطوة.",
              en: "I hesitated to file a labour claim; the first consultation showed me exactly where I stood before I moved." } },
    { name: { ar: "شركة أبعاد للمقاولات", en: "Ab'ad Contracting" },
      role: { ar: "قطاع الإنشاءات", en: "Construction sector" }, rating: 4,
      body: { ar: "نتعامل مع سند بشكل دوري لمراجعة عقود المقاولات. السرعة والاحترافية جعلتها جزءاً من عملياتنا.",
              en: "We use Sanad routinely to review construction contracts. The speed and professionalism made it part of our process." } }
  ];

  global.SEED = {
    specialties: SPECIALTIES,
    cities: CITIES,
    serviceTypes: SERVICE_TYPES,
    channels: CHANNELS,
    users: USERS,
    services: SERVICES,
    requests: REQUESTS,
    articles: ARTICLES,
    comments: COMMENTS,
    reviews: REVIEWS,
    endorsements: ENDORSEMENTS,

    draftBodies: DRAFT_BODIES,
    regulations: REGULATIONS,
    lawyerFiles: LAWYER_FILES,
    docTypes: DOC_TYPES,
    assistant: ASSISTANT,
    faq: FAQ,
    values: VALUES,
    team: TEAM,
    stats: STATS,
    references: REFERENCES,
    features: FEATURES,
    steps: STEPS,
    testimonials: TESTIMONIALS
  };
})(window);
