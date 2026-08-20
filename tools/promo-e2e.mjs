import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,100)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:950} });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';

await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-staff'));

console.log('— A BAR AT THE TOP —');
await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
await p.fill('[data-ad-title]','صيانة الليلة');
await p.selectOption('[data-ad-placement]','bar');
await p.click('[data-add-ad]'); await p.waitForTimeout(400);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('appears as a bar', await p.$('[data-announce]') !== null);
ok('and not as a home card', await p.$('.promo') === null);

console.log('— OR A CARD ON THE HOME PAGE —');
await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
await p.fill('[data-ad-title]','خصم على الاستشارات');
await p.fill('[data-ad-body]','لفترة محدودة');
await p.fill('[data-ad-link]','https://example.com');
await p.selectOption('[data-ad-placement]','home');
await p.click('[data-add-ad]'); await p.waitForTimeout(400);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('the card is on the home page', await p.$('.promo') !== null);
const t = await p.$eval('.promo', e=>e.innerText);
ok('with its title and body', /خصم على الاستشارات/.test(t) && /لفترة محدودة/.test(t));
ok('and its link as a button', await p.$('.promo a.btn') !== null);
const box = await p.$eval('.promo', e=>{ const r=e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) }; });
ok(`it is a real block, not a line of text (${box.w}×${box.h})`, box.h > 120);

console.log('— AN IMAGE BEHIND IT KEEPS THE TEXT READABLE —');
await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
await p.fill('[data-ad-title]','بصورة');
await p.fill('[data-ad-image]','assets/img/cover-contracts.svg');
await p.selectOption('[data-ad-placement]','home');
await p.click('[data-add-ad]'); await p.waitForTimeout(400);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('the image is used as the ground', await p.$('.promo--image') !== null);
ok('with a scrim over it so the words survive',
   await p.evaluate(()=>{ const e=document.querySelector('.promo--image');
     return !!e && getComputedStyle(e,'::before').content !== 'none'; }));

console.log('— AND MARKUP THE PLATFORM WROTE ITSELF —');
await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
await p.fill('[data-ad-title]','مخصص');
await p.fill('[data-ad-html]','<div id="mine">تصميمي</div>');
await p.selectOption('[data-ad-placement]','home');
await p.click('[data-add-ad]'); await p.waitForTimeout(400);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('it is rendered as written', await p.$('#mine') !== null);
ok('and left alone rather than wrapped in a card', await p.$('.promo--raw') !== null);

console.log('— HIDING TAKES IT OFF EVERYWHERE —');
await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
// The list redraws after each toggle, so handles collected up front go stale.
// Always click the first one that is still showing as live.
for (let i = 0; i < 8; i++) {
  const live = await p.$$('[data-toggle-ad]');
  if (!live.length) break;
  const any = await p.evaluate(()=>window.Store.announcements().some(a=>a.active));
  if (!any) break;
  const id = await p.evaluate(()=>(window.Store.announcements().find(a=>a.active)||{}).id);
  await p.click(`[data-toggle-ad="${id}"]`);
  await p.waitForTimeout(300);
}
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('no bar', await p.$('[data-announce]') === null);
ok('no card', await p.$('.promo') === null);

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
