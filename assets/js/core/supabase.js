/* ==========================================================================
   Supabase — the client, and the auth that replaces demo accounts.

   Loaded on demand and only when SANAD_CONFIG.backend is "supabase", so the
   demo keeps its promise: no build step, no dependency, works from a file on
   disk with no network at all.

   The important change here is not the database, it is the passwords. In demo
   mode an account is a plain object in localStorage with the password sitting
   next to it in clear text. Here the password never reaches our code at all —
   it goes to Supabase's own auth service, which stores a bcrypt hash and hands
   back a session token. `profiles` holds everything else.
   ========================================================================== */
(function (global) {
  "use strict";

  var cfg = global.SANAD_CONFIG || {};
  var LIB = "https://esm.sh/@supabase/supabase-js@2";

  /* The columns of `profiles` anybody may read.

     Not `*`. Migration 011 took the phone number, the email, the licence
     document and the CV out of reach of an ordinary read — they were public
     for no better reason than that `select *` on a public table returns
     everything — so the site has to name what it wants. Your own row comes
     back whole through my_profile(); one counterparty's details through
     contact_of(); the desk's book through contact_book(). */
  var PUBLIC_PROFILE = [
    "id", "full_name", "avatar_url", "roles", "active_role", "status", "bio",
    "title", "licence_no", "licence_authority", "licence_expiry", "specialties",
    "years", "university", "level", "skills", "city", "created_at", "onboarded",
    "featured_rank", "featured_until", "auto_bid", "vat_registered",
  ].join(",");

  /* The same list minus what migration 011 adds. A site deploys in one push
     and a migration is run by hand afterwards, so there is a window where the
     code asks for a column the database does not have yet — and PostgREST
     refuses the whole read for one unknown name. Rather than leave the
     directory empty until somebody opens the SQL editor, the read falls back
     to what every version of this schema has. */
  var OLDER_PROFILE = [
    "id", "full_name", "avatar_url", "roles", "active_role", "status", "bio",
    "licence_no", "licence_authority", "licence_expiry", "specialties",
    "years", "university", "level", "skills", "city", "created_at", "onboarded",
    "featured_rank", "featured_until", "auto_bid",
  ].join(",");

  function unknownColumn(err) {
    return !!err && (err.code === "42703" || /does not exist|schema cache/i.test(err.message || ""));
  }

  /** Something this database has not been given yet: a table from a migration
      that has not been run, or a function that came with it. PostgREST says
      PGRST205 for the first and PGRST202 for the second; Postgres itself says
      42P01 and 42883 when the request gets that far.

      Worth separating from a real failure. "The desk cannot read the ledger"
      needs saying out loud; "this project is one migration behind" needs
      saying to whoever runs migrations, and to nobody else. */
  function notYet(err) {
    if (!err) return false;
    var code = err.code || "";
    if (["PGRST205", "PGRST202", "42P01", "42883", "404"].indexOf(code) !== -1) return true;
    return /could not find the (table|function)|schema cache|relation .* does not exist/i
      .test(err.message || "");
  }

  function people(sb) {
    return sb.from("profiles").select(PUBLIC_PROFILE).then(function (res) {
      if (!unknownColumn(res.error)) return res;
      console.warn("profiles: falling back to the pre-011 columns —", res.error.message);
      return sb.from("profiles").select(OLDER_PROFILE);
    });
  }

  var client = null;          // the real supabase-js client, once anything needs it
  var loading = null;

  /** Are the keys present? Enough to talk to the project. */
  function hasKeys() {
    return !!(cfg.supabase && cfg.supabase.url && cfg.supabase.anonKey);
  }

  /** Is the site actually running on it? A separate question on purpose —
      verify.html has to reach the project while the site is still on the demo
      backend, which is the whole point of checking before you switch over. */
  function configured() {
    return cfg.backend === "supabase" && hasKeys();
  }

  /** The data client: PostgREST over fetch, ready in this tick.

      This used to be the library, and the library had to be fetched from a
      CDN before a single row could be asked for — which is why a page could
      draw itself completely, twice, before its data arrived. Reads and writes
      do not need it; only auth, Realtime and uploads do, and those now say so
      by calling lib(). */
  function load() {
    if (!hasKeys()) return Promise.reject(new Error("no Supabase url or key in config.js"));
    return Promise.resolve(global.REST.client());
  }

  /** Fetch the library, once, for the things that genuinely need it. Rejects
      loudly: a data layer that silently falls back to demo data in production
      is worse than an error. */
  function lib() {
    if (client) return Promise.resolve(client);
    if (loading) return loading;
    if (!hasKeys()) return Promise.reject(new Error("no Supabase url or key in config.js"));

    loading = import(/* webpackIgnore: true */ (cfg.lib || LIB))
      .then(function (mod) {
        client = mod.createClient(cfg.supabase.url, cfg.supabase.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // Read the code the provider put in the URL and turn it into a
            // session. It is the default, and it is written down because the
            // whole return-from-Google path depends on it.
            detectSessionInUrl: true,
          },
        });
        global.supabase = mod;          // Signal checks for this to go remote
        return client;
      });
    return loading;
  }

  /* ---------- rows in, objects out ----------
     The database is snake_case and flat; the rest of the site speaks the shape
     models.js already uses. One translation, in one place. */
  function toProfile(row) {
    if (!row) return null;
    var pair = function (v) { return v == null ? "" : { ar: v, en: v }; };
    return {
      id: row.id,
      name: pair(row.full_name),
      email: row.email || "",
      phone: row.phone || "",
      city: row.city || "",
      avatar: row.avatar_url || null,
      roles: row.roles || ["client"],
      activeRole: row.active_role || (row.roles || ["client"])[0],
      status: row.status || "pending",
      // Where the platform is choosing to place them, if anywhere.
      featuredRank: row.featured_rank == null ? null : row.featured_rank,
      // Whether they take matching work automatically when it is posted.
      autoBid: !!row.auto_bid,
      // Whether they have ever told us who they are. False for an account
      // Google created on their behalf.
      onboarded: !!row.onboarded,
      bio: pair(row.bio),
      title: pair(row.title),
      licence: row.licence_no ? {
        number: row.licence_no, authority: pair(row.licence_authority),
        expiry: row.licence_expiry,
      } : null,
      specialties: row.specialties || [],
      years: row.years || 0,
      university: pair(row.university),
      level: pair(row.level),
      skills: (row.skills || []).map(pair),
      completed: 0, responseHours: 12, seedRating: 0, seedReviews: 0, seedHours: 0,
    };
  }

  /** The reverse, for the columns a person may set about themselves. */
  function fromProfile(data) {
    var flat = function (v) { return v && typeof v === "object" ? (v.ar || v.en || "") : (v || null); };
    var row = {
      full_name: flat(data.name), phone: data.phone || null, city: data.city || null,
      avatar_url: data.avatar || null, bio: flat(data.bio),
    };
    // Read on every card and every profile, and until migration 011 there was
    // no column to put it in — so it was blank for everybody who was not part
    // of the demo seed.
    if (data.title !== undefined) row.title = flat(data.title);
    // Anyone arriving through the wizard has answered everything it asks.
    if (data.onboarded !== undefined) row.onboarded = !!data.onboarded;
    // Which of the roles they hold they are currently looking through. Never
    // the roles themselves — those are not changed by a profile edit.
    if (data.activeRole !== undefined) row.active_role = data.activeRole;
    // Approving somebody was the one thing the desk existed to do, and this
    // column was missing from the list — so it moved the screen and the
    // database never heard about it, and a refresh put them back in the queue.
    // Sending it is safe from anywhere: a trigger pins it on your own row and
    // only a staff policy lets it through on anybody else's.
    if (data.status !== undefined) row.status = data.status;
    if (data.featuredRank !== undefined) row.featured_rank = data.featuredRank;
    if (data.autoBid !== undefined) row.auto_bid = !!data.autoBid;
    if (data.role === "lawyer" || (data.roles || []).indexOf("lawyer") !== -1) {
      row.licence_no = data.licenceNumber || null;
      row.licence_authority = flat(data.licenceAuthority);
      row.licence_expiry = data.licenceExpiry || null;
      row.specialties = data.specialties || [];
      row.years = data.years || 0;
    }
    if (data.role === "intern" || (data.roles || []).indexOf("intern") !== -1) {
      row.university = flat(data.university);
      row.level = flat(data.level);
      row.skills = (data.skills || []).map(flat);
    }
    return row;
  }

  /** What the provider said on the way back, if anything went wrong.

      An identity provider reports failure by sending you home with an
      explanation in the URL — a redirect the project has not been told to
      allow, a consent that was declined. Nothing read it, so the page simply
      rendered as a guest and the sign-in looked as though it had been
      ignored. This reads it. */
  function authError() {
    var out = null;
    [global.location.search, global.location.hash].forEach(function (part) {
      if (!part) return;
      var q = new URLSearchParams(part.replace(/^[?#]/, ""));
      var code = q.get("error") || q.get("error_code");
      if (code && !out) {
        out = { code: code, message: q.get("error_description") || code };
      }
    });
    return out;
  }

  /** Take the provider's leftovers out of the address bar once they are spent,
      so a refresh does not try to redeem a code that is already used. */
  function cleanUrl() {
    if (!global.history || !global.history.replaceState) return;
    var here = new URL(global.location.href);
    ["code", "error", "error_code", "error_description", "state"].forEach(function (k) {
      here.searchParams.delete(k);
    });
    if (/access_token|error/.test(here.hash)) here.hash = "";
    var next = here.pathname + (here.searchParams.toString() ? "?" + here.searchParams : "") + here.hash;
    if (next !== global.location.pathname + global.location.search + global.location.hash) {
      global.history.replaceState({}, "", next);
    }
  }

  var SB = {
    authError: authError,
    // Exported so the write path can tell the same two things apart.
    notYet: notYet,
    lib: lib,
    cleanUrl: cleanUrl,
    configured: configured,
    hasKeys: hasKeys,
    client: function () { return client; },
    load: load,
    toProfile: toProfile,
    fromProfile: fromProfile,

    /* ---------- accounts ----------
       Returns the same { ok, error, user } the demo backend returns, so the
       sign-up wizard does not care which one it is talking to. */
    register: function (data) {
      return lib().then(function (sb) {
        return sb.auth.signUp({ email: data.email, password: data.password })
          .then(function (res) {
            if (res.error) {
              return { ok: false,
                error: /registered|exists/i.test(res.error.message) ? "emailTaken" : "signUpFailed",
                message: res.error.message };
            }
            var user = res.data.user;
            if (!user) return { ok: false, error: "confirmEmail" };
            // With "Confirm email" on, Supabase creates the user but withholds
            // the session until they click the link. Nothing can be written to
            // `profiles` yet, because row-level security has no auth.uid() to
            // match — so say that plainly instead of failing on the insert.
            if (!res.data.session) return { ok: false, error: "confirmEmail" };

            // A client is live at once; a lawyer or trainee waits for a licence
            // check, and cannot set that field themselves — the database
            // trigger keeps it whatever staff last set.
            // A profile already exists: the database creates one for every new
            // auth user, because a Google sign-in never passes through here.
            // So this fills in what the wizard collected rather than inserting.
            // `status` is deliberately not sent — the guard trigger decides it,
            // and taking a professional role drops you to pending regardless.
            var row = fromProfile(data);
            row.roles = [data.role];
            row.active_role = data.role;
            row.onboarded = true;      // the wizard asked everything

            return sb.from("profiles").update(row).eq("id", user.id).select(PUBLIC_PROFILE).single()
              .then(function (out) {
                if (out.error) return { ok: false, error: "profileFailed", message: out.error.message };
                // Read it back whole rather than from the public columns the
                // update returned: this is the account's own row, and the
                // account page shows the address it just signed up with.
                return sb.rpc("my_profile").maybeSingle().then(function (mine) {
                  return { ok: true, user: toProfile((mine && mine.data) || out.data) };
                });
              });
          });
      });
    },

    /** Finish an account Google created on somebody's behalf: the role they
        actually want, and the details that go with it. Not a registration —
        the account already exists and is already signed in. */
    complete: function (id, data) {
      return load().then(function (sb) {
        // Read what the account already holds before overwriting it. Replacing
        // the roles outright would drop a staff grant on the floor the moment
        // its owner answered "who are you" — the desk is not something you can
        // hand back by filling in a form, and nothing in this wizard is asking
        // to give it up.
        return sb.from("profiles").select("roles").eq("id", id).maybeSingle()
          .then(function (cur) {
            var held = (cur && cur.data && cur.data.roles) || [];
            var roles = [data.role];
            if (held.indexOf("staff") !== -1) roles.push("staff");

            var row = fromProfile(data);
            row.roles = roles;
            row.active_role = data.role;
            row.onboarded = true;
            return sb.from("profiles").update(row).eq("id", id).select(PUBLIC_PROFILE).single()
              .then(function (out) {
                if (out.error) return { ok: false, error: "profileFailed", message: out.error.message };
                return sb.rpc("my_profile").maybeSingle().then(function (mine) {
                  return { ok: true, user: toProfile((mine && mine.data) || out.data) };
                });
              });
          });
      });
    },

    signIn: function (email, password) {
      return lib().then(function (sb) {
        return sb.auth.signInWithPassword({ email: email, password: password })
          .then(function (res) {
            if (res.error) {
              return { ok: false,
                error: /invalid/i.test(res.error.message) ? "badPassword" : "noAccount" };
            }
            return { ok: true, id: res.data.user.id };
          });
      });
    },

    /** Hand off to Google and come back signed in.

        Nothing is returned to await: the browser leaves the page entirely and
        returns to `redirect`, where the session is already restored from the
        URL by the client. The profile row is waiting either way, made by the
        database trigger the moment the auth user appeared. */
    signInWithGoogle: function (redirect) {
      return lib().then(function (sb) {
        return sb.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: redirect || global.location.origin + global.location.pathname },
        });
      });
    },

    signOut: function () {
      // The stored token goes first, so a network that never answers cannot
      // leave this browser holding a session it has been told to drop.
      global.REST.forget();
      return lib().then(function (sb) { return sb.auth.signOut(); });
    },

    /** The signed-in user id.

        Read out of the token this browser is already holding, which takes no
        network at all — the id is the `sub` claim, and the token is what the
        server will be handed anyway. Coming back from a provider is the one
        case that still needs the library: the session is not in storage yet,
        it is in the URL, and only the library can trade it in. */
    currentId: function () {
      var returning = /[?&#](code|access_token)=/.test(
        global.location.search + global.location.hash);
      if (!returning) {
        var s = global.REST.session();
        if (s && s.expired) {
          // Held a token, but not one worth sending. Renew it before the page
          // decides who anybody is.
          return global.REST.refresh().then(function (fresh) {
            return (fresh && fresh.sub) || (s && s.sub) || null;
          });
        }
        return Promise.resolve(s ? s.sub : null);
      }
      return lib().then(function (sb) {
        return sb.auth.getSession().then(function (res) {
          var live = res.data && res.data.session;
          return live ? live.user.id : null;
        });
      });
    },

    profile: function (id) {
      return load().then(function (sb) {
        var me = global.REST.session();
        // Your own row comes back whole — the site needs the email and the
        // phone on the account page, and they are yours to see.
        if (me && me.sub === id) {
          return sb.rpc("my_profile").maybeSingle().then(function (res) {
            // Same window: the function arrives with migration 011. Falling
            // back means an account page without its own email for a few
            // minutes rather than a site that cannot say who is signed in.
            if (res.error) {
              console.warn("my_profile unavailable —", res.error.message);
              return sb.from("profiles").select(OLDER_PROFILE).eq("id", id).maybeSingle()
                .then(function (out) { return out.error ? null : toProfile(out.data); });
            }
            return toProfile(res.data);
          });
        }
        return sb.from("profiles").select(PUBLIC_PROFILE).eq("id", id).maybeSingle()
          .then(function (res) {
            // Named, not swallowed. This read is the one the whole session
            // depends on, and a silent null here is indistinguishable from
            // an account that does not exist.
            if (res.error) { console.error("profile read failed", res.error); return null; }
            return toProfile(res.data);
          });
      });
    },

    /** What the site reads, in two waves, keyed by table.

        It used to be one Promise.all over twenty tables, and the page drew
        nothing until the slowest of the twenty came back. Now the seven that
        almost every screen needs are their own wave: the directory, the
        catalogue and the prices land, the page draws, and the rest — a
        client's own requests, the blog, the desk's ledgers — arrive behind
        them and redraw what they touch.

        Keyed by name rather than by position. The previous version read its
        results out of an array by index, which is a quiet way to hand the
        blog the reviews the first time somebody inserts a table in the
        middle. */
    CORE: ["profiles", "services", "service_types", "price_bands",
           "platform_settings", "reviews", "announcements"],
    REST: ["requests", "articles", "comments", "endorsements", "agreements",
           "disputes", "notifications", "audit_log", "subscriptions",
           "operating_costs", "partners", "quotes", "offers", "contacts",
           "messages", "attachments", "request_events",
           "mentorships", "mentorship_sessions", "mentorship_messages",
           "promo_codes", "promo_redemptions", "draft_jobs"],

    hydrate: function (names) {
      return load().then(function (sb) {
        var want = names || SB.CORE.concat(SB.REST);
        var query = {
          profiles:         function () { return people(sb); },
          services:         function () { return sb.from("services").select("*"); },
          service_types:    function () { return sb.from("service_types").select("*").order("sort"); },
          price_bands:      function () { return sb.from("price_bands").select("*"); },
          mentorships:      function () { return sb.from("mentorships").select("*"); },
          mentorship_sessions: function () {
            return sb.from("mentorship_sessions").select("*").order("starts_at");
          },
          mentorship_messages: function () {
            return sb.from("mentorship_messages").select("*").order("created_at");
          },
          promo_codes:      function () { return sb.from("promo_codes").select("*"); },
          draft_jobs:       function () { return sb.from("draft_jobs").select("*"); },
          promo_redemptions: function () { return sb.from("promo_redemptions").select("*"); },
          platform_settings:function () { return sb.from("platform_settings").select("*").eq("id", 1).maybeSingle(); },
          reviews:          function () { return sb.from("reviews").select("*").limit(500); },
          announcements:    function () { return sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(50); },
          requests:         function () { return sb.from("requests").select("*").order("created_at", { ascending: false }).limit(500); },
          articles:         function () { return sb.from("articles").select("*").limit(200); },
          comments:         function () { return sb.from("comments").select("*").limit(500); },
          endorsements:     function () { return sb.from("endorsements").select("*").limit(500); },
          agreements:       function () { return sb.from("agreements").select("*"); },
          disputes:         function () { return sb.from("disputes").select("*"); },
          // Only staff may read the record; for everyone else these come back
          // empty, which is exactly what an ordinary account should see.
          notifications:    function () { return sb.from("notifications").select("*").order("at", { ascending: false }).limit(100); },
          audit_log:        function () { return sb.from("audit_log").select("*").order("at", { ascending: false }).limit(200); },
          subscriptions:    function () { return sb.from("subscriptions").select("*"); },
          operating_costs:  function () { return sb.from("operating_costs").select("*").order("created_at", { ascending: false }); },
          partners:         function () { return sb.from("partners").select("*").order("created_at"); },
          quotes:           function () { return sb.from("quotes").select("*").order("created_at", { ascending: false }).limit(200); },
          offers:           function () { return sb.from("offers").select("*").limit(1000); },
          // Staff-only, and it says so inside the function rather than
          // trusting the caller. Everyone else gets an empty list.
          contacts:         function () { return sb.rpc("contact_book"); },
          // Only the threads on cases this account is on come back — the row
          // policy decides that, not this query.
          messages:         function () { return sb.from("messages").select("*").order("created_at").limit(1000); },
          attachments:      function () { return sb.from("attachments").select("*").order("created_at").limit(1000); },
          // What happened to a case, in order. Read by whoever may see the
          // case, which is the same rule the case itself is under.
          request_events:   function () { return sb.from("request_events").select("*").order("at").limit(2000); },
        };

        return Promise.all(want.map(function (name) { return query[name](); }))
          .then(function (results) {
            var rows = {}, errors = [];
            want.forEach(function (name, i) {
              var res = results[i];
              if (res && res.error) {
                // A table or function this database has not been given yet is
                // not a failure — it is a migration that has not been run. The
                // site is deployed in one push and the SQL is run by hand
                // afterwards, so this state is normal for a few minutes and
                // permanent for anyone running an older schema on purpose.
                // Treated as empty and said to the console, not to the person
                // reading the page.
                if (notYet(res.error)) {
                  console.warn("not in this database yet:", name, "—", res.error.message);
                  rows[name] = [];
                  return;
                }
                errors.push({ table: name, code: res.error.code || "",
                              message: res.error.message || String(res.error) });
                rows[name] = null;        // not [] — "we do not know" is not "none"
                return;
              }
              // One row, not a list — and a project without it should read
              // as "no settings", not as an empty list of them.
              rows[name] = name === "platform_settings"
                ? ((res && res.data) || null)
                : ((res && res.data) || []);
            });
            return { rows: rows, errors: errors, wave: want };
          });
      });
    },
  };

  global.SB = SB;
})(window);
