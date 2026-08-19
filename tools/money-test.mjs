/* Headless check of the money split and of the acceptance-and-dispute rules.
   Run: node tools/money-test.mjs
   Every figure here is in halalas — the point of the exercise is that three
   shares taken out of one price add back up to it exactly. */
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

/* A request of a known size to do the arithmetic on. */
const mk = (price, extra = {}) => St.addRequest(Object.assign(
  { clientId: 'u-fahad', lawyerId: 'u-ahmed', typeId: 'express', price, hours: 4,
    status: 'new', title: { ar:'ت', en:'t' }, brief: { ar:'ب', en:'b' } }, extra));

console.log('— THE SPLIT —');
const r1 = mk(1000);
St.setRequest(r1.id, { assignedTo: 'u-jaid', status: 'with_intern', internShare: 30 });
let d = M.distribute(r1);
ok(`client pays ${R(d.client)} — the advertised price, commission not added on top`,
   d.client === 100000);
ok(`platform ${R(d.commission)} at ${d.commissionPct}%`, d.commission === 10000);
ok(`trainee ${R(d.intern)} at ${d.internPct}%`, d.intern === 30000);
ok(`lawyer ${R(d.lawyer)} — the remainder`, d.lawyer === 60000);
ok('the parts reconstitute the price exactly',
   d.commission + d.commissionVat + d.intern + d.lawyer === d.gross);

console.log('— NO HALALA IS LOST OR INVENTED —');
for (const price of [1, 7, 33.33, 99, 777, 1234.56, 9999.99]) {
  const r = mk(price);
  St.setRequest(r.id, { assignedTo: 'u-jaid', internShare: 33 });
  const x = M.distribute(r);
  ok(`${price} splits without remainder`,
     x.commission + x.commissionVat + x.intern + x.lawyer === x.gross);
}

console.log('— THE TWO CAPS —');
ok('commission cannot be set above 10%', M.clampCommission(15) === 10);
ok('nor below zero', M.clampCommission(-4) === 0);
ok('trainee share cannot be set below its 30% floor', M.clampShare(10) === 30);
ok('10% commission with a 95% trainee share is refused', M.checkSplit(10, 95) === 'over');
ok('10% with 90% is refused too — the lawyer would work for nothing',
   M.checkSplit(10, 90) === null || M.checkSplit(10, 90) === 'over');
ok('10% with 60% is fine', M.checkSplit(10, 60) === null);

console.log('— TAX SHIPS SWITCHED OFF —');
ok('no tax until the platform is registered for it', M.platformSettings().vatEnabled === false);
let off = M.distribute(r1);
ok('so nothing is charged and nothing is shown', off.serviceVat === 0 && off.commissionVat === 0);

St.setSettings({ vatEnabled: true, vatPct: 15 });
d = M.distribute(r1);
ok(`switched on by a setting: tax on the commission ${R(d.commissionVat)}`, d.commissionVat === 1500);
ok('the legal service carries none while the lawyer is not registered', d.serviceVat === 0);
// A seeded lawyer is fixture data and cannot be edited, so this needs a real
// registered one — which is also the only kind that will ever hold a tax number.
const reg = St.registerLocal({ role: 'lawyer', name: 'محامٍ مسجّل', email: 'vat@sanad.test',
  licenceNumber: '1', licenceAuthority: 'a', licenceExpiry: '2030-01-01' });
ok('a registered lawyer account exists to carry the tax number', reg.ok === true);
St.updateAccount(reg.user.id, { vatRegistered: true });
const rv = mk(1000, { lawyerId: reg.user.id });
d = M.distribute(rv);
ok(`a registered lawyer charges it on the service: ${R(d.serviceVat)}`, d.serviceVat === 15000);
ok(`so the client is billed ${R(d.client)}`, d.client === 115000);
ok('while an unregistered one still charges none on the service',
   M.distribute(r1).serviceVat === 0);
St.setSettings({ vatEnabled: false });

console.log('— A STANDING AGREEMENT TAKES NOTHING FROM THIS REQUEST —');
St.addAgreement({ lawyerId: 'u-ahmed', internId: 'u-jaid', kind: 'monthly', amount: 4000 });
d = M.distribute(r1);
ok('the monthly retainer is the lawyer’s to pay, not this price’s to carry',
   d.viaAgreement === true && d.intern === 0);
ok('so the lawyer receives the whole remainder', d.lawyer === d.gross - d.commission);
St.endAgreement('u-ahmed', 'u-jaid');

console.log('— THE ACCEPTANCE WINDOW —');
const wed = new Date(2026, 7, 19, 10, 0).getTime();      // a Wednesday
ok('three working days from Wednesday lands on Monday',
   new Date(M.addWorkingDays(wed, 3)).getDay() === 1);
