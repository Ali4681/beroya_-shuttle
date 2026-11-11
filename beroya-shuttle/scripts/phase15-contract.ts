import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const PREFIX = '/api/v1/shuttle';
export const HTTP = new Set(['get', 'post', 'put', 'patch', 'delete']);

export type Operation = {
  summary?: string;
  tags?: string[];
  parameters?: Array<{
    name?: string;
    in?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, { description?: string; content?: unknown }>;
};

export type Doc = {
  paths?: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Record<string, unknown>> };
};

export type ListedOp = {
  method: string;
  path: string;
  displayPath: string;
  summary: string;
  audience: 'frontend' | 'mobile' | 'both';
  group: string;
  role: string;
  screen: string;
  operation: Operation;
};

export function displayPath(path: string): string {
  if (path.startsWith(PREFIX) || path === '/health' || path === '/metrics') {
    return path;
  }
  if (path.startsWith('/docs')) {
    return `${PREFIX}${path}`;
  }
  return path.startsWith('/') ? `${PREFIX}${path}` : `${PREFIX}/${path}`;
}

export function classify(path: string): ListedOp['audience'] {
  const p = path.replace(PREFIX, '') || path;
  if (p.startsWith('/auth') || p === '/health' || p.endsWith('/health')) {
    return 'both';
  }
  if (
    p.startsWith('/driver') ||
    p.startsWith('/attendant') ||
    p.startsWith('/parent') ||
    p.startsWith('/university')
  ) {
    return 'mobile';
  }
  return 'frontend';
}

export function groupOf(path: string): string {
  const p = path.replace(PREFIX, '') || path;
  const first = p.split('/').filter(Boolean)[0] ?? 'ops';
  return first;
}

export function roleOf(path: string): string {
  const p = path.replace(PREFIX, '') || path;
  if (
    p === '/auth/login' ||
    // OTP parked — restore: p.startsWith('/auth/otp') ||
    p === '/auth/refresh' ||
    p === '/health' ||
    p === '/metrics'
  ) {
    return 'PUBLIC';
  }
  if (p.startsWith('/auth')) {
    return 'أي دور مصادق';
  }
  if (p.startsWith('/admin')) {
    return 'BEROYA_ADMIN';
  }
  if (p.startsWith('/institution')) {
    return 'INSTITUTION_ADMIN';
  }
  if (p.startsWith('/driver')) {
    return 'DRIVER';
  }
  if (p.startsWith('/attendant')) {
    return 'ATTENDANT';
  }
  if (p.startsWith('/parent')) {
    return 'PARENT';
  }
  if (p.startsWith('/university')) {
    return 'UNIVERSITY_STUDENT';
  }
  return 'PUBLIC';
}

