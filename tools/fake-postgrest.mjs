/* ==========================================================================
   A small PostgREST, in front of the real database.

   The site cannot reach supabase.co from here, and a mock that answers with
   fixtures proves nothing about the thing that actually decides what the site
   can do: the row policies. So this speaks the slice of the PostgREST wire
   protocol the site uses, and runs every query against a local PostgreSQL
   with the schema and every migration applied — as `authenticated`, carrying
   the caller's own `sub` claim, exactly as Supabase would.

   It is a test harness and nothing else. It trusts the token it is given
   without checking a signature, which is the one thing a real deployment must
   never do — and it is why this file is not shipped.

       node tools/fake-postgrest.mjs <database> [port]
   ========================================================================== */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DB = process.argv[2] || 'live';
const PORT = Number(process.argv[3] || 8098);
const FILES = '/tmp/fake-storage';
mkdirSync(FILES, { recursive: true });
let seq = 0;

/* ---------- talking to Postgres ---------- */
function sql(text, { role = 'anon', sub = null } = {}, raw = false) {
  const prelude = [
    `set local role ${role};`,
    sub ? `select set_config('request.jwt.claim.sub', '${sub}', true);`
        : `select set_config('request.jwt.claim.sub', '', true);`,
  ].join('\n');
  // One transaction, so `set local` applies to the statement that follows.
  // json_agg wraps its output across lines; the raw newlines it adds are not
  // part of any string in it, so taking them out keeps the answer on one line
  // and the parse honest.
  // A statement that writes cannot sit inside a subquery — Postgres insists a
  // data-modifying CTE is top level — so writes arrive already wrapped and
  // reads get wrapped here.
  const wrapped = raw
    ? text
    : `select replace(coalesce(json_agg(t)::text, '[]'), chr(10), '') as out from (${text}) t;`;
  const body = `begin;\n${prelude}\n${wrapped}\ncommit;`;
  // Through a file rather than -c: the SQL carries quotes, braces and Arabic,
  // and every layer of shell quoting between here and psql is a way to get
  // that wrong.
  const file = join(FILES, 'q' + (seq++) + '.sql');
  writeFileSync(file, body);
  return new Promise((resolve) => {
    execFile('su', ['postgres', '-c', `psql -X -q -A -t -v ON_ERROR_STOP=1 -d ${DB} -f ${file}`],
      { maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return resolve({ error: parseError(stderr || String(err)) });
        const lines = stdout.split('\n').filter((l) => l.trim().length);
        const last = lines[lines.length - 1] || '[]';
        try { resolve({ rows: JSON.parse(last) }); }
        catch (e) { resolve({ error: { message: 'bad answer: ' + last, code: 'XX000' } }); }
      });
  });
}

/** Postgres says "ERROR:  42501: permission denied"; PostgREST says JSON. */
function parseError(text) {
  const m = /ERROR:\s+(.*)/.exec(text);
  const message = (m ? m[1] : text).trim();
  let code = 'XX000';
  if (/row-level security/i.test(message)) code = '42501';
  if (/permission denied/i.test(message)) code = '42501';
  if (/does not exist/i.test(message)) code = '42703';
  if (/duplicate key/i.test(message)) code = '23505';
  return { message, code, details: null, hint: null };
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const ident = (v) => `"${String(v).replace(/"/g, '')}"`;

/* ---------- who is asking ---------- */
function caller(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const parts = auth.split('.');
  if (parts.length !== 3) return { role: 'anon', sub: null };
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return claims.sub ? { role: 'authenticated', sub: claims.sub } : { role: 'anon', sub: null };
  } catch (e) { return { role: 'anon', sub: null }; }
}

