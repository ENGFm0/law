/* ==========================================================================
   The Supabase backend, driven against a stand-in for supabase-js.

   The real project is unreachable from this environment, but almost none of
   what can go wrong here is network-shaped. It is column names, the direction
   of a mapping, and whether a write reaches the cache before the round trip
   returns. All of that is testable without leaving the machine, and this is
   where the row/object translation is pinned down.

       node tools/remote-store-test.mjs
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0, fail = 0;
const ok = (l, c, x) => {
  if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? `  <${JSON.stringify(x)}>` : '')); }
};
const section = (s) => console.log('— ' + s + ' —');
/* A write updates the cache at once and reaches the database a few microtasks
   later. Let those run before asking what was sent. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/* A fake postgrest: records every call, answers like the real one. */
function makeFake() {
  const sent = [];
  const tables = {
    profiles: [], requests: [], services: [], articles: [],
    reviews: [], comments: [], endorsements: [], agreements: [], applications: [],
    notifications: [], disputes: [], audit_log: [], price_bands: [],
    announcements: [], subscriptions: [], operating_costs: [], partners: [],
    service_types: [], quotes: [], offers: [], messages: [], attachments: [],
  };
  const client = {
    from(table) {
      const q = { table, filters: [] };
      const result = (data) => ({ data, error: null });
      const api = {
        select() { return api; },
        eq(col, val) { q.filters.push([col, val]); return api; },
        single() { return Promise.resolve(result(q.row || { id: 'srv-' + (sent.length) })); },
        insert(row) { q.op = 'insert'; q.row = { id: 'srv-' + sent.length, ...row };
                      sent.push({ ...q }); tables[table].push(q.row); return api; },
        update(row) { q.op = 'update'; q.row = row; sent.push({ ...q }); return api; },
        upsert(row) { q.op = 'upsert'; q.row = { id: 'srv-' + sent.length, ...row };
                      sent.push({ ...q }); return api; },
        delete() { q.op = 'delete'; sent.push({ ...q }); return api; },
        then(res) { return Promise.resolve(result(null)).then(res); },
      };
      return api;
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      signOut: () => Promise.resolve({}),
    },
  };
  return { client, sent, tables, lastTo: (t) => [...sent].reverse().find((s) => s.table === t) };
}

