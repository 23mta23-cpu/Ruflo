#!/usr/bin/env python3
"""Der Auftrags-Trichter: fragt jede Sache genau einmal, und mischt nicht.

ANLASS (Founder am Geraet, 20.09.2026), zwei Saetze, drei Befunde:

  „auf der homepage als auch wenn man etwas anfragen moechte sind jetzt
   willkuerliche Buttons fuer Handwerker gemischt mit der Nachbarschaftshilfe"
  „Wenn ich bei der Dringlichkeit was anwaehle kommt auf der darauffolgenden
   Seite wieder so eine abfrage das ist doppelt gemoppelt"

Beides war echt. Schritt 2 hatte eine Dringlichkeits-Auswahl, die ausserdem
NIRGENDS hinging (nicht in createJob, nicht in die Zusammenfassung) — Schritt 3
stellte dieselbe Frage noch einmal, und nur diese Antwort wurde gespeichert.
Und das Kachelraster in Schritt 1 war von Hand zusammengesetzt: zwei C2C-
Kategorien mit erfundenen Beschriftungen zwischen den Handwerksgewerken, dazu
eine Sammelkachel „Handwerker", deren Kennung in keinem `category_ids` eines
Betriebs steht — der Auftrag erreichte niemanden.

WAS DIESER PRUEFER NICHT KANN: er liest Quelltext. Ob das Raster auf einem
Geraet gut aussieht, sagt er nicht — dafuer sind die Browser-Reisen und
scripts/rand-ueberstand-check.cjs da.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
TRICHTER = WURZEL / 'app' / 'auftrag-aufgeben.tsx'
KATEGORIEN = WURZEL / 'data' / 'categories.ts'


def ohne_kommentare(text: str) -> str:
    """Kommentare raus, Zeilenstruktur behalten.

    Sonst schlaegt der Pruefer an der Erklaerung an, die NEBEN dem Befund
    steht — genau so passiert am 16.09. beim web-untaugliche-api-check.
    """
    text = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), text, flags=re.S)
    return '\n'.join(re.sub(r'//.*$', '', z) for z in text.split('\n'))


def kategorie_kennungen() -> set:
    return set(re.findall(r"\{\s*id:\s*'([a-z0-9-]+)'", KATEGORIEN.read_text(encoding='utf-8')))


def main() -> int:
    befunde = []
    roh = TRICHTER.read_text(encoding='utf-8')
    code = ohne_kommentare(roh)

    # (A) Der Zeitpunkt wird genau einmal erhoben.
    if re.search(r"styles\.fieldLabel[^\n]*>\s*Dringlichkeit", code):
        befunde.append('Schritt 2 fragt wieder nach der Dringlichkeit. '
                       'Schritt 3 fragt dasselbe („Wann soll der Auftrag stattfinden?") '
                       'und nur diese Antwort wird gespeichert.')
    zeitfragen = len(re.findall(r'Wann soll der Auftrag stattfinden\?', code))
    if zeitfragen != 1:
        befunde.append(f'Die Frage nach dem Zeitpunkt steht {zeitfragen} Mal im Trichter, erwartet: 1.')

    # (B) Kein erhobenes Feld ohne Empfaenger.
    if 'urgency' in code:
        befunde.append('`urgency` ist zurueck. Das Feld wurde erhoben und nie '
                       'uebermittelt — ein Eingang ohne Wirkung.')

    # (C) Jede Kachel-Kennung gibt es in der zentralen Konfiguration.
    bekannt = kategorie_kennungen()
    for kennung in re.findall(r"\{\s*id:\s*'([a-z0-9-]+)',\s*label:", code):
        if kennung not in bekannt:
            befunde.append(f'Kachel „{kennung}" gibt es in data/categories.ts nicht. '
                           'Ein Auftrag mit dieser Kennung erreicht keinen Betrieb: '
                           'notify-matching-providers filtert ueber category_ids.')

    # (D) Der Track haengt nicht allein am URL-Parameter.
    if 'nbAuftrag' not in code:
        befunde.append('`nbAuftrag` fehlt. Ohne die Ableitung aus der GEWAEHLTEN '
                       'Kategorie wird eine Nachbarschaftskategorie als '
                       'Handwerksauftrag angelegt.')
    else:
        if not re.search(r'const track = nbAuftrag \?', code):
            befunde.append('`track` wird nicht aus nbAuftrag gebildet.')
        if not re.search(r'isNachbarschaft=\{nbAuftrag\}', code):
            befunde.append('Die Zusammenfassung rechnet nicht mit nbAuftrag: '
                           'Preis und Gebuehrenhinweis waeren dann die falschen.')

    # (E) Schritt 1 trennt die beiden Maerkte sichtbar.
    #
    # ZUSICHERUNG IST DIE TRENNUNG, NICHT IHR MECHANISMUS. Bis zum 28.09.2026
    # stand hier nur die Gruppen-Ueberschrift. Dann kam der Founder-Befund
    # „bitte einmal auf Handwerk klicken koennen und einmal
    # Nachbarschaftshilfe, so ist das zu viel bis zum Scrollen", und Schritt 1
    # fragt seitdem ZUERST nach dem Bereich: die beiden Maerkte liegen auf
    # getrennten Bildschirmen statt untereinander. Das trennt staerker als
    # eine Ueberschrift -- der Pruefer wurde trotzdem rot, weil er am alten
    # Mechanismus hing.
    #
    # Deshalb jetzt: EINER der beiden Wege muss da sein. Der Befund, den
    # dieser Pruefer verhindern soll, ist unveraendert „beide Raster ohne
    # jede Trennung untereinander" -- und der wird weiterhin rot (gemessen,
    # siehe unten).
    ueberschriften = all(m in code for m in (
        "titel={zeigeNachbarschaft ? 'Handwerk'", 'titel="Nachbarschaftshilfe"'))
    # Die Bereichswahl erkennt man an der Weiche UND an beiden Karten --
    # eine einzelne Karte waere keine Wahl.
    bereichswahl = ('bereich === null ?' in code
                    and code.count('styles.bereichKarte') >= 2)
    if not (ueberschriften or bereichswahl):
        befunde.append('Schritt 1 trennt die beiden Maerkte nicht: weder '
                       'Gruppen-Ueberschriften noch eine vorgeschaltete '
                       'Bereichswahl. Ohne beides liegen Handwerk und '
                       'Nachbarschaftshilfe in einem unbeschrifteten Raster.')

    for b in befunde:
        print(f'BEFUND: {b}')
    if befunde:
        print(f'\n{len(befunde)} Befund(e) im Auftrags-Trichter.')
        return 1
    print('Auftrags-Trichter: keine Befunde.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
