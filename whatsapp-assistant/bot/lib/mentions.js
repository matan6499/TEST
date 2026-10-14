// Real @-tags in groups. WhatsApp only renders a tag when the message carries the
// person's JID in `mentions` and the text has "@<their id number>". Groups now use
// hidden LID numbers, so the bot keeps a name -> JID map from who actually wrote.
import fs from 'fs';

export function loadMembers(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return v && typeof v === 'object' ? v : {}; }
  catch { return {}; }
}

const idOf = (jid = '') => String(jid).split('@')[0].split(':')[0];

export function rememberMember(members, groupJid, jid, name) {
  if (!groupJid || !jid || !idOf(jid)) return members;
  const group = { ...(members[groupJid] || {}) };
  group[jid] = String(name || group[jid] || '').slice(0, 60);
  return { ...members, [groupJid]: group };
}

export function rememberAlias(members, groupJid, id, alias) {
  const group = { ...(members[groupJid] || {}) };
  const jid = Object.keys(group).find(j => idOf(j) === idOf(id)) || (String(id).includes('@') ? id : `${idOf(id)}@s.whatsapp.net`);
  const current = group[jid] || '';
  const clean = String(alias || '').trim().slice(0, 30);
  if (!clean) return members;
  group[jid] = current && !current.includes(clean) ? `${current} (${clean})` : (current || clean);
  return { ...members, [groupJid]: group };
}

// Everyone in the group, named where we know the name, so the bot can tag even
// people who never wrote since it joined. roster: [{ id, alt }] where id is what the
// group itself uses (often a hidden LID) and alt the phone JID, if known.
export function normalizeRoster(roster = []) {
  return roster.map(r => (typeof r === 'string' ? { id: r, alt: '' } : r)).filter(r => r && r.id);
}
export function membersPrompt(groupMembers = {}, roster = [], ownIds = []) {
  const own = new Set(ownIds.map(idOf));
  const nameOf = new Map(Object.entries(groupMembers).map(([jid, name]) => [idOf(jid), name]));
  const rows = [];
  const seen = new Set();
  for (const { id, alt } of normalizeRoster(roster)) {
    if (own.has(idOf(id)) || (alt && own.has(idOf(alt)))) continue;
    seen.add(idOf(id)); if (alt) seen.add(idOf(alt));
    rows.push(`- ${nameOf.get(idOf(id)) || (alt && nameOf.get(idOf(alt))) || '(שם לא ידוע עדיין)'}: @${idOf(id)}`);
  }
  for (const [num, name] of nameOf) {
    if (!seen.has(num) && !own.has(num)) rows.push(`- ${name}: @${num}`);
  }
  if (!rows.length) return '';
  return `המשתתפים בקבוצה. כדי לתייג מישהו כתוב @ ואחריו המספר שלו בדיוק כמו ברשימה (לא את השם אחרי ה-@):
${rows.join('\n')}
אם הבעלים מבקש לתייג או לתזכר מישהו לפי שם או קרבה (אמא, אח, דור) ואתה לא בטוח מי זה ברשימה, אל תנחש: בקש ממנו לתייג את האדם פעם אחת בהודעה, ואז שמור עם member_alias ותבצע.
כשמתייגים בתזכורת למישהו אחר, כתוב את ה-@ שלו בתוך טקסט התזכורת, והוא זה שיתויג כשהיא תישלח.`;
}

// Find "@123..." in the reply and return the JIDs to attach as real mentions.
export function mentionsFor(text = '', groupMembers = {}, roster = []) {
  const known = new Map();
  for (const jid of Object.keys(groupMembers)) known.set(idOf(jid), jid);
  // The group's own id wins: a tag only renders with the id the group addresses people by.
  for (const { id, alt } of normalizeRoster(roster)) { known.set(idOf(id), id); if (alt) known.set(idOf(alt), id); }
  const out = new Set();
  for (const m of String(text).matchAll(/@(\d{6,})/g)) {
    const jid = known.get(m[1]);
    if (jid) out.add(jid);
  }
  return [...out];
}