/* Load config → store → the fake SB → the remote backend, in that order. */
function boot(rows = {}) {
  const w = {};
  const mem = () => { const m = new Map(); return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  w.localStorage = mem(); w.sessionStorage = mem();
  // A session this browser already believed in when the page loaded.
  if (rows.session) w.localStorage.setItem('sanad.session.user', rows.session);
  // Enough of a DOM for the one thing the store draws itself: the bar that
  // names a table the database refused to hand over.
  const node = () => ({
    className: '', textContent: '', type: '',
    setAttribute() {}, appendChild() {}, addEventListener() {},
    querySelector: () => node(),
  });
  w.document = {
    dispatchEvent() {}, addEventListener() {},
    querySelector: () => null, createElement: node, body: node(),
    documentElement: node(),
  };
  w.CustomEvent = class { constructor(t) { this.type = t; } };
  w.console = console;
  w.REST = {
    session: () => (rows.authId ? { sub: rows.authId, token: 't', expired: false } : null),
    upload: () => Promise.resolve({ path: 'p', error: null }),
    signUrl: () => Promise.resolve('https://signed.example/x'),
    forget() {},
  };

  new Function('window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent',
    read('assets/js/core/store.js'))(w, w.document, w.localStorage, w.sessionStorage, w.CustomEvent);

  const fake = makeFake();
  let hydrated = 0;
  w.SB = {
    configured: () => true,
    load: () => Promise.resolve(fake.client),
    currentId: () => Promise.resolve(rows.authId || null),
    fromProfile: (d) => {
      const f = (v) => (v && typeof v === 'object' ? (v.ar || v.en || null) : (v ?? null));
      return { full_name: f(d.name), phone: d.phone || null, bio: f(d.bio) };
    },
    CORE: ['profiles', 'services', 'service_types', 'price_bands',
           'platform_settings', 'reviews', 'announcements'],
    REST: ['requests', 'articles', 'comments', 'endorsements', 'agreements',
           'disputes', 'notifications', 'audit_log', 'subscriptions',
           'operating_costs', 'partners', 'quotes', 'offers'],
    hydrate: (names) => {
      hydrated++;
      const all = {
        profiles: rows.profiles || [], services: rows.services || [],
        service_types: rows.types || [], price_bands: rows.bands || [],
        platform_settings: rows.settings || null,
        reviews: [], announcements: [],
        requests: rows.requests || [], articles: rows.articles || [],
        comments: [], endorsements: [], agreements: rows.agreements || [],
        disputes: rows.disputes || [], notifications: rows.notices || [],
        audit_log: rows.audit || [], subscriptions: [],
        operating_costs: [], partners: [],
        quotes: rows.quotes || [], offers: rows.offers || [],
      };
      const want = names || Object.keys(all);
      const out = {};
      // What the 500 looked like from in here: the read did not come back
      // empty, it did not come back at all.
      const broken = rows.failFrom && hydrated >= rows.failFrom;
      want.forEach((n) => { out[n] = broken ? null : all[n]; });
      return Promise.resolve({
        rows: out,
        wave: want,
        errors: broken && want.includes('profiles')
          ? [{ table: 'profiles', code: '42P17',
               message: 'infinite recursion detected in policy for relation "profiles"' }]
          : (rows.errors || []),
      });
    },
    profile: () => Promise.resolve(null),
    toProfile: (row) => ({
      id: row.id, name: { ar: row.full_name || '', en: row.full_name || '' },
      email: row.email || '', roles: row.roles || ['client'],
      activeRole: row.active_role || (row.roles || ['client'])[0],
      status: row.status || 'pending', onboarded: !!row.onboarded,
      autoBid: !!row.auto_bid, phone: row.phone || '', city: row.city || '',
      specialties: row.specialties || [], years: row.years || 0,
      bio: { ar: '', en: '' }, title: { ar: '', en: '' }, avatar: null,
      licence: null, university: { ar: '', en: '' }, level: { ar: '', en: '' },
      skills: [], completed: 0, responseHours: 12,
      seedRating: 0, seedReviews: 0, seedHours: 0,
      featuredRank: row.featured_rank == null ? null : row.featured_rank,
    }),
  };

  new Function('window', 'document', 'localStorage', 'sessionStorage', 'console',
    read('assets/js/core/store.remote.js'))(w, w.document, w.localStorage, w.sessionStorage, console);
  return { S: w.Store, fake, w };
}

section('HYDRATION MAPS COLUMNS TO THE SHAPES PAGES EXPECT');
{
  const { S } = boot({
    requests: [{ id: 'r1', client_id: 'c1', lawyer_id: 'l1', assigned_to: 'i1',
      type_id: 'written', title: 'عنوان', brief: 'نبذة', price: '100.00',
      status: 'with_intern', ai_assisted: true, hours: 5, intern_share: 40 }],
    services: [{ id: 's1', owner_id: 'l1', type_id: 'call', price: '150.00',
      title: 'اسمي', meta: 'مدتي', active: true }],
    agreements: [{ id: 'a1', lawyer_id: 'l1', intern_id: 'i1', kind: 'cases',
      amount: '800.00', cases: 5 }],
  });
  await S.hydrate();
  const r = S.requests()[0];
  ok('snake_case becomes camelCase', r.clientId === 'c1' && r.lawyerId === 'l1');
  ok('the trainee assignment survives', r.assignedTo === 'i1');
  ok('a numeric string becomes a number', r.price === 100 && typeof r.price === 'number');
  ok('bilingual text is wrapped as a pair', r.title.ar === 'عنوان' && r.title.en === 'عنوان');
  ok('the share is carried', r.internShare === 40);
  ok('ai_assisted becomes ai', r.ai === true);
  const s = S.services()[0];
  ok('a service keeps the lawyer’s own wording', s.title.ar === 'اسمي' && s.meta.ar === 'مدتي');
  ok('and its price is a number', s.price === 150);
  const g = S.agreements()[0];
  ok('an agreement maps both parties', g.lawyerId === 'l1' && g.internId === 'i1');
  ok('and its amount', g.amount === 800 && g.cases === 5);
}

section('A READ THAT FAILED IS NOT A READ THAT CAME BACK EMPTY');
{
  const { S } = boot({
    profiles: [{ id: 'p1', full_name: 'اسم', roles: ['client'] }],
    requests: [{ id: 'r1', client_id: 'p1', type_id: 'consult', title: 't', price: '10' }],
    // Each Store.hydrate() is two waves, so the second call is the third read.
    failFrom: 3,
  });
  await S.hydrate();
  ok('a good read fills the cache', S.signups().length === 1 && S.requests().length === 1);
  await S.hydrate();
  ok('a failing read does not empty it', S.signups().length === 1, S.signups());
  ok('nor anything else on the page', S.requests().length === 1);
}

section('A SESSION THE SERVER NO LONGER HOLDS');
{
  // The browser remembers somebody; the provider does not. This is the state
  // that produced "new row violates row-level security policy" — every read
  // went through because most of them are public, and the first write went
  // out with no token on it.
  const { S, fake } = boot({ session: 'someone' });
  ok('the browser starts out believing it', S.currentId() === 'someone');
  await flush(); await flush();
  // The local session is deliberately left alone. Clearing it here emptied
  // and refilled the header on every navigation, which reads as being logged
  // out and back in — the exact flicker the remembered profile exists to
  // prevent. What changes is that nothing is addressed to a session that
  // does not exist.
  ok('the page is not torn down under whoever is reading it', S.currentId() === 'someone');
  ok('but the server-side identity is known to be missing', S.authId() === null);
  const refused = S.addOffer({ quoteId: 'q1', lawyer: 'someone', price: 100 });
  ok('and a write is refused here rather than by the database', refused === false);
  ok('with nothing sent', !fake.lastTo('offers'));
}
{
  const { S } = boot({ authId: 'auth-1' });
  await flush(); await flush();
  ok('a live session is kept', S.authId() === 'auth-1');
}

section('A WRITE IS ADDRESSED WITH THE ID THE SERVER WILL CHECK');
{
  const { S, fake } = boot({ authId: 'auth-1' });
  await S.hydrate();
  await flush();
  S.openQuote({ clientId: 'stale-id', typeId: 'consult', channel: 'text',
                brief: 'x', expiresAt: Date.now() + 60000 });
  await flush();
  const wrote = fake.lastTo('quotes');
  ok('the brief is posted as the signed-in account, not the remembered one',
     wrote.row.client_id === 'auth-1', wrote.row);
}

section('THE CATALOGUE AND THE AUCTION COME BACK AS OBJECTS');
{
  const { S, fake } = boot({
    authId: 'l2',
    types: [{ id: 'company', title_ar: 'تأسيس شركة', title_en: 'Company formation',
              meta_ar: 'من الصفر', icon: 'briefcase', channels: ['text', 'video'],
              sort: 70, active: true }],
    quotes: [{ id: 'q1', client_id: 'c1', type_id: 'consult', channel: 'text',
               brief: 'سؤال', status: 'open', expires_at: '2030-01-01T00:00:00Z',
               created_at: '2026-01-01T00:00:00Z' }],
    offers: [{ id: 'o1', quote_id: 'q1', lawyer_id: 'l1', price: '250.00', eta: 6,
               auto: true, created_at: '2026-01-01T00:00:00Z' }],
  });
  await S.hydrate();
  const t = S.types()[0];
  ok('a category carries both languages', t.title.ar === 'تأسيس شركة' && t.title.en === 'Company formation');
  ok('and the channels it allows', t.channels.length === 2);
  const q = S.quotes()[0];
  ok('a brief maps its columns', q.clientId === 'c1' && q.typeId === 'consult');
  ok('and its deadline is a number', typeof q.expiresAt === 'number');
  const o = S.offersOn('q1')[0];
  ok('an offer maps to the lawyer who made it', o.lawyer === 'l1' && o.price === 250);
  ok('and says it was made automatically', o.auto === true);

  S.addOffer({ quoteId: 'q1', lawyer: 'l2', price: 300, eta: 3 });
  await flush();
  const wrote = fake.lastTo('offers');
  ok('a bid is written as a row', wrote.op === 'insert' && wrote.row.lawyer_id === 'l2');
  ok('and shows on the board before the round trip', S.offersOn('q1').length === 2);

  S.setQuote('q1', { status: 'accepted', acceptedBy: 'l1' });
  await flush();
  const closed = fake.lastTo('quotes');
  ok('closing it is an update, not an insert', closed.op === 'update');
  ok('carrying the winner', closed.row.accepted_by === 'l1' && closed.row.status === 'accepted');

  S.addType({ id: 'x', title: { ar: 'أ', en: 'B' }, channels: ['text'], active: true });
  await flush();
  const cat = fake.lastTo('service_types');
  ok('a category is written flat', cat.row.title_ar === 'أ' && cat.row.title_en === 'B');
}

section('THE CONVERSATION GOES TO THE DATABASE, THE FILE TO STORAGE');
{
  const { S, fake, w } = boot({ authId: 'me-1', session: 'me-1' });
  await S.hydrate();
  await flush();

  S.sendMessage({ requestId: 'r-1', audience: 'parties', authorId: 'stale', body: 'مرحبا' });
  await flush();
  const wrote = fake.lastTo('messages');
  ok('a message is a row', wrote.op === 'insert' && wrote.row.request_id === 'r-1');
  ok('signed by the session, not by whoever asked', wrote.row.author_id === 'me-1', wrote.row);
  ok('carrying which thread it belongs to', wrote.row.audience === 'parties');
  ok('and it shows before the round trip', S.messages('r-1', 'parties').length === 1);

  // The upload is the part that must happen first: a row pointing at an
  // object that was never written shows a file nobody can open.
  const uploads = [];
  w.REST.upload = (bucket, path, file) => {
    uploads.push({ bucket, path, file });
    return Promise.resolve({ path, error: null });
  };
  S.attachFile({ requestId: 'r-1', messageId: 'm-1', authorId: 'me-1',
                 name: 'عقد العمل.pdf', size: 1200, mime: 'application/pdf',
                 file: { name: 'x' } });
  await flush(); await flush();
  ok('the file went to the private bucket', uploads[0] && uploads[0].bucket === 'case-files');
  ok('into the case’s own folder', /^r-1\//.test(uploads[0].path), uploads[0] && uploads[0].path);
  ok('with a name a URL can carry', !/\s/.test(uploads[0].path), uploads[0].path);
  const row = fake.lastTo('attachments');
  ok('and the row followed it', row && row.op === 'insert' && row.row.path === uploads[0].path);
  ok('keeping the name a person typed', row.row.name === 'عقد العمل.pdf');
}
{
  // An upload that fails must not leave a row, or a chip, behind.
  const { S, fake, w } = boot({ authId: 'me-1', session: 'me-1' });
  await S.hydrate();
  await flush();
  w.REST.upload = () => Promise.resolve({ path: null, error: { message: 'too big', code: '413' } });
  S.attachFile({ requestId: 'r-1', authorId: 'me-1', name: 'big.pdf', size: 99, mime: 'application/pdf', file: {} });
  await flush(); await flush();
  ok('a failed upload writes no row', !fake.lastTo('attachments'));
  ok('and takes its chip back off the thread', S.filesOf('r-1', 'parties').length === 0);
}

section('A REQUEST REPORTS THE ID THE DATABASE GAVE IT');
{
  const { S } = boot();
  await S.hydrate();
  let landed = null;
  S.addRequest({ clientId: 'c1', lawyerId: 'l1', typeId: 'consult', price: 200 },
               (saved) => { landed = saved; });
  await flush();
  ok('the callback runs once the row exists', landed !== null);
  ok('with the server id, not the placeholder',
     landed && /^srv-/.test(landed.id), landed && landed.id);
}

section('THE ROW IS THE STATE — NO OVERLAY');
{
  const { S } = boot({ requests: [{ id: 'r1', client_id: 'c1', type_id: 'written',
    title: 't', price: '10', status: 'drafted', body: 'نص', intern_share: 55 }] });
  await S.hydrate();
  const st = S.requestState('r1');
  ok('state reads straight off the row', st.status === 'drafted' && st.body === 'نص');
  ok('including the share', st.internShare === 55);
  ok('an unknown id gives an empty state', Object.keys(S.requestState('nope')).length === 0);
  ok('nothing is shadow-deleted any more', S.removedServices().length === 0);
}

section('WRITES REACH THE CACHE AT ONCE, AND THE DATABASE BEHIND');
{
  const { S, fake } = boot();
  await S.hydrate();

  S.addRequest({ clientId: 'c1', lawyerId: 'l1', typeId: 'written',
    title: { ar: 'ط', en: 'R' }, brief: { ar: 'ب', en: 'B' }, price: 100, ai: true });
  ok('the cache has it before any round trip', S.requests().length === 1);
  await flush();
  const ins = fake.lastTo('requests');
  ok('it was sent as an insert', ins.op === 'insert');
  ok('with snake_case columns', 'client_id' in ins.row && 'type_id' in ins.row, Object.keys(ins.row));
  ok('and the pair flattened to one string', ins.row.title === 'ط');
  ok('ai maps back to ai_assisted', ins.row.ai_assisted === true);

  S.setRequest(S.requests()[0].id, { status: 'delivered', internShare: 45 });
  ok('the cached row updates', S.requestState(S.requests()[0].id).status === 'delivered');
  await flush();
  const upd = fake.lastTo('requests');
  ok('an update was sent', upd.op === 'update');
  ok('with only the columns that changed',
     Object.keys(upd.row).sort().join() === 'intern_share,status', Object.keys(upd.row));

  S.addService({ ownerId: 'l1', typeId: 'call', price: 150, title: { ar: 'خ', en: 'S' } });
  await flush();
  ok('a service insert carries owner_id', fake.lastTo('services').row.owner_id === 'l1');
  S.removeService(S.services()[0].id);
  await flush();
  ok('removing really deletes rather than shadows',
     fake.lastTo('services').op === 'delete' && S.services().length === 0);
}

section('AGREEMENTS AND APPLICATIONS');
{
  const { S, fake } = boot();
  await S.hydrate();
  S.addAgreement({ lawyerId: 'l1', internId: 'i1', kind: 'cases', amount: 800, cases: 5 });
  S.addAgreement({ lawyerId: 'l1', internId: 'i1', kind: 'monthly', amount: 4500 });
  ok('a second agreement replaces the first for that pair', S.agreements().length === 1);
  await flush();
  ok('and it upserts rather than inserting twice', fake.lastTo('agreements').op === 'upsert');
  S.endAgreement('l1', 'i1');
  await flush();
  ok('ending it clears the cache and deletes',
     S.agreements().length === 0 && fake.lastTo('agreements').op === 'delete');

  ok('a trainee can apply once', S.apply('r1', 'i1') === true);
  ok('and not twice', S.apply('r1', 'i1') === false);
  await flush();
  ok('the application was sent', fake.lastTo('applications').row.intern_id === 'i1');
  S.clearApplicants('r1');
  ok('closing the pool empties it', S.applicants('r1').length === 0);
}

section('ACCOUNTS');
{
  const { S, fake } = boot({ profiles: [
    { id: 'p1', email: 'A@Test.SA', name: { ar: 'أ', en: 'A' }, roles: ['client'] }] });
  await S.hydrate();
  ok('profiles fill the account list', S.signups().length === 1);
  ok('lookup by email ignores case', S.findAccount('a@test.sa') !== null);
  S.updateAccount('p1', { bio: { ar: 'س', en: 'B' } });
  await flush();
  ok('the cached profile changed', S.signups()[0].bio.ar === 'س');
  ok('and only real columns were sent', 'bio' in fake.lastTo('profiles').row);
  ok('status is never sent from here', !('status' in fake.lastTo('profiles').row));
}

section('THE DESK COMES FROM THE DATABASE, NOT FROM THIS BROWSER');
{
  const { S } = boot({
    disputes: [{ id: 'd1', request_id: 'r1', by_id: 'c1', reason: 'ناقص',
      status: 'resolved', outcome: 'split', lawyer_pct: 60,
      resolution_reason: 'سُلّم أغلبه', resolved_by: 's1',
      resolved_at: '2026-08-19T10:00:00Z', created_at: '2026-08-19T09:00:00Z' }],
    notices: [{ id: 'n1', to_id: 'c1', type: 'delivered', ref: 'r1', read: false,
                at: '2026-08-19T09:00:00Z' },
              { id: 'n2', to_id: 'c1', type: 'resolved', ref: 'r1', read: true,
                at: '2026-08-19T10:00:00Z' }],
    audit: [{ id: 'a1', action: 'approve', by_id: 's1', target_id: 'l1',
              subject: 'محامٍ', at: '2026-08-19T08:00:00Z' }],
    settings: { id: 1, commission_pct: 7, vat_enabled: true, vat_pct: 15 },
  });
  await S.hydrate();

  const d = S.disputes()[0];
  ok('a dispute keeps the request it belongs to', d.requestId === 'r1' && d.byId === 'c1');
  ok('a decided one carries its outcome and share',
     d.resolution.outcome === 'split' && d.resolution.lawyerPct === 60);
  ok('and the reason it was decided on', d.resolution.reason === 'سُلّم أغلبه');
  ok('naming who decided', d.resolution.byId === 's1');
  ok('timestamps become numbers the model can compare', typeof d.at === 'number' && d.at > 0);
  ok('disputeFor finds it by request', S.disputeFor('r1') === d);
  ok('and returns null where there is none', S.disputeFor('r-nope') === null);

  ok('notices arrive with their owner', S.notices()[0].to === 'c1');
  ok('and their read state', S.notices()[0].read === false && S.notices()[1].read === true);
  ok('the record arrives as the desk shows it', S.audit()[0].action === 'approve');
  ok('settings come from the one row', S.settings().commissionPct === 7);
  ok('including whether tax is switched on', S.settings().vatEnabled === true);

  S.setSettings({ commissionPct: 5 });
  ok('changing a setting is visible immediately', S.settings().commissionPct === 5);

  S.notify({ to: 'c1', type: 'rated', ref: 'r9' });
  ok('a new notice lands in the list', S.notices().length === 3);
  S.notify({ to: 'c1', type: 'rated', ref: 'r9' });
  ok('and the same event twice stays one', S.notices().length === 3);

  ok('a dispute cannot be opened twice on one request',
     S.openDispute({ requestId: 'r1', byId: 'c1', reason: 'x' }) === null);
  ok('nor decided twice',
     S.resolveDispute('d1', { outcome: 'refund', byId: 's1', reason: 'y' }) === null);

  S.log({ action: 'resolve', byId: 's1', subject: 'split' });
  ok('the record is appended to at the top', S.audit()[0].action === 'resolve');
  ok('and keeps what was already there', S.audit().length === 2);
}

section('AN ACCOUNT THAT MAY READ NOTHING STILL STARTS');
{
  const { S } = boot({});
  await S.hydrate();
  ok('a table that came back empty is empty, not a crash',
     S.disputes().length === 0 && S.notices().length === 0 && S.audit().length === 0);
  ok('and settings fall back rather than throwing', typeof S.settings() === 'object');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
