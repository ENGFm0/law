#!/bin/sh
# Everything, in the order that fails fastest. A static server on :8099 is
# needed for the browser suites:  python3 -m http.server 8099
set -e
for t in model-test money-test store-contract remote-store-test; do
  printf '%-26s ' "$t"; node "tools/$t.mjs" | tail -1
done
for t in account staff-role auth-ui onboarding onboarding-late-session \
         offline accept admin notices flows pay mobile wide sweep; do
  printf '%-26s ' "$t"; node "tools/$t-e2e.mjs" | tail -1
done
