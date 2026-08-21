/* ==========================================================================
   Two people on a call, and what is left of it afterwards.

   A call is the one part of a consultation that leaves nothing behind unless
   something is written down at the time. So: exactly one side records, both
   sides are told while it runs, the parties choose whether a copy stays on
   their request — and the platform keeps its own copy either way, for the day
   one of them says the call went differently.

   Two pages in one browser: the local signalling transport is a
   BroadcastChannel, so the two tabs really do negotiate and really do carry
   media (Chromium's fake devices). The session lives in localStorage, which
   both tabs share, so the second one is told who it is before any script runs.

       node tools/call-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,140)+'>':''));} };
const U='http://localhost:8099/';

const ctx = await b.newContext({
  viewport:{width:1100,height:900}, permissions:['microphone','camera'] });
await ctx.route('**://fonts.*/**', r=>r.abort());
await ctx.route('**esm.sh**', r=>r.abort());
/* Two tabs, not two devices: the local transport is the one being exercised,
   so the project's Realtime credentials are taken off the page. */
const cfg = readFileSync('assets/js/config.js','utf8')
  .replace('backend: "supabase"','backend: "browser"')
  .replace(/url: "https:\/\/[^"]*"/, 'url: ""');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));

/* The lawyer's tab has to be a different person from the client's tab while
   sharing an origin with it. One key is answered from the tab itself; every
   other read is the real localStorage. */
async function tab(as) {
  const p = await ctx.newPage();
  p.on('pageerror', e=>errs.push(e.message));
  if (as) await p.addInitScript(id => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (k === 'sanad.session.user' && this === window.localStorage) return id;
      return real.call(this, k);
    };
  }, as);
  await p.goto(U+'index.html'); await p.waitForTimeout(400);
  return p;
}
const text = p => p.$eval('#main', e=>e.innerText);
/* Media actually arriving, rather than a connection state: Chromium leaves a
   remote track muted until the first frame lands, which is the moment there
   is anything to record. */
const flowing = p => p.waitForFunction(() => {
  const v = document.querySelector('video[data-remote]');
  return !!(v && v.srcObject && v.srcObject.getTracks().some(t => !t.muted));
}, null, { timeout: 20000 });

/* ---------- a voice consultation, on both screens ---------- */
const client = await tab(null);
await client.evaluate(() => {
  Store.resetWork();
  localStorage.setItem('sanad.session.user','u-fahad');
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'voice', title:{ar:'استشارة هاتفية',en:'A call'}, brief:{ar:'ب',en:'b'},
    price:250, status:'in_progress', hours:4 });
  localStorage.setItem('rid', r.id);
});
const rid  = await client.evaluate(()=>localStorage.getItem('rid'));
const work = await client.evaluate(()=>sessionStorage.getItem('sanad.work'));

const lawyer = await tab('u-ahmed');
await lawyer.evaluate(w => sessionStorage.setItem('sanad.work', w), work);

console.log('— A VOICE CALL DOES NOT ASK FOR A CAMERA —');
await client.goto(U+'call.html?id='+rid); await client.waitForTimeout(500);
await lawyer.goto(U+'call.html?id='+rid); await lawyer.waitForTimeout(500);
ok('both sides are let in', (await client.$('[data-join]')) !== null &&
   (await lawyer.$('[data-join]')) !== null, await text(client));
await client.click('[data-join]'); await client.waitForTimeout(600);
ok('the client is live', (await client.$('.call-stage')) !== null);
ok('and was asked for a microphone only',
   await client.evaluate(()=>{
     const v = document.querySelector('video[data-local]');
     return !!(v && v.srcObject && v.srcObject.getVideoTracks().length === 0);
   }));
ok('so no camera button is offered', (await client.$('[data-cam]')) === null);

console.log('— AND WHEN THE OTHER SIDE JOINS, IT IS RECORDED, OUT LOUD —');
await lawyer.click('[data-join]');
await client.waitForSelector('.call-taping', { timeout: 15000 });
await lawyer.waitForSelector('.call-taping', { timeout: 15000 });
ok('the side holding the tape says so', /تُسجَّل هذه المكالمة/.test(await text(lawyer)));
ok('and so does the side that is not', /تُسجَّل هذه المكالمة/.test(await text(client)));
ok('the two are actually connected',
   await lawyer.$eval('.call-stage', e=>e.getAttribute('data-conn')) === 'connected' ||
   await lawyer.evaluate(()=>!!document.querySelector('video[data-remote]')),
   await lawyer.$eval('.call-stage', e=>e.getAttribute('data-conn')));
