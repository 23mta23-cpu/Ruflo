#!/usr/bin/env python3
"""Keine feste Zahl unter einer festgeklebten Aktionsleiste.

ANLASS (Apple HIG „Layout", Safe Areas): Sieben Bildschirme kleben unten
eine Leiste mit dem wichtigsten Knopf fest und hatten darunter einen
Festwert von 28 px (einmal 32). Auf einem iPhone ab X sind unten 34 px
fuer die Home-Anzeige reserviert -- der Knopf endete also INNERHALB des
Streifens, in dem das System die Wischgeste abfaengt. Auf einem Geraet
ohne Home-Anzeige waren dieselben 28 px tote Flaeche.

WARUM EIN QUELLTEXT-PRUEFER UND KEIN TEST:
react-native-web meldet `useSafeAreaInsets().bottom` ueberall als 0. Im
Browser-Pruefstand ist der reparierte und der kaputte Zustand also
NICHT unterscheidbar. Ein Wertvergleich kann eine Verdrahtung nicht
beweisen, wenn beide Seiten denselben Wert liefern (dieselbe Klasse wie
COMPANY.email gegen MAIL.kontakt, 16.08.2026). Geprueft wird deshalb die
Herkunft im Quelltext; die Rechnung selbst haelt __tests__/sichererRand.test.ts.

GRENZE: Die Wirkung am Geraet ist damit NICHT nachgewiesen. Dafuer
braucht es ein iPhone mit Home-Anzeige.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
HELFER = 'aktionsleistenRand'

# ZWEI Bauformen sitzen auf dem unteren Bildschirmrand:
#
# 1. Die festgeklebte Leiste: `position: 'absolute'` mit bottom/left/right
#    auf 0. Die volle Breite unterscheidet sie von Verzierungen wie
#    `availDot`, die zwar `bottom: 0` tragen, aber nur `right: 0`.
#    Ein `top: 0` schliesst sie aus: das ist dann ein Schleier ueber den
#    ganzen Bildschirm (`meldeHuelle`, `ProgressRing.center`), keine Leiste.
#
# 2. Das Blatt von unten: oben abgerundet, unten buendig am Rand. Im
#    Projekt immer an `borderTopLeftRadius` + `borderTopRightRadius`
#    erkennbar. Das Einwilligungs-Blatt ist eines davon -- es ist der
#    erste Bildschirm, den ueberhaupt jemand sieht.
LEISTE = re.compile(
    r"^\s*(\w+):\s*\{(?=[^\n]*position:\s*'absolute')"
    r"(?![^\n]*\btop:\s*0)"
    r"(?=[^\n]*bottom:\s*0)(?=[^\n]*left:\s*0)(?=[^\n]*right:\s*0)([^\n]*)\},$",
    re.M,
)
BLATT = re.compile(
    r"^\s*(\w+):\s*\{(?=[^\n]*borderTopLeftRadius)"
    r"(?=[^\n]*borderTopRightRadius)([^\n]*)\},$",
    re.M,
)
FESTWERT = re.compile(r"paddingBottom:\s*\d")


def main() -> int:
    befunde = []
    geprueft = 0
    for pfad in sorted(list((WURZEL / 'app').rglob('*.tsx')) + list((WURZEL / 'components').rglob('*.tsx'))):
        text = pfad.read_text()
        for treffer in list(LEISTE.finditer(text)) + list(BLATT.finditer(text)):
            name, rumpf = treffer.group(1), treffer.group(2)
            geprueft += 1
            rel = pfad.relative_to(WURZEL)
            zeile = text[:treffer.start()].count('\n') + 1
            if FESTWERT.search(rumpf):
                befunde.append(
                    f'{rel}:{zeile}  {name}: fester paddingBottom. '
                    f'Gehoert in den Bildschirm als {HELFER}(insets.bottom).'
                )
                continue
            bindung = re.compile(
                r'styles\.' + re.escape(name) + r'\s*,\s*\{\s*paddingBottom:\s*' + HELFER + r'\('
            )
            if not bindung.search(text):
                befunde.append(
                    f'{rel}:{zeile}  {name}: keine Verwendung mit {HELFER}(insets.bottom). '
                    f'Der Inhalt endet dann buendig am Bildschirmrand.'
                )

    # Eine Untergrenze, damit „0 Befunde" nicht mit einer leeren Auswahl
    # vereinbar ist. Gemessen am 21.09.2026: 7 Leisten, 6 Blaetter.
    MINDESTENS = 13
    if geprueft < MINDESTENS:
        print(f'FEHLER: nur {geprueft} Bauteile gefunden, erwartet mindestens '
              f'{MINDESTENS}. Der Pruefer greift ins Leere -- Muster pruefen.')
        return 1

    for b in befunde:
        print('FAIL  ' + b)
    print(f'\n{geprueft} Bauteile am unteren Rand geprueft, {len(befunde)} Befund(e).')
    return 1 if befunde else 0


if __name__ == '__main__':
    sys.exit(main())
