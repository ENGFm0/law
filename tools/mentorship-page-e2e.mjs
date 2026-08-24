/* ==========================================================================
   The two ends of supervision, each on the screen its owner actually opens.

   A lawyer publishes an offer and answers what comes back, from their own
   account. A trainee compares what is on offer, asks for it — one lawyer or
   all of them — and once somebody signs for them, works out of a hub that
   shows the same rows the mentor's screen shows.

   The rule under all of it: nobody is signed up by pressing a button. Every
   route here ends in a row the other side still has to answer.

       node tools/hub-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,180)+'>':''));} };
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
const tab = async (name) => { await p.click('[data-tab="'+name+'"]'); await p.waitForTimeout(400); };
await p.goto(U+'index.html');
await p.evaluate(() => Store.resetWork());

console.log('— THE LAWYER PUBLISHES AND IS ANSWERED IN ONE PLACE —');
await open('account.html', 'u-ahmed');
ok('the offer panel is on their account', (await p.$('[data-offer-card]')) !== null);
ok('and the inbox with it', (await p.$('[data-men-inbox]')) !== null, await body());
ok('empty to begin with', /لا طلبات تنتظر ردّك/.test(await body()));
await p.check('[data-offer="isMentor"]'); await p.waitForTimeout(200);
await p.fill('[data-offer="mentorshipFee"]', '80');
await p.check('[data-offer="supervisesCases"]'); await p.waitForTimeout(200);
await p.fill('[data-offer="supervisionFee"]', '100');
await p.fill('[data-offer="mentorNote"]', 'أشرف على القضايا العمالية. ست ساعات أسبوعياً.');
await p.click('[data-offer-save]'); await p.waitForTimeout(500);
ok('both offers go out together',
   await p.evaluate(() => { const u = Models.user('u-ahmed');
     return u.isMentor && u.mentorshipFee === 80 && u.supervisesCases && u.supervisionFee === 100; }));
ok('with the terms they wrote, still in the field',
   await p.$eval('[data-offer="mentorNote"]', e => e.value) === 'أشرف على القضايا العمالية. ست ساعات أسبوعياً.');
await p.evaluate(() => Store.updateAccount('u-sara', { isMentor: true, mentorshipFee: 90 }));

console.log('— A CLIENT HAS NO SUPERVISION SPACE AT ALL —');
await open('mentorship.html', 'u-fahad');
ok('the page turns them away', /للمحامين والمتدربين/.test(await body()));
ok('with no tabs to press', (await p.$('[data-tab]')) === null);

console.log('— THE TRAINEE OPENS THEIR OWN PLACE —');
await open('mentorship.html', 'u-jaid');
ok('the workspace tab is there', (await p.$('[data-tab="space"]')) !== null, await body());
ok('and the mentor search', (await p.$('[data-tab="find"]')) !== null);
ok('and what they have asked for', (await p.$('[data-tab="sent"]')) !== null);
ok('the workspace opens first, on the thing they came for',
   await p.$eval('.tab.is-active', e => e.getAttribute('data-tab')) === 'space');
let t = await body();
ok('with nobody signing for them yet', /لا أحد يوقّع عنك بعد/.test(t), t.slice(0,240));
ok('and one button that goes where that is fixed', (await p.$('[data-go="find"]')) !== null);
await p.click('[data-go="find"]'); await p.waitForTimeout(400);
ok('which is the mentor search',
   await p.$eval('.tab.is-active', e => e.getAttribute('data-tab')) === 'find');

console.log('— AND A PUBLIC PROFILE IS STILL A PUBLIC PROFILE —');
await open('intern.html?id=u-layan', 'u-jaid');
ok('no workspace leaks onto it', (await p.$('[data-tab="space"]')) === null);
ok('nor the mentor search', (await p.$('[data-tab="find"]')) === null);
ok('it is still the profile it was', /ليان/.test(await body()));
await open('intern.html', 'u-jaid');
ok('and your own profile is a profile too, not the workspace',
   (await p.$('[data-tab="space"]')) === null, await body());

console.log('— WHAT IS ON OFFER, PRICED IN THE OPEN —');
await open('mentorship.html', 'u-jaid');
await tab('find');
t = await body();
ok('both lawyers are listed', /أحمد/.test(t) && /سارة/.test(t), t.slice(0,200));
ok('the monthly fee is shown', /٨٠|80/.test(t));
ok('so is the single case', /١٠٠|100/.test(t));
ok('and what reaches the lawyer after the cut', /بعد خصم المنصة يصل المحامي/.test(t));
ok('a lawyer who sells neither is not on the list', !/رانية/.test(t));
ok('the terms they published are readable', /ست ساعات أسبوعياً/.test(t));
ok('a mentor with room says nothing rather than "supervising 0"',
   !/يشرف على/.test(t));
await p.evaluate(() => { const m = Store.openMentorship({ mentorId:'u-ahmed',
  internId:'u-turki', openedBy:'intern', fee:80 });
  Store.setMentorship(m.id, { status:'active' }); });
await open('mentorship.html', 'u-jaid'); await tab('find');
ok('and one who has trainees says how many', /يشرف على/.test(await body()));

console.log('— ASKING ONE LAWYER —');
ok('no modal until asked', (await p.$('[data-ask-modal]')) === null);
await p.click('[data-ask="u-ahmed"]'); await p.waitForTimeout(400);
ok('the modal opens', (await p.$('[data-ask-modal]')) !== null);
ok('naming who it goes to', /طلبك يصل/.test(await body()));
ok('and saying nothing starts until they accept', /لا يبدأ شيء حتى يقبله/.test(await body()));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('escape closes it', (await p.$('[data-ask-modal]')) === null);
ok('and nothing was sent',
   await p.evaluate(() => Store.mentorships().filter(m => m.internId === 'u-jaid').length) === 0);
await p.click('[data-ask="u-ahmed"]'); await p.waitForTimeout(400);
await p.click('[data-ask-send]'); await p.waitForTimeout(500);
const applied = await p.evaluate(() =>
  Store.mentorships().filter(m => m.internId === 'u-jaid')[0]);
ok('sending opens an application', !!applied, applied);
ok('from the trainee', applied.openedBy === 'intern');
ok('pending, not active', applied.status === 'pending');
ok('at the fee the lawyer published', applied.fee === 80, applied.fee);
ok('the modal closes behind it', (await p.$('[data-ask-modal]')) === null);
ok('and the row now says it is with them', /قيد النظر|طلبك/.test(await body()));

console.log('— THE LAWYER ANSWERS FROM THE SAME PAGE —');
await open('mentorship.html', 'u-ahmed');
await tab('inbox');
t = await body();
ok('the application is in their inbox', /أحمد الجعيد/.test(t), t.slice(0,300));
ok('with both answers in their hands',
   (await p.$('[data-men-yes]')) !== null && (await p.$('[data-men-no]')) !== null);
await open('mentorship.html', 'u-jaid');
await tab('sent');
ok('and the trainee cannot accept their own application',
   (await p.$('[data-men-yes]')) === null);
await open('mentorship.html', 'u-ahmed');
await tab('inbox');
await p.click('[data-men-yes]'); await p.waitForTimeout(500);
ok('accepting starts it', await p.evaluate(() =>
   Store.mentorships().filter(m => m.internId === 'u-jaid')[0].status) === 'active');
await tab('mentees');
ok('and it moves to the people they supervise', /أحمد الجعيد/.test(await body()));

console.log('— AND THE WORKSPACE FILLS IN —');
await open('mentorship.html', 'u-jaid');
t = await body();
ok('the supervisor is named', /مشرفك/.test(t) && /أحمد عبدالله/.test(t), t.slice(0,300));
ok('there is a way into the room', (await p.$('a[href="requests.html"]')) !== null);
ok('the hours are tracked against the certificate', /ساعات التدريب/.test(t));
ok('against forty', /٤٠|40/.test(t));
ok('their desk is listed', /ما على مكتبك/.test(t));
ok('with a count of what is under way, and the way back to it',
   /مهمة تحت التنفيذ/.test(t) && (await p.$('a[href="requests.html"]')) !== null, t.slice(0,300));
ok('and the sessions', /الجلسات/.test(t));
ok('now they may screen', await p.evaluate(() => Models.canScreen('u-jaid')) === true);
await tab('find');
ok('the list no longer offers to sign them up twice',
   (await p.$('[data-ask]')) === null, await body());
ok('and says who has them', /تحت إشراف/.test(await body()));

console.log('— THE OPEN CALL, FROM THE SAME SCREEN —');
await open('mentorship.html', 'u-layan');
await tab('find');
await p.click('[data-ask="all"]'); await p.waitForTimeout(400);
ok('the broadcast modal opens', (await p.$('[data-ask-modal]')) !== null);
ok('and says a client never sees it', /لا يراه العملاء/.test(await body()));
await p.click('[data-ask-send]'); await p.waitForTimeout(400);
ok('an empty call is refused', /اكتب سطراً/.test(await body()));
ok('and nothing was written', await p.evaluate(() => Store.invites().length) === 0);
await p.fill('[data-ask-note]', 'أبحث عن مشرف في القضايا العمالية');
await p.click('[data-ask-send]'); await p.waitForTimeout(500);
const call = await p.evaluate(() => Store.invites()[0]);
ok('the call goes out', !!call, call);
ok('to nobody in particular', call.mentorId === null);
ok('the modal closes', (await p.$('[data-ask-modal]')) === null);
ok('and the page says it is out', /نداؤك قائم/.test(await body()));
await open('mentorship.html', 'u-sara');
await tab('calls');
ok('every mentor sees it', /ليان/.test(await body()));

console.log('— BUYING ONE SIGNATURE INSTEAD —');
await open('mentorship.html', 'u-layan');
await tab('find');
await p.click('[data-buy-sup="u-ahmed"]'); await p.waitForTimeout(500);
const order = await p.evaluate(() => Store.supervisionOrders()[0]);
ok('the order is written', !!order && order.status === 'paid', order);
ok('at the published price', order.fee === 100, order.fee);
t = await body();
ok('the page says it is held and unspent', /توقيع غير مصروف/.test(t), t.slice(0,240));
ok('and will not sell them a second', (await p.$('[data-buy-sup]')) === null);
await tab('space');
t = await body();
ok('the workspace names who signs for them', /من يوقّع عنك/.test(t), t.slice(0,300));
ok('and says it is for one case only', /توقيع لقضية واحدة/.test(t));
ok('they may screen now', await p.evaluate(() => Models.canScreen('u-layan')) === true);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
