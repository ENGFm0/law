/* ==========================================================================
   The conversation on a case.

   A client uploads the contract and says what is wrong with it; the lawyer
   answers; the trainee the work was routed to talks to the lawyer in a thread
   the client cannot see. All three of those are the same table and one column
   apart, which is exactly why the separation is worth a test.

       node tools/thread-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,140)+'>':''));} };
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
  await p.goto(U+page); await p.waitForTimeout(400);
};
await p.goto(U+'index.html');

/* A case the client and the lawyer are both on, routed to a trainee. */
await p.evaluate(() => {
  Store.resetWork();
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'text', title:{ar:'مراجعة عقد عمل',en:'Employment contract'},
    brief:{ar:'عقد فيه بند جزائي',en:'A contract with a penalty clause'},
    price:250, status:'in_progress', hours:4 });
  Store.setRequest(r.id, { status:'with_intern', assignedTo:'u-jaid', internShare:40 });
  localStorage.setItem('rid', r.id);
});

console.log('— THE CLIENT WRITES, AND ATTACHES —');
await open('requests.html', 'u-fahad');
const rid = await p.evaluate(() => localStorage.getItem('rid'));
await p.click(`[data-detail="${rid}"]`); await p.waitForTimeout(300);
ok('the thread is on the case', (await p.$('[data-thread]')) !== null);
ok('and it starts empty, and says so', /لا رسائل بعد/.test(await body()));
await p.fill('[data-thread-body]', 'مرفق العقد، البند الخامس هو المشكلة');
await p.setInputFiles('[data-thread-file]', {
  name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
await p.waitForTimeout(200);
ok('the chosen file waits for the message', /contract\.pdf/.test(await body()));
await p.click('[data-thread-form] button[type=submit]'); await p.waitForTimeout(500);
const t1 = await body();
ok('the message is in the thread', /البند الخامس/.test(t1));
ok('with the file on it', /contract\.pdf/.test(t1));
ok('and the composer is empty again',
   (await p.$eval('[data-thread-body]', e=>e.value)) === '');
ok('one message, not one per file',
   (await p.evaluate(() => Store.messages(localStorage.getItem('rid'), 'parties').length)) === 1);
ok('the file is recorded against it',
   (await p.evaluate(() => Store.filesOf(localStorage.getItem('rid'), 'parties').length)) === 1);

console.log('— THE LAWYER SEES IT AND ANSWERS —');
await open('requests.html', 'u-ahmed');
await p.click(`[data-open="${rid}"]`); await p.waitForTimeout(500);
const t2 = await body();
ok('the client’s message is on the lawyer’s screen', /البند الخامس/.test(t2), t2.slice(0,120));
ok('and the file with it', /contract\.pdf/.test(t2));
ok('with a tab for each conversation', /مع العميل/.test(t2) && /مع المتدرب/.test(t2));

console.log('— AND A SECOND CONVERSATION THE CLIENT IS NOT IN —');
await p.click('[data-thread-side="internal"]'); await p.waitForTimeout(400);
ok('the internal thread says who can read it', /لا يراها العميل/.test(await body()));
await p.fill('[data-thread-body]', 'راجع الاختصاص قبل ما تكتب المذكرة');
await p.click('[data-thread-form] button[type=submit]'); await p.waitForTimeout(400);
ok('the note is written', /راجع الاختصاص/.test(await body()));
ok('into the internal thread',
   (await p.evaluate(() => Store.messages(localStorage.getItem('rid'), 'internal').length)) === 1);
ok('and not into the client’s',
   (await p.evaluate(() => Store.messages(localStorage.getItem('rid'), 'parties').length)) === 1);

console.log('— THE TRAINEE IS IN THAT ONE —');
await open('requests.html', 'u-jaid');
await p.click(`[data-task-open="${rid}"]`); await p.waitForTimeout(500);
const t3 = await body();
ok('the trainee reads the supervisor’s note', /راجع الاختصاص/.test(t3), t3.slice(0,120));
// Handed a case, they are handed the case: what the client asked for and
// what has already been said to them, read-only, so they can write the thing
// they were asked to write.
ok('and what the client actually sent', /البند الخامس/.test(t3), t3.slice(0,160));
ok('marked as theirs to read, not to answer', /للاطلاع/.test(t3));
ok('with the reference on it', /SND-/.test(t3), t3.match(/SND-[^\s]*/));
ok('and who is on the case', /العميل:/.test(t3) && /المحامي:/.test(t3));

console.log('— THE CLIENT NEVER SEES THE INTERNAL ONE —');
await open('requests.html', 'u-fahad');
await p.click(`[data-detail="${rid}"]`); await p.waitForTimeout(300);
const t4 = await body();
ok('their own message is there', /البند الخامس/.test(t4));
ok('the internal note is not', !/راجع الاختصاص/.test(t4));
ok('and no tab offers it', !/مع المتدرب/.test(t4));

console.log('— THE WAY IN IS ON THE ROW —');
await open('requests.html', 'u-fahad');
const row = await body();
ok('the conversation has its own button', /المحادثة/.test(row), row.slice(0, 120));
ok('saying how much is in it', /المحادثة\s*[٠-٩0-9]/.test(row), row.match(/المحادثة[^\n]*/));
// The card's own button — the notice at the top of the page points at the
// same request and would be the first match.
await p.click(`.case__actions [data-detail="${rid}"]`); await p.waitForTimeout(500);
ok('and it opens straight onto the thread', (await p.$('[data-thread]')) !== null);
ok('with the cursor in it',
   await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-thread-body')));

console.log('— A CALL IS NOT THE WHOLE OF A CONSULTATION —');
await p.evaluate(() => {
  const rid = localStorage.getItem('rid');
  Store.setRequest(rid, { assignedTo: null, status: 'in_progress' });
  const r = Models.request(rid);
  r.channel = 'voice';
});
await open('requests.html', 'u-fahad');
await p.goto(U + 'call.html?id=' + rid); await p.waitForTimeout(600);
const t5 = await body();
ok('the thread is beside the call', (await p.$('[data-thread]')) !== null, t5.slice(0, 90));
ok('with what was already said in it', /البند الخامس/.test(t5));
await p.fill('[data-thread-body]', 'أرسلت لك صورة الإشعار');
await p.click('[data-thread-form] button[type=submit]'); await p.waitForTimeout(400);
ok('and something can be sent during it', /صورة الإشعار/.test(await body()));
ok('into the same thread as the case',
   (await p.evaluate(() => Store.messages(localStorage.getItem('rid'), 'parties').length)) === 2);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
