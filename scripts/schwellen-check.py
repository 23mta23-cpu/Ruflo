#!/usr/bin/env python3
"""Die PStTG-Schwellen stehen an mehreren Stellen — und muessen uebereinstimmen.

ANLASS (13.09.2026, Selbst-Check): § 2 Abs. 1 Nr. 1 PStTG legt die Meldeschwelle
fest (30 Vorgaenge ODER 2000 Euro im Kalenderjahr). Diese Zahlen standen im
Projekt DREIMAL:

  * lib/pstTgThresholds.ts        (die Quelle)
  * lib/account.ts                (eigene Kopie — am 13.09. zusammengefuehrt)
  * supabase/functions/pstg-annual-report/index.ts  (eigene Kopie, bleibt)

Die dritte bleibt, weil Deno Edge Functions nicht aus lib/ importieren koennen.
Abgesichert war sie durch einen Kommentar „keep in sync". Ein Kommentar ist
keine Pruefung — und derselbe Kommentar nannte ausserdem release-escrow, das
die Zahlen gar nicht (mehr) enthaelt. Der Hinweis war also selbst veraltet,
waehrend er Verlaesslichkeit suggerierte.

WARUM DAS NICHT KOSMETIK IST: Laufen die Werte auseinander, warnt die App den
Anbieter bei einer anderen Schwelle, als die BZSt-Meldung tatsaechlich
verwendet. Zu frueh gemeldet ist eine Datenweitergabe ohne Rechtsgrundlage, zu
spaet gemeldet ein Verstoss gegen die Meldepflicht. Beides ist falsch, nur in
unterschiedliche Richtungen — und beides faellt ohne diesen Abgleich niemandem
auf, weil jede Seite fuer sich gruen ist.

GRENZE: Geprueft wird die Gleichheit der ZAHLEN, nicht ob sie dem geltenden
Recht entsprechen. Aendert sich das Gesetz, meldet dieses Skript nichts.
"""
import re
import sys
from pathlib import Path

QUELLE = "lib/pstTgThresholds.ts"

# Jede Kopie mit dem Muster, unter dem ihre Zahl dort steht.
KOPIEN = {
    "supabase/functions/pstg-annual-report/index.ts": {
        "vorgaenge": r"const PSTG_TX_THRESHOLD\s*=\s*(\d+)",
        "umsatz":    r"const PSTG_REV_THRESHOLD\s*=\s*(\d+)",
    },
}

QUELL_MUSTER = {
    "vorgaenge": r"export const PSTG_TX_THRESHOLD\s*=\s*(\d+)",
    "umsatz":    r"export const PSTG_REV_THRESHOLD_EUR\s*=\s*(\d+)",
}


def lies(pfad: Path, muster: dict) -> dict:
    quelle = pfad.read_text(encoding="utf-8")
    werte = {}
    for name, regex in muster.items():
        m = re.search(regex, quelle)
        if not m:
            return {name: None}
        werte[name] = int(m.group(1))
    return werte


def main() -> int:
    wurzel = Path(__file__).resolve().parent.parent

    quell_pfad = wurzel / QUELLE
    if not quell_pfad.is_file():
        print(f"ABBRUCH: {QUELLE} nicht gefunden — falscher Pfad?")
        return 1

    soll = lies(quell_pfad, QUELL_MUSTER)
    if any(v is None for v in soll.values()):
        print(f"ABBRUCH: Schwellen in {QUELLE} nicht lesbar. Wurde umbenannt? "
              "Dann gehoert dieses Skript angepasst, nicht geloescht.")
        return 1

    print(f"Quelle {QUELLE}: {soll['vorgaenge']} Vorgaenge / {soll['umsatz']} Euro\n")

    fehler = []
    for rel, muster in KOPIEN.items():
        pfad = wurzel / rel
        if not pfad.is_file():
            fehler.append(f"{rel} fehlt — Kopie verschwunden oder verschoben?")
            continue
        ist = lies(pfad, muster)
        for name in soll:
            if ist.get(name) is None:
                fehler.append(f"{rel}: Schwelle „{name}\" nicht gefunden")
            elif ist[name] != soll[name]:
                fehler.append(
                    f"{rel}: {name} ist {ist[name]}, die Quelle sagt {soll[name]}")
        if not any(rel in f for f in fehler):
            print(f"OK  {rel}")

    print()
    for z in fehler:
        print(f"  FEHLER: {z}")
    if fehler:
        print()
        print("Laufen die Werte auseinander, warnt die App bei einer anderen Schwelle,")
        print("als die BZSt-Meldung verwendet. Zu frueh gemeldet ist eine Weitergabe ohne")
        print("Rechtsgrundlage, zu spaet ein Verstoss gegen die Meldepflicht.")
        return 1

    print(f"Schwellen: {len(KOPIEN)} Kopie(n) stimmen mit {QUELLE} ueberein.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
