# InviteAI.om — مشروع صفحات المناسبات

## بنية المجلد
```
event-pages/
  index.html              → الصفحة الرئيسية (روابط لكل شي)
  themes.html              → معرض الثيمات السبعة
  pricing.html             → صفحة الباقات والأسعار
  compare.html             → مقارنة حية بين الباقات
  rsvp-demo.html           → نموذج تأكيد الحضور (باقة فاخرة)
  guest-dashboard.html     → لوحة متابعة المدعوين (خاصة بصاحب المناسبة)
  events/
    sultan-graduation.html → مثال فعلي لصفحة زبون (تخرج سلطان)
  assets/
    inviteai-profile-photo.png → صورة البروفايل
    inviteai-instagram-post.svg → تصميم بوست انستغرام
```

## خطوات الرفع على GitHub

1. روح لـ github.com وسجل دخول
2. اضغط "+" فوق يمين → New repository
3. اسم المستودع: `event-pages` (أو أي اسم تفضله)
4. خليه Public → Create repository
5. اضغط "uploading an existing file"
6. اسحب كل الملفات والمجلدات من هذا المجلد (حافظ على نفس البنية: assets/ و events/ كمجلدات فرعية)
7. اضغط Commit changes

## خطوات النشر على Vercel

1. روح لـ vercel.com → Sign Up → Continue with GitHub
2. Add New → Project
3. اختر مستودع `event-pages` → Import
4. اترك الإعدادات الافتراضية → Deploy
5. بعد دقيقة، يعطيك رابط مثل: `event-pages.vercel.app`

## ربط الدومين

1. بمشروعك على Vercel: Settings → Domains
2. اكتب دومينك واضغط Add
3. انسخ قيم DNS اللي يعطيك Vercel
4. الصقها بلوحة تحكم الدومين عندك (Namecheap/GoDaddy) تحت DNS Settings
5. انتظر من دقائق لـ 24 ساعة

## الخطوة التقنية التالية (بعد النشر)

القوالب الحالية (themes.html, sultan-graduation.html) مبنية بـ HTML/CSS/JS ثابت للعرض التوضيحي.
الخطوة الجاية هي بناء `event.html` ديناميكي يقرأ بيانات كل زبون تلقائياً من Google Sheet
عبر معرّف بالرابط (مثال: `yourevent.com/event.html?id=sara-ahmad`) بدل إنشاء ملف منفصل يدوياً لكل زبون.

هذي الخطوة تحتاج:
- Google Sheet بالأعمدة: id, name, event_type, date, location, theme, package, status
- Google Apps Script أو خدمة وسيطة (مثل Sheet.best) لقراءة البيانات كـ API
- تعديل القالب ليقرأ البيانات ديناميكياً بدل النص الثابت
