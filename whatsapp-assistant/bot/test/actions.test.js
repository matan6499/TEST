import test from 'node:test';
import assert from 'node:assert/strict';
import { extractActionTags, applyListAction, callGoogle, actionsPrompt } from '../lib/actions.js';

test('extractActionTags pulls JSON actions and strips them', () => {
  const r = extractActionTags('הוספתי.\n[[ACT {"a":"list_add","list":"קניות","items":["חלב"]}]]\n[[ACT {broken}]]');
  assert.equal(r.text, 'הוספתי.');
  assert.deepEqual(r.actions, [{ a: 'list_add', list: 'קניות', items: ['חלב'] }]);
  assert.equal(r.errors.length, 1);
});

test('list actions add, dedupe, remove and clear', () => {
  let { lists } = applyListAction({}, { a: 'list_add', list: 'קניות', items: ['חלב', 'ביצים'] });
  ({ lists } = applyListAction(lists, { a: 'list_add', list: 'קניות', items: ['חלב', 'לחם'] }));
  assert.deepEqual(lists['קניות'], ['חלב', 'ביצים', 'לחם']);
  ({ lists } = applyListAction(lists, { a: 'list_remove', list: 'קניות', items: ['ביצים'] }));
  assert.deepEqual(applyListAction(lists, { a: 'list_show', list: 'קניות' }).result.items, ['חלב', 'לחם']);
  ({ lists } = applyListAction(lists, { a: 'list_clear', list: 'קניות' }));
  assert.equal(lists['קניות'], undefined);
});

test('callGoogle sends key and params, and reports missing setup', async () => {
  assert.match((await callGoogle({ url: '', key: '', act: { a: 'cal_list' } })).error, /googleScriptUrl/);
  let sent;
  const fetchImpl = async (url, opts) => { sent = JSON.parse(opts.body); return { status: 200, text: async () => '{"events":[]}' }; };
  const r = await callGoogle({ url: 'https://x', key: 'k', act: { a: 'cal_list', from: 'a', to: 'b' }, fetchImpl });
  assert.deepEqual(r, { events: [] });
  assert.deepEqual(sent, { key: 'k', action: 'cal_list', params: { from: 'a', to: 'b' } });
});

test('actionsPrompt hides google actions until connected', () => {
  assert.doesNotMatch(actionsPrompt({ hasGoogle: false }), /mail_send/);
  assert.match(actionsPrompt({ hasGoogle: true, hasMail: true }), /mail_send/);
  assert.doesNotMatch(actionsPrompt({ hasGoogle: true }), /mail_send/);
});
