#!/bin/sh
# Every suite, cheapest first.
#
#   npm install                     # once — playwright, for the browser suites
#   python3 -m http.server 8099 &   # the site under test
#   sh tools/run-all.sh
#
# The database policies are separate and need Postgres; see supabase/rls-test*.sql.
set -e
echo '— headless —'
for t in model-test money-test store-contract remote-store-test; do
  printf '  %-26s ' "$t"; node "tools/$t.mjs" | tail -1
done
echo '— in a browser —'
for t in account staff-role auth-ui onboarding onboarding-late-session \
         offline header signal accept admin notices flows pay mobile wide sweep; do
  printf '  %-26s ' "$t"; node "tools/$t-e2e.mjs" | tail -1
done
