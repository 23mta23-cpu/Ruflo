#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Die HTML-Dateien, die neben der App ausgeliefert werden, pruefen.

ANLASS (16.09.2026). Der Founder fragte, welche Unterseiten im Baum nicht
mehr genutzt werden. Die Antwort war unangenehm: `werkr-prototype.html` war
NICHT ungenutzt, sondern wurde von `.github/workflows/static.yml` als `/demo`
oeffentlich ausgeliefert, und darin stand

    „Haftpflicht & Qualifikation beider Parteien verifiziert"
    ['Haftpflicht','Steuer-ID','Meisterbrief']

also genau die Zusage, die am 14.09.2026 aus der App entfernt wurde, weil
Werkant nie eine Police gesehen hat. Dazu 24 Mal die alte Marke „Werkr" und
76 Gedankenstriche. Gleichzeitig lief unter `/datenschutz.html` eine zweite,
drei Monate alte Datenschutzerklaerung mit der halben Laenge der Fassung in
der App.

Der Grund, warum das monatelang unbemerkt blieb, ist derselbe wie immer:
`versprechen-check.py`, `ton-check.py` und `gedankenstrich-check.py` lesen
`app/` und `components/`. Eine Datei im Wurzelverzeichnis sah keiner von
ihnen an, obwohl sie unter derselben Adresse ausgeliefert wurde.

WELCHE DATEIEN GEPRUEFT WERDEN, steht nicht in diesem Skript, sondern wird
aus `static.yml` GELESEN. Wer eine Seite archiviert, nimmt sie damit
automatisch aus der Pruefung; wer eine neue ausliefert, bekommt sie
automatisch hinein. Eine Liste, die man von Hand pflegen muss, laeuft aus.

GRENZEN, ehrlich benannt:
  * Der Textauszug ist einfach: `<script>` und `<style>` raus, Marken raus,
    Entitaeten aufgeloest. Er versteht kein JavaScript. Text, den erst ein
    Skript erzeugt, sieht er nur, soweit er als Zeichenkette im Quelltext
    steht (das reichte fuer alle drei Funde oben).
  * Er prueft Zusagen gegen eine feste Liste von Begriffen, nicht gegen den
    Sinn. Eine neue Zusage in neuen Worten faellt ihm nicht auf.
  * Fuer die App gelten weiter die eigenen Pruefer; dieser hier ersetzt sie
    nicht, er schliesst die Luecke daneben.
