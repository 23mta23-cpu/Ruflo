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
# Ein leerer Glob lief hier frueher stillschweigend durch: kein Durchlauf, kein
# Fehler, "Migrationen OK." und am Ende "0 Assertions PASS" mit Exit 0. Ein
# falscher Pfad meldete damit Erfolg fuer die gesamte Suite. Eine Testharness,
# die gruen melden kann, ohne etwas geprueft zu haben, ist schlimmer als keine.
MIGCOUNT=$(ls "$MIGDIR"/*.sql 2>/dev/null | wc -l)
if [ "$MIGCOUNT" -lt 50 ]; then
  echo "ABBRUCH: nur $MIGCOUNT Migrationen unter $MIGDIR gefunden (erwartet >= 50) — falscher Pfad?"
  exit 1
fi
for f in $(ls "$MIGDIR"/*.sql | sort); do
  if ! RUNF "$f" >/tmp/pgout 2>&1; then echo "MIGRATION FAIL: $(basename $f)"; tail -3 /tmp/pgout; FAIL=1; break; fi
done
[ $FAIL -ne 0 ] && exit 1
echo "Migrationen OK ($MIGCOUNT eingespielt)."

# ZWEITER Lauf, gegen die bereits bespielte Datenbank.
#
# ANLASS (07.09.2026): 0780 legte zwei Policies ohne vorheriges
# `drop policy if exists` an. Der erste Lauf war gruen, der zweite brach mit
# `policy … already exists` ab. Aufgefallen ist das erst, als ich dem Founder
# eine Datei zum Einfuegen in den SQL-Editor gebaut habe — die Harness hier
# hat es nie gesehen, weil sie jede Migration genau EINMAL spielt.
#
# Die Regel „inkl. 2. Lauf fuer Idempotenz" stand seit Juli in CLAUDE.md und
# ist trotzdem uebersprungen worden. Eine Regel, an die man sich erinnern muss,
# ist keine Pruefung. Sie laeuft jetzt hier.
#
# Das ist kein Schoenheitsfehler: die Migrationen werden von Hand in den
# SQL-Editor eingefuegt. Wer nach einem Abbruch mitten im Skript denselben
# Block noch einmal einfuegt — der normale Weg —, bekommt bei einer
# nicht-idempotenten Anweisung einen Fehler statt eines Ergebnisses.
#
# GRENZE, ausdruecklich: geprueft wird erst ab IDEMPOTENZ_AB. Zwoelf
# Migrationen davor (0010, 0020, 0021, 0030, 0050, 0130, 0200, 0220, 0240,
# 0300, 0320, 0370) legen Policies und Trigger ohne vorheriges `drop … if
# exists` an und scheitern im zweiten Lauf. Gemessen, nicht vermutet — ab 0380
# haelt das Repo das Muster durchgehend ein.
#
# Sie werden NICHT nachtraeglich umgeschrieben: sie sind in der Produktion
# laengst eingespielt, ein `drop policy` auf `profiles` oder `contracts` waere
# ein echter Eingriff in laufende Zugriffskontrolle, um ein Problem zu loesen,
# das dort nicht auftritt. Ein frischer Aufbau spielt sie genau einmal. Das
# Risiko liegt am NEUEN Ende, und genau dort prueft dieser Durchlauf.
IDEMPOTENZ_AB=${DBTEST_IDEMPOTENZ_AB:-0380}
GEPRUEFT=0
for f in $(ls "$MIGDIR"/*.sql | sort); do
  NR="$(basename "$f" | cut -c1-4)"
  case "$NR" in ''|*[!0-9]*) continue;; esac      # nicht-numerisch: uebergehen
  [ "$NR" \< "$IDEMPOTENZ_AB" ] && continue
  GEPRUEFT=$((GEPRUEFT + 1))
  if ! RUNF "$f" >/tmp/pgout2 2>&1; then
    echo "MIGRATION NICHT IDEMPOTENT: $(basename $f) scheitert im zweiten Lauf."
    tail -3 /tmp/pgout2
    echo "  Muster im Repo: 'drop policy if exists … on …;' vor jedem 'create policy',"
    echo "  'drop trigger if exists … on …;' vor jedem 'create trigger',"
    echo "  'if not exists' bei Tabellen/Spalten/Indizes, 'create or replace' bei Funktionen."
    FAIL=1; break
  fi
done
[ $FAIL -ne 0 ] && exit 1
# Eine leere Auswahl waere hier still gruen — dieselbe Klasse wie der leere
# Glob weiter oben. Ab 0380 sind es aktuell 24 Dateien.
if [ "$GEPRUEFT" -lt 10 ]; then
  echo "ABBRUCH: nur $GEPRUEFT Migrationen ab $IDEMPOTENZ_AB doppelt gespielt (erwartet >= 10)."
  exit 1
fi
echo "Migrationen ab $IDEMPOTENZ_AB auch im zweiten Lauf OK ($GEPRUEFT idempotent)."

TOTAL=0
for t in money-core escrow webhook-idempotency psttg-counter rls-isolation offer-lifecycle track-messages quality-strikes inquiries appointments data-export payout-ledger payment-intent-history contracts-insert-lockdown chat-reports widerruf-consent strike-verfall datenschutz-nachweise verfuegbarkeit strike-werkzeug indizes-inbox abnahme-frist leistungs-wuensche vertrag-partner; do
  echo "--- $t ---"
  OUT=$(RUNF "$DATADIR/$t.sql" 2>&1)
  echo "$OUT" | grep -E "PASS|FAIL|ERROR"
  if echo "$OUT" | grep -qE "FAIL|ERROR"; then FAIL=1; fi
  TOTAL=$((TOTAL + $(echo "$OUT" | grep -c "PASS")))
done
ADMIN "drop database if exists $DB" >/dev/null 2>&1

# Die Gesamtzahl wurde bisher nur gedruckt, nie geprueft. Verschwindet ein
# `raise notice 'PASS …'` — Block auskommentiert, Notice geloescht, Datei nicht
# in der Schleife oben —, sinkt die Zahl still und der Exit-Code bleibt 0.
# Beim Hinzufuegen von Assertions diesen Wert mit anheben.
EXPECTED=${DBTEST_EXPECTED:-202}
if [ "$TOTAL" -ne "$EXPECTED" ]; then
  echo "ABBRUCH: $TOTAL Assertions gelaufen, erwartet $EXPECTED."
  echo "  Mehr geworden? EXPECTED in scripts/db-test/run.sh anheben."
  echo "  Weniger geworden? Eine Assertion ist verschwunden — das ist der Fehler."
  FAIL=1
fi
echo "=== $TOTAL Assertions PASS ==="
exit $FAIL
