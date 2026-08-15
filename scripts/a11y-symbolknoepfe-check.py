#!/usr/bin/env python3
"""Findet Knöpfe, die NUR ein Symbol enthalten und keine Beschriftung tragen.

Für eine Vorlesefunktion ist so ein Knopf eine namenlose Fläche: sie meldet
„Schaltfläche" und sonst nichts. Wer die App nicht sehen kann, weiß nicht,
ob er gerade teilt, löscht oder abbricht.

Das ist in Deutschland nicht nur unhöflich: das Barrierefreiheitsstärkungs-
gesetz (BFSG) gilt seit dem 28.06.2025 für elektronische Dienstleistungen im
E-Commerce, wozu ein Vermittlungsmarktplatz zählt. Zugrunde liegt WCAG 4.1.2
(Name, Rolle, Wert).

BEFUND 15.08.2026: drei unbeschriftete Symbol-Knöpfe — und beim Nachsehen der
eigentliche Fund: `components/ui/AnimatedButton.tsx` reichte GAR KEINE
Barrierefreiheits-Angaben durch. Alle 22 Verwendungsstellen waren damit
namenlose Flächen ohne Rolle. Ein Sammelfund, der über die drei Einzelfälle
weit hinausging.

Ausführen:  python3 scripts/a11y-symbolknoepfe-check.py
Exit 0 = alle Symbol-Knöpfe beschriftet, Exit 1 = mindestens einer nicht.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Knopf, dessen Inhalt ausschliesslich ein <Ionicons/> ist -- ggf. mit einem
# Ausdruck davor (etwa ein bedingter Zaehler-Badge).
KNOPF = re.compile(
    r'<(TouchableOpacity|Pressable|AnimatedButton|TouchableWithoutFeedback)\b([^>]*)>\s*'
    r'(?:\{[^{}]*\}\s*)?'
    r'<Ionicons\b[^>]*/>\s*'
    r'</\1>',
    re.S,
)


# Der gemeinsame Baustein muss durchreichen, was die Aufrufstellen uebergeben.
# Ohne diese Pruefung faellt sein Ausbau NIRGENDS auf: die 22 Aufrufstellen
# uebergeben ihr Label weiterhin, TypeScript ist zufrieden (die Prop existiert
# ja), und die Suche oben sieht nur die Aufrufstelle -- das Label wird still
# verschluckt. Genau das war der Zustand bis zum 15.08.2026.
DURCHREICHEN = {
    'components/ui/AnimatedButton.tsx': [
        'accessibilityRole={accessibilityRole}',
        'accessibilityLabel={accessibilityLabel}',
        'accessible',
    ],
}


def durchreichen_geprueft() -> list[str]:
    fehlend = []
    for datei, erwartet in DURCHREICHEN.items():
        pfad = WURZEL / datei
        if not pfad.exists():
            fehlend.append(f'{datei} fehlt')
            continue
        quelle = pfad.read_text()
        for stelle in erwartet:
            if stelle not in quelle:
                fehlend.append(f'{datei}: "{stelle}" wird nicht durchgereicht')
    return fehlend


def main() -> int:
    befunde = []
    for verzeichnis in ('app', 'components'):
        for f in sorted((WURZEL / verzeichnis).rglob('*.tsx')):
            quelle = f.read_text()
            for m in KNOPF.finditer(quelle):
                if 'accessibilityLabel' in m.group(2):
                    continue
                nr = quelle[:m.start()].count('\n') + 1
                symbol = re.search(r'name="([^"]+)"', m.group(0))
                befunde.append((str(f.relative_to(WURZEL)), nr,
                                symbol.group(1) if symbol else '?'))

    verschluckt = durchreichen_geprueft()
    if verschluckt:
        print('DER GEMEINSAME BAUSTEIN VERSCHLUCKT DIE BESCHRIFTUNG:')
        for z in verschluckt:
            print(f'  {z}')
        print('\nDie Aufrufstellen uebergeben sie, sie kommt nur nirgends an.')
        return 1

    print(f'{len(befunde)} Symbol-Knopf/-Knoepfe ohne Beschriftung.')
    if not befunde:
        print('\nJeder Symbol-Knopf traegt einen Namen fuer die Vorlesefunktion.')
        print('Der gemeinsame Baustein reicht Rolle und Beschriftung durch.')
        return 0
    print('\nOHNE BESCHRIFTUNG — fuer eine Vorlesefunktion namenlos:')
    for datei, nr, symbol in befunde:
        print(f'  {datei}:{nr}   Symbol: {symbol}')
    print('\nBehebung: accessibilityLabel="…" ergaenzen (kurz, sagt was der Knopf TUT).')
    return 1


if __name__ == '__main__':
    sys.exit(main())
