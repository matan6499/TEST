import test from 'node:test';
import assert from 'node:assert/strict';
import { saveExample, addPref, studioPrompt, SCRIPT_CUES } from '../lib/scripts.js';

const base = { style: 'סגנון', facts: '- עובדה', examples: [], prefs: [] };

test('examples and prefs are saved, newest first in the prompt', () => {
  let { studio } = saveExample(base, { text: 'א'.repeat(90) + ' ראשון', source: 'matan' });
  ({ studio } = saveExample(studio, { text: 'ב'.repeat(90) + ' שני', note: 'הוק חזק' }));
  ({ studio } = addPref(studio, 'בלי פתיחה בשאלה רטורית'));
  const p = studioPrompt(studio);
  assert.ok(p.indexOf('שני') < p.indexOf('ראשון'));
  assert.match(p, /כתב בעצמו/);
  assert.match(p, /בלי פתיחה בשאלה רטורית/);
  assert.ok(saveExample(base, { text: 'קצר' }).error);
});

test('content talk is detected', () => {
  assert.ok(SCRIPT_CUES.test('תכתוב לי תסריט על שבת'));
  assert.ok(SCRIPT_CUES.test('יש לך רעיון להוק?'));
  assert.ok(!SCRIPT_CUES.test('מה השעה'));
});
