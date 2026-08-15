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

# LÜCKE 3 (16.08.2026): Der Du-Imperativ trägt gar kein Pronomen.
# „Bitte versuche es erneut" wurde deshalb von DUZ nicht gesehen — viermal in
# app/angebot.tsx und app/auftrag-detail.tsx. Die Sie-Form dieser Sätze lautet
# „Bitte versuchen Sie es erneut"; unterscheidbar ist beides nur an der
# Verbform. Deshalb hier die Verben, die in dieser Oberfläche als Aufforderung
# an den Nutzer wirklich vorkommen — kein Versuch, deutsche Morphologie
# allgemein zu lösen, sondern eine Liste, die beim Auftauchen neuer Fälle
# wächst.
DUZ_IMPERATIV = re.compile(
    r'\b(?:[Vv]ersuche|[Ww]ende|[Vv]erbessere|[Gg]ib|[Ww][äa]hle|[Pp]r[üu]fe|[Ss]chreibe'
    r'|[Tt]rage|[Ll]ade|[Nn]utze|[Bb]eachte|[Mm]elde|[Ss]chau|[Kk]licke|[Tt]ippe'
    r'|[Aa]chte|[Ss]ende|[Bb]est[äa]tige|[Ee]rg[äa]nze|[Ee]rz[äa]hle|[Kk]ontaktiere)\b'
)

# Fachbegriffe und Zitate, in denen "dein/dich" nicht die Nutzeransprache ist.
AUSNAHMEN = re.compile(r'Deinstall|deiktisch')

VERZEICHNISSE = ['app', 'components']


# LÜCKE 1: JSX-Textknoten stehen NICHT in Anführungszeichen.
#   <Text style={styles.heroLabel}>Dein Fokus heute</Text>
# Der ursprüngliche Prüfer sah ausschließlich Zeichenketten in Quotes und war
# damit für den häufigsten Fall sichtbaren Textes blind. Sechs der zehn am
# 16.08.2026 gefundenen Duz-Stellen standen genau so.


def nutzertexte(pfad: pathlib.Path):
    """Sichtbarer Text — Zeichenketten UND JSX-Textknoten, ohne Kommentare."""
    for nr, zeile in enumerate(pfad.read_text().split('\n'), 1):
        blank = zeile.strip()
        if blank.startswith('//') or blank.startswith('*') or blank.startswith('/*'):
            continue

        gefunden = []
        # LÜCKE 2: die Mindestlänge 10 hat placeholder="Dein Name" (9 Zeichen)
        # durchgelassen. Ein Platzhalter ist sichtbarer Text wie jeder andere.
        # Jetzt 4 — kurz genug für "Dein Name", lang genug, um Bezeichner und
        # Klassennamen draußen zu lassen.
        gefunden += re.findall(r"""['"`]([^'"`]{4,})['"`]""", zeile)

        # LÜCKE 1 + 4: sichtbarer JSX-Text steht NICHT in Anführungszeichen,
        # und bei langen Sätzen auch nicht zwischen ">" und "<" derselben
        # Zeile:
        #     <Text style={styles.warnText}>
        #       Du kannst vorübergehend keine neuen Angebote abgeben.
        #     </Text>
        # Dazu kommen Zeilen, die Prosa und eingebettete Ausdrücke mischen:
        #     Mehrere Kunden waren unzufrieden ({dash?.badReviewCount} …).
        #     Wir prüfen deinen Fall. Status: <Text …>Offen</Text>.
        #
        # Statt drei Sonderfällen deshalb EIN Verfahren: Ausdrücke in
        # geschweiften und Elemente in spitzen Klammern herausnehmen — was
        # übrig bleibt, ist genau das, was der Nutzer liest.
        rest = re.sub(r'\{[^{}]*\}', ' ', zeile)
        rest = re.sub(r'<[^<>]*>', ' ', rest)
        gefunden.append(rest)

        for treffer in gefunden:
            treffer = treffer.strip()
            # Nur Fließtext: mindestens ein Leerzeichen und echte Wörter.
            if ' ' in treffer and re.search(r'[A-Za-zÄÖÜäöüß]{3}', treffer):
                yield nr, treffer


def main() -> int:
    # Dieselbe Zeile wird zwangsläufig mehrfach gefunden (einmal als
    # Zeichenkette, einmal als Resttext). Gemeldet wird pro Fundstelle EINMAL,
    # mit dem kürzesten Treffer — das ist der reine Nutzertext ohne
    # umgebenden Code.
    je_stelle: dict[tuple[str, int], str] = {}
    for verzeichnis in VERZEICHNISSE:
        for f in sorted((WURZEL / verzeichnis).rglob('*.tsx')):
            for nr, text in nutzertexte(f):
                if AUSNAHMEN.search(text):
                    continue
                if ERWARTET_SIE and (DUZ.search(text) or DUZ_IMPERATIV.search(text)):
                    stelle = (str(f.relative_to(WURZEL)), nr)
                    if stelle not in je_stelle or len(text) < len(je_stelle[stelle]):
                        je_stelle[stelle] = text

    abweichungen = [(d, n, t[:78]) for (d, n), t in sorted(je_stelle.items())]

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
