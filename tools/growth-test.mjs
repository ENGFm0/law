/* ==========================================================================
   The three new ways money moves, and the four ways a case is watched.

     • a discount that comes out of the platform's cut and out of nothing else
     • a monthly sponsorship split between the platform and the supervisor
     • a workshop's seats split the same way
     • and the stepper: four roles reading one record and never disagreeing

   Halalas throughout, and the point of the arithmetic is that the shares add
   back up to what was paid — exactly, with no riyal appearing or vanishing.

       node tools/growth-test.mjs
   ========================================================================== */
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

let failed = 0, passed = 0;
const ok = (n,c,x) => { if (c) { passed++; console.log('  PASS '+n); }
  else { failed++; console.log('  FAIL '+n+(x!==undefined?'  <'+JSON.stringify(x)+'>':'')); } };
const R = v => (v/100).toFixed(2);

St.resetWork();
const mk = (price, extra = {}) => St.addRequest(Object.assign(
  { clientId: 'u-fahad', lawyerId: 'u-ahmed', typeId: 'express', price, hours: 4,
    status: 'new', title: { ar:'ت', en:'t' }, brief: { ar:'ب', en:'b' } }, extra));

console.log('— A DISCOUNT COMES OUT OF THE PLATFORM, NOT OUT OF THE WORK —');
const plain = M.distribute(M.request(mk(1000).id));
const cut = plain.commission;
const r1 = mk(1000);
St.setRequest(r1.id, {});
r1.promoCode = 'SANAD10'; r1.promoDiscount = 5000;      // 50 riyals off
const d1 = M.distribute(M.request(r1.id));
ok('the client pays less by exactly the discount',
   d1.client === plain.client - 5000, { was: plain.client, now: d1.client });
ok(`the lawyer's share does not move (${R(d1.lawyer)})`, d1.lawyer === plain.lawyer,
   { was: plain.lawyer, now: d1.lawyer });
ok('and the platform is the one that paid for it',
   d1.commission === cut - 5000, { was: cut, now: d1.commission });
ok('with what it would have earned still on the record', d1.commissionGross === cut);
ok('the code is named beside the number', d1.promoCode === 'SANAD10');

console.log('— AND IT CANNOT COST MORE THAN THE PLATFORM EARNS —');
const r2 = mk(1000);
r2.promoDiscount = 999999;                               // a code gone wrong
const d2 = M.distribute(M.request(r2.id));
ok('a runaway discount is capped at the commission', d2.discount === cut, d2.discount);
ok('the platform gives up all of it and no more', d2.commission === 0, d2.commission);
ok('and still nothing comes out of the lawyer', d2.lawyer === plain.lawyer);

console.log('— THE SHARES STILL ADD BACK UP —');
const back = d1.commission + d1.commissionVat + d1.intern + d1.lawyer + d1.discount;
ok(`${R(back)} back to the ${R(d1.gross)} that was priced`, back === d1.gross,
   { back, gross: d1.gross });

console.log('— AND A RULING ABSORBS IT THE SAME WAY —');
// The decision that shapes this: the discount comes out of the platform's cut
// and out of nothing else, so a ruling that leaves the platform less
// commission leaves it less discount to have funded — and it can never leave
// the platform owing money it did not take.
function ruled(price, discount, outcome, pctFor) {
  St.resetWork();
  const r = mk(price);
  const row = M.request(r.id);
  row.promoCode = 'X'; row.promoDiscount = discount;
  const paid = M.distribute(row).client;
  St.setRequest(r.id, { status: 'delivered', body: 'x' });
  St.openDispute({ requestId: r.id, byId: 'u-fahad', reason: 'ن' });
  const d = St.disputeFor(r.id);
  St.resolveDispute(d.id, { outcome, lawyerPct: pctFor, reason: 'س', byId: 'u-staff' });
  const s = M.settlement(M.request(r.id));
  return { paid, s, out: s.refund + s.commission + s.commissionVat + s.intern + s.lawyer };
}

const rel = ruled(1000, 5000, 'release', 100);
ok('a ruling for the lawyer refunds nothing, not a negative amount',
   rel.s.refund === 0, rel.s.refund);
ok('the platform keeps only what it had not given away',
   rel.s.commission === 5000, rel.s.commission);
ok('the lawyer is paid off the full commission, not the discounted one',
   rel.s.lawyer === 90000, rel.s.lawyer);
ok(`and the ${R(rel.out)} out is the ${R(rel.paid)} that came in`,
   rel.out === rel.paid, rel);

const ref = ruled(1000, 5000, 'refund', 0);
ok('a ruling for the client returns what they PAID, not the list price',
   ref.s.refund === 95000, ref.s.refund);
ok('a refunded order funds no discount at all', ref.s.discount === 0, ref.s.discount);
ok('the platform earns nothing on it', ref.s.commission === 0);
ok('and it balances', ref.out === ref.paid, ref);

