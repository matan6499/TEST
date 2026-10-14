// Reminders the model schedules by emitting tags in its reply. Works in the
// limited chatbot mode too, because the bot (not Claude) stores and sends them.
import crypto from 'crypto';

export const REMINDER_TZ = 'Asia/Jerusalem';
const TAG_RE = /\[\[\s*(REMIND|CANCEL_REMIND)\s*\|([^\]]*)\]\]/g;

function tzOffsetMs(utcMs, timeZone = REMINDER_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map(p => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-10-01T09:30" in Israel time -> epoch ms. Returns NaN when malformed.
export function localToEpoch(value, timeZone = REMINDER_TZ) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - tzOffsetMs(guess, timeZone);
  return guess - tzOffsetMs(first, timeZone);
}

export function formatLocal(epochMs, timeZone = REMINDER_TZ) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', weekday: 'long',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(epochMs)).map(x => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute} (${p.weekday})`;
}

// Pull reminder tags out of a reply. Returns the cleaned text plus actions.
export function extractReminderTags(reply = '') {
  const add = [];
  const cancel = [];
  const text = String(reply).replace(TAG_RE, (_, kind, body) => {
    if (kind === 'CANCEL_REMIND') {
      const id = body.trim();
      if (id) cancel.push(id);
    } else {
      const sep = body.indexOf('|');
      if (sep > 0) {
        const when = body.slice(0, sep).trim();
        const what = body.slice(sep + 1).trim();
        if (when && what) add.push({ when, text: what });
      }
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { text, add, cancel };
}

export function newReminder({ when, text, chatJid, senderJid, kind = 'reminder', now = Date.now() }) {
  const at = localToEpoch(when);
  if (!Number.isFinite(at)) return { error: `זמן לא תקין: ${when}` };
  if (at < now - 60_000) return { error: `הזמן ${when} כבר עבר` };
  return {
    reminder: {
      id: crypto.randomBytes(3).toString('hex'),
      at, text: text.slice(0, 1000), chatJid, senderJid, kind, createdAt: now,
    },
  };
}

export function dueReminders(list, now = Date.now()) {
  return list.filter(r => r.at <= now);
}

export function reminderPrompt(pending, now = Date.now()) {
  const lines = pending
    .slice()
    .sort((a, b) => a.at - b.at)
    .map(r => `- ${r.id}: ${formatLocal(r.at)} | ${r.text}`);
  return `תזכורות:
עכשיו ${formatLocal(now)} שעון ישראל.
אתה יכול לקבוע תזכורת כשמבקשים ממך. הוסף בסוף התשובה שורה בדיוק בפורמט:
[[REMIND|YYYY-MM-DDTHH:MM|הטקסט שיישלח]]
הזמן בשעון ישראל. "בעוד שעה" או "מחר ב-9" חשב לפי השעה הנוכחית. אפשר כמה שורות לכמה תזכורות.
לביטול תזכורת: [[CANCEL_REMIND|המזהה]]
התגיות לא מוצגות למשתמש, אז בתשובה עצמה אשר במשפט קצר מתי תזכיר.
התזכורת נשלחת לצ'אט הזה. לא לקבוע תזכורת בלי שביקשו.
${lines.length ? `תזכורות פתוחות בצ'אט הזה:\n${lines.join('\n')}` : 'אין תזכורות פתוחות בצ\'אט הזה.'}`;
}
