/* ==========================================================================
   The second way up: supervision bought by the case, and an open call.

   A trainee between mentors is competent and unsigned. Migration 021 gives
   them two ways to have somebody answerable — buy one lawyer's signature for
   one screening, or put out a call that every mentor sees. This follows both
   ends of both, and the rules that hold either way: the side that asked never
   answers, a spent signature is spent, and a client sees none of it.

       node tools/supervision-e2e.mjs
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

console.log('— THE LAWYER PUBLISHES THE OFFER THEMSELVES —');
await open('mentorship.html?tab=offer', 'u-ahmed');
ok('the offer editor is on the supervision page', (await p.$('[data-offer-card]')) !== null, await body());
ok('with the price hidden until the offer is taken',
   await p.$eval('[data-offer-when="supervisionFee"]', e => e.hidden) === true);
await p.check('[data-offer="supervisesCases"]'); await p.waitForTimeout(200);
ok('ticking it opens the price straight away',
   await p.$eval('[data-offer-when="supervisionFee"]', e => e.hidden) === false);
await p.fill('[data-offer="supervisionFee"]', '400');
await p.click('[data-offer-save]'); await p.waitForTimeout(300);
ok('a price outside the platform\u2019s band is refused', /خارج النطاق/.test(await body()));
ok('and nothing was published',
   await p.evaluate(() => !Models.user('u-ahmed').supervisesCases));
await p.fill('[data-offer="supervisionFee"]', '100');
await p.fill('[data-offer="mentorNote"]', 'أشرف على القضايا العمالية والتجارية');
await p.click('[data-offer-save]'); await p.waitForTimeout(400);
ok('a price inside it is published',
   await p.evaluate(() => Models.user('u-ahmed').supervisionFee) === 100);
ok('the offer is on', await p.evaluate(() => Models.user('u-ahmed').supervisesCases) === true);
ok('the note with it', await p.evaluate(() => Models.user('u-ahmed').mentorNote) === 'أشرف على القضايا العمالية والتجارية');
ok('and the monthly offer was not switched on behind their back',
   await p.evaluate(() => !Models.user('u-ahmed').isMentor));
ok('the page says what reaches them after the cut', /يصلك ٨٥|يصلك 85/.test(await body()));

/* The other lawyer takes trainees by the month and does not sell the case.
   Keeping them apart is the point: the two offers are not the same offer. */
await p.evaluate(() => {
  Store.updateAccount('u-sara',  { isMentor: true, mentorshipFee: 90 });
});

console.log('— A TRAINEE WITH NOBODY BEHIND THEM IS OFFERED BOTH WAYS —');
await open('mentorship.html?tab=find', 'u-jaid');
let t = await body();
ok('the mentor list is there', (await p.$('[data-mentor-row]')) !== null, t.slice(0,200));
ok('with the open call beside it', (await p.$('[data-ask="all"]')) !== null);
ok('the seller is listed', /أحمد/.test(t), t.slice(0,300));
ok('at the published price', /١٠٠|100/.test(t));
ok('with what reaches the lawyer after the cut spelled out',
   /بعد خصم المنصة يصل المحامي/.test(t));
ok('which is 85 of the 100', await p.evaluate(() =>
   Models.supervisionSplit(Models.user('u-ahmed')).lawyer) === 8500);
// The list is every route to a supervisor, so somebody who takes trainees
// by the month belongs on it even though they do not sell the single case.
ok('a lawyer who takes trainees by the month is on it too', /سارة/.test(t));
ok('but the single-case button is only under the one who sells it',
   (await p.$$('[data-buy-sup]')).length === 1,
   (await p.$$eval('[data-buy-sup]', ns => ns.map(n => n.getAttribute('data-buy-sup')))).join(','));
ok('and a lawyer who offers neither is not on the list at all', !/رانية/.test(t));
ok('and the screening pool says they cannot take one yet',
   await p.evaluate(() => Models.canScreen('u-jaid')) === false);

console.log('— A CLIENT SEES NONE OF IT —');
await open('mentorship.html', 'u-fahad');
ok('the page is not theirs at all', /للمحامين والمتدربين/.test(await body()));
ok('and offers them nothing to press', (await p.$('[data-mentor-row]')) === null);

console.log('— BUYING THE SIGNATURE —');
await open('mentorship.html?tab=find', 'u-jaid');
await p.click('[data-buy-sup="u-ahmed"]'); await p.waitForTimeout(500);
const order = await p.evaluate(() => Store.supervisionOrders()[0]);
ok('an order is written', !!order, order);
ok('paid', order.status === 'paid');
ok('at the fee the lawyer published', order.fee === 100, order.fee);
ok('on no case yet', order.requestId === null);
t = await body();
ok('the page says the signature is held and unspent', /توقيع غير مصروف/.test(t), t.slice(0,240));
ok('and now the trainee may screen', await p.evaluate(() => Models.canScreen('u-jaid')) === true);
ok('with that lawyer answering for them',
   await p.evaluate(() => Models.signerFor('u-jaid').id) === 'u-ahmed');

console.log('— AND CANNOT BUY A SECOND WHILE ONE IS UNSPENT —');
ok('the buy buttons are gone', (await p.$('[data-buy-sup]')) === null);
ok('and the store refuses it anyway',
   await p.evaluate(() => Store.buySupervision('u-ahmed')) === 'already bought');

