#!/usr/bin/env python3
"""Fachwoerter, die ein Kunde nicht kennt, gehoeren nicht in die Oberflaeche.

ANLASS (14./15.09.2026, aus dem Stil-Audit): „Escrow" stand an 48 sichtbaren
Stellen in 20 Dateien, darunter der Bezahlknopf („Jetzt zahlen & Escrow
sperren"), die Erfolgsmeldung danach und die AGB.

Werkants Kunde ist ein 54-Jaehriger, der einem Fremden 800 Euro anvertraut und
ihn in seine Wohnung laesst. „Escrow" ist ein englisches Finanzwort. Wer es
nicht kennt, liest an der wichtigsten Stelle ein Wort, das ihm nichts sagt —
und soll genau dort Vertrauen fassen. Das deutsche Wort dafuer ist
Treuhandkonto, und es erklaert sich selbst.

ZWEI AUSNAHMEN, beide gewollt:

  * app/agb.tsx nennt das Wort EINMAL als Definition („ein Treuhandkonto
    (Escrow) bei Stripe"). Ein Vertrag darf den gaengigen Fachbegriff einmal
    festhalten, damit er anschlussfaehig bleibt.
  * app/support-chat.tsx laesst „escrow" im Stichwortfilter stehen. Wer das
    Wort tippt, soll trotzdem die richtige Antwort bekommen.

WAS ER NICHT LEISTET: Er kennt nur die Woerter in der Liste unten. Ein neues
Fachwort faellt NICHT auf. Und er liest Zeichenketten-Literale und
JSX-Textknoten, keine Bezeichner: `escrowTotal`, `styles.escrowRow` und
`release-escrow` sind Code und bleiben unberuehrt. Genau deshalb steht hier
ein eigener Auszug statt `sichtbarer_text_tsx` — dessen Resttext nimmt
Bezeichner mit, und beim Messen am 14.09. kamen so 99 „Treffer" heraus, von
denen nur 48 echt waren.

Ausfuehren:  python3 scripts/fachwort-check.py
Exit 0 = sauber, Exit 1 = ein Fachwort steht in sichtbarem Text.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
VERZEICHNISSE = ("app", "components")

# Wort -> (deutsche Entsprechung, erlaubte Ausnahmen als (Datei, Teilstring))
FACHWOERTER = {
    "escrow": (
        "Treuhandkonto",
        [
            ("app/agb.tsx", "Treuhandkonto (Escrow)"),
            ("app/support-chat.tsx", "lower.includes('escrow')"),
        ],
    ),
}

ZEICHENKETTE = re.compile(r"""(['"`])((?:\\.|(?!\1)[^\\])*)\1""")


def sichtbare_stellen(quelle: str):
    """(Zeilennummer, Zeile, Fundstueck) fuer Zeichenketten und JSX-Text.

    JSX-Kommentare `{/* … */}` koennen ueber mehrere Zeilen laufen. Ohne einen
    kleinen Zustand meldet der Pruefer die FORTSETZUNGSzeile, weil sie nicht mit
    `{/*` beginnt — genau so ist onboarding-kyc.tsx:501 am 15.09. aufgeschlagen.
    """
    im_kommentar = False
    for nr, zeile in enumerate(quelle.split("\n"), 1):
        blank = zeile.strip()
        if im_kommentar:
            if "*/" in zeile:
                im_kommentar = False
            continue
        if "{/*" in zeile and "*/" not in zeile.split("{/*", 1)[1]:
            im_kommentar = True
            continue
        if blank.startswith(("//", "*", "/*", "{/*")):
            continue
        gefunden = ZEICHENKETTE.findall(zeile)
        if gefunden:
            for _, inhalt in gefunden:
                yield nr, zeile, inhalt
        else:
            # JSX-Textknoten: Zeile ohne Zeichenkette, aber mit Text.
            yield nr, zeile, blank


def main() -> int:
    fehler = []
    geprueft = 0

    for ordner in VERZEICHNISSE:
        basis = WURZEL / ordner
        if not basis.is_dir():
            continue
        for datei in sorted(basis.rglob("*.tsx")):
            geprueft += 1
            rel = str(datei.relative_to(WURZEL))
            quelle = datei.read_text(encoding="utf-8")
            for wort, (ersatz, ausnahmen) in FACHWOERTER.items():
                muster = re.compile(wort, re.I)
                for nr, zeile, stueck in sichtbare_stellen(quelle):
                    # JSX-Kommentare sind Quelltext, kein sichtbarer Text.
                    if zeile.strip().startswith("{/*"):
                        continue
                    treffer = None
                    for m in muster.finditer(stueck):
                        vorher = stueck[m.start() - 1] if m.start() > 0 else " "
                        nachher = stueck[m.end()] if m.end() < len(stueck) else " "
                        # Teil eines Bezeichners oder Pfades: escrowTotal,
                        # hasEscrow, release-escrow, escrow_captured_at.
                        if vorher.isalnum() or vorher in "/_" or nachher.isalnum() or nachher == "_":
                            continue
                        # release-escrow, escrow-captured: Bindestrich mit
                        # kleingeschriebener Nachbarschaft ist ein Bezeichner,
                        # kein deutsches Kompositum („Escrow-Betrag" faengt
                        # gross an).
                        if vorher == "-" or (nachher == "-"
                                             and stueck[m.end() + 1:m.end() + 2].islower()):
                            continue
                        # Eine Zeichenkette, die NUR aus dem Wort besteht, ist
                        # ein Schluessel (Typ-Union, Icon-Tabelle), kein Satz.
                        if stueck.strip().lower() == wort:
                            continue
                        treffer = m
                        break
                    if treffer is None:
                        continue
                    if any(d == rel and a in zeile for d, a in ausnahmen):
                        continue
                    fehler.append((rel, nr, stueck.strip()[:90], wort, ersatz))

    print(f"{geprueft} Bildschirme und Bausteine geprueft, "
          f"{len(FACHWOERTER)} Fachwort/Fachwoerter\n")

    if fehler:
        for rel, nr, stueck, wort, ersatz in fehler:
            print(f"  FEHLER {rel}:{nr}")
            print(f"         „{stueck}\"")
            print(f"         „{wort}\" steht in sichtbarem Text. Deutsch: {ersatz}.\n")
        print(f"{len(fehler)} Stelle(n). Ein Kunde, der das Wort nicht kennt,")
        print("liest an der wichtigsten Stelle etwas, das ihm nichts sagt.")
        return 1

    print("Kein Fachwort in sichtbarem Text.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
