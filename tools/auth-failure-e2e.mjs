import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,110)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
await ctx.route('**://fonts.*/**', r=>r.abort());
await ctx.route('**esm.sh**', r=>r.abort());     // no session can be established
const p = await ctx.newPage();
const U='http://localhost:8099/';

console.log('— THE PROVIDER SENDS YOU HOME WITH A REASON —');
await p.goto(U+'index.html?error=access_denied&error_description=Redirect+URL+not+allowed');
await p.waitForTimeout(1600);
const bar = await p.$('[data-authfail]');
ok('the reason is shown, not swallowed', bar !== null);
const t = await p.$eval('[data-authfail]', e=>e.innerText).catch(()=>'');
ok('it names the failure', /لم يكتمل تسجيل الدخول/.test(t), t.slice(0,60));
ok('and repeats what the provider said', /Redirect URL not allowed/.test(t), t.slice(0,90));
ok('with a way to try again', await p.$('[data-authfail] a[href="login.html"]') !== null);
ok('and the leftovers are cleared from the address bar', !/error=/.test(p.url()), p.url());

console.log('— IN THE HASH TOO, WHICH IS WHERE SOME OF THEM PUT IT —');
// A hash-only change is same-document: without this the page never reloads
// and the assertions read the previous case's bar.
await p.goto('about:blank');
await p.goto(U+'index.html#error=server_error&error_description=Database+error');
await p.waitForTimeout(1600);
ok('read from the hash as well', await p.$('[data-authfail]') !== null);
ok('with its message', /Database error/.test(await p.$eval('[data-authfail]', e=>e.innerText)));

console.log('— AN ORDINARY VISIT SAYS NOTHING —');
await p.goto('about:blank');
await p.goto(U+'index.html'); await p.waitForTimeout(1600);
ok('no failure bar on a plain page load', await p.$('[data-authfail]') === null);
ok('the page renders', (await p.$eval('#main', e=>e.textContent.trim().length)) > 20);

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
