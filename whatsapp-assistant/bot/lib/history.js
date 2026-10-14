// Rolling history of allowed groups, so the owner can ask "what did I miss?".
// Only groups the owner approved are recorded, capped by count and age.
import fs from 'fs';

export const HISTORY_MAX_PER_CHAT = 400;
export const HISTORY_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

export function loadHistory(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return v && typeof v === 'object' ? v : {}; }
  catch { return {}; }
}

export function addEntry(history, chatJid, entry, now = Date.now()) {
  const list = (history[chatJid] || []).filter(e => now - e.t < HISTORY_MAX_AGE_MS);
  list.push({ t: now, ...entry, text: String(entry.text || '').slice(0, 1000) });
  return { ...history, [chatJid]: list.slice(-HISTORY_MAX_PER_CHAT) };
}

export function recentEntries(history, chatJid, hours = 24, now = Date.now()) {
  const since = now - Math.min(Math.max(Number(hours) || 24, 1), 72) * 60 * 60_000;
  return (history[chatJid] || []).filter(e => e.t >= since);
}

export function describeMessage(message = {}) {
  const m = message || {};
  const text = m.conversation || m.extendedTextMessage?.text;
  if (text) return text;
  if (m.imageMessage) return `[תמונה]${m.imageMessage.caption ? ` ${m.imageMessage.caption}` : ''}`;
  if (m.videoMessage) return `[וידאו]${m.videoMessage.caption ? ` ${m.videoMessage.caption}` : ''}`;
  if (m.audioMessage) return '[הודעה קולית]';
  if (m.documentMessage) return `[קובץ] ${m.documentMessage.fileName || ''}`.trim();
  if (m.stickerMessage) return '[סטיקר]';
  return '';
}
