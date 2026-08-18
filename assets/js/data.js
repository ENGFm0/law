/* ==========================================================================
   Content — every user-facing string carries both languages, so switching
   locale re-renders from the same source instead of loading a second site.
   ========================================================================== */
(function (global) {
  "use strict";

  var SPECIALTIES = [
    { id: "family",    ar: "أحوال شخصية",   en: "Family law" },
    { id: "commercial",ar: "تجاري وشركات",  en: "Commercial & corporate" },
    { id: "realestate",ar: "عقاري",         en: "Real estate" },
    { id: "labour",    ar: "عمالي",          en: "Labour" },
    { id: "criminal",  ar: "جنائي",          en: "Criminal" },
    { id: "ip",        ar: "ملكية فكرية",   en: "Intellectual property" },
    { id: "estates",   ar: "تركات",          en: "Estates & inheritance" },
    { id: "admin",     ar: "إداري",          en: "Administrative" }
  ];

  var CITIES = [
    { id: "riyadh", ar: "الرياض", en: "Riyadh" },
    { id: "jeddah", ar: "جدة",    en: "Jeddah" },
    { id: "dammam", ar: "الدمام", en: "Dammam" },
    { id: "makkah", ar: "مكة المكرمة", en: "Makkah" },
    { id: "madinah",ar: "المدينة المنورة", en: "Madinah" },
    { id: "khobar", ar: "الخبر",  en: "Khobar" }
  ];

  var CONSULT_TYPES = [
    { id: "call",     ar: "مكالمة هاتفية", en: "Phone call",   icon: "phone" },
    { id: "chat",     ar: "محادثة نصية",   en: "Text chat",    icon: "chat" },
    { id: "video",    ar: "استشارة فيديو", en: "Video call",   icon: "video" },
    { id: "contract", ar: "صياغة عقود",    en: "Contract drafting", icon: "file" }
  ];

  var LAWYERS = [
    {
      id: "ahmed-almohammadi", license: "4321", rating: 4.9, reviews: 120, years: 15,
      city: "riyadh", specialties: ["commercial", "realestate"], consults: ["call", "chat", "contract", "video"],
      price: 150, consultations: 500,
      name:  { ar: "د. أحمد عبدالله المحمدي", en: "Dr. Ahmed Abdullah Al-Mohammadi" },
      title: { ar: "محامي استئناف ومستشار قانوني", en: "Appellate lawyer & legal counsel" },
      short: { ar: "متخصص في القضايا التجارية وتأسيس الشركات وصياغة العقود المعقدة.",
               en: "Specialised in commercial disputes, company formation and complex contract drafting." },
      bio:   { ar: "محامٍ مرخص ومستشار قانوني ذو خبرة واسعة في القضايا التجارية والعمالية. عمل مستشاراً لعدد من الشركات الكبرى في المملكة، ويسعى دائماً لتقديم حلول قانونية مبتكرة وفعّالة تحمي مصالح موكليه.",
               en: "A licensed lawyer and legal counsel with deep experience in commercial and labour matters. He has advised several of the Kingdom's largest companies and consistently pursues practical, effective solutions that protect his clients' interests." },
      focus: [ { ar: "القانون التجاري", en: "Commercial law" }, { ar: "الشركات", en: "Corporate" },
               { ar: "العقود والمقاولات", en: "Contracts & construction" }, { ar: "القضايا العمالية", en: "Labour disputes" } ],
      education: [
        { degree: { ar: "ماجستير في القانون التجاري", en: "LL.M. in Commercial Law" }, place: { ar: "جامعة الملك سعود – 2010", en: "King Saud University – 2010" } },
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الإمام محمد بن سعود – 2007", en: "Imam Muhammad bin Saud University – 2007" } }
      ],
      career: [
        { role: { ar: "شريك مؤسس – مكتب المحمدي للمحاماة", en: "Founding partner – Al-Mohammadi Law Firm" },
          period: { ar: "2018 – الحاضر", en: "2018 – Present" },
          note: { ar: "إدارة فريق من المحامين والمستشارين، وتمثيل كبرى الشركات في القضايا التجارية المعقّدة.",
                  en: "Leads a team of lawyers and counsel, representing major corporates in complex commercial litigation." } },
        { role: { ar: "مستشار قانوني أول – شركة الاتصالات", en: "Senior legal counsel – Telecom company" },
          period: { ar: "2012 – 2018", en: "2012 – 2018" },
          note: { ar: "صياغة ومراجعة عقود التقنية والاتصالات، وتقديم المشورة للإدارة العليا.",
                  en: "Drafted and reviewed technology and telecom contracts, advising executive management." } }
      ]
    },
    {
      id: "sara-bint-tariq", license: "8765", rating: 4.8, reviews: 85, years: 8,
      city: "jeddah", specialties: ["family", "labour", "estates"], consults: ["call", "chat", "contract"],
      price: 120, consultations: 310,
      name:  { ar: "أ. سارة بنت طارق", en: "Sara bint Tariq" },
      title: { ar: "محامية ومستشارة قانونية", en: "Lawyer & legal consultant" },
      short: { ar: "خبرة واسعة في قضايا الأحوال الشخصية من طلاق ونفقة وحضانة، وتسوية النزاعات العمالية.",
               en: "Broad experience in family matters — divorce, alimony and custody — plus labour dispute resolution." },
      bio:   { ar: "محامية مرخصة تركز على قضايا الأسرة والتركات، وتؤمن بأن التسوية الودية تحمي العلاقات قبل أن تحمي الحقوق. قدّمت أكثر من 300 استشارة عبر منصة سند.",
               en: "A licensed lawyer focused on family and inheritance matters, who believes amicable settlement protects relationships before it protects rights. She has delivered over 300 consultations through Sanad." },
      focus: [ { ar: "الطلاق والحضانة", en: "Divorce & custody" }, { ar: "النفقة", en: "Alimony" },
               { ar: "قسمة التركات", en: "Estate division" }, { ar: "عقود العمل", en: "Employment contracts" } ],
      education: [
        { degree: { ar: "ماجستير في الأنظمة", en: "LL.M. in Law" }, place: { ar: "جامعة الملك عبدالعزيز – 2016", en: "King Abdulaziz University – 2016" } },
        { degree: { ar: "بكالوريوس شريعة وأنظمة", en: "LL.B. in Sharia & Law" }, place: { ar: "جامعة أم القرى – 2013", en: "Umm Al-Qura University – 2013" } }
      ],
      career: [
        { role: { ar: "مديرة قسم الأسرة – مكتب طارق للمحاماة", en: "Head of family practice – Tariq Law Office" },
          period: { ar: "2019 – الحاضر", en: "2019 – Present" },
          note: { ar: "الإشراف على ملفات الأحوال الشخصية والتمثيل أمام محاكم الأحوال.",
                  en: "Oversees family-law files and appears before the personal status courts." } },
        { role: { ar: "محامية مقيدة", en: "Associate lawyer" },
          period: { ar: "2014 – 2019", en: "2014 – 2019" },
          note: { ar: "الترافع في القضايا العمالية وتسوية نزاعات الأجور.",
                  en: "Litigated labour cases and settled wage disputes." } }
      ]
    },
    {
      id: "mohammed-alfahd", license: "2341", rating: 5.0, reviews: 210, years: 12,
      city: "dammam", specialties: ["realestate", "admin", "commercial"], consults: ["call", "chat", "contract", "video"],
      price: 200, consultations: 640,
      name:  { ar: "أ. محمد الفهد", en: "Mohammed Al-Fahd" },
      title: { ar: "مستشار عقاري ومنازعات", en: "Real estate & disputes counsel" },
      short: { ar: "خبير في نقل الملكية، منازعات المقاولات، والتحكيم العقاري داخل المملكة.",
               en: "Expert in title transfer, construction disputes and real-estate arbitration across the Kingdom." },
      bio:   { ar: "مستشار قانوني متخصص في السوق العقاري ومنازعات المقاولات، وله مساهمات في صياغة عقود التطوير العقاري للمشاريع الكبرى في المنطقة الشرقية.",
               en: "A legal counsel specialised in the real-estate market and construction disputes, with a track record drafting development agreements for major Eastern Province projects." },
      focus: [ { ar: "نقل الملكية", en: "Title transfer" }, { ar: "التطوير العقاري", en: "Property development" },
               { ar: "التحكيم", en: "Arbitration" }, { ar: "منازعات المقاولات", en: "Construction disputes" } ],
      education: [
        { degree: { ar: "ماجستير في التحكيم التجاري", en: "LL.M. in Commercial Arbitration" }, place: { ar: "جامعة الملك فهد – 2015", en: "King Fahd University – 2015" } },
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الدمام – 2011", en: "University of Dammam – 2011" } }
      ],
      career: [
        { role: { ar: "مستشار أول – مجموعة تطوير عقاري", en: "Senior counsel – Real-estate developer" },
          period: { ar: "2017 – الحاضر", en: "2017 – Present" },
          note: { ar: "مراجعة عقود التطوير والبيع على الخارطة والإشراف على المنازعات.",
                  en: "Reviews development and off-plan sale contracts and oversees disputes." } },
        { role: { ar: "محامٍ مترافع", en: "Litigator" },
          period: { ar: "2012 – 2017", en: "2012 – 2017" },
          note: { ar: "تمثيل ملاك وشركات في منازعات الملكية أمام المحاكم العامة.",
                  en: "Represented owners and companies in ownership disputes before the general courts." } }
      ]
    },
    {
      id: "khalid-abdulrahman", license: "5590", rating: 4.7, reviews: 96, years: 22,
      city: "riyadh", specialties: ["criminal", "admin"], consults: ["call", "video"],
      price: 250, consultations: 780,
      name:  { ar: "أ. خالد عبدالرحمن", en: "Khalid Abdulrahman" },
      title: { ar: "محامي جنائي وإداري", en: "Criminal & administrative lawyer" },
      short: { ar: "متخصص في الترافع في القضايا الجنائية الكبرى والقضايا الإدارية ضد الجهات الحكومية.",
               en: "Specialised in major criminal defence and administrative claims against government entities." },
      bio:   { ar: "سجل حافل بالنجاحات أمام المحكمة العليا وديوان المظالم، مع أكثر من عشرين عاماً في الترافع الجنائي والإداري.",
               en: "A strong record before the Supreme Court and the Board of Grievances, with over twenty years in criminal and administrative advocacy." },
      focus: [ { ar: "الدفاع الجنائي", en: "Criminal defence" }, { ar: "ديوان المظالم", en: "Board of Grievances" },
               { ar: "التظلمات الإدارية", en: "Administrative appeals" } ],
      education: [
        { degree: { ar: "دبلوم عالٍ في القضاء", en: "Higher diploma in judicial studies" }, place: { ar: "المعهد العالي للقضاء – 2005", en: "Higher Judicial Institute – 2005" } },
        { degree: { ar: "بكالوريوس شريعة", en: "B.A. in Sharia" }, place: { ar: "جامعة الإمام – 2001", en: "Imam University – 2001" } }
      ],
      career: [
        { role: { ar: "مؤسس – مكتب عبدالرحمن للمحاماة", en: "Founder – Abdulrahman Law Office" },
          period: { ar: "2010 – الحاضر", en: "2010 – Present" },
          note: { ar: "الترافع في القضايا الجنائية الكبرى أمام المحكمة العليا.",
                  en: "Leads major criminal defence work before the Supreme Court." } }
      ]
    },
    {
      id: "noura-alqahtani", license: "7712", rating: 4.9, reviews: 64, years: 9,
      city: "khobar", specialties: ["ip", "commercial"], consults: ["chat", "contract", "video"],
      price: 180, consultations: 240,
      name:  { ar: "أ. نورة القحطاني", en: "Noura Al-Qahtani" },
      title: { ar: "مستشارة ملكية فكرية وتقنية", en: "IP & technology counsel" },
      short: { ar: "تحمي العلامات التجارية والبرمجيات وتصيغ اتفاقيات الترخيص للشركات الناشئة.",
               en: "Protects trademarks and software, and drafts licensing agreements for startups." },
      bio:   { ar: "مستشارة قانونية تجمع بين القانون والتقنية، وتعمل مع الشركات الناشئة على حماية أصولها الرقمية وتنظيم علاقاتها التعاقدية مع المستثمرين.",
               en: "A counsel at the intersection of law and technology, working with startups to protect digital assets and structure investor relationships." },
      focus: [ { ar: "العلامات التجارية", en: "Trademarks" }, { ar: "حقوق المؤلف", en: "Copyright" },
               { ar: "اتفاقيات الترخيص", en: "Licensing" }, { ar: "خصوصية البيانات", en: "Data privacy" } ],
      education: [
        { degree: { ar: "ماجستير في قانون التقنية", en: "LL.M. in Technology Law" }, place: { ar: "جامعة الملك فهد – 2018", en: "King Fahd University – 2018" } },
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الدمام – 2014", en: "University of Dammam – 2014" } }
      ],
      career: [
        { role: { ar: "مستشارة قانونية – حاضنة أعمال تقنية", en: "Legal counsel – Tech incubator" },
          period: { ar: "2019 – الحاضر", en: "2019 – Present" },
          note: { ar: "دعم أكثر من 40 شركة ناشئة في تسجيل العلامات وصياغة اتفاقيات التأسيس.",
                  en: "Supported 40+ startups on trademark registration and founder agreements." } }
      ]
    },
    {
      id: "faisal-alotaibi", license: "3308", rating: 4.6, reviews: 141, years: 11,
      city: "jeddah", specialties: ["labour", "commercial"], consults: ["call", "chat"],
      price: 100, consultations: 420,
      name:  { ar: "أ. فيصل العتيبي", en: "Faisal Al-Otaibi" },
      title: { ar: "مستشار عمالي وحوكمة", en: "Labour & governance consultant" },
      short: { ar: "يساعد المنشآت على الالتزام بنظام العمل وتفادي المخالفات قبل وقوعها.",
               en: "Helps employers comply with the Labour Law and avoid violations before they occur." },
      bio:   { ar: "مستشار عمالي يعمل مع أقسام الموارد البشرية على مواءمة اللوائح الداخلية مع نظام العمل السعودي ولوائحه التنفيذية.",
               en: "A labour consultant who works with HR functions to align internal policies with the Saudi Labour Law and its implementing regulations." },
      focus: [ { ar: "اللوائح الداخلية", en: "Internal policies" }, { ar: "إنهاء الخدمة", en: "Termination" },
               { ar: "الحوكمة", en: "Governance" } ],
      education: [
        { degree: { ar: "بكالوريوس أنظمة", en: "LL.B. in Law" }, place: { ar: "جامعة الملك عبدالعزيز – 2012", en: "King Abdulaziz University – 2012" } }
      ],
      career: [
        { role: { ar: "مستشار عمالي مستقل", en: "Independent labour consultant" },
          period: { ar: "2016 – الحاضر", en: "2016 – Present" },
          note: { ar: "مراجعة عقود العمل واللوائح لأكثر من 60 منشأة.",
                  en: "Reviewed employment contracts and policies for 60+ organisations." } }
      ]
    }
  ];

  var ARTICLES = [
    {
      id: "corporate-governance-2024", cover: "cover-corporate.svg", cat: "commercial", read: 5,
      date: { ar: "15 أكتوبر 2023", en: "15 October 2023" }, author: "ahmed-almohammadi", featured: true,
      title: { ar: "تأثير نظام الشركات الجديد على حوكمة الشركات المساهمة",
               en: "How the new Companies Law reshapes joint-stock governance" },
      excerpt: { ar: "تحليل شامل للتعديلات الأخيرة في نظام الشركات وتأثيرها المباشر على التزامات مجالس الإدارة وحقوق المساهمين في الشركات المدرجة وغير المدرجة.",
                 en: "A full analysis of the recent amendments to the Companies Law and their direct effect on board duties and shareholder rights in listed and unlisted companies." }
    },
    {
      id: "foreign-ownership-guide", cover: "cover-realestate.svg", cat: "realestate", read: 3,
      date: { ar: "10 أكتوبر 2023", en: "10 October 2023" }, author: "mohammed-alfahd",
      title: { ar: "دليل المستثمر الأجنبي للتملك العقاري وفق الأنظمة المحدثة",
               en: "The foreign investor's guide to property ownership under the updated rules" },
      excerpt: { ar: "نظرة عامة على الإجراءات والشروط التنظيمية الجديدة التي تحكم استثمارات غير المواطنين في القطاع العقاري، والفرص المتاحة.",
                 en: "An overview of the new procedures and regulatory conditions governing non-citizen investment in real estate, and the opportunities they open." }
    },
    {
      id: "software-ip-protection", cover: "cover-ip.svg", cat: "ip", read: 7,
      date: { ar: "05 أكتوبر 2023", en: "05 October 2023" }, author: "noura-alqahtani",
      title: { ar: "حماية البرمجيات والتطبيقات الذكية: تحديات الملكية الفكرية في العصر الرقمي",
               en: "Protecting software and apps: IP challenges in the digital age" },
      excerpt: { ar: "يناقش هذا المقال التحديات القانونية لحماية الأصول الرقمية، وكيف يمكن للشركات التقنية الناشئة بناء استراتيجية متينة لحماية حقوقها محلياً ودولياً.",
                 en: "This piece examines the legal challenges of protecting digital assets, and how tech startups can build a durable strategy to defend their rights at home and abroad." }
    },
    {
      id: "labour-termination", cover: "cover-labour.svg", cat: "labour", read: 4,
      date: { ar: "28 سبتمبر 2023", en: "28 September 2023" }, author: "faisal-alotaibi",
      title: { ar: "إنهاء عقد العمل: متى يكون مشروعاً ومتى يُعد فصلاً تعسفياً؟",
               en: "Ending an employment contract: lawful termination vs. arbitrary dismissal" },
      excerpt: { ar: "قراءة عملية في المادتين 75 و77 من نظام العمل، مع أمثلة على الأحكام القضائية التي رسمت حدود الفصل المشروع.",
                 en: "A practical reading of Articles 75 and 77 of the Labour Law, with case law that has drawn the line around lawful dismissal." }
    },
    {
      id: "custody-rules", cover: "cover-family.svg", cat: "family", read: 6,
      date: { ar: "20 سبتمبر 2023", en: "20 September 2023" }, author: "sara-bint-tariq",
      title: { ar: "نظام الأحوال الشخصية: ما الذي تغيّر في أحكام الحضانة والنفقة؟",
               en: "The Personal Status Law: what changed in custody and alimony" },
      excerpt: { ar: "ملخص للأحكام الجديدة التي نظّمت الحضانة والنفقة والزيارة، وأثرها على الدعاوى المنظورة أمام المحاكم.",
                 en: "A summary of the new provisions on custody, alimony and visitation, and their effect on pending court claims." }
    },
    {
      id: "contract-drafting-mistakes", cover: "cover-contracts.svg", cat: "commercial", read: 5,
      date: { ar: "12 سبتمبر 2023", en: "12 September 2023" }, author: "ahmed-almohammadi",
      title: { ar: "خمسة أخطاء شائعة في صياغة العقود التجارية وكيف تتجنبها",
               en: "Five common commercial drafting mistakes — and how to avoid them" },
      excerpt: { ar: "من بند التحكيم الغامض إلى غياب تعريف الإخلال الجوهري، نستعرض الأخطاء التي تكلّف الشركات أكثر مما تتوقع.",
                 en: "From a vague arbitration clause to an undefined material breach, these are the mistakes that cost companies more than they expect." }
    }
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

  var STATS = [
    { value: "1,500+", valueEn: "1,500+", label: { ar: "استشارة منجزة", en: "Consultations delivered" } },
    { value: "240+", valueEn: "240+", label: { ar: "محامٍ معتمد", en: "Licensed lawyers" } },
    { value: "180+", valueEn: "180+", label: { ar: "مساعد ومتدرب قانوني", en: "Assistants & trainees" } },
    { value: "99%", valueEn: "99%", label: { ar: "نسبة رضا العملاء", en: "Client satisfaction" } }
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

  var REVIEWS = [
    { name: { ar: "سعود ا.", en: "Saud A." }, rating: 5, date: { ar: "قبل أسبوع", en: "A week ago" },
      body: { ar: "شرح لي الخيارات القانونية بلغة مفهومة ووفّر عليّ دعوى لم أكن بحاجة لها.",
              en: "He explained my options in plain language and spared me a claim I did not need." } },
    { name: { ar: "هند م.", en: "Hind M." }, rating: 5, date: { ar: "قبل أسبوعين", en: "Two weeks ago" },
      body: { ar: "دقيق في المواعيد، والمخرجات وصلتني مكتوبة وموثقة في حسابي.",
              en: "Punctual, and the output arrived written up and documented in my account." } },
    { name: { ar: "شركة نماء", en: "Namaa Co." }, rating: 4, date: { ar: "قبل شهر", en: "A month ago" },
      body: { ar: "مراجعة ممتازة لعقد التوريد، مع ملاحظات عملية قابلة للتطبيق فوراً.",
              en: "An excellent supply-contract review, with practical notes we could apply immediately." } }
  ];

  var SERVICES = [
    { icon: "phone", price: 150, unit: "half",
      title: { ar: "استشارة هاتفية (30 دقيقة)", en: "Phone consultation (30 min)" },
      body:  { ar: "مكالمة مباشرة لمناقشة وضعك القانوني والخيارات المتاحة أمامك.",
               en: "A direct call to review your legal position and the options open to you." } },
    { icon: "video", price: 300, unit: "consult",
      title: { ar: "استشارة فيديو موسّعة (60 دقيقة)", en: "Extended video consultation (60 min)" },
      body:  { ar: "جلسة مطوّلة لمراجعة المستندات ومناقشة استراتيجية القضية.",
               en: "A longer session to review documents and discuss case strategy." } },
    { icon: "file-text", price: 500, unit: "from",
      title: { ar: "صياغة عقد", en: "Contract drafting" },
      body:  { ar: "صياغة عقد مخصص لحالتك مع جولتي تعديل مجانيتين.",
               en: "A contract drafted for your situation, with two free revision rounds." } },
    { icon: "chat", price: 100, unit: "consult",
      title: { ar: "استشارة نصية", en: "Written consultation" },
      body:  { ar: "سؤال مفصّل وإجابة مكتوبة موثقة خلال 24 ساعة.",
               en: "A detailed question and a documented written answer within 24 hours." } }
  ];

  var REFERENCES = [
    { title: { ar: "نظام الشركات الجديد (1443هـ)", en: "The new Companies Law (1443 AH)" },
      note:  { ar: "النسخة المحدثة الصادرة عن وزارة التجارة.", en: "Updated edition issued by the Ministry of Commerce." } },
    { title: { ar: "لائحة حوكمة الشركات", en: "Corporate Governance Regulations" },
      note:  { ar: "الصادرة عن هيئة السوق المالية.", en: "Issued by the Capital Market Authority." } },
    { title: { ar: "نظام العمل ولائحته التنفيذية", en: "Labour Law & implementing regulations" },
      note:  { ar: "المرجع الأساسي لعلاقات العمل.", en: "The primary reference for employment relationships." } }
  ];

  /* Legal assistants and trainees working under supervision. */
  var INTERNS = [
    { id: "ahmed-aljaid",   name: { ar: "أحمد الجعيد",   en: "Ahmed Al-Jaid" },   level: "mid",      done: 24 },
    { id: "layan-alharbi",  name: { ar: "ليان الحربي",   en: "Layan Al-Harbi" },  level: "advanced", done: 41 },
    { id: "turki-alsubaie", name: { ar: "تركي السبيعي",  en: "Turki Al-Subaie" }, level: "basic",    done: 7 }
  ];

  /* Work posted by supervising lawyers for trainees to pick up. */
  var TASKS = [
    { id: "nda-draft", reward: 250, days: 3, level: "basic", specialty: "commercial", supervisor: "ahmed-almohammadi",
      title: { ar: "صياغة اتفاقية عدم إفشاء (NDA)", en: "Draft a non-disclosure agreement (NDA)" },
      body:  { ar: "صياغة اتفاقية سرية ثنائية بين شركة ناشئة ومستثمر محتمل، مع بند مدة سريان لا يقل عن ثلاث سنوات.",
               en: "Draft a mutual NDA between a startup and a prospective investor, with a survival period of at least three years." } },
    { id: "labour-memo", reward: 400, days: 5, level: "mid", specialty: "labour", supervisor: "faisal-alotaibi",
      title: { ar: "إعداد لائحة اعتراضية في دعوى عمالية", en: "Prepare a statement of defence in a labour claim" },
      body:  { ar: "تلخيص وقائع الدعوى وإعداد لائحة اعتراضية مستندة إلى المادتين 75 و77 من نظام العمل.",
               en: "Summarise the facts and prepare a statement of defence grounded in Articles 75 and 77 of the Labour Law." } },
    { id: "trademark-search", reward: 300, days: 4, level: "mid", specialty: "ip", supervisor: "noura-alqahtani",
      title: { ar: "بحث تشابه لعلامة تجارية قبل التسجيل", en: "Trademark clearance search before filing" },
      body:  { ar: "فحص سجل العلامات التجارية وإعداد تقرير بالتشابهات المحتملة وتوصية بالفئات الأنسب.",
               en: "Search the trademark register and report likely conflicts, with a recommendation on the best classes to file in." } },
    { id: "lease-review", reward: 350, days: 4, level: "mid", specialty: "realestate", supervisor: "mohammed-alfahd",
      title: { ar: "مراجعة عقد إيجار تجاري", en: "Review a commercial lease" },
      body:  { ar: "مراجعة عقد إيجار محل تجاري وإبراز البنود المجحفة، مع اقتراح صياغات بديلة لبند الإخلاء.",
               en: "Review a retail lease, flag one-sided clauses, and propose alternative wording for the termination clause." } },
    { id: "estate-schedule", reward: 500, days: 7, level: "advanced", specialty: "estates", supervisor: "sara-bint-tariq",
      title: { ar: "إعداد جدول حصر تركة وقسمتها", en: "Prepare an estate inventory and division schedule" },
      body:  { ar: "حصر أصول التركة وإعداد جدول القسمة الشرعية مع بيان الأنصبة، تمهيداً لمراجعة المحامي المشرف.",
               en: "Inventory the estate's assets and prepare the division schedule with each share stated, ready for the supervising lawyer." } },
    { id: "board-minutes", reward: 220, days: 2, level: "basic", specialty: "commercial", supervisor: "ahmed-almohammadi",
      title: { ar: "صياغة محضر اجتماع مجلس إدارة", en: "Draft board meeting minutes" },
      body:  { ar: "تحرير محضر اجتماع مجلس إدارة شركة مساهمة وفق متطلبات لائحة الحوكمة.",
               en: "Write up the minutes of a joint-stock company board meeting to the governance regulations' requirements." } }
  ];

  /* Trainee work sitting in the supervising lawyer's signature queue. */
  var DRAFTS = [
    { id: "d-1", by: "ahmed-aljaid", ago: { ar: "منذ ساعتين", en: "2 hours ago" }, specialty: "labour",
      title: { ar: "لائحة اعتراضية — دعوى عمالية", en: "Statement of defence — labour claim" } },
    { id: "d-2", by: "layan-alharbi", ago: { ar: "أمس", en: "Yesterday" }, specialty: "commercial",
      title: { ar: "اتفاقية عدم إفشاء — شركة ناشئة", en: "Non-disclosure agreement — startup" } },
    { id: "d-3", by: "turki-alsubaie", ago: { ar: "منذ 3 أيام", en: "3 days ago" }, specialty: "realestate",
      title: { ar: "مذكرة مراجعة عقد إيجار تجاري", en: "Commercial lease review memo" } }
  ];

  /* Canned assistant exchanges. No model runs here — see the page disclaimer. */
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

  /* Saudi regulations the assistant can be pointed at when drafting. */
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

  /* The lawyer's own precedents and templates, which the assistant drafts from. */
  var LAWYER_FILES = [
    { id: "f-1", kind: "template", size: "48 KB", ar: "نموذج عقد عمل — مكتبي",        en: "Employment contract template — my office" },
    { id: "f-2", kind: "template", size: "31 KB", ar: "نموذج اتفاقية عدم إفشاء",       en: "NDA template" },
    { id: "f-3", kind: "precedent",size: "112 KB",ar: "مذكرة دفاع — دعوى عمالية سابقة", en: "Defence memo — earlier labour claim" },
    { id: "f-4", kind: "template", size: "27 KB", ar: "نموذج إنذار بإخلاء مأجور",       en: "Notice to vacate template" },
    { id: "f-5", kind: "precedent",size: "64 KB", ar: "صيغة تسوية ودية معتمدة",        en: "Approved settlement wording" }
  ];

  /* Simple documents a client can order at the AI-drafted, lawyer-approved rate.
     `full` is what the same document costs when a lawyer writes it from scratch. */
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

  /* Client orders sitting in the assistant/lawyer pipeline. */
  var AI_REQUESTS = [
    { id: "r-1", doc: "employment", client: { ar: "شركة أفق", en: "Ufuq Co." },
      state: "drafted", ago: { ar: "منذ 12 دقيقة", en: "12 minutes ago" },
      note: { ar: "عقد لموظف تسويق، راتب 9,000 ريال، فترة تجربة 90 يوماً.",
              en: "Contract for a marketing hire, SAR 9,000 salary, 90-day probation." } },
    { id: "r-2", doc: "demand", client: { ar: "خالد الشهري", en: "Khalid Al-Shehri" },
      state: "drafted", ago: { ar: "منذ ساعة", en: "An hour ago" },
      note: { ar: "مطالبة بمبلغ 45,000 ريال مستحق منذ ثلاثة أشهر.",
              en: "Claim for SAR 45,000 outstanding for three months." } },
    { id: "r-3", doc: "nda", client: { ar: "منصة رواق", en: "Rawaq Platform" },
      state: "queued", ago: { ar: "منذ 5 دقائق", en: "5 minutes ago" },
      note: { ar: "اتفاقية سرية مع مطوّر مستقل لمدة سنتين.",
              en: "Confidentiality agreement with a freelance developer, two-year term." } }
  ];

  /* What the assistant produces before the lawyer touches it. */
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

  global.DATA = {
    specialties: SPECIALTIES,
    cities: CITIES,
    consultTypes: CONSULT_TYPES,
    lawyers: LAWYERS,
    articles: ARTICLES,
    features: FEATURES,
    steps: STEPS,
    stats: STATS,
    testimonials: TESTIMONIALS,
    values: VALUES,
    team: TEAM,
    faq: FAQ,
    reviews: REVIEWS,
    services: SERVICES,
    references: REFERENCES,
    interns: INTERNS,
    regulations: REGULATIONS,
    lawyerFiles: LAWYER_FILES,
    docTypes: DOC_TYPES,
    aiRequests: AI_REQUESTS,
    draftBodies: DRAFT_BODIES,

    docTypeById: function (id) {
      for (var i = 0; i < DOC_TYPES.length; i++) if (DOC_TYPES[i].id === id) return DOC_TYPES[i];
      return null;
    },
    tasks: TASKS,
    drafts: DRAFTS,
    assistant: ASSISTANT,

    internById: function (id) {
      for (var i = 0; i < INTERNS.length; i++) if (INTERNS[i].id === id) return INTERNS[i];
      return null;
    },

    lawyerById: function (id) {
      for (var i = 0; i < LAWYERS.length; i++) if (LAWYERS[i].id === id) return LAWYERS[i];
      return null;
    },
    labelOf: function (list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
  };
})(window);
