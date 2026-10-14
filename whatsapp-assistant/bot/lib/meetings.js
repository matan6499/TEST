// "Ask Dor in his group when he can meet me": the bot asks in the group, watches for
// that person's answer, proposes a slot to the owner, and books it only after a yes.
import fs from 'fs';
import crypto from 'crypto';

const OPEN_MS = 72 * 60 * 60_000;
const idOf = (jid = '') => String(jid).split('@')[0].split(':')[0];

export function loadMeetings(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function newMeeting({ groupJid, personIds, personName = '', purpose = '', window = '', now = Date.now() }) {
  return { id: crypto.randomBytes(3).toString('hex'), groupJid, personIds: personIds.map(idOf).filter(Boolean), personName, purpose, window, status: 'asked', createdAt: now, proposal: null };
}

// The open meeting (if any) waiting for this sender's answer in this group.
export function openMeetingFor(meetings, groupJid, senderJids = [], now = Date.now()) {
  const ids = senderJids.map(idOf).filter(Boolean);
  return meetings.find(m => m.groupJid === groupJid && ['asked', 'proposed'].includes(m.status)
    && now - m.createdAt < OPEN_MS && m.personIds.some(p => ids.includes(p))) || null;
}

export function pendingForOwner(meetings, now = Date.now()) {
  return meetings.filter(m => ['asked', 'proposed'].includes(m.status) && now - m.createdAt < OPEN_MS);
}

export function meetingsPrompt(meetings, groupName = (j) => j) {
  const open = pendingForOwner(meetings);
  return `תיאום פגישות דרך קבוצה:
- כשהבעלים מבקש לבדוק עם מישהו בקבוצה מתי הוא פנוי להיפגש: {"a":"ask_meeting","group":"<שם הקבוצה>","person":"<המספר שאחרי ה-@>","purpose":"על מה הפגישה","window":"מתי בערך, למשל השבוע"}
  הבוט ישאל אותו בקבוצה, יחכה לתשובה, יבדוק ביומן ויחזור לבעלים לאישור.
- כשהבעלים מאשר הצעה ("כן", "תקבע"): {"a":"meeting_confirm","id":"<מזהה>"}. אם הוא רוצה שעה אחרת: {"a":"meeting_counter","id":"<מזהה>","text":"מה להציע לו"}. לביטול: {"a":"meeting_cancel","id":"<מזהה>"}.
${open.length ? `פגישות פתוחות:\n${open.map(m => `- ${m.id}: ${m.personName || m.personIds[0]} ב${groupName(m.groupJid)}, ${m.purpose || 'פגישה'}, סטטוס ${m.status === 'proposed' && m.proposal ? `הוצע ${m.proposal.start} עד ${m.proposal.end.slice(11)}` : 'מחכים לתשובה שלו'}`).join('\n')}` : ''}`;
}

export function replyPrompt(m, { ownerName = 'הבעלים', senderName = '', text = '', calendarConnected = false } = {}) {
  return `[תיאום פגישה ${m.id}: ביקשת מ${m.personName || senderName} בקבוצה לקבוע פגישה עם ${ownerName}${m.purpose ? ` (${m.purpose})` : ''}${m.window ? `, ${m.window}` : ''}.
עכשיו ${senderName} כתב: "${text}"
מה לעשות:
- אם הוא נתן מועד או טווח: בחר מועד אחד מתאים (ברירת מחדל שעה אחת)${calendarConnected ? ', בדוק עם cal_free אם הבעלים פנוי' : ''}, ואז {"a":"meeting_propose","id":"${m.id}","start":"YYYY-MM-DDTHH:MM","end":"YYYY-MM-DDTHH:MM","title":"פגישה עם ${m.personName || senderName}","note":"מה הוא אמר בקצרה"}. בקבוצה ענה לו משפט קצר וחם שאתה בודק ומאשר מול ${ownerName}.
- אם הבעלים לא פנוי במועד שביקש, שאל אותו בקבוצה על מועד אחר.
- אם הוא לא ענה על המועד (שאלה, בדיחה, "אחזור אליך"), ענה לו בקצרה בקבוצה בלי לקבוע כלום.
- בקבוצה אל תחשוף מה יש ביומן של הבעלים או פרטים פרטיים שלו. רק "פנוי" או "לא מסתדר, מה עוד נוח לך?".
- אם הוא לא יכול בכלל: {"a":"meeting_cancel","id":"${m.id}"} וענה בנימוס.]`;
}