const half = ruled(1000, 5000, 'split', 60);
ok('a split leaves the platform the part of its cut it still earns',
   half.s.commission === 1000, half.s.commission);
ok('the client gets back what they paid less what was retained',
   half.s.refund === 40000, half.s.refund);
ok('the lawyer keeps their 60 per cent less the full commission',
   half.s.lawyer === 54000, half.s.lawyer);
ok('and that balances too', half.out === half.paid, half);

const tiny = ruled(1000, 5000, 'split', 10);
ok('a ruling that earns less than the discount caps it there',
   tiny.s.discount === 1000 && tiny.s.commission === 0, tiny.s);
ok('the platform never ends up owing money it did not take',
   tiny.s.commission >= 0 && tiny.out === tiny.paid, tiny);

St.resetWork();

console.log('— A CODE IS WORTH WHAT IT SAYS, OR SAYS WHY NOT —');
St.addPromo({ code: 'sanad10', discountPct: 10 });        // typed in lower case
St.addPromo({ code: 'BIGCUT', discountPct: 50 });
St.addPromo({ code: 'CAPPED', discountPct: 50, maxDiscount: 500 });
St.addPromo({ code: 'OLDONE', discountPct: 50, expiresAt: Date.now() - 1000 });
St.addPromo({ code: 'OFFNOW', discountPct: 50, active: false });
St.addPromo({ code: 'SPENT', discountPct: 50, usageLimit: 2, usedCount: 2 });
St.addPromo({ code: 'MINE', discountPct: 10, clientId: 'u-munira' });

ok('a code is matched however it was typed',
   M.promoValue('  sanad10  ', 25000, 'express', 'u-fahad').discount === 2500);
ok('half of it is capped at the commission, and says so',
   (() => { const v = M.promoValue('BIGCUT', 25000, null, 'u-fahad');
            return v.ok && v.discount === 2500 && v.reason === 'capped'; })(),
   M.promoValue('BIGCUT', 25000, null, 'u-fahad'));
ok('its own ceiling binds first when it is lower',
   M.promoValue('CAPPED', 100000, null, 'u-fahad').discount === 500);
ok('a code nobody issued is unknown',
   M.promoValue('NOPE', 25000, null, 'u-fahad').reason === 'unknown');
ok('an expired one says expired',
   M.promoValue('OLDONE', 25000, null, 'u-fahad').reason === 'expired');
ok('a withdrawn one says withdrawn',
   M.promoValue('OFFNOW', 25000, null, 'u-fahad').reason === 'withdrawn');
ok('one at its limit says used up',
   M.promoValue('SPENT', 25000, null, 'u-fahad').reason === 'used up');
ok('and somebody else’s personal code is not yours',
   M.promoValue('MINE', 25000, null, 'u-fahad').reason === 'not yours');
ok('but is theirs',
   M.promoValue('MINE', 25000, null, 'u-munira').ok === true);

const mine = St.promoByCode('SANAD10');
St.addRedemption({ promoId: mine.id, clientId: 'u-fahad', amount: 2500 });
ok('spending it moves the counter', St.promoByCode('SANAD10').usedCount === 1);
ok('and one person spends it once',
   M.promoValue('SANAD10', 25000, null, 'u-fahad').reason === 'already used');
ok('while it is still there for somebody else',
   M.promoValue('SANAD10', 25000, null, 'u-munira').ok === true);

console.log('— A MONTHLY SPONSORSHIP SPLITS LIKE EVERYTHING ELSE —');
const men = St.openMentorship({ mentorId: 'u-ahmed', internId: 'u-jaid',
                                openedBy: 'intern', fee: 80 });
St.setMentorship(men.id, { status: 'active',
                           paidUntil: Date.now() + 20 * 86400000 });
const sp = M.sponsorship(St.mentorship(men.id));
ok(`80 riyals is ${R(sp.gross)} in halalas`, sp.gross === 8000, sp.gross);
ok(`the platform takes 15 per cent (${R(sp.platform)})`, sp.platform === 1200, sp.platform);
ok(`and the supervisor is owed ${R(sp.lawyer)}`, sp.lawyer === 6800, sp.lawyer);
ok('which adds back up', sp.platform + sp.lawyer === sp.gross);
ok('and this month is paid for', sp.current === true);

const book = M.sponsorshipBook('u-ahmed');
ok('the lawyer’s book counts the trainee', book.active === 1, book);
ok('at what it is worth to them', book.lawyer === 6800, book.lawyer);

console.log('— AND SO DOES A WORKSHOP —');
const w = St.addWebinar({ hostId: 'u-ahmed', title: { ar:'ورشة', en:'W' },
                          seats: 3, price: 100, audience: 'intern',
                          startsAt: new Date(Date.now() + 86400000).toISOString() });
