import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  ERROR_TABLE,
  ListedOp,
  collectErrorCodes,
  listOperations,
  renderOperation,
  type Doc,
} from './phase15-contract';

const DOCS = process.env.PHASE15_DOCS_URL ?? 'http://127.0.0.1:3001/api/v1/shuttle/docs-json';
const ROOT = join(__dirname, '..', '..');

function errorMarkdown(): string {
  const lines = [
    '| code | رسالة المستخدم | سلوك الواجهة |',
    '|---|---|---|',
    ...ERROR_TABLE.map(([code, message, behavior]) => `| \`${code}\` | ${message} | ${behavior} |`),
  ];
  return lines.join('\n');
}

function apiSection(ops: ListedOp[], doc: Doc, audience: 'frontend' | 'mobile'): string {
  const selected = ops.filter(
    (op) => op.audience === audience || op.audience === 'both',
  );
  const groups = new Map<string, ListedOp[]>();
  for (const op of selected) {
    const list = groups.get(op.group) ?? [];
    list.push(op);
    groups.set(op.group, list);
  }
  const order = [
    'auth',
    'admin',
    'institution',
    'driver',
    'attendant',
    'parent',
    'university',
    'health',
    'metrics',
    'ops',
  ];
  const keys = [
    ...order.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !order.includes(key)).sort(),
  ];
  const parts = [
    '## 7. مرجع API الكامل',
    '',
    'كل مسار أدناه مكتوب بصيغة Phase 15.2 من العقد الحي. لا تعتمد على Swagger وحدها أثناء البناء — هذا القسم هو المرجع.',
    '',
  ];
  for (const key of keys) {
    parts.push(`## مجموعة \`${key}\``, '');
    for (const op of groups.get(key) ?? []) {
      parts.push(renderOperation(op, doc));
    }
  }
  return parts.join('\n');
}

