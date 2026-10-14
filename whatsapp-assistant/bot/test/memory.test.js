import test from 'node:test';
import assert from 'node:assert/strict';
import { remember, forget, addBirthday, birthdaysOn, memoryPrompt, parseMonthDay } from '../lib/memory.js';

const empty = { owner: [], groups: {}, birthdays: [] };

test('owner facts stay private, group facts stay in their group', () => {
  let { mem } = remember(empty, { fact: 'רון עובד בביטוח', scope: 'me', chatJid: 'x' });
  ({ mem } = remember(mem, { fact: 'אמא אוהבת פרחים לבנים', scope: 'group', chatJid: 'g@g.us' }));
  assert.match(memoryPrompt(mem, { owner: true, chatJid: 'g@g.us' }), /רון עובד בביטוח/);
  assert.doesNotMatch(memoryPrompt(mem, { owner: false, chatJid: 'g@g.us' }), /רון עובד בביטוח/);
  assert.match(memoryPrompt(mem, { owner: false, chatJid: 'g@g.us' }), /פרחים לבנים/);
  assert.doesNotMatch(memoryPrompt(mem, { owner: false, chatJid: 'other@g.us' }), /פרחים לבנים/);
  assert.equal(forget(mem, { match: 'ביטוח', chatJid: 'g@g.us' }).removed, 1);
});

test('birthdays parse day.month and match by date', () => {
  assert.equal(parseMonthDay('12.3'), '03-12');
  assert.equal(parseMonthDay('05/10'), '10-05');
  const { mem } = addBirthday(empty, { name: 'נועה', date: '12.3', chatJid: 'g@g.us', tagId: '@1002' });
  assert.deepEqual(birthdaysOn(mem, '03-12').map(b => [b.name, b.tagId]), [['נועה', '1002']]);
  assert.ok(addBirthday(empty, { name: 'x', date: 'מחר', chatJid: 'g' }).error);
});
