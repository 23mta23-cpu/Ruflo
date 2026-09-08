#!/usr/bin/env python3
"""Kein Gedankenstrich in Texten, die ein Nutzer liest.

ANLASS (Founder, 08.09.2026, mit fuenf Bildschirmfotos der Startseite):
"Bindestriche? „-„ ? Wor hatten doch was dazu gesagt?!"

Gesagt hatte er es einen Tag vorher. Ich hatte die Anweisung auf meine
eigenen Antworten angewendet und die Texte der App unangetastet gelassen:
309 Gedankenstriche in sichtbarem Text, 25 davon allein auf der Startseite,
die er fotografiert hat. Genau die Fehlerklasse, die dieses Projekt schon
kennt: eine Zusage, die nur dort gilt, wo sie leicht einzuhalten ist.

Zwei Gruende, warum das mehr ist als Geschmack:

  1. Der lange Gedankenstrich ist ein Erkennungszeichen maschinell
     geschriebener Texte. Auf Seiten, die Vertrauen aufbauen sollen, ist
     das der falsche Beiklang.
  2. Im Deutschen ist der Gedankenstrich ohnehin der Halbgeviertstrich
     „–", nicht der englische Geviertstrich „—". Der Code benutzte
     durchgaengig den englischen.

Ersetzt wird er durch das, was der Satz eigentlich meint: Komma bei einem
Nachtrag, Doppelpunkt bei einer Aufzaehlung, Punkt bei zwei Aussagen, und
das Trennzeichen „·" in Beschriftungen, wo zwei Angaben nebeneinander
stehen ("Frei · fuer Buchungen verfuegbar").

GEPRUEFT WIRD, was ein Nutzer liest: Beschriftungen, Meldungen, Rechts-
und Hilfetexte, Push-Nachrichten und E-Mail-Vorlagen.

NICHT GEPRUEFT:
  - Quelltext-Kommentare. Die liest kein Nutzer, und ein Pruefer, der
    Kommentare anmahnt, wird beim ersten Lauf abgeschaltet.
  - `console.*` in Edge Functions: Betriebsprotokolle fuer uns, nicht
    fuer den Nutzer.

ZWEITE GRENZE (am 08.09.2026 am eigenen Code gemessen): Eine Zeichenkette
INNERHALB eines ${...}-Ausdrucks bricht die Extraktion auf. Bei

    `Grundlage: ${(a - b).toFixed(2).replace('.', ',')} ohne Material`

schneidet die Zeichenketten-Regel am inneren '.' ab, der ${...}-Rest bleibt
unvollstaendig stehen, und die Rechnung `a - b` sieht aus wie ein
Gedankenstrich. Das ist ein Fehlalarm. Wer ihn trifft: den Ausdruck in eine
Variable ueber der Zeile ziehen. Das liest sich ohnehin besser, und der
Pruefer bleibt einfach.

GRENZE, ehrlich benannt: Der Textauszug (scripts/sichtbarer_text.py)
unterscheidet Zeichenketten sauber vom Code, den Resttext zwischen den
JSX-Marken aber nicht. Deshalb sucht dieser Pruefer den blanken
Bindestrich („ - ") NUR in Zeichenketten und dort erst, nachdem die
${...}-Ausdruecke entfernt sind — sonst meldet jede Rechnung wie
`${30 - laenge}` einen Treffer. Gemessen am 08.09.2026: mit dieser
Einschraenkung 1 echter Fund (lib/offers.ts) und 0 Fehlalarme; ohne sie
3 Fehlalarme auf 1 Fund.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sichtbarer_text import ohne_console, zeichenketten_und_resttext, sql_zeichenketten

MUSTER = [
    'app/**/*.tsx', 'app/**/*.ts',
    'components/**/*.tsx', 'components/**/*.ts',
    'constants/*.ts', 'lib/*.ts', 'data/*.ts',
    'supabase/functions/**/*.ts',
    # Migrationen schreiben Text in die Datenbank, den Nutzer lesen:
    # Chat-System-Nachrichten und der Hinweis nach § 640 Abs. 2 BGB. Genau
    # dort ist mir am 08.09.2026 ein Gedankenstrich durchgerutscht.
    'supabase/migrations/*.sql',
]

# Der Geviertstrich hat in deutschem Fliesstext keine Aufgabe: weder als
# Gedankenstrich (das ist „–") noch als Trennstrich. Jedes Vorkommen ist
# ein Befund, egal ob mit oder ohne Leerzeichen.
GEVIERT = '—'

# Der Halbgeviertstrich ist RICHTIG als Bis-Strich ohne Leerzeichen
# ("3–5 Werktage"). Als Gedankenstrich, also mit Leerzeichen, faellt er
# unter dieselbe Regel wie der lange.
HALBGEVIERT_ALS_GEDANKENSTRICH = re.compile(r'\s–\s')

# Der blanke Bindestrich mit Leerzeichen ist dieselbe Stelle in Tastatur-
# Schreibweise. Nur in Zeichenketten pruefen (siehe GRENZE oben).
BINDESTRICH_ALS_GEDANKENSTRICH = re.compile(r'\s-\s')

# Ausdruecke in Zeichenketten sind Code, kein Text.
AUSDRUCK = re.compile(r'\$\{[^{}]*\}')

# Ausnahmen gehoeren MIT GRUND hierher, sonst weicht sie irgendwann jemand
# auf. Bisher gibt es keine: gesetzlich vorgeschriebene Wortlaute
# (Muster-Widerrufsformular, Anlage 2 zu Art. 246a EGBGB) enthalten
# keinen Gedankenstrich, sonst stuenden sie hier.
AUSNAHMEN: dict[str, str] = {
    'supabase/migrations/0530_accept_offer_system_message.sql': (
        'Historische Migration. Ihr Wortlaut („Angebot angenommen — Auftrag '
        'ist beauftragt.") ist seit 0830 durch eine Fassung ohne '
        'Gedankenstrich ersetzt. Angewandte Migrationen werden nicht '
        'nachtraeglich umgeschrieben, sonst weicht die Datei von dem ab, was '
        'in der Produktion gelaufen ist.'),
    'supabase/migrations/0770_abnahme_frist.sql': (
        'Historische Migration. Der § 640-Hinweis ist seit 0840 in der '
        'Fassung 640-2-v2 ohne Gedankenstrich; v1 bleibt im Bestand, weil '
        'gespeicherte Nachweise ihm zugeordnet sind.'),
}


def dateien():
    gesehen = set()
    for muster in MUSTER:
        for p in sorted(WURZEL.glob(muster)):
            if p in gesehen or not p.is_file():
                continue
            gesehen.add(p)
            yield p


def pruefe(pfad: Path):
    quelle = pfad.read_text(encoding='utf-8')
    if pfad.suffix == '.sql':
        # In SQL gibt es keinen JSX-Resttext, nur Zeichenketten.
        ketten, rest = list(sql_zeichenketten(quelle)), []
    else:
        if 'supabase/functions' in pfad.as_posix():
            quelle = ohne_console(quelle)
        ketten, rest = zeichenketten_und_resttext(quelle)

    # Ein Befund pro Zeile: dieselbe Stelle taucht sonst zweimal auf, einmal
    # aus dem Zeichenketten-Zweig und einmal aus dem Resttext (Lehre aus
    # anrede-check.py). Ein Pruefer, der doppelt meldet, wirkt ungenau.
    befunde: dict[int, str] = {}
    for nr, kette in ketten:
        # Leerstring, NICHT Leerzeichen: `}-${` wuerde sonst zu ` - `
        # und der Pruefer meldete seine eigene Ersetzung (gemessen:
        # 8 Fehlalarme in der ersten Fassung).
        sauber = AUSDRUCK.sub('', kette)
        if GEVIERT in sauber:
            befunde.setdefault(nr, f'Geviertstrich: {kette.strip()[:100]}')
        elif HALBGEVIERT_ALS_GEDANKENSTRICH.search(sauber):
            befunde.setdefault(nr, f'Halbgeviertstrich als Gedankenstrich: {kette.strip()[:100]}')
        elif BINDESTRICH_ALS_GEDANKENSTRICH.search(sauber):
            befunde.setdefault(nr, f'Bindestrich als Gedankenstrich: {kette.strip()[:100]}')
    for nr, zeile in rest:
        if GEVIERT in zeile:
            befunde.setdefault(nr, f'Geviertstrich: {zeile.strip()[:100]}')
        elif HALBGEVIERT_ALS_GEDANKENSTRICH.search(zeile):
            befunde.setdefault(nr, f'Halbgeviertstrich als Gedankenstrich: {zeile.strip()[:100]}')
    return sorted(befunde.items())


def main() -> int:
    alle = list(dateien())
    if len(alle) < 60:
        print(f'ABBRUCH: nur {len(alle)} Dateien gefunden (erwartet >= 60) — falscher Pfad?')
        return 1

    fehler = []
    for pfad in alle:
        rel = pfad.relative_to(WURZEL).as_posix()
        if rel in AUSNAHMEN:
            continue
        for nr, befund in pruefe(pfad):
            fehler.append(f'{rel}:{nr}: {befund}')

    for z in fehler:
        print(f'  FEHLER: {z}')
    if fehler:
        print()
        print(f'{len(fehler)} Gedankenstrich(e) in sichtbarem Text.')
        print('Ersetzen durch das, was der Satz meint: Komma beim Nachtrag,')
        print('Doppelpunkt bei einer Aufzaehlung, Punkt bei zwei Aussagen,')
        print('„·" als Trennzeichen in Beschriftungen.')
        return 1
    print(f'Gedankenstriche: {len(alle)} Dateien geprueft, keine Beanstandung.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
