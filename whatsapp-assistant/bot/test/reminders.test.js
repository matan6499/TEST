import test from 'node:test';
import assert from 'node:assert/strict';
import { localToEpoch, formatLocal, extractReminderTags, newReminder, dueReminders, reminderPrompt } from '../lib/reminders.js';

test('localToEpoch reads Israel time in summer and winter', () => {
  assert.equal(localToEpoch('2026-07-01T09:00'), Date.UTC(2026, 6, 1, 6, 0)); // IDT +3
  assert.equal(localToEpoch('2026-12-01T09:00'), Date.UTC(2026, 11, 1, 7, 0)); // IST +2
  assert.ok(Number.isNaN(localToEpoch('מחר בתשע')));
});

test('formatLocal round-trips', () => {
  assert.match(formatLocal(localToEpoch('2026-10-01T18:30')), /^2026-10-01T18:30 /);
});

test('extractReminderTags strips tags and collects actions', () => {
  const r = extractReminderTags('סגור, אזכיר לך מחר.\n[[REMIND|2026-10-01T09:00|להתקשר לדני]]\n[[CANCEL_REMIND|abc123]]');
  assert.equal(r.text, 'סגור, אזכיר לך מחר.');
  assert.deepEqual(r.add, [{ when: '2026-10-01T09:00', text: 'להתקשר לדני' }]);
  assert.deepEqual(r.cancel, ['abc123']);
  assert.deepEqual(extractReminderTags('רגיל').add, []);
});

test('newReminder rejects past and malformed times', () => {
  const now = Date.UTC(2026, 8, 30, 12, 0);
  assert.ok(newReminder({ when: 'x', text: 'a', now }).error);
  assert.ok(newReminder({ when: '2026-09-01T10:00', text: 'a', now }).error);
  const ok = newReminder({ when: '2026-10-01T10:00', text: 'a', chatJid: 'g', senderJid: 's', now });
  assert.equal(ok.reminder.chatJid, 'g');
  assert.deepEqual(dueReminders([ok.reminder], ok.reminder.at), [ok.reminder]);
  assert.deepEqual(dueReminders([ok.reminder], now), []);
});

test('reminderPrompt lists pending reminders', () => {
  const p = reminderPrompt([{ id: 'x1', at: localToEpoch('2026-10-01T10:00'), text: 'לשלם' }]);
  assert.match(p, /x1: 2026-10-01T10:00/);
  assert.match(p, /\[\[REMIND\|/);
});
