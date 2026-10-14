// Live web search through OpenAI's search model, with sources. Used for anything
// current: prices, flights, opening hours, news, scores.
export const SEARCH_MODEL = 'gpt-5.4-mini';

// Responses API with the built-in web_search tool.
export async function webSearch({ apiKey, query, model = SEARCH_MODEL, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('חסר מפתח OpenAI');
  const res = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'IL', timezone: 'Asia/Jerusalem' } }],
      input: `${query}\n\nחפש מידע עדכני ותן תשובה עניינית בעברית עם עובדות, מספרים ותאריכים.`,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `search ${res.status}`);
  const parts = (body.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text');
  const answer = parts.map(c => c.text).join('\n').trim();
  const sources = parts.flatMap(c => c.annotations || []).filter(a => a.type === 'url_citation')
    .map(a => ({ title: a.title || '', url: a.url || '' }))
    .filter((a, k, arr) => a.url && arr.findIndex(b => b.url === a.url) === k).slice(0, 6);
  return { answer: answer.slice(0, 6000), sources };
}

export function searchPrompt({ remaining }) {
  return `חיפוש באינטרנט (נשארו היום ${remaining}):
- {"a":"web_search","query":"מה לחפש, מפורט"}
השתמש בזה לכל דבר עדכני: מחירים, טיסות, שעות פתיחה, חדשות, תוצאות, מזג אוויר, "מה הכי טוב לקנות". אל תמציא מחירים או זמנים מהזיכרון.
כדי להפעיל, כתוב את התגית בסוף התשובה: [[ACT {"a":"web_search","query":"..."}]]. אחרי התוצאות ענה קצר, עם קישור אחד או שניים רלוונטיים.`;
}
