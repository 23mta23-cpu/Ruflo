#!/usr/bin/env python3
"""Was beim Founder liegt, steht auf SEINER Liste, nicht nur in der Chronik.

ANLASS (27.09.2026). `docs/SESSION_HANDOFF.md` ist die Chronik und wird nach
oben fortgeschrieben; `docs/founder/MEINE-AUFGABEN-PLATZHALTER.md` ist die
Liste, die der Founder abarbeitet. Gemessen, wie weit die beiden
auseinandergelaufen waren:

    Founder-Punkte im obersten Offen-Abschnitt der Chronik      8
    davon auf der Founder-Liste                                 4
    davon NICHT auf der Liste                                   4

Darunter `WERKANT_ADMIN_EMAILS`: ohne dieses Secret kann NIEMAND einen Betrieb
freigeben. Gemessen gegen die Produktion am 27.09.: `pruef_offen: 1`,
`pruef_stau: true` -- ein Betrieb wartete seit dem 16.09. ueber der Frist, und
der Grund stand nur in einer Chronikdatei.

Dieselbe Klasse wie „eine Mitteilung ohne Empfaenger-Bildschirm" (16.09.) und
„die Sichtbarkeit war selbst unsichtbar" (22.09.), diesmal auf meine eigene
Berichterstattung angewandt: einen Blocker dort aufzuschreiben, wo der
Empfaenger nicht hinsieht, ist so gut wie ihn nicht aufzuschreiben.

GEPRUEFT WIRD IN DREI RICHTUNGEN (die dritte ist die, die nur hier faellt):
  1. Jeder bekannte Founder-Punkt steht auf der Liste.
  2. Der oberste Offen-Abschnitt der Chronik nennt ueberhaupt Punkte
     (sonst ist der Auszug kaputt, nicht das Produkt).
  3. Der Abschnitt nennt keinen Founder-Punkt, den dieser Pruefer NICHT
     kennt -- sonst waere ein spaeter ergaenzter Blocker stillschweigend
     ungeprueft.

GRENZE: Geprueft wird, DASS der Punkt auf der Liste steht, nicht ob er dort
richtig beschrieben ist. Und nur Punkte mit einem stabilen Namen; ein
Blocker, den die Chronik nur umschreibt, faellt hier nicht auf.
"""
import pathlib
import re
import sys

CHRONIK = pathlib.Path("docs/SESSION_HANDOFF.md")
LISTE = pathlib.Path("docs/founder/MEINE-AUFGABEN-PLATZHALTER.md")

# (Anzeigename, Muster in der Chronik, Muster auf der Founder-Liste)
PUNKTE = [
    ("Admin-Freigabe",      r"WERKANT_ADMIN_EMAILS",          r"WERKANT_ADMIN_EMAILS"),
    ("Mailversand",         r"RESEND_API_KEY",                r"RESEND_API_KEY"),
    ("Stripe",              r"Stripe",                        r"STRIPE_SECRET_KEY"),
    ("Ladungsanschrift",    r"LEGAL_PLACEHOLDER",             r"LEGAL_PLACEHOLDER|Impressum"),
    ("DAC7",                r"DAC7",                          r"DAC7"),
    ("Geraetetest",         r"Ger[äa]tetest",                 r"iPhone|Testdurchlauf"),
    ("Merge nach main",     r"PR nach .?main",                r"nicht ausgeliefert|PR nach"),
    ("Zahlungsmittel",      r"Zahlungsmittel",                r"Zahlungsmittel"),
    ("Aufbewahrung 10 J.",  r"Transaktionsdaten",             r"Transaktionsdaten"),
]

# Woran ein Founder-Punkt im Text zu erkennen ist, auch wenn der Pruefer ihn
# noch nicht kennt: ein Secret-Name in GROSSBUCHSTABEN mit Unterstrich.
FREMDER_PUNKT = re.compile(r"`([A-Z][A-Z0-9_]{6,})`")
BEKANNTE_NAMEN = {"WERKANT_ADMIN_EMAILS", "RESEND_API_KEY", "STRIPE_SECRET_KEY",
                  "STRIPE_WEBHOOK_SECRET", "LEGAL_PLACEHOLDER", "WERKANT_ADMIN_SECRET",
                  "EXPO_PUBLIC_BUILD"}

MINDESTENS = 4


def oberster_offen_abschnitt(text: str) -> str:
    """Der 'Offen'-Abschnitt des OBERSTEN Standes. Massgeblich ist er, nicht
    aeltere Listen -- so steht es im Kopf der Chronik.

    ZUERST FALSCH GEBAUT und gemessen: ein blosses `\n## Offen\n` ueber die
    ganze Datei fand bei umbenanntem Abschnitt einfach den NAECHSTEN, also
    einen ALTEN Stand -- und der Pruefer blieb gruen, waehrend er den
    falschen Abschnitt las. Deshalb erst den obersten `# Stand` abgrenzen und
    nur DARIN suchen."""
    erster = re.search(r"^# Stand .*?$", text, re.M)
    if not erster:
        return ""
    zweiter = re.search(r"^# Stand .*?$", text[erster.end():], re.M)
    block = text[erster.end():erster.end() + zweiter.start()] if zweiter else text[erster.end():]
    m = re.search(r"\n## Offen\n(.*?)(?=\n---|\Z)", block, re.S)
    return m.group(1) if m else ""


def main() -> int:
    for pfad in (CHRONIK, LISTE):
        if not pfad.exists():
            print(f"FAIL {pfad} gibt es nicht")
            return 1
    chronik = CHRONIK.read_text(encoding="utf-8")
    liste = LISTE.read_text(encoding="utf-8")
    abschnitt = oberster_offen_abschnitt(chronik)
    if not abschnitt:
        print("FAIL der oberste Offen-Abschnitt war nicht zu finden -- "
              "der Auszug ist kaputt, nicht das Produkt")
        return 1

    fehler = 0
    genannt = 0
    for name, in_chronik, auf_liste in PUNKTE:
        if not re.search(in_chronik, abschnitt, re.I):
            continue
        genannt += 1
        if re.search(auf_liste, liste, re.I):
            print(f"PASS {name} steht auf der Founder-Liste")
        else:
            print(f"FAIL {name} steht im Offen-Abschnitt, aber NICHT auf der "
                  f"Founder-Liste ({LISTE})")
            fehler += 1

    if genannt < MINDESTENS:
        print(f"FAIL nur {genannt} bekannte Punkte im Offen-Abschnitt gefunden, "
              f"erwartet mindestens {MINDESTENS} -- der Auszug greift nicht mehr")
        fehler += 1

    for treffer in FREMDER_PUNKT.findall(abschnitt):
        if treffer not in BEKANNTE_NAMEN:
            print(f"FAIL der Offen-Abschnitt nennt `{treffer}`, und dieser "
                  f"Pruefer kennt den Punkt nicht -- in PUNKTE eintragen")
            fehler += 1

    if fehler == 0:
        print(f"PASS alle {genannt} offenen Founder-Punkte stehen auf seiner Liste")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
