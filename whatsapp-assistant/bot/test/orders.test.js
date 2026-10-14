import test from 'node:test';
import assert from 'node:assert/strict';
import { addOrder, setOrderStatus, openOrders, formatOrder, formatSummary, customerOrdersPrompt, ownerOrdersPrompt } from '../lib/orders.js';

const full = { name: 'דנה', recipient: 'סבתא רחל', occasion: 'יום הולדת 80', relation: 'נכדה, אוהבת לרקוד', message: 'מזל טוב!', song: 'הללויה', deadline: '2026-10-20' };
const chatJid = '972501234567@s.whatsapp.net';

test('a complete order is saved with the sender phone and a running number', () => {
  const r = addOrder([], full, { chatJid, today: '2026-10-14', now: 1 });
  assert.equal(r.order.id, 1);
  assert.equal(r.order.phone, '972501234567');
  assert.equal(r.order.status, 'awaiting_payment');
  const r2 = addOrder(r.orders, { ...full, phone: '050-111 2222' }, { chatJid: '123@lid', today: '2026-10-14', now: 2 });
  assert.equal(r2.order.id, 2);
  assert.equal(r2.order.phone, '0501112222');
  assert.equal(r2.orders.length, 2);
});

test('missing details, bad or past dates are refused and nothing is saved', () => {
  const r = addOrder([], { name: 'דנה' }, { chatJid: '123@lid', today: '2026-10-14' });
  assert.equal(r.orders, undefined);
  assert.deepEqual(r.missing, ['טלפון', 'את מי לברך', 'סיבה', 'מה להגיד', 'עד מתי']);
  assert.match(addOrder([], { ...full, deadline: 'מחר' }, { chatJid, today: '2026-10-14' }).error, /תאריך/);
  assert.match(addOrder([], { ...full, deadline: '2026-10-01' }, { chatJid, today: '2026-10-14' }).error, /עבר/);
  // song and relation are optional
  assert.ok(addOrder([], { ...full, song: '', relation: '' }, { chatJid, today: '2026-10-14' }).order);
});

test('one chat cannot flood orders', () => {
  let list = [];
  for (let i = 0; i < 5; i++) list = addOrder(list, full, { chatJid, today: '2026-10-14', now: 1000 + i }).orders;
  assert.match(addOrder(list, full, { chatJid, today: '2026-10-14', now: 2000 }).error, /יותר מדי/);
  assert.ok(addOrder(list, full, { chatJid: '972509999999@s.whatsapp.net', today: '2026-10-14', now: 2000 }).order);
});

test('status changes, open list and summary', () => {
  let list = addOrder([], full, { chatJid, today: '2026-10-14' }).orders;
  list = addOrder(list, { ...full, recipient: 'יוסי', deadline: '2026-10-14' }, { chatJid: '972508888888@s.whatsapp.net', today: '2026-10-14' }).orders;
  assert.match(setOrderStatus(list, 9, 'paid').error, /אין הזמנה/);
  assert.match(setOrderStatus(list, 1, 'whatever').error, /סטטוס/);
  const r = setOrderStatus(list, 1, 'paid');
  assert.equal(r.previous, 'awaiting_payment');
  list = r.orders;
  assert.deepEqual(openOrders(list).map(o => o.id), [2, 1]); // nearest deadline first
  const summary = formatSummary(list, '2026-10-14');
  assert.match(summary, /ברכות פתוחות: 2/);
  assert.match(summary, /שולם, לצלם \(1\)/);
  assert.match(summary, /יוסי.*🔥 היום/);
  list = setOrderStatus(list, 1, 'done').orders;
  list = setOrderStatus(list, 2, 'cancelled').orders;
  assert.equal(formatSummary(list, '2026-10-14'), '');
});

test('owner card and prompts carry the details', () => {
  const o = addOrder([], full, { chatJid, today: '2026-10-14' }).order;
  const card = formatOrder(o);
  for (const v of ['סבתא רחל', 'הללויה', '972501234567', '20.10', 'נכדה']) assert.ok(card.includes(v), v);
  const p = customerOrdersPrompt({ price: 150, paymentLink: 'https://pay.example/x', today: '2026-10-14', by: 'מאור', mine: [o] });
  assert.match(p, /150 ש"ח/);
  assert.match(p, /pay\.example/);
  assert.match(p, /"a":"order"/);
  assert.match(p, /רק מאור מאשר/);
  assert.match(customerOrdersPrompt({}), /פרטי התשלום יגיעו/);
  assert.match(ownerOrdersPrompt([o]), /order_status/);
  for (const text of [p, card, ownerOrdersPrompt([o]), formatSummary([o], '2026-10-14')]) assert.ok(!text.includes('—'));
});
