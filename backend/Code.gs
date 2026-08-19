/**
 * InviteAI.om — Backend لصفحات المناسبات + لوحة تحكم تيليجرام (Google Apps Script)
 * -----------------------------------------------------------------------------
 * يوصَل بجدول Google Sheet واحد فيه تبويبين (Sheets):
 *
 *   1) "Events"   → صف واحد لكل زبون (راجع أعمدة EVENTS_COLUMNS تحت)
 *   2) "RSVP_Log" → سجل كل تأكيدات الحضور (event_id, guest_name, type, timestamp)
 *
 * طريقة النشر والإعداد: راجع SETUP-event-dynamic.md و TELEGRAM-MANYCHAT-SETUP.md
 */

const EVENTS_SHEET_NAME = 'Events';
const RSVP_LOG_SHEET_NAME = 'RSVP_Log';

// أعمدة تبويب Events بالترتيب — لازم تكون نفس هذي الأسماء بالصف الأول (header) بالشيت
// أضفنا manychat_user_id (اختياري) لربط طلبات الشيت بمحادثة الزبون بمانيتشات
const EVENTS_COLUMNS = [
  'id', 'name', 'event_type', 'date', 'location', 'location_url',
  'theme', 'package', 'status', 'phone', 'note', 'schedule',
  'rsvp_count', 'dashboard_key', 'manychat_user_id'
];

// الأعمدة اللي يُسمح ترجع بالرابط العام (event.html) — نستثني phone و rsvp_count و dashboard_key و manychat_user_id لأنها بيانات خاصة
const PUBLIC_FIELDS = [
  'id', 'name', 'event_type', 'date', 'location', 'location_url',
  'theme', 'package', 'status', 'note', 'schedule'
];

/* ============================================================
   إعدادات عامة (Script Properties) — تُضبط يدوياً من:
   Apps Script → Project Settings (⚙️) → Script Properties
   TELEGRAM_BOT_TOKEN : توكن البوت من BotFather
   OWNER_CHAT_ID       : رقم شات تيليجرام تبعك (صاحب المشروع)
   ============================================================ */
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function isPaused_() {
  return PropertiesService.getScriptProperties().getProperty('SYSTEM_PAUSED') === 'true';
}

function setPaused_(val) {
  PropertiesService.getScriptProperties().setProperty('SYSTEM_PAUSED', val ? 'true' : 'false');
}

function isOwner_(chatId) {
  const owner = getProp_('OWNER_CHAT_ID');
  return owner && String(chatId) === String(owner);
}

function telegramApi_(method, payload) {
  const token = getProp_('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  // نسجّل أي رد فشل (code != 200) بالـ Execution log عشان يسهل تشخيص أي مشكلة تيليجرام مستقبلاً
  if (res.getResponseCode() !== 200) {
    Logger.log(`telegramApi_ ${method} failed (${res.getResponseCode()}): ${res.getContentText()}`);
  }
  return res;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === EVENTS_SHEET_NAME) sheet.appendRow(EVENTS_COLUMNS);
    if (name === RSVP_LOG_SHEET_NAME) sheet.appendRow(['event_id', 'guest_name', 'type', 'timestamp']);
  }
  return sheet;
}

function findEventRow_(id) {
  const sheet = getSheet_(EVENTS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      const rowObj = {};
      headers.forEach((h, idx) => { rowObj[h] = data[i][idx]; });
      return { rowIndex: i + 1, headers: headers, values: data[i], obj: rowObj };
    }
  }
  return null;
}

