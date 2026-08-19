import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0;
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const U='http://localhost:8099/';

async function page(backend) {
  const ctx = await b.newContext({ viewport:{width:1280,height:900} });
  await ctx.route('**://fonts.*/**', r=>r.abort());
  await ctx.route('**esm.sh**', r=>r.abort());   // the library never arrives
  const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "'+backend+'"');
  await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
  const p = await ctx.newPage();
  await p.goto(U+'index.html'); await p.waitForTimeout(400);
  return p;
}

console.log('— THE TRANSPORT IS DECIDED BY THE CONFIG, NOT BY A DOWNLOAD —');
// Keys are present in config.js either way, so a call is meant to be remote.
let p = await page('supabase');
ok('reported remote even before the library lands',
   await p.evaluate(()=>window.Signal.kind()) === 'supabase');
ok('and isRemote agrees', await p.evaluate(()=>window.Signal.isRemote()) === true);

console.log('— WHAT YOU SEND WHILE IT LOADS IS NOT DROPPED —');
const q = await p.evaluate(() => {
  window.__seen = [];
  const h = window.Signal.open('room-1', m => window.__seen.push(m));
  window.__h = h;
  h.send({ hello: true });          // both of these happen before any
  h.send({ sdp: 'x' });             // transport exists to carry them
  return { usable: typeof h.send === 'function' && typeof h.close === 'function',
           failedYet: h.failed === true };
});
ok('open() hands back a usable handle at once', q.usable);
ok('which has not given up while the library is still coming', q.failedYet === false);

console.log('— AND A LIBRARY THAT NEVER ARRIVES IS SAID, NOT MIMED —');
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({ failed: window.__h.failed === true, id: window.__h.id }));
ok('the handle reports the failure', after.failed);
ok('rather than quietly becoming a same-browser channel', after.id === null);

console.log('— WITH NO PROJECT CONFIGURED IT IS HONESTLY LOCAL —');
p = await page('browser');
const cfgHasKeys = await p.evaluate(()=>!!(window.SANAD_CONFIG.supabase||{}).url);
ok('config.js still carries the keys', cfgHasKeys);
ok('so the transport is remote regardless of which backend the data uses',
   await p.evaluate(()=>window.Signal.kind()) === 'supabase');

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
