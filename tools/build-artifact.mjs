/* ==========================================================================
   Bundles the multi-page site into one self-contained HTML file.
   The Artifact host serves a single document, so every page becomes a hash
   route and every asset is inlined — no network fetch at runtime except the
   Google Fonts stylesheet, which degrades to system fonts.

   Each page's script is registered with Pages.define(), so the router can run
   it again whenever it swaps that view back in.

   Usage: node tools/build-artifact.mjs
   Output: dist/sanad.html
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/* Each route: which file it comes from, which element holds the view, and the
   page identity that pages.js and the nav highlight both key off. */
const ROUTES = [
  { name: 'index',     script: 'home',      page: 'home' },
  { name: 'requests',  script: 'requests',  page: 'requests' },
  { name: 'services',  script: 'services',  page: 'services' },
  { name: 'lawyers',   script: 'lawyers',   page: 'lawyers' },
  { name: 'lawyer',    script: 'lawyer',    page: 'lawyers' },
  { name: 'intern',    script: 'intern',    page: 'lawyers' },
  { name: 'blog',      script: 'blog',      page: 'blog' },
  { name: 'article',   script: 'article',   page: 'blog' },
  { name: 'editor',    script: 'editor',    page: 'blog' },
  { name: 'quotes',    script: 'quotes',    page: 'quotes' },
  { name: 'assistant', script: 'assistant', page: 'assistant' },
  { name: 'account',   script: 'account',   page: 'account' },
  { name: 'about',     script: 'about',     page: 'about' },
  { name: 'login',     script: 'login',     page: 'login' },
  { name: 'signup',    script: 'signup',    page: 'signup' },
  { name: 'call',      script: 'call',      page: 'requests' },
  { name: 'admin',     script: 'admin',     page: 'admin' },
];

/** Pull the view out of a page — everything between <main> and </main>. */
function extractView(html, file) {
  const start = html.indexOf('<main id="main"');
  const end = html.indexOf('</main>');
  if (start === -1 || end === -1) throw new Error(`<main> not found in ${file}`);
  return html.slice(start, end + '</main>'.length);
}

function titleKeyOf(html) {
  const m = html.match(/data-title-key="([\w.]+)"/);
  if (!m) throw new Error('data-title-key missing');
  return m[1];
}

/* Inline every SVG in assets/img as a data URI, keyed by filename. */
const assets = {};
for (const file of readdirSync(join(root, 'assets/img'))) {
  if (!file.endsWith('.svg')) continue;
  assets[file] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(read('assets/img/' + file));
}

const routeMap = {};
for (const r of ROUTES) {
  const html = read(r.name + '.html');
  routeMap[r.name] = {
    page: r.page,
    script: r.script,
    titleKey: titleKeyOf(html),
    html: extractView(html, r.file || r.name + '.html'),
  };
}

const css = read('assets/css/style.css');

/* The same dependency order the page shells use, then every page module. */
const core = [
  'config', 'core/theme', 'core/i18n', 'core/store', 'data/seed', 'data/models',
  'core/session', 'core/rest', 'core/supabase', 'core/store.remote', 'core/signal', 'core/rtc', 'ui/icons',
  'core/app', 'ui/layout', 'ui/components',
].map((n) => read(`assets/js/${n}.js`)).join('\n');

const pageScripts = ROUTES
  .map((r) => r.script)
  .filter((n, i, all) => all.indexOf(n) === i)
  .map((n) => read(`assets/js/pages/${n}.js`))
  .join('\n');

const router = read('tools/router.js');

/* charset first: the encoding pre-scan reads the opening bytes of the served
   document, and this page is mostly Arabic. */
const out = `<meta charset="utf-8">
<title>سند | Sanad</title>
<meta name="description" content="منصة سند للاستشارات القانونية — واجهة عربية أولاً مع دعم الإنجليزية، ووضع ليلي ونهاري.">
<meta name="theme-color" content="#f7f8fd">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap">

<style>
${css}

/* --- bundle-only: the router swaps views inside #app --- */
#app { display: flex; flex-direction: column; flex: 1; }
#app > main { flex: 1; }
</style>

<a class="skip-link" href="#main" data-i18n="a11y.skip">تخطي إلى المحتوى</a>

<div data-slot="header"></div>

<div id="app"></div>

<div data-slot="footer"></div>

<script>window.__SPA__ = true;
window.__ASSETS__ = ${JSON.stringify(assets)};
window.__ROUTES__ = ${JSON.stringify(routeMap)};
</script>
<script>${core}</script>
<script>${pageScripts}</script>
<script>${router}</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/sanad.html'), out, 'utf8');
console.log(`dist/sanad.html — ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB, ${ROUTES.length} routes`);
