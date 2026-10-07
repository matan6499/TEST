const { chromium } = require('playwright');
const fs = require('fs');
const F1 = fs.readFileSync(__dirname+'/fonts/frank800.ttf').toString('base64');
const F2 = fs.readFileSync(__dirname+'/fonts/heebo300.ttf').toString('base64');
const slides = JSON.parse(fs.readFileSync(__dirname + '/slides.json', 'utf8'));
const html = (s, i, n) => `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<style>@font-face{font-family:'Frank Ruhl Libre';font-weight:800;src:url(data:font/ttf;base64,${F1})}@font-face{font-family:'Heebo';font-weight:300;src:url(data:font/ttf;base64,${F2})}</style>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:radial-gradient(ellipse at 50% 38%,#1f1c18 0%,#0b0a09 70%);color:#f3eee6;
display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 110px;position:relative;font-family:'Heebo',sans-serif}
.flame{width:14px;height:34px;border-radius:50% 50% 45% 45%/60% 60% 40% 40%;background:radial-gradient(ellipse at 50% 70%,#fff3c4 0%,#f2b544 45%,rgba(242,120,40,0) 75%);
box-shadow:0 0 50px 18px rgba(242,170,60,.22);margin-bottom:70px}
.big{font-family:'Frank Ruhl Libre',serif;font-weight:800;font-size:${s.big.length>40?84:96}px;line-height:1.22}
.line{width:70px;height:2px;background:#b8925a;margin:56px auto}
.small{font-weight:300;font-size:42px;line-height:1.6;color:#d6cfc4}
.last .big{color:#e8c98f}
.foot{position:absolute;bottom:64px;left:0;right:0;display:flex;justify-content:space-between;padding:0 80px;font-size:26px;color:#8a8278;letter-spacing:1px}
</style></head><body class="${s.last?'last':''}">
<div class="flame"></div><div class="big">${s.big}</div><div class="line"></div><div class="small">${s.small}</div>
<div class="foot"><span dir="ltr">@matanthejew</span><span>7.10 · ${i+1}/${n}</span></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(html(slides[i], i, slides.length), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${__dirname}/slide-${i+1}.png` });
  }
  await b.close();
})();
