#!/usr/bin/env bash
# Rebuilds the local development database from nothing.
#
# This is the reset path, and it exists because the obvious one does not work: once the
# append only triggers are in place you cannot truncate events, by design. Locally that
# means dropping the database, which is clean and fast. On the hosted project it means
# the seed has to be idempotent instead.
#
# Never reach for `set session_replication_role = replica` to force a wipe on a hosted
# project. It disables the chain trigger along with everything else, so any row inserted
# in that session gets no hash and verification is permanently broken from that point on.
set -euo pipefail

DB="${CONTINUITY_DB:-continuity_dev}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

echo "rebuilding $DB"
dropdb --if-exists "$DB"
createdb "$DB"

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/0000_local_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | grep -v "NOTICE:" || true
done

echo "done"
