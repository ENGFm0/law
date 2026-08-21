/* ==========================================================================
   How long before there is anything on the page.

   The complaint was precise: open the directory and there are no lawyers on
   it, then a few seconds later there are. Nothing was slow to query — the
   query had not started. Every read waited on a module fetched from a CDN,
   parsed and constructed first.

   This measures the two things that fixes: that a plain visit never asks the
   CDN for anything at all, and that a returning visitor sees the directory
   even with the database unreachable.

       node tools/speed-e2e.mjs
   ========================================================================== */
import { chromium } from 'playwright';
let pass = 0, fail = 0; const errs = [];
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? '  <' + String(x).slice(0, 120) + '>' : '')); } };
const U = 'http://localhost:8099/';

const PROFILES = [
  { id: 'p-1', full_name: 'سلمى العتيبي', roles: ['lawyer'], status: 'verified',
    active_role: 'lawyer', city: 'riyadh', years: 9, specialties: ['labour'],
    onboarded: true, title: 'محامية', bio: 'سيرة' },
  { id: 'p-2', full_name: 'ماجد الحربي', roles: ['lawyer'], status: 'verified',
    active_role: 'lawyer', city: 'jeddah', years: 4, specialties: ['commercial'],
    onboarded: true, title: 'محامٍ', bio: 'سيرة' },
];
const TABLES = {
  profiles: PROFILES,
  services: [{ id: 's-1', owner_id: 'p-1', type_id: 'consult', price: '250.00',
               active: true, channels: ['text'] }],
  service_types: [{ id: 'consult', title_ar: 'استشارة قانونية', title_en: 'Consultation',
                    icon: 'chat', channels: ['text'], sort: 10, active: true }],
  price_bands: [{ type_id: 'consult', min_price: '80.00', max_price: '500.00' }],
  platform_settings: { id: 1, commission_pct: 15, vat_enabled: false, vat_pct: 15 },
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.route('**://fonts.*/**', (r) => r.abort());

let cdnHits = 0;
await ctx.route('**esm.sh**', (r) => { cdnHits++; r.abort(); });

let restHits = 0, firstRestAt = 0, blockRest = false;
const started = { t: 0 };
await ctx.route('**/rest/v1/**', async (r) => {
  if (blockRest) return r.abort();
  restHits++;
  if (!firstRestAt) firstRestAt = Date.now() - started.t;
  const name = new URL(r.request().url()).pathname.split('/').pop();
  const body = Object.prototype.hasOwnProperty.call(TABLES, name) ? TABLES[name] : [];
  // Slow on purpose: this is the network the complaint was about.
  await new Promise((res) => setTimeout(res, 400));
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
});

await ctx.route('**/assets/js/config.js', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: `window.SANAD_CONFIG = { backend: "supabase", supabase: {
           url: "https://proj.supabase.co", anonKey: "pub-key" } };`,
}));

const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));

console.log('— A COLD VISIT ASKS THE DATABASE, NOT A CDN —');
started.t = Date.now();
await p.goto(U + 'lawyers.html');
await p.waitForFunction(() => /سلمى/.test(document.querySelector('#main').innerText), null,
  { timeout: 8000 }).catch(() => {});
const coldMs = Date.now() - started.t;
const text = await p.$eval('#main', (e) => e.innerText);
ok('the directory fills in', /سلمى/.test(text) && /ماجد/.test(text));
ok('nothing was fetched from the CDN', cdnHits === 0, cdnHits);
ok('the first query left almost at once', firstRestAt < 900, firstRestAt + 'ms');
ok('and the page had them well inside a second and a half', coldMs < 1600, coldMs + 'ms');

console.log(`  (first query at ${firstRestAt}ms, list on screen at ${coldMs}ms, ` +
            `${restHits} queries, ${cdnHits} CDN fetches)`);

console.log('— THE SECOND VISIT DOES NOT WAIT AT ALL —');
blockRest = true;                          // the database is now unreachable
await p.goto(U + 'lawyers.html');
await p.waitForTimeout(250);
const warm = await p.$eval('#main', (e) => e.innerText);
ok('the directory is still there', /سلمى/.test(warm), warm.slice(0, 80));
ok('with everyone on it', /ماجد/.test(warm));
const band = await p.evaluate(() => window.Models.priceBand('consult'));
ok('and the prices it was told last time', band.max === 500, JSON.stringify(band));

console.log('— A DATABASE THAT HAS NOT HAD THE MIGRATION RUN YET —');
{
  // PostgREST refuses a whole read for one unknown column name, so the window
  // between a deploy and running the migration by hand would otherwise be a
  // window with an empty directory in it.
  blockRest = false;
  let refusedOnce = false;
  await ctx.unroute('**/rest/v1/**');
  await ctx.route('**/rest/v1/**', async (r) => {
    const url = new URL(r.request().url());
    const name = url.pathname.split('/').pop();
    if (name === 'profiles' && /title/.test(url.search) && !refusedOnce) {
      refusedOnce = true;
      return r.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ code: '42703', message: 'column profiles.title does not exist' }) });
    }
    const body = Object.prototype.hasOwnProperty.call(TABLES, name) ? TABLES[name] : [];
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  const fresh = await ctx.newPage();
  await fresh.evaluate(() => {}).catch(() => {});
  await fresh.goto(U + 'lawyers.html');
  await fresh.waitForTimeout(900);
  await fresh.evaluate(() => localStorage.removeItem('sanad.warm.v1'));
  await fresh.reload();
  await fresh.waitForTimeout(900);
  const t = await fresh.$eval('#main', (e) => e.innerText);
  ok('the directory still fills in', /سلمى/.test(t), t.slice(0, 80));
  ok('after asking again for what the schema does have', refusedOnce);
  await fresh.close();
}

console.log('— A DATABASE ONE MIGRATION BEHIND —');
{
  // The site ships in one push; the SQL is run by hand afterwards. In between,
  // a table simply is not there — and PostgREST says so per request. That is a
  // state, not a fault, and it must not paint a failure bar over a working
  // site.
  await ctx.unroute('**/rest/v1/**');
  let missing = 0;
  await ctx.route('**/rest/v1/**', async (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop();
    // Two the site reads on the way to drawing a directory, so the case is
              // exercised by a visitor who is not signed in.
              if (name === 'announcements' || name === 'reviews') {
      missing++;
      return r.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST205',
          message: `Could not find the table 'public.${name}' in the schema cache` }) });
    }
    const body = Object.prototype.hasOwnProperty.call(TABLES, name) ? TABLES[name] : [];
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  const behind = await ctx.newPage();
  await behind.goto(U + 'lawyers.html');
  await behind.waitForTimeout(900);
  await behind.evaluate(() => localStorage.removeItem('sanad.warm.v1'));
  await behind.reload();
  await behind.waitForTimeout(900);
  const t = await behind.$eval('#main', (e) => e.innerText);
  ok('the missing tables were asked for', missing > 0, missing);
  ok('the site loads anyway', /سلمى/.test(t), t.slice(0, 80));
  ok('with no failure bar over it', await behind.$('[data-datafail]') === null);
  ok('and nothing pretending to be offline', await behind.$('[data-offline]') === null);
  await behind.close();
}

console.log('— NOTHING PRIVATE IS KEPT ON DISK —');
const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('sanad.warm.v1') || '{}'));
ok('the warm copy holds the public lists', Array.isArray(kept.profiles));
ok('and no requests', kept.requests === undefined);
ok('no notifications', kept.notices === undefined);
ok('no ledger', kept.costs === undefined && kept.partners === undefined);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
