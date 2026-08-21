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
const open = async (page, who) => { await p.evaluate(u=>{ if(u) localStorage.setItem('sanad.session.user',u);
  else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(400); };
await p.goto(U+'index.html');

console.log('— THE CATALOGUE IS LEGAL WORK, NOT A WAY OF TALKING —');
await open('services.html', 'u-fahad');
const t = await p.$eval('#main', e=>e.innerText);
ok('a statement of claim is on it', /صحيفة دعوى/.test(t));
ok('so is representation', /ترافع/.test(t));
ok('and no "phone consultation" as a category', !/استشارة هاتفية/.test(t));

console.log('— THE LAWYER SAYS HOW THEY WILL DELIVER IT —');
await open('services.html', 'u-ahmed');
ok('the channel picker is on the form', (await p.$$('[data-channel]')).length >= 2);
await p.selectOption('[data-new-type]','claim'); await p.waitForTimeout(300);
ok('and it follows the category', (await p.$$('[data-channel]')).length === 3);
// turn them all off
for (const c of ['voice','video','text']) {
  const on = await p.$eval(`[data-channel="${c}"]`, e=>e.classList.contains('is-active'));
  if (on) { await p.click(`[data-channel="${c}"]`); await p.waitForTimeout(200); }
}
await p.fill('[data-new-title]','صحيفة دعوى عمالية');
await p.fill('[data-new-price]','900');
await p.click('[data-add-svc]'); await p.waitForTimeout(300);
ok('a service with no way to reach the lawyer is refused',
   await p.$eval('[data-svc-error]', e=>!e.hidden));
await p.click('[data-channel="text"]'); await p.waitForTimeout(200);
await p.fill('[data-new-title]','صحيفة دعوى عمالية');
await p.fill('[data-new-price]','900');
await p.click('[data-add-svc]'); await p.waitForTimeout(400);
const svc = await p.evaluate(()=>window.Store.services().slice(-1)[0]);
ok('with one it is taken', svc && svc.typeId === 'claim');
ok('and it remembers the channel chosen', svc.channels.join() === 'text');

console.log('— TAKING WORK AUTOMATICALLY IS THE LAWYER’S OWN SWITCH —');
ok('off to begin with', await p.evaluate(()=>!window.Session.user().autoBid));
await p.check('[data-auto-bid]'); await p.waitForTimeout(400);
ok('and it sticks when turned on', await p.evaluate(()=>!!window.Session.user().autoBid));

console.log('— THE CLIENT PICKS HOW, AND IT IS CARRIED —');
await open('services.html', 'u-fahad');
await p.click('[data-pick-type="consult"]'); await p.waitForTimeout(350);
ok('the offer shows the ways it can be delivered', (await p.$$('[data-order-channel]')).length > 0);
// Both clicks must land on the SAME offer, or the channel is set on one card
// and the order placed from another.
const card = p.locator('.card', { has: p.locator('[data-order-channel="video"]') }).first();
await card.locator('[data-order-channel="video"]').click(); await p.waitForTimeout(250);
await card.locator('[data-order]').click(); await p.waitForTimeout(600);
const req = await p.evaluate(()=>window.Store.requests().slice(-1)[0]);
ok('the request carries the channel the client chose', req && req.channel === 'video');
ok('and a video request counts as live', await p.evaluate(r=>window.Models.isLive(r), req) === true);

console.log('— ONE PROGRESS TRACK, READ BY EACH SIDE IN ITS OWN WORDS —');
await open('requests.html', 'u-fahad');
await p.click('[data-detail]'); await p.waitForTimeout(400);
ok('the client sees it', await p.$('.track') !== null);
const ct = await p.$eval('.track', e=>e.innerText);
ok('with every stage named', /أرسلتَ الطلب/.test(ct) && /وصلك التسليم/.test(ct), ct.slice(0,60));
ok('and whose move it is', /ننتظر/.test(ct), ct.slice(0,80));

await open('requests.html', 'u-ahmed');
await p.click('[data-open]'); await p.waitForTimeout(450);
ok('the lawyer sees the same track', await p.$('.track') !== null);
const lt = await p.$eval('.track', e=>e.innerText);
// The same record, the other side of it: a lawyer is not "waiting on the
// lawyer", and the last thing on their bar is being paid rather than a
// delivery arriving.
ok('in their own words', /استلمته/.test(lt) && /قُبِل واستُحق/.test(lt), lt.slice(0,80));
ok('told it is waiting on them', /ننتظرك أنت/.test(lt), lt.slice(0,80));

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