export function screenOf(path: string, audience: ListedOp['audience']): string {
  const p = path.replace(PREFIX, '') || path;
  if (p.startsWith('/auth')) {
    return audience === 'mobile' ? 'تسجيل الدخول / الجلسة' : 'تسجيل الدخول / الجلسة';
  }
  if (p.startsWith('/admin/institutions') && p.includes('subscription')) {
    return 'اشتراكات المؤسسة';
  }
  if (p.startsWith('/admin/institutions')) {
    return 'إدارة المؤسسات';
  }
  if (p.startsWith('/admin/drivers') || p.startsWith('/admin/vehicles')) {
    return 'موارد بيرويا';
  }
  if (p.startsWith('/admin/dashboard') || p.startsWith('/admin/search') || p.startsWith('/admin/audit')) {
    return 'لوحة بيرويا / بحث / تدقيق';
  }
  if (p.startsWith('/admin/ops')) {
    return 'عمليات المنصة';
  }
  if (p.startsWith('/admin/bootstrap')) {
    return 'إقلاع لوحة بيرويا';
  }
  if (p.includes('live-map') || p.includes('live-trips') || p.includes('/live')) {
    return audience === 'mobile' ? 'الخريطة الحية' : 'الخريطة الحية';
  }
  if (p.includes('/trips') && p.includes('generate')) {
    return 'توليد الرحلات';
  }
  if (p.includes('/routes')) {
    return 'الخطوط والجداول والمحطات';
  }
  if (p.includes('/students') && p.includes('university')) {
    return 'طلاب الجامعة';
  }
  if (p.includes('/students')) {
    return audience === 'mobile' ? 'أبنائي / ملفي' : 'الطلاب والأهالي';
  }
  if (p.includes('/parents')) {
    return 'الطلاب والأهالي';
  }
  if (p.includes('/branches')) {
    return 'الفروع';
  }
  if (p.includes('/drivers') || p.includes('/vehicles') || p.includes('/attendants')) {
    return 'السائقون والمركبات والمشرفات';
  }
  if (p.includes('/meeting-points')) {
    return 'نقاط التجمع';
  }
  if (p.includes('/notifications')) {
    return audience === 'mobile' ? 'صندوق الإشعارات' : 'إرسال الإشعارات';
  }
  if (p.includes('/incidents') || p.includes('breakdown') || p.includes('emergency')) {
    return audience === 'mobile' ? 'عطل / طوارئ' : 'صندوق الانتباه والحوادث';
  }
  if (p.includes('/trips')) {
    return audience === 'mobile' ? 'رحلة اليوم' : 'الرحلات اليومية';
  }
  if (p.includes('dashboard') || p.includes('search') || p.includes('audit')) {
    return 'لوحة المؤسسة / بحث / تدقيق';
  }
  if (p.includes('bootstrap') || p.includes('branding') || p.includes('settings') || p.includes('profile')) {
    return 'إعدادات وهوية المؤسسة';
  }
  if (p === '/health' || p === '/metrics') {
    return 'مراقبة التشغيل';
  }
  return 'شاشة عامة';
}

export function listOperations(doc: Doc): ListedOp[] {
  const rows: ListedOp[] = [];
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (!HTTP.has(method) || !operation) {
        continue;
      }
      const audience = classify(path);
      rows.push({
        method: method.toUpperCase(),
        path,
        displayPath: displayPath(path),
        summary: operation.summary ?? `${method.toUpperCase()} ${path}`,
        audience,
        group: groupOf(path),
        role: roleOf(path),
        screen: screenOf(path, audience),
        operation,
      });
    }
  }
  return rows.sort((a, b) => a.displayPath.localeCompare(b.displayPath) || a.method.localeCompare(b.method));
}

export function collectErrorCodes(srcRoot: string): string[] {
  const codes = new Set<string>([
    'UNAUTHORIZED',
    'SESSION_REVOKED',
    'FORBIDDEN',
    'TENANT_REQUIRED',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'ROOM_FORBIDDEN',
    'ROOM_REQUIRED',
  ]);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'generated' || entry.name === 'node_modules') {
          continue;
        }
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
        continue;
      }
      const text = readFileSync(full, 'utf8');
      const re = /(?:AppException\(\s*'([A-Z][A-Z0-9_]+)'|code:\s*'([A-Z][A-Z0-9_]+)')/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text))) {
        codes.add(match[1] ?? match[2]);
      }
    }
  };
  walk(srcRoot);
  return [...codes].filter((code) => !code.startsWith('P2')).sort();
}

export function schemaExample(
  schema: Record<string, unknown> | undefined,
  doc: Doc,
  depth = 0,
): unknown {
  if (!schema || depth > 4) {
    return {};
  }
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.split('/').pop() ?? '';
    return schemaExample(doc.components?.schemas?.[name], doc, depth + 1);
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  if (schema.type === 'array') {
    return [schemaExample(schema.items as Record<string, unknown>, doc, depth + 1)];
  }
  if (schema.enum) {
    return (schema.enum as unknown[])[0];
  }
  if (schema.type === 'string') {
    return schema.format === 'uuid'
      ? '11111111-1111-4111-8111-111111111111'
      : schema.format === 'date-time'
        ? '2026-10-03T07:30:00.000Z'
        : schema.format === 'date'
          ? '2026-10-03'
          : 'string';
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return 1;
  }
  if (schema.type === 'boolean') {
    return true;
  }
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (props) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      out[key] = schemaExample(value, doc, depth + 1);
    }
    return out;
  }
  return {};
}

