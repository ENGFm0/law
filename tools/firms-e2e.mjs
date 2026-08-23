/* ==========================================================================
   Law firms, and a paid place at the top.

   A directory of people cannot hold a partnership, so a firm gets a page of
   its own — and a listing that is two separate yeses: the desk says the firm
   is real, a subscription says it is paying. Either one alone is the wrong
   answer, and this follows both. The featured badge is here for the same
   reason: it is sold, so it has to stop when the selling does.

       node tools/firms-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,160)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:1000} });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
const body = () => p.$eval('#main', e=>e.innerText);
const open = async (page, who) => {
  await p.evaluate(u=>{ localStorage.setItem('sanad.session.user',u);
    localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(500);
};
await p.goto(U+'index.html');
await p.evaluate(() => Store.resetWork());

console.log('— A LAWYER STARTS ONE —');
await open('firm.html', 'u-ahmed');
let t = await body();
ok('the page offers it', (await p.$('[data-firm-create]')) !== null, t.slice(0,200));
ok('and says they have none yet', /لا مكتب لك بعد/.test(t));
await p.click('[data-firm-new]'); await p.waitForTimeout(300);
ok('a firm with no name is refused', /اكتب اسم المكتب/.test(await body()));
ok('and nothing was written', await p.evaluate(() => Store.firms().length) === 0);
await p.fill('[data-new-name]', 'مكتب الرياض للمحاماة');
await p.fill('[data-new-bio]', 'قضايا عمالية وتجارية منذ ٢٠١٠');
await p.click('[data-firm-new]'); await p.waitForTimeout(700);
const firm = await p.evaluate(() => Store.firms()[0]);
ok('the firm is written', !!firm, firm);
ok('owned by the lawyer who started it', firm.ownerId === 'u-ahmed');
ok('pending — a firm verifies itself nowhere', firm.status === 'pending', firm.status);
ok('with a reference in the platform’s shape', /^FRM-\d{2}-\d{4}$/.test(firm.ref), firm.ref);
ok('and the page went to it', p.url().indexOf('firm.html?id=') !== -1, p.url());

console.log('— AND IS NOT IN THE DIRECTORY YET —');
ok('not listed', await p.evaluate(id => Models.firmListed(Models.firm(id)), firm.id) === false);
await open('lawyers.html', 'u-fahad');
await p.click('[data-tab="firm"]'); await p.waitForTimeout(400);
ok('the firms tab is there', /مكاتب المحاماة/.test(await body()));
ok('and it is empty', /لا مكاتب مُدرجة/.test(await body()));
await open('firm.html?id=' + firm.id, 'u-fahad');
ok('a stranger cannot read the page either', /لا يوجد مكتب بهذا الرابط/.test(await body()));
await open('firm.html?id=' + firm.id, 'u-ahmed');
ok('the owner can', /مكتب الرياض/.test(await body()));
ok('and is told it is waiting on the desk', /بانتظار اعتماد الإدارة/.test(await body()));

console.log('— THE DESK DECIDES ONE HALF, THE SUBSCRIPTION THE OTHER —');
await open('admin.html?tab=firms', 'u-staff');
t = await body();
ok('the queue is on the desk', /مكتب الرياض/.test(t), t.slice(0,200));
ok('with both decisions on the card',
   (await p.$('[data-firm-ok]')) !== null && (await p.$('[data-firm-sub]')) !== null);
await p.click('[data-firm-ok]'); await p.waitForTimeout(500);
ok('verifying it says so',
   await p.evaluate(id => Models.firm(id).status, firm.id) === 'verified');
ok('but verified alone is not listed',
   await p.evaluate(id => Models.firmListed(Models.firm(id)), firm.id) === false);
ok('and the desk is told exactly that', /الاشتراك غير فعّال|غير مُدرج/.test(await body()));
await p.click('[data-firm-sub]'); await p.waitForTimeout(500);
ok('switching the subscription on lists it',
   await p.evaluate(id => Models.firmListed(Models.firm(id)), firm.id) === true);
ok('the subscription is the firm’s, on the firm plan',
   await p.evaluate(() => { const s = Store.subscriptions()[0];
     return s.plan === 'firm' && s.firmId === Store.firms()[0].id; }));

console.log('— AND SELLING IT DID NOT SWITCH OFF THE DRAFTING TOOL —');
await p.evaluate(() => Store.setSubscription('u-ahmed', { plan: 'ai', price: 300, active: true }));
ok('the drafting subscription stands on its own',
   await p.evaluate(() => Models.subscriptionOf('u-ahmed', 'ai').active) === true);
ok('and so does the firm’s',
   await p.evaluate(() => Models.subscriptionOf('u-ahmed', 'firm').active) === true);
ok('two rows, not one', await p.evaluate(() => Store.subscriptions().length) === 2);

console.log('— NOW IT IS IN THE DIRECTORY —');
await open('lawyers.html', 'u-fahad');
await p.click('[data-tab="firm"]'); await p.waitForTimeout(400);
t = await body();
ok('the firm is listed', /مكتب الرياض/.test(t), t.slice(0,200));
ok('with nobody on the team yet', /لا أعضاء على الصفحة بعد/.test(t));
ok('and a client can open the page', await (async () => {
  await open('firm.html?id=' + firm.id, 'u-fahad');
  return /مكتب الرياض/.test(await body());
})());

console.log('— NOBODY IS PUT ON A TEAM ON THEIR BEHALF —');
await open('firm.html?id=' + firm.id, 'u-ahmed');
await p.fill('[data-invite-who]', 'u-jaid');
await p.selectOption('[data-invite-role]', 'trainee');
await p.click('[data-invite-send]'); await p.waitForTimeout(500);
const invite = await p.evaluate(() => Store.firmMembers()[0]);
ok('an invitation is written', !!invite, invite);
ok('invited, not a member', invite.status === 'invited', invite.status);
ok('the roster does not count them',
   await p.evaluate(id => Models.roster(id).length, firm.id) === 0);
ok('a second invitation to the same person is refused',
   await p.evaluate(id => Store.inviteToFirm(id, 'u-jaid', 'trainee'), firm.id) === 'already');
await open('firm.html?id=' + firm.id, 'u-jaid');
ok('the invited person has no accept button on the firm’s page',
   (await p.$('[data-firm-yes]')) === null);
await open('firm.html', 'u-jaid');
ok('it is waiting on their own page', /دعاك مكتب الرياض للانضمام|دعاك/.test(await body()));
await p.click('[data-firm-yes]'); await p.waitForTimeout(500);
ok('accepting joins them',
   await p.evaluate(() => Store.firmMembers()[0].status) === 'active');
ok('and the roster counts them now',
   await p.evaluate(id => Models.roster(id).length, firm.id) === 1);
await open('firm.html?id=' + firm.id, 'u-fahad');
ok('the team shows on the page', /جعيد|الفريق/.test(await body()));

console.log('— A PLACE AT THE TOP IS SOLD, SO IT STOPS WHEN THE SELLING DOES —');
await open('lawyers.html', 'u-fahad');
ok('no badge on an unpaid lawyer',
   await p.evaluate(() => Models.paidFeatured('u-sara')) === false);
await p.evaluate(() => Store.setSubscription('u-sara', { plan: 'featured', price: 500, active: true }));
await open('lawyers.html', 'u-fahad');
ok('a paid one is badged', /متميّز/.test(await body()));
ok('and is in the featured list',
   await p.evaluate(() => Models.featured().some(u => u.id === 'u-sara')) === true);
await p.evaluate(() => Store.setSubscription('u-sara', { plan: 'featured', active: false }));
await open('lawyers.html', 'u-fahad');
ok('switching it off takes the badge with it',
   await p.evaluate(() => Models.paidFeatured('u-sara')) === false);
ok('and takes them out of the featured list',
   await p.evaluate(() => Models.featured().some(u => u.id === 'u-sara')) === false);

console.log('— AND A PLACEMENT THAT HAS RUN OUT IS NOT A PLACEMENT —');
await p.evaluate(() => Store.updateAccount('u-sara',
  { featuredRank: 1, featuredUntil: new Date(Date.now() - 86400000).toISOString() }));
ok('an expired desk placement is out of the list',
   await p.evaluate(() => Models.featured().some(u => u.id === 'u-sara')) === false);
await open('lawyer.html?id=u-sara', 'u-fahad');
ok('and wears no badge on their page', !/متميّز/.test(await body()));
await p.evaluate(() => Store.updateAccount('u-sara', { featuredUntil: null }));
await open('lawyer.html?id=u-sara', 'u-fahad');
ok('a live one does', /متميّز/.test(await body()));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
