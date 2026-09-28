#!/usr/bin/env python3
"""Jeder Schreibvorgang in einer Edge Function liest seinen Fehler.

ANLASS (28.09.2026): Dieselbe Klasse, die am selben Tag elf Bildschirme
betraf ("supabase-js wirft nicht, also wird aus einem Fehler ein neutraler
Wert"), gibt es auch serverseitig -- und dort sieht sie KEIN Browser-Pruefer:
scripts/lib/anbieter-sitzung.cjs ersetzt jede Edge Function durch einen Stub.
Gemessen: 29 Schreibanweisungen, 21 lasen ihren Fehler, 8 nicht. Davon waren
zwei echte Befunde:

  delete-account   provider_profiles.update({available:false}) ungeprueft --
                   scheitert es, bleibt der Betrieb nach der Loeschung in der
                   Suche stehen, waehrend dem Nutzer "geloescht" gemeldet
                   wurde (Art. 17 DSGVO).
  cancel-contract  jobs.update({status:'open'}) ungeprueft -- scheitert es,
                   haengt der Auftrag mit zugewiesenem Anbieter fest und kann
                   kein neues Angebot bekommen.

Zwei weitere waren FEHLALARME dieses Musters: sie pruefen die Wirkung ueber
`.select(...)` und das zurueckgegebene `data` (stripe-webhook Korrektur-Zweig,
waitlist-doi). Deshalb gilt auch das als geprueft.

DREI RICHTUNGEN, wie bei scripts/aufbewahrung-check.py:
  1. Jeder Schreibvorgang liest `error` ODER prueft `data` ODER traegt eine
     Ausnahme-Begruendung.
  2. Die bekannten Ausnahmen kommen noch vor (Verfallspruefung) -- sonst
     prueft eine Liste ohne Eintraege weniger, als ihr Name sagt.
  3. Ein NEUER ungeprueefter Schreibvorgang faellt auf. Nur diese Richtung
     faengt den naechsten Zugang.

GRENZE: geprueft wird, ob der Fehler GELESEN wird, nicht ob richtig darauf
reagiert wird. Ein `if (err) {}` waere hier gruen. Was bei einem Webhook die
richtige Reaktion ist, steht im Code danebengeschrieben (200 an Stripe, sonst
wiederholt er und das Escrow wird doppelt verarbeitet).
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
FUNKTIONEN = WURZEL / 'supabase' / 'functions'

SCHREIBT = re.compile(r"\.(insert|update|upsert|delete)\s*\(")
# Eine Ausnahme wird mit diesem Marker samt Grund danebengeschrieben.
MARKER = 'fehler-egal:'

# Bekannte Ausnahmen: (Datei, Stichwort im Grund). Richtung 2 prueft, dass es
# sie noch gibt -- verschwindet eine, ist die Liste zu korrigieren.
AUSNAHMEN = [
    ('verify-email/index.ts', 'Antwort nicht aendern'),
    ('verify-email/index.ts', 'Einmal-Zeile'),
]

# Die beiden stripe-webhook-Stellen tragen ebenfalls einen `fehler-egal:`-
# Marker, stehen hier aber NICHT: sie LESEN ihren Fehler inzwischen und
# protokollieren ihn. Der Marker begruendet dort nur, warum trotzdem 200 an
# Stripe geht (sonst wiederholt er und das Escrow wird doppelt verarbeitet).
# Begruendete Reaktion ist etwas anderes als ungelesener Fehler.


def anweisungen(text: str):
    """Jede `await …from(…)…;`-Anweisung mit ihrer Zeilennummer."""
    for m in re.finditer(r"(const\s*\{[^}]*\}\s*=\s*)?await\s+\w+\s*\n?\s*\.from\(", text):
        ende = text.find(';', m.start())
        if ende == -1:
            continue
        yield m.start(), text[:m.start()].count('\n') + 1, m.group(1) or '', text[m.start():ende]


def main() -> int:
    if not FUNKTIONEN.is_dir():
        print('FAIL supabase/functions fehlt')
        return 1

    befunde = []
    geprueft = 0
    ausnahmen_gefunden = []

    for pfad in sorted(FUNKTIONEN.rglob('*.ts')):
        if '/tests/' in str(pfad) or pfad.name.endswith('.test.ts'):
            continue
        text = pfad.read_text(encoding='utf-8')
        zeilen = text.split('\n')
        for start, zeile, kopf, stmt in anweisungen(text):
            if not SCHREIBT.search(stmt):
                continue
            geprueft += 1
            if 'error' in kopf:
                continue
            # Wirkung statt Fehler geprueft: `.select(...)`, und das `data`
            # wird ausgewertet. Die Zuweisung kann ein paar Zeilen davor
            # stehen (waitlist-doi schreibt in einem Ternaer), deshalb wird
            # zusaetzlich zurueckgesehen -- sonst meldet der Pruefer eine
            # Stelle, die ihre Wirkung sehr wohl prueft.
            davor_zuweisung = '\n'.join(zeilen[max(0, zeile - 5):zeile])
            if '.select(' in stmt and ('data' in kopf or 'const { data' in davor_zuweisung):
                continue
            # Ausnahme mit Begruendung in den fuenf Zeilen davor.
            davor = '\n'.join(zeilen[max(0, zeile - 6):zeile])
            if MARKER in davor:
                grund = davor.split(MARKER, 1)[1].strip()
                ausnahmen_gefunden.append((str(pfad.relative_to(WURZEL)), grund))
                continue
            befunde.append((str(pfad.relative_to(WURZEL)), zeile, stmt.split('\n')[0].strip()[:70]))

    # Richtung 1 und 3
    for datei, zeile, s in befunde:
        print(f'FAIL {datei}:{zeile} schreibt, ohne den Fehler zu lesen  ({s})')

    # Richtung 2: Verfallspruefung der Ausnahmeliste. Gesucht wird der MARKER
    # im Dateitext, nicht der Befund -- eine Stelle kann begruendet UND
    # fehlerlesend sein, und dann taucht sie oben gar nicht auf.
    fehlend = []
    for datei, stichwort in AUSNAHMEN:
        quelle = FUNKTIONEN / datei
        text = quelle.read_text(encoding='utf-8') if quelle.exists() else ''
        treffer = [a.split('\n', 1)[0] + ' ' + a.split('\n')[1] if '\n' in a else a
                   for a in text.split(MARKER)[1:]]
        if not any(stichwort in s for s in treffer):
            fehlend.append(f'{datei} ({stichwort})')
    for f in fehlend:
        print(f'FAIL Ausnahme steht in der Liste, kommt im Code aber nicht mehr vor: {f}')

    if befunde or fehlend:
        print(f'\n{len(befunde)} ungeprueefte(r) Schreibvorgang/-vorgaenge, '
              f'{len(fehlend)} verfallene Ausnahme(n).')
        return 1

    print(f'PASS {geprueft} Schreibvorgaenge in Edge Functions geprueft.')
    print(f'PASS {len(ausnahmen_gefunden)} begruendete Ausnahme(n), alle noch im Code.')
    print('PASS kein Schreibvorgang ohne Fehlerpruefung oder Begruendung.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
