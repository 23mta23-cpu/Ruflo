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

# Playwright ist bewusst KEINE Abhaengigkeit in package.json: es wird nur hier
# gebraucht, und `npm ci` in der CI soll es nicht jedes Mal mitziehen. Der
# Preis dafuer war, dass dieser Laeufer in einer frischen Umgebung mit
# "Cannot find module 'playwright'" abbrach -- und zwar erst NACH dem Export,
# also nach mehreren Minuten Wartezeit. Der in CLAUDE.md dokumentierte
# Ein-Befehl-Lauf funktionierte damit aus einem frischen Checkout nicht.
#
# Die Browser selbst liegen in dieser Umgebung schon unter
# PLAYWRIGHT_BROWSERS_PATH; nachgeladen wird nur das JS-Paket (~2 Pakete).
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
  "Eine Adresse fuer alle Edge Functions:python3 scripts/eine-adresse-check.py" \
  "Keine Berechtigung ohne Funktion:python3 scripts/berechtigungen-check.py" \
  "Kein unbemerkter KI-Einsatz:python3 scripts/ki-einsatz-check.py" \
  "Keine rohe Kennung in der Oberflaeche:python3 scripts/rohe-kennung-check.py" \
  "Ton der Oberflaeche:python3 scripts/ton-check.py" \
  "Kein Gedankenstrich in sichtbarem Text:python3 scripts/gedankenstrich-check.py" \
  "Kein Mailversand ohne Einwilligung oder mit rohem Nutzertext:python3 scripts/mailversand-check.py" \
  "Tote Navigationsziele:python3 scripts/tote-links-check.py" \
  "Gast findet ueberall zum Login:node scripts/gast-login-check.cjs" \
  "Rollen und Routen:node scripts/rollen-routen-check.cjs" \
  "Nichts laeuft ueber den Rand:node scripts/rand-ueberstand-check.cjs" \
  "Fussleisten verdecken nichts:node scripts/fussleisten-check.cjs" \
  "Beschriftungen brechen nicht mitten im Wort:node scripts/wortumbruch-check.cjs" \
  "Auftragsentwurf ueberlebt Anmeldung:node scripts/entwurf-ueberlebt-check.cjs" \
  "Geld-Bildschirme kalt geoeffnet:node scripts/geldwege-check.cjs" \
  "Alle uebrigen Bildschirme kalt geoeffnet:node scripts/alle-screens-check.cjs" \
  "Kern-Reise 1 (Kunde):node scripts/reisen/reise1-kunde.cjs" \
  "Kern-Reise 2 (Anbieter, bis zur Grenze):node scripts/reisen/reise2-anbieter.cjs" \
; do
  NAME="${pruefung%%:*}"
  CMD="${pruefung#*:}"
  echo
  echo "=== $NAME ==="
  if ! eval "$CMD"; then
    echo ">>> FEHLGESCHLAGEN: $NAME"
    FAIL=1
  fi
done

echo
if [ $FAIL -eq 0 ]; then echo "=== alle Pruefungen bestanden ==="; else echo "=== MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN ==="; fi
exit $FAIL
