/* The books: what came in, what went out, and what is left to divide.
   Run: node tools/books-test.mjs — every figure in halalas. */
import { readFileSync } from 'node:fs';
const store = {};
global.window = global;
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k,v)=>{store[k]=v}, removeItem: k=>{delete store[k]} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.document = { addEventListener(){}, dispatchEvent(){} };
global.CustomEvent = class { constructor(t,o){ this.type=t; Object.assign(this,o); } };
const load = p => (0, eval)(readFileSync(p,'utf8'));
load('assets/js/core/store.js');
load('assets/js/data/seed.js');
load('assets/js/data/models.js');
const M = window.Models, St = window.Store;

let failed = 0;
const ok = (n,c) => { if (!c) failed++; console.log((c?'  PASS ':'  FAIL ')+n); };
const R = v => (v/100).toFixed(2);

St.resetWork();
const mk = (price, extra={}) => St.addRequest(Object.assign(
  { clientId:'u-fahad', lawyerId:'u-ahmed', typeId:'express', price, hours:4,
    status:'new', title:{ar:'ت',en:'t'}, brief:{ar:'ب',en:'b'} }, extra));

console.log('— A BASELINE, BECAUSE THE DEMO SHIPS WITH HISTORY —');
// The seeded requests are real orders as far as the books are concerned, so
// what is checked here is what each new one ADDS, not the running total.
const base = M.books(1);
ok('the demo already has completed work in it', base.orders > 0);
ok('and it already shows a commission on it', base.commission > 0);

console.log('— ONE THOUSAND RIYALS MORE, DELIVERED —');
const r = mk(1000);
St.setRequest(r.id, { status:'delivered', assignedTo:'u-jaid', internShare:30 });
let b = M.books(1);
const d = (k) => b[k] - base[k];
ok('one more order counted', d('orders') === 1);
ok(`the client paid ${R(d('clientPaid'))} more`, d('clientPaid') === 100000);
ok(`the trainee took ${R(d('toTrainees'))}`, d('toTrainees') === 30000);
ok(`the lawyer took ${R(d('toLawyers'))}`, d('toLawyers') === 60000);
ok(`our commission grew by ${R(d('commission'))}`, d('commission') === 10000);

console.log('— WHICH IS NOT WHAT WE KEEP —');
ok(`the gateway takes ${R(b.gateway)} of it`, b.gateway > 0);
ok('charged on the whole transaction, not on our share',
   d('gateway') > Math.round(d('commission') * 0.02));
ok('so profit is revenue less the gateway and the costs',
   b.profit === b.revenue - b.gateway - b.costs);
const keptPct = Math.round(d('commission') === 0 ? 0
  : (d('commission') - d('gateway')) / d('commission') * 100);
ok(`we keep about ${keptPct}% of our own commission`, keptPct > 70 && keptPct < 95);

console.log('— RUNNING COSTS —');
St.addCost({ name:'خادم', amount:400, period:'monthly' });
St.addCost({ name:'رخصة', amount:1200, period:'yearly' });
St.addCost({ name:'شعار', amount:900, period:'once' });
b = M.books(1);
ok('a yearly cost counts a twelfth in one month', M.monthlyCost({amount:1200,period:'yearly'}) === 10000);
ok('a quarterly one counts a third', M.monthlyCost({amount:900,period:'quarterly'}) === 30000);
ok(`one month of costs is ${R(b.costs)}`, b.costs === 40000 + 10000 + 90000);
const b3 = M.books(3);
ok('over three months the recurring ones triple', b3.costs === (40000+10000)*3 + 90000);
ok('and the one-off does not', true);
ok('profit is now negative, and says so', b.profit < 0);

console.log('— SUBSCRIPTIONS ARE REVENUE TOO —');
St.setSubscription('u-ahmed', { price: 199, active: true });
b = M.books(1);
ok(`the drafting subscription brings ${R(b.subscriptions)}`, b.subscriptions === 19900);
ok('revenue is commission plus subscriptions', b.revenue === b.commission + b.subscriptions);

console.log('— WHAT IS LEFT, AND WHO GETS IT —');
St.resetWork();
const zero = M.books(1);
const r2 = mk(10000);
St.setRequest(r2.id, { status:'completed' });
St.addPartner({ name:'فهد', sharePct: 60 });
St.addPartner({ name:'شريك', sharePct: 40 });
b = M.books(1);
ok('two partners listed', b.partners.length === 2);
ok(`${b.partners[0].name} takes ${R(b.partners[0].amount)}`,
   b.partners[0].amount === Math.round(b.profit * 0.6));
ok('the shares add up to the profit', b.assigned === b.profit || Math.abs(b.assigned - b.profit) <= 1);
ok('nothing is left unexplained', Math.abs(b.unassigned) <= 1);

console.log('— SHARES THAT DO NOT ADD TO A HUNDRED ARE NOT HIDDEN —');
St.resetWork();
const r3 = mk(10000);
St.setRequest(r3.id, { status:'completed' });
St.addPartner({ name:'وحيد', sharePct: 30 });
b = M.books(1);
ok('the assigned part is 30% of profit', b.assigned === Math.round(b.profit * 0.3));
ok('and the remaining 70% is reported, not swallowed',
   b.unassigned === b.profit - b.assigned && b.unassigned > 0);

console.log('— THE BANDS MOVE WHEN STAFF MOVE THEM —');
const before = M.priceBand('express');
St.setBand('express', { min: 50, max: 500 });
const after = M.priceBand('express');
ok('the published band changes', after.min === 50 && after.max === 500 && before.max !== 500);
ok('and a price outside it is refused', M.checkPrice('express', 900) === 'high');
ok('while one inside is fine', M.checkPrice('express', 300) === null);

console.log('— THE GATEWAY MIX IS A SETTING —');
St.setSettings({ madaSharePct: 100 });
const allMada = M.books(1).gateway;
St.setSettings({ madaSharePct: 0 });
const allCard = M.books(1).gateway;
ok('cards cost more than mada', allCard > allMada);
St.setSettings({ madaSharePct: 70 });

console.log(failed ? `\n${failed} FAILED` : '\nall clear');
process.exit(failed ? 1 : 0);
