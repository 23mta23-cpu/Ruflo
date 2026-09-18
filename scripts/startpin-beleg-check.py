#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Die Zahlen im Start-PIN-Text muessen die der Datenbank sein.

ANLASS. Der Text sagt dem Betrieb: "Nach 3 Fehlversuchen ist die Eingabe 15
Minuten gesperrt." Gesperrt wird aber in `supabase/migrations/0960_start_pin.sql`,
und dort stehen die Zahlen ein zweites Mal. Zwei Stellen mit derselben Zahl
gehen auseinander, sobald jemand eine davon aendert.

WARUM EIN SKRIPT UND KEIN JEST-TEST. Ein Wertvergleich kann eine BINDUNG
nicht beweisen, wenn beide Seiten denselben Wert haben: `expect(3).toBe(3)`
bleibt gruen, auch wenn die Datenbank nach fuenf sperrt. Dieselbe Lehre wie
bei `COMPANY.email` gegen `MAIL.kontakt` (16.08.) und beim Provisionssatz
(16.09.). Herkunft ist eine Quelltext-Frage.

GRENZE, ausdruecklich: geprueft wird, dass die Zahlen UEBEREINSTIMMEN, nicht
dass die Sperre wirkt. Dafuer gibt es `scripts/db-test/start-pin.sql` (SP6,
SP7) und die Mutationsproben, die dort im Kopf stehen.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
TEXT = WURZEL / 'lib' / 'startPinText.ts'
MIGRATION = WURZEL / 'supabase' / 'migrations' / '0960_start_pin.sql'

fehler = []


def zahl_aus_text(quelle: str, name: str):
    treffer = re.search(r'export const ' + name + r'\s*=\s*(\d+)\s*;', quelle)
    return int(treffer.group(1)) if treffer else None


def main() -> int:
    for pfad in (TEXT, MIGRATION):
        if not pfad.exists():
            print(f'FEHLT: {pfad.relative_to(WURZEL)}')
            return 1

    quelle = TEXT.read_text(encoding='utf-8')
    sql = MIGRATION.read_text(encoding='utf-8')

    versuche = zahl_aus_text(quelle, 'STARTPIN_VERSUCHE')
    minuten = zahl_aus_text(quelle, 'STARTPIN_SPERRE_MINUTEN')
    if versuche is None or minuten is None:
        fehler.append('lib/startPinText.ts: STARTPIN_VERSUCHE oder '
                      'STARTPIN_SPERRE_MINUTEN nicht gefunden')
        versuche = minuten = -1

    # Die Sperrschwelle steht in 0960 als `>= N`, und zwar GENAU ZWEIMAL
    # (einmal fuer die Sperre, einmal fuer die Mitteilung an den Kunden).
    # Beide muessen dieselbe Zahl tragen wie der Text.
    schwellen = re.findall(r'v_zeile\.fehlversuche \+ 1 >= (\d+)', sql)
    if len(schwellen) != 2:
        fehler.append(f'0960: erwartet zwei Sperrschwellen, gefunden {len(schwellen)}')
    for gefunden in schwellen:
        if int(gefunden) != versuche:
            fehler.append(
                f'0960 sperrt nach {gefunden} Versuchen, der Text sagt {versuche}')

    dauer = re.findall(r"now\(\) \+ interval '(\d+) minutes'", sql)
    if len(dauer) != 1:
        fehler.append(f'0960: erwartet genau eine Sperrdauer, gefunden {len(dauer)}')
    for gefunden in dauer:
        if int(gefunden) != minuten:
            fehler.append(
                f'0960 sperrt {gefunden} Minuten, der Text sagt {minuten}')

    # Und die Laenge der Zahl: der Text sagt "vierstellig", die Datenbank
    # erzeugt und prueft sie.
    if "pin ~ '^[0-9]{4}$'" not in sql:
        fehler.append("0960: die Pruefregel auf vier Ziffern fehlt")
    if 'vierstellige' not in quelle and 'vierstellig' not in quelle:
        fehler.append('lib/startPinText.ts nennt die Laenge nicht mehr')

    if fehler:
        for f in fehler:
            print(f'FEHLER: {f}')
        return 1
    print(f'Start-PIN: Text und Datenbank stimmen ueberein '
          f'({versuche} Versuche, {minuten} Minuten, vier Ziffern).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
