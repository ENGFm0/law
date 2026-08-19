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
const signedIn = u => p.evaluate(x=>{ if(x) localStorage.setItem('sanad.session.user',x);
  else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, u);
const text = () => p.$eval('#main', e=>e.innerText.trim());

console.log('— A GUEST SEES THE ORDINARY PAGES —');
await p.goto(U+'index.html'); await signedIn(null);
await p.goto(U+'signup.html'); await p.waitForTimeout(500);
ok('sign-up asks who you are first', /من أنت/.test(await text()));
ok('and no signed-in panel', await p.$eval('[data-signed-in-panel]', e=>e.hidden));

console.log('— THE ROLE COMES BEFORE THE DOOR —');
ok('no Google button on the role step', await p.$('[data-google]') === null);
await p.click('[data-pick="lawyer"]'); await p.click('[data-next]'); await p.waitForTimeout(400);
const g = await p.$eval('[data-google]', e=>e.textContent.trim()).catch(()=>null);
ok('it appears once the role is chosen', g !== null);
ok('with its label, not a bare icon', /Google/.test(g||''), g);

console.log('— A SIGNED-IN VISITOR IS NOT SIGNING UP —');
await p.goto(U+'index.html'); await signedIn('u-fahad');
await p.goto(U+'signup.html'); await p.waitForTimeout(600);
let t = await text();
ok('the wizard is replaced', !/من أنت/.test(t), t.slice(0,60));
ok('it says who you are', /مسجّل الدخول|فهد/.test(t), t.slice(0,80));
ok('with a way to your account', await p.$('a[href="account.html"]') !== null);
ok('and a way out', await p.$('[data-action="sign-out"]') !== null);

await p.goto(U+'login.html'); await p.waitForTimeout(600);
ok('the sign-in page says the same', /مسجّل الدخول/.test(await text()));

console.log('— AND THE WAY OUT WORKS —');
await p.click('[data-action="sign-out"]'); await p.waitForTimeout(700);
ok('signing out clears the session',
   await p.evaluate(()=>localStorage.getItem('sanad.session.user')) === null);
ok('and lands on the sign-in page', p.url().includes('login.html'));
await p.waitForTimeout(300);
ok('which is now the ordinary one', !/مسجّل الدخول/.test(await text()));

console.log('— FINISHING AN ACCOUNT IS LEFT ALONE —');
await p.goto(U+'index.html'); await signedIn('u-fahad');
await p.goto(U+'signup.html?complete=1'); await p.waitForTimeout(600);
ok('the completion wizard still runs', /من أنت/.test(await text()));
ok('with no "already signed in" in the way',
   await p.$eval('[data-signed-in-panel]', e=>e.hidden));

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
