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

# ── Ausfuehrungsrechte JETZT pruefen, VOR dem zweiten Lauf ──────────────────
#
# ANLASS (13.09.2026): rechte.sql lief bisher am Ende, zusammen mit allen
# anderen Tests — also NACH dem Idempotenz-Durchgang. Und der machte den Test
# blind: der zweite Lauf spielt auch 0820 erneut, und dessen pauschale
# Schleife („revoke execute … from public, anon, authenticated" ueber ALLE
# Funktionen im Schema) raeumt dabei auch die Rechte von Funktionen auf, die
# erst SPAETER angelegt wurden.
#
# In der Produktion passiert das nie: dort laufen Migrationen genau EINMAL und
# der Reihe nach. Eine Funktion, die nach 0820 dazukommt, bekommt die Vorgaben
# aus 0420 zurueck plus das EXECUTE, das PostgreSQL jeder neuen Funktion an
# PUBLIC gibt — und bleibt offen.
#
# Gemessen: 0860 legte zwei SECURITY-DEFINER-Trigger an, die einmalig
# eingespielt fuer anon UND authenticated ausfuehrbar waren. RA und RB wurden
# rot, sobald man sie gegen den EINMALIGEN Stand laufen liess, und blieben im
# Pruefstand gruen. Behoben in 0900.
#
# Der Test steht deshalb hier und nicht unten: er ist der einzige, dessen
# Ergebnis vom Migrations-DURCHGANG abhaengt statt nur vom Schema.
TOTAL=0
echo "--- rechte (gegen den einmaligen Stand) ---"
OUT=$(RUNF "$DATADIR/rechte.sql" 2>&1)
echo "$OUT" | grep -E "PASS|FAIL|ERROR"
if echo "$OUT" | grep -qE "FAIL|ERROR"; then FAIL=1; fi
TOTAL=$((TOTAL + $(echo "$OUT" | grep -c "PASS")))
[ $FAIL -ne 0 ] && exit 1

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

