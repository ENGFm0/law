/* ==========================================================================
   The progress bar four people read, and the discount box under a price.

   The bar is one component with four vocabularies, drawn off one record — so
   what this checks is that the client and the lawyer see different words and
   never a different position, and that a code says what it is worth or says
   why it is worth nothing.

       node tools/stepper-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,160)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:1000} });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
const body = () => p.$eval('#main', e=>e.innerText);
const open = async (page, who) => {
  await p.evaluate(u=>{ localStorage.setItem('sanad.session.user',u);
    localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(450);
};
await p.goto(U+'index.html');

/* One case, lived through: placed, taken, routed, talked about, delivered. */
const rid = await p.evaluate(() => {
  Store.resetWork();
  Store.signIn('u-fahad');
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'مذكرة',en:'M'}, brief:{ar:'ب',en:'b'},
    price:500, status:'new', hours:4 });
  Store.signIn('u-ahmed');
  Store.setRequest(r.id, { status:'in_progress' });
  Store.setRequest(r.id, { assignedTo:'u-jaid', status:'with_intern', internShare:40 });
  Store.sendMessage({ requestId:r.id, authorId:'u-ahmed', audience:'internal', body:'راجع الاختصاص' });
  Store.setRequest(r.id, { status:'delivered', body:'المذكرة' });
  localStorage.setItem('rid', r.id);
  return r.id;
});

console.log('— THE CLIENT READS IT IN THEIR OWN WORDS —');
await open('requests.html', 'u-fahad');
let t = await body();
ok('the bar is on the case', (await p.$('[data-stepper="'+rid+'"]')) !== null);
ok('drawn for them', await p.$eval('[data-stepper="'+rid+'"]', e=>e.getAttribute('data-role')) === 'client');
ok('five stages, not the lawyer’s six',
   (await p.$$('[data-stepper="'+rid+'"] .track__step')).length === 5);
ok('in the client’s vocabulary', /أرسلتَ الطلب/.test(t) && /وصلك التسليم/.test(t), t.slice(0,200));
ok('and never in the lawyer’s', !/قُبِل واستُحق/.test(t));
ok('standing at the delivery',
   await p.$eval('[data-stepper="'+rid+'"] .track__step.is-here', e=>e.getAttribute('data-step')) === 'delivered');
ok('every stage that happened carries when it did',
   (await p.$$('[data-stepper="'+rid+'"] .track__at')).length >= 4);
ok('to the minute', /\d{1,2}:\d\d/.test(t), (t.match(/[^\n]*\d{1,2}:\d\d[^\n]*/) || [])[0]);
ok('and it says whose move it is now', /ننتظرك أنت/.test(t));

console.log('— THE LAWYER READS THE SAME RECORD, DIFFERENTLY —');
await open('requests.html', 'u-ahmed');
t = await body();
ok('drawn for them', await p.$eval('[data-stepper="'+rid+'"]', e=>e.getAttribute('data-role')) === 'lawyer');
ok('six stages, ending at being paid',
   (await p.$$('[data-stepper="'+rid+'"] .track__step')).length === 6);
ok('in the lawyer’s vocabulary', /استلمته/.test(t) && /قُبِل واستُحق/.test(t));
ok('with the routing to a trainee on it', /وجّهته لمتدرب/.test(t));
ok('standing at the same place the client is',
   await p.$eval('[data-stepper="'+rid+'"] .track__step.is-here', e=>e.getAttribute('data-step')) === 'delivered');
ok('and told it is not their move', /ننتظر العميل/.test(t));

console.log('— AN OBJECTION HOLDS IT, WHOEVER IS LOOKING —');
await p.evaluate(() => Store.openDispute({ requestId: localStorage.getItem('rid'),
                                           byId: 'u-fahad', reason: 'ناقص' }));
