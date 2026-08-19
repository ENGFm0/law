import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';

console.log('— A STALE PREFERENCE NO LONGER OUTRANKS THE ACCOUNT —');
await p.goto(U+'index.html');
// Exactly the state the owner was in: signed in as staff, but the browser
// still holding the role they had before the grant.
await p.evaluate(() => {
  localStorage.setItem('sanad.session.user','u-staff');
  localStorage.setItem('sanad.activeRole','client');
});
await p.goto(U+'admin.html'); await p.waitForTimeout(600);
const t = await p.$eval('#main', e=>e.innerText);
ok('the desk opens', /مكتب الإدارة/.test(t), t.slice(0,70));
ok('rather than turning them away', !/هذه الصفحة لإدارة المنصة/.test(t));
ok('the queue is there', await p.$('[data-approve]') !== null);
ok('and the stale key is cleared, not just ignored',
   await p.evaluate(()=>localStorage.getItem('sanad.activeRole')) === null);

console.log('— THE NAVIGATION AGREES —');
ok('the desk has its tab',
   (await p.$$eval('.tabbar__link', ns=>ns.map(n=>n.getAttribute('href')))).includes('admin.html'));

console.log('— AN ACCOUNT THAT IS BOTH FALLS BACK TO THE DESK —');
await p.goto(U+'index.html');
await p.evaluate(() => {
  // roles hold staff, but active_role points at something they do not have
  const raw = JSON.parse(localStorage.getItem('sanad.accounts') || '[]');
  raw.push({ id:'u-both', roles:['client','staff'], activeRole:'lawyer',
             name:{ar:'مزدوج',en:'Both'}, email:'both@t.sa', status:'verified' });
  localStorage.setItem('sanad.accounts', JSON.stringify(raw));
  localStorage.setItem('sanad.session.user','u-both');
});
await p.goto(U+'admin.html'); await p.waitForTimeout(600);
ok('staff wins over an incidental client role',
   /مكتب الإدارة/.test(await p.$eval('#main', e=>e.innerText)));

console.log('— AND NOBODY ELSE GETS IN —');
await p.goto(U+'index.html');
await p.evaluate(()=>{ localStorage.setItem('sanad.session.user','u-fahad');
                       localStorage.setItem('sanad.activeRole','staff'); });
await p.goto(U+'admin.html'); await p.waitForTimeout(600);
ok('claiming the role in your browser does not grant it',
   /هذه الصفحة لإدارة المنصة/.test(await p.$eval('#main', e=>e.innerText)));
ok('and no queue is rendered', await p.$('[data-approve]') === null);

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
