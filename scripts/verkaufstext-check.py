#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Was der Gruender am Telefon vorliest, muss stimmen.

ANLASS (18.09.2026). `docs/vertrieb/Anbieter-Akquise-Koeln.md` ist der
Leitfaden fuer die Koeln-Akquise: Telefonskript, Einwandbehandlung,
Checkliste. Beim Durchlesen standen dort drei Aussagen, die der eigene Code
widerlegt:

  0. Der Hausverwaltungs-Pitch verkaufte zweimal „verifizierte Alltagshelfer"
     und versprach, drei Testauftraege seien in einer festen Stundenzahl
     erledigt. Beides gefunden, NACHDEM dieser Pruefer schon lief -- der
     erste Entwurf uebersprang Blockzitate, und genau dort stehen die Saetze,
     die der Gruender vorliest.

  1. „Wie bekomme ich mein Geld?" -> „Direkt vom Kunden, wie heute auch ...
     Fuer spaeter planen wir eine optionale Treuhand-Abwicklung."
     Die Treuhand ist seit Monaten gebaut: `create-payment-intent`,
     `release-escrow`, `contracts.escrow_captured_at`. Der Betrieb haette am
     Telefon das Gegenteil dessen gehoert, was die App tut -- und zwar bei der
     Frage, die fuer einen Handwerker die wichtigste ueberhaupt ist.

  2. „Wer haftet?" -> „... inklusive Nachweis der Betriebshaftpflicht."
     Genau diese Zusage ist am 14.09.2026 aus dem Produkt geflogen, weil
     Werkant nie eine Police sieht. Im Verkaufstext stand sie weiter, und die
     Checkliste sammelte sie angeblich ein.

  3. Achtmal die alte Marke „WERKR" statt „Werkant".

WARUM EIN EIGENES SKRIPT. `scripts/versprechen-check.py` gibt es seit dem
13.09. genau gegen diese Fehlerklasse -- es liest aber `app/` und
`components/`, also TSX. Markdown unter `docs/vertrieb/` hat es nie gesehen.
Dieselbe Lehre wie am 16.09.: „Bei jedem Textpruefer zuerst fragen, WELCHE
Dateien ein Nutzer liest." Ein Verkaufsgespraech ist Text, den ein Mensch
hoert, und er bindet genauso wie ein Satz auf dem Bildschirm (§ 5 UWG gilt
fuer muendliche Werbung ebenso).

ABGELEITET, NICHT AUFGEZAEHLT: Regel 1 und 2 fragen den CODE. Kommt die
Haftpflicht eines Tages wirklich ins Onboarding, verstummt Regel 2 von selbst.
Eine Regel, die mitwaechst, statt einer, die jemand pflegen muss.

MUTATIONSPROBE 18.09.2026 (jede einzeln, jede zurueckgesetzt). Jede der fuenf
Regeln wird nachweislich rot:
    alte Marke kommt zurueck            -> Regel „WERKR"
    „verifizierte Alltagshelfer"        -> Regel Nachbarschaft
    feste Stundenzahl fuer Erledigung   -> Regel Zeitzusage
    Haftpflicht wieder als geprueft     -> Regel Haftpflicht
    Treuhand wieder als Zukunft         -> Regel Treuhand
Drei Gegenproben (harmlose Umformulierungen in beiden Dokumenten und im
Erklaerblock) bleiben gruen.

ZWEI FEHLER IM PRUEFER SELBST, beide gemessen und behoben:
  * Er uebersprang `>`-Zeilen. In `Hausverwaltungen-Pitch.md` IST das
    Blockzitat der Text, den der Gruender vorliest -- drei Fundstellen waeren
    durchgerutscht.
  * Die Verneinungs-Ausnahme arbeitete zeilenweise. In einer Markdown-Tabelle
    steht eine ganze Antwort in EINER Zeile, und ein „NICHT" zwei Saetze
    weiter liess die Mutation durch. Geprueft wird jetzt satzweise.

GRENZEN, ehrlich:
  * Geprueft werden drei bekannte Rueckfaelle, nicht die Wahrheit des ganzen
    Dokuments. Eine neue unwahre Behauptung faellt NICHT auf.
  * Blockzitate werden NICHT uebergangen, und das war eine Korrektur am
    selben Tag: der erste Entwurf uebersprang `>`-Zeilen, damit er nicht an
    der eigenen Erklaerung anschlaegt. In `Hausverwaltungen-Pitch.md` ist das
    Blockzitat aber genau der Text, den der Gruender vorliest -- drei
    Fundstellen der alten Marke waeren so durchgerutscht. Die richtige Antwort
    auf „wer nach einem Muster sucht, darf es nicht danebenschreiben" ist,
    das Muster nicht danebenzuschreiben, nicht den Pruefer blind zu machen.
    Die Erklaerung im Leitfaden ist deshalb so formuliert, dass sie das
    Wort und das Pruefwort nicht in derselben Zeile hat.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
