import test from 'node:test';
import assert from 'node:assert/strict';
import { newMeeting, openMeetingFor, meetingsPrompt, replyPrompt } from '../lib/meetings.js';

test('the asked person is matched by LID or phone, only in that group, while open', () => {
  const now = Date.UTC(2026, 9, 4, 12);
  const m = newMeeting({ groupJid: 'g@g.us', personIds: ['111@lid', '972500001111@s.whatsapp.net'], personName: 'רון', purpose: 'קפה', now });
  assert.equal(openMeetingFor([m], 'g@g.us', ['972500001111@s.whatsapp.net'], now)?.id, m.id);
  assert.equal(openMeetingFor([m], 'g@g.us', ['111@lid'], now)?.id, m.id);
  assert.equal(openMeetingFor([m], 'other@g.us', ['111@lid'], now), null);
  assert.equal(openMeetingFor([m], 'g@g.us', ['222@lid'], now), null);
  assert.equal(openMeetingFor([m], 'g@g.us', ['111@lid'], now + 80 * 3600_000), null);
  assert.match(meetingsPrompt([{ ...m, createdAt: Date.now() }]), new RegExp(m.id));
  assert.match(replyPrompt(m, { text: 'שלישי בערב', calendarConnected: true }), /meeting_propose/);
});
