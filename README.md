# ⚡ ThunderGym

نظام متابعة عملاء الجيم بالـ QR — سكان من الموبايل، حساب الأيام المتبقية لحظياً،
وتذكيرات واتساب جاهزة بضغطة واحدة.

> QR-based gym membership tracking. Phone-camera scanning, live remaining-days
> calculation, and one-tap WhatsApp reminders. Arabic / English, RTL + LTR.

---

## المحتويات

- [المميزات](#المميزات)
- [التشغيل محلياً](#التشغيل-محلياً)
- [الرفع على Vercel](#الرفع-على-vercel)
- [متغيرات البيئة](#متغيرات-البيئة)
- [منطق التذكيرات](#منطق-التذكيرات)
- [قاعدة البيانات](#قاعدة-البيانات)
- [واجهات الـ API](#واجهات-الـ-api)
- [ترقية الواتساب لإرسال أوتوماتيك](#ترقية-الواتساب-لإرسال-أوتوماتيك)

---

## المميزات

| | |
|---|---|
| 🔳 **QR لكل عميل** | كود فريد (UUID) يتولّد أوتوماتيك + كارت عضوية جاهز للطباعة أو التحميل |
| 📱 **الكاميرا هي الماسح** | مفيش مسدس باركود — افتح `/scan` من الموبايل ووجّه الكاميرا |
| ⏱️ **حساب فوري** | أول ما تمسح، بيحسب الأيام المتبقية ويعرضها في حلقة تقدّم واضحة |
| 🟢 **قرار دخول** | مسموح / مرفوض (منتهي، مجمّد، محظور، بدون اشتراك) + منع تكرار السكان |
| 💬 **تذكيرات واتساب** | رسالتين لكل اشتراك (المنتصف + قبل الانتهاء) بنص جاهز عربي أو إنجليزي |
| 🔔 **إشعارات لحظية** | جرس بصوت في اللوحة عند كل دخول وكل اشتراك قرب يخلص |
| 📅 **أي مدة اشتراك** | يوم، أسبوع، شهر، ٣ شهور، ٦ شهور، سنة، أو مدة مخصصة |
| 🌍 **عربي / إنجليزي** | تبديل بضغطة زرار مع قلب الاتجاه RTL ↔ LTR |
| 📊 **لوحة تحكم** | إحصائيات، نشاط آخر ٧ أيام، إيراد الشهر، وقائمة "محتاجين متابعة" |

**التقنيات:** Next.js 15 (App Router) · TypeScript · MySQL 8 / MariaDB (`mysql2`) ·
JWT في كوكي httpOnly (`jose`) · `bcryptjs` · `qrcode` · `html5-qrcode` · CSS يدوي بالكامل (بدون أي framework).

---

## التشغيل محلياً

### 1. المتطلبات
- Node.js 18.18+
- MySQL 8 أو MariaDB 10.5+ شغّال

### 2. إنشاء قاعدة البيانات

```sql
CREATE DATABASE thundergym CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tg'@'%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON thundergym.* TO 'tg'@'%';
FLUSH PRIVILEGES;
```

### 3. الإعداد

```bash
npm install
cp .env.example .env.local     # وعدّل DATABASE_URL و AUTH_SECRET
node scripts/setup-db.mjs      # ينشئ الجداول + الباقات + حساب الأدمن
# أو مع بيانات تجريبية:
node scripts/setup-db.mjs --demo
npm run dev
```

افتح <http://localhost:3000> → **admin / thunder123** (غيّرها من الإعدادات فوراً).

> 💡 لو مشغّلتش السكربت، افتح `/login` وهتلاقي زرار **«تجهيز النظام»** بيعمل نفس الحاجة من المتصفح.

---

## الرفع على Vercel

Vercel مش بيشغّل PHP، فالمشروع كله مبني Next.js عشان يشتغل عليه بدون أي تعديل.
اللي محتاجه بس هو **قاعدة MySQL سحابية**.

### 1. اختر مزوّد MySQL

| المزوّد | الباقة المجانية | الرابط |
|---|---|---|
| **Aiven for MySQL** | شهر تجريبي / خطة hobby | aiven.io |
| **Railway** | رصيد شهري مجاني | railway.app |
| **TiDB Cloud Serverless** | مجاني ومتوافق مع MySQL | tidbcloud.com |
| **PlanetScale** | مدفوع من 2024 | planetscale.com |
| **Hostinger / cPanel** | لو عندك استضافة بالفعل | — |

خُد الـ connection string بالشكل ده:

```
mysql://USER:PASSWORD@HOST:PORT/DBNAME
```

> لو المزوّد بيطلب SSL (وده الغالب في السحابة)، ضيف `?ssl=true` في آخر الرابط —
> الكود بيفعّل TLS أوتوماتيك لو لقى `ssl` في الـ query أو عرف الـ host.

### 2. ارفع الكود

```bash
cd thundergym
git init
git add .
git commit -m "ThunderGym v1"
git branch -M main
git remote add origin https://github.com/<username>/thundergym.git
git push -u origin main
```

### 3. اربط بـ Vercel

1. ادخل [vercel.com/new](https://vercel.com/new) واختر الريبو.
2. Framework هيتحدد Next.js أوتوماتيك — سيبه زي ما هو.
3. من **Environment Variables** ضيف:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `mysql://user:pass@host:3306/thundergym?ssl=true` |
   | `AUTH_SECRET` | ناتج `openssl rand -base64 48` |
   | `NEXT_PUBLIC_GYM_NAME` | `ThunderGym` |
   | `ADMIN_PHONE` | `201XXXXXXXXX` (رقمك بصيغة دولية بدون +) |
   | `SETUP_TOKEN` | *(اختياري لكن مُفضّل)* أي نص سري |
   | `DB_POOL_SIZE` | `3` *(اختياري — أفضل للـ serverless)* |

4. **Deploy**.

### 4. تجهيز الجداول بعد أول نشر

افتح `https://<your-app>.vercel.app/login` واضغط **«تجهيز النظام»**.

لو حاططت `SETUP_TOKEN` استخدم الأمر ده بدلاً منه:

```bash
curl -X POST https://<your-app>.vercel.app/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"setupToken":"<SETUP_TOKEN>","username":"admin","password":"<كلمة-مرور-قوية>","name":"صاحب الجيم","phone":"201XXXXXXXXX"}'
```

أو استورد `db/schema.sql` يدوياً في phpMyAdmin / MySQL Workbench.

### 5. مهم — الكاميرا

الـ QR scanner محتاج **HTTPS**. دومين Vercel بيديك HTTPS تلقائياً ✅
(لو جربت على IP محلي من الموبايل هتلاقي الكاميرا مش بتفتح — ده طبيعي).

---

## متغيرات البيئة

| المتغير | مطلوب | الوصف |
|---|:---:|---|
| `DATABASE_URL` | ✅ | رابط اتصال MySQL |
| `AUTH_SECRET` | ✅ | مفتاح توقيع الـ JWT — ١٦ حرف على الأقل |
| `NEXT_PUBLIC_GYM_NAME` | — | اسم الجيم الافتراضي (يتعدّل من الإعدادات كمان) |
| `ADMIN_PHONE` | — | رقم واتساب الأدمن اللي بيوصله الملخص |
| `SETUP_TOKEN` | — | لو موجود، `/api/setup` مش هيشتغل من غيره |
| `DB_POOL_SIZE` | — | حجم الـ connection pool (افتراضي 8، خليه 3 على Vercel) |

---

## منطق التذكيرات

طلبك كان «رسالتين: واحدة نص الشهر وواحدة آخره». الاشتراكات ممكن تكون يوم أو سنة،
فالنظام بيعمّم القاعدة بالنسبة لطول الاشتراك نفسه:

```
عتبة النهاية (endThreshold):
   المدة ≤ 2 يوم    →  يوم واحد قبل الانتهاء
   المدة ≤ 10 أيام  →  يومين
   المدة ≤ 45 يوم   →  ٣ أيام
   المدة ≤ 120 يوم  →  ٥ أيام
   أكتر من كده      →  ٧ أيام

عتبة المنتصف (midThreshold) = نصف المدة
```

- **تذكير المنتصف**: أول ما المتبقي ينزل نص المدة → يتبعت مرة واحدة بس.
- **تذكير النهاية**: أول ما المتبقي يوصل عتبة النهاية → يتبعت مرة واحدة بس.

النظام بيمنع التكرار عن طريق عمودَي `mid_notified_at` و `end_notified_at` في جدول
`subscriptions`، وكل رسالة اتبعتت بتتسجّل في جدول `wa_log`.

**أمثلة:**

| الباقة | تذكير المنتصف | تذكير النهاية |
|---|---|---|
| يوم واحد | — | نفس اليوم |
| أسبوع (٧ أيام) | فاضل ٣ أيام | فاضل يومين |
| شهر (٣٠ يوم) | فاضل ١٥ يوم | فاضل ٣ أيام |
| ٣ شهور (٩٠ يوم) | فاضل ٤٥ يوم | فاضل ٥ أيام |
| سنة (٣٦٥ يوم) | فاضل ١٨٢ يوم | فاضل ٧ أيام |

التذكيرات بتظهر في مكانين:
1. **صفحة «التذكيرات»** — قائمة بكل المستحقين + زرار «فتح واتساب» بالنص جاهز.
2. **شاشة السكان** — لو العميل اللي اتمسح مستحق تذكير، الرسالة بتظهر تحت نتيجة السكان على طول.

وكمان زرار **«ابعتلي أنا ملخص»** بيفتح واتساب على رقمك أنت بقائمة كل العملاء القرّبين يخلصوا.

---

## قاعدة البيانات

```
admins          حسابات الإدارة (bcrypt)
plans           الباقات: الاسم عربي/إنجليزي، المدة بالأيام، السعر، اللون
members         العملاء: serial (TG-000123)، qr_token (UUID)، الموبايل، الحالة
subscriptions   كل فترة اشتراك: المدة، البداية، النهاية، السعر، حالة التذكيرات
checkins        كل عملية سكان: النتيجة، الأيام المتبقية وقتها، المصدر
notifications   إشعارات لوحة التحكم (تتقرأ كل ١٠ ثواني)
wa_log          سجل رسائل الواتساب اللي اتبعتت
settings        إعدادات النظام (اسم الجيم، موبايل الأدمن، لغة الرسائل…)
```

الملف الكامل في [`db/schema.sql`](db/schema.sql).
لو عدّلته، شغّل `node scripts/gen-schema.mjs` عشان يتحدّث نسخة الـ TypeScript.

---

## واجهات الـ API

| Method | Endpoint | الوظيفة |
|---|---|---|
| `GET/POST` | `/api/setup` | حالة التنصيب / إنشاء الجداول + أول أدمن |
| `POST` | `/api/auth/login` · `/logout` | تسجيل دخول / خروج |
| `GET` | `/api/auth/me` | بيانات الجلسة الحالية |
| `GET` | `/api/stats` | إحصائيات اللوحة |
| `GET/POST` | `/api/members` | قائمة / إضافة عميل |
| `GET/PATCH/DELETE` | `/api/members/:id` | ملف عميل / تعديل / حذف |
| `POST` | `/api/members/:id/renew` | تجديد الاشتراك |
| `GET` | `/api/members/:id/qr` | كود QR كـ data-URL |
| `POST` | `/api/scan` | **قلب النظام** — يتحقق من الكود ويسجّل الدخول |
| `GET` | `/api/checkins` | سجل الدخول |
| `GET/POST` | `/api/notifications` | الإشعارات / تعليمها كمقروءة |
| `GET/POST` | `/api/reminders` | التذكيرات المستحقة / تسجيل الإرسال |
| `GET/POST/PATCH/DELETE` | `/api/plans` | إدارة الباقات |
| `GET/POST` | `/api/settings` | الإعدادات + تغيير كلمة المرور |

`/api/scan` بيقبل: محتوى الـ QR (`TG1:<uuid>`)، أو الـ UUID لوحده، أو كود العميل (`TG-000123`)،
أو حتى مجرد الرقم (`123`) — فالإدخال اليدوي بيشتغل من غير ما تكتب البادئة.

---

## ترقية الواتساب لإرسال أوتوماتيك

دلوقتي النظام بيفتح رابط `wa.me` بالنص جاهز وأنت بتضغط إرسال (مجاني تماماً، بدون أي حساب).
لو حبيت الإرسال يبقى أوتوماتيك بالكامل:

1. اعمل حساب على **WhatsApp Cloud API** (Meta) أو **Twilio**.
2. ضيف الدالة دي في `src/lib/wa.ts`:

```ts
export async function sendViaCloudApi(phone: string, text: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(phone),
        type: "text",
        text: { body: text },
      }),
    }
  );
  return res.ok;
}
```

3. في `src/app/api/reminders/route.ts` نادِ عليها بدل ما ترجّع `link` فقط.
4. ضيف **Vercel Cron** في `vercel.json` عشان يشتغل كل يوم أوتوماتيك:

```json
{ "crons": [{ "path": "/api/reminders/cron", "schedule": "0 9 * * *" }] }
```

> ⚠️ Cloud API بيطلب **قوالب رسائل معتمدة** (Message Templates) للرسائل اللي بتبدأ
> بيها المحادثة، فلازم تعتمد القالب من لوحة Meta الأول.

---

## بنية المشروع

```
thundergym/
├─ db/schema.sql                  ← سكيما قاعدة البيانات
├─ scripts/
│  ├─ setup-db.mjs                ← تجهيز محلي (+ --demo)
│  └─ gen-schema.mjs              ← توليد src/lib/schema.ts من الـ SQL
└─ src/
   ├─ app/
   │  ├─ page.tsx                 ← صفحة الهبوط
   │  ├─ login/                   ← تسجيل الدخول + التنصيب
   │  ├─ (app)/                   ← الصفحات المحمية (dashboard, scan, members…)
   │  └─ api/                     ← كل الـ endpoints
   ├─ components/                 ← Shell, Bell, Toast, I18nProvider, Icons, ui
   └─ lib/
      ├─ db.ts                    ← الـ pool والاستعلامات
      ├─ auth.ts                  ← JWT + bcrypt
      ├─ subs.ts                  ← حساب الأيام ومنطق التذكيرات
      ├─ wa.ts                    ← قوالب الرسائل وروابط wa.me
      ├─ queries.ts               ← استعلام العميل + اشتراكه الحالي
      └─ i18n.ts                  ← قاموس عربي / إنجليزي
```

---

## ملاحظات أمان قبل الإطلاق

- [ ] غيّر كلمة مرور `admin` من صفحة الإعدادات.
- [ ] استخدم `AUTH_SECRET` عشوائي طويل (`openssl rand -base64 48`).
- [ ] فعّل `SETUP_TOKEN` بعد أول تنصيب.
- [ ] خلّي مستخدم قاعدة البيانات صلاحياته على قاعدة `thundergym` بس.
- [ ] `.env.local` متترفعش على Git (موجود أصلاً في `.gitignore`).

---

© ThunderGym
