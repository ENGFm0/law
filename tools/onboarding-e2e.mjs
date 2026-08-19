import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:950} });
await ctx.route('**://fonts.*/**', r=>r.abort());
// Run the wizard against the browser backend so a session exists to test with;
// the completion path itself is backend-agnostic.
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body: cfg }));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-fahad'));

console.log('— ORDINARY SIGN-UP IS UNCHANGED —');
await p.goto(U+'signup.html'); await p.waitForTimeout(500);
ok('the Google door is on the first step', await p.$('[data-google]') !== null);
await p.click('[data-pick="client"]'); await p.click('[data-next]'); await p.waitForTimeout(300);
ok('email is asked for', await p.$eval('[name="email"]', e=>!e.closest('.field').hidden));
ok('and a password', await p.$eval('[name="password"]', e=>!e.closest('.field').hidden));

console.log('— FINISHING AN ACCOUNT GOOGLE MADE —');
await p.goto(U+'signup.html?complete=1'); await p.waitForTimeout(600);
const lead = await p.$eval('[data-signup-head]', e=>e.textContent.trim());
ok('the page says what is left to do', /دخلت بحساب قوقل/.test(lead), lead);
ok('no Google button — they came through it', await p.$('[data-google]') === null);
ok('the role picker is still the first question', await p.$('[data-pick="lawyer"]') !== null);

await p.click('[data-pick="lawyer"]'); await p.click('[data-next]'); await p.waitForTimeout(350);
ok('email is not asked again', await p.$eval('[name="email"]', e=>e.closest('.field').hidden));
ok('nor a password', await p.$eval('[name="password"]', e=>e.closest('.field').hidden));
ok('the name Google gave us is filled in', (await p.$eval('[name="name"]', e=>e.value)).length > 0);
ok('phone and city are still asked', await p.$eval('[name="phone"]', e=>!e.closest('.field').hidden));

console.log('— AND THE WIZARD STILL ASKS A LAWYER FOR A LICENCE —');
await p.fill('[name="phone"]','0501234567');
await p.click('[data-next]'); await p.waitForTimeout(350);
const step3 = await p.$eval('[data-step3-fields]', e=>e.textContent);
ok('step three appears', (await p.$eval('[data-step="3"]', e=>!e.hidden)));
ok('asking for the licence', await p.$('[name="licenceNumber"]') !== null, step3.slice(0,60));
await p.click('[data-next]'); await p.waitForTimeout(300);
ok('an empty licence is refused',
   await p.$eval('[data-signup-error]', e=>!e.hidden));

console.log('— IT FINISHES THE ACCOUNT RATHER THAN OPENING ONE —');
await p.fill('[name="licenceNumber"]','8842');
let calls = await p.evaluate(() => { window.__calls=[];
  window.SB.complete = (id,d)=>{ window.__calls.push({id, role:d.role, phone:d.phone});
                                 return Promise.resolve({ok:true,user:{id:id}}); };
  window.Store.register = () => { window.__calls.push({register:true}); return Promise.resolve({ok:true,user:{}}); };
  return true; });
await p.click('[data-next]'); await p.waitForTimeout(300);
await p.check('[name="terms"]');
await p.click('[data-finish]'); await p.waitForTimeout(500);
calls = await p.evaluate(()=>window.__calls);
ok('complete() was called, not register()', calls.length===1 && !calls[0].register, JSON.stringify(calls));
ok('for the signed-in account', calls[0] && calls[0].id === 'u-fahad');
ok('with the role they picked', calls[0] && calls[0].role === 'lawyer');
ok('and what they typed', calls[0] && calls[0].phone === '0501234567');

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
