#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Jede Zusage in constants/regeln.ts muss im Code durchgesetzt sein.

ANLASS. `constants/regeln.ts` sagt einem Kunden und einem Betrieb, was bei
Werkant anders ist. Genau so eine Liste ist die Stelle, an der in diesem
Projekt schon dreimal eine Unwahrheit entstanden ist:

    „Haftpflicht verifiziert"                 - nie eine Police gesehen
    „Sie zahlen erst, wenn Sie zufrieden sind" - falsch herum
    „24h Verifizierung"                        - nie gemessen

Alle drei standen monatelang da, weil nichts sie mit dem Code verglich.

Deshalb traegt jede Regel ihren eigenen Nachweis (`belegDatei`,
`belegStelle`), und dieser Pruefer stellt fest, dass die Stelle noch da ist.
Verschwindet die Durchsetzung, wird die Pruefung rot, bevor die Zusage zur
Luege wird.

GRENZEN, ehrlich benannt:
  * Er prueft, dass der BELEG existiert, nicht dass er das Versprochene
    bewirkt. `c.status = 'completed'` in einer Policy zu finden heisst nicht,
    dass die Policy aktiv ist. Dafuer gibt es die DB-Tests
    (`scripts/db-test/run.sh`), und genau dort liegen die Faelle.
  * Er kann eine Regel nicht daran hindern, sinnlos zu werden, solange die
    Zeichenkette stehen bleibt. Deshalb zwei Zusatzbedingungen: der Beleg
    darf nicht nur in einer Kommentarzeile stehen, und er muss in seiner
    Datei GENAU EINMAL vorkommen. Die zweite Bedingung stammt aus einer
    Mutation, die gruen blieb: „interval '12 months'" gab es dreimal in
    derselben Migration, also hielt der Beleg nichts fest.
  * Er sagt nichts darueber, ob die Regeln irgendwo ANGEZEIGT werden. Das
    prueft `__tests__/regeln.test.ts`.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
QUELLE = WURZEL / 'constants' / 'regeln.ts'

EINTRAG = re.compile(
    r"titel:\s*'((?:[^'\\]|\\.)*)'.*?"
    r"belegDatei:\s*'((?:[^'\\]|\\.)*)'\s*,\s*"
    r"belegStelle:\s*(?P<q>['\"])(?P<stelle>(?:(?!(?P=q))[^\\]|\\.)*)(?P=q)",
    re.S)

KOMMENTAR = re.compile(r'^\s*(//|--|\*|/\*)')


def main() -> int:
    if not QUELLE.is_file():
        print('FEHLER: constants/regeln.ts fehlt.')
        return 1
    text = QUELLE.read_text(encoding='utf-8')
    eintraege = [(m.group(1), m.group(2), m.group('stelle'))
                 for m in EINTRAG.finditer(text)]

    if not eintraege:
        print('FEHLER: keine Regel mit Beleg gefunden. Entweder ist die Liste leer '
              'oder das Format hat sich geaendert und dieser Pruefer laeuft ins Leere.')
        return 1

    befunde = []
    for titel, datei, stelle in eintraege:
        stelle = stelle.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        p = WURZEL / datei
        if not p.is_file():
            befunde.append((titel, 'Die Belegdatei %s gibt es nicht (mehr).' % datei))
            continue
        inhalt = p.read_text(encoding='utf-8')
        if stelle not in inhalt:
            befunde.append((titel,
                'In %s steht „%s" nicht mehr. Entweder ist die Regel nicht mehr '
                'durchgesetzt, dann muss sie aus der Liste; oder die Stelle ist '
                'umgezogen, dann muss der Beleg mitziehen.' % (datei, stelle)))
            continue
        # Ein Beleg, der mehrfach vorkommt, haelt nichts fest. Gemessen am
        # 16.09.2026: „interval '12 months'" stand dreimal in derselben
        # Migration, und die Mutation „Verfallsdatum entfernt" blieb GRUEN.
        anzahl = inhalt.count(stelle)
        if anzahl > 1:
            befunde.append((titel,
                'In %s steht „%s" %dx. Ein Beleg, der mehrfach vorkommt, haelt '
                'nichts fest: faellt eine Stelle weg, bleibt die Pruefung gruen. '
                'Eine eindeutige Stelle waehlen (z. B. die ganze Zeile).'
                % (datei, stelle, anzahl)))
            continue

        # Ein auskommentierter Beleg setzt nichts durch.
        traegt = [z for z in inhalt.split('\n') if stelle in z and not KOMMENTAR.match(z)]
        if not traegt:
            befunde.append((titel,
                'In %s steht „%s" nur in einem Kommentar. Ein Kommentar setzt '
                'nichts durch.' % (datei, stelle)))

    if befunde:
        print('Regeln ohne Durchsetzung: %d von %d\n' % (len(befunde), len(eintraege)))
        for titel, grund in befunde:
            print('  FEHLER: „%s"' % titel)
            print('          %s\n' % grund)
        return 1

    print('Regeln: %d Zusagen, jede mit einer Stelle im Code, die sie durchsetzt.'
          % len(eintraege))
    return 0


if __name__ == '__main__':
    sys.exit(main())
