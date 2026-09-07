# 🚀 خطوات رفع ThunderGym — من الصفر للينك شغال

> الوقت المتوقع: **٢٠ – ٣٠ دقيقة**
> كل الخطوات من المتصفح، مش محتاج terminal إلا في خطوة رفع الكود.

---

## ⚠️ اقرأ ده الأول — رخصة Vercel

باقة **Vercel Hobby (المجانية) للاستخدام الشخصي غير التجاري بس.**
ThunderGym ده نظام لجيم بيشتغل بفلوس → ده استخدام تجاري.

عندك ٣ اختيارات:

| الاختيار | التكلفة | ملاحظات |
|---|---|---|
| **Vercel Pro** | $20/شهر | الأسهل والأسرع، وكل حاجة جاهزة |
| **Vercel Hobby** | مجاني | شغّال فنياً لكنه مخالف للشروط — ممكن يتقفل |
| **بديل يسمح بالتجاري** | $0 – $5 | Railway أو Render أو VPS صغير |

نصيحتي: **ابدأ بـ Hobby للتجربة مع أصحاب الجيم**، ولما تتفقوا وتقبضوا اعمل ترقية Pro.

---

## الخطوة ١ — قاعدة البيانات (TiDB Cloud — مجاني)

اخترنا TiDB لأنه **MySQL متوافق ١٠٠٪ مع الكود**، **٥ جيجا مجاناً**، و**مبيقفش عند عدم الاستخدام**
(عكس Aiven اللي بينام).

1. ادخل <https://tidbcloud.com> → **Sign up** (بـ Google أو GitHub).
2. اضغط **Create Cluster** → اختر **Starter (Free)**.
3. اختر أقرب Region (`Frankfurt` أو `Singapore` أحسن حاجة لمصر).
4. اضغط **Create** — هيجهز في دقيقة.
5. من صفحة الكلاستر اضغط **Connect**:
   - **Connect With**: اختر `General`
   - انسخ: `Host` · `Port` · `User` · اضغط **Generate Password** وانسخ الباسورد
6. اضغط **SQL Editor** من القائمة الجانبية ونفّذ:

   ```sql
   CREATE DATABASE thundergym CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

7. ركّب الرابط بالشكل ده واحتفظ بيه:

   ```
   mysql://USER:PASSWORD@HOST:4000/thundergym?ssl=true
   ```

   > 🔴 لو الباسورد فيه رموز زي `@` أو `#`، لازم تعملها URL-encode
   > (`@` → `%40` · `#` → `%23` · `/` → `%2F`).

**بدائل لو مش عاجبك TiDB:**
- **Aiven** (mysql حقيقي، ١ جيجا مجاني، بس بينام بعد فترة خمول)
- **Railway** ($5 رصيد شهري، MySQL حقيقي، مبينامش)
- **استضافتك الحالية** لو عندك cPanel فيه MySQL — استخدمه على طول

---

## الخطوة ٢ — رفع الكود على GitHub

حمّل فولدر `thundergym` من الـ workspace، وبعدين من الترمنال:

```bash
cd thundergym
git init
git add .
git commit -m "ThunderGym v1"
git branch -M main
git remote add origin https://github.com/<اسم-حسابك>/thundergym.git
git push -u origin main
```

> ✅ ملف `.env.local` **مش هيترفع** (متحطوط في `.gitignore`) — كده كلمات السر آمنة.

**من غير ترمنال؟** ادخل <https://github.com/new> → اعمل repo فاضي →
اضغط **uploading an existing file** → اسحب كل الملفات ما عدا `node_modules` و `.next`.

---

## الخطوة ٣ — النشر على Vercel

