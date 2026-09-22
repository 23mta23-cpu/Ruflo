#!/bin/bash
# Faehrt ALLE Browser-Pruefungen in einem Rutsch: Export, Server, Checks.
#
# Anlass: Die Einzelskripte gab es schon, gelaufen sind sie trotzdem selten --
# weil man vor jedem Lauf `expo export` und den Server von Hand jonglieren
# muss, und weil der Server nach JEDEM Export neu gestartet werden muss (der
# Export legt dist/ neu an, der Prozess verliert sein Arbeitsverzeichnis und
# stirbt mit FileNotFoundError in os.getcwd()). Eine Pruefung, die zu
# umstaendlich ist, wird nicht ausgefuehrt -- und ist damit keine Pruefung.
#
# Aufruf:  bash scripts/reisen/run.sh
# Exit 0 = alle Pruefungen bestanden.
set -u
HIER="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
cd "$REPO" || exit 1

PORT=8744
FAIL=0
ZAEHLUNG=""

# ENTSCHEIDUNG UMGEDREHT am 18.09.2026, und der Grund gehoert hierher, weil an
# dieser Stelle bis dahin das Gegenteil stand.
#
# Bisher war Playwright bewusst KEINE Abhaengigkeit in package.json -- Begruendung
# damals: `npm ci` in der schnellen CI soll es nicht jedes Mal mitziehen. Der
# Laeufer lud es stattdessen bei Bedarf mit `npm i --no-save` nach.
#
# Dagegen sprechen zwei Dinge, die inzwischen schwerer wiegen:
#   1. Die Fassung war nicht festgelegt. Dreizehn Reisen haengen an einem Paket,
#      das bei jedem Nachladen eine andere Version sein konnte. Ein
#      Verhaltenswechsel darin waere als Produktfehler erschienen.
#   2. Seit dem 18.09. gibt es `.github/workflows/reisen.yml`, das die Reisen
#      naechtlich faehrt. Ein Lauf, der zuerst ein unbestimmtes Paket aus dem
#      Netz zieht, ist kein reproduzierbarer Lauf.
#
# Gemessen, was der alte Einwand kostet: `playwright` bringt genau ZWEI Pakete
# mit (playwright, playwright-core). Neben dem Expo-Baum faellt das nicht ins
# Gewicht. Die Browser selbst kommen weiter aus PLAYWRIGHT_BROWSERS_PATH bzw.
# aus `npx playwright install` im Workflow.
#
# Der Nachlade-Weg unten bleibt als Rueckfall stehen: er hilft jedem, der auf
# einem aelteren Lockfile arbeitet, und kostet nichts, wenn das Paket da ist.
if ! node -e "require('playwright')" >/dev/null 2>&1; then
  echo "Playwright fehlt -- wird einmalig nachgeladen (ohne package.json zu aendern)."
  if ! npm i playwright --no-save --no-audit --no-fund >/dev/null 2>&1; then
    echo "ABBRUCH: 'npm i playwright --no-save' fehlgeschlagen. Ohne Playwright"
    echo "  laeuft keine der Browser-Pruefungen. Netzverbindung pruefen."
    exit 1
  fi
  node -e "require('playwright')" >/dev/null 2>&1 || { echo "ABBRUCH: Playwright weiterhin nicht ladbar."; exit 1; }
  echo "Playwright bereit."
fi

server_stoppen() { pkill -f "scripts/spa-server.py" >/dev/null 2>&1; sleep 1; return 0; }
server_starten() {
  server_stoppen
  python3 "$REPO/scripts/spa-server.py" >/dev/null 2>&1 &
  for _ in $(seq 1 20); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null)" = "200" ]; then
      return 0
    fi
    sleep 0.5
  done
  echo "ABBRUCH: Server auf Port $PORT antwortet nicht."
  return 1
}
trap server_stoppen EXIT

if [ ! -d node_modules ]; then
  echo "--- npm ci ---"
  npm ci --no-audit --no-fund >/dev/null 2>&1 || { echo "ABBRUCH: npm ci fehlgeschlagen."; exit 1; }
fi

if [ "${SKIP_EXPORT:-}" != "1" ]; then
  echo "--- expo export ---"
  npx expo export --platform web >/tmp/reisen-export.log 2>&1 || {
    echo "ABBRUCH: Export fehlgeschlagen:"; tail -5 /tmp/reisen-export.log; exit 1; }
fi

# Ein leerer dist/-Ordner wuerde sonst still durchlaufen und jede Pruefung
# gegen eine 404-Seite gruen melden -- dieselbe Klasse wie der leere Glob in
# scripts/db-test/run.sh.
if [ ! -f dist/index.html ]; then
  echo "ABBRUCH: dist/index.html fehlt — der Export hat nichts erzeugt."
  exit 1
fi

server_starten || exit 1

