#!/usr/bin/env python3
"""Misst den Ton einer Seite: Verneinungsdichte und Angst-Sprache.

ANLASS (Founder, 05.09.2026): "Mir gefaellt die sprache nicht sowas wie geld
ist dann weg und sonstiges. Die negation ist meines Erachtens zu Hoch."

Der Befund dahinter war schlimmer als "zu viele Neins": Ich hatte Angst
GEPFLANZT. Niemand sorgte sich um eine Insolvenz des Handwerkers, bis ich sie
erwaehnte, und der Handwerker wurde zum Gegner gemacht ("Streiten mit dem
Einzigen, der das Rohr wieder zubekommt").

Deshalb ZWEI Zahlen, nicht eine:

  1. Verneinungsdichte — wie viele Saetze ueberhaupt ueber ein Nein laufen.
     Ein hoher Wert macht Text anstrengend, ist aber nicht per se falsch:
     "Keine Vermittlungsgebuehr" ist ein Versprechen in Verneinungsform.

  2. Angst-Woerter — Verlust, Streit, Betrug, Schaden. DAS war die Beschwerde.
     Diese Zahl gehoert auf null, ausser wo ein Wort rechtlich noetig ist
     (Widerruf, Haftung).

GRENZE, damit ihr niemand zu viel zutraut: Das Skript zaehlt Woerter, es
versteht keine Bedeutung. Ironie, Zitate und rechtlich vorgeschriebene
Formulierungen erkennt es nicht. Es ersetzt kein Lesen — es zeigt, WO man
lesen muss.
"""
import re
import sys
from html.parser import HTMLParser

VERNEINUNG = re.compile(
    r"\b(nicht|kein|keine|keinen|keinem|keiner|keines|nie|niemals|niemand|"
    r"nirgends|ohne|statt|anstatt|weder|kaum|selten|aufhoert|aufhört)\b", re.I)

# Woerter, die dem Leser eine Sorge einreden, die er vorher nicht hatte.
ANGST = re.compile(
    r"\b(weg|verloren|verlieren|verlust|pleite|insolven\w*|betrug|betrogen|"
    r"abzock\w*|streit\w*|aerger|ärger|schaden|risiko|risiken|gefahr|"
    r"schlimm\w*|katastroph\w*|albtraum|horror|pfusch|falle|reinfall)\b", re.I)

class NurText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.teile, self.ueberspringen = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.ueberspringen += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.ueberspringen:
            self.ueberspringen -= 1
    def handle_data(self, daten):
        if not self.ueberspringen:
            self.teile.append(daten)

def saetze(text):
    text = re.sub(r"\s+", " ", text)
    roh = re.split(r"(?<=[.!?·—])\s+|\s*\|\s*", text)
    return [s.strip() for s in roh if len(s.strip()) >= 12]

def pruefe(pfad):
    p = NurText()
    p.feed(open(pfad, encoding="utf-8").read())
    liste = saetze(" ".join(p.teile))
    if not liste:
        print(f"{pfad}: kein Text gefunden")
        return 1

    mit_nein = [s for s in liste if VERNEINUNG.search(s)]
    mit_angst = [s for s in liste if ANGST.search(s)]
    quote = round(100 * len(mit_nein) / len(liste))

    print(f"\n=== {pfad} ===")
    print(f"{len(liste)} Saetze · Verneinung in {len(mit_nein)} ({quote} %) · "
          f"Angst-Woerter in {len(mit_angst)}")
    if mit_angst:
        print("\nAngst-Woerter — diese Stellen lesen:")
        for s in mit_angst:
            treffer = ", ".join(sorted({m.group(0).lower() for m in ANGST.finditer(s)}))
            print(f"  [{treffer}] {s[:110]}")
    return quote, len(mit_angst)

if __name__ == "__main__":
    for pfad in sys.argv[1:]:
        pruefe(pfad)
