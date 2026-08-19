import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,80)+'>':''));} };
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
async function at(w, h, mobile) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:mobile });
  await ctx.route('**://fonts.*/**', r=>r.abort());
  await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8099/index.html');
  await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-fahad'));
  await p.goto('http://localhost:8099/index.html'); await p.waitForTimeout(500);
  return p;
}
const shown = (p, s) => p.$eval(s, e => e.offsetParent !== null).catch(()=>false);

console.log('— ON A PHONE THE HEADER CARRIES FOUR THINGS —');
let p = await at(390, 844, true);
ok('the mark', await shown(p,'.brand'));
ok('theme, language, notices', (await p.$$('.header-actions .icon-btn')).length === 3);
ok('and not who you are — that is the last tab', !(await shown(p,'.role-badge')));
ok('the tab bar has it instead',
   (await p.$$eval('.tabbar__link', ns=>ns.map(n=>n.getAttribute('href')))).includes('account.html'));
let box = await p.$$eval('.site-header__inner > *', es => es.map(e => {
  const r = e.getBoundingClientRect(); return { c: e.className.split(' ')[0], l: Math.round(r.left), r: Math.round(r.right) }; }));
const brand = box.find(x=>x.c==='brand'), acts = box.find(x=>x.c==='header-actions');
ok('and they sit at opposite ends rather than bunched', brand && acts && (brand.l - acts.r) > 100,
   JSON.stringify(box));

console.log('— ON A DESKTOP IT KEEPS THE ACCOUNT LINK —');
p = await at(1280, 900, false);
ok('there is no tab bar there', !(await shown(p,'.tabbar')));
ok('so the account badge stays', await shown(p,'.role-badge'));
ok('and it goes to the account page',
   await p.$eval('.role-badge', e=>e.getAttribute('href')) === 'account.html');

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
