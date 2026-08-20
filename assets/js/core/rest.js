/* ==========================================================================
   PostgREST over plain fetch — the data path, without the library.

   Supabase's REST API is PostgREST. supabase-js is a convenience over it, and
   a convenience that has to be fetched from a CDN, parsed and constructed
   before the first byte of data can be asked for. On a phone that was the
   whole of the delay people were seeing: a directory of lawyers that came up
   empty and filled itself in a few seconds later had not been slow to query —
   it had not started querying yet.

   So reads and writes go straight out over fetch, in the same tick the page
   parses, and the library is loaded lazily for the three things that genuinely
   need it: signing in, Realtime, and uploads.

   The object this hands back deliberately mimics the slice of the supabase-js
   query builder the project already uses — .from().select().eq().order()
   .limit().insert().update().upsert().delete().single().maybeSingle() and a
   thenable at the end — so nothing above it had to be rewritten to move.

   Two rules it does not bend:
     • the only key here is the publishable one, exactly as before; every rule
       that matters is a row policy on the server;
     • a write that matched nothing comes back as an error rather than as
       silence, because silence is what let an approval look like it worked.
   ========================================================================== */
(function (global) {
  "use strict";

  var cfg = (global.SANAD_CONFIG || {}).supabase || {};
  var URL_BASE = (cfg.url || "").replace(/\/+$/, "");
  var KEY = cfg.anonKey || "";

  /** The project reference, which is also how supabase-js names its storage
      key. Reading that key is how this file knows who is signed in without
      asking anybody. */
  function projectRef() {
    var m = /^https?:\/\/([^.]+)\./.exec(URL_BASE);
    return m ? m[1] : "";
  }
  var STORE_KEY = "sb-" + projectRef() + "-auth-token";

  function fromBase64Url(s) {
    var t = s.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    try { return decodeURIComponent(escape(global.atob(t))); }
    catch (e) { try { return global.atob(t); } catch (e2) { return ""; } }
  }

  /** What supabase-js left in localStorage, whatever shape this version of it
      writes. Some builds store the JSON directly; some store it base64 with a
      marker in front. Both are read here rather than assumed. */
  function stored() {
    var raw;
    try { raw = global.localStorage.getItem(STORE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    if (raw.slice(0, 7) === "base64-") raw = fromBase64Url(raw.slice(7));
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /** The `sub` claim: the user id every row policy on the server compares
      against. Read from the token itself rather than from the copy beside it,
      because the token is what the server will actually be handed. */
  function subjectOf(jwt) {
    var parts = String(jwt || "").split(".");
    if (parts.length !== 3) return null;
    try { return JSON.parse(fromBase64Url(parts[1])).sub || null; } catch (e) { return null; }
  }

  var SKEW_MS = 30000;      // a token this close to expiry is not worth sending

  /** Who this browser can prove it is, right now, with no network at all. */
  function session() {
    var row = stored();
    if (!row || !row.access_token) return null;
    var expiresAt = (row.expires_at ? row.expires_at * 1000 : 0);
    return {
      token: row.access_token,
      refresh: row.refresh_token || null,
      expiresAt: expiresAt,
      expired: !!expiresAt && expiresAt - Date.now() < SKEW_MS,
      sub: subjectOf(row.access_token) || (row.user && row.user.id) || null,
    };
  }

  function headers(extra) {
    var s = session();
    var h = {
      apikey: KEY,
      Authorization: "Bearer " + ((s && !s.expired && s.token) || KEY),
      Accept: "application/json",
    };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  /** Hand the expired token back to the library so it can trade the refresh
      token for a new one. Only reached when a request has already come back
      401, or when the stored token is past its life — never on the fast path. */
  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    var s = session();
    if (!s || !s.refresh) return Promise.resolve(null);
    refreshing = (global.SB && global.SB.lib ? global.SB.lib() : Promise.reject(new Error("no library")))
      .then(function (client) { return client.auth.getSession(); })
      .then(function () { refreshing = null; return session(); })
      .catch(function (e) { refreshing = null; console.error("token refresh failed", e); return null; });
    return refreshing;
  }

  function enc(v) {
    if (v === null || v === undefined) return "";
    return encodeURIComponent(String(v));
  }

  function send(q, retried) {
    var parts = q.filters.concat(q.params);
    var url = URL_BASE + "/rest/v1/" + q.table + (parts.length ? "?" + parts.join("&") : "");
    var prefer = q.prefer.slice();
    var init = { method: q.method, headers: headers(
      q.body ? { "Content-Type": "application/json" } : null) };
    if (prefer.length) init.headers.Prefer = prefer.join(",");
    if (q.body) init.body = JSON.stringify(q.body);

    return global.fetch(url, init).then(function (res) {
      // An expired token is worth exactly one retry: refresh it and ask again.
      // Anything else is an answer, including an unwelcome one.
      if (res.status === 401 && !retried && session()) {
        return refresh().then(function () { return send(q, true); });
      }
      return res.text().then(function (text) {
        var body = null;
        if (text) { try { body = JSON.parse(text); } catch (e) { body = null; } }
        if (!res.ok) {
          return { data: null, error: body && body.message
            ? body
            : { message: text || ("HTTP " + res.status), code: String(res.status) } };
        }
        var rows = Array.isArray(body) ? body : (body == null ? [] : [body]);
        if (!q.wantOne) return { data: Array.isArray(body) ? body : body, error: null };
        if (!rows.length) {
          if (q.wantOne === "maybe") return { data: null, error: null };
          // A write that changed nothing is not a success. This is the case
          // that used to pass silently: the screen moved, the row did not.
          return { data: null, error: {
            code: "PGRST116",
            message: "no row came back — nothing matched, or the row cannot be read back",
          } };
        }
        return { data: rows[0], error: null };
      });
    }).catch(function (e) {
      return { data: null, error: { message: e && e.message ? e.message : String(e), code: "network" } };
    });
  }

  function table(name) {
    var q = { table: name, method: "GET", filters: [], params: [], body: null,
              prefer: [], wantOne: null };
    var api = {
      select: function (cols) {
        q.params.push("select=" + encodeURIComponent(cols || "*"));
        if (q.method !== "GET") q.prefer.push("return=representation");
        return api;
      },
      eq: function (col, val) { q.filters.push(col + "=eq." + enc(val)); return api; },
      neq: function (col, val) { q.filters.push(col + "=neq." + enc(val)); return api; },
      in: function (col, vals) {
        q.filters.push(col + "=in.(" + (vals || []).map(enc).join(",") + ")");
        return api;
      },
      order: function (col, opts) {
        q.params.push("order=" + col + "." + (opts && opts.ascending === false ? "desc" : "asc"));
        return api;
      },
      limit: function (n) { q.params.push("limit=" + n); return api; },
      insert: function (row) { q.method = "POST"; q.body = row; return api; },
      update: function (row) { q.method = "PATCH"; q.body = row; return api; },
      upsert: function (row, opts) {
        q.method = "POST"; q.body = row;
        q.prefer.push("resolution=merge-duplicates");
        if (opts && opts.onConflict) q.params.push("on_conflict=" + opts.onConflict);
        return api;
      },
      delete: function () { q.method = "DELETE"; return api; },
      single: function () { q.wantOne = "strict"; return send(q); },
      maybeSingle: function () { q.wantOne = "maybe"; return send(q); },
      then: function (ok, no) { return send(q).then(ok, no); },
    };
    return api;
  }

  /* ---------- files ----------
     Storage is another REST endpoint on the same host, so it needs no library
     either. Uploads go as the raw file with the session on the request; the
     bucket is private, so reading one back means asking for a URL that
     expires rather than linking to it. */
  function upload(bucket, path, file) {
    var s = session();
    if (!s || s.expired) {
      return refresh().then(function (fresh) {
        if (!fresh) return { error: { message: "not signed in", code: "401" } };
        return upload(bucket, path, file);
      });
    }
    return global.fetch(URL_BASE + "/storage/v1/object/" + bucket + "/" + path, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + s.token,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    }).then(function (res) {
      if (res.ok) return { path: path, error: null };
      return res.text().then(function (text) {
        var body = null;
        try { body = JSON.parse(text); } catch (e) { /* not json */ }
        return { path: null, error: {
          message: (body && (body.message || body.error)) || text || ("HTTP " + res.status),
          code: String(res.status) } };
      });
    }).catch(function (e) {
      return { path: null, error: { message: e.message || String(e), code: "network" } };
    });
  }

  /** A link to one file that stops working. Nothing in this bucket is public,
      so this is the only way anything in it is ever shown. */
  function signUrl(bucket, path, seconds) {
    return global.fetch(URL_BASE + "/storage/v1/object/sign/" + bucket + "/" + path, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: seconds || 3600 }),
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json().then(function (body) {
        var signed = body && (body.signedURL || body.signedUrl);
        return signed ? URL_BASE + "/storage/v1" + signed : null;
      });
    }).catch(function () { return null; });
  }

  global.REST = {
    ready: function () { return !!(URL_BASE && KEY); },
    upload: upload,
    signUrl: signUrl,
    session: session,
    refresh: refresh,
    storeKey: function () { return STORE_KEY; },
    /** Everything a signed-out browser must forget. Used by sign-out, so a
        failed network call cannot leave a token behind. */
    forget: function () {
      try { global.localStorage.removeItem(STORE_KEY); } catch (e) {}
    },
    client: function () {
      return {
        from: table,
        /** A database function, called by name. Used for the three answers
            that are nobody's business but the asker's: your own profile in
            full, one counterparty's contact details, and — for staff — the
            book of them. */
        rpc: function (name, args) {
          var q = { table: "rpc/" + name, method: "POST", filters: [], params: [],
                    body: args || {}, prefer: [], wantOne: null };
          return {
            single: function () { q.wantOne = "strict"; return send(q); },
            maybeSingle: function () { q.wantOne = "maybe"; return send(q); },
            then: function (okFn, noFn) { return send(q).then(okFn, noFn); },
          };
        },
      };
    },
  };
})(window);