const nothingYet = await lawyer.evaluate(id => Store.filesOf(id,'staff').length, rid);
ok('and nothing is filed while it is still running', nothingYet === 0, nothingYet);

console.log('— THE PLATFORM’S COPY IS NOT A CHOICE —');
await lawyer.waitForTimeout(3000);           // long enough to be worth keeping
await lawyer.click('[data-hang]');
await lawyer.waitForSelector('[data-keep-call]', { timeout: 15000 });
const kept0 = await lawyer.evaluate(id => Store.filesOf(id,'staff').map(a=>
  ({kind:a.kind, seconds:a.seconds, mime:a.mime, size:a.size, name:a.name})), rid);
ok('the desk’s copy is filed the moment the call ends', kept0.length === 1, JSON.stringify(kept0));
ok('marked as a call, with its length on it',
   kept0[0] && kept0[0].kind === 'call' && kept0[0].seconds >= 2, JSON.stringify(kept0[0]));
ok('and it has something in it', kept0[0] && kept0[0].size > 0, kept0[0] && kept0[0].size);
ok('named in words, not in an id', kept0[0] && /مكالمة صوتية/.test(kept0[0].name), kept0[0] && kept0[0].name);
ok('nothing is on the request yet',
   (await lawyer.evaluate(id => Store.filesOf(id,'parties').length, rid)) === 0);

console.log('— THE PARTIES’ COPY IS —');
const asked = await text(lawyer);
ok('the question is asked once the call is over', /نحتفظ بالتسجيل في الطلب/.test(asked), asked.slice(0,200));
ok('with the length in the question', /مدة التسجيل/.test(asked));
ok('and the platform’s copy said in the same breath', /تحتفظ المنصة بنسخة على كل حال/.test(asked));
ok('the other side is not asked — it did not record',
   (await client.$('[data-keep-call]')) === null);
ok('and it knows the call ended', /أنهى الطرف الآخر|انتهت المكالمة/.test(await text(client)), (await text(client)).slice(0,120));

await lawyer.click('[data-keep-call]'); await lawyer.waitForTimeout(400);
const kept1 = await lawyer.evaluate(id => Store.filesOf(id,'parties').map(a=>({kind:a.kind,seconds:a.seconds})), rid);
ok('keeping it puts it on the request', kept1.length === 1, JSON.stringify(kept1));
ok('as a call, not as a nameless file', kept1[0] && kept1[0].kind === 'call');
ok('and the desk still has exactly one', (await lawyer.evaluate(id=>Store.filesOf(id,'staff').length, rid)) === 1);
ok('the question is gone once answered', (await lawyer.$('[data-keep-call]')) === null);

