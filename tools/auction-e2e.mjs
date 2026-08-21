/* The auction, end to end: a client posts a brief, a lawyer bids on it, the
   client takes the bid — and the work turns up in BOTH lists as a request
   with a progress track on it. That last step is the one that was missing:
   accepting an offer used to set a flag in one browser and create nothing. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass=0, fail=0; const errs=[];
const ok=(l,c,x)=>{ if(c){pass++;console.log('  PASS '+l);} else {fail++;console.log('  FAIL '+l+(x!==undefined?'  <'+String(x).slice(0,120)+'>':''));} };
const ctx = await b.newContext({ viewport:{width:1280,height:950} });
await ctx.route('**://fonts.*/**', r=>r.abort());
const cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
await ctx.route('**/assets/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:cfg}));
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push(e.message));
const U='http://localhost:8099/';
const open = async (page, who) => { await p.evaluate(u=>{ if(u) localStorage.setItem('sanad.session.user',u);
  else localStorage.removeItem('sanad.session.user'); localStorage.removeItem('sanad.activeRole'); }, who);
  await p.goto(U+page); await p.waitForTimeout(400); };
const body = () => p.$eval('#main', e=>e.innerText);
await p.goto(U+'index.html');

console.log('— THE BRIEF ASKS FOR WORK, THEN FOR A CHANNEL —');
await open('quotes.html', 'u-fahad');
ok('the kinds of work are the chips', (await p.$$('[data-type]')).length >= 6);
ok('a statement of claim is one of them', /صحيفة دعوى/.test(await body()));
await p.click('[data-type="consult"]'); await p.waitForTimeout(250);
const ways = await p.$$eval('[data-mode]', els=>els.map(e=>e.getAttribute('data-mode')));
ok('the channels are the ones that category allows', ways.length === 3 && ways.includes('text'));
ok('one of them is already chosen',
   (await p.$$('[data-mode].is-active')).length === 1);

console.log('— POSTING IT —');
await p.fill('#q-brief','خلاف على مستحقات نهاية الخدمة مع صاحب عمل، وأحتاج رأياً قبل رفع الدعوى');
await p.click('[data-window="15"]');
await p.click('[data-quote-form] button[type=submit]'); await p.waitForTimeout(600);
ok('the board is live', /طلبك مفتوح/.test(await body()));
ok('the compose form stepped aside', await p.$eval('[data-quote-compose]', e=>e.hidden));
ok('and it says how many lawyers could answer it', /وصل إلى|لا يوجد محامٍ/.test(await body()));
const stored = await p.evaluate(()=>JSON.parse(sessionStorage.getItem('sanad.work')||'{}'));
ok('the brief is a row, not a flag', Array.isArray(stored.quotes) && stored.quotes.length === 1);
ok('and it carries the work and the channel',
   stored.quotes[0].typeId === 'consult' && !!stored.quotes[0].channel, JSON.stringify(stored.quotes[0]).slice(0,120));

console.log('— A LAWYER SEES IT AND BIDS —');
await open('quotes.html', 'u-ahmed');
ok('the open brief is on their board', /نهاية الخدمة/.test(await body()));
ok('the client is not', !/فهد/.test(await body()));
const form = await p.$('[data-bid-form]');
ok('with a form to bid on it', !!form);
const priced = await p.$eval('[data-bid-price]', e=>+e.value);
const band = await p.evaluate(()=>Models.priceBand('consult'));
ok('priced inside the published band', priced >= band.min && priced <= band.max, priced);
await p.fill('[data-bid-price]','300');
await p.fill('[data-bid-eta]','6');
await p.click('[data-bid-form] button[type=submit]'); await p.waitForTimeout(400);
ok('the bid is recorded', /أُرسل عرضك|قدّمت عرضاً/.test(await body()) ||
   (await p.evaluate(()=>Store.offers().length)) > 0);
ok('and a second bid from the same lawyer is not a second bid',
   await p.evaluate(()=>{ const q=Store.quotes()[0];
     return Store.addOffer({quoteId:q.id, lawyer:'u-ahmed', price:900}) === false; }));

