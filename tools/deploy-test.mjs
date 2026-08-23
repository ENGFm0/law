/* ==========================================================================
   Is this repository still something Vercel will serve?

   The site has no build step: Vercel uploads the files and hands them out.
   That makes two things fatal in a way nothing else in the project is —
   a vercel.json the platform refuses to parse, and anything that talks
   Vercel into running a build. Neither shows up in any browser test,
   because both fail before a single file is served: the deployment is
   rejected and the site simply stays on its last good version, which
   reads exactly like "my changes did not appear".

   The `//` comment key is the one that bit. It is a common JSON-comment
   convention and Vercel's schema forbids unknown properties on a route,
   so every deployment was rejected for a key that did nothing.

       node tools/deploy-test.mjs
   ========================================================================== */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (l, c, x) => { if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? '  <' + String(x).slice(0, 200) + '>' : '')); } };

/* Vercel accepts these on a headers route and nothing else. */
const ROUTE_KEYS = ['source', 'headers', 'has', 'missing'];
const ROOT_KEYS = [
  '$schema', 'headers', 'redirects', 'rewrites', 'cleanUrls', 'trailingSlash',
  'framework', 'buildCommand', 'installCommand', 'outputDirectory',
  'ignoreCommand', 'devCommand', 'regions', 'public', 'github', 'git',
  'images', 'crons', 'functions', 'redirects',
];

console.log('— vercel.json IS SOMETHING VERCEL WILL ACCEPT —');
let cfg = null;
try { cfg = JSON.parse(readFileSync('vercel.json', 'utf8')); } catch (e) { /* reported below */ }
ok('it parses as JSON', cfg !== null);

if (cfg) {
  const badRoot = Object.keys(cfg).filter((k) => ROOT_KEYS.indexOf(k) === -1);
  ok('no unknown key at the top level', badRoot.length === 0, badRoot.join(','));

  const routes = cfg.headers || [];
  ok('there are header routes', routes.length > 0);

  const badRoute = [];
  routes.forEach((r, i) => {
    Object.keys(r).forEach((k) => {
      if (ROUTE_KEYS.indexOf(k) === -1) badRoute.push('headers[' + i + '].' + k);
    });
    (r.headers || []).forEach((h, j) => {
      Object.keys(h).forEach((k) => {
        if (k !== 'key' && k !== 'value') badRoute.push('headers[' + i + '].headers[' + j + '].' + k);
      });
    });
  });
  // A "//" here is the exact key that had every deployment rejected.
  ok('no unknown key on any route — a JSON comment is not a comment here',
     badRoute.length === 0, badRoute.join(','));

  ok('every route names a source', routes.every((r) => typeof r.source === 'string'));
  ok('and every header a key and a value',
     routes.every((r) => (r.headers || []).every((h) => h.key && h.value)));
}

console.log('— AND NOTHING INVITES A BUILD STEP —');
const ignore = existsSync('.vercelignore')
  ? readFileSync('.vercelignore', 'utf8').split('\n').map((l) => l.trim())
  : [];
ok('package.json is kept off the deployment', ignore.indexOf('package.json') !== -1);
ok('so is its lockfile', ignore.indexOf('package-lock.json') !== -1);
ok('and the test tooling', ignore.indexOf('tools/') !== -1);
ok('and the database scripts', ignore.indexOf('supabase/') !== -1);
ok('and the self-test that writes real rows', ignore.indexOf('verify.html') !== -1);
ok('no build command is declared', !cfg || !cfg.buildCommand);

console.log('— EVERY PAGE THE SITE LINKS TO IS A FILE THAT EXISTS —');
const pages = readdirSync('.').filter((f) => f.endsWith('.html'));
const missing = [];
pages.forEach((page) => {
  const html = readFileSync(page, 'utf8');
  // Scripts and stylesheets: a bad path is a page that loads and does nothing.
  const re = /(?:src|href)="((?:assets|tools)\/[^"?#]+)"/g;
  let m;
  while ((m = re.exec(html))) if (!existsSync(m[1])) missing.push(page + ' → ' + m[1]);
});
ok('no page points at a file that is not there', missing.length === 0, missing.join(', '));

const linked = [];
pages.forEach((page) => {
  const html = readFileSync(page, 'utf8');
  const re = /href="([a-z0-9-]+\.html)(?:\?[^"]*)?"/g;
  let m;
  while ((m = re.exec(html))) if (!existsSync(m[1])) linked.push(page + ' → ' + m[1]);
});
ok('and no page links to a page that is not there', linked.length === 0, linked.join(', '));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
