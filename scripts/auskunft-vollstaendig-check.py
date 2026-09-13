#!/usr/bin/env python3
"""Was RLS dem Nutzer zeigt, muss auch in seiner Auskunft stehen.

ANLASS (13.09.2026, Selbst-Check): Beim Anlegen von `notifications` (0860)
fiel auf, dass ACHT Tabellen mit einer select-own-Policy im Art.-15-Export
fehlten — darunter die eigenen Verstoesse, die eigenen DSA-Beschraenkungen und
die eigenen Einwilligungen. Der Nutzer durfte sie in der App lesen, bekam sie
aber nicht in seiner Auskunft.

Das ist keine Schutzmassnahme, sondern eine Inkonsistenz. Das Kriterium, das
sich daraus ergibt und das dieses Skript durchsetzt:

    Hat eine Tabelle eine select-Policy, die auf auth.uid() eingeschraenkt
    ist, dann gehoert sie in export-my-data — oder mit GRUND in die Rubrik
    `nicht_enthalten`, die der Export selbst ausgibt.

Der Grund gehoert in den Export und nicht in dieses Skript: Art. 15 Abs. 1
verlangt Transparenz darueber, WAS verarbeitet wird. Eine Kategorie
wegzulassen, ohne es dem Nutzer zu sagen, waere die schlechtere Variante
derselben Luecke.

GRENZE: Das Skript prueft die TABELLE, nicht die Spalten. Wird einer bereits
enthaltenen Tabelle spaeter eine Spalte hinzugefuegt und die ausdrueckliche
Spaltenliste nicht nachgezogen (wie bei `contracts` und `beschraenkungen`),
faellt das hier NICHT auf. Es prueft ausserdem nur, DASS die Tabelle vorkommt,
nicht ob sie richtig gefiltert ist.
"""
import re
import sys
from pathlib import Path

# Eine select-Policy gilt als "eigene Zeilen", wenn sie auth.uid() einschraenkt.
POLICY = re.compile(
    r"create policy[^;]*?on public\.(\w+)\s+for select(.*?);",
    re.S | re.I)


def tabellen_mit_eigenzugriff(migrationen: Path) -> dict:
    treffer = {}
    for pfad in sorted(migrationen.glob("*.sql")):
        quelle = pfad.read_text(encoding="utf-8")
        for m in POLICY.finditer(quelle):
            tabelle, rumpf = m.group(1), m.group(2)
            if "auth.uid()" in rumpf:
                treffer.setdefault(tabelle, pfad.name)
    return treffer


def main() -> int:
    wurzel = Path(__file__).resolve().parent.parent
    mig = wurzel / "supabase" / "migrations"
    exp_pfad = wurzel / "supabase" / "functions" / "export-my-data" / "index.ts"

    if not mig.is_dir() or not exp_pfad.is_file():
        print("ABBRUCH: Migrationen oder export-my-data nicht gefunden — falscher Pfad?")
        return 1

    eigen = tabellen_mit_eigenzugriff(mig)
    if len(eigen) < 8:
        print(f"ABBRUCH: nur {len(eigen)} Tabellen mit select-own gefunden (erwartet >= 8). "
              "Hat sich die Schreibweise der Policies geaendert? Dann gehoert dieses "
              "Skript angepasst, nicht geloescht.")
        return 1

    export = exp_pfad.read_text(encoding="utf-8")
    geholt = {m.group(1) for m in re.finditer(r'\.from\("(\w+)"\)', export)}

    # Die Rubrik, die der Export selbst ausgibt.
    block = re.search(r"nicht_enthalten:\s*\{(.*?)\n    \},", export, re.S)
    benannt = set(re.findall(r"^\s*(\w+):", block.group(1), re.M)) if block else set()

    fehlen = sorted(t for t in eigen if t not in geholt and t not in benannt)

    print(f"{len(eigen)} Tabellen mit select-own · {len(geholt)} im Export · "
          f"{len(benannt)} mit Grund ausgelassen\n")
    for t in sorted(eigen):
        wo = "im Export" if t in geholt else ("ausgelassen, mit Grund" if t in benannt else ">>> FEHLT <<<")
        print(f"  {t:28} {wo}")

    if fehlen:
        print()
        for t in fehlen:
            print(f"  FEHLER: {t} ({eigen[t]}) — der Nutzer darf diese Zeilen lesen, "
                  "bekommt sie aber nicht in seiner Auskunft.")
        print()
        print("Entweder in export-my-data aufnehmen, oder MIT GRUND in die Rubrik")
        print("`nicht_enthalten` schreiben. Art. 15 Abs. 1 verlangt Transparenz darueber,")
        print("WAS verarbeitet wird — stillschweigend weglassen ist die schlechtere Luecke.")
        return 1

    print("\nAuskunft: jede Tabelle mit Eigenzugriff ist enthalten oder benannt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
