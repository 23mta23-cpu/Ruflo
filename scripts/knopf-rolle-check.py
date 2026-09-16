#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Jeder Knopf muss fuer einen Screenreader ein Knopf sein.

ANLASS (16.09.2026). Beim Schreiben der Geldweg-Reise liess sich „Angebot
annehmen" nicht anklicken: der Knopf war ueber `[role="button"]` gar nicht zu
finden. Nachgesehen im Quelltext:

    <TouchableOpacity onPress={onAccept} ...>        <- Angebot annehmen
      <Text>Angebot annehmen · {eur(...)} gesamt</Text>

    <TouchableOpacity onPress={onAsk} accessibilityRole="button" ...>
      <Text>Frage stellen</Text>
    <TouchableOpacity onPress={onDecline} accessibilityRole="button" ...>
      <Text>Ablehnen</Text>

Die ZWEITRANGIGEN Aktionen waren ausgezeichnet, die wichtigste nicht. Wer den
Bildschirm mit einem Screenreader bedient, hoert „Frage stellen, Knopf" und
„Ablehnen, Knopf", aber die Annahme, die einen bindenden Vertrag schliesst,
nur als Text. Dasselbe beim Absendeknopf des Angebots.

Gemessen ueber die ganze Oberflaeche: 198 Beruehrflaechen mit `onPress` ohne
Rolle, 86 mit. Betroffen war also die Mehrheit.

Rechtlich: WCAG 2.2 Erfolgskriterium 4.1.2 (Name, Rolle, Wert) und damit BFSG.
§ 3 Abs. 3 BFSG nimmt Kleinstunternehmen bei Dienstleistungen aus, gebaut wird
trotzdem barrierefrei (docs/recht/ki-vo-und-bfsg.md). Und unabhaengig vom
Gesetz: ein Knopf, den die Bedienungshilfe nicht als Knopf meldet, ist
dieselbe Klasse wie ein Knopf ohne `onPress`.

ACHTUNG BEIM SELBER MESSEN: ein Ausdruck wie `[^>]*?` fuer die Attribute geht
schief. Ein Pfeil in `onPress={() => router.push('/x')}` enthaelt ein `>`, der
Ausdruck bricht dort ab und meldet Knoepfe als unausgezeichnet, die es nicht
sind. Genau das ist mir hier passiert: 42 angebliche Treffer, alle falsch.
Deshalb wird das oeffnende Tag ueber die Klammertiefe gelesen.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
BERUEHRBAR = re.compile(r'<(TouchableOpacity|Pressable|TouchableHighlight)(\s)')


def offene_tags(txt: str):
    """(Zeile, Attributtext) je oeffnendem Beruehr-Tag, klammerbewusst."""
    i = 0
    while True:
        m = BERUEHRBAR.search(txt, i)
        if not m:
            return
        j, tiefe = m.end(), 0
        while j < len(txt):
            c = txt[j]
            if c == '{':
                tiefe += 1
            elif c == '}':
                tiefe -= 1
            elif c == '>' and tiefe == 0:
                break
            j += 1
        yield txt[:m.start()].count('\n') + 1, txt[m.end():j]
        i = j


def main() -> int:
    ohne = []
    gesamt = 0
    for p in sorted(list(WURZEL.glob('app/**/*.tsx'))
                    + list(WURZEL.glob('components/**/*.tsx'))):
        txt = p.read_text(encoding='utf-8')
        for zeile, attrs in offene_tags(txt):
            if 'onPress' not in attrs:
                continue
            gesamt += 1
            if 'accessibilityRole' in attrs or re.search(r'\brole\s*=', attrs):
                continue
            ohne.append((p.relative_to(WURZEL).as_posix(), zeile))

    if ohne:
        print('Beruehrflaechen ohne Rolle: %d von %d\n' % (len(ohne), gesamt))
        for datei, zeile in ohne[:40]:
            print('  FEHLER: %s:%d' % (datei, zeile))
        if len(ohne) > 40:
            print('  … und %d weitere' % (len(ohne) - 40))
        print('\n  Eine Beruehrflaeche mit `onPress` ist ein Bedienelement. Ohne')
        print('  `accessibilityRole="button"` meldet die Bedienungshilfe sie als')
        print('  blossen Text (WCAG 4.1.2). Attribut ergaenzen.')
        return 1

    print('Knopf-Rollen: %d Beruehrflaechen mit onPress, alle ausgezeichnet.' % gesamt)
    return 0


if __name__ == '__main__':
    sys.exit(main())
