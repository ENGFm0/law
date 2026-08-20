/* ==========================================================================
   Do the mappers and the database agree on the column names?

   Everything the site shows passes through a handful of small functions that
   turn a row into the shape the pages speak. A typo in one of them does not
   throw: `new Date(row.at)` where the column is `created_at` produces NaN, a
   date of "Invalid Date", and a list that sorts itself at random. Nothing
   fails; it is just quietly wrong.

   So this reads the column names out of the SQL — the schema plus every
   migration, in order — and checks every column each mapper touches against
   them, in both directions.

       node tools/columns-test.mjs
   ========================================================================== */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (l, c, x) => {
  if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? `  <${x}>` : '')); }
};

/* ---------- the columns the database really has ---------- */
const sql = [join(root, 'supabase/schema.sql')]
  .concat(readdirSync(join(root, 'supabase/migrations')).sort()
    .map((f) => join(root, 'supabase/migrations', f)))
  .map((f) => readFileSync(f, 'utf8')).join('\n');

const columns = {};
const add = (t, c) => { (columns[t] = columns[t] || new Set()).add(c); };

// create table [if not exists] public.<name> ( … );
const CREATE = /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
for (let m; (m = CREATE.exec(sql));) {
  const table = m[1];
  m[2].split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('--')) return;
    const c = /^(\w+)\s+\S/.exec(t);
    if (!c) return;
    const word = c[1].toLowerCase();
    if (['primary', 'unique', 'check', 'constraint', 'foreign', 'references'].includes(word)) return;
    add(table, c[1]);
  });
}
// alter table public.<name> add column [if not exists] <col>
const ALTER = /alter table public\.(\w+)\s+add column (?:if not exists )?(\w+)/g;
for (let m; (m = ALTER.exec(sql));) add(m[1], m[2]);

ok('the schema was parsed at all', Object.keys(columns).length > 12, Object.keys(columns).length);
ok('profiles has the columns everyone reads',
   ['id', 'full_name', 'roles', 'status', 'auto_bid'].every((c) => columns.profiles.has(c)));

/* ---------- what the mappers touch ---------- */
const remote = readFileSync(join(root, 'assets/js/core/store.remote.js'), 'utf8');
const supa = readFileSync(join(root, 'assets/js/core/supabase.js'), 'utf8');

/** The body of `function name(arg) { … }`, and the argument it was given. */
function fn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at === -1) return null;
  const open = src.indexOf('{', at);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  const arg = /\(([^)]*)\)/.exec(src.slice(at, open))[1].trim().split(',')[0].trim();
  return { arg, body: src.slice(open, i) };
}

/** Reading a row: every `arg.column` in the body. */
const READERS = {
  inRequest: 'requests', inService: 'services', inArticle: 'articles',
  inReview: 'reviews', inComment: 'comments', inEndorsement: 'endorsements',
  inDispute: 'disputes', inNotice: 'notifications', inAudit: 'audit_log',
  inSettings: 'platform_settings', inAnnouncement: 'announcements',
  inSubscription: 'subscriptions', inCost: 'operating_costs',
  inPartner: 'partners', inAgreement: 'agreements', inType: 'service_types',
  inQuote: 'quotes', inOffer: 'offers',
};
Object.keys(READERS).forEach((name) => {
  const table = READERS[name];
  const f = fn(remote, name);
  if (!f) { ok(`${name} exists`, false); return; }
  const read = new Set();
  const RE = new RegExp(`\\b${f.arg}\\.(\\w+)`, 'g');
  for (let m; (m = RE.exec(f.body));) read.add(m[1]);
  const missing = [...read].filter((c) => !(columns[table] || new Set()).has(c));
  ok(`${name} reads only columns ${table} has`, missing.length === 0, missing.join(', '));
});

const prof = fn(supa, 'toProfile');
{
  const read = new Set();
  const RE = new RegExp(`\\b${prof.arg}\\.(\\w+)`, 'g');
  for (let m; (m = RE.exec(prof.body));) read.add(m[1]);
  const missing = [...read].filter((c) => !columns.profiles.has(c));
  ok('toProfile reads only columns profiles has', missing.length === 0, missing.join(', '));
}

/** Writing a row: every `row.column =` and every `column:` in a literal. */
function written(src, name) {
  const f = fn(src, name);
  const out = new Set();
  const ASSIGN = /\brow\.(\w+)\s*=/g;
  for (let m; (m = ASSIGN.exec(f.body));) out.add(m[1]);
  const LITERAL = /^\s*(\w+):\s/gm;
  for (let m; (m = LITERAL.exec(f.body));) out.add(m[1]);
  return out;
}
[['fromProfile', supa, 'profiles'], ['outRequest', remote, 'requests'],
 ['outQuote', remote, 'quotes'], ['outType', remote, 'service_types']]
  .forEach(([name, src, table]) => {
    const cols = written(src, name);
    const missing = [...cols].filter((c) => !columns[table].has(c));
    ok(`${name} writes only columns ${table} has`, missing.length === 0, missing.join(', '));
  });

/* ---------- and the tables the hydrate asks for exist ---------- */
{
  const named = new Set();
  const RE = /sb\.from\("(\w+)"\)/g;
  for (let m; (m = RE.exec(supa + remote));) named.add(m[1]);
  const missing = [...named].filter((t) => !columns[t]);
  ok('every table the code queries is in the schema', missing.length === 0, missing.join(', '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