function findEventByManychatUser_(userId) {
  const sheet = getSheet_(EVENTS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('manychat_user_id');
  if (uCol === -1) return null;
  for (let i = data.length - 1; i >= 1; i--) { // من الأحدث للأقدم
    if (String(data[i][uCol]).trim() === String(userId).trim()) {
      const rowObj = {};
      headers.forEach((h, idx) => { rowObj[h] = data[i][idx]; });
      return { rowIndex: i + 1, headers: headers, values: data[i], obj: rowObj };
    }
  }
  return null;
}

function setEventStatus_(found, newStatus) {
  const eventsSheet = getSheet_(EVENTS_SHEET_NAME);
  const statusCol = found.headers.indexOf('status') + 1;
  eventsSheet.getRange(found.rowIndex, statusCol).setValue(newStatus);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET requests:
 *   ?action=system_status              → { paused: true/false } — لفحص Manychat قبل الرد الترحيبي
 *   ?action=find_by_user&user_id=xxx   → { id: 'xxx' } — يلقى آخر طلب لنفس مشترك Manychat
 *   ?id=xxx                            → بيانات المناسبة العامة (لصفحة event.html)
 *   ?id=xxx&action=stats&key=yyy       → عدد المؤكدين + الأسماء (محمي بمفتاح dashboard_key)
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'system_status') {
    return jsonResponse_({ paused: isPaused_() });
  }

  if (action === 'find_by_user') {
    const uid = e.parameter.user_id;
    if (!uid) return jsonResponse_({ error: 'missing_user_id' });
    const found = findEventByManychatUser_(uid);
    if (!found) return jsonResponse_({ error: 'not_found' });
    return jsonResponse_({ id: found.obj.id, status: found.obj.status });
  }

  const id = e.parameter.id;
  if (!id) return jsonResponse_({ error: 'missing_id' });

  const found = findEventRow_(id);
  if (!found) return jsonResponse_({ error: 'not_found' });

  if (action === 'stats') {
    const providedKey = e.parameter.key || '';
    const realKey = String(found.obj.dashboard_key || '').trim();
    if (!realKey || providedKey !== realKey) {
      return jsonResponse_({ error: 'unauthorized' });
    }
    const logSheet = getSheet_(RSVP_LOG_SHEET_NAME);
    const logData = logSheet.getDataRange().getValues();
    const names = [];
    for (let i = 1; i < logData.length; i++) {
      if (String(logData[i][0]).trim() === String(id).trim() && logData[i][1]) {
        names.push({ name: logData[i][1], time: logData[i][3] });
      }
    }
    return jsonResponse_({
      count: Number(found.obj.rsvp_count) || 0,
      named: names
    });
  }

  // وضع عام: نرجّع فقط الحقول المسموح بها (بدون phone / rsvp_count / dashboard_key / manychat_user_id)
  const publicData = {};
  PUBLIC_FIELDS.forEach(f => { publicData[f] = found.obj[f]; });
  return jsonResponse_(publicData);
}

/**
 * POST requests (JSON body) — نوعين:
 *
 * 1) طلبات من event.html:
 *    { action: 'rsvp',      id: 'xxx' }              → تأكيد حضور (يزيد العداد)
 *    { action: 'rsvp_name', id: 'xxx', name: 'سارة' } → إضافة اسم اختياري
 *
 * 2) طلبات من Manychat (External Request):
 *    { action: 'notify_order',         id, image_url? }  → إشعار تيليجرام: طلب جديد + عربون (زر "ابدأ التصميم")
 *    { action: 'notify_final_payment', id, image_url? }  → إشعار تيليجرام: دفعة نهائية (زر "فعّل الرابط النهائي")
 *
 * 3) تحديثات Webhook من تيليجرام نفسه (رسائل + ضغط أزرار):
 *    { update_id: ..., message: {...} }         → أوامر /pause /resume /status
 *    { update_id: ..., callback_query: {...} }  → ضغط زر الموافقة
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'bad_request' });
  }

  // تحديثات تيليجرام لها هذا الشكل المميز (update_id موجود دايماً)
  if (payload.update_id !== undefined) {
    return handleTelegramUpdate_(payload);
  }

  const id = payload.id;
  const action = payload.action;
  if (!id || !action) return jsonResponse_({ error: 'missing_fields' });

  if (action === 'notify_order') return handleNotify_(id, payload.image_url, 'deposit');
  if (action === 'notify_final_payment') return handleNotify_(id, payload.image_url, 'final');

  const found = findEventRow_(id);
  if (!found) return jsonResponse_({ error: 'not_found' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const logSheet = getSheet_(RSVP_LOG_SHEET_NAME);

    if (action === 'rsvp') {
      const eventsSheet = getSheet_(EVENTS_SHEET_NAME);
      const rsvpCol = found.headers.indexOf('rsvp_count') + 1; // 1-indexed للأعمدة بـ Sheets API
      const current = Number(found.obj.rsvp_count) || 0;
      eventsSheet.getRange(found.rowIndex, rsvpCol).setValue(current + 1);
      logSheet.appendRow([id, '', 'confirm', new Date()]);
      return jsonResponse_({ ok: true });
    }

    if (action === 'rsvp_name') {
      const name = String(payload.name || '').trim();
      if (name) logSheet.appendRow([id, name, 'name', new Date()]);
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   إشعارات تيليجرام (تستدعيها Manychat عبر External Request)
   ============================================================ */