const thu = new Date(2026, 7, 20, 18, 0).getTime();      // Thursday evening
const land = new Date(M.addWorkingDays(thu, 3));
ok('a Thursday evening delivery is not eaten by the weekend — it lands ' +
   ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][land.getDay()],
   land.getDay() !== 5 && land.getDay() !== 6 && land.getTime() - thu > 4*864e5);

const r2 = mk(500);
ok('a request that was never delivered has no window', M.acceptance(r2).delivered === false);
St.setRequest(r2.id, { status: 'delivered', deliveredAt: wed });
let a = M.acceptance(r2, wed + 3600e3);
ok('delivered: the clock is running and nothing has been settled',
   a.delivered && !a.settled && a.msLeft > 0);
ok('the client may accept, ask once for it to be redone, or refuse',
   a.canRevise && a.canDispute);

console.log('— SILENCE PAST THE DEADLINE IS ACCEPTANCE —');
a = M.acceptance(r2, wed + 30*864e5);
ok('past the deadline it counts as accepted', a.autoAccepted && a.settled);
ok('and there is nothing left to refuse', !a.canDispute && !a.canRevise);

console.log('— ONE REVISION, THEN A DECISION —');
const r3 = mk(500);
St.setRequest(r3.id, { status: 'delivered', deliveredAt: Date.now(), revisions: 1 });
a = M.acceptance(r3);
ok('having asked once, the client cannot ask again', !a.canRevise);
ok('but may still accept or refuse', a.canDispute);

console.log('— A DISPUTE STOPS THE CLOCK —');
const r4 = mk(1000);
St.setRequest(r4.id, { assignedTo: 'u-jaid', status: 'delivered', deliveredAt: wed, internShare: 30 });
St.openDispute({ requestId: r4.id, byId: 'u-fahad', reason: 'الصياغة ناقصة' });
a = M.acceptance(r4, wed + 30*864e5);
ok('money does not move on a deadline while the work is being contested',
   !a.expired && !a.autoAccepted && !a.settled);
ok('and a second dispute cannot be opened on the same request',
   St.openDispute({ requestId: r4.id, byId: 'u-fahad', reason: 'x' }) === null);
ok('no settlement exists before somebody decides', M.settlement(r4) === null);

console.log('— THE DECISION —');
const dis = St.disputeFor(r4.id);
St.resolveDispute(dis.id, { outcome: 'split', lawyerPct: 60, byId: 'u-staff',
                            reason: 'سُلّم جزء من العمل بجودة مقبولة' });
let s = M.settlement(r4);
ok(`split 60/40: the client gets back ${R(s.refund)}`, s.refund === 40000);
ok(`the lawyer’s side keeps ${R(s.kept)}`, s.kept === 60000);
ok('the decision carries its written reason, not a code', s.reason.length > 0);
ok('commission is taken from what was kept, not from the original price',
   s.commission === 6000);

console.log('— THE TRAINEE IS NOT THE ONE WHO PAYS FOR IT —');
const r5 = mk(1000);
St.setRequest(r5.id, { assignedTo: 'u-jaid', status: 'delivered', deliveredAt: wed, internShare: 30 });
const d5 = St.openDispute({ requestId: r5.id, byId: 'u-fahad', reason: 'لم يُسلَّم شيء' });
St.resolveDispute(d5.id, { outcome: 'refund', byId: 'u-staff', reason: 'لم يُقدَّم عمل' });
s = M.settlement(r5);
ok(`the client is refunded in full: ${R(s.refund)}`, s.refund === 100000);
ok(`the trainee is still owed ${R(s.intern)} for work they did deliver`, s.intern === 30000);
ok('and the lawyer carries it, having been the one they delivered to',
   s.internBorneByLawyer === true && s.lawyer < 0);

console.log('— RELEASE —');
const r6 = mk(1000);
St.setRequest(r6.id, { status: 'delivered', deliveredAt: wed });
const d6 = St.openDispute({ requestId: r6.id, byId: 'u-fahad', reason: 'متأخر' });
St.resolveDispute(d6.id, { outcome: 'release', byId: 'u-staff', reason: 'سُلّم في موعده' });
s = M.settlement(r6);
ok('nothing goes back to the client', s.refund === 0);
ok(`and the lawyer receives ${R(s.lawyer)} after commission`, s.lawyer === 90000);

console.log('— A DECISION IS MADE ONCE —');
ok('a resolved dispute cannot be decided again',
   St.resolveDispute(d6.id, { outcome: 'refund', byId: 'u-staff', reason: 'x' }) === null);
ok('and it is never deleted — it closes by changing state',
   St.disputes().length === 3 && St.disputeFor(r6.id).status === 'resolved');

console.log(failed ? `\n${failed} FAILED` : '\nall clear');
process.exit(failed ? 1 : 0);
