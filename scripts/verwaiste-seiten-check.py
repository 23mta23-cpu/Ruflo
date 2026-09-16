#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bildschirme, die es gibt, zu denen aber kein Weg fuehrt.

ANLASS (Founder, 16.09.2026): „such die gesamte repo durchlesen, die nicht
genutzten in ein Archiv verschieben."

Gemessen wurde daraufhin die Erreichbarkeit aller 53 Bildschirme. Ergebnis:
**genau einer** hat keinen Eingang, und das ist Absicht (`/pruefung`, nur fuer
Betreiber, per Adresse aufzurufen, fuer alle anderen 404). Es gibt also keine
toten Bildschirme; die Antwort auf die Founder-Frage lag woanders (bei den
ausgelieferten HTML-Dateien, siehe scripts/ausgelieferte-seiten-check.py).

Der Pruefer bleibt trotzdem, und zwar wegen der GEGENRICHTUNG: ein Bildschirm
ohne Eingang ist haeufiger ein fehlender Knopf als toter Code. Ein Bildschirm,
den niemand erreichen kann, ist dieselbe Klasse wie ein Knopf ohne `onPress`.

Als erreichbar gilt ein Bildschirm, wenn mindestens EINES zutrifft:
  * er haengt als **`Tabs.Screen`** in einem `_layout.tsx`, ist also ein
    sichtbarer Reiter,
  * irgendwo steht `router.push/replace/navigate('/pfad')`,
  * irgendwo steht `route: '/pfad'` oder `pathname: '/pfad'` (Menuelisten),
  * irgendwo steht `href="/pfad"` oder `<Redirect href="/pfad">`.

`Stack.Screen` zaehlt AUSDRUECKLICH NICHT. Das war der Fehler der ersten
Fassung: in `app/_layout.tsx` ist praktisch jeder Bildschirm als
`Stack.Screen` angemeldet, das ist eine Anmeldung der Route und kein Weg
dorthin. Mit dieser Regel blieben beide Mutationen („den einzigen Eingang zu
/garantie entfernt", „den Reiter kalender aus der Leiste genommen") GRUEN.
Ein Pruefer, der seinen eigenen Fall nicht sieht.

Verglichen wird ueber die ADRESSE, nicht ueber den Dateipfad: Gruppen in
Klammern erzeugen kein Adress-Segment, `app/(tabs)/auftraege.tsx` liegt also
unter `/auftraege`, `app/betrieb/auftraege.tsx` unter `/betrieb/auftraege`.

GRENZEN:
  * Zusammengesetzte Ziele (`router.push(`/chat?id=${x}`)`) werden am ersten
    `?` oder `${` abgeschnitten; der feste Anfang genuegt fuer die Zuordnung.
  * Ein Ziel, das erst zur Laufzeit aus einer Variablen entsteht
    (`router.push(ziel)`), sieht der Pruefer nicht. Er beweist also
    Erreichbarkeit, nicht deren Abwesenheit.
  * Er sagt nichts darueber, ob der Weg fuer den jeweiligen Nutzer SICHTBAR
    ist (Rolle, Anmeldung). Dafuer gibt es scripts/rollen-routen-check.cjs.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent

# Bildschirme ohne Eingang, die das mit Grund sind.
GEWOLLT_OHNE_EINGANG = {
    'pruefung': (
        'Betreiber-Postfach fuer die Verifizierung. Bewusst nirgends verlinkt: '
        'wer nicht in WERKANT_ADMIN_EMAILS steht, bekommt 404 statt 403 und '
        'soll gar nicht erfahren, dass es diesen Weg gibt '
        '(docs/betrieb/pruef-postfach.md).'),
}

# Gesucht wird JEDE Zeichenkette, die wie eine Adresse aussieht („/chat",
# „/betrieb/kalender"). Die erste Fassung kannte nur eine Handvoll Formen und
# uebersah dadurch drei echte Wege: einen Ternaer
# (`push(a ? '/x' : '/anbieter-warteliste')`, nur die erste Zeichenkette
# getroffen), ein Feld namens `screen` statt `route`
# (`{ screen: '/angebot', jobId }`) und `router.push('/reset-password')` in
# einem `_layout.tsx`, das der Durchlauf uebersprang.
ADRESS_KETTE = re.compile(r"""['"`](/[A-Za-z0-9_()\-/]*)""")

