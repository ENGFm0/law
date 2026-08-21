import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,110)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:950} });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
const body = () => p.$eval('#main', e=>e.innerText);
const go = async (t) => { await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(350); };

await p.goto(U+'index.html');
await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-staff'));
await p.goto(U+'admin.html'); await p.waitForTimeout(600);

console.log('— SECTIONS, NOT ONE LONG PAGE —');
// Named rather than counted: a bare number breaks every time the desk grows
// a section, and says nothing about which one is missing when it does.
const SECTIONS = ['نظرة عامة','الأشخاص','الطلبات','المالية','الإعلانات',
                  'أكواد الخصم','الخدمات','الإعدادات'];
const tabs = await p.$$eval('.adm-tab', ns => ns.map(n => n.textContent.trim()));
ok('every section is on the bar', SECTIONS.every(x => tabs.indexOf(x) !== -1),
   SECTIONS.filter(x => tabs.indexOf(x) === -1).join(','));
ok('and nothing else is', tabs.length === SECTIONS.length, tabs.join(','));
ok('overview opens first', await p.$eval('.adm-tab.is-active span', e=>e.textContent.trim()) === 'نظرة عامة');
ok('with figures on it', (await p.$$('.kpi')).length === 6);
ok('and what is waiting on you', /يحتاج قرارك/.test(await body()));

console.log('— PEOPLE: APPROVING, PLACING, SELLING —');
await go('people');
let t = await body();
ok('everyone is listed', /رانية الحربي/.test(t) && /أحمد عبدالله/.test(t));
ok('staff are not in their own list', !/إدارة المنصة/.test(t));
await p.click('[data-filter="pending"]'); await p.waitForTimeout(300);
t = await body();
ok('filtering to pending narrows it', /رانية الحربي/.test(t) && !/فهد العتيبي/.test(t));
await p.click('[data-approve="u-rania"]'); await p.waitForTimeout(400);
ok('approving works', await p.evaluate(()=>window.Models.user('u-rania').status) === 'verified');
ok('and she leaves the pending list', !/رانية الحربي/.test(await body()));

await p.click('[data-filter="lawyers"]'); await p.waitForTimeout(300);
await p.click('[data-feature="u-ahmed"]'); await p.waitForTimeout(400);
ok('a lawyer can be placed at the top',
   await p.evaluate(()=>window.Models.featured().map(u=>u.id)).then(x=>x[0]==='u-ahmed'));
ok('and the directory follows the placement',
   await p.evaluate(()=>window.Models.byPlacement(window.Models.listedLawyers())[0].id) === 'u-ahmed');

ok('drafting is off by default', await p.evaluate(()=>window.Models.canDraft('u-ahmed')) === false);
await p.click('[data-ai="u-ahmed"]'); await p.waitForTimeout(400);
ok('and can be sold to a lawyer', await p.evaluate(()=>window.Models.canDraft('u-ahmed')) === true);

console.log('— REQUESTS —');
await go('requests');
ok('every request is listed', /عقد عمل لموظف تسويق/.test(await body()));

console.log('— MONEY —');
await go('money');
t = await body();
ok('in and out are separated', /الداخل/.test(t) && /الخارج/.test(t));
ok('the gateway fee is shown as an outflow', /رسوم البوّابة/.test(t));
ok('and explained, since it is charged on the whole amount', /لا على عمولتنا/.test(t));

await p.fill('[data-cost-name]','خادم');
await p.fill('[data-cost-amount]','400');
await p.click('[data-add-cost]'); await p.waitForTimeout(400);
ok('a running cost can be added', await p.evaluate(()=>window.Store.costs().length) === 1);
ok('and shows what it comes to per month', /يعادل شهرياً/.test(await body()));

await p.fill('[data-partner-name]','فهد');
await p.fill('[data-partner-share]','60');
await p.click('[data-add-partner]'); await p.waitForTimeout(400);
ok('a partner can be added', await p.evaluate(()=>window.Store.partners().length) === 1);
const split = await p.evaluate(()=>{ const b = window.Models.books(1);
  return { profit: b.profit, share: b.partners[0].amount, left: b.unassigned }; });
