import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); } else { fail++; console.log('  FAIL ' + l + (x ? '  <' + String(x).slice(0,90) + '>' : '')); } };
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
  await tab.goto(U + page); await tab.waitForTimeout(320); return tab;
}
const body = () => tab.$eval('#main', e => e.textContent);
const seen = s => tab.$(s).then(e => !!e);

console.log('— THE DESK IS NOT OPEN TO EVERYONE —');
await open('admin.html', null);
ok('a guest is turned away', /لإدارة المنصة/.test(await body()));
ok('and sees no queue', !(await seen('[data-approve]')));
await open('admin.html', 'u-fahad');
ok('so is a client', !(await seen('[data-approve]')));
await open('admin.html', 'u-ahmed');
ok('so is a lawyer', !(await seen('[data-approve]')));

console.log('— NOBODY CAN MAKE THEMSELVES STAFF —');
const granted = await tab.evaluate(() => window.Store.addRole(window.Store.currentId(), 'staff'));
ok('adding the staff role to your own account is refused', granted === null);
ok('and the account still has no such role',
   !(await tab.evaluate(() => (window.Session.user().roles || []).includes('staff'))));

console.log('— THE QUEUE —');
// The console is six sections now; the queue lives under People.
await open('admin.html?tab=people', 'u-staff');
ok('staff reach the desk', /مكتب الإدارة/.test(await body()));
ok('the pending lawyer is waiting there', (await body()).includes('رانية الحربي'));
ok('so is the pending trainee', (await body()).includes('تركي السبيعي'));
// People lists everyone now, which is the point of it; the queue is a filter.
ok('everyone is listed, approved or not', (await body()).includes('أحمد عبدالله المحمدي'));
await tab.click('[data-filter="pending"]'); await tab.waitForTimeout(300);
ok('and filtering to pending leaves only those waiting',
   !(await body()).includes('أحمد عبدالله المحمدي') && (await body()).includes('رانية الحربي'));
await tab.click('[data-filter="all"]'); await tab.waitForTimeout(300);
ok('her licence number is on screen to be checked', /8842|٨٨٤٢/.test(await body()));

console.log('— APPROVING PUTS HER IN THE DIRECTORY —');
let listed = await tab.evaluate(() => window.Models.listedLawyers().length);
ok('six lawyers are listed before', listed === 6);
await tab.click('[data-approve="u-rania"]'); await tab.waitForTimeout(350);
ok('seven after', await tab.evaluate(() => window.Models.listedLawyers().length) === 7);
ok('and she leaves the queue', !(await seen('[data-approve="u-rania"]')));
ok('though her name stays in the record — that is the point of a record',
   (await body()).includes('رانية الحربي'));
ok('the approval is on the record', /اعتماد/.test(await body()));

console.log('— A REJECTION MUST SAY WHY —');
await tab.click('[data-reject="u-turki"]'); await tab.waitForTimeout(250);
await tab.click('[data-reject-send="u-turki"]'); await tab.waitForTimeout(250);
ok('an empty rejection is refused',
   await tab.evaluate(() => window.Models.user('u-turki').status) === 'pending');
await tab.fill('[data-why]', 'صورة الرخصة غير واضحة');
await tab.click('[data-reject-send="u-turki"]'); await tab.waitForTimeout(350);
const t = await tab.evaluate(() => window.Models.user('u-turki'));
ok('with a reason it goes through', t.status === 'rejected');
ok('and the reason is kept with the account', t.rejectedReason === 'صورة الرخصة غير واضحة');

console.log('— DECIDING A DISPUTE —');
await tab.evaluate(() => {
  window.Store.setRequest('r-1', { status: 'delivered', body: 'النص المسلَّم', assignedTo: 'u-jaid', internShare: 30 });
  window.Store.openDispute({ requestId: 'r-1', byId: 'u-fahad', reason: 'ناقص بند الإنهاء' });
});
await tab.goto(U + 'admin.html?tab=requests'); await tab.waitForTimeout(400);
let txt = await body();
// The desk lands on the objections when there are any: they are the only
// pile with somebody waiting on a decision.
ok('the desk opens on the objections',
   await tab.$eval('[data-pile="disputed"]', e=>e.classList.contains('is-active')));
ok('the dispute reaches the desk', txt.includes('ناقص بند الإنهاء'));
ok('with what was actually delivered beside it', txt.includes('النص المسلَّم'));
ok('and the trainee’s position is put in front of the decider',
   /المتدرب سلّم عمله للمحامي/.test(txt));
ok('with the figure they are owed', /مستحق المتدرب/.test(txt));

await tab.click('[data-outcome="split"]'); await tab.waitForTimeout(250);
ok('choosing a split asks for the share', await seen('[data-pct]'));
await tab.click('[data-resolve]'); await tab.waitForTimeout(250);
ok('a ruling with no reason is refused',
   await tab.evaluate(() => window.Store.disputes()[0].status) === 'open');
await tab.fill('[data-why]', 'سُلّم أغلب العمل');
await tab.fill('[data-pct]', '70');
await tab.click('[data-resolve]'); await tab.waitForTimeout(400);
const d = await tab.evaluate(() => window.Store.disputes()[0]);
ok('with one it is decided', d.status === 'resolved');
ok('at the share the staff chose', d.resolution.lawyerPct === 70);
ok('carrying the written reason', d.resolution.reason === 'سُلّم أغلب العمل');
ok('and naming who decided', d.resolution.byId === 'u-staff');
ok('the dispute is no longer open', await tab.evaluate(()=>window.Models.openDisputes().length) === 0);

