#!/bin/sh
# Every suite, cheapest first.
#
#   npm install                     # once — playwright, for the browser suites
#   python3 -m http.server 8099 &   # the site under test
#   sh tools/run-all.sh
#
# The database policies are separate and need Postgres; see supabase/rls-test*.sql.
#
# tools/live-e2e.mjs runs the site against a real PostgreSQL through
# tools/fake-postgrest.mjs. It needs a local database and `su postgres`, so it
# is not in the loop below:  node tools/live-e2e.mjs
set -e
echo '— headless —'
for t in model-test money-test books-test rest-test columns-test store-contract remote-store-test; do
  printf '  %-26s ' "$t"; node "tools/$t.mjs" | tail -1
done
echo '— in a browser —'
for t in speed thread promise work-and-channels auction promo console first-paint account view-as staff-role auth-ui onboarding onboarding-late-session \
         offline auth-failure header signal accept admin notices flows pay mobile wide sweep; do
  printf '  %-26s ' "$t"; node "tools/$t-e2e.mjs" | tail -1
done
