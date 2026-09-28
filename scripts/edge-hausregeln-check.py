#!/usr/bin/env python3
"""Die stehenden Sicherheitsregeln aus AGENTS.md, mechanisch geprueft.

ANLASS (28.09.2026): Am Vormittag kam heraus, dass Regel 4 (eine Zeile in der
Zugriffsmatrix je Edge Function) seit Monaten dasteht und NIE etwas geprueft
hat -- drei Funktionen fehlten, darunter `pruefung` (sieht Gewerbescheine,
Steuer-IDs, Ausweise). Daraus die Regel: eine Hausregel ohne mechanische
Pruefung ist eine Absichtserklaerung. Dieser Pruefer holt Regel 1 und 2 nach.

GEMESSEN vor dem Bau (damit es niemand zweimal tut):
  Regel 1, Rate-Limit         16 Funktionen, 15 erfuellt, 0 Befunde,
                              1 begruendete Ausnahme (stripe-webhook)
  Regel 2, Eingabepruefung    10 lesen einen Rumpf, 8 erfuellt,
                              1 BEFUND (pstg-annual-report), 1 Ausnahme
  Regel 3, keine Geheimnisse  alle Lesungen ueber Deno.env.get, 0 Befunde
                              -- kein Pruefer, siehe unten

Der Befund zu Regel 2: `pstg-annual-report` las den Rumpf mit einem blanken
`req.json().catch(() => ({}))`. `year` wurde von Hand geprueft, jedes andere
Feld lief wortlos durch. Ohne Folge, solange nur `year` gelesen wird -- und
genau dafuer gibt es die Regel.

DIE FALLE, in die ein naiver Pruefer hier laeuft: fuenf Funktionen rufen
`enforceRateLimit` in `handler.ts` auf, nicht in `index.ts`. Wer nur
`index.ts` liest, meldet FUENF Fehlalarme und wird danach abgeschaltet.
Geprueft wird deshalb das ganze Verzeichnis der Funktion.
GEMESSEN, nicht geschaetzt: die Probe hat den Pruefer testweise auf
index.ts verengt und bekam cancel-contract, create-payment-intent,
inhalts-meldung, list-payment-methods, release-escrow. Mein erster
Grep hatte vier gezaehlt -- eine Zahl aus dem Augenmass ist keine.

MUTATIONEN (gemessen, je eine pro Richtung, jede macht NUR ihre rot):
  R1a Rate-Limit aus `health` entfernt (genau EIN Aufrufort)      -> rot
      `waitlist-doi` taugt dafuer NICHT: es hat zwei Rate-Limits
      (pro IP und pro E-Mail), eine einzelne Entfernung bleibt zu
      Recht gruen. Die assert-count-Sicherung hat das gefangen.
  R1b `assertOnlyFields` aus `cancel-contract` entfernt           -> rot
  R2  eine Ausnahme fuer eine Function eingetragen, die es nicht
      gibt                                                        -> rot ALLEIN
      (eine Ausnahme zu ENTFERNEN traefe Richtung 1 mit)
  R3  Auswahl auf `s*` verengt, so dass stripe-webhook und damit
      BEIDE Ausnahmen in der Auswahl bleiben                      -> rot ALLEIN
  Gegenproben: Kommentar in einer Function umformuliert, Untergrenze
  exakt auf den Messwert gesetzt, Datei beruehrt ohne Inhaltsaenderung
  -> alle drei gruen. Ohne sie waere ein Pruefer denkbar, der bei jeder
  Beruehrung anschlaegt, und der wird abgeschaltet und nie wieder an.

KEIN PRUEFER fuer Regel 3 (keine fest eingetragenen Geheimnisse): gemessen
0 Befunde, und GitHub laeuft ohnehin mit eigener Secret-Pruefung ueber das
Repository. Ein zweiter Pruefer fuer dieselbe Sache waere doppelte Meldung.
KEIN PRUEFER fuer Regel 5 (OWASP-Grundlinie): nicht mechanisch entscheidbar.
"""

import os
import re
import sys
import glob

FUNKTIONEN = "supabase/functions"

# Ein Rumpf wird gelesen. `_shared/validate.ts` enthaelt `req.json()` selbst
# und ist deshalb ausgenommen (siehe VERZEICHNISSE).
LIEST_RUMPF = re.compile(r"parseJsonObject\s*\(|req\.json\s*\(\)|req\.text\s*\(\)")
RATE_LIMIT = re.compile(r"enforceRateLimit\s*\(")
FELDER = re.compile(r"assertOnlyFields\s*\(")

