import { AppLocale } from '../../common/i18n';

export type LegalDocumentKey = 'privacy_policy' | 'terms_of_use';

export type LegalDocument = {
  key: LegalDocumentKey;
  version: string;
  updatedAt: string;
  locale: AppLocale;
  title: string;
  /** Markdown body for native Flutter rendering */
  contentMarkdown: string;
  /** Same body as simple HTML paragraphs for WebView if needed */
  contentHtml: string;
};

const VERSION = '1.0.0';
const UPDATED_AT = '2026-10-10T00:00:00.000Z';

/** Display name; LTR isolates keep "+" after "On" inside Arabic RTL text. */
const BRAND_NAME = 'Beroya On +';
const BRAND_MD = `**\u2066${BRAND_NAME}\u2069**`;

function toHtml(markdown: string): string {
  const parts: string[] = [];

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      parts.push(`<h2>${inlineHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      parts.push(`<h1>${inlineHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      parts.push(`__LI__${inlineHtml(trimmed.slice(2))}`);
      continue;
    }
    parts.push(`<p>${inlineHtml(trimmed)}</p>`);
  }

  const html: string[] = [];
  let listOpen = false;
  for (const part of parts) {
    if (part.startsWith('__LI__')) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${part.slice(6)}</li>`);
      continue;
    }
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
    html.push(part);
  }
  if (listOpen) html.push('</ul>');
  return html.join('\n');
}

function inlineHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /<strong>\u2066?Beroya On \+\u2069?<\/strong>/g,
      '<strong dir="ltr">Beroya On&nbsp;+</strong>',
    );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRIVACY_AR = `# سياسة الخصوصية

آخر تحديث: 10 أكتوبر 2026

تحترم منصة ${BRAND_MD} خصوصيتكم. توضّح هذه السياسة كيف نجمع البيانات الشخصية ونستخدمها ونحميها عند استخدام تطبيقات الركاب والطاقم ولوحة التحكم والخدمات المرتبطة بها.

## 1. من المسؤول عن البيانات؟
تدير المنصة شركة بيرويا (Beroya) بصفتها مزوّد الخدمة، وقد تُعالَج بعض البيانات التشغيلية لصالح المؤسسة التعليمية أو التشغيلية التي تشتركون عبرها.

## 2. البيانات التي نجمعها
قد نجمع ونعالج:
- بيانات الحساب: الاسم، رقم الهاتف، البريد الإلكتروني، وكلمة المرور بشكل مشفّر.
- بيانات الطلاب وأولياء الأمور المرتبطة برحلات النقل المدرسي أو التشغيلي.
- بيانات الرحلة: المسارات، المحطات، حالة الصعود/النزول، والغياب.
- بيانات الموقع أثناء الرحلات النشطة (للسائق/المركبة حسب الصلاحيات) لتوفير التتبع والتنبيهات.
- بيانات الجهاز: معرّف الجهاز، رمز الإشعارات (FCM)، نظام التشغيل، وإصدار التطبيق.
- سجلات تقنية للأمان واستقرار الخدمة.

## 3. كيف نستخدم البيانات؟
نستخدم البيانات من أجل:
- تشغيل خدمة النقل وتتبع الرحلات وإشعارات الحالة.
- إدارة الحسابات والصلاحيات والمؤسسات.
- تحسين الأمان ومنع إساءة الاستخدام.
- التواصل التشغيلي والدعم عند الحاجة.
- الالتزام بالمتطلبات القانونية والتنظيمية المعمول بها.

## 4. المشاركة مع أطراف أخرى
لا نبيع بياناتكم الشخصية. قد نشارك بيانات محدودة فقط مع:
- المؤسسة التي تنتمون إليها (ضمن نطاق الخدمة).
- مزوّدي البنية التحتية الضروريين (مثل الاستضافة، قواعد البيانات، الإشعارات، التخزين) بموجب التزامات تعاقدية مناسبة.
- الجهات المختصة عند وجود التزام قانوني.

## 5. الاحتفاظ بالبيانات
نحتفظ بالبيانات طالما كان الحساب/الاشتراك نشطًا، أو للمدة اللازمة لتقديم الخدمة والامتثال القانوني وتسوية النزاعات، ثم نحذفها أو نؤرشفها بشكل آمن وفق سياساتنا.

## 6. الأمان
نستخدم إجراءات تقنية وتنظيمية مناسبة لحماية البيانات، بما في ذلك التحكم بالوصول والتشفير أثناء النقل حيث ينطبق. لا توجد وسيلة حماية مطلقة عبر الإنترنت، لكننا نعمل باستمرار على تقليل المخاطر.

## 7. حقوقكم
بحسب القانون المعمول به وصلاحياتكم داخل المنصة، يمكنكم طلب الاطلاع على بياناتكم أو تصحيحها أو تحديثها أو طلب تقييد/حذف ما يمكن حذفه دون الإخلال بالالتزامات التشغيلية أو القانونية. يمكن لمستخدمي تطبيقات الموبايل حذف حساباتهم من إعدادات التطبيق عبر خيار «حذف الحساب». وإلا فتواصلوا عبر قنوات الدعم الرسمية أو مع إدارة المؤسسة.

## 8. خصوصية الأطفال
الخدمة موجّهة لإدارة نقل الطلاب بموافقة وإشراف أولياء الأمور والمؤسسات. لا نطلب من الأطفال إنشاء حسابات مستقلة خارج هذا الإطار.

## 9. التعديلات
قد نحدّث هذه السياسة من وقت لآخر. سنعرض النسخة المحدّثة عبر واجهة التطبيق/الواجهة البرمجية مع تاريخ التحديث ورقم الإصدار.

## 10. التواصل
للاستفسارات المتعلقة بالخصوصية، استخدموا قنوات الدعم داخل التطبيق أو تواصلوا مع فريق بيرويا عبر بيانات التواصل الرسمية المعتمدة.`;

const PRIVACY_EN = `# Privacy Policy

Last updated: 10 October 2026

${BRAND_MD} respects your privacy. This policy explains how we collect, use, and protect personal data when you use the passenger app, crew app, dashboard, and related services.

## 1. Who is responsible?
The platform is operated by Beroya as the service provider. Some operational data may also be processed for the educational or operational institution through which you use the service.

## 2. Data we collect
We may collect and process:
- Account data: name, phone number, email, and password in hashed form.
- Student and guardian data linked to school/operational shuttle trips.
- Trip data: routes, stops, boarding/drop-off status, and absences.
- Location data during active trips (for the driver/vehicle as authorized) to power tracking and alerts.
- Device data: device id, push token (FCM), platform, and app version.
- Technical logs for security and reliability.

## 3. How we use data
We use data to:
- Operate transport services, trip tracking, and status notifications.
- Manage accounts, roles, and institutions.
- Improve security and prevent abuse.
- Provide operational support when needed.
- Comply with applicable legal obligations.

## 4. Sharing
We do not sell personal data. Limited data may be shared only with:
- Your institution, within the scope of the service.
- Essential infrastructure providers (hosting, databases, notifications, storage) under appropriate contractual safeguards.
- Competent authorities when legally required.

## 5. Retention
We retain data while the account/subscription is active, or as needed to provide the service, meet legal obligations, and resolve disputes, then delete or securely archive it according to our policies.

## 6. Security
We apply appropriate technical and organizational measures, including access controls and transport encryption where applicable. No online system is perfectly secure, but we work continuously to reduce risk.

## 7. Your rights
Subject to applicable law and your role, you may request access, correction, update, restriction, or deletion of eligible data without undermining operational or legal duties. Mobile app users can delete their accounts from in-app settings via “Delete account”. Otherwise contact in-app support or your institution admin.

## 8. Children’s privacy
The service manages student transport under guardian and institution supervision. We do not ask children to create independent accounts outside that framework.

## 9. Changes
We may update this policy from time to time. Updated versions are exposed through the app/API with an updated date and version number.

## 10. Contact
For privacy questions, use in-app support channels or contact Beroya through official support contacts.`;

const TERMS_AR = `# شروط الاستخدام

آخر تحديث: 10 أكتوبر 2026

باستخدام تطبيقات وخدمات ${BRAND_MD}، فإنكم توافقون على هذه الشروط. إذا لم توافقوا، يُرجى عدم استخدام الخدمة.

## 1. وصف الخدمة
توفر المنصة أدوات لإدارة وتتبع رحلات النقل (مثل النقل المدرسي/التشغيلي)، بما في ذلك الحسابات، المسارات، الرحلات، الإشعارات، والتقارير التشغيلية حسب الدور والصلاحية.

## 2. الأهلية والحسابات
- يجب تقديم معلومات صحيحة ومحدّثة.
- أنتم مسؤولون عن الحفاظ على سرية بيانات الدخول وأجهزة الحساب المرتبطة بكم.
- لا تستخدموا حساب شخص آخر دون تفويض.
- قد تُنشأ بعض الحسابات بواسطة المؤسسة أو إدارة المنصة.

## 3. أدوار المستخدمين
تختلف الصلاحيات حسب الدور (ولي أمر، سائق، مشرفة، إدارة مؤسسة، إدارة المنصة). يجب الالتزام بنطاق الصلاحية الممنوحة وعدم محاولة تجاوزها.

## 4. الاستخدام المقبول
يُحظر عليكم:
- إساءة استخدام التتبع أو الإشعارات أو بيانات الطلاب.
- محاولة اختراق النظام أو تعطيله أو استخراج بيانات غير مصرّح بها.
- نشر محتوى مسيء أو غير قانوني عبر قنوات التواصل المرتبطة بالخدمة.
- استخدام الخدمة بطريقة تضر بسلامة الطلاب أو العمليات.

## 5. الموقع والسلامة
بيانات الموقع والتقارير التشغيلية أدوات مساعدة ولا تغني عن الالتزام بقواعد السلامة المرورية والتشغيلية. السائق والطاقم والمؤسسة يتحملون مسؤولياتهم الميدانية وفق الأنظمة المعمول بها.

## 6. المحتوى والبيانات التشغيلية
تظل بيانات المنصة وأنظمتها ملكًا لبيرويا أو مرخّصة لها. بيانات المؤسسة والطلاب تُعالَج لغرض تقديم الخدمة وفق سياسة الخصوصية والاتفاقيات مع المؤسسة.

## 7. الإشعارات والتواصل
قد نرسل إشعارات تشغيلية مهمة (مثل بدء الرحلة، الصعود، التأخير، الحوادث). إيقاف الإشعارات قد يؤثر على استفادتكم من الخدمة.

## 8. التوافر والتعديلات
نسعى لتوفير خدمة مستقرة، لكن قد يحدث انقطاع للصيانة أو أسباب خارجة عن السيطرة. يحق لنا تعديل الميزات أو إيقاف أجزاء منها مع إشعار معقول عند الإمكان.

## 9. إخلاء المسؤولية
تُقدَّم الخدمة كما هي ضمن الحدود التي يسمح بها القانون. لا نضمن نتائج تشغيلية معيّنة خارج سيطرتنا (مثل حركة المرور أو ظروف الطريق). لا تتحمل بيرويا المسؤولية عن أضرار غير مباشرة أو ناتجة عن استخدام مخالف أو قرارات تشغيلية للمؤسسة/المستخدم.

## 10. إنهاء الاستخدام
يمكن تعليق أو إنهاء الوصول عند مخالفة الشروط أو عند انتهاء العلاقة مع المؤسسة/الاشتراك. كما يمكنكم التوقف عن استخدام التطبيق في أي وقت.

## 11. القانون الواجب التطبيق
تخضع هذه الشروط للقوانين المعمول بها في نطاق تشغيل الخدمة، وتُسوَّى النزاعات وفق الآليات القانونية المختصة ما لم يُتفق بخلاف ذلك كتابةً.

## 12. التعديلات
قد نحدّث الشروط من وقت لآخر. استمرار استخدام الخدمة بعد نشر النسخة الجديدة يُعد قبولًا لها، ما لم يقتضِ القانون موافقة صريحة إضافية.

## 13. التواصل
للاستفسارات حول الشروط، استخدموا قنوات الدعم داخل التطبيق أو تواصلوا مع فريق بيرويا عبر القنوات الرسمية.`;

const TERMS_EN = `# Terms of Use

Last updated: 10 October 2026

By using ${BRAND_MD} apps and services, you agree to these terms. If you do not agree, do not use the service.

## 1. Service description
The platform provides tools to manage and track transport trips (such as school/operational shuttles), including accounts, routes, trips, notifications, and operational reports according to role and permissions.

## 2. Eligibility and accounts
- Provide accurate and up-to-date information.
- You are responsible for safeguarding login credentials and linked devices.
- Do not use another person’s account without authorization.
- Some accounts may be created by the institution or platform admin.

## 3. User roles
Permissions differ by role (guardian, driver, attendant, institution admin, platform admin). Stay within your granted scope and do not attempt to bypass controls.

## 4. Acceptable use
You must not:
- Misuse tracking, notifications, or student data.
- Attempt to hack, disrupt, or extract unauthorized data.
- Post abusive or unlawful content through service-related channels.
- Use the service in a way that endangers students or operations.

## 5. Location and safety
Location data and operational reports are assistive tools and do not replace traffic or operational safety rules. Drivers, crew, and institutions remain responsible for on-ground duties under applicable regulations.

## 6. Content and operational data
Platform systems remain owned by or licensed to Beroya. Institution and student data are processed to deliver the service under the Privacy Policy and institutional agreements.

## 7. Notifications
We may send important operational notifications (trip start, boarding, delays, incidents). Disabling notifications may reduce service usefulness.

## 8. Availability and changes
We aim for reliable availability, but downtime may occur for maintenance or reasons beyond our control. We may modify or discontinue features with reasonable notice when practicable.

## 9. Disclaimer
The service is provided as-is to the extent permitted by law. We do not guarantee specific operational outcomes outside our control (such as traffic or road conditions). Beroya is not liable for indirect damages or harm arising from misuse or institutional/user operational decisions.

## 10. Termination
Access may be suspended or terminated for terms violations or when the institutional/subscription relationship ends. You may stop using the app at any time.

## 11. Governing law
These terms are governed by the laws applicable where the service operates. Disputes are handled under competent legal mechanisms unless otherwise agreed in writing.

## 12. Changes
We may update these terms from time to time. Continued use after publication of a new version constitutes acceptance, unless applicable law requires additional explicit consent.

## 13. Contact
For questions about these terms, use in-app support or contact Beroya through official channels.`;

const DOCS: Record<
  LegalDocumentKey,
  Record<AppLocale, { title: string; markdown: string }>
> = {
  privacy_policy: {
    ar: { title: 'سياسة الخصوصية', markdown: PRIVACY_AR },
    en: { title: 'Privacy Policy', markdown: PRIVACY_EN },
  },
  terms_of_use: {
    ar: { title: 'شروط الاستخدام', markdown: TERMS_AR },
    en: { title: 'Terms of Use', markdown: TERMS_EN },
  },
};

export function getLegalDocument(
  key: LegalDocumentKey,
  locale: AppLocale,
): LegalDocument {
  const doc = DOCS[key][locale];
  return {
    key,
    version: VERSION,
    updatedAt: UPDATED_AT,
    locale,
    title: doc.title,
    contentMarkdown: doc.markdown,
    contentHtml: toHtml(doc.markdown),
  };
}

export function listLegalDocuments(locale: AppLocale) {
  return (Object.keys(DOCS) as LegalDocumentKey[]).map((key) => {
    const full = getLegalDocument(key, locale);
    return {
      key: full.key,
      version: full.version,
      updatedAt: full.updatedAt,
      locale: full.locale,
      title: full.title,
    };
  });
}
