#!/usr/bin/env python3
"""
Ein Navigationsparameter, den der Zielbildschirm nie liest.

ANLASS (22.09.2026). `app/anbieter.tsx` hatte unter jedem Anbieterprofil den
Knopf „Unverbindliche Anfrage stellen" und uebergab

    router.push({ pathname: '/auftrag-aufgeben', params: { providerId: id } })

`app/auftrag-aufgeben.tsx` liest `providerId` NIRGENDS. Wirkung: wer sich ein
Profil ansieht, den Knopf drueckt und einen Auftrag aufgibt, schreibt eine
Ausschreibung an ALLE passenden Betriebe. Der Betrieb, den er gerade ausgesucht
hat, erfaehrt davon nur zufaellig. Dieselbe Klasse wie „ein Eingang ohne
Wirkung ist ein Knopf ohne onPress" (16.09.) und wie der optionale Parameter,
der die Strasse monatelang verschwinden liess (16.08.).

GEMESSEN vor dem Bauen: 55 Navigationen mit Parameter-Objekt in `app/` und
`components/`, davon genau EINE betroffen und NULL Fehlalarme. Deshalb gibt es
diesen Pruefer -- anders als bei der Klasse „unbeschriftetes Symbol", wo 9 von
11 Kandidaten Fehlalarme gewesen waeren und deshalb bewusst kein Pruefer
gebaut wurde (siehe CLAUDE.md, 22.09.).

GRENZEN, damit ihm niemand zu viel zutraut:
  * Er sieht nur `router.push/replace({ pathname, params })` mit einem
    Objektliteral. Ein dynamisch zusammengebautes params-Objekt sieht er nicht.
  * Er prueft, ob der NAME im Ziel vorkommt (ohne Kommentare) -- nicht, ob er
    dort auch etwas bewirkt. Ein gelesener und danach weggeworfener Parameter
    faellt hier nicht auf.
  * Ein Ziel, das er nicht aufloesen kann, ist ein FEHLER und kein
    uebersprungener Schritt. Ein Pruefer, der still auslaesst, prueft weniger,
    als sein Name sagt.
"""
import os
import re
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Gemessen am 22.09.2026: 55. Eine Untergrenze verhindert, dass eine leere
# Auswahl als „0 Befunde" durchgeht. Bewusst etwas unter dem Messwert, damit
# das Entfernen einer einzelnen Navigation nicht zum Fehlalarm wird.
MINDESTENS = 45

PFAD_MUSTER = re.compile(r"pathname:\s*'([^']+)'\s*,\s*params:\s*")


def ohne_kommentare(text: str) -> str:
    """Zeilen- und Blockkommentare entfernen, Zeilenstruktur erhalten.

    Mit LEERSTRING ersetzen, nie mit Leerzeichen -- am 08.09. entstanden aus
    einem Leerzeichen acht Fehlalarme. Zeilenumbrueche bleiben stehen, sonst
    zeigen Befunde auf die falsche Zeile.
    """
    def blockweg(m: re.Match) -> str:
        return '\n' * m.group(0).count('\n')
    text = re.sub(r'/\*.*?\*/', blockweg, text, flags=re.S)
    return re.sub(r'//[^\n]*', '', text)


def klammerblock(s: str, i: int):
    """`i` zeigt auf '{'. Gibt den Inhalt bis zur passenden '}' zurueck."""
    tiefe = 0
    j = i
    while j < len(s):
        if s[j] == '{':
            tiefe += 1
        elif s[j] == '}':
            tiefe -= 1
            if tiefe == 0:
                return s[i + 1:j]
        j += 1
    return None


def oberste_schluessel(inner: str):
    """Nur die Schluessel auf Ebene 0 des Objekts.

    Ein naives Regex ueber `\\w+:` greift auch in verschachtelte
    Stil-Objekte hinein und meldet `alignItems`, `flex`, `padding` --
    gemessen vier Fehlalarme in der ersten Fassung.
    """
    out, tiefe, i, token = [], 0, 0, ''
    while i < len(inner):
        c = inner[i]
        if c in '{[(':
            tiefe += 1
        elif c in '}])':
            tiefe -= 1
        elif c == ':' and tiefe == 0:
            k = token.strip().strip('\'"')
            if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):
                out.append(k)
            token = ''
            t2 = 0
            while i < len(inner):        # Wert ueberspringen
                c2 = inner[i]
                if c2 in '{[(':
                    t2 += 1
                elif c2 in '}])':
                    t2 -= 1
                elif c2 == ',' and t2 == 0:
                    break
                i += 1
            continue
        elif c == ',' and tiefe == 0:
            k = token.strip()
            if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):   # Kurzform { foo }
                out.append(k)
            token = ''
        else:
            token += c
        i += 1
    k = token.strip()
    if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):
        out.append(k)
    return out


def zieldatei(ziel: str):
    p = ziel.lstrip('/')
    for k in (f'app/{p}.tsx', f'app/{p}/index.tsx', f'app/(tabs)/{p}.tsx'):
        if os.path.exists(os.path.join(WURZEL, k)):
            return k
    return None


def main() -> int:
    dateien = []
    for basis in ('app', 'components'):
        for root, _, fs in os.walk(os.path.join(WURZEL, basis)):
            for f in sorted(fs):
                if f.endswith(('.tsx', '.ts')):
                    dateien.append(os.path.join(root, f))

    befunde, gesamt = [], 0
    for d in sorted(dateien):
        roh = open(d, encoding='utf-8').read()
        s = ohne_kommentare(roh)
        rel = os.path.relpath(d, WURZEL)
        for m in PFAD_MUSTER.finditer(s):
            i = s.find('{', m.end())
            if i < 0 or i > m.end() + 3:
                continue
            inner = klammerblock(s, i)
            if inner is None:
                continue
            gesamt += 1
            zeile = s[:m.start()].count('\n') + 1
            ziel = m.group(1)
            zd = zieldatei(ziel)
            if zd is None:
                befunde.append(f'{rel}:{zeile}: Ziel „{ziel}" nicht aufloesbar '
                               f'-- der Pruefer darf hier nicht still auslassen')
                continue
            inhalt = ohne_kommentare(
                open(os.path.join(WURZEL, zd), encoding='utf-8').read())
            for k in oberste_schluessel(inner):
                if not re.search(r'\b' + re.escape(k) + r'\b', inhalt):
                    befunde.append(
                        f'{rel}:{zeile}: „{k}" wird an {ziel} uebergeben, '
                        f'aber in {zd} nirgends gelesen')

    print(f'{gesamt} Navigationen mit Parameter-Objekt geprueft')
    if gesamt < MINDESTENS:
        print(f'FEHLER: nur {gesamt} gefunden, erwartet mindestens {MINDESTENS}. '
              f'Findet der Pruefer nichts mehr, prueft er auch nichts.')
        return 1
    if befunde:
        print(f'\n{len(befunde)} Befund(e):')
        for b in befunde:
            print(f'  {b}')
        print('\nEin uebergebener und nie gelesener Parameter ist ein Knopf, '
              'der etwas verspricht und nichts tut.')
        return 1
    print('OK -- jeder uebergebene Parameter kommt im Ziel vor.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
