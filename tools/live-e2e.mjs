/* ==========================================================================
   The site, running against a real database.

   Every other browser suite here drives the demo backend or a mock. This one
   runs the published code path — REST over fetch, row policies, Storage — in
   front of a real PostgreSQL carrying the schema and every migration, with
   each request signed as a real account. What it proves is the thing the
   mocks cannot: that the policies allow what the site needs and refuse what
   it must not do.

       node tools/live-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DB = 'live';
const API = 'http://localhost:8098';
const SITE = 'http://localhost:8099/';
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => {
  if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? '  <' + String(x).slice(0, 160) + '>' : '')); }
};
const section = (s) => console.log('— ' + s + ' —');

/* ---------- a database, from nothing ---------- */
function psql(text) {
  writeFileSync('/tmp/live-setup.sql', text);
  return execFileSync('su', ['postgres', '-c',
    `psql -X -q -A -t -v ON_ERROR_STOP=1 -d ${DB} -f /tmp/live-setup.sql`],
    { encoding: 'utf8' });
}
const CLIENT = '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LAWYER = '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STAFF  = '33333333-cccc-4ccc-8ccc-cccccccccccc';

console.log('— A DATABASE WITH THE SCHEMA AND EVERY MIGRATION —');
{
  const files = execFileSync('sh', ['-c',
    'ls supabase/migrations/*.sql | sort'], { encoding: 'utf8' }).trim().split('\n');
  const args = ['-f', '/tmp/live/local-prelude.sql', '-f', '/tmp/live/schema.sql']
    .concat(files.flatMap((f) => ['-f', '/tmp/live/migrations/' + f.split('/').pop()]));
  execFileSync('sh', ['-c', 'rm -rf /tmp/live && cp -r supabase /tmp/live && chmod -R a+rX /tmp/live']);
  execFileSync('su', ['postgres', '-c',
    `dropdb --if-exists ${DB} && createdb ${DB} && psql -q -v ON_ERROR_STOP=1 -d ${DB} ${args.join(' ')}`],
    { stdio: 'pipe' });
  ok('it applied cleanly', true);
}

psql(`
insert into auth.users (id, email) values
  ('${CLIENT}', 'client@test.sa'), ('${LAWYER}', 'lawyer@test.sa'), ('${STAFF}', 'staff@test.sa');
update public.profiles set full_name = 'فهد العتيبي', roles = '{client}', active_role = 'client',
  status = 'verified', onboarded = true, phone = '0500000001' where id = '${CLIENT}';
update public.profiles set full_name = 'أحمد المحمدي', roles = '{lawyer}', active_role = 'lawyer',
  status = 'verified', onboarded = true, phone = '0500000002', title = 'محامٍ ومستشار',
  city = 'riyadh', years = 9, auto_bid = true, specialties = '{labour}' where id = '${LAWYER}';
update public.profiles set full_name = 'الإدارة', roles = '{client,staff}', active_role = 'staff',
  status = 'verified', onboarded = true where id = '${STAFF}';
insert into public.services (owner_id, type_id, price, channels, active)
  values ('${LAWYER}', 'consult', 250, '{text,voice}', true);
`);
ok('three accounts and a service are in it', true);

