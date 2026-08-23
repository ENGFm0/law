/* ==========================================================================
   The free screening: a first look, done by a trainee, signed by a lawyer.

   Free is the whole point — it is how somebody with a problem finds out
   whether they have a case at all. Which makes the rule around it the thing
   worth testing: nobody gives legal advice on this platform with nobody
   checking their work, and the trainee who writes it is never the one who
   delivers it.

       node tools/screening-e2e.mjs
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
  await p.goto(U+page); await p.waitForTimeout(500);
};
await p.goto(U+'index.html');
await p.evaluate(() => Store.resetWork());

console.log('— IT IS NOT A CATEGORY ANYBODY PRICES OR PICKS —');
ok('the platform ships it as a kind of work',
   await p.evaluate(() => !!Models.serviceType('free_screening')));
ok('with a band of nothing to nothing',
   await p.evaluate(() => { const b = Models.priceBand('free_screening');
     return b.min === 0 && b.max === 0; }));
ok('and the model calls that free',
   await p.evaluate(() => Models.isFreeType('free_screening')) === true);
ok('nothing else on the platform is',
   await p.evaluate(() => Models.serviceTypes()
     .filter(t => Models.isFreeType(t.id)).length) === 1);
ok('zero is a price it accepts',
   await p.evaluate(() => Models.checkPrice('free_screening', 0)) === null);
ok('and anything above it is not',
   await p.evaluate(() => Models.checkPrice('free_screening', 50)) === 'high');
ok('while zero on paid work is still refused',
   await p.evaluate(() => Models.checkPrice('consult', 0)) === 'low');
ok('and a blank field is still blank',
   await p.evaluate(() => Models.checkPrice('consult', '')) === 'empty');

await open('services.html', 'u-ahmed');           // a lawyer's own list
let types = await p.$$eval('[data-new-type] option', ns => ns.map(n => n.value));
ok('a lawyer is not offered it as a category', types.indexOf('free_screening') === -1,
   types.join(','));
ok('but is offered the ones they do price', types.indexOf('consult') !== -1);

await open('quotes.html', 'u-fahad');
const qTypes = await p.$$eval('[data-q-type] option, [data-quote-type] option',
                              ns => ns.map(n => n.value)).catch(() => []);
ok('and it never goes to auction', qTypes.indexOf('free_screening') === -1, qTypes.join(','));

await open('services.html', 'u-fahad');           // the client's picker
const picks = await p.$$eval('[data-pick-type]',
                             ns => ns.map(n => n.getAttribute('data-pick-type')));
ok('a client is not sent shopping for a lawyer to do it',
   picks.indexOf('free_screening') === -1, picks.join(','));

console.log('— THE CLIENT ASKS, AND IT COSTS NOTHING —');
await open('services.html', 'u-fahad');
ok('the free look is offered above the price list',
   (await p.$('[data-screening]')) !== null, await body());
ok('and says who writes it and who signs it',
   /متدرب تحت إشراف محامٍ مرخّص/.test(await body()));
await p.click('[data-screening-ask]'); await p.waitForTimeout(300);
ok('with nothing written, it asks for something', /اكتب سطرين على الأقل/.test(await body()));
await p.fill('[data-screening-brief]', 'فُصلت من العمل بعد ٤ سنوات بدون إشعار، هل لي حق؟');
await p.click('[data-screening-ask]'); await p.waitForTimeout(500);
const scr = await p.evaluate(() => Store.requests().filter(r => r.typeId === 'free_screening')[0]);
ok('the screening is opened', !!scr, scr);
ok('at nothing', scr.price === 0);
ok('with no lawyer on it yet', !scr.lawyerId);
await open('services.html', 'u-fahad');
ok('and a second one is not offered while it is open', /لديك جلسة فرز مفتوحة/.test(await body()));

console.log('— AND DOES NOT BLOCK PAID WORK —');
const paid = await p.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    title:{ar:'استشارة',en:'c'}, brief:{ar:'ب',en:'b'}, price:250, status:'new', hours:4 });
  return r.id;
});
ok('a paid request goes through beside it', !!paid);

console.log('— NOBODY ADVISES WITH NOBODY CHECKING THEM —');
await open('requests.html', 'u-layan');       // a trainee with no supervisor
let t = await body();
ok('the pool is on the trainee’s page', /جلسات فرز بانتظار متدرب/.test(t), t.slice(0,200));
ok('but an unsupervised trainee is told why they cannot take one',
   /تحتاج محامياً مشرفاً/.test(t));
ok('and given no button to press', (await p.$('[data-scr-take]')) === null);

console.log('— A SUPERVISED ONE CAN, AND BRINGS THEIR LAWYER WITH THEM —');
await p.evaluate(() => {
  Store.updateAccount('u-ahmed', { isMentor: true, mentorshipFee: 80 });
  const m = Store.openMentorship({ mentorId:'u-ahmed', internId:'u-jaid',
                                   openedBy:'intern', fee:80 });
  Store.setMentorship(m.id, { status: 'active' });
});
await open('requests.html', 'u-jaid');
ok('the supervised trainee is offered it', (await p.$('[data-scr-take]')) !== null);
await p.click('[data-scr-take="' + scr.id + '"]'); await p.waitForTimeout(500);
const taken = await p.evaluate(id => Models.request(id), scr.id);
ok('the trainee is on it',
   await p.evaluate(id => Models.requestState(Models.request(id)).assignedTo, scr.id) === 'u-jaid');
ok('and their supervisor is the lawyer answerable for it',
   taken.lawyerId === 'u-ahmed', taken.lawyerId);

console.log('— THE TRAINEE WRITES IT, AND SENDS IT UP —');
await open('requests.html', 'u-jaid');
await p.click('[data-task-open="' + scr.id + '"]'); await p.waitForTimeout(400);
ok('they get the client’s words', /فُصلت من العمل/.test(await body()));
await p.fill('[data-task-body]', 'نعم، لديك حق في مكافأة نهاية الخدمة وبدل الإشعار.');
await p.click('[data-task-save="' + scr.id + '"]'); await p.waitForTimeout(400);
ok('the analysis is saved',
   /مكافأة نهاية الخدمة/.test(await p.evaluate(id =>
     Models.requestState(Models.request(id)).body || '', scr.id)));
ok('and what they are offered is to send it UP, not out',
   (await p.$('[data-scr-submit="' + scr.id + '"]')) !== null &&
   (await p.$('[data-task-deliver="' + scr.id + '"]')) === null);
await p.click('[data-scr-submit="' + scr.id + '"]'); await p.waitForTimeout(500);
ok('which puts it in front of the lawyer',
   await p.evaluate(id => Models.requestState(Models.request(id)).status, scr.id) === 'drafted');
ok('and never in front of the client',
   await p.evaluate(id => Models.requestState(Models.request(id)).status, scr.id) !== 'delivered');
await open('requests.html', 'u-jaid');
ok('the trainee is told it is waiting on their supervisor',
   /بانتظار اعتماد المحامي/.test(await body()));

console.log('— THE CLIENT SEES NOTHING UNTIL IT IS SIGNED —');
await open('requests.html', 'u-fahad');
ok('no analysis has reached them',
   !/مكافأة نهاية الخدمة/.test(await body()));

console.log('— ONE CLICK, AND THE LAWYER STANDS BEHIND IT —');
await open('requests.html', 'u-ahmed');
t = await body();
ok('the lawyer is told whose work it is', /كتبها المتدرب/.test(t), t.slice(0,240));
ok('with one button to approve it',
   (await p.$('[data-scr-approve="' + scr.id + '"]')) !== null);
await p.click('[data-scr-approve="' + scr.id + '"]'); await p.waitForTimeout(500);
ok('approving delivers it',
   await p.evaluate(id => Models.requestState(Models.request(id)).status, scr.id) === 'delivered');
await open('requests.html', 'u-fahad');
await p.click('.case__actions [data-detail="' + scr.id + '"]').catch(()=>{});
await p.waitForTimeout(400);
ok('and now the client has it', /مكافأة نهاية الخدمة/.test(await body()));

console.log('— AND A FINISHED SCREENING EARNS A REAL OFFER —');
await p.evaluate(id => { Store.signIn('u-fahad');
  Store.setRequest(id, { status: 'completed' }); }, scr.id);
const code = await p.evaluate(() => Models.conversionOffer('u-fahad'));
ok('a code is cut in the client’s name', !!code, code);
ok('at ten per cent', code.discountPct === 10);
ok('good once', code.usageLimit === 1);
ok('and it runs out', code.expiresAt > Date.now());
await open('requests.html', 'u-fahad');
await p.click('[data-pile="past"]').catch(()=>{});
await p.waitForTimeout(300);
await p.click('.case__actions [data-detail="' + scr.id + '"]').catch(()=>{});
await p.waitForTimeout(400);
t = await body();
ok('the offer is on the finished screening', /عندك قضية؟/.test(t), t.slice(0,200));
ok('naming the lawyer who did it', /أحمد/.test(t));
ok('and carrying the code itself', t.indexOf(code.code) !== -1, code.code);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