function handleNotify_(id, imageUrl, kind) {
  const found = findEventRow_(id);
  if (!found) return jsonResponse_({ error: 'not_found' });
  const o = found.obj;

  const title = kind === 'deposit' ? '🆕 طلب جديد — عربون' : '💰 دفعة نهائية';
  const caption =
    `${title}\n` +
    `الاسم: ${o.name}\n` +
    `المناسبة: ${o.event_type}\n` +
    `التاريخ: ${o.date}\n` +
    `المكان: ${o.location}\n` +
    `الثيم: ${o.theme}\n` +
    `الباقة: ${o.package}\n` +
    `الجوال: ${o.phone || '—'}\n` +
    `ID: ${o.id}`;

  const buttonText = kind === 'deposit' ? '✅ ابدأ التصميم (تأكيد العربون)' : '✅ فعّل الرابط النهائي';
  const callbackAction = kind === 'deposit' ? 'approve_deposit' : 'approve_final';
  const replyMarkup = { inline_keyboard: [[{ text: buttonText, callback_data: `${callbackAction}:${o.id}` }]] };

  const ownerChat = getProp_('OWNER_CHAT_ID');
  if (!ownerChat) return jsonResponse_({ error: 'owner_not_configured' });

  if (imageUrl) {
    telegramApi_('sendPhoto', { chat_id: ownerChat, photo: imageUrl, caption: caption, reply_markup: replyMarkup });
  } else {
    telegramApi_('sendMessage', { chat_id: ownerChat, text: caption, reply_markup: replyMarkup });
  }
  return jsonResponse_({ ok: true });
}

/* ============================================================
   معالجة تحديثات تيليجرام (رسائل نصية + ضغط أزرار)
   ============================================================ */
function handleTelegramUpdate_(update) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    // تيليجرام أحياناً يرسل الأمر بصيغة "/status@اسم_البوت" (خصوصاً لو انتقي من قائمة الأوامر) — نتجاهل الجزء بعد @
    const text = (msg.text || '').trim().split('@')[0];
    Logger.log(`DEBUG incoming message — raw: ${JSON.stringify(msg.text)} | parsed text: ${JSON.stringify(text)} | chatId: ${chatId} | isOwner: ${isOwner_(chatId)}`);

    if (!isOwner_(chatId)) {
      // أول رسالة من صاحب المشروع تُستخدم للتعرّف على OWNER_CHAT_ID لو ما كان معبّى بعد
      if (!getProp_('OWNER_CHAT_ID')) {
        telegramApi_('sendMessage', {
          chat_id: chatId,
          text: `مرحباً! رقم الشات تبعك هو: ${chatId}\nروح Apps Script → Project Settings → Script Properties وضيف OWNER_CHAT_ID بهذي القيمة.`
        });
      }
      return jsonResponse_({ ok: true });
    }

    if (text === '/pause') {
      setPaused_(true);
      telegramApi_('sendMessage', { chat_id: chatId, text: '⏸ تم إيقاف استقبال الطلبات الجديدة (Manychat بيرد برسالة اعتذار تلقائياً).' });
    } else if (text === '/resume') {
      setPaused_(false);
      telegramApi_('sendMessage', { chat_id: chatId, text: '▶️ تم تفعيل استقبال الطلبات من جديد.' });
    } else if (text === '/status') {
      telegramApi_('sendMessage', { chat_id: chatId, text: isPaused_() ? '⏸ النظام متوقف حالياً.' : '▶️ النظام يستقبل طلبات عادي.' });
    } else if (text === '/start') {
      telegramApi_('sendMessage', { chat_id: chatId, text: 'أهلاً 👋 هذا بوت التحكم بمشروع InviteAI.om.\nالأوامر: /pause /resume /status' });
    }
    return jsonResponse_({ ok: true });
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message.chat.id;
    if (!isOwner_(chatId)) {
      telegramApi_('answerCallbackQuery', { callback_query_id: cq.id, text: 'غير مصرح' });
      return jsonResponse_({ ok: true });
    }

    const data = cq.data || '';
    const sep = data.indexOf(':');
    const cbAction = sep === -1 ? data : data.substring(0, sep);
    const eventId = sep === -1 ? '' : data.substring(sep + 1);

    const found = findEventRow_(eventId);
    if (!found) {
      telegramApi_('answerCallbackQuery', { callback_query_id: cq.id, text: 'الطلب غير موجود' });
      return jsonResponse_({ ok: true });
    }

    if (cbAction === 'approve_deposit') {
      setEventStatus_(found, 'preview');
      telegramApi_('answerCallbackQuery', { callback_query_id: cq.id, text: 'تم! الصفحة صارت معاينة.' });
      telegramApi_('sendMessage', { chat_id: chatId, text: `✅ ${eventId} — الحالة: preview (معاينة قيد التصميم)` });
    } else if (cbAction === 'approve_final') {
      setEventStatus_(found, 'active');
      telegramApi_('answerCallbackQuery', { callback_query_id: cq.id, text: 'تم! الرابط النهائي مفعّل.' });
      telegramApi_('sendMessage', { chat_id: chatId, text: `✅ ${eventId} — الحالة: active (الرابط النهائي مفعّل)` });
    } else {
      telegramApi_('answerCallbackQuery', { callback_query_id: cq.id, text: 'إجراء غير معروف' });
    }
    return jsonResponse_({ ok: true });
  }

  return jsonResponse_({ ok: true });
}

