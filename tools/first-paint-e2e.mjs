import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,100)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
await ctx.route('**://fonts.*/**', r=>r.abort());
// The library takes its time, exactly as it does over a phone connection.
await ctx.route('**esm.sh**', async r => { await new Promise(s=>setTimeout(s,2500)); r.abort(); });
const p = await ctx.newPage();
const U='http://localhost:8099/';

const me = { id:'u-real', name:{ar:'فهد',en:'Fahad'}, email:'f@t.sa',
             roles:['client','staff'], activeRole:'staff', status:'verified', onboarded:true };

console.log('— A RETURNING VISITOR IS NOT SHOWN THE GUEST SITE FIRST —');
await p.goto(U+'index.html');
await p.evaluate(m => {
  localStorage.setItem('sanad.session.user', m.id);
  localStorage.setItem('sanad.me', JSON.stringify(m));
}, me);

await p.goto(U+'index.html');
// Read it immediately, well before the library could possibly have arrived.
await p.waitForTimeout(250);
let s = await p.evaluate(() => ({
  guest: window.Session.isGuest(),
  role: window.Session.role(),
  name: window.Session.user() ? window.App.tx(window.Session.user().name) : null,
  desk: [...document.querySelectorAll('.tabbar__link')].some(a=>a.getAttribute('href')==='admin.html'),
}));
ok('signed in on the first paint', s.guest === false, JSON.stringify(s));
ok('as the right person', s.name === 'فهد');
ok('with the capacity they were last using', s.role === 'staff');
ok('and the navigation already right', s.desk === true);

console.log('— AND ON EVERY PAGE AFTER, NOT JUST THE FIRST —');
for (const pg of ['requests.html','account.html','admin.html']) {
  await p.goto(U+pg); await p.waitForTimeout(250);
  const g = await p.evaluate(()=>window.Session.isGuest());
  ok(`${pg} opens signed in`, g === false);
}
await p.goto(U+'admin.html'); await p.waitForTimeout(250);
ok('and the desk is open immediately, not after a wait',
   /مكتب الإدارة/.test(await p.$eval('#main', e=>e.innerText)));

console.log('— A SESSION THAT ENDED ELSEWHERE IS NOT REMEMBERED —');
await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.removeItem('sanad.session.user'));
await p.goto(U+'index.html'); await p.waitForTimeout(250);
ok('no session, no remembered person', await p.evaluate(()=>window.Session.isGuest()) === true);
ok('and the stale copy is discarded', await p.evaluate(()=>localStorage.getItem('sanad.me')) === null);

console.log('— SIGNING OUT FORGETS —');
await p.evaluate(m => {
  localStorage.setItem('sanad.session.user', m.id);
  localStorage.setItem('sanad.me', JSON.stringify(m));
}, me);
await p.goto(U+'account.html'); await p.waitForTimeout(300);
await p.click('[data-signout]'); await p.waitForTimeout(600);
ok('nothing is left behind', await p.evaluate(()=>localStorage.getItem('sanad.me')) === null);

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
