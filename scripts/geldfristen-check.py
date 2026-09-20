#!/usr/bin/env python3
"""Wie lange Geld unterwegs ist, steht an EINER Stelle - und stimmt mit den AGB.

ANLASS (20.09.2026): Beim Durchzaehlen aller 76 Zeitzusagen im sichtbaren Text
standen VIER verschiedene Angaben zur selben Geldfrage:

  app/auftrag-abschliessen.tsx  „wird der Betrag sofort ausgezahlt"
  app/auftrag-abschliessen.tsx  „in der Regel innerhalb von 1-3 Werktagen"
  app/betrieb/onboarding-stripe „2 Werktage nach Auftragsabschluss"
  app/agb.tsx §6(3)             „innerhalb von 2 Werktagen nach Freigabe"

Die ersten beiden standen auf DEMSELBEN Bildschirm. Und beim Beheben habe ich
im ersten Entwurf „1 bis 3" gewaehlt -- also dem Anbieter eine laengere Frist
genannt, als die AGB ihm zusichern. Erst der Blick in die AGB hat das gefangen.

Der Pruefer haelt zwei Dinge fest:
  (A) Die Zahl in lib/geldFristen.ts stimmt mit der AGB-Zusage ueberein.
  (B) Kein Bildschirm nennt eine eigene Werktage-Zahl fuer Auszahlung oder
      Erstattung, sondern holt sie aus dem Modul.

GRENZE, ausdruecklich: andere Fristen (Reklamation, Widerruf, Abnahme) haben
ihre eigenen Konstanten und werden hier NICHT geprueft. Dieser Pruefer kennt
genau den Geldweg.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
MODUL = WURZEL / 'lib' / 'geldFristen.ts'
AGB = WURZEL / 'app' / 'agb.tsx'

# Bildschirme, die ueber den Geldweg sprechen. Bewusst benannt statt „alle":
# ein Pruefer, der ueber jede Datei laeuft, findet Reklamations- und
# Widerrufsfristen und meldet sie als Befund. Fehlalarme schalten Pruefer ab.
GELDWEG = [
    'app/auftrag-abschliessen.tsx',
    'app/betrieb/onboarding-stripe.tsx',
    'app/stornierung.tsx',
    'app/garantie.tsx',
    'app/zahlung.tsx',
]

WERKTAGE = re.compile(r'(\d+)\s*(?:bis|[-–])?\s*(\d+)?\s*Werktag')


def main() -> int:
    befunde = []
    modul = MODUL.read_text(encoding='utf-8')
    agb = AGB.read_text(encoding='utf-8')

    # (A) Die Zusage aus den AGB.
    m = re.search(r'Auszahlung an den Anbieter erfolgt.{0,400}?innerhalb von (\d+) Werktagen', agb, re.S)
    if not m:
        befunde.append('In app/agb.tsx steht keine Auszahlungsfrist mehr, die dieser '
                       'Pruefer erkennt. Entweder umformuliert oder entfallen -- '
                       'in beiden Faellen gehoert lib/geldFristen.ts nachgezogen.')
    else:
        agb_tage = int(m.group(1))
        mm = re.search(r'export const AUSZAHLUNG_WERKTAGE = (\d+)', modul)
        if not mm:
            befunde.append('lib/geldFristen.ts nennt keine einzelne AUSZAHLUNG_WERKTAGE mehr.')
        elif int(mm.group(1)) != agb_tage:
            befunde.append(
                f'Die AGB sagen dem Anbieter {agb_tage} Werktage zu, lib/geldFristen.ts '
                f'nennt {mm.group(1)}. Die Oberflaeche darf keine laengere Frist '
                'nennen als die Zusage, die im Vertrag steht.')

    # (B) Keine eigene Zahl auf den Geldweg-Bildschirmen.
    for rel in GELDWEG:
        pfad = WURZEL / rel
        if not pfad.exists():
            befunde.append(f'{rel} gibt es nicht mehr -- diese Liste ist von Hand '
                           'gepflegt und gehoert dann nachgezogen.')
            continue
        for nr, zeile in enumerate(pfad.read_text(encoding='utf-8').split('\n'), 1):
            nackt = zeile.strip()
            if nackt.startswith(('//', '*', '/*')):
                continue
            # Aus dem Modul geholt? Dann ist alles richtig.
            if 'auszahlungsdauer()' in zeile or 'erstattungsdauer()' in zeile:
                continue
            if WERKTAGE.search(zeile):
                befunde.append(f'{rel}:{nr} nennt eine eigene Werktage-Zahl: '
                               f'„{nackt[:80]}". Sie gehoert aus lib/geldFristen.ts.')

    for b in befunde:
        print(f'BEFUND: {b}')
    if befunde:
        print(f'\n{len(befunde)} Befund(e) bei den Geldfristen.')
        return 1
    print('Geldfristen: eine Zahl, und sie stimmt mit den AGB ueberein.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
