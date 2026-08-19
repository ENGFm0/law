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

  var client = null;
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

  /** Fetch the library once, on first use. Rejects loudly: a data layer that
      silently falls back to demo data in production is worse than an error. */
  function load() {
    if (client) return Promise.resolve(client);
    if (loading) return loading;
    if (!hasKeys()) return Promise.reject(new Error("no Supabase url or key in config.js"));

    loading = import(/* webpackIgnore: true */ LIB)
      .then(function (mod) {
        client = mod.createClient(cfg.supabase.url, cfg.supabase.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
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
    // Anyone arriving through the wizard has answered everything it asks.
    if (data.onboarded !== undefined) row.onboarded = !!data.onboarded;
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

  var SB = {
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
      return load().then(function (sb) {
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

            return sb.from("profiles").update(row).eq("id", user.id).select().single()
              .then(function (out) {
                if (out.error) return { ok: false, error: "profileFailed", message: out.error.message };
                return { ok: true, user: toProfile(out.data) };
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
            return sb.from("profiles").update(row).eq("id", id).select().single()
              .then(function (out) {
                if (out.error) return { ok: false, error: "profileFailed", message: out.error.message };
                return { ok: true, user: toProfile(out.data) };
              });
          });
      });
    },

    signIn: function (email, password) {
      return load().then(function (sb) {
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
      return load().then(function (sb) {
        return sb.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: redirect || global.location.origin + global.location.pathname },
        });
      });
    },

    signOut: function () {
      return load().then(function (sb) { return sb.auth.signOut(); });
    },

    /** The signed-in user id, restored from the stored session. */
    currentId: function () {
      return load().then(function (sb) {
        return sb.auth.getSession().then(function (res) {
          var s = res.data && res.data.session;
          return s ? s.user.id : null;
        });
      });
    },

    profile: function (id) {
      return load().then(function (sb) {
        return sb.from("profiles").select("*").eq("id", id).maybeSingle()
          .then(function (res) { return res.error ? null : toProfile(res.data); });
      });
    },

    /** Everything the site reads at once, for the cache that keeps reads sync. */
    hydrate: function () {
      return load().then(function (sb) {
        return Promise.all([
          sb.from("profiles").select("*"),
          sb.from("services").select("*"),
          sb.from("requests").select("*"),
          sb.from("articles").select("*"),
          sb.from("reviews").select("*"),
          sb.from("comments").select("*"),
          sb.from("endorsements").select("*"),
          sb.from("agreements").select("*"),
          sb.from("disputes").select("*"),
          sb.from("notifications").select("*"),
          sb.from("platform_settings").select("*").eq("id", 1).maybeSingle(),
          // Only staff may read the record; for everyone else this comes back
          // empty and the desk they cannot open stays empty with it.
          sb.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
        ]).then(function (r) {
          var pick = function (x) { return (x && !x.error && x.data) || []; };
          return {
            profiles: pick(r[0]).map(toProfile),
            services: pick(r[1]), requests: pick(r[2]), articles: pick(r[3]),
            reviews: pick(r[4]), comments: pick(r[5]),
            endorsements: pick(r[6]), agreements: pick(r[7]),
            disputes: pick(r[8]), notices: pick(r[9]),
            settings: (r[10] && !r[10].error && r[10].data) || null,
            audit: pick(r[11]),
          };
        });
      });
    },
  };

  global.SB = SB;
})(window);