for t in money-core escrow webhook-idempotency psttg-counter rls-isolation offer-lifecycle track-messages quality-strikes inquiries appointments data-export payout-ledger payment-intent-history contracts-insert-lockdown chat-reports widerruf-consent strike-verfall datenschutz-nachweise verfuegbarkeit strike-werkzeug indizes-inbox abnahme-frist leistungs-wuensche vertrag-partner dsa provision-ohne-material abnahme-lauf-status benachrichtigungen warteliste-versand angebotspreis benachrichtigte-betriebe bewertung-frist-antwort kaltstart start-pin meisterpflicht volljaehrigkeit transaktionsgrenze; do
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
# 223 -> 230 am 08.09.2026: sieben Assertions in provision-ohne-material.sql.
# Die Differenz war erst 228, weil money-core am alten Wortlaut der
# System-Nachricht haengt; erst nach dem Nachziehen dort stimmten die 7.
# 260 -> 266 am 14.09.2026: sechs Assertions in angebotspreis.sql (0910).
# 266 -> 272 am 16.09.2026: sechs Assertions in benachrichtigte-betriebe.sql
# (0920). Darunter BB3, die Gegenprobe: der Rechteentzug auf zwei Spalten
# darf nicht die gewoehnlichen Aenderungen eines Kunden mitsperren.
# 272 -> 284 am 16.09.2026: zwoelf Assertions in bewertung-frist-antwort.sql
# (0930). Darunter BF1 und BA3, die beiden Gegenproben: eine Frist, die auch
# fristgerechte Bewertungen sperrt, und ein Antwortrecht, das niemand hat,
# waeren beide "bestanden", ohne sie.
# 284 -> 285: BA10 kam nach der Mutationsprobe dazu (siehe dort).
# 285 -> 299 am 17.09.2026: vierzehn Assertions in kaltstart.sql (0950).
# Neun davon sind Gegenproben: fremdes Gewerk, fremder PLZ-Bereich, fremder
# Rechtsraum, nicht freigegeben, eigener Auftrag, vergebener Auftrag, zweites
# Speichern, zweite Mitteilung, Lesbarkeit des Nachweises. Ein Trigger, der zu
# oft feuert, schreibt dem Kunden eine Zahl hin, die niemanden meint.
# 299 -> 313 am 18.09.2026: vierzehn Assertions in start-pin.sql (0960).
# Darunter SP2 und SP3, die beiden Gegenproben: "niemand kann die PIN lesen"
# waere ein bestandener Test und zugleich eine tote Funktion, und der
# Rechteentzug auf `contracts` darf nicht Abnahme, Unterschrift und
# Stornierung mitsperren.
# 313 -> 316 am 18.09.2026: drei Assertions in start-pin.sql (0970). SP15 bis
# SP17: die Zahl verschwindet beim Einloesen und beim Ende des Vertrags, der
# Beleg bleibt, und ohne Zahl laesst sich nichts mehr einloesen.
# 316 -> 318 am 18.09.2026: RH und RI in rechte.sql. Sie fragen MECHANISCH
# jede Spalte von jobs und contracts ab, statt beispielhaft eine. Das Muster
# aus 0920/0960 (Tabellenrecht entziehen, Spalten einzeln zurueckgeben) laesst
# jede SPAETER hinzugefuegte Spalte still ohne Schreibrecht.
# 318 -> 333 am 20.09.2026: fuenfzehn Assertions in meisterpflicht.sql (0980).
# Sechs davon sind Gegenproben: das zulassungsfreie Gewerk, das gewoehnliche
# Speichern, das behaltene Gewerk, der Nachbarschaftsauftrag, die erreichbare
# Auskunft und der frisch freigegebene Meisterbetrieb. Ein Tor, das alle
# sperrt, ist der einfachste gruene Haken -- genau die Falle vom 07.09.
#
# Der erste Lauf zeigte 328 statt 333, und die Differenz war der Befund:
# strike-verfall.sql liess seine Anbieter auf einen ELEKTRO-Auftrag bieten,
# ohne Meisterbrief. Das war seit 0980 verboten, die Datei brach ab, und
# fuenf Assertions dahinter liefen nicht mehr. Der Test war aus dem falschen
# Grund rot. Der Aufbau dort bildet jetzt ab, was gilt.
# 333 -> 336: MP15, MP16 und MP17 kamen nach der Mutationsprobe dazu. Drei
# Mutationen blieben gruen, weil kein Testfall sie treffen konnte: ein
# Vermerk ohne hinterlegtes Dokument, ein entzogener Vermerk, der durch
# gewoehnliches Speichern zurueckkaeme, und die Korrektur eines Gewerks
# durch den Betreiber.
# 336 -> 347 am 20.09.2026: elf Assertions in volljaehrigkeit.sql (0990).
# Vier davon Gegenproben: der Handwerksweg ueber den Gewerbeschein, der
# erlaubte Uebergang mit Erklaerung, der Einreichungszeitpunkt und das
# Lesen der EIGENEN Erklaerung. Ein Uebergang, der alle sperrt, waere
# sonst bestanden -- und der Nachbarschaftszweig damit genauso tot wie
# vorher, nur anders.
# 347 -> 348: VJ12 kam nach der Mutationsprobe dazu. Die Bedingung
# `is_nachbarschaft` in der Schreib-Policy war durch keine Mutation rot zu
# bekommen, weil der Guard sie ein zweites Mal prueft.
# 348 -> 353 am 20.09.2026: fuenf Assertions in transaktionsgrenze.sql (1000).
# Drei davon Gegenproben: genau auf der Grenze, ein gewoehnliches Angebot und
# das Aendern unterhalb der Grenze. TG4 ist der eigentliche Punkt -- der Weg
# vorbei waere nicht das hohe Angebot, sondern das nachtraegliche Hochsetzen.
EXPECTED=${DBTEST_EXPECTED:-353}
if [ "$TOTAL" -ne "$EXPECTED" ]; then
  echo "ABBRUCH: $TOTAL Assertions gelaufen, erwartet $EXPECTED."
  echo "  Mehr geworden? EXPECTED in scripts/db-test/run.sh anheben."
  echo "  Weniger geworden? Eine Assertion ist verschwunden — das ist der Fehler."
  FAIL=1
fi
# Die letzte Zeile sagt, was WIRKLICH war.
#
# ANLASS (14.09.2026): Hier stand unbedingt `echo "=== $TOTAL Assertions PASS ==="`,
# auch wenn FAIL=1 war. Beim Hinzufuegen von angebotspreis.sql brach die Datei
# mit einem Schluesselkonflikt ab, die Schleife setzte FAIL=1 — und die letzte
# Zeile meldete trotzdem "260 Assertions PASS". Der Rueckgabewert stimmte, aber
# niemand liest einen Rueckgabewert, wenn die letzte Zeile PASS sagt.
if [ "$FAIL" -ne 0 ]; then
  echo "=== FEHLGESCHLAGEN. $TOTAL Assertions gelaufen. Zeilen mit FAIL oder ERROR oben. ==="
else
  echo "=== $TOTAL Assertions PASS ==="
fi
exit $FAIL
