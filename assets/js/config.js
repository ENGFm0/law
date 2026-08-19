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
  // supabase: { url: "https://xxxx.supabase.co", anonKey: "…" },
  // turn: { urls: "turn:turn.example.com:3478", username: "…", credential: "…" },
};
