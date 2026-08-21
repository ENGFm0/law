#!/bin/sh
# ===========================================================================
#  Does each migration apply to a database that already has data in it?
#
#  Applying migrations to an empty schema proves almost nothing. Every
#  migration in this project has been written against a database with rows,
#  guards and triggers already in place — and twice now one has failed there
#  while passing on an empty one:
#
#    • 015 gave every existing dispute a reference number, which is an UPDATE,
#      and a decided dispute refuses updates. No decided disputes on an empty
#      database, so no failure.
#
#  So this builds the database up to each migration in turn, puts realistic
#  rows in it — including the awkward ones: a decided dispute, delivered work,
#  a staff account, a routed trainee — and then applies that migration.
#
#      sh tools/migrate-test.sh
#
#  Needs a local PostgreSQL and the `postgres` role. Every database it makes
#  is dropped again.
# ===========================================================================
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
WORK=/tmp/migrate-test-$$
rm -rf "$WORK"; cp -r "$DIR/supabase" "$WORK"; chmod -R a+rX "$WORK"
pass=0; fail=0

seed() {
  # Tolerant on purpose: a statement for a table that does not exist yet is
  # simply skipped, so one seed serves every step.
  su postgres -c "psql -q -d $1 -v ON_ERROR_STOP=0 -f $WORK/seed.sql" >/dev/null 2>&1 || true
}

cat > "$WORK/seed.sql" <<'SQL'
insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002'),
  ('66666666-0000-0000-0000-000000000006'),
  ('55555555-0000-0000-0000-000000000005') on conflict do nothing;
update public.profiles set roles='{client}', status='verified'
  where id='11111111-0000-0000-0000-000000000001';
update public.profiles set roles='{lawyer}', status='verified'
  where id='22222222-0000-0000-0000-000000000002';
update public.profiles set roles='{intern}', status='verified'
  where id='66666666-0000-0000-0000-000000000006';
update public.profiles set roles='{client,staff}', status='verified'
  where id='55555555-0000-0000-0000-000000000005';
insert into public.requests (id, client_id, lawyer_id, assigned_to, type_id, title, price, status)
  values ('cccc0000-0000-0000-0000-00000000cccc','11111111-0000-0000-0000-000000000001',
          '22222222-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000006',
          'consult','seeded case', 250, 'delivered')
  on conflict (id) do nothing;
update public.requests set delivered_at = now()
  where id = 'cccc0000-0000-0000-0000-00000000cccc';
-- The row that broke 015: decided, and therefore refusing to be touched.
insert into public.disputes (request_id, by_id, reason, status, outcome, lawyer_pct,
                             resolution_reason, resolved_at)
  values ('cccc0000-0000-0000-0000-00000000cccc','11111111-0000-0000-0000-000000000001',
          'ناقص','resolved','split',60,'قُسم', now())
  on conflict do nothing;
insert into public.services (owner_id, type_id, price)
  values ('22222222-0000-0000-0000-000000000002','consult', 250)
  on conflict do nothing;
insert into public.messages (request_id, author_id, audience, body)
  values ('cccc0000-0000-0000-0000-00000000cccc','11111111-0000-0000-0000-000000000001',
          'parties','مرحبا');
SQL

LIST=$(ls "$WORK"/migrations/*.sql | sort)
for target in $LIST; do
  name=$(basename "$target")
  db="mt$(echo "$name" | cut -c1-3)"
  su postgres -c "dropdb --if-exists $db && createdb $db" >/dev/null 2>&1

  # Everything before this one, then rows, then the migration under test.
  args="-f $WORK/local-prelude.sql -f $WORK/schema.sql"
  for m in $LIST; do
    [ "$m" = "$target" ] && break
    args="$args -f $m"
  done
  if ! su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $db $args" >/dev/null 2>&1; then
    printf '  FAIL %-46s could not build the database before it\n' "$name"
    fail=$((fail + 1)); su postgres -c "dropdb --if-exists $db" >/dev/null 2>&1; continue
  fi
  seed "$db"

  out=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $db --single-transaction -f $target" 2>&1 || true)
  if echo "$out" | grep -q "^psql.*ERROR"; then
    printf '  FAIL %-46s %s\n' "$name" "$(echo "$out" | grep ERROR | head -1 | cut -c1-90)"
    fail=$((fail + 1))
  else
    # And again, because every one of these is meant to be re-runnable.
    twice=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $db --single-transaction -f $target" 2>&1 || true)
    if echo "$twice" | grep -q "^psql.*ERROR"; then
      printf '  FAIL %-46s not re-runnable: %s\n' "$name" \
        "$(echo "$twice" | grep ERROR | head -1 | cut -c1-70)"
      fail=$((fail + 1))
    else
      printf '  PASS %-46s applies to a database with rows in it\n' "$name"
      pass=$((pass + 1))
    fi
  fi
  su postgres -c "dropdb --if-exists $db" >/dev/null 2>&1
done

rm -rf "$WORK"
echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
