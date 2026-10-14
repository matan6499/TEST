import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { ensureRepo, applyEdit, revertTo, selfEditPrompt, agentPrompt } from '../lib/selfedit.js';

const sh = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfedit-'));
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(dir, 'bot.js'), 'export const v = 1;\n');
  fs.writeFileSync(path.join(dir, 'hub.js'), 'export const h = 1;\n');
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'export const a = 1;\n');
  return dir;
}

test('apply fast-forwards the approved branch and revert restores the old code', async () => {
  const dir = fixture();
  await ensureRepo(dir);
  const base = sh(dir, 'rev-parse', 'HEAD');
  sh(dir, 'checkout', '-q', '-b', 'self-edit');
  fs.writeFileSync(path.join(dir, 'bot.js'), 'export const v = 2;\n');
  sh(dir, 'commit', '-qam', 'change');
  sh(dir, 'checkout', '-q', 'main');

  const r = await applyEdit(dir);
  assert.equal(r.applied, true);
  assert.equal(r.prev, base);
  assert.match(fs.readFileSync(path.join(dir, 'bot.js'), 'utf8'), /v = 2/);

  const back = await revertTo(dir, r.prev);
  assert.equal(back.reverted, true);
  assert.match(fs.readFileSync(path.join(dir, 'bot.js'), 'utf8'), /v = 1/);
});

test('apply refuses code with a syntax error', async () => {
  const dir = fixture();
  await ensureRepo(dir);
  sh(dir, 'checkout', '-q', '-b', 'self-edit');
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'export const a = ;\n');
  sh(dir, 'commit', '-qam', 'broken');
  sh(dir, 'checkout', '-q', 'main');
  const r = await applyEdit(dir);
  assert.ok(r.error);
  assert.match(fs.readFileSync(path.join(dir, 'lib', 'a.js'), 'utf8'), /a = 1/);
});

test('manual changes are committed before an edit starts', async () => {
  const dir = fixture();
  await ensureRepo(dir);
  fs.writeFileSync(path.join(dir, 'hub.js'), 'export const h = 2;\n');
  await ensureRepo(dir);
  assert.equal(sh(dir, 'status', '--porcelain'), '');
});

test('prompt shows the pending change and only offers revert after an update', () => {
  const ready = selfEditPrompt({ status: 'ready', request: 'שעה אחרת לרעיונות', summary: 'הזזתי ל-07:30' });
  assert.match(ready, /self_edit_apply/);
  assert.doesNotMatch(ready, /self_edit_revert/);
  assert.match(selfEditPrompt({ status: 'idle', prev: 'abc' }), /self_edit_revert/);
  assert.doesNotMatch(agentPrompt('x'), /—/);
});
