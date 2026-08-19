/* ==========================================================================
   The data layer's contract.

   Everything above core/store.js — sixteen files — reads and writes through
   its forty-odd methods and nothing else. That surface is the seam production
   swaps at: the browser backend goes out, a Supabase-backed one comes in, and
   no page changes.

   This suite states what that seam must do, so the replacement has a target
   rather than an impression. Run it against the current backend today, and
   against the Supabase one before it ships.

       node tools/store-contract.mjs
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* A browser's worth of globals, just enough for the module under test. */
function makeWindow() {
  const mem = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  };
  const w = { localStorage: mem(), sessionStorage: mem() };
  w.document = { dispatchEvent() {}, addEventListener() {} };
  w.CustomEvent = class { constructor(t) { this.type = t; } };
  return w;
}

function loadStore() {
  const w = makeWindow();
  const src = readFileSync(join(root, 'assets/js/core/store.js'), 'utf8');
  new Function('window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', src)(
    w, w.document, w.localStorage, w.sessionStorage, w.CustomEvent);
  return w.Store;
}

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? `  <${extra}>` : '')); }
};
const section = (s) => console.log('— ' + s + ' —');

const S = loadStore();

section('ACCOUNTS');
const reg = S.register({ role: 'client', name: { ar: 'ت', en: 'T' },
  email: 'A@Test.SA', phone: '05', password: 'pw' });
ok('register returns the new account', reg.ok === true && !!reg.user.id);
ok('a client is verified at once', reg.user.status === 'verified');
ok('and it signs them in', S.currentId() === reg.user.id);
ok('email lookup ignores case', S.findAccount('a@test.sa') !== null);
ok('a repeat email is refused',
   S.register({ role: 'client', email: 'a@test.sa', password: 'x' }).error === 'emailTaken');
const lawyer = S.register({ role: 'lawyer', name: { ar: 'م', en: 'L' },
  email: 'l@test.sa', password: 'pw', licenceNumber: '1', specialties: ['labour'] }).user;
ok('a lawyer starts pending', lawyer.status === 'pending');
ok('their licence is kept', lawyer.licence.number === '1');
S.updateAccount(lawyer.id, { bio: 'x' });
ok('an update sticks', S.findAccount('l@test.sa').bio === 'x');
S.addRole(lawyer.id, 'intern', { university: 'KSU' });
ok('one account can hold two roles', S.findAccount('l@test.sa').roles.join() === 'lawyer,intern');

section('SESSION');
S.signOut();
ok('signing out clears the session', S.currentId() === null);
S.signIn(lawyer.id);
ok('signing in restores it', S.currentId() === lawyer.id);

section('REQUESTS');
const r = S.addRequest({ clientId: reg.user.id, lawyerId: lawyer.id, typeId: 'written',
  price: 100, status: 'new', title: { ar: 'ط', en: 'R' } });
ok('a new request gets an id', !!r.id);
ok('and is listed', S.requests().some((x) => x.id === r.id));
ok('its state starts empty', Object.keys(S.requestState(r.id)).length === 0);
S.setRequest(r.id, { status: 'drafted' });
S.setRequest(r.id, { internShare: 40 });
const st = S.requestState(r.id);
ok('patches accumulate rather than replace', st.status === 'drafted' && st.internShare === 40,
   JSON.stringify(st));
S.setRequest(r.id, { assignedTo: null });
ok('an explicit null is stored, not skipped', S.requestState(r.id).assignedTo === null);

section('SERVICES');
const svc = S.addService({ ownerId: lawyer.id, typeId: 'written', price: 120 });
ok('a service gets an id', !!svc.id);
S.removeService(svc.id);
ok('removing drops it from the list', !S.services().some((x) => x.id === svc.id));
ok('and records it as removed', S.removedServices().includes(svc.id));

section('TRAINEES');
ok('nobody has applied yet', S.applicants(r.id).length === 0);
ok('applying is recorded', S.apply(r.id, 'u-jaid') === true);
ok('applying twice is refused', S.apply(r.id, 'u-jaid') === false);
S.clearApplicants(r.id);
ok('the pool can be closed', S.applicants(r.id).length === 0);

const ag = S.addAgreement({ lawyerId: lawyer.id, internId: 'u-jaid', kind: 'cases',
  amount: 800, cases: 5 });
ok('an agreement gets an id and a start', !!ag.id && !!ag.startedAt);
S.addAgreement({ lawyerId: lawyer.id, internId: 'u-jaid', kind: 'monthly', amount: 4500 });
ok('a new one replaces the old for that pair',
   S.agreements().filter((a) => a.internId === 'u-jaid').length === 1);
S.endAgreement(lawyer.id, 'u-jaid');
ok('ending removes it', S.agreements().length === 0);

section('ARTICLES, COMMENTS, REVIEWS');
const a = S.addArticle({ authorId: lawyer.id, title: { ar: 'ع', en: 'T' }, body: { ar: 'ن', en: 'B' } });
ok('an article gets an id', !!a.id);
S.setArticle(a.id, { status: 'published' });
ok('its state is patchable', S.articleState(a.id).status === 'published');
ok('a comment gets an id', !!S.addComment({ articleId: a.id, authorId: reg.user.id }).id);
ok('a review gets an id and a time', !!S.addReview({ targetId: lawyer.id, rating: 5 }).at);
ok('an endorsement gets an id', !!S.addEndorsement({ internId: 'u-jaid', lawyerId: lawyer.id }).id);

section('CHANGE NOTIFICATION');
let fired = 0;
S.onChange(() => { fired++; });
S.addRequest({ clientId: reg.user.id, typeId: 'call', price: 10 });
S.setRequest(r.id, { status: 'delivered' });
ok('every write notifies listeners', fired === 2, String(fired));

section('RESET');
S.resetWork();
ok('resetting work clears the work', S.requests().length === 0 && S.agreements().length === 0);
ok('but keeps the accounts', S.findAccount('l@test.sa') !== null);
ok('and keeps the session', S.currentId() === lawyer.id);
S.resetAll();
ok('resetting everything clears the accounts', S.signups().length === 0);
ok('and signs out', S.currentId() === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
