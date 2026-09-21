#!/usr/bin/env python3
"""Sagt die App, WELCHEN Stand sie zeigt?

ANLASS (21.09.2026, zweimal an einem Tag): Der Founder prueft am Geraet die
Live-Seite, also `main`. Auf dem Arbeitszweig lagen dabei ueber 40 nicht
gemergte Commits. Von vier gemeldeten Befunden war einer laengst behoben und
nur nicht ausgeliefert. Die Fusszeile trug „Werkant v1.0.0" als LITERAL --
eine Zahl, die sich seit dem ersten Tag nicht geaendert hat.

Geprueft wird die VERDRAHTUNG, nicht der Wert. Ein Wertvergleich kann eine
Bindung nicht beweisen, wenn beide Seiten denselben Text ergeben (16.08. und
16.09.2026, zweimal hineingelaufen). Herkunft ist eine Quelltext-Frage.

GRENZE: Dass die Variable im Browser wirklich ankommt, sieht dieser Pruefer
nicht -- das misst scripts/stand-zeile-check.cjs am gerenderten Bildschirm.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
befunde: list[str] = []
geprueft = 0


def pruefe(name: str, ok: bool, detail: str = '') -> None:
    global geprueft
    geprueft += 1
    if not ok:
        befunde.append(f'{name}{"  -- " + detail if detail else ""}')


def ohne_leerraum(s: str) -> str:
    """Zeilenumbrueche und Einrueckung sollen den Pruefer nicht anschlagen
    lassen -- sonst wird er beim ersten Umformatieren rot und abgeschaltet."""
    return re.sub(r'\s+', '', s)


# -- 1. Die Fusszeile haengt an der Fassung und an der Build-Kennung --------
einst = WURZEL / 'app' / 'einstellungen.tsx'
quelle = einst.read_text(encoding='utf-8')
knapp = ohne_leerraum(quelle)

pruefe('app/einstellungen.tsx ruft standZeile() auf',
       'standZeile(' in knapp)

# Ein nachgestelltes Komma gehoert zum Umbrechen dazu -- die erste Fassung
# dieses Pruefers wurde genau daran rot, obwohl sich nichts geaendert hatte.
# Ein Pruefer mit Fehlalarmen wird abgeschaltet und nie wieder an.
AUFRUF = re.compile(
    r'standZeile\(Constants\.expoConfig\?\.version,process\.env\.EXPO_PUBLIC_BUILD,?\)')
pruefe('standZeile() bekommt Fassung und Build-Kennung, beide aus der Quelle',
       bool(AUFRUF.search(knapp)),
       'erwartet: standZeile(Constants.expoConfig?.version, process.env.EXPO_PUBLIC_BUILD)')

# Eine fest eingetippte Fassung ist genau der Fehler, der hier behoben wurde.
# Kommentarzeilen sind ausgenommen: wer nach einem Muster sucht, darf es nicht
# danebenschreiben (16.09.2026, am eigenen Pruefer erlebt).
LITERAL = re.compile(r'Werkant\s+v?\d+\.\d+\.\d+')
for datei in sorted((WURZEL / 'app').rglob('*.tsx')):
    for nr, zeile in enumerate(datei.read_text(encoding='utf-8').splitlines(), 1):
        entkernt = zeile.strip()
        if entkernt.startswith(('//', '*', '/*', '{/*')):
            continue
        if LITERAL.search(zeile):
            befunde.append(
                f'{datei.relative_to(WURZEL)}:{nr} nennt eine fest eingetippte '
                f'Fassung: {entkernt[:70]}')
geprueft += 1

# -- 2. Der Deploy-Workflow setzt die Kennung ueberhaupt --------------------
#
# Ohne diesen Teil waere die Verdrahtung im Code vollstaendig und die
# ausgelieferte Seite traege trotzdem dauerhaft „Entwicklungsstand".
workflow = (WURZEL / '.github' / 'workflows' / 'static.yml').read_text(encoding='utf-8')
pruefe('Der Deploy-Workflow setzt EXPO_PUBLIC_BUILD',
       'EXPO_PUBLIC_BUILD:' in workflow)
pruefe('Die Kennung wird aus dem Commit hergeleitet, nicht eingetippt',
       'git log -1 --format=%h' in workflow,
       'erwartet einen Schritt, der Kuerzel und Datum aus git liest')

# Und sie muss im Schritt stehen, der WIRKLICH exportiert -- eine Variable in
# einem anderen Schritt erreicht den Export nicht.
export_block = re.search(
    r'- name: Build Expo web export.*?(?=\n      - name:|\Z)', workflow, re.S)
pruefe('EXPO_PUBLIC_BUILD steht im Export-Schritt',
       bool(export_block) and 'EXPO_PUBLIC_BUILD:' in export_block.group(0),
       'steht anderswo im Workflow, erreicht den Export aber nicht')

if befunde:
    print('Stand-Kennung: Befunde')
    for b in befunde:
        print(f'  {b}')
    print(f'\n{len(befunde)} Befund(e) bei {geprueft} Pruefungen.')
    sys.exit(1)

print(f'Stand-Kennung: {geprueft} Pruefungen ohne Befund. '
      'Die Fusszeile haengt an Fassung und Commit.')
