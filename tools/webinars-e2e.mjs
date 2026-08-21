/* ==========================================================================
   Workshops: seats, not hours.

   A room has a ceiling, a seat is sold once, and the price on a seat is the
   price it was bought at — a host who raises theirs afterwards must not be
   able to reach the people already booked. All three are checked here, and
   the last one is the reason a seat carries its own price at all.

       node tools/webinars-e2e.mjs
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
  await p.evaluate(u=>{ if (u) localStorage.setItem('sanad.session.user',u);
    else localStorage.removeItem('sanad.session.user');
    localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(450);
};
await p.goto(U+'index.html');
await p.evaluate(() => Store.resetWork());

console.log('— ONLY A VERIFIED LAWYER OPENS A ROOM —');
await open('webinars.html', 'u-jaid');
ok('a trainee is not offered the form', (await p.$('[data-web-open]')) === null);
await open('webinars.html', 'u-fahad');
ok('nor is a client', (await p.$('[data-web-open]')) === null);
await open('webinars.html', 'u-ahmed');
ok('a lawyer is', (await p.$('[data-web-open]')) !== null);

console.log('— AND NOT IN THE PAST —');
await p.click('[data-web-open]'); await p.waitForTimeout(300);
await p.click('[data-web-publish]'); await p.waitForTimeout(300);
ok('a workshop with nothing in it is refused', /مطلوبة/.test(await body()));
await p.fill('[data-web-title]', 'صياغة العقود');
await p.fill('[data-web-when]', '2020-01-01T10:00');
await p.fill('[data-web-seats]', '2');
await p.click('[data-web-publish]'); await p.waitForTimeout(300);
ok('and one somebody has already missed is not a room',
   /لا يمكن فتح ورشة في الماضي/.test(await body()));

console.log('— A ROOM, AND WHAT IT IS WORTH —');
const soon = new Date(Date.now() + 3 * 86400000);
const stamp = soon.toISOString().slice(0, 16);
await p.fill('[data-web-when]', stamp);
await p.fill('[data-web-price]', '100');
await p.selectOption('[data-web-audience]', 'intern');
await p.click('[data-web-publish]'); await p.waitForTimeout(500);
const w = await p.evaluate(() => Store.webinars()[0]);
ok('the room is opened', !!w && w.seats === 2, w);
ok('with a reference anybody can say', /^WRK-\d\d-\d{5}$/.test(w.ref), w.ref);
ok('and the host sees it is empty', /لا حجوزات بعد/.test(await body()));

console.log('— A SEAT IS TAKEN, AT THE PRICE ON THE DOOR —');
await open('webinars.html', 'u-jaid');
ok('a trainee sees the workshop', /صياغة العقود/.test(await body()));
ok('with the seats left on it', /مقعد متبقٍ/.test(await body()));
await p.click('[data-web-book="' + w.id + '"]'); await p.waitForTimeout(450);
ok('and can take one', /مقعدك محجوز/.test(await body()));
ok('at the room’s price, pinned to the seat',
   await p.evaluate(id => Store.seatOf(id, 'u-jaid').price, w.id) === 100);

// The whole reason the seat carries a price of its own.
await p.evaluate(id => Store.setWebinar(id, { price: 400 }), w.id);
ok('a host raising the price does not reach who already booked',
   await p.evaluate(id => Store.seatOf(id, 'u-jaid').price, w.id) === 100);
ok('and the takings follow the seats, not the sign',
   await p.evaluate(id => Models.ticketSplit(Store.webinar(id)).gross, w.id) === 10000);
await p.evaluate(id => Store.setWebinar(id, { price: 100 }), w.id);

console.log('— A CLIENT IS NOT IN A ROOM MEANT FOR TRAINEES —');
await open('webinars.html', 'u-fahad');
ok('it is not on their page', !/صياغة العقود/.test(await body()));

console.log('— THE CEILING HOLDS —');
await open('webinars.html', 'u-layan');
await p.click('[data-web-book="' + w.id + '"]'); await p.waitForTimeout(450);
ok('the last seat goes', await p.evaluate(id => Store.seats(id).length, w.id) === 2);
ok('and the room closes itself',
   await p.evaluate(id => Store.webinar(id).status, w.id) === 'full');
await open('webinars.html', 'u-turki');
ok('a third is told it is full', /اكتملت المقاعد/.test(await body()));
ok('with no button to press', (await p.$('[data-web-book="' + w.id + '"]')) === null);

console.log('— GIVING ONE UP PUTS IT BACK ON SALE —');
await open('webinars.html', 'u-layan');
await p.click('[data-web-drop="' + w.id + '"]'); await p.waitForTimeout(450);
ok('the room reopens',
   await p.evaluate(id => Store.webinar(id).status, w.id) === 'open');
await open('webinars.html', 'u-turki');
ok('and the next person can book', (await p.$('[data-web-book="' + w.id + '"]')) !== null);

console.log('— THE HOST IS SHOWN THEIR SHARE, NOT THE TAKINGS —');
await open('webinars.html', 'u-ahmed');
const t = await body();
ok('the takings are on the page', /المتحصّل/.test(t));
ok('and so is what actually reaches them', /يصلك بعد خصم المنصة/.test(t));
const split = await p.evaluate(id => Models.ticketSplit(Store.webinar(id)), w.id);
ok('one seat at 100 is 10,000 halalas', split.gross === 10000, split);
ok('the platform takes its ten per cent', split.platform === 1000, split.platform);
ok('and the host keeps the rest', split.host === 9000, split.host);
ok('which adds back up', split.platform + split.host === split.gross);
ok('the host can see who is coming', /الحاضرون/.test(t));

console.log('— AND CANCELLING SAYS SO —');
await p.click('[data-web-cancel="' + w.id + '"]'); await p.waitForTimeout(450);
ok('the room is marked cancelled',
   await p.evaluate(id => Store.webinar(id).status, w.id) === 'cancelled');
await open('webinars.html', 'u-jaid');
ok('and it drops off the list rather than sitting there bookable',
   !/صياغة العقود/.test(await body()));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
