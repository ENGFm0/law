import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
// The seeded people only exist on the demo backend; the published site
// runs on the real one and starts empty.
const __cfg = readFileSync('assets/js/config.js','utf8').replace('backend: "supabase"','backend: "browser"');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const PAGES = ['index.html','requests.html','services.html','lawyers.html','blog.html','editor.html',
  'article.html?id=a-1','lawyer.html?id=u-ahmed','intern.html?id=u-layan','quotes.html',
  // Bare intern.html is a trainee's own workspace and a stranger's 404, which
  // are different pages off one address — both belong in the sweep.
  'intern.html','firm.html','mentorship.html','assistant.html','account.html','about.html',
  'login.html','signup.html','webinars.html'];
const USERS = [null,'u-fahad','u-ahmed','u-jaid'];
const bad = [];
let n = 0;
for (const page of PAGES) {
  for (const user of USERS) {
    for (const lang of ['ar','en']) {
      for (const theme of ['light','dark']) {
        const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
        await p.route('**/assets/js/config.js', r => r.fulfill({ contentType:'application/javascript', body: __cfg }));
        await p.route('**://fonts.*/**', r => r.abort());
        const errs = [];
        p.on('pageerror', e => errs.push('JS: ' + e.message));
        p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errs.push('C: ' + m.text()); });
        await p.goto('http://localhost:8099/' + page.split('?')[0]);
        await p.evaluate(([l, t, u]) => {
          localStorage.setItem('sanad.lang', l);
          localStorage.setItem('sanad.theme', t);
          localStorage.removeItem('sanad.activeRole');
          if (u) localStorage.setItem('sanad.session.user', u);
          else localStorage.removeItem('sanad.session.user');
        }, [lang, theme, user]);
        await p.goto('http://localhost:8099/' + page);
        await p.waitForTimeout(240);
        const raw = await p.evaluate(() => {
          const m = (document.body.innerText.match(/\b[a-z]{2,}\.[a-zA-Z][a-zA-Z0-9]+\b/g) || []);
          return [...new Set(m)].filter(s => !/\.(html|svg|com|sa|js|css|png|net|org)$/.test(s));
        });
        if (raw.length) errs.push('KEY: ' + raw.join(' '));
        const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
        if (over) errs.push('OVERFLOW');
        if (errs.length) bad.push(`${page} | ${user || 'guest'} | ${lang} | ${theme}\n    ${errs.join('\n    ')}`);
        n++;
        await p.close();
      }
    }
  }
}
console.log(bad.length ? bad.slice(0, 40).join('\n') : `All ${n} combinations clean`);
console.log('checked', n, 'failures', bad.length);
await b.close();
