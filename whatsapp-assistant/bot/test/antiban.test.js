import test from 'node:test';
import assert from 'node:assert/strict';
import { OutboundGuard, LIMITS } from '../lib/antiban.js';

function guard() {
  let t = 1_000_000;
  const g = new OutboundGuard({ now: () => t, random: () => 0 });
  return { g, tick: (ms) => { t += ms; } };
}

test('never messages someone who did not write first', () => {
  const { g, tick } = guard();
  assert.match(g.checkRecipient('972500000001@s.whatsapp.net'), /לא שולח/);
  g.noteInbound('972500000001@s.whatsapp.net');
  assert.equal(g.checkRecipient('972500000001@s.whatsapp.net'), null);
  tick(LIMITS.inboundWindowMs + 1);
  assert.match(g.checkRecipient('972500000001@s.whatsapp.net'), /לא שולח/);
  assert.equal(g.checkRecipient('x@g.us', { allowedChats: ['x@g.us'] }), null);
  assert.equal(g.checkRecipient('owner@s.whatsapp.net', { isOwnerJid: true }), null);
});

test('spaces messages and caps per chat', () => {
  const { g, tick } = guard();
  g.recordSend('a');
  assert.equal(g.delayBeforeSend(), LIMITS.minGapMs);
  tick(LIMITS.minGapMs);
  assert.equal(g.delayBeforeSend(), 0);
  for (let i = 1; i < LIMITS.perChatPerMinute; i++) g.recordSend('a');
  assert.match(g.checkVolume('a'), /בדקה/);
  assert.equal(g.checkVolume('b'), null);
});

test('flood and join limits', () => {
  const { g } = guard();
  for (let i = 0; i < LIMITS.floodPerMinute; i++) assert.equal(g.isFlooding('c'), false);
  assert.equal(g.isFlooding('c'), true);
  for (let i = 0; i < LIMITS.joinsPerDay; i++) { assert.ok(g.canJoin()); g.recordJoin(); }
  assert.equal(g.canJoin(), false);
});
