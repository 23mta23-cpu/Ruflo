#!/usr/bin/env python3
"""Findet Navigationsziele, die auf keine existierende Route zeigen.

ANLASS (15.08.2026): Beim Umbau der Anbieter-Routen fiel auf, dass
`pstg-annual-report` Push-Nachrichten mit `screen: "/(provider)/steuer"`
verschickte -- diese Route hat es NIE gegeben. Wer die Meldung
"PStTG-Meldeschwelle erreicht" antippte, landete auf "Seite nicht gefunden".
Niemandem ist das aufgefallen, weil ein Deeplink nur dann auffaellt, wenn
jemand ihn im richtigen Moment antippt.

Das ist eine ganze Fehlerklasse: ein Knopf, der ins Leere fuehrt, ist fuer den
Nutzer nicht von einem Absturz zu unterscheiden -- und kein Typ-Check merkt es,
weil Routen Zeichenketten sind.

Geprueft werden router.push/replace/navigate, `pathname:`, `href=`,
`resetTo(router, …)` und die `screen:`-Ziele der Push-Nachrichten aus den Edge
Functions. Verglichen wird gegen den tatsaechlichen Dateibaum unter app/.

Ausfuehren:  python3 scripts/tote-links-check.py
Exit 0 = alle Ziele loesen auf, Exit 1 = mindestens ein totes Ziel.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent


def normalisiere(pfad: str) -> str:
    """Adressform, wie expo-router sie sieht.

    Routen-GRUPPEN in Klammern erzeugen kein Adress-Segment -- `(tabs)/x` und
    `x` sind dieselbe Adresse. Genau daraus entstand der Kollisions-Befund vom
    15.08.: zwei Dateien beanspruchten dieselbe sichtbare Adresse.
    """
    pfad = pfad.split('?')[0].split('#')[0]
    pfad = re.sub(r'/?\([^)]*\)', '', pfad)   # Gruppen entfernen
    pfad = re.sub(r'/index$', '', pfad)
    pfad = pfad.rstrip('/')
    return pfad or '/'


def routen() -> set[str]:
    out = {'/'}
    for f in (WURZEL / 'app').rglob('*.tsx'):
        if f.name.startswith('_') or f.name.startswith('+'):
            continue
        out.add(normalisiere('/' + str(f.relative_to(WURZEL / 'app')).removesuffix('.tsx')))
    return out


MUSTER = [
    re.compile(r"""router\.(?:push|replace|navigate)\(\s*['"`]([^'"`]+)['"`]"""),
    re.compile(r"""pathname:\s*['"`]([^'"`]+)['"`]"""),
    re.compile(r"""screen:\s*['"`]([^'"`]+)['"`]"""),
    re.compile(r"""resetTo\(\s*router\s*,\s*['"`]([^'"`]+)['"`]"""),
    re.compile(r"""href=\{?['"`](/[^'"`]+)['"`]"""),
]


def ziele():
    quellen = []
    for muster in ('app/**/*.tsx', 'lib/**/*.ts', 'components/**/*.tsx',
                   'supabase/functions/**/*.ts'):
        quellen += list(WURZEL.glob(muster))
    for f in sorted(set(quellen)):
        for nr, zeile in enumerate(f.read_text().split('\n'), 1):
            for m in MUSTER:
                for t in m.findall(zeile):
                    # Nur absolute App-Adressen. Externe URLs und relative
                    # Angaben gehen diesen Check nichts an.
                    if t.startswith('/') and not t.startswith('//'):
                        yield str(f.relative_to(WURZEL)), nr, t


def main() -> int:
    vorhanden = routen()
    alle = list(ziele())
    tot = sorted({(d, n, z) for d, n, z in alle if normalisiere(z) not in vorhanden})
    print(f'{len(vorhanden)} Routen im Dateibaum, {len(alle)} Navigationsziele geprueft, '
          f'{len(alle) - len(tot)} treffen.')
    if not tot:
        print('\nKein totes Ziel gefunden.')
        return 0
    print('\nTOTE ZIELE -- diese Knoepfe fuehren auf "Seite nicht gefunden":')
    for d, n, z in tot:
        print(f'  {d}:{n}  ->  {z}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