1. ادخل <https://vercel.com/new> وسجّل دخول بـ GitHub.
2. اختر ريبو `thundergym` → **Import**.
3. Framework Preset هيتحدد **Next.js** لوحده — سيبه.
4. افتح **Environment Variables** وضيف دول:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | الرابط من الخطوة ١ |
   | `AUTH_SECRET` | نص عشوائي طويل (شوف تحت) |
   | `NEXT_PUBLIC_GYM_NAME` | `ThunderGym` |
   | `ADMIN_PHONE` | رقمك بصيغة دولية بدون + مثال `201012345678` |
   | `SETUP_TOKEN` | أي نص سري تخترعه انت |
   | `DB_POOL_SIZE` | `3` |

   **توليد `AUTH_SECRET`:**
   ```bash
   openssl rand -base64 48
   ```
   من غير ترمنال: <https://generate-secret.vercel.app/48>

5. اضغط **Deploy** واستنى ٢ – ٣ دقيقة.

---

## الخطوة ٤ — تجهيز الجداول (مرة واحدة بس)

بعد ما النشر يخلص، هيديك لينك زي `https://thundergym-xxxx.vercel.app`.

**لو مضفتش `SETUP_TOKEN`:**
افتح `/login` → هتلاقي صندوق أصفر → اضغط **«تجهيز النظام»**. خلاص.

**لو مضيفه (وده الأأمن):**

```bash
curl -X POST https://<اللينك-بتاعك>/api/setup \
  -H 'Content-Type: application/json' \
  -d '{
    "setupToken": "<SETUP_TOKEN>",
    "username": "admin",
    "password": "<كلمة-مرور-قوية>",
    "name": "صاحب الجيم",
    "phone": "201012345678"
  }'
```

الرد المفروض يكون: `{"ok":true,"installed":true,"adminCreated":true}`

---

## الخطوة ٥ — تشيك ليست قبل ما تبعت اللينك

- [ ] فتحت `/login` ودخلت بنجاح
- [ ] غيّرت كلمة مرور `admin` من **الإعدادات**
- [ ] حطيت رقم موبايلك في **الإعدادات ← موبايل الأدمن**
- [ ] سجّلت عميل تجريبي وطلع له QR
- [ ] فتحت `/scan` **من الموبايل** وجرّبت الكاميرا فعلاً ✅
- [ ] جرّبت زرار «فتح واتساب» وشُفت الرسالة جاهزة
- [ ] مسحت العميل التجريبي

> 📸 **الكاميرا محتاجة HTTPS.** لينك Vercel بيديك HTTPS تلقائي، فهي هتشتغل.
> لو جربت على `http://192.168.x.x` من الموبايل مش هتفتح — ده طبيعي.

---

## الخطوة ٦ — دومين باسم الجيم (اختياري)

`thundergym-xxxx.vercel.app` شكله مش احترافي قدام العميل.

1. اشتري دومين (Namecheap / GoDaddy / أي حتة) — حوالي $10 في السنة.
2. في Vercel: **Settings ← Domains ← Add**.
3. حط الـ DNS records اللي هيديهالك عند مزوّد الدومين.
4. الـ SSL بيتظبط لوحده خلال دقايق.

النتيجة: `https://gym.thundergym.com` 💪

---

## مشاكل شائعة وحلولها

| المشكلة | السبب | الحل |
|---|---|---|
| `Cannot reach the database` | الرابط غلط أو SSL ناقص | تأكد من `?ssl=true` ومن الـ URL-encode للباسورد |
| `Database not initialised` | نسيت خطوة ٤ | نفّذ `/api/setup` |
| الكاميرا مش بتفتح | صلاحية مرفوضة | إعدادات المتصفح ← اسمح بالكاميرا للموقع |
| صفحة بيضا بعد الديبلوي | متغير بيئة ناقص | Vercel ← Deployments ← Logs، وشوف الخطأ |
| عدّلت متغير ومحصلش حاجة | لازم إعادة نشر | Deployments ← آخر واحد ← **Redeploy** |

---

## بعد كده

- **بيانات حقيقية**: سجّل العملاء واحد واحد من `/members/new`، أو قولّي وأعملك استيراد من Excel.
- **باك أب**: TiDB بياخد نسخ تلقائي، بس خد نسخة يدوية كل فترة من SQL Editor.
- **واتساب أوتوماتيك**: القسم الأخير في `README.md` بيشرح الربط بـ WhatsApp Cloud API.
