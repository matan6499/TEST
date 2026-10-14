// Lets the chatbot "see" a photo: a vision model describes it and copies any text in
// it, and that description is what Claude reads. The model never gets file access.
import fs from 'fs';

export const VISION_MODEL = 'gpt-4o-mini';

export async function describeImage({ apiKey, imagePath, caption = '', fetchImpl = fetch }) {
  if (!apiKey) throw new Error('חסר מפתח OpenAI');
  const b64 = fs.readFileSync(imagePath).toString('base64');
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `תאר בעברית את התמונה בצורה עניינית ומפורטת: מה רואים, אנשים (בלי לזהות מי הם), חפצים, מקום, מצב רוח.
אם יש בה טקסט (מסמך, צילום מסך, קבלה, שלט, מוצר), העתק אותו כמו שהוא תחת "טקסט בתמונה:". בקבלה: בית העסק, תאריך, סכום.
${caption ? `הכיתוב ששלחו עם התמונה: ${caption}` : ''}` },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'auto' } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `vision ${res.status}`);
  return String(body?.choices?.[0]?.message?.content || '').trim();
}
