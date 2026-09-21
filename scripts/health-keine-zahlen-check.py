#!/usr/bin/env python3
"""Der oeffentliche /health-Endpunkt gibt keine Geschaeftszahlen aus.

ANLASS (21.09.2026, eigener Fehler): `/health` hat `verify_jwt = false`
(supabase/config.toml), ist also OHNE Anmeldung erreichbar. In der Antwort
standen `pruef_offen`, `reklamationen_offen` und `meldungen_offen` als
ZAHLEN -- zwei davon habe ich in 30b8f50 selbst hinzugefuegt, direkt unter
meinem eigenen Kommentar „nur Booleans nach aussen, keine Zahlen".

Ein Wettbewerber konnte damit taeglich abfragen, wie viele Betriebe auf
Freigabe warten, also das Wachstum der Angebotsseite eines
Kaltstart-Marktplatzes mitlesen. Fuer den Zweck des Endpunkts (lebt der
Dienst, wartet etwas?) genuegt ein Boolean.

GEPRUEFT WIRD DAS SYMPTOM, nicht eine Namensliste: ein Zaehler wird mit
`= 0` angelegt, ein Kennzeichen mit `= false`. Jedes Feld der Antwort, das
in der Datei als `let <feld> = 0` steht, ist ein Zaehler und gehoert nicht
nach aussen.

GRENZE: geprueft wird die Antwort dieser einen Funktion. Ein Zaehler, der
ueber `...checks` oder eine Hilfsfunktion hineinkommt, faellt hier nicht auf.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
DATEI = WURZEL / "supabase" / "functions" / "health" / "index.ts"

# Ausdruecklich erlaubt, mit Grund. Wer etwas ergaenzt, traegt es hier ein,
# und die Entscheidung wird dadurch sichtbar.
ERLAUBT = {
    # Ein Datum aus dem Gesetz (31. Januar, § 13 PStTG), kein Betriebsgeheimnis.
    "pstg_tage_bis_frist",
}


def main() -> int:
    if not DATEI.is_file():
        print(f"ABBRUCH: {DATEI} nicht gefunden — falscher Pfad?")
        return 1
    text = DATEI.read_text(encoding="utf-8")

    # Es gibt mehrere JSON.stringify in der Datei (Fehlerantworten). Gesucht
    # ist die ERFOLGSantwort, erkennbar an `ok` und `...checks`.
    kandidaten = [m.group(1) for m in re.finditer(r"JSON\.stringify\(\{(.*?)\}\)", text, re.S)]
    treffer = [k for k in kandidaten if "...checks" in k]
    if len(treffer) != 1:
        print(f"ABBRUCH: {len(treffer)} Erfolgsantworten mit `...checks` gefunden, erwartet genau eine.")
        return 1
    rumpf = treffer[0]
    felder = set(re.findall(r"\b([a-z][a-z0-9_]*)\b(?!\s*:)", rumpf))
    felder |= set(re.findall(r"\b([a-z][a-z0-9_]*)\s*:", rumpf))
    if len(felder) < 5:
        print(f"ABBRUCH: nur {len(felder)} Antwortfelder erkannt — greift der Auszug noch?")
        return 1

    befunde = []
    for feld in sorted(felder):
        if feld in ERLAUBT:
            continue
        if re.search(rf"^\s*let\s+{re.escape(feld)}\s*=\s*0\s*;", text, re.M):
            befunde.append(feld)

    for f in befunde:
        print(f"FAIL  „{f}\" ist ein Zaehler und steht in der oeffentlichen Antwort.")
        print("      /health ist ohne Anmeldung erreichbar (verify_jwt = false).")
        print("      Ein Boolean sagt dasselbe, ohne die Geschaeftszahl zu verraten.")
    print(f"\n{len(felder)} Antwortfelder geprueft, {len(befunde)} Zaehler nach aussen.")
    return 1 if befunde else 0


if __name__ == "__main__":
    sys.exit(main())
