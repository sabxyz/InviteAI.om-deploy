# دليل ربط بوت تيليجرام + Google Form + Manychat

هذا الدليل يكمّل `SETUP-event-dynamic.md`. تأكد إنك خلّصت هناك أول (الشيت + Apps Script منشور وشغّال) قبل ما تبدأ هنا.

الكود بـ `backend/Code.gs` تحدّث وفيه الآن: أوامر بوت تيليجرام (`/pause` `/resume` `/status`)، أزرار موافقة على الطلبات، واستقبال ردود Google Form تلقائياً. **لازم تنشر نسخة جديدة** من الكود بعد ما تحدّثه (راجع الخطوة 0 تحت).

---

## 0) حدّث نسخة الكود المنشورة

1. بمشروع Apps Script (نفسه اللي فيه event.html)، امسح محتوى `Code.gs` والصق النسخة الجديدة الكاملة من `backend/Code.gs` بالمستودع
2. احفظ
3. **Deploy → Manage deployments → ✏️ (تعديل النشر الموجود) → Version: New version → Deploy**
   (مهم: عدّل نفس النشر الموجود، ما تسوي "New deployment" جديد، عشان رابط `/exec` يبقى نفسه وما تحتاج تغيّره بـ event.html)

---

## الجزء أ) بوت تيليجرام (لوحة التحكم + الموافقات)

### أ.1 — أنشئ البوت

1. افتح تيليجرام وابحث عن **@BotFather**
2. أرسل `/newbot`
3. اختر اسم للبوت (مثال: `InviteAI Control`)
4. اختر يوزرنيم ينتهي بـ `bot` (مثال: `inviteai_control_bot`)
5. BotFather بيعطيك **توكن** شكله: `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` — احتفظ فيه

### أ.2 — اربط التوكن بالكود

1. بمحرر Apps Script: **⚙️ Project Settings** (بالقائمة الجانبية اليسرى) → **Script Properties** → **Add script property**
2. أضف: `TELEGRAM_BOT_TOKEN` = التوكن اللي أخذته
3. احفظ

### أ.3 — لقى رقم الشات تبعك

1. بتيليجرام، افتح محادثة مع البوت اللي سويته وأرسل `/start`
2. البوت بيرد عليك برسالة فيها رقم شاتك (لأن `OWNER_CHAT_ID` لسا مو معبّى)
3. انسخ الرقم، وضيفه بـ Script Properties كمان: `OWNER_CHAT_ID` = الرقم

### أ.4 — فعّل الـ Webhook

1. بمحرر Apps Script، من القائمة أعلى (Select function) اختر **`setupTelegramWebhook`**
2. اضغط ▶️ **Run**
3. أول مرة بيطلب صلاحيات إضافية (لأنه يستخدم UrlFetchApp) — وافق
4. تأكد من عدم وجود أخطاء بـ Execution log

### أ.5 — جرّب

بتيليجرام أرسل للبوت: `/status` → المفروض يرد "▶️ النظام يستقبل طلبات عادي."
جرب `/pause` ثم `/status` ثم `/resume`.

---

## الجزء ب) Google Form (استقبال بيانات الزبون)

### ب.1 — أنشئ الفورم