/* ---------- turning a PostgREST query into SQL ---------- */
function build(table, params) {
  const cols = params.get('select') || '*';
  const where = [];
  let order = '', limit = '';
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
    const [op, ...rest] = value.split('.');
    const val = rest.join('.');
    if (op === 'eq') where.push(`${ident(key)} = ${q(val)}`);
    else if (op === 'neq') where.push(`${ident(key)} <> ${q(val)}`);
    else if (op === 'is') where.push(`${ident(key)} is ${val === 'null' ? 'null' : val}`);
    else if (op === 'in') where.push(`${ident(key)} in (${val.replace(/[()]/g, '').split(',').map(q).join(',')})`);
  }
  if (params.get('order')) {
    const [col, dir] = params.get('order').split('.');
    order = ` order by ${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}`;
  }
  if (params.get('limit')) limit = ` limit ${parseInt(params.get('limit'), 10) || 100}`;
  const list = cols === '*' ? '*' : cols.split(',').map((c) => ident(c.trim())).join(',');
  return { list, where: where.length ? ' where ' + where.join(' and ') : '', order, limit };
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': '*',
};
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const who = caller(req);
  const path = url.pathname;

  /* ---- storage ---- */
  if (path.startsWith('/storage/v1/object/sign/')) {
    const key = path.slice('/storage/v1/object/sign/'.length);
    return json(res, 200, { signedURL: '/object/signed/' + key + '?token=t' });
  }
  if (path.startsWith('/storage/v1/object/signed/')) {
    const key = decodeURIComponent(path.slice('/storage/v1/object/signed/'.length));
    const file = join(FILES, key.replace(/\//g, '__'));
    if (!existsSync(file)) return json(res, 404, { message: 'not found' });
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', ...CORS });
    return res.end(readFileSync(file));
  }
  if (path.startsWith('/storage/v1/object/')) {
    if (who.role !== 'authenticated') return json(res, 401, { message: 'not signed in' });
    const key = path.slice('/storage/v1/object/'.length);
    writeFileSync(join(FILES, key.replace(/\//g, '__')), await readBody(req));
    return json(res, 200, { Key: key });
  }

  /* ---- rpc ---- */
  if (path.startsWith('/rest/v1/rpc/')) {
    const fn = path.slice('/rest/v1/rpc/'.length).replace(/[^\w]/g, '');
    const args = JSON.parse((await readBody(req)).toString() || '{}');
    const named = Object.keys(args).map((k) =>
      `${ident(k)} => ${args[k] === null ? 'null' : q(args[k])}`).join(', ');
    const out = await sql(`select * from public.${fn}(${named})`, who);
    if (out.error) return json(res, out.error.code === '42501' ? 403 : 400, out.error);
    return json(res, 200, out.rows);
  }

  /* ---- tables ---- */
  const m = /^\/rest\/v1\/(\w+)$/.exec(path);
  if (!m) return json(res, 404, { message: 'no route' });
  const table = m[1];
  const parts = build(table, url.searchParams);
  const prefer = String(req.headers.prefer || '');
  const wantBack = /return=representation/.test(prefer);

  if (req.method === 'GET') {
    const out = await sql(`select ${parts.list} from public.${ident(table)}${parts.where}${parts.order}${parts.limit}`, who);
    if (out.error) return json(res, out.error.code === '42501' ? 403 : 400, out.error);
    return json(res, 200, out.rows);
  }

  const body = JSON.parse((await readBody(req)).toString() || '{}');
  const keys = Object.keys(body);

  if (req.method === 'POST') {
    const merge = /merge-duplicates/.test(prefer);
    const conflict = url.searchParams.get('on_conflict');
    const sets = keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ');
    const text =
      `insert into public.${ident(table)} (${keys.map(ident).join(',')}) ` +
      `values (${keys.map((k) => (body[k] === null ? 'null' : q(typeof body[k] === 'object' ? toPg(body[k]) : body[k]))).join(',')})` +
      (merge && conflict ? ` on conflict (${conflict.split(',').map(ident).join(',')}) do update set ${sets}` : '') +
      ` returning *`;
    // A write cannot be a subquery, and everything here is wrapped in one so
    // the answer comes back as JSON. A CTE can be.
    return finish(res, await sql(agg(text), who, true), wantBack, 201);
  }

  if (req.method === 'PATCH') {
    const sets = keys.map((k) =>
      `${ident(k)} = ${body[k] === null ? 'null' : q(typeof body[k] === 'object' ? toPg(body[k]) : body[k])}`).join(', ');
    return finish(res, await sql(
      agg(`update public.${ident(table)} set ${sets}${parts.where} returning *`), who, true),
      wantBack, 200);
  }

  if (req.method === 'DELETE') {
    return finish(res, await sql(
      agg(`delete from public.${ident(table)}${parts.where} returning *`), who, true),
      wantBack, 200);
  }

  return json(res, 405, { message: 'not allowed' });
});

/** A write, at the top level, with its returned rows aggregated to one line. */
function agg(statement) {
  return `with w as (${statement})\n` +
    `select replace(coalesce(json_agg(w)::text, '[]'), chr(10), '') as out from w;`;
}

function finish(res, out, wantBack, okStatus) {
  if (out.error) return json(res, out.error.code === '42501' ? 403 : 400, out.error);
  return json(res, okStatus, wantBack ? out.rows : []);
}

/** Arrays go to Postgres as literals, not as JSON. */
function toPg(v) {
  if (Array.isArray(v)) return '{' + v.map((x) => String(x).replace(/"/g, '')).join(',') + '}';
  return JSON.stringify(v);
}

server.listen(PORT, () => console.log(`fake-postgrest on ${PORT} → ${DB}`));
