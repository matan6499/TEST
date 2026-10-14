// Google Calendar through the official API with the owner's OAuth refresh token
// (calendar scope only). Times in and out are Israel local "YYYY-MM-DDTHH:MM".
import { localToEpoch, formatLocal } from './reminders.js';

const TZ = 'Asia/Jerusalem';
let cached = { token: '', exp: 0 };

export function hasCalendar(cfg = {}) {
  const g = cfg.googleCalendar || {};
  return !!(g.clientId && g.clientSecret && g.refreshToken);
}

async function accessToken(cfg, fetchImpl) {
  if (cached.token && cached.exp > Date.now() + 60_000) return cached.token;
  const g = cfg.googleCalendar;
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`התחברות ליומן נכשלה: ${body.error_description || body.error || res.status}`);
  cached = { token: body.access_token, exp: Date.now() + (body.expires_in || 3000) * 1000 };
  return cached.token;
}

async function api(cfg, path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  const token = await accessToken(cfg, fetchImpl);
  const res = await fetchImpl(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`יומן: ${json.error?.message || res.status}`);
  return json;
}

const iso = (local) => new Date(localToEpoch(local)).toISOString();
const calId = (cfg) => encodeURIComponent(cfg.googleCalendar?.calendarId || 'primary');
const show = (t) => (t?.dateTime ? formatLocal(Date.parse(t.dateTime)) : t?.date ? `${t.date} (כל היום)` : '');

export async function listEvents(cfg, { from, to }, fetchImpl) {
  const q = new URLSearchParams({ timeMin: iso(from), timeMax: iso(to), singleEvents: 'true', orderBy: 'startTime', maxResults: '50', timeZone: TZ });
  const r = await api(cfg, `/calendars/${calId(cfg)}/events?${q}`, { fetchImpl });
  return { events: (r.items || []).map(e => ({ id: e.id, title: e.summary || '(בלי כותרת)', start: show(e.start), end: show(e.end), location: e.location || '' })) };
}

export async function isFree(cfg, { start, end }, fetchImpl) {
  const r = await api(cfg, '/freeBusy', { method: 'POST', fetchImpl, body: { timeMin: iso(start), timeMax: iso(end), timeZone: TZ, items: [{ id: cfg.googleCalendar?.calendarId || 'primary' }] } });
  const busy = Object.values(r.calendars || {})[0]?.busy || [];
  return { free: busy.length === 0, busy: busy.map(b => `${formatLocal(Date.parse(b.start))} עד ${formatLocal(Date.parse(b.end)).slice(11, 16)}`) };
}

export async function createEvent(cfg, { title, start, end, location = '', description = '' }, fetchImpl) {
  const toLocal = (s) => ({ dateTime: `${s}:00`, timeZone: TZ });
  const e = await api(cfg, `/calendars/${calId(cfg)}/events`, { method: 'POST', fetchImpl, body: { summary: title, location, description, start: toLocal(start), end: toLocal(end || start) } });
  return { created: { id: e.id, title: e.summary, start: show(e.start), end: show(e.end), link: e.htmlLink } };
}

export async function deleteEvent(cfg, { id }, fetchImpl) {
  await api(cfg, `/calendars/${calId(cfg)}/events/${encodeURIComponent(id)}`, { method: 'DELETE', fetchImpl });
  return { deleted: id };
}
