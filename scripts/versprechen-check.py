#!/usr/bin/env python3
"""Werbetexte duerfen nicht behaupten, was Code und AGB widerlegen.

ANLASS (13.09.2026, Rechts-Audit): `app/garantie.tsx` ist die Seite, auf der
Werkant erklaert, warum man ihm trauen kann. Genau dort standen vier Aussagen,
die der eigene Code oder die eigenen AGB widerlegen:

  * „Ihr Geld verlaesst Werkant erst, wenn Sie bestaetigen" — das Geld liegt
    nie bei Werkant (AGB §4(4)), und nach Ablauf der Abnahmefrist wird OHNE
    Bestaetigung ausgezahlt (0770). Der Satz war zugleich die Aussage, die eine
    Aufsicht in der offenen ZAG-Frage zitieren wuerde.
  * „Strike-System sperrt Verstoesse automatisch" — AGB §11(4) sagt das
    Gegenteil, und 0750 ist ein Werkzeug, das von Hand aufgerufen wird.
  * „Alle Dokumente stehen als PDF bereit" — es gibt keine PDF-Erzeugung.
  * „Alle Daten in EU-Rechenzentren (Frankfurt)" — die eigene
    Datenschutzerklaerung nennt Empfaenger ausserhalb der EU.

Jede einzelne ist nach § 5 UWG angreifbar, und zwar durch jeden Wettbewerber.

WARUM EIN SKRIPT UND NICHT NUR EINE KORREKTUR: weil ein Werbetext wieder
waechst. Die vier Regeln unten stehen jeweils fuer einen Fehler, den es
wirklich gab — keine davon ist ausgedacht.

GRENZE, ausdruecklich: das hier ist eine Liste bekannter Rueckfaelle, kein
Pruefer fuer Werbeaussagen im Allgemeinen. Eine neue unwahre Behauptung faellt
NICHT auf. Dafuer gibt es keine Abkuerzung — Werbetexte gehoeren gegen den Code
gelesen.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sichtbarer_text import sichtbarer_text_tsx


def hat(pfad: Path, muster: str) -> bool:
    return bool(re.search(muster, pfad.read_text(encoding="utf-8"), re.I))


def main() -> int:
    w = Path(__file__).resolve().parent.parent
    werbung = w / "app" / "garantie.tsx"
    if not werbung.is_file():
        print("ABBRUCH: app/garantie.tsx nicht gefunden — falscher Pfad?")
        return 1

    text = sichtbarer_text_tsx(werbung.read_text(encoding="utf-8"))

    regeln = [
        (r"Geld\s+verl(ä|ae)sst\s+Werkant|Geld\s+liegt\s+bei\s+Werkant",
         "Behauptet, das Geld liege bei Werkant. AGB §4(4) sagt das Gegenteil, "
         "und in der offenen ZAG-Frage (§ 63 ZAG, strafbewehrt) ist genau das "
         "der Satz, den eine Aufsicht zitieren wuerde."),

        (r"(sperrt|sperren)[^.]{0,40}automatisch|automatisch[^.]{0,25}(gesperrt|sperrt)",
         "Behauptet automatische Sperren. AGB §11(4): „Eine automatisierte "
         "Entscheidung ueber Massnahmen findet nicht statt.\" 0750 ist ein "
         "Werkzeug, das von Hand aufgerufen wird."),

        (r"als\s+PDF|PDF\s+bereit|PDF-Download",
         "Verspricht PDF-Dokumente. Im Code gibt es keine PDF-Erzeugung; "
         "Vertrag, Beleg und Widerrufsformular gehen als Text ueber Share."),

        (r"(alle|sämtliche)\s+Daten[^.]{0,40}(EU|Frankfurt|Deutschland)",
         "Behauptet, alle Daten laegen in der EU. Die eigene "
         "Datenschutzerklaerung nennt Empfaenger ausserhalb, und Push laeuft "
         "ueber exp.host."),
    ]

    fehler = []
    for muster, grund in regeln:
        m = re.search(muster, text, re.I)
        if m:
            fehler.append((" ".join(m.group(0).split()), grund))

    print(f"app/garantie.tsx: {len(regeln)} bekannte Rueckfaelle geprueft\n")
    for stelle, grund in fehler:
        print(f"  FEHLER: „{stelle}\"")
        print(f"          {grund}\n")

    if fehler:
        print(f"{len(fehler)} Aussage(n), die der eigene Code oder die eigenen AGB")
        print("widerlegen. Jede ist nach § 5 UWG angreifbar.")
        return 1

    print("Versprechen: keine der vier bekannten Falschaussagen steht wieder da.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
