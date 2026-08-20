/* ==========================================================================
   What the platform promises, and whether it keeps it.

   The four promises on the home page are only worth putting there if the
   site does them. Two of them are read from the settings, so they cannot
   drift from the rule; the money-back one has a door the client can open,
   and this opens it — then checks the ledger agrees.

       node tools/promise-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,140)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:1000}, permissions:['microphone'] });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
const body = () => p.$eval('#main', e=>e.innerText);
const open = async (page, who) => {
  await p.evaluate(u=>{ if(u) localStorage.setItem('sanad.session.user',u);
    else localStorage.removeItem('sanad.session.user');
    localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(400);
};
await p.goto(U+'index.html');

console.log('— THE HOME PAGE SAYS WHAT THE SITE DOES —');
await open('index.html', null);
let t = await body();
ok('licensed lawyers', /محامون مرخّصون/.test(t));
ok('money held until you accept', /مالك محفوظ حتى تقبل/.test(t));
ok('documents are closed', /مستنداتك مغلقة/.test(t));
ok('and money back, with the window on it', /ضمان استرداد خلال ٢٤|ضمان استرداد خلال 24/.test(t), t.match(/ضمان[^\n]*/));
ok('a starting price anybody can check', /يبدأ من/.test(t), t.match(/يبدأ من[^\n]*/));
ok('and no hidden fees', /بلا رسوم خفية/.test(t));

console.log('— THE PROMISE FOLLOWS THE SETTING —');
await open('admin.html?tab=settings', 'u-staff');
await p.fill('[data-guar-hours]', '48');
await p.click('[data-save-settings]'); await p.waitForTimeout(400);
await open('index.html', null);
ok('changing the window changes the promise', /٤٨|48/.test(await body()));
await open('admin.html?tab=settings', 'u-staff');
await p.uncheck('[data-guar-open]');
await p.click('[data-save-settings]'); await p.waitForTimeout(400);
await open('index.html', null);
ok('withdrawing it takes it off the page', !/ضمان استرداد خلال/.test(await body()));
await open('admin.html?tab=settings', 'u-staff');
await p.check('[data-guar-open]');
await p.fill('[data-guar-hours]', '24');
await p.click('[data-save-settings]'); await p.waitForTimeout(400);

console.log('— AND THE CLIENT CAN ACTUALLY USE IT —');
await p.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'مراجعة عقد',en:'Contract'}, brief:{ar:'ب',en:'b'},
    price:250, status:'in_progress', hours:4 });
  Store.setRequest(r.id, { status:'delivered', body:'التسليم' });
  localStorage.setItem('rid', r.id);
});
await open('requests.html', 'u-fahad');
const rid = await p.evaluate(() => localStorage.getItem('rid'));
await p.click(`[data-detail="${rid}"]`); await p.waitForTimeout(400);
t = await body();
ok('the guarantee is on the delivered work', /ضمان الرضا/.test(t), t.slice(0,120));
ok('with the time left on it', /أمامك .* لطلب الاسترداد/.test(t), t.match(/أمامك[^\n]*/));
p.on('dialog', d => d.accept());
await p.click(`[data-guarantee="${rid}"]`); await p.waitForTimeout(600);
ok('asking closes the request as refunded',
   (await p.evaluate(() => Models.requestState(Models.request(localStorage.getItem('rid'))).status)) === 'refunded');
const settled = await p.evaluate(() => {
  const r = Models.request(localStorage.getItem('rid'));
  return Models.settlement(r);
});
ok('the whole amount goes back', settled && settled.lawyerPct === 0 && settled.refund > 0,
   JSON.stringify(settled).slice(0,120));
ok('and it is on the record as a decided dispute',
   (await p.evaluate(() => Store.disputeFor(localStorage.getItem('rid')).status)) === 'resolved');
ok('the window is closed afterwards', !/أمامك .* لطلب الاسترداد/.test(await body()));

console.log('— AND THE LEDGER KNOWS —');
await open('admin.html?tab=money', 'u-staff');
const money = await body();
ok('the refund is a line in the books', /مُسترد للعملاء/.test(money), money.slice(0,200));
// The seed carries other orders, so the question is what this one added:
// nothing to the platform, nothing to the lawyer, and the client's money back.
const took = await p.evaluate(() => {
  const r = Models.request(localStorage.getItem('rid'));
  const s = Models.settlement(r);
  const b = Models.books(1);
  return { refund: s.refund, kept: s.kept, commission: s.commission,
           lawyer: s.lawyer, booksRefunded: b.refunded };
});
ok('the refund is the whole price', took.refund === 25000, JSON.stringify(took));
ok('the platform kept nothing', took.kept === 0 && took.commission === 0, JSON.stringify(took));
ok('the lawyer was paid nothing', took.lawyer === 0, took.lawyer);
ok('and the ledger carries exactly that', took.booksRefunded === 25000, took.booksRefunded);

console.log('— A VOICE NOTE IS SAID, NOT TYPED —');
await p.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'سؤال',en:'Q'}, brief:{ar:'ب',en:'b'},
    price:250, status:'in_progress', hours:4 });
  localStorage.setItem('rid2', r.id);
});
await open('requests.html', 'u-fahad');
const rid2 = await p.evaluate(() => localStorage.getItem('rid2'));
await p.click(`[data-detail="${rid2}"][data-go-thread]`); await p.waitForTimeout(400);
ok('there is a way to record one', (await p.$('[data-thread-record]')) !== null);
await p.click('[data-thread-record]'); await p.waitForTimeout(1200);
ok('and it says it is recording',
   await p.$eval('[data-thread-record]', e=>e.classList.contains('is-recording')));
await p.click('[data-thread-record]'); await p.waitForTimeout(800);
ok('stopping queues it with the message', /مقطع صوتي/.test(await body()), (await body()).slice(0,120));
await p.click('[data-thread-form] button[type=submit]'); await p.waitForTimeout(800);
const sent = await p.evaluate(() => Store.filesOf(localStorage.getItem('rid2'), 'parties'));
ok('it is sent as an attachment', sent.length === 1, JSON.stringify(sent).slice(0,140));
ok('carrying an audio type', /^audio\//.test(sent[0] && sent[0].mime || ''), sent[0] && sent[0].mime);
ok('and it plays where it was sent', (await p.$('[data-file-audio]')) !== null);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