export function describeSchema(
  schema: Record<string, unknown> | undefined,
  doc: Doc,
  depth = 0,
): string {
  if (!schema || depth > 5) {
    return 'object';
  }
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.split('/').pop() ?? '';
    return describeSchema(doc.components?.schemas?.[name], doc, depth + 1);
  }
  if (schema.enum) {
    return `enum(${(schema.enum as unknown[]).join(' | ')})`;
  }
  if (schema.type === 'array') {
    return `${describeSchema(schema.items as Record<string, unknown>, doc, depth + 1)}[]`;
  }
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (props) {
    const required = new Set((schema.required as string[] | undefined) ?? []);
    const lines = Object.entries(props).map(([key, value]) => {
      const flag = required.has(key) ? 'إلزامي' : 'اختياري';
      return `  ${key}: ${describeSchema(value, doc, depth + 1)} — ${flag}`;
    });
    return `{\n${lines.join('\n')}\n}`;
  }
  return String(schema.type ?? 'object');
}

export function renderOperation(op: ListedOp, doc: Doc): string {
  const params = op.operation.parameters ?? [];
  const pathParams = params.filter((item) => item.in === 'path');
  const queryParams = params.filter((item) => item.in === 'query');
  const bodySchema =
    op.operation.requestBody?.content?.['application/json']?.schema ??
    op.operation.requestBody?.content?.['application/json; charset=utf-8']?.schema;
  const successKey =
    Object.keys(op.operation.responses ?? {}).find((key) =>
      ['200', '201', '204'].includes(key),
    ) ?? '200';
  const success = op.operation.responses?.[successKey];
  const notes: string[] = [];
  if (op.displayPath.includes('/start') || op.displayPath.includes('/notifications') || op.displayPath.includes('/board')) {
    notes.push('يقبل رأس Idempotency-Key على هذا الـ POST الحساس.');
  }
  if (op.displayPath.includes('notify') || op.displayPath.includes('status') || op.displayPath.includes('default-assignment')) {
    notes.push('إن وُجد notify_users فهو اختياري ويُرسل إشعاراً لأهالي الخط فقط عند true.');
  }
  if (op.displayPath.includes('/location')) {
    notes.push('مقبول فقط والرحلة IN_PROGRESS وللسائق المعيّن حالياً.');
  }
  if (op.method === 'GET' && !op.operation.requestBody) {
    notes.push('لا جسم طلب. الاستجابة مغلفة `{ data, meta? }` بعد تحويل snake_case.');
  } else {
    notes.push('الجسم الخارجي JSON snake_case. الباك يحوّله إلى camelCase داخلياً ويعيد `{ data }` بـ snake_case.');
  }

  return [
    `### ${op.summary}`,
    `${op.method} ${op.displayPath}`,
    '',
    `الدور المسموح: ${op.role}`,
    `يُستخدم في الشاشة: ${op.screen}`,
    '',
    `Path params:   ${
      pathParams.length
        ? pathParams
            .map(
              (item) =>
                `:${item.name} — ${item.required === false ? 'اختياري' : 'إلزامي'} (${String((item.schema?.format as string) || (item.schema?.type as string) || 'string')})`,
            )
            .join('؛ ')
        : 'لا يوجد'
    }`,
    `Query params:  ${
      queryParams.length
        ? queryParams
            .map(
              (item) =>
                `${item.name}${item.required ? '' : '?'} (${String((item.schema?.type as string) || 'string')})`,
            )
            .join(', ')
        : 'لا يوجد'
    }`,
    '',
    'Request body:',
    bodySchema
      ? `${describeSchema(bodySchema, doc)}\n\nمثال:\n${JSON.stringify(schemaExample(bodySchema, doc), null, 2)}`
      : 'لا يوجد',
    '',
    `Response ${successKey}:`,
    `{ data: object, meta?: { page, limit, total } } — ${success?.description || 'نجاح'}`,
    `مثال:\n${JSON.stringify({ data: schemaExample({ type: 'object' }, doc), meta: null }, null, 2)}`,
    '',
    'Errors:',
    '401 UNAUTHORIZED | SESSION_REVOKED',
    '403 FORBIDDEN | TENANT_REQUIRED',
    '400 VALIDATION_ERROR',
    '404 إن وُجد المعرّف ولم يُعثر على المورد داخل نطاق المؤسسة',
    '409 تعارض حالة المجال (انظر جدول الأخطاء)',
    '429 RATE_LIMITED',
    '',
    `ملاحظات: ${notes.join(' ')}`,
    '',
  ].join('\n');
}

