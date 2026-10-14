import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExport, searchArchive, rangeArchive, archivePrompt } from '../lib/archive.js';

const sample = `[8/26/26, 4:19:29 PM] - הקבוצה נוצרה על ידי רון
[8/26/26, 6:20:10 PM] נועה: <המדבקה הושמטה>
[8/26/26, 6:21:06 PM] רון: נזכרתי במשהו
שורה שנייה של אותה הודעה
[9/04/26, 9:05:00 AM] את/ה: קבענו פגישה ביום רביעי בתל אביב
[9/10/26, 12:38:00 PM] נועה: הנה הקישור https://example.com`;

test('export lines parse with times, multiline text and the exporter name', () => {
  const m = parseExport(sample, { selfName: 'הבעלים' });
  assert.equal(m.length, 3); // system line and sticker-only line dropped
  assert.deepEqual(m[0], { when: '2026-08-26T18:21', name: 'רון', text: 'נזכרתי במשהו\nשורה שנייה של אותה הודעה' });
  assert.equal(m[1].name, 'הבעלים');
  assert.equal(m[1].when, '2026-09-04T09:05');
});

test('search finds words with Hebrew prefixes, range filters by date', () => {
  const a = { messages: parseExport(sample, { selfName: 'הבעלים' }), from: '2026-08-26', to: '2026-09-10' };
  assert.match(searchArchive(a, 'בפגישה').matches, /קבענו פגישה/);
  assert.equal(rangeArchive(a, '2026-09-01', '2026-09-30').count, 2);
  assert.match(archivePrompt({ ...a, summary: 'סיכום' }), /סודי לקבוצה הזו בלבד/);
});