1. [forms.google.com](https://forms.google.com) → فورم جديد → سمّه `InviteAI - طلب مناسبة`
2. أضف الأسئلة التالية **بنفس العناوين بالضبط** (الكود يقرأها بالاسم):

| عنوان السؤال | نوع السؤال | ملاحظات |
|---|---|---|
| الاسم | إجابة قصيرة | إلزامي |
| نوع المناسبة | قائمة منسدلة (Dropdown) | خيارات: `wedding` `engagement` `graduation` `birthday` `national` `evening` `farewell` `other` |
| تاريخ ووقت المناسبة | تاريخ ووقت (Date + Time) | إلزامي |
| المكان | إجابة قصيرة | إلزامي |
| رابط الموقع على الخرائط (اختياري) | إجابة قصيرة | اختياري |
| الثيم المختار | قائمة منسدلة | خيارات: `pulse` `glow` `bloom` `calm` `radiance` `twinkle` `leaves` (نفس الأسماء اللي يعرض لهم themes.html وينسخها تلقائياً) |
| الباقة | قائمة منسدلة | خيارات: `basic` `premium` `luxury` `custom` |
| رقم الجوال | إجابة قصيرة | إلزامي |
| ملاحظة (اختياري) | فقرة | اختياري |
| __mc_uid | إجابة قصيرة | **خلّه مخفي المعنى بالوصف: "لا تعدّل — يُعبّى تلقائياً"** — هذا الحقل يجي معبّى مسبقاً من رابط مانيتشات (راجع الجزء ج) |

### ب.2 — اربطه بنفس الشيت

بأعلى الفورم: تبويب **Responses** → أيقونة الشيت الخضراء → **Select existing spreadsheet** → اختر شيت `InviteAI - Events` نفسه (بيضيف تبويب جديد اسمه "Form Responses 1" تلقائياً — عادي، ما نستخدمه مباشرة).

### ب.3 — فعّل تحويل الردود لتبويب Events تلقائياً

1. بنفس مشروع Apps Script (نفسه المربوط بالشيت)
2. من القائمة الجانبية: **⏰ Triggers** → **+ Add Trigger**
3. الإعدادات:
   - Choose which function to run: **`onFormSubmit`**
   - Select event source: **From spreadsheet**
   - Select event type: **On form submit**
4. Save (بيطلب صلاحيات إضافية — وافق)

الآن أي رد جديد على الفورم يتحول تلقائياً لصف جديد بتبويب `Events` بحالة `pending`، وتوصلك رسالة تيليجرام فورية.

### ب.4 — جرّب

عبّي الفورم بنفسك بأي بيانات تجريبية → تأكد إنه ظهر صف جديد بتبويب `Events` وإنك استلمت رسالة تيليجرام.

---

## الجزء ج) تدفق Manychat (الرد التلقائي على DM)

Manychat أداة رسومية (Visual Flow Builder) — هذا وصف كل خطوة بالضبط عشان تبنيها بنفسك بواجهتهم. رابط الـ API تبعك (نفسه من event.html):

```
https://script.google.com/macros/s/AKfycbzCJfZetPOL_xaAeYcTOzSeYuMrCcWYQvYZFSQB1G_OvfpTVJqkHq3DyzojPk5L5qgIQw/exec
```

### ج.1 — Trigger (بداية التدفق)

Settings → Automation → New Automation → Trigger: **"New conversation"** أو **Keyword** (لو تبي يشتغل بس على كلمات معيّنة زي "بغيت دعوة"، "أسعار").

### ج.2 — فحص حالة الإيقاف

أول خطوة بالتدفق: **Action → External Request**
- Method: `GET`
- URL: `<API_URL>?action=system_status`
- احفظ النتيجة بحقل: `paused` (Manychat يقرأ الـ JSON تلقائياً ويعطيك تختار الحقل)

بعدها **Condition**: لو `paused` = `true` → أرسل رسالة "الطلبات متوقفة حالياً 🙏 تابعنا على القصص للتحديث" → **إنهاء التدفق (Go to Step → End Flow)**.
لو `false` → كمّل للخطوة الجاية.

### ج.3 — رسالة ترحيبية + روابط

رسالة نصية:
> أهلاً بك في InviteAI.om ✨ نسوي لك صفحة مناسبة رقمية أنيقة بدقايق.

زر 1: **"شوف الثيمات"** → رابط: `https://inviteai-om.com/themes.html`
زر 2: **"شوف الباقات"** → رابط: `https://inviteai-om.com/pricing.html`
زر 3 (تكمل): **"جاهز، أبي أعبي الطلب"**

### ج.4 — رابط الفورم مع تعبئة مسبقة لهوية المشترك

هذي الخطوة الأهم للربط لاحقاً. بجوجل فورم:
1. افتح الفورم → **⋮ (ثلاث نقاط) → Get pre-filled link**
2. بخانة `__mc_uid` اكتب أي نص مؤقت مثل `PLACEHOLDER`
3. اضغط **Get Link** → انسخ الرابط الطويل
4. بالرابط، استبدل `PLACEHOLDER` بـ `{{user_id}}` (هذا Merge Tag من Manychat يمثل معرّف المشترك)

الرابط النهائي شكله تقريباً:
```
https://docs.google.com/forms/d/e/xxxxx/viewform?usp=pp_url&entry.111111={{user_id}}
```

استخدم هذا الرابط كزر بالرسالة:
> عبّي بياناتك هنا 👇 (اسمك، تاريخ المناسبة، الثيم اللي اخترته، الباقة)
> بعد التعبئة، حوّل قيمة العربون على:
> 🏦 [اسم البنك] — [رقم الحساب] — [اسم صاحب الحساب]
> وارسل لنا صورة إشعار التحويل هنا بنفس المحادثة 📎

### ج.5 — استقبال صورة إشعار التحويل

Automation جديدة أو خطوة بنفس التدفق: Trigger على **"Media received" / "Attachment"** (Manychat يدعم هذا كـ Smart Delay/Trigger أو شرط بعد "User Reply").

1. **Action → External Request** (GET):
   - URL: `<API_URL>?action=find_by_user&user_id={{user_id}}`
   - احفظ النتيجة بحقل مخصص: `event_id`
2. **Condition**: لو `event_id` فاضي → رد "ما لقينا طلبك، تأكد إنك عبّيت الفورم أول" وتوقف.
3. لو موجود → **Action → External Request** (POST):
   - URL: `<API_URL>`
   - Body (JSON):
     ```json
     { "action": "notify_order", "id": "{{event_id}}", "image_url": "{{last user image}}" }
     ```
     (اسم الحقل `{{last user image}}` يختلف شوي حسب نسخة Manychat — ابحث بقائمة الـ Merge Tags عن "Last User Image" أو "Last User Attachment URL")
4. رد للزبون: "استلمنا إشعار التحويل ✅ بنراجعه ونرجع لك بأقرب وقت."

من هنا، أنت (صاحب المشروع) تستلم إشعار تيليجرام بصورة التحويل وزر **"✅ ابدأ التصميم"** — تضغطه بعد ما تتأكد من حسابك البنكي، والحالة تتحدث تلقائياً بالشيت لـ `preview`.

### ج.6 — الدفعة النهائية (نفس فكرة ج.5)

لما الزبون يوافق على المعاينة ويرسل صورة تحويل الباقي، كرر نفس خطوات ج.5 بس بـ:
```json
{ "action": "notify_final_payment", "id": "{{event_id}}", "image_url": "{{last user image}}" }
```

وقت تضغط **"✅ فعّل الرابط النهائي"** بتيليجرام، الحالة تتحول لـ `active` والعلامة المائية تختفي تلقائياً من صفحة الزبون.

---

## خلاصة الحالات (status) بالنظام

| الحالة | يحصل متى | شكل الصفحة |
|---|---|---|
| `pending` | فور تعبئة الفورم، قبل تأكيد العربون | لا تُعرض — رسالة "الصفحة قيد التجهيز" |
| `preview` | بعد ضغطك "✅ ابدأ التصميم" | تُعرض بعلامة مائية |
| `active` | بعد ضغطك "✅ فعّل الرابط النهائي" | نهائية بدون علامة مائية |

## ملاحظات أمان
- أوامر `/pause` `/resume` وأزرار الموافقة تتجاهل أي شخص غير `OWNER_CHAT_ID` — حتى لو حد لقى رابط الـ Webhook ما يقدر يتحكم.
- توكن البوت (`TELEGRAM_BOT_TOKEN`) موجود بس بـ Script Properties (مو بالكود ولا بالشيت) — لا تشاركه مع أحد.
