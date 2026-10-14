// Imported WhatsApp chat exports ("Export chat"), one archive per group. The bot can
// search and pull date ranges from it, and only inside that same group.
import fs from 'fs';
import path from 'path';

const LINE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?\]\s+(?:-\s+)?([^:]{1,60}?):\s([\s\S]*)$/;

export function parseExport(text, { selfName = '' } = {}) {
  const out = [];
  for (const raw of String(text).replace(/\r/g, '').replace(/[‎‏]/g, '').split('\n')) {
    const m = raw.match(LINE);
    if (m) {
      let [, mo, d, y, h, mi, , ampm, name, body] = m;
      let hour = Number(h);
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const when = `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${mi}`;
      const who = name.trim() === 'את/ה' || name.trim() === 'You' ? (selfName || name.trim()) : name.trim();
      const clean = body.replace(/<המדבקה הושמטה>|<sticker omitted>/g, '[סטיקר]').replace(/<[^>]*הושמט[^>]*>|<Media omitted>/g, '[מדיה]').trim();
      out.push({ when, name: who, text: clean });
    } else if (out.length && raw.trim()) {
      out[out.length - 1].text += `\n${raw.trim()}`;
    }
  }
  // System lines ("the group was created...", encryption notice) have no "name: text" shape
  // after a dash; drop anything that is only a sticker to keep the archive lean.
  return out.filter(e => e.text && e.text !== '[סטיקר]');
}

const archivePath = (dir, groupJid) => path.join(dir, `${groupJid.replace(/[^\w@.-]/g, '_')}.json`);

export function saveArchive(dir, groupJid, archive) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(archivePath(dir, groupJid), JSON.stringify(archive));
}

export function loadArchive(dir, groupJid) {
  try { return JSON.parse(fs.readFileSync(archivePath(dir, groupJid), 'utf8')); } catch { return null; }
}

const fmt = (e) => `${e.when.slice(8, 10)}.${e.when.slice(5, 7)} ${e.when.slice(11)} ${e.name}: ${e.text}`;
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');

// Words match with or without a Hebrew prefix letter (ו/ה/ב/ל/ש/מ/כ).
export function searchArchive(archive, query, { limit = 25, context = 2 } = {}) {
  const words = norm(query).split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/^[והבלשמכ](?=\p{L}{3})/u, ''));
  if (!archive || !words.length) return { matches: '', count: 0 };
  const msgs = archive.messages;
  const scored = msgs.map((e, i) => ({ i, score: words.filter(w => norm(`${e.name} ${e.text}`).includes(w)).length })).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || b.i - a.i).slice(0, limit);
  const keep = new Set();
  for (const { i } of scored) for (let k = Math.max(0, i - context); k <= Math.min(msgs.length - 1, i + context); k++) keep.add(k);
  const lines = [...keep].sort((a, b) => a - b).map(k => fmt(msgs[k]));
  return { count: scored.length, matches: lines.join('\n').slice(0, 14000) };
}

export function rangeArchive(archive, from = '', to = '') {
  if (!archive) return { messages: '' };
  const f = String(from || '0000'), t = String(to || '9999');
  const sel = archive.messages.filter(e => e.when.slice(0, 10) >= f && e.when.slice(0, 10) <= t);
  const text = sel.map(fmt).join('\n');
  return { count: sel.length, messages: text.length > 14000 ? `${text.slice(0, 14000)}\n[...נחתך, בקש טווח קצר יותר]` : text };
}

export function archivePrompt(archive) {
  if (!archive) return '';
  return `יש לך גישה מלאה לכל ההיסטוריה של הקבוצה הזו מההתחלה: ארכיון השיחה (יובא מייצוא WhatsApp, ${archive.messages.length} הודעות, ${archive.from} עד ${archive.to}). סודי לקבוצה הזו בלבד: לא מזכירים אותו ולא מצטטים ממנו בשום מקום אחר.
${archive.summary ? `סיכום הארכיון:\n${archive.summary}\n` : ''}כדי לענות על משהו ספציפי מהשיחה (מי אמר, מה הוחלט, מתי, קישור שנשלח), חפש בו:
- {"a":"archive_search","query":"מילות מפתח"}
- {"a":"archive_range","from":"YYYY-MM-DD","to":"YYYY-MM-DD"}  (כל ההודעות בטווח, לסיכום תקופה)
לסיכום של כל השיחה מההתחלה: התחל מהסיכום למעלה, ואם צריך פירוט שלוף טווחים עם archive_range. אל תמציא ציטוטים. אם לא מצאת, תגיד.`;
}
