// Image generation and editing through the OpenAI Images API (the ChatGPT image model).
// Owner-only and capped per day by the caller, since every image costs API credit.
import fs from 'fs';

export const IMAGE_MODEL = 'gpt-image-1';
export const IMAGE_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);

function pickSize(size) { return IMAGE_SIZES.has(size) ? size : '1024x1024'; }

async function parse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    if (res.status === 429 || /quota|billing|credit/i.test(msg)) throw new Error(`אין קרדיט ב-OpenAI: ${msg}`);
    throw new Error(msg);
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('לא חזרה תמונה');
  return Buffer.from(b64, 'base64');
}

export async function generateImage({ apiKey, prompt, size, quality = 'medium', fetchImpl = fetch }) {
  if (!apiKey) throw new Error('חסר מפתח OpenAI');
  const res = await fetchImpl('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt: String(prompt).slice(0, 4000), size: pickSize(size), quality, n: 1 }),
    signal: AbortSignal.timeout(180_000),
  });
  return parse(res);
}

export async function editImage({ apiKey, prompt, imagePath, size, quality = 'medium', fetchImpl = fetch }) {
  if (!apiKey) throw new Error('חסר מפתח OpenAI');
  if (!imagePath || !fs.existsSync(imagePath)) throw new Error('לא מצאתי את התמונה לעריכה, שלח אותה שוב');
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', String(prompt).slice(0, 4000));
  form.append('size', pickSize(size));
  form.append('quality', quality);
  form.append('image', new Blob([fs.readFileSync(imagePath)], { type: 'image/jpeg' }), 'image.jpg');
  const res = await fetchImpl('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  return parse(res);
}

export function imagesPrompt({ remaining, hasPhoto }) {
  return `תמונות (מנוע התמונות של ChatGPT, נשאר היום: ${remaining}):
- {"a":"image_gen","prompt":"תיאור מפורט באנגלית","size":"1024x1024"}  (גדלים: 1024x1024 ריבוע, 1024x1536 לאורך, 1536x1024 לרוחב)
${hasPhoto ? '- {"a":"image_edit","prompt":"מה לשנות, באנגלית"}  (עורך את התמונה האחרונה שהבעלים שלח בצ\'אט הזה)\n' : ''}כתוב את ה-prompt באנגלית, מפורט: נושא, סגנון, תאורה, קומפוזיציה. טקסט שצריך להופיע בתמונה כתוב בדיוק במירכאות.
התמונה נשלחת לצ'אט אוטומטית. אחרי התוצאה ענה רק משפט קצר, בלי לתאר את התמונה.
אל תיצור תמונה בלי שביקשו.`;
}
