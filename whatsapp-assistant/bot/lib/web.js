// Fetch a public web page as plain text for link summaries. Refuses anything that
// resolves to a private or local address, so a link can never reach the bot's own
// dashboards or the cloud metadata service.
import dns from 'dns/promises';
import net from 'net';

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('קישור לא תקין'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('רק קישורי http/https');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(a => a.address);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error('כתובת פנימית, לא נגיש');
  return url;
}

export function htmlToText(html = '') {
  const meta = (name) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)`, 'i')) || [])[1] || '';
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || meta('og:title');
  const description = meta('og:description') || meta('description');
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  return { title: clean(title), description: clean(description), text: body.slice(0, 9000) };
}

export async function fetchPage(raw, { fetchImpl = fetch, maxRedirects = 4 } = {}) {
  let url = await assertPublicUrl(raw);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetchImpl(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept-Language': 'he,en;q=0.8' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url).href);
      continue;
    }
    if (!res.ok) throw new Error(`הדף החזיר ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/text|html|json|xml/.test(type)) throw new Error(`סוג תוכן לא נתמך: ${type || 'לא ידוע'}`);
    return { url: url.href, ...htmlToText((await res.text()).slice(0, 2_000_000)) };
  }
  throw new Error('יותר מדי הפניות');
}