# Kommentarzeilen zaehlen nicht: ein Weg, der nur in einem Kommentar steht,
# ist keiner.
KOMMENTAR_BLOCK = re.compile(r'/\*.*?\*/', re.S)
KOMMENTAR_ZEILE = re.compile(r'^\s*(//|\*)')


def route_von(pfad: Path) -> str:
    rel = pfad.relative_to(WURZEL).as_posix()
    r = rel[len('app/'):-len('.tsx')]
    return r[:-len('/index')] if r.endswith('/index') else r


def adresse(route: str) -> str:
    """Die Adresse, unter der die Route erreichbar ist. Gruppen in Klammern
    erzeugen kein Segment: `(tabs)/auftraege` liegt unter `auftraege`."""
    teile = [t for t in route.split('/') if t and not (t.startswith('(') and t.endswith(')'))]
    return '/'.join(teile) or '<wurzel>'


def main() -> int:
    routen = {route_von(p): p for p in sorted(WURZEL.glob('app/**/*.tsx'))
              if p.name not in ('_layout.tsx', '+html.tsx')}

    erreichbar: dict[str, set[str]] = {}

    def merk(ziel: str, quelle: str):
        z = ziel.strip().strip('/')
        if z.endswith('/index'):
            z = z[:-len('/index')]
        z = adresse(z)
        if z:
            erreichbar.setdefault(z, set()).add(quelle)

    for lay in sorted(WURZEL.glob('app/**/_layout.tsx')):
        rel = lay.relative_to(WURZEL).as_posix()
        gruppe = rel[len('app/'):-len('/_layout.tsx')] if rel != 'app/_layout.tsx' else ''
        txt = lay.read_text(encoding='utf-8')
        # NUR Tabs.Screen. Stack.Screen ist Anmeldung, kein Weg (siehe Kopf).
        for m in re.finditer(r'<Tabs\.Screen\s+name\s*=\s*["\']([^"\']+)["\']', txt):
            merk((gruppe + '/' + m.group(1)) if gruppe else m.group(1), rel + ' (Reiter)')

    quellen = (list(WURZEL.glob('app/**/*.tsx')) + list(WURZEL.glob('components/**/*.tsx'))
               + list(WURZEL.glob('lib/*.ts')) + list(WURZEL.glob('contexts/*.tsx')))
    for p in quellen:
        rel = p.relative_to(WURZEL).as_posix()
        txt = KOMMENTAR_BLOCK.sub(' ', p.read_text(encoding='utf-8'))
        for zeile in txt.split('\n'):
            if KOMMENTAR_ZEILE.match(zeile):
                continue
            for m in ADRESS_KETTE.finditer(zeile):
                merk(m.group(1), rel)

    ohne, unnoetige_ausnahmen = [], []
    for r, p in sorted(routen.items()):
        rel = p.relative_to(WURZEL).as_posix()
        q = erreichbar.get(adresse(r), set()) - {rel}
        if q:
            if r in GEWOLLT_OHNE_EINGANG:
                unnoetige_ausnahmen.append((r, sorted(q)[:2]))
        elif r not in GEWOLLT_OHNE_EINGANG:
            ohne.append(r)

    for r, q in unnoetige_ausnahmen:
        print('HINWEIS: „%s" steht als gewollt ohne Eingang in diesem Skript, hat aber '
              'jetzt einen (%s). Ausnahme streichen.' % (r, ', '.join(q)))

    if ohne:
        print('Verwaiste Bildschirme: %d von %d\n' % (len(ohne), len(routen)))
        for r in ohne:
            print('  FEHLER: app/%s.tsx ist von keinem anderen Bildschirm aus erreichbar.' % r)
            print('          Entweder fehlt der Knopf, der hinfuehrt, oder der Bildschirm '
                  'gehoert nach archive/.\n')
        return 1

    print('Verwaiste Bildschirme: keine. %d Routen geprueft, %d davon mit Grund '
          'ohne Eingang (%s).' % (len(routen), len(GEWOLLT_OHNE_EINGANG),
                                  ', '.join(sorted(GEWOLLT_OHNE_EINGANG))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
