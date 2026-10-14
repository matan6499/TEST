// Long-term memory. Facts about the owner are only ever shown in the owner's own
// sessions; facts about a group (family details, birthdays) only inside that group.
import fs from 'fs';

const MAX_FACTS = 200;

export function loadMemory(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { owner: v.owner || [], groups: v.groups || {}, birthdays: v.birthdays || [] };
  } catch { return { owner: [], groups: {}, birthdays: [] }; }
}

const clean = (s, n = 300) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function remember(mem, { fact, scope, chatJid }) {
  const f = clean(fact);
  if (!f) return { mem, error: 'אין מה לזכור' };
  if (scope === 'group') {
    if (!String(chatJid).endsWith('@g.us')) return { mem, error: 'זיכרון קבוצה עובד רק בתוך קבוצה' };
    const list = (mem.groups[chatJid] || []).filter(x => x !== f);
    return { mem: { ...mem, groups: { ...mem.groups, [chatJid]: [...list, f].slice(-MAX_FACTS) } } };
  }
  const list = mem.owner.filter(x => x !== f);
  return { mem: { ...mem, owner: [...list, f].slice(-MAX_FACTS) } };
}

export function forget(mem, { match, chatJid }) {
  const m = clean(match, 80);
  if (!m) return { mem, removed: 0 };
  const owner = mem.owner.filter(x => !x.includes(m));
  const groupList = mem.groups[chatJid] || [];
  const group = groupList.filter(x => !x.includes(m));
  const birthdays = mem.birthdays.filter(b => !(b.chatJid === chatJid && b.name.includes(m)));
  const removed = (mem.owner.length - owner.length) + (groupList.length - group.length) + (mem.birthdays.length - birthdays.length);
  return { mem: { ...mem, owner, groups: { ...mem.groups, [chatJid]: group }, birthdays }, removed };
}

// date: "DD.MM" or "DD/MM" or "MM-DD"
export function parseMonthDay(date) {
  const s = String(date || '').trim();
  let m = s.match(/^(\d{1,2})[./](\d{1,2})/);
  if (m) return `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{2})-(\d{2})$/);
  return m ? s : '';
}

export function addBirthday(mem, { name, date, chatJid, tagId = '' }) {
  const md = parseMonthDay(date);
  if (!md || !clean(name)) return { mem, error: 'צריך שם ותאריך (יום.חודש)' };
  const birthdays = mem.birthdays.filter(b => !(b.chatJid === chatJid && b.name === clean(name, 40)));
  birthdays.push({ name: clean(name, 40), md, chatJid, tagId: String(tagId || '').replace(/\D/g, '') });
  return { mem: { ...mem, birthdays } };
}

export function birthdaysOn(mem, md) {
  return mem.birthdays.filter(b => b.md === md);
}

export function memoryPrompt(mem, { owner, chatJid }) {
  const parts = [];
  if (owner && mem.owner.length) parts.push(`מה שאתה יודע על הבעלים (פרטי, אל תחשוף בקבוצות):\n${mem.owner.map(f => `- ${f}`).join('\n')}`);
  const g = mem.groups[chatJid] || [];
  if (g.length) parts.push(`מה שאתה יודע על הקבוצה הזו והאנשים בה:\n${g.map(f => `- ${f}`).join('\n')}`);
  const b = mem.birthdays.filter(x => x.chatJid === chatJid);
  if (b.length) parts.push(`ימי הולדת בקבוצה: ${b.map(x => `${x.name} ${x.md.slice(3)}.${x.md.slice(0, 2)}`).join(', ')}`);
  const how = `זיכרון ארוך טווח:
- {"a":"remember","fact":"עובדה קצרה וברורה","scope":"${owner ? 'me' : 'group'}"}${owner ? '  (scope "me" לדברים על הבעלים, "group" לדברים על הקבוצה)' : ''}
- {"a":"forget","match":"מילה מתוך העובדה"}
- {"a":"birthday","name":"שם","date":"12.3","tagId":"<מספר התיוג אם בקבוצה>"}
שמור לבד, בלי שמבקשים, דברים שכדאי לזכור לאורך זמן: העדפות, אנשים וקשרים ("רון הוא האח של הבעלים, עובד בביטוח"), תאריכים חשובים, החלטות. לא לשמור דברים זמניים או סודות (סיסמאות, כרטיסי אשראי).
כשאתה שומר משהו, אל תודיע על זה בכל פעם, רק כשמבקשים במפורש לזכור.`;
  return [...parts, how].join('\n\n');
}
