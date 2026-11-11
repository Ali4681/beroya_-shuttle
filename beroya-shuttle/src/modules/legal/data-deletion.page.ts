import { AppLocale } from '../../common/i18n';

/** Official support inbox for out-of-app deletion requests. */
export const DATA_DELETION_SUPPORT_EMAIL = 'beroyaforit@gmail.com';

const PRIVACY_POLICY_PATH = '/api/v1/shuttle/public/legal/privacy-policy';

type PageCopy = {
  htmlLang: string;
  dir: 'rtl' | 'ltr';
  title: string;
  heading: string;
  intro: string;
  inAppTitle: string;
  inAppSteps: string[];
  emailTitle: string;
  emailIntroBefore: string;
  emailIntroAfter: string;
  emailInclude: string[];
  emailSubjectHint: string;
  deletedTitle: string;
  deletedBody: string;
  retainedTitle: string;
  retainedBody: string;
  timelineTitle: string;
  timelineBody: string;
  privacyTitle: string;
  privacyBody: string;
  privacyLinkLabel: string;
  switchLocaleLabel: string;
  switchLocaleHref: string;
  footer: string;
};

function copyFor(locale: AppLocale): PageCopy {
  if (locale === 'en') {
    return {
      htmlLang: 'en',
      dir: 'ltr',
      title: 'Request account / data deletion — Beroya On +',
      heading: 'Request account / data deletion',
      intro:
        'This page explains how to request deletion of your Beroya On + (Beroya Shuttle) account and related personal data.',
      inAppTitle: 'Preferred method: delete from the app',
      inAppSteps: [
        'Open the Beroya Shuttle / Beroya On + mobile app',
        'Go to Account',
        'Choose Delete account',
        'Confirm deletion',
      ],
      emailTitle: 'Alternative method: email support',
      emailIntroBefore: 'If you cannot use the app, email ',
      emailIntroAfter: ' and include:',
      emailInclude: [
        'Full name',
        'Phone number or email linked to the account',
        'App / role type (driver, attendant, guardian/passenger, or student)',
        'A clear request to delete the account and personal data',
      ],
      emailSubjectHint: 'Suggested subject: Account / data deletion request',
      deletedTitle: 'What is deleted',
      deletedBody:
        'After we verify the request, we delete or anonymize account credentials, profile details, sessions, device tokens, and other personal data tied to the account, as described in our Privacy Policy.',
      retainedTitle: 'What may be retained temporarily',
      retainedBody:
        'Certain operational, safety, or legal records (for example historical trip or incident logs needed for service integrity, dispute handling, or legal obligations) may be retained for a limited period, then deleted or securely archived according to our policies.',
      timelineTitle: 'Expected timeline',
      timelineBody:
        'We aim to complete verified deletion requests within 30 days of confirming account ownership.',
      privacyTitle: 'Privacy Policy',
      privacyBody:
        'For full details on data processing and retention, see our Privacy Policy:',
      privacyLinkLabel: 'Privacy Policy',
      switchLocaleLabel: 'العربية',
      switchLocaleHref: '?locale=ar',
      footer: 'Beroya On + · Beroya Holding',
    };
  }

  return {
    htmlLang: 'ar',
    dir: 'rtl',
    title: 'طلب حذف الحساب / البيانات — Beroya On +',
    heading: 'طلب حذف الحساب / البيانات',
    intro:
      'توضّح هذه الصفحة كيفية طلب حذف حسابكم وبياناتكم الشخصية المرتبطة بتطبيقات Beroya On + (Beroya Shuttle).',
    inAppTitle: 'الطريقة المفضّلة: الحذف من داخل التطبيق',
    inAppSteps: [
      'افتح تطبيق Beroya Shuttle / Beroya On +',
      'اذهب إلى الحساب / Account',
      'اختر حذف الحساب / Delete account',
      'أكّد الحذف',
    ],
    emailTitle: 'طريقة بديلة: عبر إيميل الدعم',
    emailIntroBefore: 'إذا تعذّر استخدام التطبيق، أرسلوا طلبًا إلى ',
    emailIntroAfter: ' وتضمّنوا:',
    emailInclude: [
      'الاسم الكامل',
      'رقم الهاتف أو البريد المرتبط بالحساب',
      'نوع التطبيق / الدور (سائق، مرافق، ولي أمر/راكب، أو طالب)',
      'نص واضح: طلب حذف الحساب والبيانات',
    ],
    emailSubjectHint: 'موضوع مقترح: طلب حذف الحساب / البيانات',
    deletedTitle: 'ماذا يُحذف',
    deletedBody:
      'بعد التحقق من الطلب، نحذف أو نُعمّي بيانات الاعتماد والملف الشخصي والجلسات ورموز الأجهزة وغيرها من البيانات الشخصية المرتبطة بالحساب، وفق سياسة الخصوصية.',
    retainedTitle: 'ماذا قد يُحتفظ به مؤقتًا',
    retainedBody:
      'قد نحتفظ مؤقتًا بسجلات تشغيلية أو سلامة أو قانونية (مثل سجلات الرحلات أو الحوادث اللازمة لسلامة الخدمة أو تسوية النزاعات أو الالتزامات القانونية)، ثم نحذفها أو نؤرشفها بأمان وفق سياساتنا.',
    timelineTitle: 'المدة المتوقعة',
    timelineBody:
      'نسعى لإتمام طلبات الحذف الموثّقة خلال 30 يومًا من التحقق من هوية صاحب الحساب.',
    privacyTitle: 'سياسة الخصوصية',
    privacyBody:
      'للتفاصيل الكاملة حول معالجة البيانات والاحتفاظ بها، راجعوا سياسة الخصوصية:',
    privacyLinkLabel: 'سياسة الخصوصية',
    switchLocaleLabel: 'English',
    switchLocaleHref: '?locale=en',
    footer: 'Beroya On + · Beroya Holding',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listHtml(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

/**
 * Standalone HTML page for Google Play Data deletion request URL.
 * Returned as raw text/html (not the API JSON envelope).
 */
export function renderDataDeletionPage(locale: AppLocale): string {
  const c = copyFor(locale);
  const email = escapeHtml(DATA_DELETION_SUPPORT_EMAIL);
  const privacyHref = escapeHtml(PRIVACY_POLICY_PATH);

  return `<!DOCTYPE html>
<html lang="${c.htmlLang}" dir="${c.dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(c.title)}</title>
  <style>
    :root {
      --bg: #f6f4ef;
      --card: #ffffff;
      --text: #1c2430;
      --muted: #5a6573;
      --accent: #0b6e4f;
      --border: #e2e0d8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      background: linear-gradient(180deg, #eef5f1 0%, var(--bg) 40%, var(--bg) 100%);
      color: var(--text);
      line-height: 1.65;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 20px;
    }
    .brand {
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.02em;
    }
    .lang a {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.95rem;
      border: 1px solid var(--border);
      background: var(--card);
      padding: 6px 12px;
      border-radius: 8px;
    }
    h1 {
      font-size: 1.65rem;
      line-height: 1.3;
      margin: 0 0 12px;
    }
    .intro { color: var(--muted); margin: 0 0 24px; }
    section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 18px 8px;
      margin-bottom: 14px;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 10px;
      color: var(--accent);
    }
    p { margin: 0 0 12px; }
    ul { margin: 0 0 12px; padding-inline-start: 1.3rem; }
    li { margin-bottom: 6px; }
    a.mail, a.privacy {
      color: var(--accent);
      font-weight: 600;
      word-break: break-all;
    }
    .hint {
      color: var(--muted);
      font-size: 0.92rem;
    }
    footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.85rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand" dir="ltr">Beroya On&nbsp;+</div>
      <div class="lang"><a href="${escapeHtml(c.switchLocaleHref)}">${escapeHtml(c.switchLocaleLabel)}</a></div>
    </header>
    <h1>${escapeHtml(c.heading)}</h1>
    <p class="intro">${escapeHtml(c.intro)}</p>

    <section>
      <h2>${escapeHtml(c.inAppTitle)}</h2>
      ${listHtml(c.inAppSteps)}
    </section>

    <section>
      <h2>${escapeHtml(c.emailTitle)}</h2>
      <p>${escapeHtml(c.emailIntroBefore)}<a class="mail" href="mailto:${email}">${email}</a>${escapeHtml(c.emailIntroAfter)}</p>
      ${listHtml(c.emailInclude)}
      <p class="hint">${escapeHtml(c.emailSubjectHint)}</p>
    </section>

    <section>
      <h2>${escapeHtml(c.deletedTitle)}</h2>
      <p>${escapeHtml(c.deletedBody)}</p>
    </section>

    <section>
      <h2>${escapeHtml(c.retainedTitle)}</h2>
      <p>${escapeHtml(c.retainedBody)}</p>
    </section>

    <section>
      <h2>${escapeHtml(c.timelineTitle)}</h2>
      <p>${escapeHtml(c.timelineBody)}</p>
    </section>

    <section>
      <h2>${escapeHtml(c.privacyTitle)}</h2>
      <p>${escapeHtml(c.privacyBody)}
        <a class="privacy" href="${privacyHref}">${escapeHtml(c.privacyLinkLabel)}</a>
      </p>
    </section>

    <footer>${escapeHtml(c.footer)}</footer>
  </div>
</body>
</html>`;
}