for pruefung in \
  "Eine Adresse fuer alle Edge Functions|python3 scripts/eine-adresse-check.py" \
  "Keine Berechtigung ohne Funktion|python3 scripts/berechtigungen-check.py" \
  "Kein unbemerkter KI-Einsatz|python3 scripts/ki-einsatz-check.py" \
  "Keine rohe Kennung in der Oberflaeche|python3 scripts/rohe-kennung-check.py" \
  "Ton der Oberflaeche|python3 scripts/ton-check.py" \
  "Keine Werbeaussage gegen den eigenen Code|python3 scripts/versprechen-check.py" \
  "Kein Gedankenstrich in sichtbarem Text|python3 scripts/gedankenstrich-check.py" \
  "Keine im Web wirkungslose API|python3 scripts/web-untaugliche-api-check.py" \
  "Kein uebergebener Parameter ohne Leser|python3 scripts/nav-parameter-check.py" \
  "Keine Selbstauskunft ohne Bildschirm|python3 scripts/betriebsauskunft-check.py" \
  "Kein fester Abstand am unteren Bildschirmrand (Apple HIG)|python3 scripts/sichere-aktionsleiste-check.py" \
  "Kein Zaehler im oeffentlichen /health|python3 scripts/health-keine-zahlen-check.py" \
  "Die App sagt, welchen Stand sie zeigt|python3 scripts/stand-kennung-check.py" \
  "Start-PIN: Text und Datenbank stimmen ueberein|python3 scripts/startpin-beleg-check.py" \
  "Verkaufstexte gegen den Code|python3 scripts/verkaufstext-check.py" \
  "AGB-Ranking gegen den Code|python3 scripts/ranking-check.py" \
  "AGB bestreitet keine Automatik, die es gibt|python3 scripts/agb-automatik-check.py" \
  "Meisterpflicht: Oberflaeche und Datenbank nennen dasselbe|python3 scripts/meisterpflicht-beleg-check.py" \
  "Geldfristen: eine Zahl, und sie stimmt mit den AGB|python3 scripts/geldfristen-check.py" \
  "Transaktionsgrenze: Code und Datenbank gleich|python3 scripts/transaktionsgrenze-check.py" \
  "Auftrags-Trichter fragt einmal und mischt nicht|python3 scripts/trichter-check.py" \
  "Schrittzaehler zaehlt ab dem Einstieg|node scripts/schrittzaehler-check.cjs" \
  "Ausgelieferte HTML-Seiten|python3 scripts/ausgelieferte-seiten-check.py" \
  "Kein verwaister Bildschirm|python3 scripts/verwaiste-seiten-check.py" \
  "Jede Regel hat ihren Beleg im Code|python3 scripts/regeln-beleg-check.py" \
  "Jeder Knopf ist auch fuer die Bedienungshilfe ein Knopf|python3 scripts/knopf-rolle-check.py" \
  "Kein Mailversand ohne Einwilligung oder mit rohem Nutzertext|python3 scripts/mailversand-check.py" \
  "Auskunft ist vollstaendig|python3 scripts/auskunft-vollstaendig-check.py" \
  "Loeschung ist vollstaendig|python3 scripts/loeschung-vollstaendig-check.py" \
  "PStTG-Schwellen stimmen ueberein|python3 scripts/schwellen-check.py" \
  "Tote Navigationsziele|python3 scripts/tote-links-check.py" \
  "Gast findet ueberall zum Login|node scripts/gast-login-check.cjs" \
  "Rollen und Routen|node scripts/rollen-routen-check.cjs" \
  "Nichts laeuft ueber den Rand|node scripts/rand-ueberstand-check.cjs" \
  "Jede Beruehrflaeche ist 44x44 (Apple HIG)|node scripts/beruehrflaeche-check.cjs" \
  "Jeder Text erreicht seinen Kontrast (Apple HIG, WCAG 1.4.3)|node scripts/kontrast-check.cjs" \
  "Jeder selbst gebaute Schalter meldet Rolle und Zustand|node scripts/schalter-rolle-check.cjs" \
  "Die Fusszeile nennt den Auslieferungsstand|node scripts/stand-zeile-check.cjs" \
  "Nachbarschaftshilfe sieht nicht aus wie ein Mangel|node scripts/nachbarschaft-abzeichen-check.cjs" \
  "Keine absolute Zusage ohne Beleg|node scripts/absolute-zusage-check.cjs" \
  "Ein Netzfehler sieht nicht aus wie ein leerer Posteingang|node scripts/fehler-nicht-als-leer-check.cjs" \
  "Keine Beschriftung abgeschnitten|node scripts/kachel-text-check.cjs" \
  "Keine Fachwoerter in der Oberflaeche|python3 scripts/fachwort-check.py" \
  "Fussleisten verdecken nichts|node scripts/fussleisten-check.cjs" \
  "Beschriftungen brechen nicht mitten im Wort|node scripts/wortumbruch-check.cjs" \
  "Auftragsentwurf ueberlebt Anmeldung|node scripts/entwurf-ueberlebt-check.cjs" \
  "Geld-Bildschirme kalt geoeffnet|node scripts/geldwege-check.cjs" \
  "Alle uebrigen Bildschirme kalt geoeffnet|node scripts/alle-screens-check.cjs" \
  "Kern-Reise 1 (Kunde)|node scripts/reisen/reise1-kunde.cjs" \
  "Kern-Reise 2 (Anbieter, bis zur Grenze)|node scripts/reisen/reise2-anbieter.cjs" \
  "Kern-Reise 4 (Geldweg: Angebot und Annahme)|node scripts/reisen/reise4-angebot.cjs" \
  "Kern-Reise 5 (Vertrag und Zahlungs-Riegel)|node scripts/reisen/reise5-vertrag-zahlung.cjs" \
  "Kern-Reise 6 (Abnahme und Reklamation)|node scripts/reisen/reise6-abnahme.cjs" \
  "Kern-Reise 7 (Pruef-Postfach, Betreibersicht)|node scripts/reisen/reise7-pruef-postfach.cjs" \
  "Kern-Reise 8 (Melden nach DSA und Widerruf)|node scripts/reisen/reise8-melden-widerruf.cjs" \
  "Kern-Reise 9 (Anbieter-Kalender, Knoepfe wirklich antippen)|node scripts/reisen/reise9-kalender.cjs" \
  "Kern-Reise 10 (erreicht eine Pflichtmitteilung den Betrieb)|node scripts/reisen/reise10-mitteilungen.cjs" \
  "Kern-Reise 11 (erreicht die Kaltstart-Mitteilung den Kunden)|node scripts/reisen/reise11-kunden-mitteilungen.cjs" \
  "Kern-Reise 12 (Start-PIN und Termin-Weitergabe)|node scripts/reisen/reise12-start-pin.cjs" \
  "Kern-Reise 13 (Anfragen-Liste des Betriebs)|node scripts/reisen/reise13-anfragen-sortierung.cjs" \
  "Kern-Reise 14 (Wunschanbieter aus dem Profil)|node scripts/reisen/reise14-wunschanbieter.cjs" \
  "Kern-Reise 15 (Betriebsstatus im Pruef-Postfach)|node scripts/reisen/reise15-betriebsstatus.cjs" \
  "Kein Knopf wirft beim Antippen|node scripts/knopf-fehler-check.cjs" \
