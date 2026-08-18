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
    { value: "142+", valueEn: "142+", label: { ar: "محامٍ مرخص", en: "Licensed lawyers" } },
    { value: "8,400+", valueEn: "8,400+", label: { ar: "استشارة منجزة", en: "Consultations delivered" } },
    { value: "4.8", valueEn: "4.8", label: { ar: "متوسط التقييم", en: "Average rating" } },
    { value: "13", valueEn: "13", label: { ar: "مدينة مغطاة", en: "Cities covered" } }
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
