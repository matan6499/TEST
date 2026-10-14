import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLedger, recordOpenAI, recordClaude, setBudget, openaiRemaining, costSummary, dueAlerts, PRICES } from '../lib/costs.js';

const fresh = () => loadLedger('/nonexistent/ledger.json');

test('remaining credit is the top-up minus what was spent since', () => {
  const l = fresh();
  recordOpenAI(l, '2026-10-01', 'image', 1);           // before the top-up, not counted
  setBudget(l, 5, '2026-10-02');
  recordOpenAI(l, '2026-10-02', 'image', PRICES.image);
  recordOpenAI(l, '2026-10-03', 'search', PRICES.search);
  assert.equal(openaiRemaining(l), +(5 - PRICES.image - PRICES.search).toFixed(2));
  assert.match(costSummary(l, '2026-10-02'), /image×1/);
});

test('claude usage is counted per day', () => {
  const l = fresh();
  recordClaude(l, '2026-10-04', { model: 'opus', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000 }, costUsd: 0.02 });
  recordClaude(l, '2026-10-04', { model: 'opus', usage: { input_tokens: 10, output_tokens: 5 } });
  assert.equal(l.days['2026-10-04'].claude.calls, 2);
  assert.equal(l.days['2026-10-04'].claude.byModel.opus, 2);
});

test('low-credit and busy-day alerts fire once', () => {
  const l = fresh();
  setBudget(l, 1.2, '2026-10-04');
  const a = dueAlerts(l, '2026-10-04');
  assert.deepEqual(a.map(x => x.key), ['low']);
  l.alerts.low = true;
  assert.equal(dueAlerts(l, '2026-10-04').length, 0);
  recordOpenAI(l, '2026-10-04', 'image', 1);
  assert.deepEqual(dueAlerts(l, '2026-10-04').map(x => x.key), ['veryLow']);
  for (let i = 0; i < 3; i++) recordClaude(l, '2026-10-04', {});
  assert.ok(dueAlerts(l, '2026-10-04', { callsAlert: 3 }).some(x => x.key === 'busyDay'));
});
