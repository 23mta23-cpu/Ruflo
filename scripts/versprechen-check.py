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

ERWEITERT AM 14.09.2026, und der Anlass ist eine Grenze dieses Pruefers:

  Er sah NUR app/garantie.tsx. Zwei neue Befunde lagen ausserhalb:

    app/anbieter.tsx            Abzeichen „Haftpflicht" mit gruenem Haken
    app/bewerbung-eingegangen   „Haftpflicht & Qualifikation ... verifiziert"

  Das Wort „Haftpflicht" kam im GANZEN Code genau zweimal vor, beide Male als
  Behauptung gegenueber dem Kunden. Es gibt keine Spalte, kein Feld im
  Onboarding, keinen Upload, keine Pruefung. Werkant hat noch nie eine Police
  gesehen, und ein Kunde laesst einen Fremden in seine Wohnung, weil dort ein
  Haken steht.

  Deshalb zwei Aenderungen: der Pruefer liest jetzt die GANZE Oberflaeche, und
  die Haftpflicht-Regel ist ABGELEITET statt aufgezaehlt. Sie schlaegt an, wenn
  der sichtbare Text die Haftpflicht als geprueft ausgibt UND es im Code kein
  entsprechendes Feld gibt. Kommt das Feld eines Tages, verstummt sie von
  selbst — eine Regel, die mitwaechst, statt eine, die jemand pflegen muss.

GRENZE, ausdruecklich: die uebrigen Regeln bleiben eine Liste bekannter
Rueckfaelle. Eine neue unwahre Behauptung faellt NICHT auf. Dafuer gibt es
keine Abkuerzung — Werbetexte gehoeren gegen den Code gelesen.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sichtbarer_text import sichtbarer_text_tsx


def hat(pfad: Path, muster: str) -> bool:
    return bool(re.search(muster, pfad.read_text(encoding="utf-8"), re.I))


def feld_vorhanden(w: Path, muster: str) -> bool:
    """Gibt es irgendwo im PRODUKTcode ein Feld, das dazu passt?

    Gesucht wird in Migrationen (die Spalte), in lib/ und data/ (der Typ) und
    in den Edge Functions. Kommentare zaehlen NICHT mit, sonst haelt die
    Erklaerung, warum es das Feld nicht gibt, den Pruefer fuer zufrieden.
    """
    ausdruck = re.compile(muster, re.I)
    for ordner, endungen in [("supabase/migrations", ("*.sql",)),
                             ("lib", ("*.ts",)), ("data", ("*.ts",)),
                             ("supabase/functions", ("*.ts",))]:
        basis = w / ordner
        if not basis.is_dir():
            continue
        for endung in endungen:
            for datei in basis.rglob(endung):
                for zeile in datei.read_text(encoding="utf-8").split("\n"):
                    blank = zeile.strip()
                    if blank.startswith(("--", "//", "*", "/*")):
                        continue
                    if ausdruck.search(zeile):
                        return True
    return False


def gesamter_sichtbarer_text(w: Path) -> list:
    """(Datei, sichtbarer Text) fuer jeden Bildschirm und Baustein."""
    raus = []
    for ordner in ("app", "components"):
        basis = w / ordner
        if not basis.is_dir():
            continue
        for datei in basis.rglob("*.tsx"):
            raus.append((datei.relative_to(w),
                         sichtbarer_text_tsx(datei.read_text(encoding="utf-8"))))
    return raus


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

    # ── Abgeleitete Regel ueber die GANZE Oberflaeche ────────────────────
    #
    # Eine Zusage ueber eine Betriebshaftpflicht darf nur stehen, wenn es das
    # Feld gibt. Heute gibt es keines; steht das Wort trotzdem als geprueft da,
    # ist es unwahr.
    hat_feld = feld_vorhanden(w, r"haftpflicht|liability_insur")
    anspruch = re.compile(
        r"haftpflicht[^.!?]{0,60}(verifiziert|geprüft|geprueft|nachgewiesen|hinterlegt)"
        r"|(verifiziert|geprüft|geprueft)[^.!?]{0,30}haftpflicht", re.I)
    # Ein Abzeichen ist eine Zusage, auch wenn das Wort „verifiziert" nicht
    # danebensteht: den Haken malt der Baustein.
    #
    # GEMESSEN AM 14.09.2026: die erste Fassung dieser Regel las nur den
    # sichtbaren Text. Die Mutation „Abzeichen wieder einbauen" blieb GRUEN,
    # weil in der Zeile nur „Haftpflicht" steht. Ein Pruefer, der den Fall
    # nicht sieht, fuer den er gebaut wurde.
    abzeichen = re.compile(
        r"<\s*VerifiedBadge[^>]*label\s*=\s*[\"\'{`][^\"\'}`]*haftpflicht", re.I)
    for ordner in ("app", "components"):
        basis = w / ordner
        if hat_feld or not basis.is_dir():
            break
        for datei in basis.rglob("*.tsx"):
            for nr, zeile in enumerate(datei.read_text(encoding="utf-8").split("\n"), 1):
                if zeile.strip().startswith(("//", "*", "/*")):
                    continue
                if abzeichen.search(zeile):
                    fehler.append((
                        f"{datei.relative_to(w)}:{nr} Abzeichen „Haftpflicht\"",
                        "Ein Abzeichen ist eine Zusage, auch ohne das Wort "
                        "„verifiziert\" daneben: den Haken malt der Baustein. "
                        "Es gibt im Code kein Haftpflicht-Feld."))

    for datei, sichtbar in gesamter_sichtbarer_text(w):
        if hat_feld:
            break
        for zeile in sichtbar.split("\n"):
            m = anspruch.search(zeile)
            if m:
                fehler.append((
                    f"{datei}: " + " ".join(m.group(0).split()),
                    "Gibt die Betriebshaftpflicht als geprueft aus. Es gibt im "
                    "Code kein Feld dafuer: keine Spalte, kein Upload, keine "
                    "Pruefung. Ein Kunde laesst einen Fremden in seine Wohnung, "
                    "weil dort ein Haken steht (§ 5 UWG)."))

    print(f"app/garantie.tsx: {len(regeln)} bekannte Rueckfaelle geprueft")
    print(f"Oberflaeche gesamt: Haftpflicht-Zusage ohne Feld "
          f"({'Feld vorhanden, Regel ruht' if hat_feld else 'kein Feld, Regel aktiv'})\n")
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