/* ============================================================
   استقبال ردود Google Form تلقائياً وإضافتها كصف جديد بتبويب Events
   (اربطها بـ Triggers → Add Trigger → onFormSubmit → From spreadsheet → On form submit)
   عناوين أسئلة الفورم يجب تطابق v('...') تحت بالضبط.
   ============================================================ */
function onFormSubmit(e) {
  const values = e.namedValues;
  function v(title) { return values[title] && values[title][0] ? String(values[title][0]).trim() : ''; }

  const name = v('الاسم');
  const eventType = v('نوع المناسبة');
  const dateRaw = v('تاريخ ووقت المناسبة');
  const location = v('المكان');
  const locationUrl = v('رابط الموقع على الخرائط (اختياري)');
  const theme = v('الثيم المختار');
  const pkg = v('الباقة');
  const phone = v('رقم الجوال');
  const note = v('ملاحظة (اختياري)');
  const manychatUserId = v('__mc_uid');

  const id = slugify_(name) + '-' + Math.floor(1000 + Math.random() * 9000);
  const isoDate = normalizeDate_(dateRaw);

  const eventsSheet = getSheet_(EVENTS_SHEET_NAME);
  const row = EVENTS_COLUMNS.map(col => {
    switch (col) {
      case 'id': return id;
      case 'name': return name;
      case 'event_type': return eventType;
      case 'date': return isoDate;
      case 'location': return location;
      case 'location_url': return locationUrl;
      case 'theme': return theme;
      case 'package': return pkg;
      case 'status': return 'pending';
      case 'phone': return phone;
      case 'note': return note;
      case 'schedule': return '';
      case 'rsvp_count': return 0;
      case 'dashboard_key': return Utilities.getUuid().slice(0, 10);
      case 'manychat_user_id': return manychatUserId;
      default: return '';
    }
  });
  eventsSheet.appendRow(row);

  // إشعار فوري لصاحب المشروع إن طلب جديد وصل (بدون صورة إشعار التحويل بعد)
  const ownerChat = getProp_('OWNER_CHAT_ID');
  if (ownerChat) {
    telegramApi_('sendMessage', {
      chat_id: ownerChat,
      text: `📝 طلب جديد بالفورم (بانتظار العربون)\nالاسم: ${name}\nID: ${id}\nالباقة: ${pkg}`
    });
  }
}

function slugify_(text) {
  const cleaned = String(text || '').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ\s-]/g, '');
  const slug = cleaned.split(/\s+/).filter(Boolean).slice(0, 2).join('-');
  return slug || 'guest';
}

function normalizeDate_(raw) {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return Utilities.formatDate(d, 'GMT+4', "yyyy-MM-dd'T'HH:mm:ssXXX");
  } catch (err) {
    return raw;
  }
}

/**
 * ⚠️ عدّل هذا الرابط ليطابق رابط /exec الفعلي لآخر نشر عندك (Deploy → Manage deployments)
 * لا تستخدم ScriptApp.getService().getUrl() هنا — لما تشغّل الدالة يدوياً من المحرر
 * ترجع رابط /dev الخاص (يحتاج تسجيل دخولك) مو /exec العام، وتيليجرام يرفضه بخطأ 401.
 */
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzCJfZetPOL_xaAeYcTOzSeYuMrCcWYQvYZFSQB1G_OvfpTVJqkHq3DyzojPk5L5qgIQw/exec';

/**
 * دالة تشغّلها يدوياً مرة وحدة بس من داخل محرر Apps Script (زر ▶ Run)
 * بعد ما تضبط TELEGRAM_BOT_TOKEN — تربط الـ webhook بين تيليجرام وهذا الـ Web App.
 */
function setupTelegramWebhook() {
  const token = getProp_('TELEGRAM_BOT_TOKEN');
  const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: WEB_APP_URL }),
    muteHttpExceptions: true
  });
  Logger.log(res.getContentText());
}