function frontendNarrative(): string {
  return `# FRONTEND_PLAN — لوحات بيرويا والمؤسسة

عقد واحد لفريق Next.js. أي تغيير على API الباك يُحدَّث هنا في نفس الـ PR.

## 1. فكرة المنتج

Beroya On + منصة مستقلة عن Beroya Go لإدارة النقل المدرسي والجامعي متعدد المؤسسات. كل مؤسسة بيئة معزولة: فروع، خطوط، طلاب أو ركاب جامعة، سائقون، مركبات، مشرفات، رحلات يومية، تتبع حي، صعود/نزول، تأخير، أعطال، طوارئ، إشعارات، واشتراك.

سبعة أدوار ثابتة بلا permissions ديناميكية: \`BEROYA_ADMIN\`، \`INSTITUTION_ADMIN\`، \`DRIVER\`، \`ATTENDANT\`، \`PARENT\`، \`UNIVERSITY_STUDENT\`. الشركات (\`COMPANY\`) موجودة في الـ enum فقط ولا تُبنى في v1.

الفرق بين المدرسة والجامعة: طالب المدرسة ليس له حساب — يملكه ولي الأمر. طالب الجامعة له حساب ويتابع الخطوط المتاحة لفرعه بلا ربط ثابت بخط وبلا حجز مقعد.

الفصل بين الخط والرحلة إلزامي: \`ShuttleRoute\` إعداد ثابت، \`ShuttleTrip\` لقطة يومية. تغيير الإعدادات لا يعيد كتابة رحلة بدأت.

نماذج التشغيل: \`BEROYA_OPERATED\` (بيرويا تشغّل الأسطول)، \`INSTITUTION_OPERATED\` (المؤسسة تملك الأسطول وتشترك في النظام فقط)، \`HYBRID\`. موارد بيرويا تظهر للتعيين في النموذجين الأول والثالث فقط، ولا تُعدَّل من المؤسسة (\`RESOURCE_OWNED_BY_BEROYA\`).

الهوية البصرية: اسم، شعار، لون أساسي من \`/institution/bootstrap\` تُطبَّق كـ CSS variables على \`<html>\`. لا تطبيق منفصل لكل مدرسة.

## 2. قواعد العمل الملزمة للواجهة

| الدور | مسموح | ممنوع |
|---|---|---|
| BEROYA_ADMIN | إنشاء المؤسسات والاشتراكات وموارد بيرويا ولوحة المنصة | استلام طوارئ \`INSTITUTION_OPERATED\`؛ دخول \`(institution)\` |
| INSTITUTION_ADMIN | كل التشغيل داخل مؤسسته: فروع، طلاب، خطوط، رحلات، إشعارات، حل حوادث | رؤية مؤسسة أخرى؛ تعديل مورد بيرويا؛ بدء/إنهاء رحلة |
| DRIVER | بدء/إنهاء رحلته، موقع، وصول محطة، عطل/طوارئ | إدارة الطلاب، رؤية خطوط أخرى، رقم ولي الأمر |
| ATTENDANT | صعود/لم يصعد/إنزال لرحلة خطها فقط | خطوط أخرى؛ أرقام الأهالي؛ بدء الرحلة |
| PARENT | أبناؤه، الرحلة الحية، تفضيل التنبيه 5/10/15، تسجيل غياب | تعديل بياناته أو موقع الالتقاط؛ رقم السائق؛ الاتصال بالسائق |
| UNIVERSITY_STUDENT | خطوط فرعه، رحلة اليوم الحية | حجز مقعد؛ ربط ثابت بخط |

القواعد الـ27 من العقد: بيرويا تنشئ المؤسسة؛ الفروع مستقلة بخطوطها؛ مشرفة واحدة لكل خط وخط واحد لكل مشرفة؛ السائق يبدأ/ينهي؛ المشرفة تدير الصعود؛ المدرسة تضيف الطالب؛ الاستثناء اليومي من المؤسسة؛ \`notify_users\` قرار المؤسسة؛ تأخير تلقائي واحد؛ العطل لا ينهي الرحلة؛ التبديل بنفس \`tripId\`؛ GPS المقطوع يعرض آخر موقع؛ طوارئ الأهل يدوية.

مستبعد من v1 — لا تبنِه ولا تترك له أزراراً: انتظار عند المنزل، أكثر من ولي، QR/NFC/وجه/PIN، حجز مقعد، تخطيط تلقائي، دفع ولي الأمر، تطبيق مستقل لكل مؤسسة. غياب التقويم لأيام اليوم/المستقبل عبر \`POST .../absence\` مسموح.

## 3. الـ Stack

| الحزمة | الإصدار | السبب |
|---|---|---|
| next | 15.2.x | App Router + middleware للحمايتين |
| react | 19.x | متوافق مع Next 15 |
| typescript | 5.7.x strict | نفس صرامة الباك |
| @tanstack/react-query | 5.x | كاش السيرفر؛ الـ socket يبطله |
| zustand | 5.x | هوية بصرية وجلسة فقط |
| tailwindcss | 4.x | RTL عبر \`dir="rtl"\` |
| shadcn/ui + radix | أحدث مستقر | جداول ونماذج موحّدة |
| react-hook-form | 7.x | نماذج كبيرة |
| zod | 3.25.x | نفس فلسفة الباك |
| socket.io-client | 4.8.x | يطابق الباك |
| maplibre-gl | 5.x | خريطة حية بلا مفتاح إلزامي |
| recharts | 2.x | KPI |
| next-intl | 4.x | ar / en + RTL |

لا Redux. لا polling للخريطة بعد أول \`GET /institution/live-map\`.

## 4. بنية المجلدات

\`\`\`
apps/web/
  app/
    (auth)/login/page.tsx
    (admin)/layout.tsx
    (admin)/bootstrap/page.tsx
    (admin)/institutions/[id]/...
    (admin)/resources/...
    (admin)/dashboard/...
    (institution)/layout.tsx
    (institution)/bootstrap/page.tsx
    (institution)/branches/...
    (institution)/people/...
    (institution)/routes/[id]/stops/page.tsx
    (institution)/trips/...
    (institution)/live-map/page.tsx
    (institution)/incidents/...
    (institution)/notifications/...
    middleware.ts
  src/
    api/client.ts          # Authorization + refresh queue + snake/camel
    api/query-keys.ts
    realtime/socket.ts
    realtime/invalidate.ts
    theme/branding.ts      # CSS variables من bootstrap
    components/data-table.tsx
    components/notify-users-checkbox.tsx
    components/stop-order-dialog.tsx
    features/...
\`\`\`

\`middleware.ts\` يقرأ الدور من كوكي الجلسة: \`BEROYA_ADMIN\` فقط لـ \`(admin)\`، \`INSTITUTION_ADMIN\` فقط لـ \`(institution)\`. أي دور آخر → \`/login\`.

## 5. فيزات الفرونت (توازي الباك)

| فيز | يعتمد على باك | شاشات الفرونت |
|---|---|---|
| 0-1 | صحة + تسجيل دخول إيميل | تسجيل الدخول، \`/auth/me\` |
| 2 | مؤسسات | قائمة/إنشاء مؤسسة، اشتراك |
| 3 | فروع وإعدادات | فروع، إعدادات، هوية |
| 4 | موارد | سائقون/مركبات بيرويا والمؤسسة |
| 5 | ركاب | طلاب، أهالي، طلاب جامعة، نقاط تجمع |
| 6 | خطوط | خط، جدول، محطات، ترتيب، تعيين افتراضي |
| 7 | رحلات | توليد، قائمة، تجاوز، تبديل، إلغاء |
| 8 | تتبع | خريطة حية + socket |
| 9 | حوادث | عطل/طوارئ/حل/انتباه |
| 10 | إشعارات | إرسال + صندوق |
| 11 | تنفيذ | عرض حالة الصعود (قراءة) |
| 12 | ركاب | لا شاشات ويب للأهالي |
| 13 | رؤى | لوحات KPI، بحث، تدقيق |
| 14 | صلابة | rate limit UI، metrics للعمليات |
| 15 | هذا الملف | عقد البناء |

## 6. الشاشات

لكل شاشة الحالات الأربع إلزامية: تحميل / فارغ / خطأ (\`error.code\`) / ممنوع (403).

### تسجيل الدخول
الدور: عام. \`POST /auth/login\` بإيميل وكلمة سر إلزاميين. OTP متوقف مؤقتاً (\`/auth/otp/request|verify\` معلّقان في الباك). بعد النجاح خزّن access+refresh واستدعِ bootstrap حسب الدور.

### إقلاع بيرويا
\`GET /admin/bootstrap\`. يملأ المستخدم فقط.

### إدارة المؤسسات / الاشتراكات / موارد بيرويا / لوحة بيرويا / بحث / تدقيق
كما في مجموعة \`admin\` أدناه. تحقق التواريخ قبل تفعيل الاشتراك. لا تعرض موارد مؤسسة في لوحة بيرويا إلا بنموذج تشغيل بيرويا/هجين للأحداث الحية.

### إقلاع المؤسسة
\`GET /institution/bootstrap\` مرة واحدة: مستخدم، مؤسسة، فروع، إعدادات، هوية. اكتب \`--primary\` وشعار على \`document.documentElement\`.

### الفروع / الإعدادات / الهوية
إحداثيات الفرع إلزامية قبل توليد رحلات ذات معنى. تغيير المنطقة الزمنية لا يعيد كتابة الرحلات القديمة.

### الطلاب والأهالي / طلاب الجامعة / نقاط التجمع
التقاط HOME يحتاج lat/lng. MEETING_POINT يحتاج \`meeting_point_id\`. ولي الأمر لا يُنشأ إلا عبر الطالب. جامعة: لا تعيين خط ثابت.

### الخطوط
مشرفة واحدة. \`stops_order_stale\` يفتح حوار «يحتاج إعادة ترتيب»: \`POST optimize-stops\` ثم \`PUT stop-order\`. \`notify_users\` checkbox موحّد في كل حوار يرسل إشعاراً.

### الرحلات
توليد ليوم \`YYYY-MM-DD\`. التبديل لا ينشئ رحلة جديدة. الإلغاء لغير المكتملة.

### الخريطة الحية
\`GET /institution/live-map\` مرة. بعدها فقط \`trip.location.updated\`. لا polling.

### الانتباه والحوادث
حل الحادثة يكتب ملاحظات. لا إشعار أهل تلقائي من الطوارئ.

### الإشعارات
معاينة الجمهور قبل الإرسال. \`Idempotency-Key\` على الإنشاء.

## 8. الأخطاء

شكل الباك دائماً:

\`\`\`
{ "error": { "code": "ROUTE_NOT_FOUND", "message": "...", "details": {} } }
\`\`\`

${errorMarkdown()}

## 9. Realtime

الاتصال: \`socket.io-client\` على \`/realtime\` مع \`auth: { token: accessToken }\`.

| غرفة | من يدخل | ملاحظة |
|---|---|---|
| \`institution:{id}\` | أدمن المؤسسة؛ بيرويا فقط إن كان النموذج BEROYA/HYBRID | عزل A/B |
| \`trip:{id}\` | من يملك الرحلة في نطاقه | تحديث موقع ونقاط |
| \`route:{id}\` | نفس نطاق الخط | حالة الخط |
| \`admin:beroya\` | BEROYA_ADMIN فقط | ليست كل أحداث المؤسسات |

اشترك عبر حدث \`subscribe\` \`{ room }\`. الرفض: \`ROOM_FORBIDDEN\`.

| event | أبطل queryKey | فعل إضافي |
|---|---|---|
| trip.started / completed / cancelled | \`['trips']\`, \`['live-map']\` | حدّث الشارة |
| trip.location.updated | لا | حرّك العلامة؛ payload: \`latitude\`, \`longitude\`, \`heading\` (null إن غاب), \`speed_kph\` (null إن غاب), \`recorded_at\` |
| trip.delay.detected | \`['trips']\`, \`['attention']\` | شارة تأخير |
| trip.driver.changed / vehicle.changed / attendant.changed | \`['trips', id]\` | انتقل التتبع للجهاز الجديد |
| trip.student.status.changed | \`['trips', id, 'students']\` | حدّث الصف |
| trip.breakdown.created / trip.emergency.created | \`['incidents']\`, \`['attention']\` | لا تدفع للأهل |
| incident.resolved | \`['incidents']\` | أزل من المفتوحة |
| trip.tracking.stale | \`['live-map']\` | \`gps_stale: true\` مع بقاء آخر موقع |

## 10. الاختبارات والنشر

- Playwright: عزل مؤسسة A/B على قائمة الطلاب والخطوط.
- مصفوفة أدوار: أدمن مؤسسة لا يدخل \`(admin)\`.
- خريطة: بعد أول GET لا يُرسل live-map مرة ثانية خلال دقيقة بلا تفاعل.
- Vercel أو Docker مع \`NEXT_PUBLIC_API_BASE=https://api.../api/v1/shuttle\` و\`NEXT_PUBLIC_SOCKET_URL\`.
- أي تغيير لوحة تحكم أو عقد API يُحدّث هذا الملف في نفس الـ PR.

`;
}

