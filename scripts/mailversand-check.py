#!/usr/bin/env python3
"""Zwei Zusagen, die jeder Mailversand halten muss.

  1. Er fragt die Einwilligung — oder nennt den Grund, warum nicht.
  2. Er setzt keinen rohen Nutzertext in das HTML der Mail.

ANLASS (12.09.2026, Selbst-Check): Am selben Tag kam mit 0870 der Schalter
„Vorgangsmails" in die Einstellungen, und send-push fragte ihn auch ab.
`notify-matching-providers` tat es NICHT — ausgerechnet bei der Mail, die ein
Anbieter am haeufigsten bekommt („Neuer Auftrag in Ihrer Naehe"). Wer den
Schalter umgelegt haette, haette weiter Mails bekommen.

Das ist dieselbe Klasse wie ein Feld, das sich setzen laesst und nichts
bewirkt: ein Schalter, der nicht schaltet. Und es ist keine Stilfrage. Die
Fussnote jener Mail nannte als Abschaltung die Verfuegbarkeit — die nimmt den
Anbieter zugleich aus Suche und Startseite. „Unsichtbar werden oder weiter
Mails bekommen" ist keine Wahl, sondern ein Druckmittel.

GEPRUEFT WIRD die Verdrahtung im Quelltext, nicht das Laufzeitverhalten.
Das ist Absicht: die Frage lautet „ist JEDER Mailweg angebunden?", und die
beantwortet kein Test einer einzelnen Funktion. Genau so faellt die naechste
Edge Function auf, die einen Versand hinzufuegt und den Schalter vergisst.

GRENZE: Das Skript sieht, DASS die Spalte in der Naehe des Versands
vorkommt — nicht, ob die Bedingung richtig herum steht. Ein
`=== false` statt `!== false` faellt hier nicht auf. Es ersetzt das Lesen
nicht, es erzwingt nur, dass ueberhaupt jemand hingesehen hat.
"""
import re
import sys
from pathlib import Path

SPALTE = "mail_benachrichtigungen"
VERSAND = "api.resend.com/emails"

# Versandwege, die den Schalter BEWUSST nicht fragen. Jede Ausnahme nennt den
# Grund, sonst weicht sie irgendwann jemand auf.
AUSNAHMEN = {
    "supabase/functions/verify-email/index.ts": (
        "Adressbestaetigung. Diese Mail stellt die Adresse ueberhaupt erst fest "
        "— sie von einer Einstellung abhaengig zu machen, die an der Adresse "
        "haengt, waere ein Zirkelschluss."),
    "supabase/functions/waitlist-doi/index.ts": (
        "Double-Opt-in. Das IST die Einwilligungsmail; ohne sie gibt es keine "
        "Einwilligung, die man abfragen koennte."),
    "supabase/functions/zustellung/index.ts": (
        "Pflichtmitteilungen (DSA Art. 17, AGB §7(4) i.V.m. Art. 4 P2B-VO). "
        "Die Uebermittlung ist geschuldet; ein Abbestellen wuerde die "
        "Begruendungspflicht aushebeln. So steht es auch im Hinweistext der "
        "Einstellungen."),
}


# ── 2. Kein roher Nutzertext im HTML ──────────────────────────────────────
#
# ANLASS (12.09.2026, im selben Durchgang gefunden): `notify-matching-providers`
# setzte den Auftragstitel roh in das HTML. Den Titel schreibt der KUNDE. Ein
# Titel wie `Heizung defekt<a href="https://…">Jetzt anmelden</a>` haette einen
# fremden Link in eine Mail gebracht, die nachweislich von Werkant kommt und
# deren Absender-Domain korrekt signiert ist. Skripte filtern Mailprogramme,
# Links und Text nicht.
#
# Erlaubt ist eine Einsetzung, die entweder sichtbar maskiert (escapeHtml(...))
# oder deren Name auf "Html" endet. Beides ist an der Einsetzstelle lesbar —
# und darum geht es: man soll nicht erst 40 Zeilen hoch scrollen muessen.
EINSETZUNG = re.compile(r"\$\{([^}]*)\}")
HTML_BLOCK = re.compile(r"html:\s*(.*?)(?:,\n\s*\}|,\n\s*\)|\n\s*\}\),)", re.S)
SICHER = re.compile(r"^(escapeHtml\(|\w*Html$)")

# Einsetzungen, die kein Nutzertext sind. Grund dazuschreiben.
EINSETZUNG_AUSNAHMEN = {
    "confirmUrl": ("Server gebaut: SUPABASE_URL aus der Umgebung plus ein "
                   "selbst erzeugtes Token. Kein Nutzertext."),
}


def html_einsetzungen_pruefen(rel: str, quelle: str) -> list[str]:
    fehler = []
    for block in HTML_BLOCK.finditer(quelle):
        for roh in EINSETZUNG.findall(block.group(1)):
            a = roh.strip()
            if SICHER.match(a) or a in EINSETZUNG_AUSNAHMEN:
                continue
            fehler.append(
                f"{rel}: ${{{a}}} steht roh im HTML der Mail. Entweder "
                f"escapeHtml(...) an der Stelle, oder die Variable auf "
                f"„Html\" enden lassen.")
    return fehler


def main() -> int:
    wurzel = Path(__file__).resolve().parent.parent
    fn_dir = wurzel / "supabase" / "functions"
    if not fn_dir.is_dir():
        print(f"ABBRUCH: {fn_dir} nicht gefunden — falscher Pfad?")
        return 1

    versender, fehler = [], []
    for pfad in sorted(fn_dir.rglob("*.ts")):
        quelle = pfad.read_text(encoding="utf-8")
        if VERSAND not in quelle:
            continue
        rel = str(pfad.relative_to(wurzel))
        versender.append(rel)
        # Maskierung gilt fuer JEDEN Versand, auch die Pflichtmitteilungen.
        fehler.extend(html_einsetzungen_pruefen(rel, quelle))
        if rel in AUSNAHMEN:
            print(f"AUSNAHME  {rel}\n          {AUSNAHMEN[rel]}")
            continue
        if SPALTE in quelle:
            print(f"OK        {rel}")
        else:
            fehler.append(f"{rel}: Versand ohne Abfrage von {SPALTE}")

    if not versender:
        print(f"ABBRUCH: kein einziger Versand ueber {VERSAND} gefunden — "
              "hat sich der Anbieter geaendert? Dann gehoert dieses Skript "
              "angepasst, nicht geloescht.")
        return 1

    # Eine Ausnahme fuer eine Datei, die gar nicht mehr versendet, ist eine
    # Einladung, sie spaeter unbemerkt wieder zu benutzen.
    for rel in AUSNAHMEN:
        if rel not in versender:
            fehler.append(f"{rel}: Ausnahme eingetragen, versendet aber keine Mail mehr")

    print()
    for z in fehler:
        print(f"  FEHLER: {z}")
    if fehler:
        print()
        print(f"{len(fehler)} Befund(e).")
        print()
        print(f'Ein Versand ohne {SPALTE} macht den Schalter „Vorgangsmails“ in den')
        print("Einstellungen zu einer Zusage, die nicht gilt. Ist der Versand rechtlich")
        print("geschuldet, gehoert eine Ausnahme MIT GRUND in AUSNAHMEN.")
        print()
        print("Roher Nutzertext im HTML setzt einen fremden Link in eine Mail, die")
        print("nachweislich von Werkant kommt. Das ist kein Stilproblem.")
        return 1
    print(f"Mailversand: {len(versender)} Wege geprueft (Einwilligung + Maskierung), "
              "keine Beanstandung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
