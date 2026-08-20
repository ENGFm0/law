import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); } else { fail++; console.log('  FAIL ' + l + (x ? '  <' + x + '>' : '')); } };

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
// These exercise the seeded demo people, so they pin the demo backend: the
// published site runs on the real one, where there are no seeded people at all.
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body:__cfg }));

await ctx.route('**://fonts.*/**', r => r.abort());
const tab = await ctx.newPage();
tab.on('pageerror', e => errs.push('JS: ' + e.message));
await tab.goto('http://localhost:8099/index.html');
const open = async (page, who) => {
  await tab.evaluate(u => { if (u) localStorage.setItem('sanad.session.user', u);
    else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await tab.goto('http://localhost:8099/' + page);
  await tab.waitForTimeout(340);
  return tab;
};

console.log('— THE TABLE IS A TABLE AGAIN —');
await open('lawyers.html', 'u-ahmed');
const geom = await tab.evaluate(() => [...document.querySelectorAll('.rank-table tbody tr')].map(r => {
  const cells = [...r.children].map(c => c.getBoundingClientRect());
  const xs = cells.map(c => [c.x, c.x + c.width]).sort((a, b) => a[0] - b[0]);
  return { heights: [...new Set(cells.map(c => Math.round(c.height)))].length,
           gaps: xs.slice(1).some((c, i) => Math.round(c[0] - xs[i][1]) !== 0),
           displays: [...new Set([...r.children].map(c => getComputedStyle(c).display))] };
}));
ok('every cell shares its row height', geom.every(g => g.heights === 1));
ok('no gaps between cells', geom.every(g => !g.gaps));
ok('every cell is a table-cell', geom.every(g => g.displays.length === 1 && g.displays[0] === 'table-cell'),
   JSON.stringify(geom[0].displays));

console.log('— THE LAWYER WRITES THE SERVICE HIMSELF —');
await open('services.html', 'u-ahmed');
const before = await tab.locator('[data-del-svc]').count();
// 'drafting' was a way of delivering; the catalogue is the work now.
await tab.selectOption('[data-new-type]', 'contract');
await tab.waitForTimeout(200);
await tab.fill('[data-new-title]', 'مراجعة عقود الامتياز التجاري');
await tab.fill('[data-new-meta]', 'خلال يومين عمل');
await tab.fill('[data-new-price]', '10');
await tab.click('[data-add-svc]');
await tab.waitForTimeout(250);
ok('a price under the floor is refused', await tab.locator('[data-svc-error]').isVisible());
ok('and nothing was added', (await tab.locator('[data-del-svc]').count()) === before);
await tab.fill('[data-new-price]', '99999');
await tab.click('[data-add-svc]');
await tab.waitForTimeout(200);
ok('a price over the ceiling is refused', await tab.locator('[data-svc-error]').isVisible());
await tab.fill('[data-new-price]', '640');
await tab.click('[data-add-svc]');
await tab.waitForTimeout(350);
ok('a price inside the band is taken', (await tab.locator('[data-del-svc]').count()) === before + 1);
ok('and it carries his own wording',
  (await tab.innerText('main')).includes('مراجعة عقود الامتياز التجاري'));
ok('with his own turnaround', (await tab.innerText('main')).includes('خلال يومين عمل'));

console.log('— THE CLIENT SEES THAT NAME —');
await open('services.html', 'u-fahad');
await tab.click('[data-pick-type="contract"]');
await tab.waitForTimeout(300);
ok('the custom name reaches the client',
  (await tab.innerText('main')).includes('مراجعة عقود الامتياز التجاري'));

console.log('— A SHARE OF EACH TASK —');
await open('requests.html', 'u-ahmed');
await tab.click('[data-assign="r-4"]');
await tab.waitForTimeout(200);
ok('the chooser asks for a share', await tab.locator('[data-share]').isVisible());
await tab.fill('[data-share]', '40');
await tab.click('[data-pick-intern="u-jaid"][data-for="r-4"]');
await tab.waitForTimeout(350);
const st = await tab.evaluate(() => Store.requestState('r-4'));
ok('the share is stored with the task', st.internShare === 40, JSON.stringify(st));
const paid = await tab.evaluate(() => Models.taskPay(Models.request('r-4')));
ok('40% of 100 SAR is 40', paid.kind === 'share' && paid.amount === 40, JSON.stringify(paid));
ok('the lawyer sees what it costs him', (await tab.innerText('main')).includes('حصة المتدرب'));
await open('requests.html', 'u-jaid');
ok('the trainee sees the same figure', /حصتك/.test(await tab.innerText('main')));

console.log('— OR TERMS SETTLED IN ADVANCE —');
await open('intern.html?id=u-jaid', 'u-fahad');
ok('a client is not shown the pay tab', (await tab.locator('[data-tab="pay"]').count()) === 0);
await open('intern.html?id=u-jaid', 'u-jaid');
ok('the trainee sees their own pay tab', (await tab.locator('[data-tab="pay"]').count()) === 1);
await open('intern.html?id=u-jaid', 'u-ahmed');
ok('the supervising lawyer sees it', (await tab.locator('[data-tab="pay"]').count()) === 1);
await tab.click('[data-tab="pay"]');
await tab.waitForTimeout(250);
ok('with no agreement it says so', (await tab.innerText('main')).includes('لا يوجد اتفاق ثابت'));
await tab.click('[data-make-deal]');
await tab.waitForTimeout(200);
ok('an empty amount is refused', await tab.locator('[data-deal-error]').isVisible());
await tab.fill('[data-deal-amount]', '800');
await tab.fill('[data-deal-cases]', '5');
await tab.click('[data-make-deal]');
await tab.waitForTimeout(350);
const deal = await tab.evaluate(() => Models.agreementFor('u-ahmed', 'u-jaid'));
ok('a by-the-case agreement is recorded',
  deal && deal.kind === 'cases' && deal.amount === 800 && deal.cases === 5, JSON.stringify(deal));
ok('the card shows the progress through it', /من 5 قضية|of 5 cases/.test(await tab.innerText('main')));
const nowPay = await tab.evaluate(() => Models.taskPay(Models.request('r-4')));
ok('the agreement now governs, not the percentage', nowPay.kind === 'cases', JSON.stringify(nowPay));
await open('requests.html', 'u-jaid');
ok('the trainee sees it is under an agreement', /ضمن اتفاق/.test(await tab.innerText('main')));

console.log('— MONTHLY AND YEARLY —');
await open('intern.html?id=u-layan', 'u-ahmed');
await tab.click('[data-tab="pay"]');
await tab.waitForTimeout(200);
await tab.selectOption('[data-deal-kind]', 'monthly');
await tab.waitForTimeout(250);
ok('a monthly deal hides the case count', (await tab.locator('[data-deal-cases]').count()) === 0);
await tab.fill('[data-deal-amount]', '4500');
await tab.click('[data-make-deal]');
await tab.waitForTimeout(300);
const monthly = await tab.evaluate(() => Models.agreementFor('u-ahmed', 'u-layan'));
ok('a monthly retainer is recorded', monthly && monthly.kind === 'monthly' && monthly.amount === 4500,
   JSON.stringify(monthly));
await tab.click('[data-end-deal="u-layan"]');
await tab.waitForTimeout(300);
ok('and it can be ended', (await tab.evaluate(() => Models.agreementFor('u-ahmed', 'u-layan'))) === null);

console.log('— THE CLIENT NEVER SEES ANY OF IT —');
await open('requests.html', 'u-fahad');
const ct = await tab.innerText('main');
// "اتفاقية عدم إفشاء" is a request title, so match the phrases themselves,
// not the bare words they happen to contain.
const leaks = ['حصة المتدرب', 'حصتك', 'ضمن اتفاق', 'متدرب', 'مساعد', 'ذكاء']
  .filter(w => ct.includes(w));
ok('no share, no agreement, no trainee reaches the client', leaks.length === 0, leaks.join(','));

console.log('\npass ' + pass + '  fail ' + fail);
console.log('errors: ' + (errs.length ? '\n  ' + errs.join('\n  ') : 'none'));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
