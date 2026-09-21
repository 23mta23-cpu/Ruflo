#!/usr/bin/env python3
"""Die Obergrenze je Auftrag steht in zwei Dateien. Sie muessen gleich sein.

ANLASS (20.09.2026): `app/garantie.tsx` nannte eine Beta-Obergrenze von
5.000 EUR je Auftrag als Tatsache. Gemessen gab es sie nirgends -- weder im
Client, noch in einer Edge Function, noch in der Datenbank. Ein Angebot ueber
40.000 EUR waere durchgegangen, und der Treuhandbetrag haette in derselben
Hoehe auf dem Konto gelegen.

Seit Migration 1000 gibt es sie wirklich, und damit gibt es sie ZWEIMAL:

  lib/transaktionsgrenze.ts            TRANSAKTIONSGRENZE_EUR
  supabase/migrations/1000_*.sql       check (price <= ...)

Laufen die auseinander, passiert eines von zwei Dingen. Ist die Zahl im Code
groesser, sendet ein Betrieb ein Angebot und bekommt einen rohen
Datenbankfehler. Ist sie kleiner, sperrt die Oberflaeche mehr als noetig und
niemand merkt, dass die Datenbank mehr erlaubt als versprochen.

WARUM EIN QUELLTEXT-ABGLEICH: ein Wertvergleich zur Laufzeit koennte die
Bindung nicht beweisen, solange beide Seiten dieselbe Zahl tragen -- dieselbe
Ueberlegung wie bei der Meisterpflicht-Liste und bei den Geldfristen.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
TS = WURZEL / 'lib' / 'transaktionsgrenze.ts'
SQL = WURZEL / 'supabase' / 'migrations' / '1000_transaktionsgrenze.sql'
GARANTIE = WURZEL / 'app' / 'garantie.tsx'


def main() -> int:
    befunde = []
    ts = TS.read_text(encoding='utf-8')
    sql = SQL.read_text(encoding='utf-8')
    garantie = GARANTIE.read_text(encoding='utf-8')

    m = re.search(r'export const TRANSAKTIONSGRENZE_EUR = (\d+)', ts)
    # Nur die wirksame Anweisung lesen, nicht den Kommentar darueber -- sonst
    # faengt der Pruefer die Zahl aus der Begruendung.
    ohne_kommentar = '\n'.join(re.sub(r'--.*$', '', z) for z in sql.split('\n'))
    n = re.search(r'check\s*\(\s*price\s*<=\s*(\d+)\s*\)', ohne_kommentar)

    if not m:
        befunde.append('lib/transaktionsgrenze.ts nennt kein TRANSAKTIONSGRENZE_EUR mehr.')
    if not n:
        befunde.append('Migration 1000 traegt keine Obergrenze auf offers.price mehr. '
                       'Ohne sie ist die Zusage auf der Garantie-Seite wieder unwahr.')
    if m and n and int(m.group(1)) != int(n.group(1)):
        befunde.append(f'Der Code nennt {m.group(1)} EUR, die Datenbank {n.group(1)} EUR. '
                       'Ist der Code groesser, bekommt ein Betrieb einen rohen '
                       'Datenbankfehler; ist er kleiner, erlaubt die Datenbank mehr '
                       'als versprochen.')

    # Und die Garantie-Seite darf die Zahl nicht wieder selbst hinschreiben.
    if 'TRANSAKTIONSGRENZE_EUR' not in garantie:
        befunde.append('app/garantie.tsx holt die Grenze nicht mehr aus dem Modul. '
                       'Genau so ist die Zahl urspruenglich entstanden: als Literal '
                       'ohne Mechanismus dahinter.')
    if re.search(r'Transaktionslimit bei\s*€?\s*[\d.]+', garantie):
        befunde.append('app/garantie.tsx nennt wieder eine feste Zahl im Text.')

    for b in befunde:
        print(f'BEFUND: {b}')
    if befunde:
        print(f'\n{len(befunde)} Befund(e) bei der Transaktionsgrenze.')
        return 1
    print(f'Transaktionsgrenze: Code und Datenbank nennen beide {m.group(1)} EUR.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