console.log('— SPENDING IT ON ONE SCREENING, AND ONLY ONE —');
const scr = await p.evaluate(() => Store.addRequest({
  clientId:'u-fahad', typeId:'free_screening', title:{ar:'فرز',en:'s'},
  brief:{ar:'فُصلت من العمل بدون إشعار، هل لي حق؟',en:'b'}, price:0, status:'new', hours:0 }));
// The screening pool is work, so it stays on the requests page. Spending
// the signature happens there; what it did to the order is read back here.
await open('requests.html', 'u-jaid');
await p.click('[data-scr-take="' + scr.id + '"]'); await p.waitForTimeout(500);
const spent = await p.evaluate(() => Store.supervisionOrders()[0]);
ok('the order is spent', spent.status === 'used', spent.status);
ok('stamped with the moment', !!spent.usedAt);
ok('and named to the case it was spent on', spent.requestId === scr.id, spent.requestId);
ok('the lawyer who signed is on the request',
   await p.evaluate(id => Models.request(id).lawyerId, scr.id) === 'u-ahmed');
ok('and the trainee is unsigned again', await p.evaluate(() => Models.canScreen('u-jaid')) === false);
await open('mentorship.html?tab=find', 'u-jaid');
ok('so the list offers to sell them another',
   (await p.$('[data-buy-sup="u-ahmed"]')) !== null);

console.log('— THE OPEN CALL: A TRAINEE ASKS EVERYBODY —');
await open('mentorship.html?tab=find', 'u-layan');
await p.click('[data-ask="all"]'); await p.waitForTimeout(400);
await p.click('[data-ask-send]'); await p.waitForTimeout(300);
ok('an empty call is refused', /اكتب سطراً/.test(await body()));
ok('and nothing was written', await p.evaluate(() => Store.invites().length) === 0);
await p.fill('[data-ask-note]', 'أبحث عن مشرف في القضايا العمالية');
await p.click('[data-ask-send]'); await p.waitForTimeout(500);
const call = await p.evaluate(() => Store.invites()[0]);
ok('the call is out', !!call, call);
ok('named to nobody in particular', call.mentorId === null);
ok('open', call.status === 'open');
ok('and it expires rather than standing forever', call.expiresAt > Date.now());
ok('the page says so', /نداؤك قائم/.test(await body()));

console.log('— EVERY MENTOR SEES IT, AND NOBODY ELSE —');
await open('mentorship.html?tab=calls', 'u-sara');
ok('it is in the mentor’s inbox', (await p.$('[data-call-inbox]')) !== null, await body());
ok('with the trainee named', /ليان/.test(await body()));
ok('and the line they wrote', /العمالية/.test(await body()));
await open('mentorship.html?tab=calls', 'u-ahmed');
ok('a lawyer who is not taking trainees does not see it',
   (await p.$('[data-call-inbox]')) === null);
await open('mentorship.html', 'u-fahad');
ok('and a client never does', (await p.$('[data-call-inbox]')) === null);
ok('because the page is not theirs', /للمحامين والمتدربين/.test(await body()));

console.log('— ANSWERING IT OPENS A MENTORSHIP THE TRAINEE STILL MUST ACCEPT —');
await open('mentorship.html?tab=calls', 'u-sara');
await p.click('[data-call-answer]'); await p.waitForTimeout(500);
const offered = await p.evaluate(() =>
  Store.mentorships().filter(m => m.internId === 'u-layan')[0]);
ok('an offer is opened', !!offered, offered);
ok('coming from the mentor', offered.openedBy === 'mentor');
ok('pending, not active', offered.status === 'pending');
ok('at the mentor’s monthly fee', offered.fee === 90, offered.fee);
ok('carrying the call it came out of', offered.inviteId === call.id, offered.inviteId);
ok('the mentor cannot accept their own offer', (await p.$('[data-men-yes]')) === null);
await open('mentorship.html?tab=sent', 'u-layan');
ok('the trainee can', (await p.$('[data-men-yes]')) !== null);
await p.click('[data-men-yes]'); await p.waitForTimeout(500);
ok('accepting starts it',
   await p.evaluate(() => Store.mentorships().filter(m => m.internId === 'u-layan')[0].status) === 'active');
ok('and now they may screen', await p.evaluate(() => Models.canScreen('u-layan')) === true);
await open('mentorship.html?tab=find', 'u-layan');
ok('the open call is gone from the search', (await p.$('[data-ask="all"]')) === null);
ok('and so is every offer to sign them up again', (await p.$('[data-ask]')) === null);
ok('including the one that sells a single signature', (await p.$('[data-buy-sup]')) === null);

console.log('— A CALL CAN BE WITHDRAWN —');
await open('mentorship.html?tab=find', 'u-jaid');
await p.click('[data-ask="all"]'); await p.waitForTimeout(400);
await p.fill('[data-ask-note]', 'أبحث عن مشرف في قضايا الشركات');
await p.click('[data-ask-send]'); await p.waitForTimeout(500);
const mine = await p.evaluate(() => Models.callOf('u-jaid'));
ok('it is out', !!mine, mine);
await p.click('[data-call-drop="' + mine.id + '"]'); await p.waitForTimeout(500);
ok('withdrawing closes it',
   await p.evaluate(id => Store.invites().filter(i => i.id === id)[0].status, mine.id) === 'withdrawn');
ok('and it leaves the mentor’s inbox', await (async () => {
  await open('mentorship.html?tab=calls', 'u-sara');
  return !/الشركات/.test(await body());
})());

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
