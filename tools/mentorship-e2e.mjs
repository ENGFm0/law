/* ==========================================================================
   Paid supervision, from both ends.

   A trainee with nobody checking their work cannot take a free screening, and
   a certificate is only worth what the hours behind it are. So this follows
   the whole thing: a lawyer offers supervision, a trainee applies, the lawyer
   accepts — and neither side can do the other's half of that.

       node tools/mentorship-e2e.mjs
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
await p.evaluate(() => Store.resetWork());

console.log('— A LAWYER WHO IS NOT TAKING TRAINEES IS NOT OFFERED —');
await open('lawyer.html?id=u-ahmed', 'u-jaid');
ok('no supervision card on their page', (await p.$('[data-mentor-card]')) === null);

console.log('— ONE WHO IS, IS —');
await p.evaluate(() => Store.updateAccount('u-ahmed', { isMentor: true, mentorshipFee: 80 }));
await open('lawyer.html?id=u-ahmed', 'u-jaid');
let t = await body();
ok('the card is there', (await p.$('[data-mentor-card]')) !== null, t.slice(0,160));
ok('with the monthly fee on it', /٨٠|80/.test(t) && /شهرياً/.test(t));
ok('and says nothing is charged until it is accepted', /لا يُخصم شيء حتى يقبله/.test(t));
ok('a client never sees it', await (async () => {
  await open('lawyer.html?id=u-ahmed', 'u-fahad');
  return (await p.$('[data-mentor-card]')) === null;
})());

console.log('— THE TRAINEE APPLIES —');
await open('lawyer.html?id=u-ahmed', 'u-jaid');
await p.click('[data-mentor-apply="u-ahmed"]'); await p.waitForTimeout(450);
const applied = await p.evaluate(() => Store.mentorships()[0]);
ok('an application is opened', !!applied, applied);
ok('named as coming from the trainee', applied.openedBy === 'intern');
ok('pending, not active', applied.status === 'pending');
ok('at the fee the lawyer published', applied.fee === 80, applied.fee);
ok('and the page now says it is with them', /طلبك قيد النظر/.test(await body()));

console.log('— AND CANNOT ACCEPT THEIR OWN APPLICATION —');
await open('requests.html', 'u-jaid');
t = await body();
ok('the trainee sees it on their desk', /كفالة الإشراف/.test(t), t.slice(0,200));
ok('with no accept button in their hands',
   (await p.$('[data-men-yes]')) === null);

console.log('— THE LAWYER ANSWERS —');
await open('requests.html', 'u-ahmed');
ok('it is on the lawyer’s desk', /من تشرف عليهم/.test(await body()));
ok('with the answer in their hands', (await p.$('[data-men-yes]')) !== null);
await p.click('[data-men-yes]'); await p.waitForTimeout(450);
const live = await p.evaluate(() => Store.mentorships()[0]);
ok('accepting starts it', live.status === 'active');
ok('and stamps the moment', !!live.startedAt);
ok('the lawyer is shown their net after the platform’s cut',
   /يصلك بعد خصم المنصة/.test(await body()));
ok('which is 68 of the 80', await p.evaluate(() =>
   Models.sponsorship(Store.mentorships()[0]).lawyer) === 6800);

console.log('— AND NOW THE TRAINEE MAY SCREEN A CASE —');
ok('supervised', await p.evaluate(() => Models.canScreen('u-jaid')) === true);
ok('with the mentor behind them',
   await p.evaluate(() => Models.mentorOf('u-jaid').id) === 'u-ahmed');

console.log('— THE ROOM IS THE TWO OF THEM —');
await open('requests.html', 'u-ahmed');
await p.fill('[data-room-body]', 'اقرأ نظام المرافعات قبل الجلسة');
await p.press('[data-room-body]', 'Enter'); await p.waitForTimeout(450);
ok('the mentor writes into it', /نظام المرافعات/.test(await body()));
await open('requests.html', 'u-jaid');
ok('and the trainee reads it', /نظام المرافعات/.test(await body()));
await p.fill('[data-room-body]', 'تمام، قرأته');
await p.press('[data-room-body]', 'Enter'); await p.waitForTimeout(450);
ok('and answers', /قرأته/.test(await body()));
await open('requests.html', 'u-layan');
ok('a trainee outside it sees none of it', !/نظام المرافعات/.test(await body()));

console.log('— THE CALENDAR IS THE MENTOR’S, AND SO ARE THE HOURS —');
await open('requests.html', 'u-jaid');
ok('the trainee cannot add a session', (await p.$('[data-session-form]')) === null);
await open('requests.html', 'u-ahmed');
ok('the mentor can', (await p.$('[data-session-form]')) !== null);
await p.fill('[data-session-title]', 'مراجعة قضية عمالية');
await p.fill('[data-session-when]', '2026-09-01T10:00');
await p.fill('[data-session-hours]', '3');
await p.click('[data-session-form] button[type=submit]'); await p.waitForTimeout(450);
ok('a session is booked', /مراجعة قضية عمالية/.test(await body()));
await open('requests.html', 'u-jaid');
ok('and the trainee sees it on theirs', /مراجعة قضية عمالية/.test(await body()));
ok('but cannot tick their own attendance',
   (await p.$('[data-men-attended]')) === null);
await open('requests.html', 'u-ahmed');
await p.click('[data-men-attended]'); await p.waitForTimeout(450);
ok('the mentor marks it attended',
   await p.evaluate(() => Store.sessions()[0].attended) === true);

console.log('— THE SPONSORSHIP IS PAID BY THE TRAINEE —');
await open('requests.html', 'u-ahmed');
ok('the mentor is not asked to pay', (await p.$('[data-men-pay]')) === null);
await open('requests.html', 'u-jaid');
ok('the trainee is told this month is not paid', /لم تُدفع كفالة هذا الشهر/.test(await body()));
await p.click('[data-men-pay]'); await p.waitForTimeout(500);
ok('paying moves the date forward',
   await p.evaluate(() => Store.mentorships()[0].paidUntil > Date.now()));
ok('and the page says until when', /مدفوعة حتى/.test(await body()));

console.log('— AND A LAWYER CAN INVITE FROM THE OTHER END —');
await open('intern.html?id=u-layan', 'u-ahmed');
ok('the invitation is offered on a trainee’s page',
   (await p.$('[data-mentor-invite="u-layan"]')) !== null, await body());
await p.click('[data-mentor-invite="u-layan"]'); await p.waitForTimeout(450);
const invited = await p.evaluate(() =>
  Store.mentorships().filter(m => m.internId === 'u-layan')[0]);
ok('an invitation is opened', !!invited && invited.openedBy === 'mentor', invited);
await open('requests.html', 'u-ahmed');
ok('and this time the lawyer cannot answer their own',
   (await p.$$('[data-men-yes]')).length === 0);
await open('requests.html', 'u-layan');
ok('the trainee can', (await p.$('[data-men-yes]')) !== null);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