console.log('— A KEPT CALL IS SOMETHING YOU CAN PLAY —');
const playable = await lawyer.evaluate(async id => {
  const a = Store.filesOf(id, 'parties')[0];
  const url = await Store.fileUrl(a);
  return { url: String(url || ''), audio: /^audio\//.test(a.mime || '') };
}, rid);
ok('the recording has a link to open', /^blob:/.test(playable.url), JSON.stringify(playable));
ok('and a voice call is saved as sound, not as a black rectangle',
   playable.audio, JSON.stringify(playable));
ok('it is a line in the conversation, not a loose file',
   (await lawyer.evaluate(id => Store.messages(id,'parties').length, rid)) === 1);
ok('with the recording hanging off that line',
   (await lawyer.evaluate(id => {
     const m = Store.messages(id,'parties')[0];
     return Store.attachmentsOn(m.id).length; }, rid)) === 1);
await lawyer.waitForTimeout(400);
ok('and a player on it, right there in the thread',
   (await lawyer.$('[data-file-audio]')) !== null, await text(lawyer));
ok('pointed at the recording itself',
   /^blob:/.test(await lawyer.$eval('[data-file-audio]', e => e.getAttribute('src') || '')));

console.log('— AND "NO NEED" MEANS NO NEED, NOT NO RECORD —');
await client.goto(U+'call.html?id='+rid); await client.waitForTimeout(400);
await lawyer.goto(U+'call.html?id='+rid); await lawyer.waitForTimeout(400);
await client.click('[data-join]'); await client.waitForTimeout(400);
await lawyer.click('[data-join]');
await lawyer.waitForSelector('.call-taping', { timeout: 15000 });
await flowing(lawyer);
await lawyer.waitForTimeout(3000);
await lawyer.click('[data-hang]');
await lawyer.waitForSelector('[data-drop-call]', { timeout: 15000 });
await lawyer.click('[data-drop-call]'); await lawyer.waitForTimeout(400);
const after = await lawyer.evaluate(id => ({
  parties: Store.filesOf(id,'parties').length, staff: Store.filesOf(id,'staff').length }), rid);
ok('the parties keep only the one they asked for', after.parties === 1, JSON.stringify(after));
ok('the desk keeps both', after.staff === 2, JSON.stringify(after));
ok('and it is said, rather than left to be assumed',
   /نسخة المنصة محفوظة/.test(await lawyer.$eval('body', e=>e.innerText)));

console.log('— AND A RELOAD SAYS SO, RATHER THAN THROWING —');
// Demo mode holds the bytes in the tab and nowhere else. The record of the
// call survives a reload; the recording itself does not, and asking for it
// has to answer "gone" rather than blow up the page.
await lawyer.goto(U+'call.html?id='+rid); await lawyer.waitForTimeout(400);
const stale = await lawyer.evaluate(async id => {
  const a = Store.filesOf(id, 'parties')[0];
  return { still: !!a, url: await Store.fileUrl(a) };
}, rid);
ok('the recording is still on the request', stale.still, JSON.stringify(stale));
ok('and the missing bytes are answered, not thrown', stale.url === null, JSON.stringify(stale));

console.log('— A VIDEO CALL IS THE SAME CALL, WITH A PICTURE —');
await client.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    channel:'video', title:{ar:'جلسة بالفيديو',en:'Video'}, brief:{ar:'ب',en:'b'},
    price:400, status:'in_progress', hours:4 });
  localStorage.setItem('rid2', r.id);
});
const rid2 = await client.evaluate(()=>localStorage.getItem('rid2'));
const work2 = await client.evaluate(()=>sessionStorage.getItem('sanad.work'));
await lawyer.evaluate(w => sessionStorage.setItem('sanad.work', w), work2);
await client.goto(U+'call.html?id='+rid2); await client.waitForTimeout(400);
await lawyer.goto(U+'call.html?id='+rid2); await lawyer.waitForTimeout(400);
await client.click('[data-join]'); await client.waitForTimeout(500);
ok('the camera is offered when the client ordered video',
   (await client.$('[data-cam]')) !== null);
ok('and it is actually on',
   await client.evaluate(()=>{ const v=document.querySelector('video[data-local]');
     return !!(v && v.srcObject && v.srcObject.getVideoTracks().length === 1); }));
await lawyer.click('[data-join]');
await lawyer.waitForSelector('.call-taping', { timeout: 15000 });
await flowing(lawyer);
await lawyer.waitForTimeout(3000);
await lawyer.click('[data-hang]');
await lawyer.waitForSelector('[data-keep-call]', { timeout: 15000 });
await lawyer.click('[data-keep-call]'); await lawyer.waitForTimeout(400);
const vid = await lawyer.evaluate(async id => {
  const a = Store.filesOf(id, 'parties')[0];
  return { name: a.name, mime: a.mime, kind: a.kind, size: a.size,
           url: String(await Store.fileUrl(a) || '') };
}, rid2);
ok('what was kept is a video, not a voice note', /^video\//.test(vid.mime), JSON.stringify(vid));
ok('and it says so in its name', /مكالمة فيديو/.test(vid.name), vid.name);
ok('with something to watch', vid.size > 0 && /^blob:/.test(vid.url), JSON.stringify(vid));
ok('and the desk has its own copy of this one too',
   (await lawyer.evaluate(id=>Store.filesOf(id,'staff').length, rid2)) === 1);
await lawyer.waitForTimeout(400);
ok('with a player in the thread that plays pictures',
   (await lawyer.$('[data-file-video]')) !== null);
ok('pointed at the recording', /^blob:/.test(
   await lawyer.$eval('[data-file-video]', e => e.getAttribute('src') || '')));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
