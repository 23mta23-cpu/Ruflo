#!/usr/bin/env python3
"""Prüft die BEZIFFERTEN Zusagen der AGB gegen die Werte im Code.

ANLASS (16.08.2026): Zwei Widersprüche zwischen AGB und Code sind an einem Tag
aufgefallen — beide nicht durch einen Test, sondern durch Nachfragen des
Founders:

    §7(3)  "3 Strikes INNERHALB VON 12 MONATEN"
           Der Code zählte ohne jede Datumsgrenze über die gesamte Kontodauer.

    §2(4)  "Die Reihenfolge … richtet sich maßgeblich nach dem
            Bewertungsdurchschnitt und der Anzahl der Bewertungen"
           app/suche.tsx hatte GAR KEINE Sortierung.

Danach gesucht und einen dritten gefunden (§4(6), Ausfallentschädigung — siehe
notes/04-Entscheidungen/2026-08-16-agb-gegen-code.md; nicht automatisch
prüfbar, weil die Zusage eine fehlende Funktion betrifft, keinen falschen
Wert).

Dieser Prüfer deckt die Klasse ab, die sich mechanisch prüfen lässt: eine Zahl
steht in den AGB und dieselbe Zahl steht im Code. Läuft eines der beiden
auseinander, wird es rot — egal auf welcher Seite jemand geschraubt hat.

WAS ER NICHT KANN: Zusagen prüfen, die Verhalten beschreiben statt Zahlen
("wird dem Anbieter ausgezahlt", "wird per E-Mail mitgeteilt"). Dafür gibt es
keinen mechanischen Weg — die stehen in der Notiz oben und gehören bei jedem
Feature einzeln gegen den Paragraphen gelesen.

Ausführen:  python3 scripts/agb-code-check.py
Exit 0 = alle bezifferten Zusagen gedeckt, Exit 1 = Abweichung.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# (Fundstelle in den AGB, was zugesagt wird, Datei, Muster das im Code stehen muss)
ZUSAGEN = [
    ('§6(1)', 'Kunden-Servicegebühr 2,5 %',
     'lib/feeEngine.ts', r'CUSTOMER_FEE_RATE\s*=\s*0\.025\b'),
    ('§6(1)', 'Kunden-Servicegebühr mindestens 1,50 €',
     'lib/feeEngine.ts', r'MIN_CUSTOMER_FEE\s*=\s*1\.50?\b'),
    ('§6(1)', 'Werkant-Schutz pauschal 1,99 €',
     'lib/feeEngine.ts', r'Werkant_SCHUTZ_FEE\s*=\s*1\.99\b'),
    ('§6(2)', 'Anbieter-Provision 8 %',
     'lib/feeEngine.ts', r'PROVIDER_COMMISSION_RATE\s*=\s*0\.08\b'),
    ('§6(2)', 'Anbieter-Provision mindestens 3,00 €',
     'lib/feeEngine.ts', r'MIN_PROVIDER_FEE\s*=\s*3\.0?0?\b'),

    ('§4(6)', 'mehr als 48 h vorher: volle Erstattung',
     'lib/cancellationRefund.ts', r'hoursUntilScheduled\s*>\s*48\s*\)\s*return\s*1\.0'),
    ('§4(6)', '24 bis 48 h vorher: halbe Erstattung',
     'lib/cancellationRefund.ts', r'hoursUntilScheduled\s*>\s*24\s*\)\s*return\s*0\.5'),

    ('§7(3)', 'Strikes verfallen nach 12 Monaten',
     'supabase/migrations/0720_strike_verfall_und_begruendung.sql',
     r"created_at\s*>\s*now\(\)\s*-\s*interval\s*'12 months'"),
    ('§7(3)', 'Sperre ab 3 aktiven Strikes',
     'supabase/migrations/0720_strike_verfall_und_begruendung.sql',
     r'aktive_strikes\(auth\.uid\(\)\)\s*<\s*3'),

    ('§2(4)', 'Suche sortiert nach Bewertungsdurchschnitt',
     'app/suche.tsx', r"\.order\('rating_avg'"),
    ('§2(4)', 'Suche sortiert danach nach Anzahl der Bewertungen',
     'app/suche.tsx', r"\.order\('rating_count'"),
    ('§2(4)', 'Übersicht sortiert nach Bewertungsdurchschnitt',
     'app/(tabs)/index.tsx', r"\.order\('rating_avg'"),
    ('§2(4)', 'Neue Anbieter nach Registrierungsdatum',
     'app/(tabs)/index.tsx', r"\.order\('created_at'"),

    ('§3(1)', 'Mindestalter 18 Jahre',
     'app/registrierung.tsx', r'\b18\b'),
]


def main() -> int:
    fehlend = []
    for paragraph, zusage, datei, muster in ZUSAGEN:
        pfad = WURZEL / datei
        if not pfad.exists():
            fehlend.append((paragraph, zusage, datei, 'Datei fehlt'))
            continue
        if not re.search(muster, pfad.read_text()):
            fehlend.append((paragraph, zusage, datei, 'Muster nicht gefunden'))

    print(f'{len(ZUSAGEN)} bezifferte AGB-Zusagen geprueft, {len(fehlend)} ohne Deckung im Code.')
    if not fehlend:
        print('\nJede bezifferte Zusage der AGB findet sich so auch im Code.')
        return 0
    print('\nOHNE DECKUNG — AGB und Code sagen Verschiedenes:')
    for paragraph, zusage, datei, grund in fehlend:
        print(f'  AGB {paragraph}  {zusage}')
        print(f'      erwartet in {datei} — {grund}')
    print('\nEntweder der Code stimmt nicht mehr, oder der AGB-Text wurde')
    print('geaendert, ohne den Code nachzuziehen. Beides muss jemand ansehen.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
