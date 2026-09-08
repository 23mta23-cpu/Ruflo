#!/usr/bin/env python3
"""Holt aus einer .tsx/.ts-Datei das heraus, was ein Nutzer LIEST.

Lag bis zum 08.09.2026 in scripts/ton-check.py. Herausgezogen, als der
zweite Pruefer (gedankenstrich-check.py) dieselbe Arbeit brauchte: zwei
Kopien desselben Auszugs heisst, dass eine davon irgendwann veraltet und
still an einer Fehlerklasse vorbeisieht.

ANLASS der ersten Fassung: Die Version davor schickte .tsx-Dateien durch
einen HTML-Parser. Der kennt kein `//` und keine JS-Zeichenketten, also
zaehlten Code-Kommentare als Nutzertext. Ergebnis: sechs Befunde, fuenf
davon in Kommentaren. Ein Pruefer, der Kommentare anmahnt, wird beim
ersten Lauf abgeschaltet.

GRENZEN, damit ihm niemand zu viel zutraut:
  - Der Auszug unterscheidet nicht zwischen Beschriftung und internem
    Schluesselwort; beides sind Zeichenketten.
  - Der Resttext-Zweig (was zwischen den Marken stehen bleibt) enthaelt
    auch Codezeilen. Wer darin nach Satzzeichen sucht, die auch in Code
    vorkommen (Minus, Doppelpunkt, Klammern), bekommt Fehlalarme.
    Deshalb hat gedankenstrich-check.py getrennte Regeln fuer
    Zeichenketten und Resttext.
"""
import re

# console.log/warn/error in Edge Functions sind Betriebsprotokolle, kein
# Nutzertext. Sie stehen oft ueber mehrere Zeilen, ein zeilenweises
# Filtern nach "console." verfehlt also die Fortsetzungszeilen.
_CONSOLE = re.compile(r'console\.\w+\s*\(')


def ohne_console(quelle: str) -> str:
    """Entfernt vollstaendige console.*(...)-Aufrufe samt Fortsetzungszeilen.

    Die Zeilenumbrueche des entfernten Aufrufs bleiben stehen, sonst
    verschieben sich alle Zeilennummern danach und ein Befund zeigt auf die
    falsche Stelle (gemessen: Zeile 3 statt 5).
    """
    ergebnis = []
    pos = 0
    while True:
        m = _CONSOLE.search(quelle, pos)
        if not m:
            ergebnis.append(quelle[pos:])
            return ''.join(ergebnis)
        ergebnis.append(quelle[pos:m.start()])
        # Ab der oeffnenden Klammer zaehlen, bis sie sich schliesst.
        tiefe, i = 0, m.end() - 1
        while i < len(quelle):
            if quelle[i] == '(':
                tiefe += 1
            elif quelle[i] == ')':
                tiefe -= 1
                if tiefe == 0:
                    break
            i += 1
        entfernt = quelle[m.start():i + 1]
        ergebnis.append('\n' * entfernt.count('\n'))
        pos = i + 1


def zeichenketten_und_resttext(quelle: str):
    """(Zeichenketten, Resttext-Zeilen) einer Quelldatei, je mit Zeilennummer.

    Verfahren wie in anrede-check.py: Kommentare raus, dann pro Zeile die
    Ausdruecke in geschweiften und die Elemente in spitzen Klammern
    entfernen. Was uebrig bleibt, ist der sichtbare Text zwischen den
    Marken; dazu die Zeichenketten ab vier Zeichen, die als Beschriftung
    oder Meldung dienen.
    """
    # Blockkommentare zuerst, sonst bleiben ihre Innenzeilen stehen.
    ohne = re.sub(r'/\*.*?\*/', ' ', quelle, flags=re.S)
    ketten, rest_zeilen = [], []
    for nr, zeile in enumerate(ohne.split('\n'), 1):
        nackt = zeile.strip()
        if nackt.startswith(('//', '*', '#')):
            continue
        zeile = re.sub(r'//.*$', ' ', zeile)
        for m in re.finditer(r"['\"`]([^'\"`\n]{4,})['\"`]", zeile):
            ketten.append((nr, m.group(1)))
        rest = re.sub(r'\{[^{}]*\}', ' ', zeile)
        rest = re.sub(r'<[^<>]*>', ' ', rest)
        if ' ' in rest.strip() and re.search(r'[A-Za-zÄÖÜäöüß]{3}', rest):
            rest_zeilen.append((nr, rest))
    return ketten, rest_zeilen


def sichtbarer_text_tsx(quelle: str) -> str:
    """Alles Sichtbare als ein Fliesstext, fuer Pruefer, die Saetze zaehlen."""
    ketten, rest = zeichenketten_und_resttext(quelle)
    return ' '.join(t for _, t in ketten + rest)
