#!/usr/bin/env python3
"""Prüft, dass die Oberfläche durchgehend siezt.

ANLASS (15.08.2026): Der Kundenbereich siezte durchgehend, der Anbieterbereich
mischte — 10 Duz- gegen 11 Siez-Stellen. Am deutlichsten am selben Feld auf zwei
benachbarten Screens:

    app/betrieb/profil-bearbeiten.tsx   "Beschreiben Sie kurz Ihre Leistungen …"
    app/betrieb/profil.tsx              "Beschreibe deine Dienstleistungen …"

Das ist Drift, keine Strategie. Wer beim Wechsel zwischen zwei Bildschirmen
plötzlich anders angesprochen wird, merkt das — und es liest sich unfertig.

ENTSCHEIDUNG (von mir getroffen, umkehrbar): durchgehend SIE in der App.
Begründung: der Kundenbereich war bereits vollständig Sie; die Marke ist auf
Vertrauen und Handwerk positioniert; und das Vertriebs-Playbook
(docs/sales/koeln-akquise-startpaket.md) reserviert das Du bereits ausdrücklich
für die informellen Kanäle (WhatsApp) und siezt in der E-Mail. Das Du hat also
einen Platz, nur nicht im Produkt.

Soll das Produkt duzen, ist das eine Founder-Entscheidung: dann ERWARTET_SIE
hier auf False setzen und die Texte einmal umziehen.

Ausführen:  python3 scripts/anrede-check.py
Exit 0 = einheitlich, Exit 1 = Mischung gefunden.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ERWARTET_SIE = True

# Bewusst konservativ: nur Formen, die sich nicht anders lesen lassen.
# "Sie" am Satzanfang bleibt mehrdeutig (sie = Plural), deshalb zählt für die
# Siez-Seite vor allem der Possessivbegleiter.
DUZ = re.compile(r'\b(?:Du|Dein|Deine[nmrs]?|Dir|Dich|dein|deine[nmrs]?|dich|dir)\b')

# Fachbegriffe und Zitate, in denen "dein/dich" nicht die Nutzeransprache ist.
AUSNAHMEN = re.compile(r'Deinstall|deiktisch')

VERZEICHNISSE = ['app', 'components']


def nutzertexte(pfad: pathlib.Path):
    """Nur sichtbare Zeichenketten — keine Bezeichner, keine Kommentare."""
    for nr, zeile in enumerate(pfad.read_text().split('\n'), 1):
        blank = zeile.strip()
        if blank.startswith('//') or blank.startswith('*') or blank.startswith('/*'):
            continue
        for treffer in re.findall(r"""['"`]([^'"`]{10,})['"`]""", zeile):
            # Nur Fließtext: mindestens ein Leerzeichen und echte Wörter.
            if ' ' in treffer and re.search(r'[A-Za-zÄÖÜäöüß]{3}', treffer):
                yield nr, treffer


def main() -> int:
    abweichungen = []
    for verzeichnis in VERZEICHNISSE:
        for f in sorted((WURZEL / verzeichnis).rglob('*.tsx')):
            for nr, text in nutzertexte(f):
                if AUSNAHMEN.search(text):
                    continue
                if ERWARTET_SIE and DUZ.search(text):
                    abweichungen.append((str(f.relative_to(WURZEL)), nr, text[:78]))

    form = 'Sie' if ERWARTET_SIE else 'Du'
    print(f'Erwartete Anrede: {form}. {len(abweichungen)} Abweichung(en).')
    if not abweichungen:
        print('\nDie Oberflaeche spricht Nutzer einheitlich an.')
        return 0
    print('\nABWEICHUNGEN:')
    for datei, nr, text in abweichungen:
        print(f'  {datei}:{nr}  {text}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
