// A written price quote, ready to forward to a client. Built from what was actually
// said: no invented prices, no promised results, gaps marked for the owner to fill.

export const SPLIT_MARK = '[[SPLIT]]';

// WhatsApp bolds *text*; Markdown's **text** would show stray asterisks.
export function waFormat(text = '') {
  return stripPlanningLine(String(text)).replace(/\*\*(.+?)\*\*/gs, '*$1*').replace(/^#{1,6}\s+/gm, '');
}

// Sometimes the model opens with a note to itself in English ("User asks X. Short reply.")
// before the real Hebrew answer. Drop such a leading line when the rest is Hebrew.
export function stripPlanningLine(text = '') {
  const lines = String(text).split('\n');
  const first = lines[0] || '';
  const rest = lines.slice(1).join('\n');
  const isLatinNote = /[A-Za-z]{3,}/.test(first) && !/[\u0590-\u05FF]/.test(first) && !/https?:|@\d/.test(first);
  return isLatinNote && /[\u0590-\u05FF]/.test(rest) ? rest.replace(/^\s+/, '') : String(text);
}

export function splitReply(reply = '') {
  return waFormat(reply).split(SPLIT_MARK).map(p => p.trim()).filter(Boolean);
}

export function quotePrompt({ sender = '[שם ופרטי העסק]', today = '', vatRate = 0 } = {}) {
  return `הצעת מחיר ללקוח:
כשמבקשים הצעת מחיר, או כשבהקלטת שיחה דובר על שירות ומחיר ללקוח, הכן הצעת מחיר כתובה.
שים אותה בהודעה נפרדת: כתוב ${SPLIT_MARK} בשורה לבד, ואחריו רק את ההצעה עצמה, מוכנה להעברה ללקוח כמו שהיא.
מבנה ההצעה (טקסט פשוט לוואטסאפ, *כוכביות* להדגשה):
*הצעת מחיר*
לכבוד: <שם הלקוח או העסק>
תאריך: ${today}

*מה כלול:*
• <שירות או פריט> : <מחיר> ₪
(שורה לכל פריט, עם כמות אם נאמרה)

${vatRate ? `סה"כ לפני מע"מ: <סכום> ₪
מע"מ ${Math.round(vatRate * 100)}%: <סכום> ₪
*סה"כ לתשלום: <סכום כולל מע"מ> ₪*` : `*סה"כ: <סכום> ₪*`}
<תנאי תשלום, לוחות זמנים, מספר סבבי תיקונים, רק אם נאמרו>
ההצעה בתוקף ל-14 יום.

${sender}
${vatRate ? `הבעלים עוסק מורשה: מחירים שנאמרו בשיחה הם לפני מע"מ, אלא אם נאמר במפורש "כולל מע"מ" (אז פרק אחורה). חשב את המע"מ והסה"כ בדיוק, עגל לשקל.
` : ''}כללים: רק מחירים ותנאים שנאמרו בפועל. מה שחסר או לא ברור כתוב בסוגריים מרובעים, למשל [מע"מ: להשלים], כדי שהבעלים ישלים לפני השליחה. בלי הבטחות לתוצאות, בלי מספרים שלא נאמרו, בלי מקף ארוך. בתשובה לבעלים (לפני ${SPLIT_MARK}) ציין במשפט מה צריך להשלים.`;
}