await open('requests.html', 'u-fahad');
// A disputed case moves to its own pile, which is where somebody would go
// looking for it.
await p.click('[data-pile="disputed"]'); await p.waitForTimeout(400);
ok('the bar says it is held', /موقوف على قرار الإدارة/.test(await body()), await body());
ok('and marked as held', await p.$eval('[data-stepper="'+rid+'"]', e=>e.classList.contains('track--held')));

console.log('— A DISCOUNT CODE SAYS WHAT IT IS WORTH —');
const rid2 = await p.evaluate(() => {
  Store.signIn('u-fahad');
  Store.addPromo({ code:'SANAD10', discountPct:10 });
  Store.addPromo({ code:'OLDONE', discountPct:50, expiresAt: Date.now() - 1000 });
  Store.addPromo({ code:'BIGCUT', discountPct:80 });
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'عقد',en:'C'}, brief:{ar:'ب',en:'b'},
    price:1000, status:'new', hours:4 });
  localStorage.setItem('rid2', r.id);
  return r.id;
});
await open('requests.html', 'u-fahad');
await p.click('.case__actions [data-detail="'+rid2+'"]'); await p.waitForTimeout(400);
ok('the box is offered on work that has not started',
   (await p.$('[data-promo="'+rid2+'"]')) !== null, await body());

await p.fill('[data-promo="'+rid2+'"] [data-promo-code]', 'NOPE');
await p.click('[data-promo-apply="'+rid2+'"]'); await p.waitForTimeout(400);
ok('a code nobody issued is named as unknown', /كود غير معروف/.test(await body()));

await p.fill('[data-promo="'+rid2+'"] [data-promo-code]', 'OLDONE');
await p.click('[data-promo-apply="'+rid2+'"]'); await p.waitForTimeout(400);
ok('an expired one says expired', /انتهت صلاحية الكود/.test(await body()));

await p.fill('[data-promo="'+rid2+'"] [data-promo-code]', 'BIGCUT');
await p.click('[data-promo-apply="'+rid2+'"]'); await p.waitForTimeout(400);
const capped = await p.evaluate(id => {
  const r = Models.request(id), d = Models.distribute(r);
  return { discount: d.discount, commission: d.commission, lawyer: d.lawyer };
}, rid2);
ok('a code bigger than the commission takes the commission and no more',
   capped.discount === 10000 && capped.commission === 0, JSON.stringify(capped));
ok('and the lawyer is untouched by any of it',
   capped.lawyer === 90000, capped.lawyer);
ok('the box says so where the client can read it',
   /خُصم/.test(await body()), (await body()).match(/خُصم[^\n]*/));

await p.click('[data-promo-clear="'+rid2+'"]'); await p.waitForTimeout(400);
ok('taking it off puts the price back',
   (await p.evaluate(id => Models.distribute(Models.request(id)).discount, rid2)) === 0);

await p.fill('[data-promo="'+rid2+'"] [data-promo-code]', 'sanad10');
await p.click('[data-promo-apply="'+rid2+'"]'); await p.waitForTimeout(400);
const took = await p.evaluate(id => {
  const d = Models.distribute(Models.request(id));
  return { discount: d.discount, code: d.promoCode, client: d.client, lawyer: d.lawyer };
}, rid2);
ok('a code typed in lower case still works', took.code === 'SANAD10', JSON.stringify(took));
ok('ten per cent of 1,000 riyals is 100', took.discount === 10000, took.discount);
ok('and the client pays that much less', took.client === 90000, took.client);

console.log('— AND ONCE THE WORK IS UNDER WAY, THE PRICE IS THE PRICE —');
await p.evaluate(id => Store.setRequest(id, { status: 'in_progress' }), rid2);
await open('requests.html', 'u-fahad');
await p.click('.case__actions [data-detail="'+rid2+'"]').catch(()=>{});
await p.waitForTimeout(400);
ok('no box is offered on work already running',
   (await p.$('[data-promo="'+rid2+'"] [data-promo-code]')) === null);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
