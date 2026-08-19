import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); } else { fail++; console.log('  FAIL ' + l + (x ? '  <' + x + '>' : '')); } };
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
// These exercise the seeded demo people, so they pin the demo backend: the
// published site runs on the real one, where there are no seeded people at all.
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body:__cfg }));

await ctx.route('**://fonts.*/**', r => r.abort());
const tab = await ctx.newPage();
tab.on('pageerror', e => errs.push('JS: ' + e.message));
const U = 'http://localhost:8099/';
await tab.goto(U + 'index.html');

async function open(page, who) {
  await tab.evaluate(u => { if (u) localStorage.setItem('sanad.session.user', u);
    else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await tab.goto(U + page);
  await tab.waitForTimeout(300);
  return tab;
}
const txt = s => tab.$eval(s, e => e.textContent.trim()).catch(() => null);
const seen = s => tab.$(s).then(e => !!e);

/* Deliver r-1 (Fahad's request from Al-Mohammadi) so a window exists. */
console.log('— THE LAWYER DELIVERS —');
await open('requests.html', 'u-ahmed');
await tab.evaluate(() => { window.Store.setRequest('r-1', { status: 'delivered', body: 'نص العقد' }); });
await tab.waitForTimeout(200);
const stamped = await tab.evaluate(() => window.Store.requestState('r-1').deliveredAt);
ok('delivery stamps the moment the window starts', typeof stamped === 'number' && stamped > 0);

console.log('— THE CLIENT SEES THE WINDOW, NOT A PROMISE —');
await open('requests.html', 'u-fahad');
await tab.click('[data-detail="r-1"]');
await tab.waitForTimeout(250);
ok('an acceptance panel appears on the delivery', await seen('[data-accept="r-1"]'));
const lead = await txt('[data-detail="r-1"]') && await tab.$$eval('.card--rule-gold', c => c.map(x => x.textContent).join(' '));
ok('the deadline is on screen with a countdown', /يتبق|تتبق|أقل من ساعة/.test(lead || ''), (lead||'').slice(0,60));
ok('and it says what silence means', /يُعدّ التسليم مقبولاً/.test(lead || ''));
ok('all three choices are offered', await seen('[data-accept="r-1"]') &&
   await seen('[data-revise="r-1"]') && await seen('[data-argue="r-1"]'));

console.log('— ONE REVISION —');
await tab.click('[data-revise="r-1"]');
await tab.waitForTimeout(200);
await tab.click('[data-revise-send="r-1"]');
await tab.waitForTimeout(250);
ok('an empty revision is refused', await tab.evaluate(() => window.Store.requestState('r-1').revisions) === undefined);
await tab.fill('[data-argue-body]', 'ينقص بند الإنهاء');
await tab.click('[data-revise-send="r-1"]');
await tab.waitForTimeout(300);
let st = await tab.evaluate(() => window.Store.requestState('r-1'));
ok('the request goes back to the lawyer', st.status === 'in_progress');
ok('the revision is counted', st.revisions === 1);
ok('and the clock is cleared until the next delivery', !st.deliveredAt);
ok('what to change was carried across', st.revisionNote === 'ينقص بند الإنهاء');

console.log('— THE SECOND DELIVERY OFFERS NO SECOND REVISION —');
await tab.evaluate(() => window.Store.setRequest('r-1', { status: 'delivered' }));
await tab.goto(U + 'requests.html'); await tab.waitForTimeout(300);
await tab.click('[data-detail="r-1"]'); await tab.waitForTimeout(250);
ok('accept and refuse remain', await seen('[data-accept="r-1"]') && await seen('[data-argue="r-1"]'));
ok('revise is gone — it was used', !(await seen('[data-revise="r-1"]')));

console.log('— REFUSING FREEZES IT —');
await tab.click('[data-argue="r-1"]'); await tab.waitForTimeout(200);
await tab.click('[data-argue-send="r-1"]'); await tab.waitForTimeout(250);
ok('a refusal with no reason is refused', await tab.evaluate(() => window.Store.disputes().length) === 0);
await tab.fill('[data-argue-body]', 'لم يُعدَّل البند المطلوب');
await tab.click('[data-argue-send="r-1"]'); await tab.waitForTimeout(350);
const d = await tab.evaluate(() => window.Store.disputes()[0]);
ok('the dispute is recorded with its reason', d && d.reason === 'لم يُعدَّل البند المطلوب');
ok('opened by the client', d && d.byId === 'u-fahad');
ok('and it is open', d && d.status === 'open');
await tab.click('[data-detail="r-1"]'); await tab.waitForTimeout(150);
await tab.click('[data-detail="r-1"]'); await tab.waitForTimeout(250);
const panel = await tab.$$eval('.card--rule-gold', c => c.map(x => x.textContent).join(' '));
ok('the client is told the money is frozen', /مجمَّد/.test(panel || ''), (panel||'').slice(0,80));
ok('no accept button survives an open dispute', !(await seen('[data-accept="r-1"]')));

console.log('— A DECISION, AND BOTH SIDES READ THE SAME WORDS —');
await tab.evaluate(() => {
  const d = window.Store.disputes()[0];
  window.Store.resolveDispute(d.id, { outcome: 'split', lawyerPct: 60, byId: 'u-staff',
    reason: 'سُلّم أغلب العمل والبند الناقص يسير' });
});
await tab.goto(U + 'requests.html'); await tab.waitForTimeout(300);
await tab.click('[data-detail="r-1"]'); await tab.waitForTimeout(250);
const out = await tab.$$eval('.card--rule-gold', c => c.map(x => x.textContent).join(' '));
ok('the outcome is stated', /توزيع جزئي/.test(out || ''), (out||'').slice(0,80));
ok('with the reason, in words', /سُلّم أغلب العمل/.test(out || ''));
ok('and the refund is shown', /39|40/.test(out || ''), (out||'').slice(0,120));

console.log('— ACCEPTING —');
await tab.evaluate(() => { window.Store.resetWork(); window.Store.setRequest('r-3', { status: 'delivered' }); });
await tab.goto(U + 'requests.html'); await tab.waitForTimeout(300);
await tab.click('[data-detail="r-3"]'); await tab.waitForTimeout(250);
await tab.click('[data-accept="r-3"]'); await tab.waitForTimeout(300);
st = await tab.evaluate(() => window.Store.requestState('r-3'));
ok('accepting completes the request', st.status === 'completed');
ok('and stamps when', typeof st.acceptedAt === 'number');

console.log('— IN ENGLISH, AND IN THE DARK —');
await tab.evaluate(() => { window.Store.resetWork(); window.Store.setRequest('r-5', { status: 'delivered' }); });
await tab.goto(U + 'requests.html?lang=en'); await tab.waitForTimeout(200);
await tab.evaluate(() => { window.I18N.set('en'); document.documentElement.setAttribute('data-theme','dark'); });
await tab.waitForTimeout(300);
await tab.click('[data-detail="r-5"]'); await tab.waitForTimeout(300);
const en = await tab.$$eval('.card--rule-gold', c => c.map(x => x.textContent).join(' '));
ok('the panel translates', /Accept the delivery|left/.test(en || ''), (en||'').slice(0,80));
ok('no Arabic leaks through', !/يتبقّى|قبول التسليم/.test(en || ''));
ok('direction follows the language', await tab.evaluate(() => document.documentElement.dir) === 'ltr');

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e => console.log('  ' + e)); }
console.log(`\n${pass} passed, ${fail} failed` + (errs.length ? `, ${errs.length} js errors` : ''));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
