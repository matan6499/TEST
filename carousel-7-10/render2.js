// Dark photo carousel: photos/N.jpg -> dark/slide-N.png (grayscale, crushed blacks, grain, clean text)
const { chromium } = require('playwright');
const fs = require('fs');
const D = __dirname;
const b64 = f => fs.readFileSync(`${D}/${f}`).toString('base64');
const H4 = b64('fonts/heebo400.ttf'), H7 = b64('fonts/heebo700.ttf');
const slides = JSON.parse(fs.readFileSync(`${D}/slides2.json`, 'utf8'));
fs.mkdirSync(`${D}/dark`, { recursive: true });
const html = (s, img) => `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
@font-face{font-family:H;font-weight:400;src:url(data:font/ttf;base64,${H4})}
@font-face{font-family:H;font-weight:700;src:url(data:font/ttf;base64,${H7})}
*{margin:0;padding:0}body{width:1080px;height:1350px;background:#000;overflow:hidden;position:relative;font-family:H}
.bg{position:absolute;inset:-20px;background:url(data:image/jpeg;base64,${img}) center/cover;filter:grayscale(1) contrast(1.25) brightness(.42) blur(1.2px)}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 30%,rgba(0,0,0,.75) 100%)}
.grain{position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay}
.t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 100px;
color:#f2f2f2;font-weight:700;font-size:64px;line-height:1.35;text-shadow:0 2px 24px rgba(0,0,0,.6)}
</style></head><body><div class="bg"></div><div class="vig"></div>
<svg class="grain" width="1080" height="1350"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="t">${s.t}</div></body></html>`;
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(html(slides[i], b64(`photos/${i + 1}.jpg`)));
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${D}/dark/slide-${i + 1}.png` });
  }
  await br.close();
})();