ORDNER = WURZEL / 'docs' / 'vertrieb'

PRUEFWORT = re.compile(
    r'prüf|pruef|verifizier|nachweis|einsammel|checklist|erheb', re.I)
HAFTPFLICHT = re.compile(r'haftpflicht', re.I)
# Eine VERNEINUNG in derselben Zeile dreht die Aussage um: „Eine
# Betriebshaftpflicht pruefen wir ausdruecklich NICHT" ist genau der Satz, den
# dieser Pruefer erreichen will, und er darf ihn nicht anmahnen. Ohne das
# schlug er an der eigenen Korrektur an -- derselbe Fehler wie am 16.09. beim
# Alert-Pruefer, nur eine Ebene hoeher.
#
# GRENZE: „Wir pruefen nicht nur die Haftpflicht, sondern auch ..." wuerde
# faelschlich durchgehen. Gemessen kommt diese Wendung in keinem der beiden
# Dokumente vor; ein Pruefer mit Fehlalarmen waere hier der groessere Schaden.
VERNEINUNG = re.compile(r'\bnicht\b|\bkein\w*\b|\bohne\b|\bnie\b', re.I)

# Geprueft wird SATZWEISE, nicht zeilenweise. In einer Markdown-Tabelle steht
# eine ganze Antwort in EINER Zeile: die Mutation „Wir pruefen die
# Betriebshaftpflicht" blieb gruen, weil zwei Saetze weiter im selben
# Tabellenfeld ein „NICHT" stand. Gemessen, nicht vermutet.
SATZENDE = re.compile(r'(?<=[.!?])\s+')


def saetze(zeile: str):
    return [t for t in SATZENDE.split(zeile) if t.strip()]
# „planen wir", „fuer spaeter", „werden wir einfuehren" in einem Satz mit der
# Treuhand: das stellt Vorhandenes als Zukunft dar.
TREUHAND_ALS_ZUKUNFT = re.compile(
    r'treuhand[^.!?|]{0,120}(?:planen wir|ist geplant|fuer sp[äa]ter|für später|'
    r'werden wir einf[üu]hren|noch nicht)'
    r'|(?:planen wir|ist geplant|f[üu]r sp[äa]ter)[^.!?|]{0,120}treuhand', re.I)
ALTE_MARKE = re.compile(r'\bWERKR\b')

# Der Nachbarschafts-Zweig hat KEINE Verifizierung ausser der
# Identitaetspruefung durch den Zahlungsdienstleister. „Verifizierte
# Alltagshelfer" stand am 16.09.2026 ausdruecklich auf der Liste der Saetze,
# die nie wieder verkauft werden duerfen -- und stand danach noch zweimal in
# `Hausverwaltungen-Pitch.md`.
HELFER_ALS_GEPRUEFT = re.compile(
    r'(?:verifiziert\w*|gepr[üu]ft\w*)\s+(?:\w+\s+){0,2}'
    r'(?:alltagshelfer|helfer|nachbarschaftshelfer)'
    r'|(?:alltagshelfer|helfer|nachbarschaftshelfer)[^.!?|]{0,30}'
    r'(?:verifiziert|gepr[üu]ft)', re.I)

# Harte Zeitzusage ueber die Erledigung eines Auftrags. Wie schnell ein Betrieb
# antwortet, entscheidet der Betrieb; einen Mechanismus dafuer gibt es nicht.
# Dieselbe Regel wie in versprechen-check.py, nur fuer Verkaufstexte.
ZEITZUSAGE = re.compile(
    r'(?:in|binnen|innerhalb von)\s+\d+\s*(?:stunden|std|tagen|werktagen)'
    r'[^.!?|]{0,60}(?:erledigt|fertig|abgeschlossen|da|vor ort)'
    r'|(?:erledigt|fertig|abgeschlossen)[^.!?|]{0,40}'
    r'(?:in|binnen|innerhalb von)\s+\d+\s*(?:stunden|std|tagen|werktagen)', re.I)


BLOCK_KOMMENTAR = re.compile(r'/\*[\s\S]*?\*/')
ZEILEN_KOMMENTAR = re.compile(r'//[^\n]*')
SQL_KOMMENTAR = re.compile(r'--[^\n]*')


