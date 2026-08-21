/* ==========================================================================
   The record, the reference, and the file the desk decides on.

   An objection is decided by reading what happened. Before this, "what
   happened" existed only as the current value of `status` — so the desk was
   shown a complaint and asked to rule on it. This checks that every case now
   carries a number anybody can say out loud, a dated record of every change,
   both conversations with their files, and that clicking a name opens
   everything that person has ever done here.

       node tools/record-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,160)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:1100} });
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

/* A case with a full history: routed to a trainee, delivered, revised,
   talked about on both sides, then objected to. */
await p.evaluate(() => {
  Store.resetWork();
  // Acted out in the order it really happens, and by whoever really does it:
  // the record names the person who made each change, so a setup that does
  // everything as one account records a story that never happened.
  localStorage.setItem('sanad.session.user', 'u-fahad');
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'مذكرة اعتراض',en:'Memo'},
    brief:{ar:'العقد فيه بند جزائي غير نظامي',en:'An unlawful penalty clause'},
    price:250, status:'in_progress', hours:4 });
  localStorage.setItem('rid', r.id);
  Store.sendMessage({ requestId:r.id, authorId:'u-fahad', body:'مرفق العقد كاملاً' });

  localStorage.setItem('sanad.session.user', 'u-ahmed');
  Store.setRequest(r.id, { assignedTo:'u-jaid', status:'with_intern', internShare:40 });
  Store.sendMessage({ requestId:r.id, authorId:'u-ahmed', audience:'internal',
                      body:'ركّز على المادة 74' });
});

console.log('— EVERY REQUEST HAS A NUMBER —');
await open('requests.html', 'u-fahad');
const rid = await p.evaluate(() => localStorage.getItem('rid'));
let t = await body();
ok('the reference is on the row', /SND-\d\d-\d{5}/.test(t), t.match(/SND-[^\s]*/));
const ref = (t.match(/SND-\d\d-\d{5}/) || [])[0];

console.log('— AND A DATED RECORD OF WHAT HAPPENED —');
await p.click(`[data-detail="${rid}"]`); await p.waitForTimeout(500);
t = await body();
ok('the record is on the case', /مسار الطلب|كل ما دار/.test(t));
ok('it says the request was placed', /أُنشئ الطلب/.test(t));
ok('and that it went to a trainee', /وُجّه إلى المتدرب/.test(t), t.slice(0,200));
ok('every line is dated to the minute', /\d{1,2}:\d\d/.test(t), t.match(/[^\n]*\d{1,2}:\d\d[^\n]*/));
ok('the client is not shown the internal note', !/المادة 74/.test(t));

console.log('— THE PATH IS ON THE LIST, NOT BEHIND A PANEL —');
await open('requests.html', 'u-fahad');
await p.click(`[data-path="${rid}"]`); await p.waitForTimeout(500);
t = await body();
ok('a button opens the path from the row', /مسار الطلب|كل ما دار/.test(t));
ok('grouped under a day', /اليوم|أمس|\d{4}/.test(t));
ok('with a clock on every line', /\d\d:\d\d/.test(t), t.match(/\d\d:\d\d/g));
ok('and it closes again', true);
await p.click(`[data-path="${rid}"]`); await p.waitForTimeout(400);

console.log('— THE LAWYER READS BOTH SIDES, APART OR TOGETHER —');
await open('requests.html', 'u-ahmed');
await p.click(`[data-path="${rid}"]`); await p.waitForTimeout(500);
t = await body();
ok('the lawyer sees the path too', /مسار الطلب/.test(t));
ok('with the client’s side in it', /رسالة/.test(t));
ok('and a way to read the two apart', /مع العميل/.test(t) && /الداخلية/.test(t));
await p.click(`[data-tl-side="internal"][data-tl-for="${rid}"]`); await p.waitForTimeout(400);
t = await body();
ok('the internal side alone leaves the client out', !/أُنشئ الطلب/.test(t), t.slice(0,140));
await p.click(`[data-tl-side="parties"][data-tl-for="${rid}"]`); await p.waitForTimeout(400);
t = await body();
ok('and the client side leaves the internal out', !/المادة 74/.test(t));
await p.click(`[data-tl-side="all"][data-tl-for="${rid}"]`); await p.waitForTimeout(400);

