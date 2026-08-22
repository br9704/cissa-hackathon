#!/usr/bin/env bash
# Runs every SQL suite against a freshly rebuilt local database.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${CONTINUITY_DB:-continuity_dev}"
fail=0

for suite in "$HERE"/*_test.sql; do
  name="$(basename "$suite" .sql)"
  echo ""
  echo "== $name"
  "$HERE/../local/reset.sh" > /dev/null
  # NOTICE goes to stderr and psql prefixes it with "psql:file:line: NOTICE:  ", so the
  # prefix has to be stripped from anywhere on the line, not just the start. Getting this
  # wrong is quiet in the worst way: every do-block case simply vanishes from the report
  # and the suite looks like it passed with fewer tests than it has.
  out="$(psql -q -d "$DB" -f "$suite" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]+: (NOTICE|WARNING):  //')"
  echo "$out" | grep -E '^(PASS|FAIL)' | sed 's/^/  /'
  if echo "$out" | grep -q '^FAIL'; then fail=1; fi
  # A raised error that is not caught by a test case is itself a failure.
  if echo "$out" | grep -q '^psql.*ERROR'; then
    echo "  unexpected error:"; echo "$out" | grep '^psql.*ERROR' | sed 's/^/    /'
    fail=1
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then echo "all suites passed"; else echo "SUITE FAILURES"; fi
exit "$fail"
