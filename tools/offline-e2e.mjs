import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
await ctx.route('**://fonts.*/**', r=>r.abort());
await ctx.route('**esm.sh**', r=>r.abort());   // the CDN is unreachable
const p = await ctx.newPage();
const U='http://localhost:8099/';
await p.goto(U+'index.html'); await p.waitForTimeout(1500);
const bar = await p.$('[data-offline]');
ok('the site says it could not load your data', bar !== null);
const t = await p.$eval('[data-offline]', e=>e.innerText).catch(()=>'');
ok('in words, not a console line', /تعذّر الوصول/.test(t), t.slice(0,60));
ok('with a way to retry', await p.$('[data-offline-retry]') !== null);
ok('and the page underneath still renders',
   (await p.$eval('#main', e=>e.textContent.trim().length)) > 20);
ok('shown once, not once per failed call',
   (await p.$$('[data-offline]')).length === 1);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
