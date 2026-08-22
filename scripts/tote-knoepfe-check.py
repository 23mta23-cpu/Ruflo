#!/usr/bin/env python3
"""Findet Bedienelemente, die auf eine Berührung nicht reagieren können.

ANLASS: Die häufigste Klasse von Founder-Befunden in diesem Projekt ist nicht
„etwas ist falsch", sondern „ich tippe darauf und es passiert nichts". Allein
am 16.08.2026 kamen zusammen:

    app/suche.tsx            Umkreis-Filter — filterte nie (distance war null)
    app/betrieb/kalender.tsx Frei/Gesperrt — wurde von nichts gelesen
    provider_profiles        strike_count — beschreibbar, ohne zu wirken
    app/betrieb/kalender.tsx Sync-Knopf — TouchableOpacity ganz ohne onPress
    app/chat.tsx             Angebotskarte samt „Ablehnen" — nie erreichbar
    app/betrieb/profil.tsx   „Foto ändern" — ohne onPress
    app/bewertung.tsx        „Fotos hinzufügen" — ohne onPress

Ein Element, das aussieht wie eine Funktion und keine ist, ist schlimmer als
ein fehlendes: der Nutzer probiert es mehrfach, hält die App für kaputt und
verliert das Vertrauen in alles daneben.

WAS DIESER PRÜFER PRÜFT: die mechanisch feststellbare Hälfte — ein
berührbares Element ohne jeden Handler. Er kann NICHT sehen, ob ein Handler
etwas Sinnvolles tut oder ob sein Ergebnis irgendwo gelesen wird; das waren
die drei ersten Fälle oben, und die findet nur Lesen.

EHRLICHE SACKGASSEN sind erlaubt: ein Knopf, der „ist noch nicht
freigeschaltet" sagt, hat einen Handler und ist damit keine Falle — er sagt
dem Nutzer die Wahrheit. Genau das ist der Unterschied.

Ausführen:  python3 scripts/tote-knoepfe-check.py
Exit 0 = jedes Bedienelement kann reagieren, Exit 1 = totes Element gefunden.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
VERZEICHNISSE = ['app', 'components']

ELEMENTE = ('TouchableOpacity', 'AnimatedButton', 'Pressable',
            'TouchableWithoutFeedback', 'TouchableHighlight', 'Switch')
HANDLER = ('onPress', 'onLongPress', 'onPressIn', 'onValueChange', 'onChange')

# Ausnahme für die seltenen Fälle, in denen ein berührbares Element bewusst
# nichts tut (z. B. eine Fläche, die nur Berührungen abfängt). Muss im
# Öffnungs-Tag stehen und den Grund nennen — sonst ist die Ausnahme selbst
# wieder eine Falle.
AUSNAHME = 'absichtlich-ohne-handler'


def oeffnungstag(zeilen, i, name):
    """Den vollständigen Öffnungs-Tag ab Zeile i einsammeln."""
    tag = ''
    for j in range(i, min(i + 30, len(zeilen))):
        tag += zeilen[j] + '\n'
        # Ende des Tags: ein '>' hinter dem Elementnamen, außerhalb von {…}
        ohne_ausdruecke = re.sub(r'\{[^{}]*\}', '', tag)
        nach_name = ohne_ausdruecke.split('<' + name, 1)[-1]
        if '>' in nach_name:
            break
    return tag


def main() -> int:
    befunde = []
    for verzeichnis in VERZEICHNISSE:
        for f in sorted((WURZEL / verzeichnis).rglob('*.tsx')):
            zeilen = f.read_text().split('\n')
            for i, zeile in enumerate(zeilen):
                m = re.search(r'<(' + '|'.join(ELEMENTE) + r')\b', zeile)
                if not m:
                    continue
                tag = oeffnungstag(zeilen, i, m.group(1))
                if AUSNAHME in tag:
                    continue
                if any(h in tag for h in HANDLER):
                    continue
                befunde.append((str(f.relative_to(WURZEL)), i + 1,
                                m.group(1), zeile.strip()[:70]))

    print(f'{len(befunde)} Bedienelement(e) ohne jede Reaktion.')
    if not befunde:
        print('\nJedes beruehrbare Element kann auf eine Beruehrung reagieren.')
        return 0
    print('\nTOT — sieht aus wie eine Funktion, ist keine:')
    for datei, nr, element, text in befunde:
        print(f'  {datei}:{nr}  <{element}>')
        print(f'      {text}')
    print('\nEntweder einen Handler geben, oder ehrlich sagen, dass es die')
    print('Funktion noch nicht gibt (Muster: app/reklamation.tsx). Ist das')
    print(f'Element bewusst untaetig, "{AUSNAHME}" mit Grund in den Tag schreiben.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
