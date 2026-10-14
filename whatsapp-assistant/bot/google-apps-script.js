// העוזר ב-WhatsApp: גשר ליומן ול-Gmail. רץ בחשבון Google שלך בלבד.
// המפתח למטה חייב להיות זהה ל-googleScriptKey בהגדרות הבוט בשרת.
const KEY = '__BOT_KEY__';
const TZ = 'Asia/Jerusalem';

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.key !== KEY) return json({ error: 'unauthorized' });
    const p = req.params || {};
    const fn = ACTIONS[req.action];
    out = fn ? fn(p) : { error: 'unknown action ' + req.action };
  } catch (err) {
    out = { error: String(err && err.message || err) };
  }
  return json(out);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function parse(s) { return Utilities.parseDate(String(s), TZ, "yyyy-MM-dd'T'HH:mm"); }
function fmt(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm (EEE)"); }

const ACTIONS = {
  cal_list(p) {
    const evs = CalendarApp.getDefaultCalendar().getEvents(parse(p.from), parse(p.to));
    return { events: evs.slice(0, 50).map(ev => ({
      id: ev.getId(), title: ev.getTitle(), start: fmt(ev.getStartTime()), end: fmt(ev.getEndTime()),
      allDay: ev.isAllDayEvent(), location: ev.getLocation(),
    })) };
  },
  cal_add(p) {
    const ev = CalendarApp.getDefaultCalendar().createEvent(p.title, parse(p.start), parse(p.end || p.start),
      { location: p.location || '', description: p.description || '' });
    return { created: { id: ev.getId(), title: ev.getTitle(), start: fmt(ev.getStartTime()), end: fmt(ev.getEndTime()) } };
  },
  cal_delete(p) {
    const ev = CalendarApp.getDefaultCalendar().getEventById(p.id);
    if (!ev) return { error: 'event not found' };
    const title = ev.getTitle(); ev.deleteEvent();
    return { deleted: title };
  },
  mail_search(p) {
    const threads = GmailApp.search(p.query || 'is:unread', 0, Math.min(Number(p.max) || 10, 20));
    return { messages: threads.map(t => {
      const m = t.getMessages().pop();
      return { id: m.getId(), from: m.getFrom(), subject: m.getSubject(), date: fmt(m.getDate()),
        unread: m.isUnread(), snippet: m.getPlainBody().replace(/\s+/g, ' ').slice(0, 200) };
    }) };
  },
  mail_read(p) {
    const m = GmailApp.getMessageById(p.id);
    if (!m) return { error: 'message not found' };
    return { id: m.getId(), from: m.getFrom(), to: m.getTo(), subject: m.getSubject(), date: fmt(m.getDate()),
      body: m.getPlainBody().slice(0, 4000) };
  },
  mail_draft(p) {
    let d;
    if (p.replyToId) d = GmailApp.getMessageById(p.replyToId).createDraftReply(p.body || '');
    else d = GmailApp.createDraft(p.to, p.subject || '', p.body || '');
    const m = d.getMessage();
    return { draftId: d.getId(), to: m.getTo(), subject: m.getSubject(), body: m.getPlainBody().slice(0, 1500) };
  },
  // פתקים של אייפון שנשמרים ב-Gmail (תווית Notes). חיפוש וקריאה.
  notes_search(p) {
    const threads = GmailApp.search('label:notes ' + (p.query || ''), 0, Math.min(Number(p.max) || 10, 20));
    return { notes: threads.map(t => {
      const m = t.getMessages().pop();
      return { id: m.getId(), title: m.getSubject(), date: fmt(m.getDate()), text: m.getPlainBody().slice(0, 1500) };
    }) };
  },
  // פתק חדש שיופיע באפליקציית הפתקים באייפון, בתיקיית Gmail. דורש את שירות Gmail API בפרויקט.
  notes_add(p) {
    const label = (Gmail.Users.Labels.list('me').labels || []).find(l => l.name.toLowerCase() === 'notes');
    if (!label) return { error: 'אין עדיין תווית Notes ב-Gmail. צריך להפעיל פתקים לחשבון Gmail באייפון.' };
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const title = String(p.title || 'פתק').slice(0, 200);
    const html = '<html><head></head><body><div>' + esc(title) + '</div><div>' + esc(p.body).replace(/\n/g, '</div><div>') + '</div></body></html>';
    const b64 = s => Utilities.base64Encode(Utilities.newBlob(s).getBytes());
    const mime = [
      'From: ' + Session.getActiveUser().getEmail(),
      'Subject: =?UTF-8?B?' + b64(title) + '?=',
      'Date: ' + new Date().toUTCString(),
      'X-Uniform-Type-Identifier: com.apple.mail-note',
      'X-Universally-Unique-Identifier: ' + Utilities.getUuid().toUpperCase(),
      'Mime-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(html),
    ].join('\r\n');
    const msg = Gmail.Users.Messages.insert({ raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()), labelIds: [label.id] }, 'me');
    return { created: { id: msg.id, title } };
  },
  mail_send(p) {
    const d = GmailApp.getDraft(p.draftId);
    if (!d) return { error: 'draft not found' };
    const m = d.send();
    return { sent: { to: m.getTo(), subject: m.getSubject() } };
  },
};
