#!/bin/bash
# Reproduzierbarer DB-Integrationstest: replayt alle Migrationen auf lokalem
# PostgreSQL und prüft den Geld-Kern (accept_offer) gegen echtes Postgres.
# Nutzung: bash scripts/db-test/run.sh
# Voraussetzung: lokales Postgres (service postgresql start), su postgres verfügbar.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DB=ruflo_dbtest
# postgres-User kommt nicht in Repo-/Home-Pfade → nach /tmp mit offenen Rechten kopieren
rm -rf /tmp/dbtest && mkdir -p /tmp/dbtest/mig
cp "$REPO"/supabase/migrations/*.sql /tmp/dbtest/mig/
cp "$HERE/auth_stub.sql" "$HERE/money-core.sql" /tmp/dbtest/
chmod -R 644 /tmp/dbtest/*.sql /tmp/dbtest/mig/*.sql
service postgresql start >/dev/null 2>&1
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1
su postgres -c "createdb $DB"
su postgres -c "psql -q -d $DB -f '/tmp/dbtest/auth_stub.sql'" >/dev/null 2>&1
FAIL=0
for f in $(ls /tmp/dbtest/mig/*.sql | sort); do
  su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f '$f'" >/tmp/dbtest/pgout 2>&1 \
    || { echo "MIGRATION FAIL: $(basename $f)"; tail -3 /tmp/dbtest/pgout; FAIL=1; break; }
done
[ $FAIL -ne 0 ] && exit 1
echo "Migrationen OK. Money-Core-Test:"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f '/tmp/dbtest/money-core.sql'" 2>&1 | grep -E "PASS|FAIL|ERROR"
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1