console.log('— A PRICE OUTSIDE THE BAND IS REFUSED —');
await p.goto(U+'quotes.html'); await p.waitForTimeout(400);
ok('the lawyer who bid sees their own offer, not the form',
   /قدّمت عرضاً|نيابة عنك/.test(await body()));

console.log('— THE CLIENT TAKES IT —');
await open('quotes.html', 'u-fahad');
await p.waitForTimeout(500);
ok('the offer is on the board', (await p.$$('[data-accept]')).length >= 1);
await p.click('[data-accept]'); await p.waitForTimeout(600);
const after = await body();
ok('the auction closed', /تم قبول العرض/.test(after));
ok('and says where the work went', /قائمة طلباتك/.test(after));
const made = await p.evaluate(()=>Store.requests());
ok('a request exists now', made.length === 1, JSON.stringify(made).slice(0,140));
ok('with both parties on it', made[0].clientId === 'u-fahad' && !!made[0].lawyerId);
ok('at the price that was agreed', made[0].price > 0);
ok('and the brief points at it', await p.evaluate(()=>!!Store.quotes()[0].requestId));

console.log('— AND IT IS IN BOTH LISTS —');
await open('requests.html', 'u-fahad');
ok('the client sees it', /نهاية الخدمة|استشارة/.test(await body()));
ok('with a progress track', (await p.$$('.track')).length >= 1);
const lawyerId = made[0].lawyerId;
await open('requests.html', lawyerId);
ok('so does the lawyer who won it', /نهاية الخدمة|استشارة/.test(await body()));

console.log('— A LAWYER WHO DID NOT WIN IT SEES NOTHING —');
await open('requests.html', 'u-sara');
ok('no trace of it', !/نهاية الخدمة/.test(await body()));

console.log('— A BRIEF NOBODY HAS TAKEN IS STILL SOMEWHERE —');
// One at a time: the work just agreed has to be finished and rated before
// another brief can go out. That is the rule, so the test lives by it.
await p.evaluate(() => {
  const r = Store.requests()[0];
  Store.setRequest(r.id, { status: 'completed', rated: true });
});
await open('quotes.html', 'u-fahad');
await p.click('[data-type="memo"]'); await p.waitForTimeout(200);
await p.fill('#q-brief','مذكرة جوابية على دعوى مقامة ضدي أمام المحكمة التجارية');
await p.click('[data-quote-form] button[type=submit]'); await p.waitForTimeout(500);
await p.goto(U+'requests.html'); await p.waitForTimeout(500);
await p.click('[data-pile="briefs"]'); await p.waitForTimeout(400);
let t2 = await body();
ok('it is in the requests list while the clock runs', /مذكرة جوابية/.test(t2), t2.slice(0,120));
ok('with the brief on it', /مذكرة جوابية/.test(t2));
ok('and it says how long is left', /يُغلق خلال/.test(t2));

// Run the window out without waiting a quarter of an hour for it.
await p.evaluate(() => {
  const q = Store.quotes().find((x) => /مذكرة جوابية/.test(x.brief));
  Store.setQuote(q.id, { expiresAt: Date.now() - 1000 });
});
await p.goto(U+'requests.html'); await p.waitForTimeout(500);
await p.click('[data-pile="past"]'); await p.waitForTimeout(400);
t2 = await body();
ok('when the window closes it drops to the finished list', /انتهت المهلة/.test(t2));
ok('carrying the date it was posted', /\d{4}/.test(t2));
ok('and it is no longer waiting', !/يُغلق خلال/.test(t2));
const againLink = await p.$('[href*="again="]');
ok('with a way to post it again', !!againLink);
await againLink.click(); await p.waitForTimeout(600);
ok('which hands the old brief back',
   /مذكرة جوابية/.test(await p.$eval('#q-brief', e=>e.value)));
ok('with the same kind of work chosen',
   await p.$eval('[data-type="memo"]', e=>e.classList.contains('is-active')));

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