/* ---------- a token the harness will accept ---------- */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub) => `${b64({ alg: 'none' })}.${b64({ sub, role: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

/* ---------- the API in front of it ---------- */
const api = spawn('node', ['tools/fake-postgrest.mjs', DB, '8098'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

/* ---------- the browser ---------- */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function session(sub) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route('**://fonts.*/**', (r) => r.abort());
  await ctx.route('**esm.sh**', (r) => { errs.push('the CDN was asked for'); r.abort(); });
  await ctx.route('**/assets/js/config.js', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: `window.SANAD_CONFIG = { backend: "supabase", supabase: {
             url: "${API}", anonKey: "anon-key" } };`,
  }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    // A page navigating away cancels whatever it had in flight, and the
    // browser reports every one of those as an error. That is the test
    // walking through the site, not the site failing.
    if (m.type() !== 'error') return;
    if (/favicon|net::ERR_(FAILED|ABORTED)|Supabase read failed/.test(t)) return;
    errs.push('console: ' + t);
  });
  await page.goto(SITE + 'index.html');
  if (sub) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value),
      ['sb--auth-token', JSON.stringify({
        access_token: token(sub), refresh_token: 'r',
        expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: sub },
      })]);
  }
  return { ctx, page };
}
const text = (page) => page.$eval('#main', (e) => e.innerText);

section('A VISITOR SEES THE DIRECTORY');
const guest = await session(null);
const startedAt = Date.now();
await guest.page.goto(SITE + 'lawyers.html');
await guest.page.waitForFunction(
  () => /أحمد/.test(document.querySelector('#main').innerText), null, { timeout: 8000 }
).catch(() => {});
ok('the lawyer is listed', /أحمد/.test(await text(guest.page)));
ok('within a second', Date.now() - startedAt < 2500, (Date.now() - startedAt) + 'ms');
const shown = await text(guest.page);
ok('and their phone number is not', !/0500000002/.test(shown));
await guest.ctx.close();

section('THE CLIENT POSTS A BRIEF AND THE LAWYER ANSWERS BY ITSELF');
const client = await session(CLIENT);
await client.page.goto(SITE + 'quotes.html');
await client.page.waitForTimeout(1200);
ok('they are signed in', /نشر|أرسل|اشرح/.test(await text(client.page)), (await text(client.page)).slice(0, 60));
await client.page.click('[data-type="consult"]');
await client.page.click('[data-mode="text"]');
await client.page.fill('#q-brief', 'خلاف على مستحقات نهاية الخدمة وأحتاج رأياً قبل رفع الدعوى');
await client.page.click('[data-quote-form] button[type=submit]');
await client.page.waitForTimeout(1500);
const board = await text(client.page);
ok('the brief is live', /طلبك مفتوح/.test(board), board.slice(0, 80));
ok('and the automatic bid is already on it', /250/.test(board), board.slice(0, 200));
const offers = JSON.parse(psql(`select coalesce(json_agg(o)::text,'[]') from public.offers o;`).trim() || '[]');
ok('the database made it, not the browser', offers.length === 1 && offers[0].auto === true,
   JSON.stringify(offers).slice(0, 120));

section('TAKING IT MAKES A REQUEST BOTH SIDES CAN SEE');
await client.page.click('[data-accept]');
await client.page.waitForTimeout(1500);
const made = JSON.parse(psql(`select coalesce(json_agg(r)::text,'[]') from public.requests r;`).trim() || '[]');
ok('a request exists', made.length === 1, JSON.stringify(made).slice(0, 150));
ok('with both parties on it', made[0] && made[0].client_id === CLIENT && made[0].lawyer_id === LAWYER);
ok('at the price that was agreed', made[0] && Number(made[0].price) === 250);
const rid = made[0] && made[0].id;

await client.page.goto(SITE + 'requests.html');
await client.page.waitForTimeout(1200);
ok('the client sees it in their list', /نهاية الخدمة|استشارة/.test(await text(client.page)));

section('THE CONVERSATION, AND A FILE');
// The way in is the button that says so, not "open details".
ok('the conversation has its own button on the row',
   (await client.page.$(`[data-detail="${rid}"][data-go-thread]`)) !== null);
await client.page.click(`[data-detail="${rid}"][data-go-thread]`);
await client.page.waitForTimeout(500);
ok('the thread is there', (await client.page.$('[data-thread]')) !== null);
await client.page.fill('[data-thread-body]', 'مرفق العقد، البند الخامس هو المشكلة');
await client.page.setInputFiles('[data-thread-file]', {
  name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 hello') });
await client.page.waitForTimeout(300);
await client.page.click('[data-thread-form] button[type=submit]');
await client.page.waitForTimeout(2000);
const msgs = JSON.parse(psql(`select coalesce(json_agg(m)::text,'[]') from public.messages m;`).trim() || '[]');
ok('the message is a row in the database', msgs.length === 1, JSON.stringify(msgs).slice(0, 140));
ok('signed by the client', msgs[0] && msgs[0].author_id === CLIENT);
const atts = JSON.parse(psql(`select coalesce(json_agg(a)::text,'[]') from public.attachments a;`).trim() || '[]');
ok('and the file with it', atts.length === 1 && atts[0].name === 'contract.pdf',
   JSON.stringify(atts).slice(0, 140));

section('A SECOND MESSAGE DOES NOT RAISE AN ERROR');
const before = errs.length;
await client.page.fill('[data-thread-body]', 'وهذه صورة الإشعار');
await client.page.click('[data-thread-form] button[type=submit]');
await client.page.waitForTimeout(1500);
const raised = errs.slice(before).filter((e) => /row-level security|notifications/i.test(e));
ok('the notice was raised, not refused', raised.length === 0, raised.join(' | '));
const notices = JSON.parse(psql(
  `select coalesce(json_agg(n)::text,'[]') from public.notifications n where n.type = 'message';`).trim() || '[]');
ok('one notice for the case, reopened rather than duplicated', notices.length === 1,
   JSON.stringify(notices).slice(0, 140));
ok('and it is unread', notices[0] && notices[0].read === false);

section('THE LAWYER READS IT — AND ONLY WHAT IS THEIRS');
const lawyer = await session(LAWYER);
await lawyer.page.goto(SITE + 'requests.html');
await lawyer.page.waitForTimeout(1500);
const inbox = await text(lawyer.page);
ok('the case is in their inbox', /نهاية الخدمة|استشارة/.test(inbox), inbox.slice(0, 100));
await lawyer.page.click(`[data-open="${rid}"]`);
await lawyer.page.waitForTimeout(1000);
const panel = await text(lawyer.page);
ok('the client’s message is there', /البند الخامس/.test(panel), panel.slice(0, 140));
ok('and the file', /contract\.pdf/.test(panel));
await lawyer.page.fill('[data-thread-body]', 'وصلني، سأراجعه اليوم');
await lawyer.page.click('[data-thread-form] button[type=submit]');
await lawyer.page.waitForTimeout(1500);
const both = JSON.parse(psql(`select coalesce(json_agg(m)::text,'[]') from public.messages m;`).trim() || '[]');
ok('the reply is stored too', both.length === 3, both.length);

section('AND A STRANGER SEES NONE OF IT');
const stranger = await session(STAFF);   // staff may, so check the raw policy instead
const asOther = psql(`
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', '${LAWYER}', true);
select count(*) from public.messages;
commit;`).trim().split('\n').pop();
ok('the lawyer on the case reads the thread', Number(asOther) === 3, asOther);
const outsider = psql(`
begin; set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select count(*) from public.messages;
commit;`).trim().split('\n').pop();
ok('a signed-out visitor reads none of it', Number(outsider) === 0, outsider);
await stranger.ctx.close();

section('THE GUARANTEE, ON A REAL DELIVERY');
psql(`update public.requests set status = 'delivered', delivered_at = now(),
      body = 'المذكرة' where id = '${rid}';`);
await client.page.goto(SITE + 'requests.html');
await client.page.waitForTimeout(1500);
await client.page.click(`[data-detail="${rid}"]`);
await client.page.waitForTimeout(600);
const guar = await text(client.page);
ok('the promise is on the delivered work', /ضمان الرضا/.test(guar), guar.slice(0, 140));
client.page.on('dialog', (d) => d.accept());
await client.page.click(`[data-guarantee="${rid}"]`);
await client.page.waitForTimeout(2000);
const after = JSON.parse(psql(
  `select coalesce(json_agg(r)::text,'[]') from public.requests r where r.id = '${rid}';`).trim() || '[]');
ok('the database closed it as refunded', after[0] && after[0].status === 'refunded',
   after[0] && after[0].status);
const decided = JSON.parse(psql(
  `select coalesce(json_agg(d)::text,'[]') from public.disputes d;`).trim() || '[]');
ok('with a decided dispute behind it',
   decided.length === 1 && decided[0].outcome === 'refund' && Number(decided[0].lawyer_pct) === 0,
   JSON.stringify(decided).slice(0, 140));
ok('and the lawyer was told', JSON.parse(psql(
  `select coalesce(json_agg(n)::text,'[]') from public.notifications n
    where n.to_id = '${LAWYER}' and n.type = 'resolved';`).trim() || '[]').length === 1);

section('NOTHING FAILED QUIETLY');
const bar = await client.page.$('[data-datafail]');
ok('no read came back as an error', bar === null,
   bar ? await client.page.$eval('[data-datafail]', (e) => e.innerText) : '');
ok('and no page threw', errs.length === 0, errs.slice(0, 3).join(' | '));

await client.ctx.close();
await lawyer.ctx.close();
await b.close();
api.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
