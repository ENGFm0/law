/* ==========================================================================
   Runtime configuration.

   Empty here on purpose: the published demo runs with no backend, no keys in
   the repository, and no network beyond fonts. Filling these in is what moves
   the site onto real infrastructure — nothing above this file changes.

     supabase — the project the accounts, requests and articles live in, and
                the Realtime channel calls use to signal across the internet.
                The anon key is public by design; what protects the data is the
                row-level security in supabase/schema.sql, never key secrecy.

     turn     — a relay for calls that cannot connect peer to peer (symmetric
                NAT, strict corporate firewalls). STUN alone covers most
                networks; this covers the rest, and it is the one piece of call
                infrastructure that costs money.
   ========================================================================== */
window.SANAD_CONFIG = {
  /* Which data source the site runs on.

       "browser"  — everything in this browser, seeded with demo people. What
                    the published demo runs on, and what works offline.
       "supabase" — the real project below. Starts empty, because real accounts
                    are the only accounts: there are no seeded lawyers in
                    production and there should not be.

     Kept explicit so filling in the keys does not silently change what the
     live site does. Flip it once verify.html reports green. */
  backend: "browser",

  supabase: {
    url: "https://otpjcopyfjodeiufeixx.supabase.co",
    // The PUBLISHABLE key, and only ever this one. It is meant to sit in the
    // page where anyone can read it; the row-level security in
    // supabase/schema.sql is what protects the data. A secret key
    // (sb_secret_…) bypasses every one of those policies and must never
    // appear in this file, in this repository, or in a chat.
    anonKey: "sb_publishable_K3cRgR9SuS5wYKTc-HMZlg_dfHEKhD2",
  },
  // turn: { urls: "turn:turn.example.com:3478", username: "…", credential: "…" },
};
