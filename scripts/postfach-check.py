#!/usr/bin/env python3
"""Prüft, dass keine E-Mail-Adresse am zentralen Verzeichnis vorbei im Produkt steht.

ANLASS (16.08.2026): Der Founder sagte, es gebe noch KEIN einziges Postfach.
Die App verwies zu dem Zeitpunkt an 16 Stellen auf sechs verschiedene Adressen
(support@, kontakt@, datenschutz@, widerruf@, steuer@, verify@) — keine davon
empfing Post. Wer dem Impressum oder der Widerrufsbelehrung folgte, schrieb
ins Leere.

Drei dieser Adressen sind nicht optional:

    §5 Abs. 1 Nr. 2 DDG        Impressum: Angaben, die eine unmittelbare
                               Kommunikation ermöglichen
    Art. 13 DSGVO              Kontaktdaten des Verantwortlichen
    Art. 246a §1 Abs. 2 EGBGB  Adresse, an die der Widerruf gerichtet werden
                               kann
    Art. 11 P2B-VO             internes Beschwerdemanagement (sobald Anbieter
                               gewerblich sind)

Seitdem stehen alle Adressen in `constants/legal.ts` (Konstante `MAIL`), und
ein Schalter dort lenkt alle auf EIN Postfach, solange es nur eines gibt. Das
funktioniert aber nur, solange niemand wieder eine Adresse direkt in einen
Bildschirm schreibt — genau davor schützt dieser Prüfer.

Edge Functions sind ausgenommen: sie laufen in Deno und haben keinen Zugriff
auf `constants/`. Ihre Absenderadresse kommt ohnehin aus einer Umgebungs-
variablen (WAITLIST_FROM_EMAIL).

Ausführen:  python3 scripts/postfach-check.py
Exit 0 = alle Adressen zentral, Exit 1 = hartkodierte Adresse gefunden.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
VERZEICHNISSE = ['app', 'components', 'lib', 'contexts']
DATEIMUSTER = ['*.tsx', '*.ts']

ADRESSE = re.compile(r'[a-zA-Z0-9._%+-]+@werkant\.de')

# Die eine Datei, in der die Adressen stehen DÜRFEN.
QUELLE = 'constants/legal.ts'


def quelle_pruefen() -> list:
    """In constants/legal.ts selbst darf eine Adresse nur an EINER Stelle stehen.

    Grund (Mutationsprobe 16.08.2026): der Jest-Test, der die Impressums-Felder
    an `MAIL` binden soll, blieb GRUEN, als `email: MAIL.kontakt` wieder zu
    `email: 'kontakt@werkant.de'` wurde. Im Ein-Postfach-Betrieb ist der Wert
    naemlich derselbe — der Rueckfall auf ein Literal faellt zur Laufzeit gar
    nicht auf. Sichtbar ist er nur im Quelltext.

    Erlaubt ist die Adresse deshalb ausschliesslich in der Zeile, die
    EIN_POSTFACH setzt. Alles andere muss durch postfach() laufen, sonst
    erreicht der Schalter es nicht.
    """
    funde = []
    f = WURZEL / QUELLE
    for nr, zeile in enumerate(f.read_text().split('\n'), 1):
        blank = zeile.strip()
        if blank.startswith('//') or blank.startswith('*') or blank.startswith('/*'):
            continue
        if 'EIN_POSTFACH' in zeile:
            continue
        for treffer in ADRESSE.findall(zeile):
            funde.append((QUELLE, nr, treffer, blank[:70]))
    return funde


def main() -> int:
    funde = quelle_pruefen()
    for verzeichnis in VERZEICHNISSE:
        dateien = sorted(
            f for muster in DATEIMUSTER for f in (WURZEL / verzeichnis).rglob(muster)
        )
        for f in dateien:
            rel = str(f.relative_to(WURZEL))
            if rel == QUELLE:
                continue
            for nr, zeile in enumerate(f.read_text().split('\n'), 1):
                blank = zeile.strip()
                # Kommentare dürfen eine Adresse nennen, um einen Sachverhalt
                # zu erklären — sie erzeugen keinen Weg für den Nutzer.
                if blank.startswith('//') or blank.startswith('*'):
                    continue
                for treffer in ADRESSE.findall(zeile):
                    funde.append((rel, nr, treffer, blank[:70]))

    print(f'{len(funde)} hartkodierte Adresse(n) gefunden.')
    if not funde:
        print('\nAlle Postfaecher laufen ueber die Konstante MAIL,')
        print('und in legal.ts steht die Adresse nur an der EIN_POSTFACH-Stelle.')
        return 0
    print('\nHARTKODIERT — bitte MAIL bzw. postfach() verwenden:')
    for datei, nr, adr, text in funde:
        print(f'  {datei}:{nr}  {adr}\n      {text}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
