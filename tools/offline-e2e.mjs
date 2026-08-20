/* What the site says when it cannot reach its data — and what it no longer
   needs to reach at all. The CDN used to be on the critical path of every
   read; blocking it was enough to empty the site. Now only the database
   itself matters, and an unreachable one is said out loud. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const U='http://localhost:8099/';

console.log('— THE DATABASE IS UNREACHABLE —');
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true });
  await ctx.route('**://fonts.*/**', r=>r.abort());
  await ctx.route('**supabase.co/**', r=>r.abort());
  const p = await ctx.newPage();
  await p.goto(U+'index.html'); await p.waitForTimeout(1800);
  const bar = await p.$('[data-offline]');
  ok('the site says it could not load your data', bar !== null);
  const t = await p.$eval('[data-offline]', e=>e.innerText).catch(()=>'');
  ok('in words, not a console line', /تعذّر الوصول/.test(t), t.slice(0,60));
  ok('with a way to retry', await p.$('[data-offline-retry]') !== null);
  ok('and the page underneath still renders',
     (await p.$eval('#main', e=>e.textContent.trim().length)) > 20);
  ok('shown once, not once per failed call',
     (await p.$$('[data-offline]')).length === 1);
  await ctx.close();
}

console.log('— THE CDN IS UNREACHABLE, WHICH NO LONGER MATTERS —');
{
  const ctx = await b.newContext({ viewport:{width:1280,height:900} });
  await ctx.route('**://fonts.*/**', r=>r.abort());
  let cdn = 0;
  await ctx.route('**esm.sh**', r=>{ cdn++; r.abort(); });
  let asked = 0;
  await ctx.route('**/rest/v1/**', async r=>{
    asked++;
    const name = new URL(r.request().url()).pathname.split('/').pop();
    const rows = name === 'profiles'
      ? [{ id:'p-1', full_name:'هند القحطاني', roles:['lawyer'], status:'verified',
           active_role:'lawyer', city:'riyadh', years:6, specialties:['labour'], onboarded:true }]
      : [];
    r.fulfill({ contentType:'application/json', body: JSON.stringify(rows) });
  });
  await ctx.route('**/assets/js/config.js', r=>r.fulfill({
    contentType:'application/javascript',
    body:'window.SANAD_CONFIG={backend:"supabase",supabase:{url:"https://proj.supabase.co",anonKey:"pub"}};' }));
  const p = await ctx.newPage();
  await p.goto(U+'lawyers.html'); await p.waitForTimeout(800);
  ok('the directory loaded anyway', /هند/.test(await p.$eval('#main', e=>e.innerText)));
  ok('nothing was asked of the CDN', cdn === 0, cdn);
  ok('and the database was', asked > 0, asked);
  ok('with no failure bar', await p.$('[data-offline]') === null &&
     await p.$('[data-datafail]') === null);
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
