import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberMember, membersPrompt, mentionsFor } from '../lib/mentions.js';

test('names map to real mention jids', () => {
  let m = rememberMember({}, 'g@g.us', '111222333444555@lid', 'יוסי');
  m = rememberMember(m, 'g@g.us', '972500001111@s.whatsapp.net', 'רון');
  assert.match(membersPrompt(m['g@g.us']), /יוסי: @111222333444555/);
  const jids = mentionsFor('@111222333444555 בוא לכאן, וגם @972500001111 ו-@111111111', m['g@g.us']);
  assert.deepEqual(jids.sort(), ['111222333444555@lid', '972500001111@s.whatsapp.net']);
  assert.deepEqual(mentionsFor('@999888777666', {}, ['999888777666@lid']), ['999888777666@lid']);
});

test('roster lets the bot tag people who never wrote, by the id the group uses', async () => {
  const { membersPrompt, mentionsFor, rememberAlias } = await import('../lib/mentions.js');
  const members = { '972500001111@s.whatsapp.net': 'רון' };
  const roster = [
    { id: '111222333444555@lid', alt: '972500001111@s.whatsapp.net' },
    { id: '999888777666555@lid', alt: '' },
    { id: '123123123123123@lid', alt: '972500000000@s.whatsapp.net' },
  ];
  const p = membersPrompt(members, roster, ['972500000000@s.whatsapp.net']);
  assert.match(p, /רון: @111222333444555/);
  assert.match(p, /שם לא ידוע עדיין\): @999888777666555/);
  assert.doesNotMatch(p, /123123123123123/); // the bot itself is left out
  assert.deepEqual(mentionsFor('@111222333444555 קום', members, roster), ['111222333444555@lid']);
  const withAlias = rememberAlias({}, 'g', '999888777666555', 'אמא');
  assert.match(membersPrompt(withAlias.g, roster), /אמא: @999888777666555/);
});
