import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true });
await ctx.route('**://fonts.*/**', r => r.abort());
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body: __cfg }));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const U = 'http://localhost:8099/';
const SHOTS = '/tmp/claude-0/-home-user-law/5b8e9e87-d166-5de3-b308-1b164061aad2/scratchpad/shots/';

const pages = [['index','u-fahad'],['requests','u-fahad'],['lawyers',null],
               ['services','u-ahmed'],['requests','u-ahmed'],['admin','u-staff'],
               ['blog',null],['account','u-ahmed'],
               ['intern','u-jaid'],['firm','u-ahmed']];
const report = [];
for (const [page, who] of pages) {
  await p.goto(U + 'index.html');
  await p.evaluate(u => { if (u) localStorage.setItem('sanad.session.user', u);
    else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U + page + '.html');
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const de = document.documentElement;
    const bar = document.querySelector('.tabbar');
    // Content that sits outside its own scrolling container is a bug; content
    // that scrolls inside one is the convention — a tab strip or a wide table
    // is supposed to run past the edge and be swiped. Only the first kind
    // makes the page itself scroll sideways, which is what actually hurts.
    const scrolls = (e) => {
      for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
        const ov = getComputedStyle(n).overflowX;
        if ((ov === 'auto' || ov === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    const over = [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1))) return false;
      return !scrolls(e);
    }).slice(0, 6).map(e => (e.tagName + '.' + (e.className||'').toString().split(' ')[0] +
        ' w=' + Math.round(e.getBoundingClientRect().width)));
    const small = [...document.querySelectorAll('a,button')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40);
    }).length;
    return {
      hscroll: de.scrollWidth > window.innerWidth + 1,
      scrollW: de.scrollWidth,
      tabbar: bar ? getComputedStyle(bar).display : 'missing',
      tabs: bar ? bar.children.length : 0,
      bodyPadBottom: getComputedStyle(document.body).paddingBottom,
      over, small
    };
  });
  report.push([page, who, m]);
  await p.screenshot({ path: SHOTS + page + '-' + (who||'guest') + '.png', fullPage: false });
}
for (const [pg, who, m] of report) {
  console.log(`${pg.padEnd(10)} ${(who||'guest').padEnd(9)} tabbar=${m.tabbar} tabs=${m.tabs} ` +
    `hscroll=${m.hscroll ? 'YES ' + m.scrollW : 'no'} padB=${m.bodyPadBottom} small=${m.small}`);
  if (m.over.length) console.log('           overflowing: ' + m.over.join(' | '));
}
if (errs.length) console.log('JS ERRORS: ' + errs.join(' ; '));
await b.close();