ok('it gets a reference anybody can say', /^WRK-\d\d-\d{5}$/.test(w.ref), w.ref);
ok('a trainee takes a seat', typeof St.takeSeat(w.id, 'u-jaid') === 'object');
ok('at the room’s price, pinned to the seat',
   St.seatOf(w.id, 'u-jaid').price === 100);
ok('and nobody holds two', St.takeSeat(w.id, 'u-jaid') === 'already booked');
St.takeSeat(w.id, 'u-layan');
St.takeSeat(w.id, 'u-turki');
ok('the room closes when it fills', St.webinar(w.id).status === 'full');
ok('and a fourth is refused', St.takeSeat(w.id, 'u-fahad') === 'full');

const t = M.ticketSplit(St.webinar(w.id));
ok(`three seats at 100 is ${R(t.gross)}`, t.gross === 30000, t.gross);
ok(`the platform takes its 10 per cent (${R(t.platform)})`, t.platform === 3000, t.platform);
ok(`the host keeps ${R(t.host)}`, t.host === 27000, t.host);
ok('which adds back up', t.platform + t.host === t.gross);
ok('and the room says it is full', t.left === 0 && t.sold === 3);

St.dropSeat(w.id, 'u-turki');
ok('giving a seat up puts the room back on sale', St.webinar(w.id).status === 'open');
ok('and the takings follow the seats', M.ticketSplit(St.webinar(w.id)).gross === 20000);

console.log('— A SCREENING IS FREE, AND SUPERVISED —');
ok('a supervised trainee may take one', M.canScreen('u-jaid') === true);
ok('with their mentor behind them', M.mentorOf('u-jaid').id === 'u-ahmed');
ok('an unsupervised one may not', M.canScreen('u-layan') === false);
const scr = mk(0, { typeId: M.SCREENING, lawyerId: 'u-ahmed', assignedTo: 'u-jaid' });
ok('and a screening is recognised as one', M.isScreening(M.request(scr.id)) === true);
ok('costing the client nothing', M.distribute(M.request(scr.id)).client === 0);
ok('and earning the platform nothing', M.distribute(M.request(scr.id)).commission === 0);

console.log('— FOUR ROLES, ONE RECORD, NO DISAGREEMENT —');
const life = mk(500);
St.setRequest(life.id, { status: 'in_progress' });
St.setRequest(life.id, { assignedTo: 'u-jaid', status: 'with_intern', internShare: 40 });
St.sendMessage({ requestId: life.id, authorId: 'u-ahmed', audience: 'internal', body: 'راجع' });
St.setRequest(life.id, { status: 'delivered', body: 'المذكرة' });

const asClient = M.stepsFor(M.request(life.id), 'client');
const asLawyer = M.stepsFor(M.request(life.id), 'lawyer');
const asIntern = M.stepsFor(M.request(life.id), 'intern');
const asStaff  = M.stepsFor(M.request(life.id), 'staff');

ok('the client sees five stages', asClient.steps.length === 5);
ok('and is standing at "delivered"', asClient.steps[asClient.at].key === 'delivered');
ok('the lawyer sees six, ending at being paid',
   asLawyer.steps.length === 6 && asLawyer.steps[5].key === 'paid');
ok('and is standing at "delivered" too',
   asLawyer.steps[asLawyer.at].key === 'delivered');
ok('the trainee sees their own four', asIntern.steps.length === 4);
ok('and that the conversation with the lawyer happened',
   asIntern.steps[1].key === 'talking' && asIntern.steps[1].at !== null);
ok('the desk sees the whole thing', asStaff.steps.length === 6);
ok('every one of them agrees on the status',
   asClient.status === 'delivered' && asLawyer.status === 'delivered' &&
   asIntern.status === 'delivered' && asStaff.status === 'delivered');
ok('the stages carry the moment they happened',
   asClient.steps[0].at !== null && asClient.steps[0].at <= asClient.steps[3].at,
   asClient.steps.map(x => x.at));
ok('routing is marked optional, not missing',
   asLawyer.steps[2].key === 'routed' && asLawyer.steps[2].optional === true);
ok('the client is told it is now their move', asClient.waiting === 'you');
ok('and the lawyer that it is not theirs', asLawyer.waiting === 'client');

console.log('— AN OBJECTION HOLDS THE BAR, WHOEVER IS LOOKING —');
St.openDispute({ requestId: life.id, byId: 'u-fahad', reason: 'ناقص' });
['client','lawyer','intern','staff'].forEach(role => {
  const v = M.stepsFor(M.request(life.id), role);
  ok('held for the ' + role, v.held === true && v.waiting === 'staff');
});

console.log('— AND A RECORD WITH NOTHING IN IT STILL DRAWS —');
St.resetWork();
const bare = M.request('r-9');          // a seeded fixture: status, no events
const v = M.stepsFor(bare, 'client');
ok('a fixture with no log falls back to its status',
   v.at === v.steps.length - 1 && v.steps[v.at].key === 'closed', v.at);
ok('and says nothing happened at a time it did not', v.steps[0].at === null);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
