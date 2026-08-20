/* ==========================================================================
   The PostgREST client, driven against a fake fetch.

   This file is the whole data path now — every read and every write the site
   makes goes through it — so what it puts on the wire is worth pinning down
   exactly: the URL, the filters, the Prefer headers that decide whether a
   write comes back, and which token it signs the request with.

       node tools/rest-test.mjs
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (l, c, x) => {
  if (c) { pass++; console.log('  PASS ' + l); }
  else { fail++; console.log('  FAIL ' + l + (x !== undefined ? `  <${x}>` : '')); }
};
const section = (s) => console.log('— ' + s + ' —');

/* A JWT is three base64url parts; only the middle one is read here. */
function jwt(sub, secondsFromNow = 3600) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ sub, exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}

function boot({ token = null, expiresIn = 3600, reply = null } = {}) {
  const calls = [];
  const store = new Map();
  if (token) {
    store.set('sb-proj-auth-token', JSON.stringify({
      access_token: token, refresh_token: 'r1',
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: { id: 'from-user-object' },
    }));
  }
  const w = {
    SANAD_CONFIG: { supabase: { url: 'https://proj.supabase.co', anonKey: 'pub-key' } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: (url, init) => {
      calls.push({ url, init });
      const answer = reply ? reply(url, init, calls.length) : null;
      const { status = 200, body = [] } = answer || {};
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
      });
    },
  };
  new Function('window', readFileSync(join(root, 'assets/js/core/rest.js'), 'utf8'))(w);
  return { REST: w.REST, calls, store, w };
}

section('WHO THIS BROWSER CAN PROVE IT IS, WITH NO NETWORK');
{
  const { REST } = boot({ token: jwt('user-42') });
  const s = REST.session();
  ok('the id comes out of the token itself', s.sub === 'user-42', s && s.sub);
  ok('and it is not read off the copy beside it', s.sub !== 'from-user-object');
  ok('a live token is not expired', s.expired === false);
}
{
  const { REST } = boot({ token: jwt('user-42', 10), expiresIn: 10 });
  ok('a token about to expire is treated as expired', REST.session().expired === true);
}
{
  const { REST } = boot({});
  ok('no token, no session', REST.session() === null);
}
{
  // Some builds of the library base64 the stored row.
  const raw = JSON.stringify({ access_token: jwt('user-9'), expires_at: Math.floor(Date.now() / 1000) + 999 });
  const { REST, store } = boot({});
  store.set('sb-proj-auth-token', 'base64-' + Buffer.from(raw).toString('base64url'));
  ok('a base64 row is read too', REST.session().sub === 'user-9');
}

section('READS');
{
  const { REST, calls } = boot({ token: jwt('u1') });
  await REST.client().from('profiles').select('*');
  const { url, init } = calls[0];
  ok('goes to the table', url.startsWith('https://proj.supabase.co/rest/v1/profiles?'), url);
  ok('asking for every column', /select=\*/.test(url));
  ok('with the publishable key', init.headers.apikey === 'pub-key');
  ok('signed with the session, not the key', /^Bearer eyJ/.test(init.headers.Authorization));
  ok('as a GET', init.method === 'GET');
}
{
  const { REST, calls } = boot({});
  await REST.client().from('profiles').select('*');
  ok('a signed-out browser signs with the publishable key',
     calls[0].init.headers.Authorization === 'Bearer pub-key');
}
{
  const { REST, calls } = boot({ token: jwt('u1') });
  await REST.client().from('audit_log').select('*').order('at', { ascending: false }).limit(200);
  ok('order and limit are query parameters',
     /order=at\.desc/.test(calls[0].url) && /limit=200/.test(calls[0].url), calls[0].url);
}
{
  const { REST, calls } = boot({ token: jwt('u1') });
  await REST.client().from('offers').select('*').eq('quote_id', 'q-1');
  ok('eq becomes a PostgREST filter', /quote_id=eq\.q-1/.test(calls[0].url), calls[0].url);
}
{
  const { REST } = boot({ token: jwt('u1'), reply: () => ({ body: [{ id: 'a' }, { id: 'b' }] }) });
  const one = await REST.client().from('profiles').select('*').eq('id', 'a').maybeSingle();
  ok('maybeSingle hands back one row, not a list', one.data && one.data.id === 'a');
  const none = await (boot({ reply: () => ({ body: [] }) })).REST
    .client().from('profiles').select('*').eq('id', 'zz').maybeSingle();
  ok('and null when there is none, with no error', none.data === null && none.error === null);
}