def ohne_kommentare(quelle: str, suffix: str) -> str:
    """Kommentare raus, und zwar RICHTIG.

    Der erste Entwurf prueste je Zeile, ob sie mit `//`, `*` oder `{/*`
    beginnt. Das faellt bei jedem mehrzeiligen Kommentar auseinander: die
    FORTSETZUNGSZEILE beginnt mit gewoehnlichem Text. Gemessen: drei Stellen
    im Produkt (`app/bewerbung-eingegangen.tsx`, `app/anbieter.tsx`,
    `app/anbieter-warteliste.tsx`) erklaeren in Kommentaren, warum die
    Haftpflicht-Zusage entfernt wurde -- und liessen den Pruefer glauben, es
    gebe ein Feld dafuer. Die Mutation „Haftpflicht wieder als geprueft" blieb
    deshalb gruen.
    """
    ohne = BLOCK_KOMMENTAR.sub('', quelle)
    return (SQL_KOMMENTAR if suffix == '.sql' else ZEILEN_KOMMENTAR).sub('', ohne)


def gibt_es_haftpflicht_feld() -> bool:
    """Erhebt das Produkt irgendwo eine Haftpflicht? Kommentare zaehlen nicht."""
    for ordner, endungen in [('app', ('*.tsx',)), ('lib', ('*.ts',)),
                             ('constants', ('*.ts',)),
                             ('supabase/migrations', ('*.sql',))]:
        basis = WURZEL / ordner
        if not basis.is_dir():
            continue
        for endung in endungen:
            for datei in basis.rglob(endung):
                quelle = ohne_kommentare(
                    datei.read_text(encoding='utf-8'), datei.suffix)
                if HAFTPFLICHT.search(quelle):
                    return True
    return False


def gibt_es_treuhand() -> bool:
    """Ist der Treuhandweg gebaut?"""
    return (WURZEL / 'supabase' / 'functions' / 'release-escrow').is_dir()


def main() -> int:
    if not ORDNER.is_dir():
        print(f'ABBRUCH: {ORDNER.relative_to(WURZEL)} gibt es nicht.')
        return 1

    dateien = sorted(ORDNER.rglob('*.md'))
    if not dateien:
        # Eine leere Auswahl waere still gruen -- dieselbe Klasse wie der
        # leere Glob in der DB-Harness.
        print('ABBRUCH: keine Verkaufstexte gefunden.')
        return 1

    haftpflicht_gibt_es = gibt_es_haftpflicht_feld()
    treuhand_gibt_es = gibt_es_treuhand()
    befunde = []

    for datei in dateien:
        rel = datei.relative_to(WURZEL).as_posix()
        for nr, zeile in enumerate(datei.read_text(encoding='utf-8').split('\n'), 1):
            if not haftpflicht_gibt_es:
                for satz in saetze(zeile):
                    if (HAFTPFLICHT.search(satz) and PRUEFWORT.search(satz)
                            and not VERNEINUNG.search(satz)):
                        befunde.append((
                            rel, nr,
                            'nennt die Betriebshaftpflicht als etwas, das '
                            'geprueft oder eingesammelt wird. Im Produkt gibt '
                            'es dafuer kein Feld (Stand 14.09.2026 '
                            'ausdruecklich entfernt).'))
                        break

            if treuhand_gibt_es and TREUHAND_ALS_ZUKUNFT.search(zeile):
                befunde.append((
                    rel, nr,
                    'stellt die Treuhand-Abwicklung als Zukunft dar. Sie ist '
                    'gebaut (supabase/functions/release-escrow).'))

            if ALTE_MARKE.search(zeile):
                befunde.append((
                    rel, nr,
                    'nennt die alte Marke WERKR. Sie heisst Werkant.'))

            if HELFER_ALS_GEPRUEFT.search(zeile):
                befunde.append((
                    rel, nr,
                    'verkauft Nachbarschaftshelfer als geprueft oder '
                    'verifiziert. Sie sind Privatpersonen ohne Gewerbeschein; '
                    'geprueft wird dort nur die Identitaet durch den '
                    'Zahlungsdienstleister (Stand 16.09.2026).'))

            if ZEITZUSAGE.search(zeile):
                befunde.append((
                    rel, nr,
                    'sagt eine feste Frist fuer die Erledigung zu. Wie schnell '
                    'ein Betrieb antwortet, entscheidet der Betrieb -- einen '
                    'Mechanismus dafuer gibt es nicht.'))

    if befunde:
        for rel, nr, text in befunde:
            print(f'FEHLER: {rel}:{nr} {text}')
        print()
        print('Verkaufstexte gehoeren gegen den Code gelesen. Was am Telefon')
        print('gesagt wird, bindet genauso wie ein Satz auf dem Bildschirm.')
        return 1

    print(f'Verkaufstexte: {len(dateien)} Datei(en) geprueft, keine Aussage '
          f'gegen den Code.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
