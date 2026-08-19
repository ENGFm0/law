import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const U='http://localhost:8099/';
async function run(backend) {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
  await ctx.route('**://fonts.*/**', r=>r.abort());
  await ctx.route('**esm.sh**', r=>r.abort());
  const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"', 'backend: "'+backend+'"');
  await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
  const p = await ctx.newPage();
  p.on('pageerror', e=>errs.push(e.message));
  await p.goto(U+'index.html');
  await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-ahmed'));
  await p.goto(U+'account.html'); await p.waitForTimeout(700);
  return p;
}

console.log('— NOBODY BECOMES A LAWYER BY TAPPING A CARD —');
let p = await run('browser');
let t = await p.$eval('#main', e=>e.innerText);
ok('the roles section is gone', !/أدوارك/.test(t), t.slice(0,80));
ok('and nothing offers to add one', await p.$('[data-role]') === null);
ok('who you are still shows', /مسجّل باسم|أحمد/.test(t));
ok('so do your details', /البريد|الجوال/.test(t));
ok('and the way out', await p.$('[data-signout]') !== null);
ok('the demo reset is offered on the demo', await p.$('[data-reset]') !== null);

console.log('— AND WIPING THE VISIT IS NOT OFFERED ON A REAL DATABASE —');
p = await run('supabase');
ok('no reset button', await p.$('[data-reset]') === null);
t = await p.$eval('#main', e=>e.innerText);
ok('the page still works', t.trim().length > 20);

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail?1:0);