section('WRITES');
{
  const { REST, calls } = boot({ token: jwt('u1'), reply: () => ({ body: [{ id: 'new' }] }) });
  const out = await REST.client().from('quotes').insert({ brief: 'x' }).select().single();
  const { url, init } = calls[0];
  ok('an insert is a POST', init.method === 'POST');
  ok('carrying the row as JSON', JSON.parse(init.body).brief === 'x');
  ok('and asks for the row back', /return=representation/.test(init.headers.Prefer), init.headers.Prefer);
  ok('which is what the caller gets', out.data.id === 'new');
  ok('json content type', init.headers['Content-Type'] === 'application/json');
  ok('and no filter on an insert', !/[?&][a-z_]+=eq\./.test(url), url);
}
{
  const { REST, calls } = boot({ token: jwt('u1'), reply: () => ({ body: [] }) });
  await REST.client().from('profiles').update({ status: 'verified' }).eq('id', 'p1');
  ok('an update is a PATCH', calls[0].init.method === 'PATCH');
  ok('aimed with a filter', /id=eq\.p1/.test(calls[0].url), calls[0].url);
}
{
  const { REST, calls } = boot({ token: jwt('u1'), reply: () => ({ body: [] }) });
  await REST.client().from('price_bands').upsert({ type_id: 'x', min_price: 1 }, { onConflict: 'type_id' });
  ok('an upsert says how to resolve the clash',
     /merge-duplicates/.test(calls[0].init.headers.Prefer) && /on_conflict=type_id/.test(calls[0].url));
}
{
  const { REST, calls } = boot({ token: jwt('u1'), reply: () => ({ body: null }) });
  await REST.client().from('partners').delete().eq('id', 'p9');
  ok('a delete is a DELETE with a filter',
     calls[0].init.method === 'DELETE' && /id=eq\.p9/.test(calls[0].url));
}

section('A WRITE THAT CHANGED NOTHING IS NOT A SUCCESS');
{
  const { REST } = boot({ token: jwt('u1'), reply: () => ({ body: [] }) });
  const out = await REST.client().from('profiles').update({ status: 'verified' })
    .eq('id', 'someone-elses').select().single();
  ok('it comes back as an error', !!out.error, JSON.stringify(out));
  ok('saying nothing matched', /nothing matched/.test(out.error.message), out.error.message);
}

section('AN ANSWER THAT IS NOT AN ANSWER');
{
  const { REST } = boot({ token: jwt('u1'), reply: () => ({
    status: 403, body: { code: '42501', message: 'permission denied for table quotes' } }) });
  const out = await REST.client().from('quotes').insert({ brief: 'x' });
  ok('the server’s own words come back', out.error.message === 'permission denied for table quotes');
  ok('with its code', out.error.code === '42501');
}
{
  const { REST, calls } = boot({
    token: jwt('u1'),
    reply: (url, init, n) => (n === 1 ? { status: 401, body: { message: 'JWT expired' } }
                                      : { body: [{ id: 'ok' }] }),
  });
  const out = await REST.client().from('profiles').select('*');
  ok('a 401 is retried once', calls.length === 2, calls.length);
  ok('and the second answer is the one that counts', out.data[0].id === 'ok');
}
{
  const w = boot({ token: jwt('u1') });
  w.w.fetch = () => Promise.reject(new Error('offline'));
  const out = await w.REST.client().from('profiles').select('*');
  ok('a network that never answers is an error, not a throw',
     out.error && out.error.code === 'network', JSON.stringify(out));
}

section('SIGNING OUT FORGETS THE TOKEN');
{
  const { REST, store } = boot({ token: jwt('u1') });
  REST.forget();
  ok('the stored session is gone', store.get('sb-proj-auth-token') === undefined);
  ok('and nobody is signed in', REST.session() === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
