// Hakafot carousel: dark grain background (photos/N.jpg used if present), clean centered text
const { chromium } = require('playwright');
const fs = require('fs');
const D = __dirname;
const b64 = f => fs.readFileSync(`${D}/${f}`).toString('base64');
const F8 = b64('fonts/frank800.ttf'), H4 = b64('fonts/heebo400.ttf'), H7 = b64('fonts/heebo700.ttf');
const slides = JSON.parse(fs.readFileSync(`${D}/slides3.json`, 'utf8'));
fs.mkdirSync(`${D}/hakafot`, { recursive: true });
const html = (s, img) => `<!doctype html><html lang="he"><head><meta charset="utf-8"><style>
@font-face{font-family:H;font-weight:400;src:url(data:font/ttf;base64,${H4})}
@font-face{font-family:F;src:url(data:font/ttf;base64,${F8})}
@font-face{font-family:H;font-weight:700;src:url(data:font/ttf;base64,${H7})}
*{margin:0;padding:0}body{width:1080px;height:1350px;background:#070707;overflow:hidden;position:relative;font-family:H}
.bg{position:absolute;inset:0;transform:scale(1.04);${img ? `background:url(data:image/jpeg;base64,${img}) ${s.bg || 'center/cover'};filter:grayscale(1) contrast(1.25) brightness(.55) blur(.6px)` : 'background:radial-gradient(ellipse at 50% 45%,#1c1c1c 0%,#050505 75%)'}}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 35%,rgba(0,0,0,.8) 100%)}
.grain{position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay}
.c{direction:rtl;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 100px}
.k{font-weight:400;font-size:44px;letter-spacing:2px;color:#d6d6d6;margin-bottom:36px}
.d{font-family:F;font-size:280px;line-height:1;direction:ltr;color:#f5f5f5;margin-bottom:56px;text-shadow:0 4px 40px rgba(0,0,0,.6)}
.s{color:#bdbdbd;font-weight:400;font-size:44px;line-height:1.4;margin-top:56px;text-shadow:0 2px 24px rgba(0,0,0,.6)}
.t{color:#efefef;font-weight:700;font-size:62px;line-height:1.38;text-shadow:0 2px 24px rgba(0,0,0,.6)}
</style></head><body><div class="bg"></div><div class="vig"></div>
<svg class="grain" width="1080" height="1350"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="c">${s.d ? `<div class="d">${s.d}</div>` : ''}${s.k ? `<div class="k">${s.k}</div>` : ''}<div class="t">${s.t}</div>${s.s ? `<div class="s">${s.s}</div>` : ''}</div></body></html>`;
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
  for (let i = 0; i < slides.length; i++) {
    const f = `photos/${i + 1}.jpg`;
    await p.setContent(html(slides[i], fs.existsSync(`${D}/${f}`) ? b64(f) : null));
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${D}/hakafot/slide-${i + 1}.png` });
  }
  await br.close();
})();
