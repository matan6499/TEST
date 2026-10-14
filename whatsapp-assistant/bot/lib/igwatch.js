// Tells the owner when a scheduled Instagram post actually went live.
// Polls Zernio for the account's published posts and reports each new one once.
// The first run only records what is already published, so nothing old is announced.
import fs from 'fs';

const API = 'https://zernio.com/api/v1';

export function loadSeen(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return { seeded: !!v.seeded, ids: v.ids || [] }; }
  catch { return { seeded: false, ids: [] }; }
}

async function zernio(path, key, fetchImpl) {
  const r = await fetchImpl(API + path, { headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`zernio ${r.status}`);
  return r.json();
}

function igPlatform(post) {
  return (post.platforms || []).find(p => p.platform === 'instagram') || {};
}

// Returns { messages: [text], seen } and never throws for an empty or odd response.
export async function checkPublished({ key, accountId, handle = '', seen, fetchImpl = fetch }) {
  const d = await zernio(`/posts?accountId=${encodeURIComponent(accountId)}&status=published&limit=30`, key, fetchImpl);
  const posts = (d.posts || []).filter(p => igPlatform(p).status === 'published' || p.status === 'published');
  const known = new Set(seen.ids);
  const fresh = posts.filter(p => !known.has(p._id));
  const next = { seeded: true, ids: [...known, ...fresh.map(p => p._id)].slice(-300) };
  if (!seen.seeded) return { messages: [], seen: next };
  const messages = fresh
    .sort((a, b) => String(a.publishedAt || a.scheduledFor).localeCompare(String(b.publishedAt || b.scheduledFor)))
    .map(p => {
      const ig = igPlatform(p);
      const first = String(p.content || '').split('\n').find(l => l.trim()) || '';
      const kind = (p.mediaItems || []).length > 1 ? `קרוסלה של ${(p.mediaItems || []).length} שקפים` : 'פוסט';
      const url = ig.platformPostUrl || '';
      return `📸 עלה ${kind} ב-@${handle || 'instagram'}\n${first.slice(0, 140)}${url ? `\n${url}` : ''}`;
    });
  return { messages, seen: next };
}

// Scheduled publish times (ms) for the account, so checks run only around them.
export async function scheduledTimes({ key, accountId, fetchImpl = fetch }) {
  const d = await zernio(`/posts?accountId=${encodeURIComponent(accountId)}&status=scheduled&limit=100`, key, fetchImpl);
  return (d.posts || []).map(p => Date.parse(p.scheduledFor)).filter(Number.isFinite).sort((a, b) => a - b);
}

// Minutes after a scheduled time at which to look for the published post.
export const CHECK_OFFSETS = [2, 5, 10, 20, 40];
export function isCheckMinute(now, times) {
  return times.some(t => CHECK_OFFSETS.some(m => Math.abs(now - (t + m * 60_000)) <= 30_000));
}