; do
  NAME="${pruefung%%|*}"
  CMD="${pruefung#*|}"
  echo
  echo "=== $NAME ==="
  # Ein Befehl, der gar nicht erst startet, ist KEIN bestandener Test.
  # Genau das ist am 16.09. passiert: Reise 4 lief nie und meldete sich nur
  # mit einer Zeile Syntaxfehler. Die Suite zaehlte 447 PASS und 0 FAIL --
  # und war trotzdem rot, was niemand las. Deshalb wird jetzt vorher
  # geprueft, dass der Befehl ueberhaupt aufloest.
  ZIEL="$(echo "$CMD" | awk '{print $2}')"
  if [ ! -f "$ZIEL" ]; then
    echo ">>> FEHLGESCHLAGEN: $NAME -- Datei '$ZIEL' gibt es nicht"
    FAIL=1
  else
    # Je Pruefung mitzaehlen, wie viele PASS-Zeilen sie erzeugt.
    #
    # ANLASS (21.09.2026): Der Lauf meldete 544 PASS gegen zuletzt belegte
    # 529. Dreizehn der fuenfzehn liessen sich benennen (neun in Reise 7,
    # zwei in Reise 4, je eine fuer die beiden neuen Apple-HIG-Pruefungen) --
    # ZWEI nicht, weil vom 529er Lauf kein Protokoll mehr existierte. Eine
    # Differenz, die man nicht zuordnen kann, ist wertlos: sie koennte
    # genauso gut eine still verschwundene und eine neue Zusicherung sein.
    # Mit dieser Aufstellung ist der naechste Vergleich mechanisch.
    AUSGABE="$(eval "$CMD" 2>&1)"
    RC=$?
    echo "$AUSGABE"
    N=$(echo "$AUSGABE" | grep -c "PASS" || true)
    ZAEHLUNG="$ZAEHLUNG$N|$NAME
"
    if [ $RC -ne 0 ]; then
      echo ">>> FEHLGESCHLAGEN: $NAME"
      FAIL=1
    fi
  fi
done

echo
echo "=== PASS je Pruefung (fuer den naechsten Vergleich) ==="
printf '%s' "$ZAEHLUNG" | awk -F'|' '{s+=$1; printf "%5d  %s\n", $1, $2} END {printf "%5d  GESAMT\n", s}'

echo
if [ $FAIL -eq 0 ]; then echo "=== alle Pruefungen bestanden ==="; else echo "=== MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN ==="; fi
# Der Rueckgabewert gehoert INS Protokoll, nicht an den Aufrufort. Am
# 21.09.2026 lief die Suite mit `nohup ... > log` statt mit `; echo "EXIT=$?"`
# -- im Protokoll stand danach kein Rueckgabewert, und uebrig blieb die
# PASS-Zahl als Ersatz. Genau das verbietet die Lehre vom 16.09.2026
# („den Rueckgabewert der Suite lesen, nicht die PASS-Zahl").
echo "EXIT=$FAIL"
exit $FAIL
