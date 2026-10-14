// A small spend ledger. OpenAI does not expose the prepaid balance to a normal key, so
// the bot records an estimate for every paid call and subtracts it from what the owner
// says they topped up. Claude usage (tokens per call) is counted per day as well.
import fs from 'fs';

// Rough list prices in USD. Estimates only, good enough for "how much is left".
export const PRICES = {
  image: 0.042,          // gpt-image-1, 1024x1024 medium
  imageEdit: 0.05,
  vision: 0.002,         // gpt-4o-mini, one photo
  search: 0.03,          // web_search call plus tokens
  transcribeMinute: 0.006,
};

export function loadLedger(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { days: v.days || {}, budget: v.budget || null, alerts: v.alerts || {} };
  } catch { return { days: {}, budget: null, alerts: {} }; }
}

function day(ledger, ymd) {
  const d = ledger.days[ymd] || { openai: { usd: 0, items: {} }, claude: { calls: 0, input: 0, output: 0, cacheRead: 0, usdEq: 0, byModel: {} } };
  ledger.days[ymd] = d;
  return d;
}

export function recordOpenAI(ledger, ymd, item, usd) {
  const d = day(ledger, ymd);
  d.openai.usd = +(d.openai.usd + usd).toFixed(4);
  d.openai.items[item] = (d.openai.items[item] || 0) + 1;
  return ledger;
}

export function recordClaude(ledger, ymd, { model = '', usage = {}, costUsd = 0 } = {}) {
  const d = day(ledger, ymd);
  d.claude.calls += 1;
  d.claude.input += (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  d.claude.output += usage.output_tokens || 0;
  d.claude.cacheRead += usage.cache_read_input_tokens || 0;
  d.claude.usdEq = +(d.claude.usdEq + (costUsd || 0)).toFixed(4);
  d.claude.byModel[model || '?'] = (d.claude.byModel[model || '?'] || 0) + 1;
  return ledger;
}

export function openaiSpentSince(ledger, sinceYmd) {
  return Object.entries(ledger.days).filter(([d]) => !sinceYmd || d >= sinceYmd)
    .reduce((sum, [, v]) => sum + (v.openai?.usd || 0), 0);
}

export function openaiRemaining(ledger) {
  if (!ledger.budget) return null;
  return +(ledger.budget.usd - openaiSpentSince(ledger, ledger.budget.since)).toFixed(2);
}

export function setBudget(ledger, usd, ymd) {
  ledger.budget = { usd: Number(usd) || 0, since: ymd };
  ledger.alerts = { ...ledger.alerts, low: null, veryLow: null };
  return ledger;
}

const fmt = (n) => `$${(+n).toFixed(2)}`;

export function costSummary(ledger, ymd) {
  const d = ledger.days[ymd];
  const rem = openaiRemaining(ledger);
  const oa = d ? `OpenAI ${fmt(d.openai.usd)}${Object.keys(d.openai.items).length ? ` (${Object.entries(d.openai.items).map(([k, v]) => `${k}×${v}`).join(', ')})` : ''}` : 'OpenAI $0.00';
  const cl = d ? `Claude ${d.claude.calls} שיחות` : 'Claude 0 שיחות';
  return `${oa} · ${cl}${rem !== null ? ` · נשאר קרדיט OpenAI בערך ${fmt(rem)}` : ' · עוד לא נאמר כמה הוטען ל-OpenAI'}`;
}

// Which alerts are due now. Each fires once until the budget is reset.
export function dueAlerts(ledger, ymd, { callsAlert = 250 } = {}) {
  const out = [];
  const rem = openaiRemaining(ledger);
  if (rem !== null && rem < 0.5 && !ledger.alerts.veryLow) { out.push({ key: 'veryLow', text: `💸 הקרדיט ב-OpenAI כמעט נגמר (נשאר בערך ${fmt(rem)}). בלי טעינה: תמונות, חיפוש, תיאור תמונות והקלטות ארוכות יפסיקו לעבוד. טוענים ב-platform.openai.com/settings/organization/billing ואז כותבים לי "הטענתי X דולר".` }); }
  else if (rem !== null && rem < 1.5 && !ledger.alerts.low) { out.push({ key: 'low', text: `💰 נשאר בערך ${fmt(rem)} קרדיט ב-OpenAI. כדאי לטעון בקרוב.` }); }
  const calls = ledger.days[ymd]?.claude?.calls || 0;
  if (calls >= callsAlert && ledger.alerts.busyDay !== ymd) out.push({ key: 'busyDay', value: ymd, text: `📊 היום כבר ${calls} שיחות עם Claude, הרבה יותר מהרגיל. אם זה לא אתה, יכול להיות שמישהו בקבוצה מציף את הבוט.` });
  return out;
}

export function costsPrompt(ledger, ymd) {
  return `כסף ושימוש (רק לבעלים): היום ${costSummary(ledger, ymd)}.
כשהבעלים אומר שטען קרדיט ל-OpenAI ("הטענתי 10 דולר"): {"a":"budget","usd":10}. אם הוא שואל כמה נשאר, ענה מהשורה למעלה וציין שזו הערכה.`;
}
