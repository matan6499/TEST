// Self edit: the owner asks the bot, in WhatsApp, to change its own code. A coding agent
// (Claude Code with edit tools) works on a separate git worktree, the tests run there, and
// the live code changes only after the owner approves. A guard rolls back a change that
// keeps the bot from coming back up.
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';

const run = (cmd, args, opts = {}) => new Promise(resolve => {
  execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024, timeout: opts.timeout || 120_000, ...opts }, (err, stdout, stderr) => {
    resolve({ ok: !err, code: err ? (err.code ?? 1) : 0, out: String(stdout || ''), err: String(stderr || '') });
  });
});
const git = (dir, ...args) => run('git', ['-C', dir, ...args]);

export function loadSelfEdit(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { status: 'idle' }; }
}
export function saveSelfEdit(file, st) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(st, null, 2));
  fs.renameSync(tmp, file);
}

// The live folder becomes a git repo the first time; anything changed outside git since
// (a manual deploy) is committed so the agent always starts from what is actually running.
export async function ensureRepo(dir) {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    await git(dir, 'init', '-q', '-b', 'main');
    await git(dir, 'config', 'user.name', 'Assistant');
    await git(dir, 'config', 'user.email', 'assistant@bot.local');
    await git(dir, 'config', 'receive.denyCurrentBranch', 'updateInstead');
  }
  const st = await git(dir, 'status', '--porcelain');
  if (st.out.trim()) {
    await git(dir, 'add', '-A');
    await git(dir, 'commit', '-q', '-m', 'שינויים ידניים');
  }
}

export function agentPrompt(request) {
  return `You are changing the source code of the owner's personal WhatsApp assistant (Node ESM, Baileys + the Claude CLI). The working directory is a staging copy of the code; nothing you do here is live until the owner approves.

The owner's request, in Hebrew:
"""
${request}
"""

How to work:
- Read the relevant code first. bot.js is the main file, lib/*.js are the modules, test/*.test.js are the tests (node --test). Each lib module usually exports a xxxPrompt() that teaches the chat model its [[ACT {...}]] actions, and bot.js runAction() executes them.
- Make the smallest change that does what he asked, in the style of the code around it.
- Per-account data and secrets are not here (accounts/, config.json). Never try to read or write them. If the change needs a setting, give it a sensible default in code, read through config.<name>.
- Add or update a test when the logic can be tested. Run \`npm test\` and leave every test passing.
- Any Hebrew text the bot will send: natural spoken Hebrew, never an em dash or en dash, never the word "מקסים".
- Do not commit, push, restart services, install packages or reach the network.
- If the request is unclear, risky (deleting data, sending to people without approval) or impossible, change nothing and explain why.

When you finish, reply in Hebrew only, 2 to 5 short lines, written to the owner: what changed and how he uses it. No code, no file paths.`;
}

