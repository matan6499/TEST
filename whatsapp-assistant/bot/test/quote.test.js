import test from 'node:test';
import assert from 'node:assert/strict';
import { splitReply, quotePrompt, waFormat, SPLIT_MARK } from '../lib/quote.js';

test('splitReply separates the quote into its own message', () => {
  assert.deepEqual(splitReply(`סיכום קצר\n${SPLIT_MARK}\n*הצעת מחיר*\nסה"כ`), ['סיכום קצר', '*הצעת מחיר*\nסה"כ']);
  assert.deepEqual(splitReply('רגיל'), ['רגיל']);
});

test('quotePrompt carries the sender and date', () => {
  const p = quotePrompt({ sender: 'ישראל ישראלי', today: '01.10.2026' });
  assert.match(p, /01\.10\.2026/);
  assert.match(p, /\[מע"מ: להשלים\]/);
  assert.match(quotePrompt({ vatRate: 0.18 }), /מע"מ 18%/);
});

test('waFormat turns markdown bold into WhatsApp bold', () => {
  assert.equal(waFormat('**כותרת**\n## סעיף\nטקסט *כבר בולד*'), '*כותרת*\nסעיף\nטקסט *כבר בולד*');
});

test('a leading English planning note is dropped from a Hebrew reply', async () => {
  const { stripPlanningLine } = await import('../lib/quote.js');
  assert.equal(stripPlanningLine("Michelle asks to remember. Short reply.\n\nרשמתי 🥗"), 'רשמתי 🥗');
  assert.equal(stripPlanningLine('Hello there\nhow are you'), 'Hello there\nhow are you');
  assert.equal(stripPlanningLine('https://x.com\nקישור'), 'https://x.com\nקישור');
});
