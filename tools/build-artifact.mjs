/* ==========================================================================
   Bundles the multi-page site into one self-contained HTML file.
   The Artifact host serves a single document, so the eight pages become
   hash routes and every asset is inlined — no network fetch at runtime
   except the Google Fonts stylesheet, which degrades to system fonts.

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
  { name: 'index',            file: 'index.html',            page: 'home',             chrome: 'site' },
  { name: 'lawyers',          file: 'lawyers.html',          page: 'lawyers',          chrome: 'site' },
  { name: 'lawyer',           file: 'lawyer.html',           page: 'lawyers',          chrome: 'site' },
  { name: 'blog',             file: 'blog.html',             page: 'blog',             chrome: 'site' },
  { name: 'about',            file: 'about.html',            page: 'about',            chrome: 'site' },
  { name: 'login',            file: 'login.html',            page: 'login',            chrome: 'site' },
  { name: 'tasks',            file: 'tasks.html',            page: 'tasks',            chrome: 'site' },
  { name: 'assistant',        file: 'assistant.html',        page: 'assistant',        chrome: 'site' },
  { name: 'account',          file: 'account.html',          page: 'account',          chrome: 'site' },
  { name: 'dashboard-lawyer', file: 'dashboard-lawyer.html', page: 'dashboard',        chrome: 'app'  },
  { name: 'dashboard-client', file: 'dashboard-client.html', page: 'dashboard-client', chrome: 'app'  },
];

/** Pull the view out of a page: <main> for site pages, .app shell for dashboards. */
function extractView(html, chrome) {
  if (chrome === 'app') {
    const start = html.indexOf('<div class="app">');
    const end = html.indexOf('<script src="assets/js/data.js">');
    if (start === -1 || end === -1) throw new Error('app shell not found');
    return html.slice(start, end).replace(/\s*$/, '');
  }
  const start = html.indexOf('<main id="main">');
  const end = html.indexOf('</main>');
  if (start === -1 || end === -1) throw new Error('<main> not found');
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
  const html = read(r.file);
  routeMap[r.name] = {
    page: r.page,
    chrome: r.chrome,
    titleKey: titleKeyOf(html),
    html: extractView(html, r.chrome),
  };
}

const css = read('assets/css/style.css');
const js = ['theme', 'i18n', 'roles', 'data', 'layout', 'app', 'pages']
  .map((n) => read(`assets/js/${n}.js`));
const [theme, i18n, roles, data, layout, app, pages] = js;
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
/* Dashboard routes carry their own chrome. */
body.is-app .site-header,
body.is-app .site-footer,
body.is-app .drawer { display: none !important; }
body.is-app #app { flex: 1; }
</style>

<a class="skip-link" href="#main" data-i18n="a11y.skip">تخطي إلى المحتوى</a>

<div data-slot="header"></div>

<div id="app"></div>

<div data-slot="footer"></div>

<script>window.__SPA__ = true;
window.__ASSETS__ = ${JSON.stringify(assets)};
window.__ROUTES__ = ${JSON.stringify(routeMap)};
</script>
<script>${theme}</script>
<script>${i18n}</script>
<script>${roles}</script>
<script>${data}</script>
<script>${layout}</script>
<script>${app}</script>
<script>${pages}</script>
<script>${router}</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/sanad.html'), out, 'utf8');
console.log(`dist/sanad.html — ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB, ${ROUTES.length} routes`);