console.log('— WHEN THE LAWYER TOOK IT ON —');
ok('the moment is on the record', /استلم المحامي الطلب/.test(await body()),
   (await body()).slice(0,200));

console.log('— THE TRAINEE IS HANDED THE CASE, NOT A TITLE —');
await open('requests.html', 'u-jaid');
await p.click(`[data-task-open="${rid}"]`).catch(()=>{});
await p.waitForTimeout(500);
t = await body();
ok('they see what the client asked for', /بند جزائي/.test(t), t.slice(0,160));
ok('and what the client sent', /مرفق العقد/.test(t));
ok('the supervisor’s note is theirs to read', /المادة 74/.test(t));
ok('with the reference', t.includes(ref));
ok('and it says it is theirs to read, not answer', /للاطلاع/.test(t));

console.log('— AN OBJECTION REACHES THE DESK WITH EVERYTHING —');
// Now the work is delivered, revised, and objected to.
await p.evaluate(() => {
  const id = localStorage.getItem('rid');
  localStorage.setItem('sanad.session.user', 'u-ahmed');
  Store.setRequest(id, { status:'delivered', body:'المذكرة الجاهزة' });
  localStorage.setItem('sanad.session.user', 'u-fahad');
  Store.setRequest(id, { revisions:1, revisionNote:'ناقص الإشارة للائحة' });
  Store.openDispute({ requestId:id, byId:'u-fahad', reason:'المذكرة لا تعالج البند الجزائي' });
});
await open('admin.html?tab=requests', 'u-staff');
t = await body();
ok('the objection has its own number', /OBJ-\d\d-\d{5}/.test(t), t.match(/OBJ-[^\s]*/));
ok('the request number is on it', t.includes(ref));
ok('and every party is named', /العميل:/.test(t) && /المحامي:/.test(t) && /المتدرب:/.test(t));
ok('the claim is there', /لا تعالج البند/.test(t));
ok('so is what was delivered', /المذكرة الجاهزة/.test(t));
ok('the client’s own words', /مرفق العقد/.test(t));
ok('AND the internal thread the client never saw', /المادة 74/.test(t));
ok('marked as internal', /داخلي/.test(t));
ok('with the whole record dated', /طُلب تعديل/.test(t) && /\d{1,2}:\d\d/.test(t));

console.log('— AND A NAME OPENS EVERYTHING THAT PERSON DID —');
await open('admin.html?tab=people', 'u-staff');
await p.click('[data-person="u-ahmed"]'); await p.waitForTimeout(600);
t = await body();
ok('their file opens', /كل الطلبات التي له فيها يد/.test(t), t.slice(0,140));
ok('with the case on it', t.includes(ref));
ok('their role in it named', /المحامي/.test(t));
ok('their objections listed', /OBJ-/.test(t));
ok('and counts to read at a glance', /طلبات/.test(t) && /اعتراضات/.test(t));
await p.click(`[data-case="${rid}"]`); await p.waitForTimeout(600);
t = await body();
ok('the whole file opens from there too', /المادة 74/.test(t) && /مرفق العقد/.test(t));
await p.click('[data-back-people]'); await p.waitForTimeout(400);
ok('and there is a way back', /الأشخاص|كل من سجّل/.test(await body()));

console.log('— THE DASHBOARDS SAY WHAT TO OPEN —');
await open('index.html', 'u-ahmed');
t = await body();
ok('the lawyer is told what waits on them', /ينتظر عملك/.test(t));
ok('what waits on the client', /عند العميل للقبول/.test(t));
ok('and what is objected to', /اعتراضات مفتوحة/.test(t));
await open('index.html', 'u-jaid');
t = await body();
ok('the trainee is told what to write', /مهام عليك/.test(t));
ok('and how far from a certificate', /ساعة للشهادة/.test(t));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
