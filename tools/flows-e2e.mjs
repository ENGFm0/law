import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); } else { fail++; console.log('  FAIL ' + l + (x ? '  <' + x + '>' : '')); } };

// Work in progress lives in sessionStorage, which is per tab — the same place
// it lives for a real visitor who switches role without opening a new window.
// So the whole run happens in ONE page, exactly as a person would drive it.
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
// These exercise the seeded demo people, so they pin the demo backend: the
// published site runs on the real one, where there are no seeded people at all.
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body:__cfg }));

await ctx.route('**://fonts.*/**', r => r.abort());
const tab = await ctx.newPage();
tab.on('pageerror', e => errs.push('JS: ' + e.message));
await tab.goto('http://localhost:8099/index.html');

async function open(page, who) {
  await tab.evaluate(u => { if (u) localStorage.setItem('sanad.session.user', u);
    else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await tab.goto('http://localhost:8099/' + page);
  await tab.waitForTimeout(320);
  return tab;
}

console.log('— THE ASSISTANT IS FINDABLE —');
let p = await open('index.html', 'u-ahmed');
let nav = await p.$$eval('.nav__link', ns => ns.map(n => n.getAttribute('href')));
ok('lawyer header links to the assistant', nav.includes('assistant.html'), nav.join(','));
let tabs = await p.$$eval('.tabbar__link', ns => ns.map(n => n.getAttribute('href')));
ok('phone bar carries it too', tabs.includes('assistant.html'), tabs.join(','));
ok('phone bar stays at six', tabs.length === 6, String(tabs.length));
for (const who of ['u-fahad', null, 'u-jaid']) {
  p = await open('index.html', who);
  nav = await p.$$eval('.nav__link', ns => ns.map(n => n.getAttribute('href')));
  ok(`${who || 'guest'} is never offered the assistant`, !nav.includes('assistant.html'), nav.join(','));
  }

console.log('— ROUTING A TASK: NAME ONE, OR OPEN IT TO ALL —');
p = await open('requests.html', 'u-ahmed');
await p.click('[data-assign="r-5"]');
await p.waitForTimeout(150);
ok('the chooser offers both roads',
  await p.locator('.assign-pop [data-broadcast]').isVisible() &&
  (await p.locator('.assign-pop [data-pick-intern]').count()) === 3);
await p.click('[data-broadcast="r-5"]');
await p.waitForTimeout(300);
const state = await p.evaluate(() => Store.requestState('r-5'));
ok('the task is open to everyone', state.status === 'open_to_interns' && !state.assignedTo, JSON.stringify(state));

console.log('— THE TRAINEES COMPETE —');
const jaid = await open('requests.html', 'u-jaid');
ok('an open task reaches the trainee', await jaid.locator('[data-apply="r-5"]').isVisible());
await jaid.click('[data-apply="r-5"]');
await jaid.waitForTimeout(300);
ok('applying is recorded', (await jaid.evaluate(() => Store.applicants('r-5'))).includes('u-jaid'));
ok('the button becomes a waiting state', !(await jaid.locator('[data-apply="r-5"]').count()));
const turki = await open('requests.html', 'u-turki');
await turki.click('[data-apply="r-5"]');
await turki.waitForTimeout(300);
const applicants = await turki.evaluate(() => Store.applicants('r-5'));
ok('a second trainee joins the race', applicants.length === 2, applicants.join(','));

console.log('— THE LAWYER PICKS THE WINNER —');
p = await open('requests.html', 'u-ahmed');
await p.click('[data-open="r-5"]');
await p.waitForTimeout(250);
ok('both applicants are shown', (await p.locator('[data-pick-intern][data-for="r-5"]').count()) === 2);
await p.click('[data-pick-intern="u-turki"][data-for="r-5"]');
await p.waitForTimeout(350);
const after = await p.evaluate(() => ({ st: Store.requestState('r-5'), app: Store.applicants('r-5') }));
ok('the task lands with the chosen trainee', after.st.assignedTo === 'u-turki' && after.st.status === 'with_intern', JSON.stringify(after.st));
ok('the pool closes behind it', after.app.length === 0);
const loser = await open('requests.html', 'u-jaid');
ok('the trainee who lost no longer sees it open', !(await loser.locator('[data-apply="r-5"]').count()));

console.log('— THE CLIENT NEVER LEARNS ANY OF IT —');
const client = await open('requests.html', 'u-fahad');
const txt = await client.innerText('main');
ok('no mention of a trainee', !/متدرب|trainee/i.test(txt));
ok('no mention of drafting or an assistant', !/مساعد|ذكاء|assistant/i.test(txt));

console.log('— THE CLIENT PICKS A SERVICE, THEN SEES WHO OFFERS IT —');
p = await open('services.html', 'u-fahad');
ok('both routes are offered up front',
  (await p.locator('[data-i18n="svc.routePick"]').count()) === 1 &&
  (await p.locator('a[href="quotes.html"]').count()) >= 1);
ok('step one is the service types', (await p.locator('[data-pick-type]').count()) === 5);
await p.click('[data-pick-type="call"]');
await p.waitForTimeout(300);
const cards = await p.locator('[data-order]').count();
ok('step two lists the lawyers offering it', cards >= 3, String(cards));
const prices = await p.$$eval('[data-order]', ns =>
  ns.map(n => +n.closest('.card').querySelector('.title .num').textContent.replace(/,/g, '')));
ok('cheapest first', prices.join() === [...prices].sort((a, b) => a - b).join(), prices.join());
ok('the cheapest is flagged', await p.locator('.card--rule-gold [data-order]').first().isVisible());
await p.click('[data-clear-type]');
await p.waitForTimeout(250);
ok('you can go back and change service', (await p.locator('[data-pick-type]').count()) === 5);

console.log('— RANK IS FOR THE PROFESSION, RATING IS FOR EVERYONE —');
for (const [who, boardExpected] of [['u-fahad', false], [null, false], ['u-ahmed', true], ['u-jaid', true]]) {
  const q = await open('lawyers.html', who);
  const hasBoard = (await q.locator('.rank-table').count()) > 0;
  ok(`${who || 'guest'} ${boardExpected ? 'sees' : 'is not shown'} the leaderboard`, hasBoard === boardExpected);
  ok(`${who || 'guest'} still sees ratings`, (await q.locator('.rating').count()) > 0);
}
const jt = await open('lawyers.html', 'u-jaid');
await jt.click('[data-tab="lawyer"]');
await jt.waitForTimeout(280);
ok('a trainee is not shown the lawyers’ table', (await jt.locator('.rank-table').count()) === 0);
for (const [who, expected] of [['u-fahad', false], ['u-ahmed', true]]) {
  const q = await open('lawyer.html?id=u-sara', who);
  const t = await q.innerText('main');
  ok(`${who}: rank on a profile ${expected ? 'shown' : 'hidden'}`, /الترتيب على المنصة/.test(t) === expected);
}

console.log('\npass ' + pass + '  fail ' + fail);
console.log('errors: ' + (errs.length ? '\n  ' + errs.join('\n  ') : 'none'));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
