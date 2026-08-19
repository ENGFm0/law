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
const vis = sel => p.$eval(sel, e => { const f = e.closest('.field') || e; return !f.hidden; });

console.log('— THE SESSION ARRIVES AFTER THE PAGE DOES —');
await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.removeItem('sanad.session.user'));
// Land on the completion page as a guest, exactly as the browser does on the
// way back from Google before Supabase has restored anything.
await p.goto(U+'signup.html?complete=1'); await p.waitForTimeout(500);
ok('while nobody is signed in it is an ordinary sign-up', await vis('[name="email"]'));
ok('with the "have an account?" link', await p.$eval('[data-signed-in-hide]', e=>!e.hidden));

// …and now the session turns up, a moment later, as it really does.
await p.evaluate(() => {
  localStorage.setItem('sanad.session.user','u-fahad');
  document.dispatchEvent(new CustomEvent('sessionchange'));
});
await p.waitForTimeout(400);
ok('the email field goes when the session lands', !(await vis('[name="email"]')));
ok('so does the password', !(await vis('[name="password"]')));
ok('and the sign-in link with it', await p.$eval('[data-signed-in-hide]', e=>e.hidden));
const lead = await p.$eval('[data-signup-head]', e=>e.textContent.trim());
ok('the page says what is actually left', /دخلت بحساب قوقل/.test(lead), lead);
ok('no Google button offered to somebody already through it',
   await p.$('[data-google]') === null);

console.log('— AND THE ROLE PICKED BEFORE THE REDIRECT SURVIVES IT —');
await p.evaluate(()=>localStorage.setItem('sanad.pendingRole','lawyer'));
await p.goto(U+'signup.html?complete=1'); await p.waitForTimeout(600);
ok('the role comes back chosen',
   await p.$eval('[data-pick="lawyer"]', e=>e.classList.contains('is-active')));
await p.click('[data-next]'); await p.waitForTimeout(300);
ok('and the wizard moves on without asking for an email', !(await vis('[name="email"]')));
await p.fill('[name="phone"]','0501234567');
await p.click('[data-next]'); await p.waitForTimeout(350);
ok('straight to the licence a lawyer owes us', await p.$('[name="licenceNumber"]') !== null);

console.log('— A GUEST WITHOUT THE FLAG IS UNAFFECTED —');
await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.removeItem('sanad.session.user'));
await p.goto(U+'signup.html'); await p.waitForTimeout(500);
await p.click('[data-pick="client"]'); await p.click('[data-next]'); await p.waitForTimeout(350);
ok('email is still asked of a stranger', await vis('[name="email"]'));
ok('and a password', await vis('[name="password"]'));

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
