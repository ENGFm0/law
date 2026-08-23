import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
// These exercise the seeded demo people, so they pin the demo backend: the
// published site runs on the real one, where there are no seeded people at all.
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body:__cfg }));

await ctx.route('**://fonts.*/**', r => r.abort());
const p = await ctx.newPage();
const U = 'http://localhost:8099/';
for (const [page, who] of [['index','u-fahad'],['requests','u-fahad'],['requests','u-ahmed'],
                            ['admin','u-staff'],['account','u-ahmed'],['blog',null],
                            ['intern','u-jaid'],['firm','u-ahmed']]) {
  await p.goto(U + 'index.html');
  await p.evaluate(u => { if (u) localStorage.setItem('sanad.session.user', u);
    else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U + page + '.html'); await p.waitForTimeout(450);
  const m = await p.evaluate(() => {
    const W = 390;
    const wide = [...document.querySelectorAll('body *')].map(e => {
      const r = e.getBoundingClientRect();
      return { t: e.tagName + '.' + (e.className||'').toString().split(' ').slice(0,2).join('.'),
               w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right) };
    }).filter(x => x.w > W || x.r > W + 1 || x.l < -1)
      .sort((a,b) => b.w - a.w).slice(0, 5);
    return { innerW: window.innerWidth, docW: document.documentElement.scrollWidth,
             visual: Math.round(window.visualViewport ? window.visualViewport.width : 0), wide };
  });
  console.log(`${page.padEnd(9)} ${(who||'guest').padEnd(9)} innerW=${m.innerW} docW=${m.docW} visual=${m.visual}`);
  m.wide.forEach(x => console.log(`    ${x.t}  w=${x.w} left=${x.l} right=${x.r}`));
}
await b.close();
