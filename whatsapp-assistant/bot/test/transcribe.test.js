import test from 'node:test';
import assert from 'node:assert/strict';
import { whisperArgs, cleanTranscript } from '../lib/transcribe.js';

test('short notes get a shrunk audio window, long ones keep the full one', () => {
  const short = whisperArgs({ model: 'm', wav: 'w', seconds: 8, threads: 4 });
  assert.equal(short[short.indexOf('-ac') + 1], '528');
  assert.ok(short.includes('he'));
  assert.ok(!whisperArgs({ model: 'm', wav: 'w', seconds: 95, threads: 4 }).includes('-ac'));
});

test('cleanTranscript joins lines', () => {
  assert.equal(cleanTranscript('\n שלום\n עולם \n'), 'שלום עולם');
});
