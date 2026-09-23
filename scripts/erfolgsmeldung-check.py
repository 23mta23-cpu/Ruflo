#!/usr/bin/env python3
"""Keine Erfolgsmeldung nach einem ungeprueften Schreibvorgang.

ANLASS (23.09.2026): Der Knopf „Zurueckziehen" auf dem Betriebs-Dashboard
setzte ein `update ... where status='pending'` ab, LAS DAS ERGEBNIS NICHT,
entfernte die Zeile aus der Liste und meldete „Angebot zurueckgezogen".
PostgREST meldet keinen Fehler, wenn die Bedingung auf null Zeilen passt --
und genau dann hat der Kunde das Angebot in der Zwischenzeit angenommen. Der
Betrieb liest „zurueckgezogen" und ist in Wahrheit gebunden.

KLASSE GEMESSEN, bevor dieser Pruefer entstand (Regel aus CLAUDE.md: die
Messung entscheidet, nicht das Bauchgefuehl):

    Erfolgsmeldungen in app/ components/ lib/            28
    davon nach einem ungeprueften Schreibvorgang          1
    davon Fehlalarme                                      0

Zum Vergleich die Klasse, die aus demselben Grund KEINEN Pruefer bekommen
hat: „catch-Block ohne Meldung an den Nutzer" -- 63 Bloecke, 24 stumm,
davon 22 mit begruendetem Kommentar. Ein Pruefer dafuer haette 22 Fehlalarme
erzeugt und waere abgeschaltet worden.

WAS DIESER PRUEFER NICHT SIEHT:
  - Ob die Fehlerbehandlung sinnvoll ist. Er sieht nur, DASS das Ergebnis
    angefasst wird.
  - Schreibvorgaenge in Edge Functions. Dort meldet niemand Erfolg an einen
    Bildschirm; die Antwort geht durch den Client.
  - Erfolgsmeldungen, die weiter als FENSTER Zeilen hinter dem Schreiben
    stehen. Sie sind dann in der Regel in einem eigenen Zweig.
"""
import pathlib
import re
import sys

FENSTER = 12
# Gemessen am 23.09.2026: 28 Erfolgsmeldungen. Die Untergrenze faengt einen
# kaputten Auszug ab -- ohne sie waere „0 Befunde" mit einer leeren Auswahl
# vereinbar (Lehre vom 16.09.2026).
MINDESTENS = 24

SCHREIBT = re.compile(r"\.(insert|update|upsert|delete|rpc)\s*\(")
ERFOLG = re.compile(
    r"toast\.(success|info)\s*\(|router\.(replace|push)\s*\(\s*['\"][^'\"]*(erfolg|fertig|danke|success)"
)
# Irgendein Zugriff auf das Ergebnis des Schreibvorgangs.
GEPRUEFT = re.compile(r"error|fehler|throwOnError|throw|\.count\b|rowCount", re.IGNORECASE)


def dateien():
    for wurzel, muster in (("app", "*.tsx"), ("components", "*.tsx"), ("lib", "*.ts")):
        yield from sorted(pathlib.Path(wurzel).rglob(muster))


def main() -> int:
    erfolgsstellen = 0
    befunde = []
    for pfad in dateien():
        zeilen = pfad.read_text(encoding="utf-8").split("\n")
        for i, zeile in enumerate(zeilen):
            if not ERFOLG.search(zeile):
                continue
            erfolgsstellen += 1
            davor = zeilen[max(0, i - FENSTER):i]
            schreibzeilen = [k for k, z in enumerate(davor) if SCHREIBT.search(z)]
            if not schreibzeilen:
                continue
            rumpf = "\n".join(davor[schreibzeilen[0]:]) + "\n" + zeile
            if not GEPRUEFT.search(rumpf):
                befunde.append((pfad, i + 1, zeile.strip()))

    for pfad, nr, zeile in befunde:
        print(f"FAIL {pfad}:{nr}  Erfolgsmeldung nach ungeprueftem Schreibvorgang")
        print(f"     {zeile[:100]}")

    if erfolgsstellen < MINDESTENS:
        print(
            f"FAIL nur {erfolgsstellen} Erfolgsmeldungen gefunden, erwartet mindestens "
            f"{MINDESTENS} -- der Auszug ist vermutlich kaputt, nicht das Produkt"
        )
        return 1

    print(f"PASS {erfolgsstellen} Erfolgsmeldungen geprueft")
    if befunde:
        return 1
    print("PASS keine Erfolgsmeldung nach einem ungeprueften Schreibvorgang")
    return 0


if __name__ == "__main__":
    sys.exit(main())
