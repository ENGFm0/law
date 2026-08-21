/* ==========================================================================
   The drafting subscription: work that arrives already drafted.

   The queue is the point. A row that says a draft is OWED means work that
   landed overnight is drafted when the lawyer opens the page, rather than
   waiting behind a button somebody has to remember to press — and it means
   the record of what the assistant wrote survives the lawyer editing it.

   Nothing reaches the client before the lawyer approves it. That is the whole
   of what "assisted" means here.

       node tools/drafting-e2e.mjs
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

console.log('— THE TOOL IS SOLD, NOT GIVEN —');
await open('assistant.html', 'u-fahad');
ok('a client never reaches it', /للمحامين/.test(await body()) || (await p.$('[data-req]')) === null);
await open('assistant.html', 'u-sara');
ok('nor does a lawyer without a subscription',
   (await p.$('[data-req]')) === null, (await body()).slice(0,140));

console.log('— AND WORK THAT ARRIVES ON A SUBSCRIBER OWES A DRAFT —');
const rid = await p.evaluate(() => {
  Store.setSubscription('u-ahmed', { plan: 'ai', price: 199, active: true });
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'review',
    doc:'employment', ai:true, title:{ar:'مراجعة عقد عمل',en:'C'},
    brief:{ar:'بند جزائي',en:'b'}, price:250, status:'new', hours:4 });
  return r.id;
});
ok('a job is queued the moment it lands',
   await p.evaluate(id => !!Store.draftFor(id), rid));
ok('against the lawyer who pays for the tool',
   await p.evaluate(id => Store.draftFor(id).lawyerId, rid) === 'u-ahmed');
ok('and it is owed, not written yet',
   await p.evaluate(id => Store.draftFor(id).status, rid) === 'queued');

const other = await p.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-munira', lawyerId:'u-sara', typeId:'review',
    title:{ar:'ع',en:'c'}, brief:{ar:'ب',en:'b'}, price:250, status:'new', hours:4 });
  return r.id;
});
ok('work for a lawyer who does not pay owes nothing',
   await p.evaluate(id => Store.draftFor(id), other) === null);

console.log('— THE PAGE SHOWS THE QUEUE, NOT A GUESS AT IT —');
await open('assistant.html', 'u-ahmed');
let t = await body();
ok('the subscriber gets the workspace', (await p.$('[data-req]')) !== null, t.slice(0,140));
ok('and is told why work arrives drafted', /تُكتب المسودة تلقائياً حين يصلك الطلب/.test(t));
ok('the case is on the queue', /مراجعة عقد عمل/.test(t));

console.log('— WRITING IT FILLS THE ROW, NOT JUST THE SCREEN —');
await p.click('[data-req="' + rid + '"]'); await p.waitForTimeout(1400);
const job = await p.evaluate(id => Store.draftFor(id), rid);
ok('the job is ready', job.status === 'ready', job.status);
ok('with the draft kept on it', !!job.body && job.body.length > 20);
ok('and the moment it was ready', !!job.readyAt);
ok('the lawyer is told', await p.evaluate(() =>
   Store.notices().some(n => n.to === 'u-ahmed' && n.type === 'draft_ready')));
ok('the editor is open on it', (await p.$('[data-draft-body]')) !== null);
ok('carrying what was written',
   (await p.$eval('[data-draft-body]', e => e.value)).length > 20);

console.log('— NOTHING REACHES THE CLIENT BEFORE THE LAWYER SAYS SO —');
ok('the request is not delivered yet',
   await p.evaluate(id => Models.requestState(Models.request(id)).status, rid) === 'drafted');
await open('requests.html', 'u-fahad');
ok('and the client has nothing to read',
   !/إنذار|المذكرة الجاهزة/.test(await body()));

console.log('— ONE CLICK, AND WHAT THEY EDITED IS WHAT IS SENT —');
await open('assistant.html', 'u-ahmed');
await p.click('[data-req="' + rid + '"]'); await p.waitForTimeout(500);
await p.fill('[data-draft-body]', 'راجعتُ العقد. البند الخامس غير نظامي، والمقترح كالتالي…');
await p.click('[data-draft-approve]'); await p.waitForTimeout(600);
ok('approving delivers it',
   await p.evaluate(id => Models.requestState(Models.request(id)).status, rid) === 'delivered');
ok('and what is delivered is the lawyer’s words, not the machine’s',
   /راجعتُ العقد/.test(await p.evaluate(id =>
     Models.requestState(Models.request(id)).body, rid)));
ok('the queue row is marked spent rather than deleted',
   await p.evaluate(id => Store.draftFor(id).status, rid) === 'used');
ok('and still carries what the assistant had written',
   await p.evaluate(id => (Store.draftFor(id).body || '').length, rid) > 20);

await open('requests.html', 'u-fahad');
// The deliverable lives behind the case, not on the row.
await p.click('.case__actions [data-detail="' + rid + '"]').catch(()=>{});
await p.waitForTimeout(400);
ok('now the client has it', /راجعتُ العقد/.test(await body()), (await body()).slice(0,200));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