console.log('— SETTINGS —');
await tab.goto(U + 'admin.html?tab=settings'); await tab.waitForTimeout(400);
ok('tax is off to begin with', await tab.evaluate(() => window.Models.platformSettings().vatEnabled) === false);
await tab.fill('[data-commission]', '15');
await tab.click('[data-save-settings]'); await tab.waitForTimeout(300);
ok('a commission above the cap is refused',
   await tab.evaluate(() => window.Models.platformSettings().commissionPct) === 10);
await tab.fill('[data-commission]', '7');
await tab.check('[data-vat]');
await tab.click('[data-save-settings]'); await tab.waitForTimeout(350);
const s = await tab.evaluate(() => window.Models.platformSettings());
ok('a lawful one is kept', s.commissionPct === 7);
ok('and tax can be switched on without touching code', s.vatEnabled === true);

console.log('— THE RECORD —');
await tab.goto(U + 'admin.html?tab=overview'); await tab.waitForTimeout(400);
txt = await body();
ok('every decision is listed', /اعتماد/.test(txt) && /رفض/.test(txt) && /فصل في نزاع/.test(txt));
const n = await tab.evaluate(() => window.Store.audit().length);
// approve, reject, decide, save settings — the refused over-cap save is not
// an action, so it leaves no entry.
ok(`${n} entries, append only`, n === 4);

console.log('— ISSUING A DISCOUNT, AND SEEING WHAT IT COST —');
await open('admin.html?tab=promos', 'u-staff');
ok('the desk has a place to issue codes', await tab.$('[data-promo-add]') !== null);
ok('and says out loud whose money it is',
   /الخصم يُخصم من عمولة المنصة وحدها/.test(await body()));

await tab.click('[data-promo-add]'); await tab.waitForTimeout(300);
ok('a code with no code is refused',
   await tab.$eval('[data-promo-error]', e => !e.hidden));

await tab.fill('[data-promo-new-code]', 'ramadan10');
await tab.fill('[data-promo-new-pct]', '10');
await tab.fill('[data-promo-new-label]', 'حملة رمضان');
await tab.fill('[data-promo-new-max]', '50');
await tab.fill('[data-promo-new-limit]', '100');
await tab.click('[data-promo-add]'); await tab.waitForTimeout(400);
const issued = await tab.evaluate(() => window.Store.promoByCode('RAMADAN10'));
ok('a typed code is stored upper case', issued && issued.code === 'RAMADAN10', issued);
ok('with its ceiling kept in halalas', issued.maxDiscount === 5000, issued.maxDiscount);
ok('and it appears on the page', /RAMADAN10/.test(await body()));
ok('marked live', /فعّال/.test(await body()));
ok('the same code twice is refused', await (async () => {
  await tab.fill('[data-promo-new-code]', 'RAMADAN10');
  await tab.fill('[data-promo-new-pct]', '20');
  await tab.click('[data-promo-add]'); await tab.waitForTimeout(300);
  return !(await tab.$eval('[data-promo-error]', e => e.hidden));
})());

// Somebody spends it, and the desk has to be able to see what that cost.
await tab.evaluate(() => {
  const r = Store.addRequest({ clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'consult',
    title:{ar:'ع',en:'c'}, brief:{ar:'ب',en:'b'}, price:300, status:'new', hours:4 });
  Store.signIn('u-fahad');
  Store.redeemPromo(r.id, 'RAMADAN10');
  Store.signIn('u-staff');
});
await open('admin.html?tab=promos', 'u-staff');
const spent = await body();
ok('the counter is on the page', /استُعمل/.test(spent));
// Not a hard-coded 30: an earlier section on this page moves the commission,
// and the whole point of the cap is that the discount follows it.
const gave = await tab.evaluate(() => {
  const p = Store.promoByCode('RAMADAN10');
  return Store.redemptions().filter(r => r.promoId === p.id)
    .reduce((t, r) => t + r.amount, 0);
});
ok('and so is what it actually gave away',
   /خُصم فعلياً/.test(spent) && spent.indexOf(String(Math.round(gave / 100))) !== -1,
   (spent.match(/خُصم فعلياً[^·]*/) || [])[0] + ' vs ' + gave);
ok('which never exceeds the commission it comes out of',
   await tab.evaluate(g => {
     const c = Models.platformSettings().commissionPct;
     return g <= Math.round(30000 * c / 100);
   }, gave), gave);

await tab.click('[data-promo-toggle]'); await tab.waitForTimeout(400);
ok('withdrawing one takes it out of use',
   await tab.evaluate(() => window.Store.promoByCode('RAMADAN10').active === false));
ok('and the client is told so rather than shown a dead button',
   await tab.evaluate(() =>
     window.Models.promoValue('RAMADAN10', 30000, null, 'u-munira').reason) === 'withdrawn');
ok('the desk keeps a record of who withdrew it',
   await tab.evaluate(() => window.Store.audit().some(e => e.subject === 'RAMADAN10')));

console.log('— IN ENGLISH, IN THE DARK —');
await tab.evaluate(() => { window.I18N.set('en'); document.documentElement.setAttribute('data-theme','dark'); });
await tab.waitForTimeout(350);
txt = await body();
ok('the desk translates', /Platform settings|The staff desk/.test(txt), txt.slice(0,80));
ok('with no Arabic left behind', !/مكتب الإدارة|إعدادات المنصة/.test(txt));

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e => console.log('  ' + e)); }
console.log(`\n${pass} passed, ${fail} failed` + (errs.length ? `, ${errs.length} js errors` : ''));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
