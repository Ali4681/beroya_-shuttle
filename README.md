<div align="center">

# Beroya On + | Shuttle Platform

**منصة متكاملة لإدارة النقل المدرسي والجامعي** — تجمع واجهة تشغيل ثنائية اللغة مع واجهة برمجية متعددة المؤسسات، لتنسيق الرحلات والأساطيل ومتابعة العمليات لحظياً.

![Backend](https://img.shields.io/badge/Backend-NestJS_11-E0234E?logo=nestjs&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-Next.js_16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)
![Database](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)
![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white)

</div>

---

## نظرة عامة

يتكون المستودع من تطبيقين يعملان معاً:

| التطبيق | المجلد | الدور |
| --- | --- | --- |
| **Backend API** | [`beroya-shuttle/`](beroya-shuttle/) | واجهة NestJS، قاعدة البيانات، العامل الخلفي، والتحديثات الآنية. |
| **Web Dashboard** | [`shuttle_dashboard/`](shuttle_dashboard/) | لوحة إدارة عربية وإنجليزية لمشرفي بيرويا والمؤسسات. |

الواجهة ترسل طلبات REST إلى الباك عبر مسار `/api/v1/shuttle`، وتتصل به للتحديثات الفورية عبر Socket.IO على `/realtime`.

## قدرات المنصة

- إدارة متعددة المؤسسات مع عزل بيانات كل مؤسسة.
- مساحات عمل بحسب الدور: إدارة بيرويا، إدارة المؤسسة، السائق، المرافق، ولي الأمر، والطالب الجامعي.
- تنظيم المسارات والرحلات اليومية وإدارة الأسطول والطلاب والطاقم.
- خرائط ومتابعة الرحلات والتحديثات الآنية، مع إدارة الحوادث والإشعارات وسجل التدقيق.
- واجهة عربية وإنجليزية تدعم اتجاه RTL، ومظهري العرض الفاتح والداكن.

## التقنيات

| المكوّن | التقنيات الرئيسية |
| --- | --- |
| Backend | NestJS 11، TypeScript، Prisma 7 |
| Frontend | Next.js 16، React 19، TypeScript، Tailwind CSS 4 |
| البيانات | PostgreSQL 16 |
| المهام والتحديثات | Redis، BullMQ، Socket.IO |
| الملفات | MinIO محلياً أو تخزين متوافق مع S3 |
| الخرائط والترجمة | Leaflet، next-intl |

## المتطلبات

- Node.js 22 موصى به لتوافق موحد مع الباك؛ يحتاج الفرونت Node.js 20.9 أو أحدث.
- npm.
- Docker Desktop أو Docker Engine مع Docker Compose.
- الخدمات المحلية: PostgreSQL 16 وRedis 7 وMinIO، ويمكن تشغيلها عبر Compose الموجود في مجلد الباك.

## التشغيل المحلي

### 1. تشغيل الباك

افتح طرفية داخل `beroya-shuttle`:

```bash
cp .env.example .env
npm ci
docker compose up -d postgres redis minio minio-init
```

في Windows PowerShell أنشئ ملف البيئة عبر:

```powershell
Copy-Item .env.example .env
```

أكمل إعداد `.env` قبل تشغيل التطبيق. يلزم ضبط اتصال PostgreSQL (`DATABASE_URL`)، ومضيف Redis (`REDIS_HOST`)، ومفتاحي JWT، وإعدادات MinIO أو R2. للتشغيل المحلي المعتاد اضبط المنفذ `3001`، واستخدم إعدادات قاعدة البيانات المطابقة لـ Compose (`beroya` / `beroya`، قاعدة `beroya_shuttle`). راجع [توثيق الباك](beroya-shuttle/README.md) و`src/config/env.schema.ts` للتفاصيل.

بعد ضبط البيئة:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run dev
```

شغّل العامل الخلفي في طرفية أخرى عند الحاجة إلى معالجة المهام:

```bash
npm run start:worker:dev
```

### 2. تشغيل الفرونت

افتح طرفية ثانية داخل `shuttle_dashboard`:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

في PowerShell:

```powershell
Copy-Item .env.example .env.local
```

افتح [http://localhost:3005](http://localhost:3005). إعدادات الفرونت الافتراضية توجه REST إلى `http://localhost:3001` عبر rewrite من Next.js، وتستخدم العنوان نفسه لاتصال Socket.IO.

### العناوين المحلية

| الخدمة | العنوان |
| --- | --- |
| لوحة التحكم | [http://localhost:3005](http://localhost:3005) |
| API | `http://localhost:3001/api/v1/shuttle` |
| Swagger | `http://localhost:3001/api/v1/shuttle/docs` |
| فحص الصحة | `http://localhost:3001/health` |
| المقاييس | `http://localhost:3001/metrics` |
| MinIO Console | `http://localhost:9001` |

## تسجيل الدخول

الحسابات يجب أن تكون موجودة مسبقاً في قاعدة البيانات، ولا يدعم النظام التسجيل الذاتي. وحدة ومسارات OTP معلّقة حالياً في إعدادات الباك؛ لذلك تحقق من عقد المصادقة الفعلي في Swagger قبل تجربة الدخول. راجع بيانات seed في `beroya-shuttle/prisma/` لمعرفة الحسابات المحلية المتاحة، واستخدم بيانات التطوير محلياً فقط.

## الإعدادات والربط

- في الفرونت، يحدد `BACKEND_URL` عنوان الباك الذي يستخدمه Next.js لإعادة توجيه `/api/v1/shuttle/*`.
- يحدد `NEXT_PUBLIC_SOCKET_URL` عنوان Socket.IO المتاح للمتصفح، عادةً عنوان الباك نفسه.
- أبقِ `NEXT_PUBLIC_API_BASE` على `/api/v1/shuttle` للاستفادة من rewrite وتجنب إعداد CORS للطلبات العادية.
- إعدادات `NEXT_PUBLIC_*` تصل إلى المتصفح؛ لا تضع فيها أسراراً.
- إعدادات الباك الإلزامية وقواعد التحقق موجودة في `beroya-shuttle/src/config/env.schema.ts`.

## الأوامر الأساسية

| المجلد | الأمر | الاستخدام |
| --- | --- | --- |
| `beroya-shuttle` | `npm run dev` | تشغيل API في وضع التطوير. |
| `beroya-shuttle` | `npm run start:worker:dev` | تشغيل عامل المهام في وضع التطوير. |
| `beroya-shuttle` | `npm run build` | بناء الباك. |
| `beroya-shuttle` | `npm run typecheck` | فحص أنواع TypeScript للباك. |
| `shuttle_dashboard` | `npm run dev` | تشغيل لوحة التحكم على المنفذ 3005. |
| `shuttle_dashboard` | `npm run build` | بناء الفرونت للإنتاج. |
| `shuttle_dashboard` | `npm run lint` | تشغيل ESLint للفرونت. |

## النشر

لكل تطبيق إعداد بناء وتشغيل مستقل. جهّز خدمات وبيانات اعتماد الإنتاج، واضبط عناوين API وSocket.IO، ثم ابنِ كل تطبيق من مجلده باستخدام أوامر npm أعلاه. يحتوي مجلد الباك على ملفات Docker وCompose ومساعد staging؛ راجع إعداداته ومتغيرات البيئة قبل اعتمادها في أي بيئة نشر.

## التوثيق التفصيلي

- [README الباك: التشغيل، البيئة، API، العامل الخلفي، والنشر](beroya-shuttle/README.md)
- [README الفرونت: الواجهة، الإعدادات، التكامل، والبناء](shuttle_dashboard/README.md)

## الترخيص

المشروع خاص وغير مرخص لإعادة التوزيع حالياً.