"""
import html as html_mod
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
WORKFLOW = WURZEL / '.github' / 'workflows' / 'static.yml'

# Pflichttexte, die es nur EINMAL geben darf. Der Wert ist die Fassung, die gilt.
RECHTSTEXTE = {
    'datenschutz': 'app/datenschutz.tsx',
    'impressum':   'app/impressum.tsx',
    'agb':         'app/agb.tsx',
    'widerruf':    'app/widerruf.tsx',
}

# Zusagen, die es im Code nicht gibt. Jede stand wirklich einmal da.
ZUSAGEN = [
    (re.compile(r'haftpflicht[^.!?]{0,60}(verifiziert|geprüft|nachgewiesen)'
                r'|(verifiziert|geprüft)[^.!?]{0,30}haftpflicht', re.I),
     'Haftpflicht als geprueft ausgegeben. Es gibt im Code kein Feld dafuer: '
     'keine Spalte, kein Upload, keine Pruefung.'),
    (re.compile(r'ausweis[^.!?]{0,40}(verifiziert|geprüft)'
                r'|(verifiziert|geprüft)[^.!?]{0,25}ausweis', re.I),
     'Ausweis als geprueft ausgegeben. Werkant erhebt bewusst keine '
     'Ausweiskopien (§ 20 PAuswG).'),
    (re.compile(r'geprüfte[nrs]?\s+(Handwerker|Profis|Betriebe|Anbieter)'
                r'|verifizierte[nrs]?\s+(Alltagshelfer|Helfer|Nachbarn)', re.I),
     'Pauschales „geprueft/verifiziert" ohne Gegenstand. Geprueft wird der '
     'Gewerbeschein, bei meisterpflichtigen Gewerken der Meisterbrief '
     '(lib/pruefung.ts). Nachbarschaftshelfer sind Privatpersonen ohne '
     'Gewerbeschein; bei ihnen prueft nur der Zahlungsdienstleister.'),
    (re.compile(r'\bWerkr\b', re.I),
     'Alte Marke. Seit dem Rebrand heisst das Produkt Werkant.'),
]

GEVIERT = '—'
HALBGEVIERT_MIT_LUECKE = re.compile(r'\s–\s')


def ausgelieferte_dateien():
    """Welche Dateien aus dem Wurzelverzeichnis landen in `dist/`?"""
    if not WORKFLOW.is_file():
        raise SystemExit('FEHLER: %s fehlt. Ohne den Workflow weiss dieser '
                         'Pruefer nicht, was ausgeliefert wird.' % WORKFLOW)
    text = WORKFLOW.read_text(encoding='utf-8')
    # `cp <datei> dist/...` und `cp <datei> dist/<ordner>/index.html`
    treffer = set()
    for m in re.finditer(r'^\s*cp\s+([^\s]+\.html)\s+dist/', text, re.M):
        treffer.add(m.group(1))
    for m in re.finditer(r'^\s*\[\s*-f\s+([^\s]+\.html)\s*\]\s*&&\s*cp\s', text, re.M):
        treffer.add(m.group(1))
    # `dist/index.html` ist der Expo-Export, kein Wurzel-Artefakt.
    return sorted(d for d in treffer if not d.startswith('dist/'))


def sichtbarer_text(roh: str) -> str:
    ohne = re.sub(r'<script\b.*?</script>', ' ', roh, flags=re.S | re.I)
    ohne = re.sub(r'<style\b.*?</style>', ' ', ohne, flags=re.S | re.I)
    ohne = re.sub(r'<!--.*?-->', ' ', ohne, flags=re.S)
    ohne = re.sub(r'<[^>]+>', ' ', ohne)
    return html_mod.unescape(ohne)


def ist_weiterleitung(roh: str) -> bool:
    """Eine Seite, die nur weiterleitet, traegt keinen eigenen Pflichttext."""
    hat_meta = re.search(r'http-equiv\s*=\s*["\']refresh["\']', roh, re.I)
    hat_js = re.search(r'location\.(replace|href)', roh, re.I)
    return bool(hat_meta or hat_js) and len(sichtbarer_text(roh).split()) < 120


def main() -> int:
    dateien = ausgelieferte_dateien()
    if not dateien:
        print('Keine Wurzel-HTML wird ausgeliefert. Nichts zu pruefen.')
        return 0

    befunde = []
    for name in dateien:
        p = WURZEL / name
        if not p.is_file():
            befunde.append((name, 'Wird in static.yml ausgeliefert, existiert aber nicht. '
                                  'Entweder den Schritt entfernen oder die Datei zuruecklegen.'))
            continue
        roh = p.read_text(encoding='utf-8')
        weiterleitung = ist_weiterleitung(roh)
        text = sichtbarer_text(roh)

        # 1) Zweiter Pflichttext neben der Fassung in der App.
        for stichwort, quelle in RECHTSTEXTE.items():
            if stichwort in p.stem.lower() and not weiterleitung:
                befunde.append((name,
                    'Zweite Fassung eines Pflichttextes. Verbindlich ist %s. Zwei Fassungen '
                    'gleichzeitig live heisst: im Streitfall gilt die, die der Betroffene '
                    'erreicht hat. Entweder weiterleiten oder nicht ausliefern.' % quelle))

        # 2) Zusagen, die der Code nicht traegt. Auch im Quelltext suchen:
        #    die Abzeichenliste des Prototyps stand in einem <script>.
        for muster, grund in ZUSAGEN:
            m = muster.search(text) or muster.search(roh)
            if m:
                befunde.append((name + ': „' + ' '.join(m.group(0).split())[:70] + '"', grund))

        # 3) Gedankenstriche, dieselbe Regel wie in der App.
        if GEVIERT in text:
            stellen = text.count(GEVIERT)
            befunde.append((name, 'Geviertstrich „—" %dx in sichtbarem Text. Im Deutschen hat '
                                  'er keine Aufgabe (scripts/gedankenstrich-check.py).' % stellen))
        n = len(HALBGEVIERT_MIT_LUECKE.findall(text))
        if n:
            befunde.append((name, 'Halbgeviert mit Leerzeichen %dx, also als Gedankenstrich. '
                                  'Ohne Leerzeichen als Bis-Strich („50–90 €") ist er richtig.' % n))

    if befunde:
        print('Ausgelieferte Seiten: %d Beanstandung(en) in %d Datei(en)\n'
              % (len(befunde), len(dateien)))
        for stelle, grund in befunde:
            print('  FEHLER: %s' % stelle)
            print('          %s\n' % grund)
        return 1

    print('Ausgelieferte Seiten: %s geprueft, keine Beanstandung.' % ', '.join(dateien))
    return 0


if __name__ == '__main__':
    sys.exit(main())