function mobileNarrative(): string {
  return `# MOBILE_PLAN — تطبيق الركاب وتطبيق الطاقم

عقد واحد لفريق Flutter. تطبيقان، كود مشترك واحد. أي تغيير على API الباك يُحدَّث هنا في نفس الـ PR.

## 1. فكرة المنتج

نفس منتج Beroya On +: نقل مدرسي/جامعي متعدد المؤسسات. الموبايل يغطي أربعة أدوار فقط:

- \`apps/passenger\`: \`PARENT\` و\`UNIVERSITY_STUDENT\` — الواجهة تتبدل بعد \`GET /auth/me\`.
- \`apps/crew\`: \`DRIVER\` و\`ATTENDANT\` — نفس القاعدة.

طالب المدرسة ليس له تطبيق. الشركات ليست في v1. الهوية البصرية من bootstrap إن وُجدت، وإلا هوية بيرويا.

## 2. قواعد العمل الملزمة

| الدور | مسموح | ممنوع |
|---|---|---|
| DRIVER | بدء/إنهاء رحلته، موقع كل 15ث، وصول محطة، عطل/طوارئ | إدارة الطلاب؛ خطوط غيره؛ بعد التبديل الجهاز القديم يُرفض 403 |
| ATTENDANT | board / not-boarded / drop-off / emergency لرحلة خطها | خطوط أخرى؛ أسماء الأهالي وأرقامهم؛ بدء الرحلة؛ عدّاد انتظار عند «لم يصعد» |
| PARENT | أبناؤه، الرحلة الحية، تفضيل 5/10/15، تسجيل غياب (NOT_BOARDED) | تعديل بياناته أو الالتقاط؛ رقم السائق؛ اتصال؛ QR |
| UNIVERSITY_STUDENT | خطوط الفرع ورحلة اليوم | حجز مقعد؛ ربط ثابت بخط |

قيود سلبية صريحة: لا QR، لا NFC، لا حجز مقعد، لا اتصال بالسائق، لا تعديل ولي الأمر لبياناته، لا مؤقت انتظار. غياب ولي الأمر عبر \`POST /parent/students/:studentId/trips/:tripId/absence\` فقط.

عزل الهاتف: المدرسة تغيّر رقم ولي الأمر ⇒ الباك يلغي الجلسات ⇒ \`401 SESSION_REVOKED\` ⇒ التطبيق يمسح SecureStorage + Isar/Hive بالكامل. لا تُبقِ قائمة أبناء قديمة.

## 3. الـ Stack

| الحزمة | الإصدار | السبب |
|---|---|---|
| Flutter | 3.29.x | مستقر لـ iOS/Android |
| flutter_riverpod | 2.6.x | حالة وDI |
| go_router | 14.x | حراسة حسب الدور |
| dio | 5.8.x | طبقة HTTP |
| retrofit | 4.x | واجهات API |
| freezed + json_serializable | 2.x / 6.x | موديلات |
| flutter_secure_storage | 9.x | توكنات |
| firebase_messaging | 15.x | FCM |
| flutter_local_notifications | 18.x | قناة وصول عالية الأهمية |
| google_maps_flutter | 2.10.x | خريطة |
| geolocator | 13.x | موقع السائق |
| socket_io_client | 2.0.3+ | يطابق الباك |
| isar أو hive | أحدث مستقر | طابور أوفلاين |

monorepo:

\`\`\`
apps/passenger/
apps/crew/
packages/core/
  lib/
    api/dio_client.dart      # refresh queue + snake/camel
    api/auth_api.dart
    models/
    realtime/socket.dart
    branding/
    offline/outbox.dart
\`\`\`

## 4. بنية المجلدات التفصيلية

\`apps/crew/lib/features/trip/start_page.dart\`, \`location_service.dart\`, \`breakdown_page.dart\`
\`apps/crew/lib/features/boarding/roster_page.dart\`
\`apps/passenger/lib/features/kids/kids_page.dart\`, \`live_trip_page.dart\`, \`arrival_preference_page.dart\`
\`apps/passenger/lib/features/university/routes_page.dart\`

## 5. فيزات الموبايل

| فيز | باك | تطبيق |
|---|---|---|
| 1 | تسجيل دخول إيميل | تسجيل الدخول في الاثنين |
| 5-6 | ركاب/خطوط | جامعة: قائمة خطوط الفرع |
| 7-8 | رحلات/تتبع | خريطة الراكب + موقع السائق |
| 9 | حوادث | أزرار عطل/طوارئ |
| 10 | إشعارات | صندوق + وصول صوتي |
| 11 | تنفيذ | بدء/إنهاء، صعود |
| 12 | ركاب | تفضيل الوصول |
| 15 | هذا الملف | عقد البناء |

## 6. الشاشات

حالات أربع في كل شاشة: تحميل / فارغ / خطأ / ممنوع.

### تسجيل الدخول (مشترك)
\`POST /auth/login\` بإيميل وكلمة سر. OTP متوقف مؤقتاً (\`/auth/otp/request|verify\` معلّقان). بعد النجاح \`GET /auth/me\` ثم توجيه: parent → أبنائي؛ university → خطوط؛ driver/attendant → اليوم.

### السائق — اليوم / سجل النشاط / التفاصيل / بدء / إنهاء / محطات / موقع / عطل / طوارئ
البدء \`POST /driver/trips/:id/start\` مع \`Idempotency-Key\`. الموقع كل 15 ثانية بعد IN_PROGRESS. الأوفلاين يكدّس ثم \`location/batch\`.
تفاصيل الرحلة و\`today\` تتضمن \`student_count\` + \`student_counts\` (\`pending\`/\`boarded\`/\`not_boarded\`/\`absent\`/\`dropped_off\`) و\`last_location\` (ماركر الباص: lat/lng/heading/speed_kph/recorded_at/is_stale؛ null إن لم يبدأ التتبع). \`GET /driver|attendant/trips/:id/location\` لنفس الكائن فقط. قراءة الطلاب: \`GET /driver/trips/:id/students\`. حدث \`trip.student.status.changed\` يحمل \`trip_stop_id\` و\`student_counts\`.

سجل النشاط: \`GET /driver/trips/history?from&to\` (pagination \`data\`+\`meta\`) و\`GET /driver/trips/stats/weekly\` (أسبوع أحد–سبت بتوقيت المؤسسة). الحمولة تشمل \`distance_km\` (من نقاط الموقع عند \`complete\`) و\`duration_minutes\` و\`code\`.

### المشرفة — اليوم / الطلاب / صعود / لم يصعد / إنزال / طوارئ / إشعارات
أسماء فقط. لا أهل. لا عدّاد. الأوفلاين لنفس الـ outbox ثم إعادة المحاولة.

صندوق الإشعارات مطابق للسائق مع تغيير الـ base path فقط:
- \`GET /attendant/notifications?page&limit\`
- \`GET /attendant/notifications/:id\` (recipient id أو FCM \`notificationId\`)
- \`PATCH /attendant/notifications/:id/read\` (\`:id\` = recipient id)
- \`PATCH /attendant/notifications/read-all\`

FCM \`data\` يضم حقول توجيه كـ strings فقط: \`notificationId\`, \`origin\`, \`audience\`, \`locale\`, و\`type\`/\`tripId\`/\`routeId\`/\`tripStudentId\`/\`studentId\` إن وُجدت — لا تعتمد على جلب الصندوق للـ deep-link.

جمهور إرسال المؤسسة للمشرفات: \`ALL_ATTENDANTS\` و\`ROUTE_ATTENDANTS\` (يتطلب \`route_id\`).  
\`data.type\` الشائعة: \`TRIP_ASSIGNED\`، \`ATTENDANT_ASSIGNED\`، \`ROUTE_CHANGE\`، \`TRIP_STARTED\`، \`TRIP_CANCELLED\`، \`INSTITUTION_BROADCAST\`.

### ولي الأمر — أبنائي / رحلة نشطة / تاريخ / تفضيل الوصول / حي / غياب
لا نماذج تعديل للملف أو الالتقاط (\`PARENT_READ_ONLY\`). لا رقم سائق في الـ live payload الذي تعتمد عليه الواجهة.

\`GET /parent/trips/:tripId/live\` (وأي \`mapLiveTrip\` / \`mapPassengerLive\`) يعيد \`stops[]\` مرتّبة بـ \`sequence\`: \`id\`, \`sequence\`, \`label\`, \`stop_type\`, \`status\`, \`latitude\`, \`longitude\`, \`eta_at\`, \`arrived_at\`. بعد \`trip.stop.arrived\` أعد جلب live: المحطة \`ARRIVED\` و\`next_stop\` يتقدم. Parent live أيضاً: \`student_stop_id\` = \`TripStudent.tripStopId\` (أو \`null\`) لنقطة منزل الابن في التايملاين.

تسجيل غياب من التقويم أو الرحلة الحية:
- تقويم (بدون رحلة): \`POST /parent/students/:studentId/absence\` جسم \`{ date: YYYY-MM-DD, reason? }\`
- رحلة حية: \`POST /parent/students/:studentId/trips/:tripId/absence\` جسم اختياري \`{ reason? }\`
- أيام غير دوام: \`GET /parent/students/:studentId/non-school-days?from&to\` → \`non_school_days\` (weekend/holiday) + \`planned_absences\`
- عطل المدرسة: \`GET/POST/DELETE /institution/holidays\`
- سياسة التقويم: اليوم/المستقبل فقط؛ رفض جمعة/سبت (\`ABSENCE_NON_SCHOOL_DAY\`) والعطل (\`ABSENCE_HOLIDAY\`) والماضي (\`ABSENCE_PAST_DATE\`)
- بلا رحلة بعد: يُحفظ \`StudentPlannedAbsence\`؛ عند توليد الرحلة يُطبَّق \`NOT_BOARDED\` + Push مرة
- مع رحلة: يفضّل OUTBOUND إن وُجدت؛ Push مرة؛ idempotent بدون push ثاني
- لا إلغاء غياب في v1

### طالب الجامعة — أنا / خطوط / جداول / اليوم / حي
قراءة فقط.

## 6.1 تتبع الموقع في الخلفية (السائق) — تفصيل إلزامي

أندرويد: Foreground Service بإشعار دائم «جاري تتبع الرحلة» طالما \`IN_PROGRESS\`. لا تعتمد على \`WorkManager\` وحده — يُقتل. استثنِ تحسينات البطارية بشرح داخل الشاشة قبل الطلب.

iOS: \`UIBackgroundModes: location\` و\`allowsBackgroundLocationUpdates = true\` فقط أثناء الرحلة النشطة. أوقف التحديث عند \`complete\`.

التدرّج: اشرح لماذا → اطلب \`whileInUse\` → عند أول بدء اطلب \`always\`. ارفض الصامت إن رُفض الإذن وأظهر إعدادات النظام.

الإرسال: كل 15 ثانية نقطة واحدة. إن فشل، اكتب في outbox. لا ترسل وأنت \`SCHEDULED\`.

بعد \`reassign\`: الجهاز القديم يتلقى 403 \`DRIVER_NOT_ASSIGNED\` أو ما يعادله — أوقف الخدمة فوراً.

## 6.2 طابور الأوفلاين

جدول outbox: \`kind=location|board|not_boarded|drop_off\`, payload، tripId، createdAt، attempts. عند العودة: \`POST /driver/trips/:id/location/batch\` للنقاط، ثم إعادة محاولات الصعود بنفس endpoints مع \`Idempotency-Key\` من معرف محلي ثابت.

لا تدمج نقاط رحلة قديمة بعد \`complete\`.

## 6.3 تنبيه اقتراب الباص الصوتي (§35)

ليس إشعاراً هادئاً. أندرويد: قناة \`arrival_alerts\` أهمية \`HIGH\` وصوت مخصص في \`res/raw\`. iOS: \`interruption-level: time-sensitive\` مع صوت في الحزمة.

حدود صريحة: وضع صامت/عدم إزعاع قد يخفض الصوت أو يمنعه على iOS — أخبر المستخدم في شاشة التفضيل. لا يمكن ضمان الصوت فوق Emergency Bypass إلا بإعداد المستخدم. التطبيق في الخلفية يعتمد على FCM + القناة، لا على socket وحده.

القيم 5 / 10 / 15 من \`PATCH /parent/students/:id/arrival-preference\`.

## 8. الأخطاء

${errorMarkdown()}

## 9. Realtime

نفس \`/realtime\`. الركاب يشتركون \`trip:{id}\` لرحلتهم النشطة فقط. الطاقم يشترك \`trip:{id}\` بعد البدء. \`trip.location.updated\` يحرّك الخريطة ويدور ماركر الباص عبر \`heading\` (دائماً موجود؛ \`null\` إذا السائق لم يرسله). \`trip.student.status.changed\` يحدّث قائمة المشرفة. \`trip.driver.changed\` على جهاز قديم = أوقف الموقع.

## 10. الاختبارات والنشر

- تكامل dio: refresh طابور متوازٍ عند 401 ثم فشل نهائي يمسح التخزين.
- اختبار عزل: بعد تغيير رقم ولي الأمر لا تظهر أسماء الأبناء القدامى.
- موقع: محاكاة انقطاع → batch بعد العودة.
- توزيع: Play / TestFlight. FCM يحتاج \`FIREBASE_SERVICE_ACCOUNT_JSON\` على الباك للإرسال الحقيقي؛ التطوير يستخدم الموك.

`;
}

