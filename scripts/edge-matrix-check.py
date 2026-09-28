#!/usr/bin/env python3
"""Jede Edge Function steht in der Zugriffsmatrix, und die Matrix nennt keine
Umgebungsvariable, die es im Code nicht gibt.

ANLASS (28.09.2026): AGENTS.md verlangt seit Monaten, dass jede neue Edge
Function eine Zeile in `docs/security/access-control-matrix.md` bekommt
("Add a row … in the same PR"). Durchgesetzt hat das nichts. Gemessen:
**3 von 16 Funktionen hatten keine Zeile** -- darunter `pruefung`, der
Betreiber-Endpunkt, der Gewerbescheine, Steuer-IDs und Ausweisdaten sieht,
und `inhalts-meldung`, der Meldeweg nach Art. 16 DSA.

Und die Matrix selbst war an einer Stelle falsch: sie nannte zweimal
`WERKR_ADMIN_SECRET` (der alte Markenname), waehrend der Code
`Werkant_ADMIN_SECRET` liest. Wer der Doku folgt und dieses Secret setzt,
setzt eine Variable, die NIEMAND liest -- der Admin-Weg von
`pstg-annual-report` und `release-escrow` bleibt dann zu, ohne Fehlermeldung.
Genau die Sorte Fehler, die erst auffaellt, wenn man sie braucht.

DREI RICHTUNGEN (wie aufbewahrung-check.py und edge-schreibfehler-check.py):
  1. Jede Funktion im Baum hat eine Zeile in der Edge-Function-Tabelle.
  2. Jede Zeile der Tabelle zeigt auf eine Funktion, die es noch gibt
     (Verfallspruefung -- eine Zeile fuer eine geloeschte Funktion ist eine
     Zusicherung ueber etwas, das nicht mehr existiert).
  3. Jede Umgebungsvariable, die die Matrix nennt, kommt im Code vor.
     Nur diese Richtung faengt die Namensdrift.

GRENZE, die dazugehoert: geprueft wird, DASS eine Zeile da ist, nicht ob sie
stimmt. Ob „10/min per user" noch der Wahrheit entspricht, sieht dieser
Pruefer nicht -- dafuer muesste er die Rate-Limit-Aufrufe parsen, und eine
Zeile, die man erst nachrechnen muss, waere kein Beleg. Der erste Schritt ist,
dass es sie ueberhaupt gibt.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
FUNKTIONEN = WURZEL / 'supabase' / 'functions'
MATRIX = WURZEL / 'docs' / 'security' / 'access-control-matrix.md'
UEBERSCHRIFT = '## Edge Function matrix'

# Eintraege, die keine Edge Function sind, aber zu Recht in der Tabelle stehen.
KEINE_FUNKTION = {'verification-docs'}


def tabelle(text: str) -> str:
    zeilen = text.split('\n')
    try:
        start = next(i for i, z in enumerate(zeilen) if z.strip() == UEBERSCHRIFT)
    except StopIteration:
        return ''
    ende = next((i for i in range(start + 1, len(zeilen)) if zeilen[i].startswith('## ')),
                len(zeilen))
    return '\n'.join(zeilen[start:ende])


def main() -> int:
    if not MATRIX.exists():
        print('FAIL die Zugriffsmatrix fehlt')
        return 1
    text = MATRIX.read_text(encoding='utf-8')
    tab = tabelle(text)
    if not tab:
        print(f'FAIL der Abschnitt "{UEBERSCHRIFT}" fehlt -- der Auszug misst nichts')
        return 1

    gelistet = set(re.findall(r"^\|\s*`([a-z0-9-]+)`", tab, re.M))
    vorhanden = {d.name for d in FUNKTIONEN.iterdir()
                 if d.is_dir() and not d.name.startswith('_')}

    fehler = 0

    # Richtung 1
    ohne_zeile = sorted(vorhanden - gelistet)
    for f in ohne_zeile:
        print(f'FAIL {f} hat keine Zeile in der Zugriffsmatrix')
        fehler += 1

    # Richtung 2: Verfallspruefung
    verwaist = sorted(gelistet - vorhanden - KEINE_FUNKTION)
    for f in verwaist:
        print(f'FAIL die Matrix fuehrt {f}, diese Funktion gibt es nicht mehr')
        fehler += 1

    # Richtung 3: Namensdrift bei Umgebungsvariablen
    quelltext = '\n'.join(p.read_text(encoding='utf-8')
                          for p in FUNKTIONEN.rglob('*.ts'))
    # Nur Namen, die wie eine Umgebungsvariable aussehen und in Backticks stehen.
    genannt = set(re.findall(r"`([A-Za-z][A-Za-z0-9]*_[A-Z][A-Z0-9_]+)`", text))
    unbekannt = sorted(n for n in genannt if n not in quelltext)
    for n in unbekannt:
        print(f'FAIL die Matrix nennt {n}, im Code der Edge Functions kommt das nicht vor')
        fehler += 1

    if fehler:
        print(f'\n{len(ohne_zeile)} ohne Zeile, {len(verwaist)} verwaiste Zeile(n), '
              f'{len(unbekannt)} unbekannte Variable(n).')
        return 1

    print(f'PASS alle {len(vorhanden)} Edge Functions stehen in der Zugriffsmatrix.')
    print(f'PASS keine verwaiste Zeile ({len(gelistet)} Eintraege in der Tabelle).')
    print(f'PASS alle {len(genannt)} genannten Umgebungsvariablen kommen im Code vor.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
