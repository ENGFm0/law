import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0; const errs = [];
const ok = (l,c,x) => { if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,90)+'>':''));} };
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
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
const seen = s => tab.$(s).then(e => !!e);
const count = () => tab.$eval('.notice-bell__count', e => e.textContent.trim()).catch(() => null);

console.log('— A GUEST HAS NO BELL —');
await open('index.html', null);
ok('no bell for someone not signed in', !(await seen('.notice-bell')));

console.log('— DELIVERY REACHES THE CLIENT —');
await open('requests.html', 'u-ahmed');
await tab.evaluate(() => window.Store.setRequest('r-1', { status: 'delivered', body: 'نص' }));
await tab.waitForTimeout(250);
// the lawyer delivering does not notify himself
await open('requests.html', 'u-ahmed');
ok('the lawyer is not told about his own delivery', !(await seen('.notice-bell__count')));
await tab.evaluate(() => window.Store.notify({ to: 'u-fahad', type: 'delivered', ref: 'r-1' }));
await open('requests.html', 'u-fahad');
ok('the client has an unread notice', (await count()) === '1');
await tab.click('.notice-bell'); await tab.waitForTimeout(250);
const panel = await tab.$eval('[data-notice-panel]', e => e.textContent);
ok('and it says what happened', /سُلّم عملك/.test(panel), panel.slice(0,60));
ok('without leaking what is in it', !/نص/.test(panel));

console.log('— THE SAME EVENT TWICE IS ONE NOTICE —');
await tab.evaluate(() => { window.Store.notify({ to: 'u-fahad', type: 'delivered', ref: 'r-1' });
                           window.Store.notify({ to: 'u-fahad', type: 'delivered', ref: 'r-1' }); });
await tab.waitForTimeout(250);
ok('a redraw cannot fill the list with copies', (await count()) === '1');

console.log('— READING CLEARS IT —');
await tab.click('[data-notice-panel] .notice'); await tab.waitForTimeout(400);
ok('opening one marks it read', await tab.evaluate(() => window.Store.notices()[0].read) === true);
ok('and the count is gone', (await count()) === null);

console.log('— ONLY YOURS —');
await tab.evaluate(() => { window.Store.notify({ to: 'u-munira', type: 'rated', ref: 'x' }); });
await tab.waitForTimeout(200);
ok('a notice for someone else does not reach you', (await count()) === null);
ok('nor is it in your list',
   await tab.evaluate(() => window.Models.noticesFor('u-fahad').some(n => n.type === 'rated')) === false);
ok('it reaches the person it belongs to',
   await tab.evaluate(() => window.Models.unreadFor('u-munira')) === 1);

console.log('— A REFUSAL REACHES THE LAWYER AND THE DESK —');
await open('requests.html', 'u-fahad');
await tab.evaluate(() => window.Store.setRequest('r-3', { status: 'delivered', deliveredAt: Date.now() }));
await tab.waitForTimeout(200);
await tab.click('[data-detail="r-3"]'); await tab.waitForTimeout(300);
await tab.click('[data-argue="r-3"]'); await tab.waitForTimeout(200);
await tab.fill('[data-argue-body]', 'ناقص');
await tab.click('[data-argue-send="r-3"]'); await tab.waitForTimeout(400);
ok('the lawyer is told', await tab.evaluate(() => window.Models.noticesFor('u-ahmed').some(n => n.type === 'disputed')));
ok('the desk is told', await tab.evaluate(() => window.Models.noticesFor('u-staff').some(n => n.type === 'disputed')));
ok('the client who raised it is not told about their own act',
   await tab.evaluate(() => window.Models.noticesFor('u-fahad').some(n => n.type === 'disputed')) === false);

console.log('— AND THE DECISION REACHES BOTH SIDES, THE SAME WAY —');
await open('admin.html', 'u-staff');
await tab.click('[data-outcome="release"]'); await tab.waitForTimeout(250);
await tab.fill('[data-why]', 'سُلّم في موعده');
await tab.click('[data-resolve]'); await tab.waitForTimeout(400);
ok('the client hears', await tab.evaluate(() => window.Models.noticesFor('u-fahad').some(n => n.type === 'resolved')));
ok('the lawyer hears', await tab.evaluate(() => window.Models.noticesFor('u-ahmed').some(n => n.type === 'resolved')));

console.log('— APPROVAL REACHES THE PERSON WAITING —');
await tab.click('[data-approve="u-rania"]'); await tab.waitForTimeout(400);
ok('she is told her account is live',
   await tab.evaluate(() => window.Models.noticesFor('u-rania').some(n => n.type === 'approved')));

console.log('— IN ENGLISH —');
await open('requests.html', 'u-ahmed');
await tab.evaluate(() => window.I18N.set('en')); await tab.waitForTimeout(300);
await tab.click('.notice-bell'); await tab.waitForTimeout(250);
const en = await tab.$eval('[data-notice-panel]', e => e.textContent);
ok('the list translates', /Notifications/.test(en), en.slice(0,60));
ok('with no Arabic left', !/التنبيهات|اعتُرض/.test(en));

if (errs.length) { console.log('\nJS ERRORS:'); errs.forEach(e => console.log('  ' + e)); }
console.log(`\n${pass} passed, ${fail} failed` + (errs.length ? `, ${errs.length} js errors` : ''));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