async function loadDoc(): Promise<Doc> {
  const cached = join(__dirname, '.phase15', 'swagger.json');
  try {
    const response = await fetch(DOCS);
    if (response.ok) {
      return (await response.json()) as Doc;
    }
  } catch {
    /* fall back to the last downloaded spec */
  }
  if (existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8')) as Doc;
  }
  throw new Error(`docs-json unavailable — شغّل API على 3001 أو ضع swagger.json في scripts/.phase15`);
}

async function main(): Promise<void> {
  const doc = await loadDoc();
  const ops = listOperations(doc);
  const srcCodes = collectErrorCodes(join(__dirname, '..', 'src'));
  const known = new Set(ERROR_TABLE.map((row) => row[0]));
  const extra = srcCodes.filter((code) => !known.has(code));
  const extraRows = extra.map((code) => `| \`${code}\` | خطأ مجال من الباك | اعرض الرسالة وأعد التحميل |`).join('\n');

  const frontend =
    frontendNarrative().replace(
      errorMarkdown(),
      `${errorMarkdown()}${extraRows ? `\n${extraRows}` : ''}`,
    ) + apiSection(ops, doc, 'frontend');
  const mobile =
    mobileNarrative().replace(
      errorMarkdown(),
      `${errorMarkdown()}${extraRows ? `\n${extraRows}` : ''}`,
    ) + apiSection(ops, doc, 'mobile');

  writeFileSync(join(ROOT, 'FRONTEND_PLAN.md'), frontend, 'utf8');
  writeFileSync(join(ROOT, 'MOBILE_PLAN.md'), mobile, 'utf8');
  console.log(
    `wrote FRONTEND_PLAN.md and MOBILE_PLAN.md (${ops.length} swagger ops, ${srcCodes.length} error codes)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
