import test from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, recentEntries, describeMessage, HISTORY_MAX_PER_CHAT } from '../lib/history.js';
import { isPrivateAddress, htmlToText, fetchPage } from '../lib/web.js';

test('group history keeps recent entries and caps size', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  let h = addEntry({}, 'g', { name: 'דני', text: 'ישן' }, now - 30 * 3600_000);
  h = addEntry(h, 'g', { name: 'רון', text: 'חדש' }, now);
  assert.deepEqual(recentEntries(h, 'g', 24, now).map(e => e.text), ['חדש']);
  for (let i = 0; i < HISTORY_MAX_PER_CHAT + 5; i++) h = addEntry(h, 'g', { name: 'x', text: String(i) }, now);
  assert.equal(h.g.length, HISTORY_MAX_PER_CHAT);
  assert.equal(describeMessage({ imageMessage: { caption: 'שקיעה' } }), '[תמונה] שקיעה');
});

test('private and local addresses are refused', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.139', '169.254.169.254', '192.168.1.1', '::1', '::ffff:127.0.0.1']) assert.ok(isPrivateAddress(ip), ip);
  assert.ok(!isPrivateAddress('8.8.8.8'));
  await assert.rejects(fetchPage('http://127.0.0.1:7655/state'), /פנימית/);
  await assert.rejects(fetchPage('file:///etc/passwd'), /http/);
});

test('htmlToText pulls title, description and body', () => {
  const r = htmlToText('<html><head><title>כותרת</title><meta name="description" content="תיאור"></head><body><script>x</script><p>שלום &amp; ברכה</p></body></html>');
  assert.equal(r.title, 'כותרת');
  assert.equal(r.description, 'תיאור');
  assert.match(r.text, /שלום & ברכה/);
  assert.doesNotMatch(r.text, /x/);
});