ok('their share is 60% of the net', split.share === Math.round(split.profit*0.6));
ok('and the other 40% is shown as unassigned rather than hidden',
   split.left === split.profit - split.share && /غير موزّع/.test(await body()));

console.log('— ANNOUNCEMENTS REACH THE SITE —');
await go('ads');
await p.fill('[data-ad-title]','تحديث مهم');
await p.click('[data-add-ad]'); await p.waitForTimeout(400);
ok('it is recorded', await p.evaluate(()=>window.Store.announcements().length) === 1);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('and appears on the site itself', await p.$('[data-announce]') !== null);
ok('with what it said', /تحديث مهم/.test(await p.$eval('[data-announce]', e=>e.textContent)));

await p.goto(U+'admin.html?tab=ads'); await p.waitForTimeout(500);
await p.click('[data-toggle-ad]'); await p.waitForTimeout(400);
await p.goto(U+'index.html'); await p.waitForTimeout(500);
ok('hiding it takes it off the site', await p.$('[data-announce]') === null);

console.log('— SETTINGS: THE BANDS AND THE RATES —');
await p.goto(U+'admin.html?tab=settings'); await p.waitForTimeout(500);
await p.fill('[data-band-max="review"]','444');
await p.fill('[data-mada-pct]','1.75');
await p.click('[data-save-settings]'); await p.waitForTimeout(500);
ok('a band can be moved', await p.evaluate(()=>window.Models.priceBand('review').max) === 444);
ok('and it binds a lawyer at once',
   await p.evaluate(()=>window.Models.checkPrice('review', 500)) === 'high');
ok('the gateway rate is kept', await p.evaluate(()=>window.Models.platformSettings().madaPct) === 1.75);

console.log('— THE CATALOGUE IS FILLED IN FROM HERE —');
await p.goto(U+'admin.html?tab=catalogue'); await p.waitForTimeout(500);
ok('the six the site ships with are listed', (await p.$$('[data-cat-toggle]')).length >= 6);
await p.fill('[data-cat-ar]','تأسيس شركة');
await p.fill('[data-cat-en]','Company formation');
await p.fill('[data-cat-id]','company');
await p.fill('[data-cat-min]','800');
await p.fill('[data-cat-max]','6000');
await p.click('[data-cat-save]'); await p.waitForTimeout(500);
ok('a new kind of work is added', await p.evaluate(()=>!!window.Models.serviceType('company')));
ok('with the band that was typed with it',
   await p.evaluate(()=>window.Models.priceBand('company').max) === 6000);

await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-ahmed'));
await p.goto(U+'services.html'); await p.waitForTimeout(500);
ok('and a lawyer can pick it the moment it exists',
   await p.$eval('[data-new-type]', e=>[...e.options].some(o=>o.value==='company')));

await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-staff'));
await p.goto(U+'admin.html?tab=catalogue'); await p.waitForTimeout(500);
await p.click('[data-cat-toggle="company"]'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-ahmed'));
await p.goto(U+'services.html'); await p.waitForTimeout(500);
ok('hiding it takes it out of the picker',
   await p.$eval('[data-new-type]', e=>![...e.options].some(o=>o.value==='company')));

console.log('— AND NOBODY ELSE SEES ANY OF IT —');
await p.evaluate(()=>localStorage.setItem('sanad.session.user','u-ahmed'));
await p.goto(U+'admin.html'); await p.waitForTimeout(500);
ok('a lawyer is turned away', /هذه الصفحة لإدارة المنصة/.test(await body()));
ok('with no tabs to click', (await p.$$('.adm-tab')).length === 0);

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e=>console.log('  '+e)); }
console.log(`\n${pass} passed, ${fail} failed`+(errs.length?`, ${errs.length} js errors`:''));
await b.close();
process.exit(fail||errs.length?1:0);
