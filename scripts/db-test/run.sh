#!/bin/bash
# Reproduzierbarer DB-Integrationstest: replayt alle Migrationen + prüft
# Geld-Kern, RLS-Isolation und E-Mail-Gate gegen echtes Postgres.
#
# Zwei Modi:
#   Sandbox (Standard): nutzt `su postgres` (peer-auth).
#   CI: wenn PGHOST gesetzt ist, via TCP (PGHOST/PGUSER/PGPASSWORD/PGPORT).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DB=ruflo_dbtest

if [ -n "${PGHOST:-}" ]; then
  export PGPASSWORD="${PGPASSWORD:-postgres}"
  PSQL() { psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" "$@"; }
  ADMIN() { psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d postgres -tAc "$1"; }
  RUNF() { psql -v ON_ERROR_STOP=1 -q -h "$PGHOST" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "$DB" -f "$1"; }
  DATADIR="$HERE"   # CI: Runner darf Repo-Pfade lesen
else
  service postgresql start >/dev/null 2>&1
  PSQL() { su postgres -c "psql $*"; }
  ADMIN() { su postgres -c "psql -d postgres -tAc \"$1\""; }
  RUNF() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f '$1'"; }
  # postgres-User kommt nicht in Repo-/Home-Pfade → nach /tmp kopieren
  rm -rf /tmp/dbtest && mkdir -p /tmp/dbtest
  cp "$HERE"/*.sql /tmp/dbtest/ && chmod 644 /tmp/dbtest/*.sql
  DATADIR="/tmp/dbtest"
fi

# Migrationen nach DATADIR (im su-Modus /tmp, im CI direkt HERE-Nachbar)
if [ -n "${PGHOST:-}" ]; then MIGDIR="$REPO/supabase/migrations"; else
  mkdir -p /tmp/dbtest/mig; cp "$REPO"/supabase/migrations/*.sql /tmp/dbtest/mig/; chmod 644 /tmp/dbtest/mig/*.sql
  MIGDIR="/tmp/dbtest/mig"
fi

ADMIN "drop database if exists $DB" >/dev/null 2>&1
ADMIN "create database $DB" >/dev/null 2>&1
RUNF "$DATADIR/auth_stub.sql" >/dev/null 2>&1

FAIL=0
for f in $(ls "$MIGDIR"/*.sql | sort); do
  if ! RUNF "$f" >/tmp/pgout 2>&1; then echo "MIGRATION FAIL: $(basename $f)"; tail -3 /tmp/pgout; FAIL=1; break; fi
done
[ $FAIL -ne 0 ] && exit 1
echo "Migrationen OK."

TOTAL=0
for t in money-core rls-isolation offer-lifecycle track-messages quality-strikes inquiries appointments; do
  echo "--- $t ---"
  OUT=$(RUNF "$DATADIR/$t.sql" 2>&1)
  echo "$OUT" | grep -E "PASS|FAIL|ERROR"
  if echo "$OUT" | grep -qE "FAIL|ERROR"; then FAIL=1; fi
  TOTAL=$((TOTAL + $(echo "$OUT" | grep -c "PASS")))
done
ADMIN "drop database if exists $DB" >/dev/null 2>&1
echo "=== $TOTAL Assertions PASS ==="
exit $FAIL
