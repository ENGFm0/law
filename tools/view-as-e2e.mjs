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
const seed = roles => p.evaluate(rs => {
  const a = JSON.parse(localStorage.getItem('sanad.accounts') || '[]')
    .filter(x => x.id !== 'u-multi');
  a.push({ id:'u-multi', roles:rs, activeRole:rs[rs.length-1], name:{ar:'فهد',en:'Fahad'},
           email:'m@t.sa', status:'verified', onboarded:true });
  localStorage.setItem('sanad.accounts', JSON.stringify(a));
  localStorage.setItem('sanad.session.user','u-multi');
}, roles);

console.log('— ONE CAPACITY, NOTHING TO SWITCH —');
await p.goto(U+'index.html'); await seed(['client']);
await p.goto(U+'account.html'); await p.waitForTimeout(500);
ok('no switch is offered', await p.$('[data-view-as]') === null);
ok('and nothing invites adding a role', !/أدوارك/.test(await p.$eval('#main', e=>e.innerText)));

console.log('— STAFF WHO IS ALSO A CLIENT CAN LOOK BOTH WAYS —');
await p.goto(U+'index.html'); await seed(['client','staff']);
await p.goto(U+'account.html'); await p.waitForTimeout(500);
ok('the switch appears', await p.$('[data-view-as="staff"]') !== null);
ok('with both capacities and no third', (await p.$$('[data-view-as]')).length === 2);
ok('it says plainly that it grants nothing',
   /ولا يمنح صلاحية/.test(await p.$eval('#main', e=>e.innerText)));
ok('the desk is in the navigation while staff is active',
   (await p.$$eval('.tabbar__link', ns=>ns.map(n=>n.getAttribute('href')))).includes('admin.html'));

await p.click('[data-view-as="client"]'); await p.waitForTimeout(500);
ok('switching to client sticks', await p.evaluate(()=>window.Session.role()) === 'client');
ok('and the desk leaves the navigation',
   !(await p.$$eval('.tabbar__link', ns=>ns.map(n=>n.getAttribute('href')))).includes('admin.html'));
await p.goto(U+'admin.html'); await p.waitForTimeout(500);
ok('the desk itself is closed while looking as a client',
   /هذه الصفحة لإدارة المنصة/.test(await p.$eval('#main', e=>e.innerText)));

await p.goto(U+'account.html'); await p.waitForTimeout(400);
await p.click('[data-view-as="staff"]'); await p.waitForTimeout(500);
await p.goto(U+'admin.html'); await p.waitForTimeout(500);
ok('and open again on the way back', /مكتب الإدارة/.test(await p.$eval('#main', e=>e.innerText)));

console.log('— IT CANNOT BE USED TO TAKE A CAPACITY —');
ok('a role the account does not hold is refused',
   await p.evaluate(()=>window.Session.switchRole('lawyer')) === false);
ok('and the account is unchanged',
   (await p.evaluate(()=>window.Session.user().roles)).join() === 'client,staff');

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
