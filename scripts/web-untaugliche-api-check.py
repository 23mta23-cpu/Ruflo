#!/usr/bin/env python3
"""Findet React-Native-Aufrufe, die auf react-native-web wirkungslos sind.

ANLASS (Founder am Geraet, 16.09.2026): „Die buttons beim Kalender woche
freigeben etc. Funktionieren nicht."

Ursache: `app/betrieb/kalender.tsx` rief `Alert.alert(...)` direkt aus
`react-native`. Auf react-native-web ist `Alert` NICHT implementiert -- der
Aufruf laeuft ins Leere, ohne Fehler, ohne Meldung. Zwei Knoepfe, die
nachweislich nichts taten, und zwar seit es sie gibt.

Das Projekt hat fuer genau diesen Fall `lib/alert.ts` (`showAlert`): auf Mobil
leitet es weiter, im Web rendert es ein echtes Fenster. Es war da und wurde an
zwei Stellen nicht benutzt.

WARUM ES KEIN TEST GEFUNDEN HAT: `npx tsc` ist zufrieden (die API existiert
typseitig), Jest rendert diese Bildschirme nicht, und die Browser-Reisen
kommen an den Anbieter-Kalender nur mit Sitzungs-Ersatz und tippen dort keine
Knoepfe. Ein Aufruf, der still nichts tut, ist genau die Sorte Fehler, die
nur am Geraet auffaellt -- deshalb hier ein Quelltext-Pruefer.

GRENZE: geprueft wird der AUFRUF, nicht die Wirkung. Dass `showAlert` das
Richtige tut, steht in `lib/alert.ts` und in den Browser-Reisen.

Ausfuehren:  python3 scripts/web-untaugliche-api-check.py
Exit 0 = nichts gefunden, Exit 1 = mindestens eine Fundstelle.
"""
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# (Aufrufmuster, warum es im Web nicht wirkt, was stattdessen zu nehmen ist)
VERBOTEN = [
    (re.compile(r'\bAlert\.alert\s*\('),
     'react-native-web implementiert Alert nicht; der Aufruf tut still nichts',
     "showAlert aus lib/alert.ts"),

    # GEMESSEN am 16.09.2026 im Pruefstand, nicht vermutet:
    #   navigator.share vorhanden: undefined
    #   Error: Share is not supported in this browser
    # Auf /widerruf lag KEIN try/catch darum. Der Nutzer fuellte das
    # Formular aus, tippte „Widerruf erklaeren", und es passierte nichts --
    # im gesetzlichen Widerrufsweg (§ 355 BGB).
    (re.compile(r'\bShare\.share\s*\('),
     'die Web Share API fehlt in den meisten Desktop-Browsern; react-native-web wirft dann',
     "teileText aus lib/teilen.ts (faellt auf einen Download zurueck)"),
]

# `lib/alert.ts` MUSS Alert.alert aufrufen -- es ist der Weiterleitungspunkt
# fuer Mobil. Ein Pruefer, der seine eigene Loesung anmahnt, wird abgeschaltet.
AUSNAHMEN = {
    'lib/alert.ts',   # der Weiterleitungspunkt fuer Mobil
    'lib/teilen.ts',  # dito fuer Share
}

# Ordner, die ein Nutzer im Browser zu sehen bekommt.
ORDNER = ['app', 'components', 'lib', 'contexts']


def dateien():
    for ordner in ORDNER:
        wurzel = WURZEL / ordner
        if not wurzel.is_dir():
            continue
        for p in sorted(wurzel.rglob('*.ts')):
            yield p
        for p in sorted(wurzel.rglob('*.tsx')):
            yield p


def main() -> int:
    befunde = []
    geprueft = 0
    for pfad in dateien():
        rel = pfad.relative_to(WURZEL).as_posix()
        if rel in AUSNAHMEN:
            continue
        geprueft += 1
        for nr, zeile in enumerate(pfad.read_text(encoding='utf-8').splitlines(), 1):
            # Kommentare uebergehen: sonst meldet der Pruefer die Erklaerung,
            # warum man es NICHT tun soll (genau so am 16.09. passiert).
            if zeile.lstrip().startswith(('//', '*', '/*')):
                continue
            for muster, grund, statt in VERBOTEN:
                if muster.search(zeile):
                    befunde.append((rel, nr, zeile.strip(), grund, statt))

    if geprueft < 50:
        print(f'ABBRUCH: nur {geprueft} Dateien geprueft, erwartet >= 50. Falscher Pfad?')
        return 1

    if not befunde:
        print(f'{geprueft} Dateien geprueft, keine im Web wirkungslose API gefunden.')
        return 0

    print(f'{len(befunde)} Aufruf(e), die im Browser still nichts tun:\n')
    for rel, nr, text, grund, statt in befunde:
        print(f'  {rel}:{nr}')
        print(f'    {text}')
        print(f'    {grund}')
        print(f'    stattdessen: {statt}\n')
    return 1


if __name__ == '__main__':
    sys.exit(main())