export async function prepareEdit({ dir, stagingDir, request, claudeBin, prefixArgs = [], model = 'opus', timeoutMs = 20 * 60_000, onProgress = () => {} }) {
  await ensureRepo(dir);
  await git(dir, 'worktree', 'remove', '--force', stagingDir);
  fs.rmSync(stagingDir, { recursive: true, force: true });
  await git(dir, 'worktree', 'prune');
  await git(dir, 'branch', '-D', 'self-edit');
  const wt = await git(dir, 'worktree', 'add', '-q', '-b', 'self-edit', stagingDir, 'HEAD');
  if (!wt.ok) return { error: `worktree: ${wt.err.slice(0, 200)}` };
  try { fs.symlinkSync(path.join(dir, 'node_modules'), path.join(stagingDir, 'node_modules')); } catch (_) {}
  const base = (await git(dir, 'rev-parse', 'HEAD')).out.trim();

  const args = [...prefixArgs, '-p', agentPrompt(request), '--output-format', 'json', '--model', model,
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash(npm test),Bash(npm test:*),Bash(node --check:*),Bash(node --test:*),Bash(git diff:*),Bash(git status:*),Bash(ls:*)'];
  const res = await new Promise(resolve => {
    const cp = spawn(claudeBin, args, { cwd: stagingDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => cp.kill('SIGTERM'), timeoutMs);
    cp.stdout.on('data', d => out += d);
    cp.stderr.on('data', d => err += d);
    cp.on('exit', code => { clearTimeout(timer); resolve({ code, out, err }); });
    cp.on('error', e => { clearTimeout(timer); resolve({ code: 1, out: '', err: e.message }); });
  });
  let summary = '', cost = 0;
  try { const j = JSON.parse(res.out); summary = String(j.result || '').trim(); cost = j.total_cost_usd || 0; } catch (_) {}
  if (res.code !== 0 && !summary) return { error: `סוכן הקוד נכשל: ${(res.err || res.out).slice(-300)}` };
  onProgress('tests');

  await git(stagingDir, 'add', '-A', '--', '.', ':!node_modules');
  const stat = (await git(stagingDir, 'diff', '--cached', '--stat')).out.trim();
  if (!stat) return { noChange: true, summary, cost };

  const check = await run('bash', ['-c', 'for f in bot.js hub.js lib/*.js; do node --check "$f" || exit 1; done'], { cwd: stagingDir });
  const tests = await run('npm', ['test', '--silent'], { cwd: stagingDir, timeout: 5 * 60_000 });
  const tail = (tests.out + tests.err).split('\n').filter(l => /^# (pass|fail|tests)/.test(l)).join(', ');
  await git(stagingDir, 'commit', '-q', '-m', `העוזר: ${request.slice(0, 120)}`);
  return { ready: check.ok && tests.ok, summary, stat, tests: tail || (tests.ok ? 'pass' : (tests.out + tests.err).slice(-400)), syntaxOk: check.ok, base, cost };
}

export async function applyEdit(dir) {
  await ensureRepo(dir);
  const prev = (await git(dir, 'rev-parse', 'HEAD')).out.trim();
  let m = await git(dir, 'merge', '--ff-only', '-q', 'self-edit');
  if (!m.ok) {
    m = await git(dir, 'merge', '--no-edit', '-q', 'self-edit');
    if (!m.ok) { await git(dir, 'merge', '--abort'); return { error: 'השינוי מתנגש בשינויים שנעשו בינתיים. צריך להריץ אותו מחדש.' }; }
  }
  const check = await run('bash', ['-c', 'for f in bot.js hub.js lib/*.js; do node --check "$f" || exit 1; done'], { cwd: dir });
  if (!check.ok) { await git(dir, 'reset', '-q', '--hard', prev); return { error: 'שגיאת תחביר אחרי המיזוג, לא עדכנתי.' }; }
  return { applied: true, prev, head: (await git(dir, 'rev-parse', 'HEAD')).out.trim() };
}

// Undo by adding a commit that reverses everything since `prev`, so history stays intact.
export async function revertTo(dir, prev) {
  const r = await git(dir, 'revert', '--no-edit', '--no-commit', `${prev}..HEAD`);
  if (!r.ok) { await git(dir, 'revert', '--abort'); return { error: r.err.slice(0, 200) }; }
  await git(dir, 'commit', '-q', '-m', 'העוזר: חזרה לגרסה הקודמת');
  return { reverted: true };
}

export async function discardEdit(dir, stagingDir) {
  await git(dir, 'worktree', 'remove', '--force', stagingDir);
  await git(dir, 'branch', '-D', 'self-edit');
}

export function selfEditPrompt(st) {
  return `שינוי בקוד של עצמך (רק בפרטי עם הבעלים):
- כשהבעלים מבקש להוסיף לך יכולת, לשנות איך אתה מתנהג או לתקן באג: {"a":"self_edit","request":"<הבקשה המלאה ומפורטת: מה צריך לקרות, מתי, איך הוא ישתמש בזה>"}. זה לוקח כמה דקות ברקע. תגיד לו בקצרה שהתחלת ושתעדכן כשמוכן.
- העדפות כתיבה, זיכרון ותזכורות לא צריכות שינוי קוד, יש להן פעולות משלהן.
- אם לא ברור מה הוא רוצה, שאל שאלה אחת לפני שמתחילים.
${st.status === 'running' ? `- עכשיו כבר רץ שינוי: "${st.request}". אי אפשר להתחיל עוד אחד עד שיסתיים.\n` : ''}${st.status === 'ready' ? `- יש שינוי מוכן שמחכה לאישור שלו: "${st.request}".\n  מה השתנה: ${st.summary}\n  כשהוא מאשר ("כן", "תעדכן", "יאללה"): {"a":"self_edit_apply"}. אם לא רוצה: {"a":"self_edit_discard"}.\n` : ''}${st.prev && st.status !== 'ready' ? '- אם הוא אומר "תחזיר אחורה" או שהשינוי האחרון לא טוב: {"a":"self_edit_revert"}.\n' : ''}`;
}
