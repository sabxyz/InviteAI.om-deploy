/**
 * InviteAI.om — Backend بسيط لصفحات المناسبات (Google Apps Script)
 * -----------------------------------------------------------------
 * يوصَل بجدول Google Sheet واحد فيه تبويبين (Sheets):
 *
 *   1) "Events"   → صف واحد لكل زبون (راجع أعمدة EVENTS_COLUMNS تحت)
 *   2) "RSVP_Log" → سجل كل تأكيدات الحضور (event_id, guest_name, type, timestamp)
 *
 * طريقة النشر: راجع ملف SETUP.md المرفق مع هذا الملف.
 */

const EVENTS_SHEET_NAME = 'Events';
const RSVP_LOG_SHEET_NAME = 'RSVP_Log';

// أعمدة تبويب Events بالترتيب — لازم تكون نفس هذي الأسماء بالصف الأول (header) بالشيت
const EVENTS_COLUMNS = [
  'id', 'name', 'event_type', 'date', 'location', 'location_url',
  'theme', 'package', 'status', 'phone', 'note', 'schedule',
  'rsvp_count', 'dashboard_key'
];

// الأعمدة اللي يُسمح ترجع بالرابط العام (event.html) — نستثني phone و rsvp_count و dashboard_key لأنها بيانات خاصة
const PUBLIC_FIELDS = [
  'id', 'name', 'event_type', 'date', 'location', 'location_url',
  'theme', 'package', 'status', 'note', 'schedule'
];

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

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET requests:
 *   ?id=xxx                       → بيانات المناسبة العامة (لصفحة event.html)
 *   ?id=xxx&action=stats&key=yyy  → عدد المؤكدين + الأسماء (للوحة المدعوين، محمي بمفتاح dashboard_key)
 */
function doGet(e) {
  const id = e.parameter.id;
  if (!id) return jsonResponse_({ error: 'missing_id' });

  const found = findEventRow_(id);
  if (!found) return jsonResponse_({ error: 'not_found' });

  if (e.parameter.action === 'stats') {
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

  // وضع عام: نرجّع فقط الحقول المسموح بها (بدون phone / rsvp_count / dashboard_key)
  const publicData = {};
  PUBLIC_FIELDS.forEach(f => { publicData[f] = found.obj[f]; });
  return jsonResponse_(publicData);
}

/**
 * POST requests (JSON body):
 *   { action: 'rsvp',      id: 'xxx' }              → تأكيد حضور (يزيد العداد)
 *   { action: 'rsvp_name', id: 'xxx', name: 'سارة' } → إضافة اسم اختياري لآخر تأكيد
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'bad_request' });
  }

  const id = payload.id;
  const action = payload.action;
  if (!id || !action) return jsonResponse_({ error: 'missing_fields' });

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
