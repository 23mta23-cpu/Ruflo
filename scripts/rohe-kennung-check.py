#!/usr/bin/env python3
"""Rutscht eine rohe Datenbank-Kennung ungeuebersetzt in die Oberflaeche?

ANLASS (Founder am Geraet, 07.09.2026): „was sind diese bindestriche schon auf
der homepage?" Auf der Startseite stand bei einem Heizungsbetrieb
`heizung-sanitaer` statt „Heizung & Sanitär" — die rohe Kennung aus
provider_profiles.trade_id, direkt in ein <Text> gereicht. Daneben, wo ein
Firmenname fehlte, ein nackter Gedankenstrich.

app/anbieter.tsx hat es die ganze Zeit richtig gemacht (categoryById(...)?.name).
Die Startseite nicht. Dieselbe Uebersetzung an drei Stellen, an einer vergessen —
und gesehen hat es niemand ausser dem Founder auf seinem Geraet.

Zwei Klassen, beide hier geprueft:

  1. `{...trade_id}` oder `{...tradeId}` direkt in JSX. Anzeigenamen kommen aus
     gewerkName() in data/categories.ts.
  2. `?? '—'` als Ersatzwert in JSX. Ein Gedankenstrich ist keine Auskunft. Wenn
     ein Wert fehlt, gehoert die Zeile weggelassen oder die Karte gar nicht erst
     angezeigt — sonst behauptet die Oberflaeche einen Datensatz, den sie nicht
     benennen kann.

GRENZE: geprueft wird JSX-Text (`{ausdruck}` zwischen Marken) und der
Ersatzwert-Strich. Nicht gefunden werden: Kennungen, die ueber eine
Zwischenvariable laufen (`const t = p.trade_id` und dann `{t}`), und
Ersatzwerte, die anders geschrieben sind als '—'. Der Pruefer faengt die
bekannte Form, er beweist nicht die Abwesenheit.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ORDNER = ['app', 'components']
ENDUNGEN = {'.tsx'}

# Nur JSX-KINDER: `>{ ... }<`. Ein Vergleich (`tradeId === t.id`), eine
# Zuweisung (`trade_id: tradeId`) oder ein Attribut (`style=`, `onPress=`)
# zeigt nichts an — die erste Fassung dieses Pruefers hat genau das gemeldet
# und damit sechs Fehlalarme erzeugt. Ein Pruefer mit Fehlalarmen wird
# abgeschaltet und nie wieder an.
ROHE_KENNUNG = re.compile(r'>\s*\{([^{}]*\b(?:trade_id|tradeId)\b[^{}]*)\}\s*<')
# Jede uebersetzende Funktion zaehlt, auch eine oertlich anders benannte
# (meine-anbieter.tsx hat `tradeName`).
UEBERSETZT = re.compile(r'gewerkName|categoryById|tradeName|gewerkeName')

# Der Gedankenstrich als Ersatzwert — aber nur bei IDENTITAETSfeldern.
#
# Nicht jeder Ersatzstrich ist falsch: auf einer Detailseite, deren Datensatz
# sicher existiert, ist ein Strich fuer eine fehlende Stadt vertretbar. Was
# NICHT vertretbar ist: ein Strich dort, wo der NAME steht. Eine Karte, die
# nicht sagen kann, WEN oder WAS sie zeigt, liest sich wie ein Fehler — und
# genau das hat der Founder auf der Startseite gesehen.
IDENT_FELDER = r'(?:business_name|full_name|display_name|company_name|businessName|\btitle\b|\bname\b)'
STRICH_ERSATZ = re.compile(IDENT_FELDER + r"[^\n]{0,40}\?\?\s*'[\u2014\u2013-]'")

def main() -> int:
    treffer: list[str] = []
    dateien = 0

    for ordner in ORDNER:
        wurzel = REPO / ordner
        if not wurzel.exists():
            continue
        for pfad in sorted(wurzel.rglob('*')):
            if pfad.suffix not in ENDUNGEN or not pfad.is_file():
                continue
            dateien += 1
            rel = pfad.relative_to(REPO)
            for nr, zeile in enumerate(pfad.read_text(encoding='utf-8').splitlines(), 1):
                nackt = zeile.strip()
                if nackt.startswith(('//', '*', '/*')):
                    continue

                for m in ROHE_KENNUNG.finditer(zeile):
                    if UEBERSETZT.search(m.group(1)):
                        continue
                    treffer.append(
                        f"{rel}:{nr}: rohe Kennung in der Oberflaeche — {nackt[:88]}\n"
                        f"      -> gewerkName(...) aus data/categories.ts benutzen")

                if STRICH_ERSATZ.search(zeile):
                    treffer.append(
                        f"{rel}:{nr}: Gedankenstrich statt eines NAMENS — {nackt[:88]}\n"
                        f"      -> Zeile weglassen oder die Karte gar nicht zeigen. Eine Karte,\n"
                        f"         die nicht sagen kann, wen sie zeigt, liest sich wie ein Fehler.")

    # Eine leere Suche waere still gruen — dieselbe Klasse wie ein leerer Glob.
    if dateien < 30:
        print(f"ABBRUCH: nur {dateien} Bildschirme durchsucht (erwartet >= 30) — falscher Pfad?")
        return 1

    if treffer:
        print("Rohe Kennungen oder Ersatzstriche in der Oberflaeche:")
        for t in treffer:
            print(f"  {t}")
        return 1

    print(f"Keine rohe Kennung und kein Ersatzstrich in der Oberflaeche ({dateien} Dateien).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
