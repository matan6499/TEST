// Hebrew calendar facts from Hebcal (free, no key): Hebrew date, holidays, fasts,
// the weekly parasha and Shabbat times. Facts come from here, never from the model.
const BASE = 'https://www.hebcal.com';
const strip = (s = '') => String(s).replace(/[֑-ׇ]/g, ''); // drop niqqud for WhatsApp

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`hebcal ${res.status}`);
  return res.json();
}

// ymd: "2026-10-04" (Israel date)
export async function dayInfo(ymd, { fetchImpl = fetch } = {}) {
  const conv = await getJson(`${BASE}/converter?cfg=json&date=${ymd}&g2h=1&strict=1&lg=he`, fetchImpl);
  const end = new Date(Date.parse(`${ymd}T12:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
  const cal = await getJson(`${BASE}/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&ss=on&mf=on&s=on&i=on&lg=he&start=${ymd}&end=${end}`, fetchImpl);
  const items = cal.items || [];
  const today = items.filter(i => i.date.slice(0, 10) === ymd && i.category !== 'parashat').map(i => strip(i.title));
  const parasha = items.find(i => i.category === 'parashat');
  const upcoming = items.filter(i => i.date.slice(0, 10) > ymd && ['holiday', 'roshchodesh', 'fast'].includes(i.category) || (i.subcat === 'fast' && i.date.slice(0, 10) > ymd))
    .map(i => `${i.date.slice(8, 10)}.${i.date.slice(5, 7)} ${strip(i.title)}`);
  const weekday = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  const isYomTov = items.some(i => i.date.slice(0, 10) === ymd && i.yomtov === true);
  return {
    restDay: weekday === 6 || isYomTov,
    hebrewDate: strip(conv.hebrew || ''),
    today,
    parasha: parasha ? strip(parasha.title) : '',
    upcoming: [...new Set(upcoming)].slice(0, 4),
  };
}

// Shabbat (or holiday eve) times for the week containing ymd. geonameid: Tel Aviv 293397, Jerusalem 281184.
export async function shabbatTimes(ymd, { geonameid = 293397, fetchImpl = fetch } = {}) {
  const [y, m, d] = ymd.split('-');
  const data = await getJson(`${BASE}/shabbat?cfg=json&geonameid=${geonameid}&M=on&lg=he&gy=${y}&gm=${Number(m)}&gd=${Number(d)}`, fetchImpl);
  const items = data.items || [];
  const hhmm = (i) => (i?.date || '').slice(11, 16);
  const candles = items.filter(i => i.category === 'candles');
  const havdalah = items.filter(i => i.category === 'havdalah');
  const parasha = items.find(i => i.category === 'parashat');
  return {
    city: data.location?.title || '',
    candles: candles.map(i => ({ date: i.date.slice(0, 10), time: hhmm(i) })),
    havdalah: havdalah.map(i => ({ date: i.date.slice(0, 10), time: hhmm(i) })),
    parasha: parasha ? strip(parasha.title) : '',
    holidays: items.filter(i => i.category === 'holiday').map(i => strip(i.title)),
  };
}

export function calendarLine(info) {
  if (!info) return '';
  return [info.hebrewDate, info.today.join(', '), info.parasha && `השבת: ${info.parasha}`]
    .filter(Boolean).join(' · ');
}
