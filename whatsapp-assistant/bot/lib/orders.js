// Paid greeting videos: strangers order in private chat, the bot collects the details,
// saves the order and sends it to the owner. The owner marks payment and filming by hand.
import fs from 'fs';

export const STATUSES = {
  awaiting_payment: 'מחכה לתשלום',
  paid: 'שולם, לצלם',
  done: 'צולם ונשלח',
  cancelled: 'בוטל',
};
const OPEN = new Set(['awaiting_payment', 'paid']);
const FIELDS = {
  name: 'שם המזמין',
  phone: 'טלפון',
  recipient: 'את מי לברך',
  occasion: 'סיבה',
  relation: 'קשר ופרטים על המבורך',
  message: 'מה להגיד',
  song: 'שיר שאוהבים',
  deadline: 'עד מתי',
};
const REQUIRED = ['name', 'phone', 'recipient', 'occasion', 'message', 'deadline'];
const MAX_PER_CHAT_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60_000;

export function loadOrders(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
}

const clean = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isPhoneJid = (jid = '') => String(jid).endsWith('@s.whatsapp.net');

// Returns { orders, order } on success, or { error, missing } without touching the list.
export function addOrder(orders, input = {}, { chatJid = '', today = '', now = Date.now() } = {}) {
  const order = {};
  for (const key of Object.keys(FIELDS)) order[key] = clean(input[key], key === 'message' || key === 'relation' ? 600 : 200);
  if (!order.phone && isPhoneJid(chatJid)) order.phone = String(chatJid).split('@')[0].split(':')[0];
  order.phone = order.phone.replace(/[^\d+]/g, '');
  const missing = REQUIRED.filter(k => !order[k]);
  if (missing.length) return { error: 'חסרים פרטים', missing: missing.map(k => FIELDS[k]) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(order.deadline) || Number.isNaN(Date.parse(`${order.deadline}T12:00:00Z`))) {
    return { error: 'תאריך לא תקין, צריך YYYY-MM-DD', missing: [FIELDS.deadline] };
  }
  if (today && order.deadline < today) return { error: 'התאריך כבר עבר', missing: [FIELDS.deadline] };
  const recent = orders.filter(o => o.chatJid === chatJid && now - o.createdAt < DAY_MS).length;
  if (recent >= MAX_PER_CHAT_PER_DAY) return { error: 'יותר מדי הזמנות מהצ\'אט הזה היום' };
  const id = orders.reduce((max, o) => Math.max(max, Number(o.id) || 0), 0) + 1;
  const saved = { id, ...order, chatJid, status: 'awaiting_payment', createdAt: now };
  return { orders: [...orders, saved], order: saved };
}

export function setOrderStatus(orders, id, status) {
  if (!STATUSES[status]) return { error: 'סטטוס לא חוקי' };
  const order = orders.find(o => Number(o.id) === Number(id));
  if (!order) return { error: `אין הזמנה ${id}` };
  const updated = { ...order, status, updatedAt: Date.now() };
  return { orders: orders.map(o => (o === order ? updated : o)), order: updated, previous: order.status };
}

export function openOrders(orders) {
  return orders.filter(o => OPEN.has(o.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id);
}

const fmtDate = (ymd) => ymd.split('-').reverse().slice(0, 2).join('.');

export function formatOrder(o) {
  return [
    `🎬 הזמנה ${o.id}: ${STATUSES[o.status] || o.status}`,
    `👤 ${FIELDS.name}: ${o.name}`,
    `📞 ${FIELDS.phone}: ${o.phone}`,
    `🎉 ${FIELDS.recipient}: ${o.recipient}`,
    `🎂 ${FIELDS.occasion}: ${o.occasion}`,
    o.relation && `🤝 ${FIELDS.relation}: ${o.relation}`,
    `💬 ${FIELDS.message}: ${o.message}`,
    o.song && `🎵 ${FIELDS.song}: ${o.song}`,
    `📅 ${FIELDS.deadline}: ${fmtDate(o.deadline)}`,
  ].filter(Boolean).join('\n');
}

export function formatSummary(orders, today) {
  const open = openOrders(orders);
  if (!open.length) return '';
  const line = (o) => `${o.id}. ${o.recipient} (${o.occasion}) עד ${fmtDate(o.deadline)}${o.deadline < today ? ' ⚠️ עבר' : o.deadline === today ? ' 🔥 היום' : ''}\n   ${o.name}, ${o.phone}${o.song ? `, 🎵 ${o.song}` : ''}\n   💬 ${o.message}`;
  const paid = open.filter(o => o.status === 'paid');
  const waiting = open.filter(o => o.status === 'awaiting_payment');
  return [
    `📋 ברכות פתוחות: ${open.length}`,
    paid.length && `\n✅ שולם, לצלם (${paid.length}):\n${paid.map(line).join('\n')}`,
    waiting.length && `\n⏳ מחכים לתשלום (${waiting.length}):\n${waiting.map(line).join('\n')}`,
  ].filter(Boolean).join('\n');
}

// For a customer chatting in private.
export function customerOrdersPrompt({ price = 0, paymentLink = '', today = '', mine = [], by = 'הבעלים' } = {}) {
  const pay = paymentLink
    ? `אחרי שההזמנה נשמרה, שלח את הקישור לתשלום: ${paymentLink}. תגיד שהצילום מתחיל אחרי שהתשלום מאושר.`
    : 'אחרי שההזמנה נשמרה, תגיד שפרטי התשלום יגיעו בהודעה נפרדת, והצילום מתחיל אחרי שהתשלום מאושר.';
  return `הזמנת ברכה מצולמת${price ? ` (${price} ש"ח לברכה)` : ''}. היום ${today}.
כשמישהו רוצה ברכה, תאסוף ממנו בשיחה, שאלה או שתיים בכל הודעה ולא טופס:
${Object.entries(FIELDS).map(([k, v]) => `- ${k}: ${v}${REQUIRED.includes(k) ? '' : ' (אם אין, תדלג)'}`).join('\n')}
התאריך בפורמט YYYY-MM-DD. אם לא נתנו טלפון, תשאל אם לרשום את המספר שממנו הם כותבים.
לפני ששומרים, תסכם להם את כל הפרטים בהודעה אחת ותבקש אישור. רק אחרי "כן":
[[ACT {"a":"order","name":"","phone":"","recipient":"","occasion":"","relation":"","message":"","song":"","deadline":"YYYY-MM-DD"}]]
${pay}
אל תאשר שהתשלום התקבל ואל תבטיח מועד. את זה רק ${by} מאשר. אל תמציא מחירים או הנחות.${mine.length ? `\nההזמנות של הצ'אט הזה: ${mine.map(o => `${o.id} (${o.recipient}, ${STATUSES[o.status]})`).join(', ')}` : ''}`;
}

// For the owner.
export function ownerOrdersPrompt(orders) {
  const open = openOrders(orders);
  return `הזמנות ברכות:
- כשהבעלים כותב ששילמו על הזמנה ("שולם 12"): {"a":"order_status","id":12,"status":"paid"}
- צולם ונשלח: {"a":"order_status","id":12,"status":"done"}. ביטול: {"a":"order_status","id":12,"status":"cancelled"}
- לרשימה המלאה: {"a":"order_list"}
${open.length ? `פתוחות: ${open.map(o => `${o.id} ${o.recipient} עד ${o.deadline} (${STATUSES[o.status]})`).join('; ')}` : 'אין הזמנות פתוחות.'}`;
}