export const ERROR_TABLE: Array<[string, string, string]> = [
  ['UNAUTHORIZED', 'انتهت الجلسة أو التوكن غير صالح', 'حاول تجديد refresh؛ إن فشل امسح التخزين وافتح تسجيل الدخول'],
  ['SESSION_REVOKED', 'تم إلغاء هذه الجلسة', 'امسح التوكنات والكاش المحلي وافتح تسجيل الدخول'],
  ['FORBIDDEN', 'هذا الدور لا يملك هذه الشاشة', 'أظهر حالة ممنوع دون تسريب بيانات'],
  ['TENANT_REQUIRED', 'هذا المسار يحتاج مؤسسة', 'لا تستدعِ مسارات المؤسسة من حساب بيرويا بلا سياق'],
  ['VALIDATION_ERROR', 'الحقول غير صحيحة', 'اعرض details.errors تحت الحقول'],
  ['RATE_LIMITED', 'محاولات كثيرة', 'أوقف الإرسال وأظهر انتظار OTP'],
  ['INTERNAL_ERROR', 'خطأ غير متوقع', 'رسالة عامة مع إعادة المحاولة'],
  ['ROOM_FORBIDDEN', 'لا يمكن الاشتراك في هذه الغرفة', 'لا تعِد المحاولة لنفس الغرفة'],
  ['ROOM_REQUIRED', 'اسم الغرفة مطلوب', 'أصلح العميل'],
  ['USER_SUSPENDED', 'الحساب معلّق', 'أوقف التطبيق واطلب الدعم'],
  ['INSTITUTION_SUSPENDED', 'المؤسسة معلّقة', 'أوقف التشغيل واطلب بيرويا'],
  ['INVALID_DATE', 'التاريخ يجب أن يكون YYYY-MM-DD', 'صحّح حقل التاريخ'],
  ['TRIP_NOT_SCHEDULED', 'العملية مسموحة والرحلة مجدولة فقط', 'أخفِ الزر إن لم تكن SCHEDULED'],
  ['TRIP_NOT_REASSIGNABLE', 'لا يمكن التبديل الآن', 'اسمح بالتبديل فقط SCHEDULED أو IN_PROGRESS'],
  ['TRIP_ALREADY_COMPLETED', 'الرحلة منتهية', 'حوّل للملخص'],
  ['TRIP_ALREADY_CANCELLED', 'الرحلة ملغاة', 'حوّل للملخص'],
  ['TRIP_CANCELLED', 'الرحلة ملغاة', 'امنع البدء والإكمال'],
  ['TRIP_NOT_STARTED', 'يجب بدء الرحلة أولاً', 'اطلب من السائق الضغط على بدء'],
  ['TRIP_NOT_FOUND', 'الرحلة غير موجودة في نطاقك', '404 داخل المؤسسة'],
  ['ROUTE_NOT_FOUND', 'الخط غير موجود', 'أرجع لقائمة الخطوط'],
  ['ROUTE_REQUIRED', 'هذا الجمهور يحتاج route_id', 'أظهر اختيار الخط'],
  ['RESOURCE_OWNED_BY_BEROYA', 'المورد ملك بيرويا', 'أخفِ أزرار التعديل'],
  ['SUBSCRIPTION_INVALID_WINDOW', 'فترة الاشتراك غير صالحة', 'صحّح التواريخ'],
  ['SUBSCRIPTION_OVERLAP', 'تداخل مع اشتراك نشط', 'اعرض الاشتراك المتعارض'],
  ['SUBSCRIPTION_NOT_PENDING', 'التفعيل للنسخة المعلّقة فقط', 'حدّث الحالة'],
  ['SUBSCRIPTION_NOT_CANCELLABLE', 'لا يمكن إلغاء هذه الحالة', 'أخفِ الإلغاء'],
  ['SUBSCRIPTION_NOT_ACTIVE', 'التمديد لاشتراك نشط فقط', 'أخفِ التمديد'],
  ['SUBSCRIPTION_EXTEND_INVALID', 'التاريخ الجديد يجب أن يكون بعد الحالي', 'صحّح ends_at'],
  ['INVALID_DEPARTURE_TIME', 'الوقت HH:mm', 'صحّح الحقل'],
  ['INVALID_DAYS_OF_WEEK', 'أيام الأسبوع 1-7', 'صحّح المصفوفة'],
  ['SCHOOL_SCHEDULE_LIMIT', 'جدول واحد لكل اتجاه في المدرسة', 'امنع جدولاً ثانياً'],
  ['STOP_ORDER_MISMATCH', 'الترتيب يجب أن يشمل كل المحطات مرة واحدة', 'أعد الاقتراح'],
  ['DRIVER_NOT_FOUND', 'السائق غير موجود', 'حدّث القائمة'],
  ['DRIVER_NOT_ASSIGNED', 'لا سائق معيّن على الرحلة', 'امنع الموقع والبدء'],
  ['DRIVER_NOT_AVAILABLE', 'السائق غير متاح لهذا النموذج', 'لا تعرض سائقي بيرويا لمؤسسة INSTITUTION_OPERATED'],
  ['VEHICLE_NOT_FOUND', 'المركبة غير موجودة', 'حدّث القائمة'],
  ['VEHICLE_NOT_AVAILABLE', 'المركبة غير متاحة', 'فلتر حسب نموذج التشغيل'],
  ['ATTENDANT_NOT_FOUND', 'المشرفة غير موجودة', 'حدّث القائمة'],
  ['ATTENDANT_NOT_ASSIGNED', 'لا مشرفة معيّنة', 'امنع الطوارئ من المشرفة'],
  ['ATTENDANT_ALREADY_ASSIGNED', 'المشرفة مرتبطة بخط آخر', 'اختر مشرفة غير معيّنة'],
  ['REASSIGN_EMPTY', 'يجب اختيار سائق أو مركبة أو مشرفة', 'املأ حقلاً واحداً على الأقل'],
  ['INCIDENT_NOT_FOUND', 'الحادثة غير موجودة', 'أرجع للصندوق'],
  ['INCIDENT_ALREADY_RESOLVED', 'الحادثة محلولة', 'أخفِ الحل'],
  ['INCIDENT_TRIP_MISMATCH', 'الحادثة ليست لهذه الرحلة', 'اربط حادثة الرحلة نفسها'],
  ['AUDIT_LOG_NOT_FOUND', 'سجل التدقيق غير موجود', 'أرجع للقائمة'],
  ['USER_NOT_FOUND', 'المستخدم غير موجود', 'أرجع للقائمة'],
  ['STUDENT_NOT_FOUND', 'الطالب غير موجود أو ليس ابنك', 'امسح الكاش عند 401'],
  ['UNIVERSITY_STUDENT_NOT_FOUND', 'ملف طالب الجامعة غير موجود', 'أرجع للدخول'],
  ['INVALID_ARRIVAL_MINUTES', 'الدقائق 5 أو 10 أو 15 فقط', 'قيّد الاختيار'],
  ['PARENT_READ_ONLY', 'ولي الأمر لا يعدّل بياناته', 'لا تعرض نماذج تعديل'],
  ['ABSENCE_NOT_ALLOWED', 'لا يمكن تسجيل الغياب لهذه الرحلة أو حالة الصعود', 'أخفِ زر الغياب أو اعرض السبب'],
  ['ABSENCE_PAST_DATE', 'لا يمكن تسجيل غياب لتاريخ ماضٍ', 'عطّل الأيام الماضية'],
  ['ABSENCE_NON_SCHOOL_DAY', 'الجمعة والسبت ليسا أيام دوام', 'عطّل الجمعة والسبت'],
  ['ABSENCE_HOLIDAY', 'هذا اليوم عطلة ولا يُسجّل فيه غياب', 'عطّل العطل من الـ API'],
  ['STOP_NOT_FOUND', 'المحطة غير موجودة في الرحلة', 'حدّث قائمة المحطات'],
  ['TRIP_STUDENT_NOT_FOUND', 'سجل صعود الطالب غير موجود', 'حدّث قائمة الرحلة'],
  ['INVALID_STUDENT_TRANSITION', 'انتقال حالة الصعود غير مسموح', 'اعرض الانتقالات المتاحة فقط'],
  ['NOTIFICATION_NOT_FOUND', 'الإشعار غير موجود', 'أرجع للصندوق'],
  ['INSTITUTION_NOT_FOUND', 'المؤسسة غير موجودة', 'أرجع للقائمة'],
  ['PICKUP_HOME_LOCATION_REQUIRED', 'التقاط المنزل يحتاج إحداثيات', 'افتح الخريطة'],
  ['PICKUP_MEETING_POINT_REQUIRED', 'التقاط نقطة التجمع يحتاج معرف النقطة', 'اختر نقطة'],
  ['VEHICLE_PLATE_ALREADY_REGISTERED', 'اللوحة مسجّلة عالمياً', 'غيّر اللوحة'],
  ['ACCOUNT_AMBIGUOUS', 'نفس الرقم يرتبط بأكثر من حساب', 'اطلب الدعم ولا تخمّن الدور'],
  ['ACCOUNT_DELETE_NOT_ALLOWED', 'لا يمكن حذف هذا النوع من الحسابات', 'الحذف متاح لحسابات الموبايل فقط'],
  ['BRANCH_LOCATION_REQUIRED', 'إحداثيات الفرع مطلوبة', 'افتح الخريطة قبل الحفظ'],
  ['BRANCH_NAME_TAKEN', 'اسم الفرع مستخدم', 'غيّر الاسم'],
  ['BRANCH_NOT_EMPTY', 'لا يمكن حذف فرع فيه بيانات', 'انقل الخطوط أولاً'],
  ['BRANCH_NOT_FOUND', 'الفرع غير موجود', 'أرجع للقائمة'],
  ['DEVICE_NOT_FOUND', 'الجهاز غير مسجّل', 'أعد تسجيل FCM'],
  ['EXCEPTION_ALREADY_EXISTS', 'استثناء هذا اليوم موجود', 'عدّل أو احذف الحالي'],
  ['EXCEPTION_NOT_FOUND', 'الاستثناء غير موجود', 'حدّث القائمة'],
  ['EXCEPTION_SAME_ROUTE', 'الاستثناء يجب أن يغيّر الخط', 'اختر خطاً آخر'],
  ['EXCEPTION_TRIP_STARTED', 'لا استثناء بعد بدء الرحلة', 'أخفِ الزر بعد IN_PROGRESS'],
  ['INSTITUTION_NOT_ACTIVE', 'المؤسسة غير نشطة', 'فعّل الاشتراك أولاً'],
  ['INSTITUTION_STOP_FIXED', 'محطة المؤسسة ثابتة', 'لا تحذفها من الترتيب'],
  ['INVALID_TIMEZONE', 'منطقة زمنية غير صالحة', 'استخدم IANA مثل Asia/Damascus'],
  ['MEETING_POINT_IN_USE', 'نقطة التجمع مرتبطة بطلاب', 'أزل الربط أولاً'],
  ['MEETING_POINT_NOT_FOUND', 'نقطة التجمع غير موجودة', 'حدّث القائمة'],
  ['NO_ACTIVE_SUBSCRIPTION', 'لا اشتراك نشط', 'أظهر شاشة الاشتراك'],
  ['OTP_EXPIRED', 'انتهت صلاحية الرمز', 'اطلب رمزاً جديداً'],
  ['OTP_INVALID', 'رمز غير صحيح', 'أعد الإدخال'],
  ['OTP_MAX_ATTEMPTS', 'تجاوزت محاولات الرمز', 'اطلب رمزاً جديداً لاحقاً'],
  ['OTP_RATE_LIMITED', 'طلبات رمز كثيرة', 'انتظر'],
  ['OTP_THROTTLED', 'طلبات رمز متقاربة', 'انتظر'],
  ['PARENT_NOT_FOUND', 'ولي الأمر غير موجود', 'أرجع للقائمة'],
  ['PHONE_IN_USE', 'الرقم مستخدم في هذه المؤسسة', 'استخدم رقماً آخر'],
  ['PICKUP_REQUIRED', 'موقع الالتقاط مطلوب', 'أكمل التقاط المنزل أو النقطة'],
  ['PLATE_IN_USE', 'اللوحة مسجّلة', 'غيّر اللوحة'],
  ['REFRESH_EXPIRED', 'انتهت جلسة التحديث', 'سجّل الدخول من جديد'],
  ['REFRESH_INVALID', 'رمز التحديث غير صالح', 'سجّل الدخول من جديد'],
  ['REFRESH_TOKEN_REUSED', 'أُعيد استخدام رمز التحديث', 'امسح كل الجلسات وادخل من جديد'],
  ['ROUTE_NAME_IN_USE', 'اسم الخط مستخدم', 'غيّر الاسم'],
  ['SCHEDULE_NOT_FOUND', 'الجدول غير موجود', 'حدّث قائمة الجداول'],
  ['SCHEDULE_TIME_IN_USE', 'وقت الجدول مأخوذ', 'غيّر الوقت'],
  ['STATUS_REASON_REQUIRED', 'سبب تغيير الحالة مطلوب', 'أظهر حقل السبب'],
  ['STOP_HAS_STUDENTS', 'المحطة مرتبطة بطلاب', 'أزل الطلاب أولاً'],
  ['STUDENT_NOT_ON_ROUTE', 'الطالب ليس على هذا الخط', 'حدّث التعيين'],
  ['STUDENT_NUMBER_IN_USE', 'الرقم الأكاديمي مستخدم', 'غيّر الرقم'],
  ['SUBSCRIPTION_NOT_FOUND', 'الاشتراك غير موجود', 'أرجع للقائمة'],
  ['SUBSCRIPTION_WINDOW_PASSED', 'نافذة الاشتراك انتهت', 'أنشئ اشتراكاً جديداً'],
  ['UPLOAD_MIME_NOT_ALLOWED', 'نوع الملف غير مسموح', 'اقبل JPEG أو PNG أو WebP فقط'],
  ['UPLOAD_TOO_LARGE', 'حجم الملف أكبر من الحد', 'الشعار ≤ 2MB وصورة الطالب ≤ 1MB'],
  ['UPLOAD_NOT_FOUND', 'الملف لم يُرفع بعد', 'ارفع إلى رابط presign ثم استدعِ complete'],
  ['UPLOAD_KEY_FORBIDDEN', 'الملف لا يخص هذه المؤسسة', 'لا تستخدم مفتاح مؤسسة أخرى'],
  ['LOGO_NOT_SQUARE', 'الشعار يجب أن يكون مربعاً', 'ارفض المعاينة واطلب صورة عرضها = ارتفاعها'],
  ['LOGO_MUST_BE_UPLOADED', 'الشعار يجب أن يُرفع عبر المسار الرسمي', 'لا تقبل رابطاً خارجياً في branding'],
  ['STORAGE_UNAVAILABLE', 'التخزين غير متاح', 'أظهر إعادة المحاولة ولا تحفظ الرابط'],
  ['UPLOAD_INVALID_IMAGE', 'الملف ليس صورة صالحة', 'أعد الرفع بملف JPEG أو PNG أو WebP'],
];
