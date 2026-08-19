/* Headless check of the data model — relations, computed rank, price bands,
   request lifecycle, training hours and accounts. Run: node tools/model-test.mjs
   Browser storage is stubbed so the same modules load unchanged. */
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
load('assets/js/core/session.js');
const M = window.Models, S = window.Session, St = window.Store;

const ok = (n,c) => console.log((c?'  PASS ':'  FAIL ')+n);
console.log('— RELATIONS —');
ok('9 seeded professionals + 2 clients', M.users().length === 11);
ok('6 lawyers', M.lawyers().length === 6);
ok('3 trainees', M.interns().length === 3);
const art = M.article('a-6');
const author = M.user(art.authorId);
ok('article resolves its author: ' + author.name.ar, author.id === 'u-jaid');
ok('author link points at the trainee template', M.profileHref(author) === 'intern.html?id=u-jaid');
ok('lawyer link points at the lawyer template', M.profileHref(M.user('u-ahmed')) === 'lawyer.html?id=u-ahmed');
ok('comments resolve to an article', M.commentsOn('a-4').length === 2);
ok('a comment knows its author', M.user(M.commentsOn('a-4')[0].authorId).name.ar === 'منيرة العنزي');

console.log('— RATING & RANK (computed, not stored) —');
const r = M.ratingOf('u-mohammed');
ok(`Al-Fahd rating ${r.avg} from ${r.count}`, r.avg === 5 && r.count === 211);
const board = M.leaderboard('lawyer');
ok('leaderboard sorted by score: ' + board.map(b=>b.score.total).join('>'),
   board.every((b,i,a) => i===0 || a[i-1].score.total >= b.score.total));
const rk = M.rankOf('u-ahmed','lawyer');
ok(`Al-Mohammadi ranks ${rk.rank} of ${rk.of}`, rk.rank >= 1 && rk.of === 6);
const parts = M.scoreOf(M.user('u-ahmed'));
ok(`score breaks down: rating ${parts.rating} + volume ${parts.volume} + speed ${parts.speed} = ${parts.total}`,
   parts.rating + parts.volume + parts.speed === parts.total);

console.log('— SERVICES & PRICE BANDS —');
ok('Al-Mohammadi publishes 5 services', M.servicesOf('u-ahmed').length === 5);
const band = M.priceBand('express');
ok(`express band ${band.min}–${band.max}`, band.min === 60 && band.max === 250);
ok('price under the floor is rejected', M.checkPrice('express', 40) === 'low');
ok('price over the ceiling is rejected', M.checkPrice('express', 900) === 'high');
ok('price inside the band passes', M.checkPrice('express', 99) === null);

console.log('— REQUESTS —');
ok('Fahad has open requests', M.requestsForClient('u-fahad','open').length === 7);
ok('Fahad has past requests', M.requestsForClient('u-fahad','past').length === 2);
St.setRequest('r-3', { status: 'completed' });
ok('completing one moves it to past', M.requestsForClient('u-fahad','past').length === 3);

console.log('— TRAINING HOURS & CERTIFICATE —');
const p1 = M.certProgress('u-jaid');
ok(`Al-Jaid at ${p1.hours}/${p1.needed}h (${p1.pct}%) — not yet eligible`, !p1.eligible && p1.pct === 78);
const p2 = M.certProgress('u-layan');
ok(`Al-Harbi at ${p2.hours}h — eligible`, p2.eligible);
ok('Al-Harbi already holds an endorsement', M.endorsementsFor('u-layan').length === 1);
ok('Al-Jaid holds none yet', M.endorsementsFor('u-jaid').length === 0);
St.setRequest('r-5', { assignedTo: 'u-jaid', status: 'delivered' });
const p3 = M.certProgress('u-jaid');
ok(`delivering an 8h task lifts him to ${p3.hours}h`, p3.hours === 39);

console.log('— ACCOUNTS & SESSION —');
ok('starts as a guest', S.isGuest());
const reg = St.register({ role:'lawyer', name:{ar:'تجربة',en:'Test'}, email:'t@t.sa', password:'x',
                          licenceNumber:'9999', licenceAuthority:'MoJ', licenceExpiry:'2030-01-01' });
ok('registering signs you in', reg.ok && !S.isGuest());
ok('a new lawyer starts pending', S.user().status === 'pending' && !S.isVerified());
ok('duplicate email is refused', St.register({ role:'client', name:{}, email:'T@T.sa' }).error === 'emailTaken');
St.addRole(S.user().id, 'client');
ok('one account can hold two roles: ' + S.myRoles().join('+'), S.myRoles().length === 2);
S.switchRole('client');
ok('switching role changes the active view', S.role() === 'client');
ok('as a client the same account is verified', S.isVerified());
S.signOut();
ok('signing out returns to guest', S.isGuest());
ok('signing back in works', S.signIn('t@t.sa','x').ok);
ok('wrong password is refused', S.signIn('t@t.sa','nope').error === 'badPassword');

console.log('— ROUTING WORK TO TRAINEES —');
// A lawyer may name one trainee, or open the task and let them compete.
St.setRequest('r-6', { status: 'open_to_interns', assignedTo: null });
ok('an opened task is still a live request',
   M.requestsForClient('u-munira', 'open').some(r => r.id === 'r-6'));
ok('it shows up in the open pool', M.openInternTasks().some(r => r.id === 'r-6'));
ok('it belongs to nobody yet', !M.requestsForIntern('u-jaid').some(r => r.id === 'r-6'));
St.apply('r-6', 'u-jaid');
St.apply('r-6', 'u-turki');
ok('two trainees applied', St.applicants('r-6').length === 2);
ok('applying twice changes nothing', St.apply('r-6', 'u-jaid') === false);
St.clearApplicants('r-6');
St.setRequest('r-6', { assignedTo: 'u-turki', status: 'with_intern' });
ok('the chosen trainee holds it', M.requestsForIntern('u-turki').some(r => r.id === 'r-6'));
ok('the pool closes behind it', !M.openInternTasks().some(r => r.id === 'r-6'));
ok('and the applicants are cleared', St.applicants('r-6').length === 0);