# Jede Ausnahme mit Grund UND Fundstelle. Der Grund steht seit dem 17.07.2026
# in docs/security/access-control-matrix.md; hier steht er noch einmal, damit
# niemand den Pruefer lesen muss, um ihn zu finden.
AUSNAHMEN = {
    ("rate-limit", "stripe-webhook"):
        "Das Gate ist die Stripe-Signaturpruefung (constructEventAsync VOR "
        "jeder Verarbeitung; ungueltige Signatur -> 400). Ein Rate-Limit "
        "wuerde legitime Stripe-Wiederholungen nach einem Ausfall verwerfen "
        "und echte Zahlungs-Ereignisse verlieren. Siehe "
        "docs/security/access-control-matrix.md, 'Dokumentierte Ausnahme'.",
    ("eingabepruefung", "stripe-webhook"):
        "Die Signaturpruefung braucht den ROHEN Rumpf (req.text()); "
        "parseJsonObject wuerde ihn verbrauchen und neu serialisieren, und "
        "eine neu serialisierte Fassung hat eine andere Signatur.",
}

# GEMESSEN am 28.09.2026: 16 Funktionsverzeichnisse. Die Untergrenze liegt
# deutlich darunter und faengt den Fall, dass die Auswahl still nichts mehr
# trifft und der Pruefer trivial gruen wird. Geraten waere sie ein
# eingebauter Fehlalarm.
MIN_FUNKTIONEN = 10


def verzeichnisse() -> list[str]:
    """Alle Funktionsverzeichnisse ausser `_shared` (kein Endpunkt)."""
    gefunden = []
    for pfad in sorted(glob.glob(f"{FUNKTIONEN}/*/index.ts")):
        name = os.path.basename(os.path.dirname(pfad))
        if name.startswith("_"):
            continue
        gefunden.append(name)
    return gefunden


def quelltext(name: str) -> str:
    """Der GANZE Quelltext der Funktion, nicht nur index.ts.

    Vier Funktionen rufen enforceRateLimit in handler.ts auf. Wer nur
    index.ts liest, meldet sie faelschlich.
    """
    teile = []
    for pfad in sorted(glob.glob(f"{FUNKTIONEN}/{name}/*.ts")):
        with open(pfad, encoding="utf-8") as f:
            teile.append(f.read())
    return "\n".join(teile)


def main() -> int:
    namen = verzeichnisse()
    fehler = 0
    benutzt: set[tuple[str, str]] = set()
    mit_rumpf = 0

    ohne_limit: list[str] = []
    ohne_pruefung: list[str] = []

    for name in namen:
        text = quelltext(name)

        # Regel 1: jede oeffentliche Function begrenzt die Aufrufrate.
        if not RATE_LIMIT.search(text):
            if ("rate-limit", name) in AUSNAHMEN:
                benutzt.add(("rate-limit", name))
            else:
                ohne_limit.append(name)

        # Regel 2: wer einen Rumpf liest, weist unerwartete Felder ab.
        if LIEST_RUMPF.search(text):
            mit_rumpf += 1
            if not FELDER.search(text):
                if ("eingabepruefung", name) in AUSNAHMEN:
                    benutzt.add(("eingabepruefung", name))
                else:
                    ohne_pruefung.append(name)

    # Richtung 1: die Regeln selbst.
    if ohne_limit:
        fehler += len(ohne_limit)
        print(
            f"{len(ohne_limit)} Edge Function(s) ohne enforceRateLimit "
            "(AGENTS.md, stehende Regel 1):\n"
        )
        for name in ohne_limit:
            print(f"  {FUNKTIONEN}/{name}/")
        print()

    if ohne_pruefung:
        fehler += len(ohne_pruefung)
        print(
            f"{len(ohne_pruefung)} Edge Function(s) lesen einen Rumpf ohne "
            "assertOnlyFields (AGENTS.md, stehende Regel 2):\n"
        )
        for name in ohne_pruefung:
            print(f"  {FUNKTIONEN}/{name}/")
            print("    Ein unerwartetes Feld laeuft dort wortlos durch.")
        print()

    # Richtung 2: eine Ausnahmeliste ohne Verfallspruefung prueft irgendwann
    # weniger, als ihr Name sagt.
    verfallen = sorted(set(AUSNAHMEN) - benutzt)
    if verfallen:
        fehler += len(verfallen)
        print(
            f"{len(verfallen)} Ausnahme(n) werden nicht mehr gebraucht und "
            "gehoeren entfernt:\n"
        )
        for regel, name in verfallen:
            print(f"  {regel}: {name}")
        print()

    # Richtung 3: die Auswahl darf nicht still leerlaufen.
    if len(namen) < MIN_FUNKTIONEN:
        fehler += 1
        print(
            f"Die Auswahl trifft zu wenig: {len(namen)} Funktionen "
            f"(erwartet mindestens {MIN_FUNKTIONEN}).\n"
            "Entweder ist die Auswahl kaputt, oder es wurde viel geloescht.\n"
        )

    if fehler:
        print(f"FAIL: {fehler} Befund(e).")
        return 1

    print(
        f"PASS: {len(namen)} Edge Functions, alle mit Rate-Limit; "
        f"{mit_rumpf} lesen einen Rumpf, alle mit Feldpruefung "
        f"({len(AUSNAHMEN)} begruendete Ausnahmen)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
