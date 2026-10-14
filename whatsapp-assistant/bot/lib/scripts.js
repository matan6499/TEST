// Script studio for the owner's content page. A style guide plus a growing library of
// scripts the owner wrote or approved, so the bot learns the voice from real examples.
import fs from 'fs';

const MAX_EXAMPLES = 20;
export const SCRIPT_CUES = /(תסריט|סרטון|רילס|ריל\b|הוק|כיתוב|פוסט|תוכן|לעמוד|קרוסלה|טיקטוק|שורטס)/i;

export function loadStudio(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { style: v.style || '', facts: v.facts || '', examples: v.examples || [], prefs: v.prefs || [], ideas: v.ideas || [], todayIdeas: v.todayIdeas || null };
  } catch { return { style: '', facts: '', examples: [], prefs: [], ideas: [] }; }
}

const clean = (s, n) => String(s || '').replace(/\r/g, '').trim().slice(0, n);

export function saveExample(studio, { text, note = '', source = 'approved', date = '' }) {
  const t = clean(text, 4000);
  if (t.length < 80) return { studio, error: 'התסריט קצר מדי לשמירה כדוגמה' };
  const examples = studio.examples.filter(e => e.text.slice(0, 80) !== t.slice(0, 80));
  examples.push({ text: t, note: clean(note, 300), source, date });
  return { studio: { ...studio, examples: examples.slice(-MAX_EXAMPLES) } };
}

export function addPref(studio, pref) {
  const p = clean(pref, 300);
  if (!p) return { studio, error: 'אין העדפה' };
  return { studio: { ...studio, prefs: [...studio.prefs.filter(x => x !== p), p].slice(-40) } };
}

// The full studio prompt goes in only when the conversation is about content, so ordinary
// chats don't pay for it. Newest examples first: they reflect the current voice.
export function studioPrompt(studio, { examplesShown = 5 } = {}) {
  const ex = studio.examples.slice(-examplesShown).reverse();
  return `סטודיו תסריטים לעמוד של הבעלים:
${studio.style}

${studio.facts ? `עובדות על הבעלים שמותר להשתמש בהן (רק אלה, וכל השאר מקום שמור [סיפור שלך: ...]):\n${studio.facts}\n` : ''}${studio.prefs.length ? `העדפות שהבעלים אמר (קודמות לכל כלל אחר):\n${studio.prefs.map(p => `- ${p}`).join('\n')}\n` : ''}
${ex.length ? `דוגמאות לקול שלו (הכי חדשות קודם). תכתוב כמוהן, לא תעתיק אותן:\n${ex.map((e, i) => `--- דוגמה ${i + 1}${e.source === 'matan' ? ' (כתב בעצמו)' : ' (אישר)'}${e.note ? `, למה טוב: ${e.note}` : ''}\n${e.text}`).join('\n')}\n` : ''}
פעולות:
- כשהבעלים אומר שתסריט טוב / מאשר / "תשמור": {"a":"script_save","text":"<התסריט המלא כפי שאושר>","note":"מה עבד בו, בקצרה"}
- כשהבעלים שולח תסריט שכתב בעצמו וזה הסגנון שלו: שמור גם אותו כך, עם "source":"matan"
- כשהבעלים אומר מה הוא אוהב או לא אוהב בכתיבה ("בלי פתיחה בשאלה", "יותר קצר"): {"a":"script_pref","pref":"הכלל בקצרה"}
שמור בשקט, בלי להודיע על כל שמירה.`;
}
