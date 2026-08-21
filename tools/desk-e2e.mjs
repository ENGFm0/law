/* ==========================================================================
   The desk: the dashboard, the four piles, and reading a case from the seat
   of the person who lived it.

   Deciding an objection is the one job on this platform that needs somebody
   else's whole screen — what the client sent, what the lawyer answered, what
   the lawyer and the trainee said about it out of earshot, and the recording
   of the call all three of them remember differently. So the desk does not
   get a summary: it gets the conversation itself, laid out as its owner has
   it, and the platform's own copy of the call beside it.

       node tools/desk-e2e.mjs
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
const go = async where => { await p.goto(U+where); await p.waitForTimeout(500); };

await p.goto(U+'index.html');
await p.evaluate(() => localStorage.setItem('sanad.session.user','u-staff'));

console.log('— THE OVERVIEW IS DRAWN, NOT LISTED —');
await go('admin.html?tab=overview');
ok('the period has a shape', (await p.$$('.chart__bar')).length > 0);
ok('the tallest bar is named, so the bars are a measurement',
   (await p.$('.chart__top')) !== null);
ok('where the money went is a ring', (await p.$$('.chart-donut__arc')).length >= 3);
ok('with the parts named beside it', (await p.$$('.chart-keys__item')).length >= 3);
ok('the caseload is one bar cut into piles', (await p.$$('.chart-split__part')).length >= 2);
ok('and who delivers most is ranked', (await p.$$('.chart-rows__row')).length > 0);
ok('a name in the chart is a way into their file',
   (await p.$eval('.chart-rows__name a', e=>e.getAttribute('href')) || '').indexOf('who=') !== -1);

const oneMonth = await p.$eval('.chart__top', e=>e.innerText);
await p.click('[data-months="12"]'); await p.waitForTimeout(400);
ok('a longer window is a different chart',
   (await p.$$('.chart__col')).length === 12, (await p.$$('.chart__col')).length);
ok('and a different scale with it',
   (await p.$eval('.chart__top', e=>e.innerText)) !== oneMonth ||
   (await p.$$('.chart__col')).length === 12);
await p.click('[data-months="1"]'); await p.waitForTimeout(300);
ok('a month is four weeks of it', (await p.$$('.chart__col')).length === 4);

console.log('— FOUR PILES, AND A REQUEST IS IN ONE OF THEM —');
await go('admin.html?tab=requests');
const piles = await p.$$eval('[data-pile]', ns => ns.map(n => n.getAttribute('data-pile')));
ok('running, booked, finished, objections', piles.join(',') === 'live,booked,past,disputed', piles.join(','));
const counted = async pile => {
  await p.click(`[data-pile="${pile}"]`); await p.waitForTimeout(350);
  return (await p.$$('[data-case]')).length;
};
const live = await counted('live'), booked = await counted('booked'), past = await counted('past');
ok('each pile has its own cases', live > 0 && booked > 0 && past > 0,
   JSON.stringify({live, booked, past}));
const shown = await p.$eval('[data-pile="past"] .pill-tab__n', e=>e.innerText);
ok('and the tab says how many before you open it',
   String(past) === shown.replace(/[^\d]/g,''), shown + ' vs ' + past);
const ids = async pile => {
  await p.click(`[data-pile="${pile}"]`); await p.waitForTimeout(300);
  return p.$$eval('[data-case]', ns => ns.map(n => n.getAttribute('data-case')));
};
const l = await ids('live'), b2 = await ids('booked');
ok('nothing is in two piles at once', !l.some(x => b2.indexOf(x) !== -1));
ok('every case carries its reference', /SND-/.test(await body()), (await body()).slice(0,120));

console.log('— AN OBJECTION PUTS ITSELF IN FRONT OF THE DESK —');
await p.evaluate(() => {
  Store.setRequest('r-11', { status:'delivered', body:'المذكرة', assignedTo:'u-jaid', internShare:35 });
  Store.openDispute({ requestId:'r-11', byId:'u-munira', reason:'ناقص المراجع' });
});
await go('admin.html?tab=requests');
ok('the desk opens on the objections',
   await p.$eval('[data-pile="disputed"]', e=>e.classList.contains('is-active')));
ok('with the objection in it', /ناقص المراجع/.test(await body()));
ok('and its own number on it', /OBJ-|#/.test(await body()));

console.log('— AND THE CONVERSATION IS CALLED UP, NOT COPIED —');
await p.evaluate(() => {
  Store.sendMessage({ requestId:'r-11', authorId:'u-munira', audience:'parties',
                      body:'البند الخامس هو المشكلة' });
  Store.sendMessage({ requestId:'r-11', authorId:'u-ahmed', audience:'parties',
                      body:'وصلني، أراجعه اليوم' });
  Store.sendMessage({ requestId:'r-11', authorId:'u-ahmed', audience:'internal',
                      body:'راجع الاختصاص قبل المذكرة' });
  Store.sendMessage({ requestId:'r-11', authorId:'u-jaid', audience:'internal',
                      body:'تمام، أرسلها الليلة' });
});
await go('admin.html?tab=requests&pile=disputed');
await p.click('[data-case="r-11"]'); await p.waitForTimeout(400);
ok('every seat on the case is offered', (await p.$$('[data-seat]')).length === 4,
   (await p.$$('[data-seat]')).length);
ok('including the platform’s own', (await p.$('[data-seat="platform"]')) !== null);

await p.click('[data-seat="u-munira"]'); await p.waitForTimeout(400);
let t = await body();
ok('the client’s seat shows what the client sent', /البند الخامس/.test(t));
// The desk's own record below still carries everything — that is its job.
// What is being checked is the seat: the client's conversation is the
// client's, and the note about the forum was never in it.
ok('and never the note they were not in',
   !/راجع الاختصاص/.test(await p.$eval('[data-thread][data-as="u-munira"]', e=>e.innerText)));
ok('with their own words marked as theirs',
   await p.$eval('[data-thread][data-as="u-munira"] .bubble--mine', e=>/البند الخامس/.test(e.innerText)));

await p.click('[data-seat="u-ahmed"]'); await p.waitForTimeout(400);
t = await body();
ok('the lawyer’s seat has both conversations', /البند الخامس/.test(t) && /راجع الاختصاص/.test(t));
ok('two threads, not one merged transcript', (await p.$$('[data-thread]')).length === 2);
ok('and it is the lawyer’s own words that read as theirs',
   await p.$$eval('[data-thread][data-as="u-ahmed"] .bubble--mine',
                  ns => ns.map(n=>n.innerText).join(' ')).then(s => /أراجعه اليوم/.test(s) && !/البند الخامس/.test(s)));

await p.click('[data-seat="u-jaid"]'); await p.waitForTimeout(400);
ok('the trainee’s seat is the trainee’s',
   await p.$$eval('[data-thread][data-as="u-jaid"] .bubble--mine',
                  ns => ns.map(n=>n.innerText).join(' ')).then(s => /أرسلها الليلة/.test(s)));
ok('and they were handed the client’s side too', /البند الخامس/.test(await body()));
ok('none of it is presented as a copy', /لا نسخة عنها/.test(await body()));

console.log('— THE PLATFORM’S COPY OF THE CALL IS PLAYABLE AT THE DESK —');
// Written from the page that will show it: demo mode holds attachment bytes
// in the tab, so a reload between writing the file and opening it would lose
// exactly what is being checked.
await p.evaluate(() => {
  const wav = new Uint8Array(44); wav.set([82,73,70,70], 0); wav.set([87,65,86,69], 8);
  const file = new File([wav], 'مكالمة صوتية ٩٠ ثانية.webm', { type:'audio/webm' });
  const m = Store.sendMessage({ requestId:'r-11', authorId:'u-ahmed', audience:'staff',
                                body:'هذا تسجيل المكالمة.' });
  Store.attachFile({ requestId:'r-11', messageId:m.id, audience:'staff', authorId:'u-ahmed',
                     name:'مكالمة صوتية ٩٠ ثانية.webm', size:file.size, mime:'audio/webm',
                     kind:'call', seconds:90, file:file });
});
await p.click('[data-seat="platform"]'); await p.waitForTimeout(500);
t = await body();
ok('the desk is told what this copy is', /لا يراه العميل ولا المحامي/.test(t), t.slice(0,200));
ok('the recording is there', /هذا تسجيل المكالمة/.test(t));
ok('with a player on it', (await p.$('[data-file-audio]')) !== null);
ok('pointed at the recording itself',
   /^blob:/.test(await p.$eval('[data-file-audio]', e => e.getAttribute('src') || '')));
await p.click('[data-seat="u-munira"]'); await p.waitForTimeout(400);
ok('and the client’s seat has no sign of it', !/هذا تسجيل المكالمة/.test(await body()));

console.log('— AND A FILE AT THE DESK OPENS —');
// Opening a file is not a property of being able to write one: the desk reads
// somebody else's case and has no composer anywhere on the page.
await p.evaluate(() => {
  const file = new File([new Uint8Array([37,80,68,70])], 'العقد.pdf', { type:'application/pdf' });
  const m = Store.sendMessage({ requestId:'r-11', authorId:'u-munira', audience:'parties',
                                body:'مرفق العقد' });
  Store.attachFile({ requestId:'r-11', messageId:m.id, audience:'parties', authorId:'u-munira',
                     name:'العقد.pdf', size:file.size, mime:'application/pdf', file:file });
});
await p.waitForTimeout(500);
ok('the file is on the client’s side of the case', /العقد\.pdf/.test(await body()));
ok('and it carries the link it opens through',
   /^blob:/.test(await p.$eval('.file-chip[data-file]', e => e.getAttribute('data-href') || '')),
   await p.$eval('.file-chip[data-file]', e => e.outerHTML.slice(0, 160)));
ok('with the page listening for the click',
   (await p.$('[data-files-wired]')) !== null);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
