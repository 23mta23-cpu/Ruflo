#!/usr/bin/env python3
"""Jede Profilspalte wird beim Löschen geleert — oder nennt den Grund, warum nicht.

ANLASS (13.09.2026, Selbst-Check): `delete-account` loescht das Profil nicht, es
pseudonymisiert es (HGB §238/§257 verlangen zehn Jahre Aufbewahrung fuer
Finanzbelege). Es zaehlt dabei die zu leerenden Spalten EINZELN auf. Kommt
spaeter eine Spalte mit Personenbezug dazu und wird diese Liste nicht
nachgezogen, bleibt das Datum nach der Loeschung stehen — und niemand merkt es,
weil die Funktion weiterhin fehlerfrei durchlaeuft.

Genau diese Klasse ist in derselben Nacht schon zweimal aufgetreten:
`notifications` fehlte in der Art.-15-Auskunft, und acht weitere Tabellen
ebenfalls. Eine Aufzaehlung ohne Abgleich veraltet lautlos.

GRENZE: Geprueft wird, DASS eine Spalte in der Aufzaehlung vorkommt, nicht
WORAUF sie gesetzt wird. Wer `phone: phone` schreibt statt `phone: null`, faellt
hier nicht auf. Und die Spaltenliste stammt aus den Migrationen, nicht aus der
Produktionsdatenbank.
"""
import re
import sys
from pathlib import Path

FUNKTION = "supabase/functions/delete-account/index.ts"

# Spalten, die NICHT geleert werden. Jede nennt den Grund, sonst weicht sie
# irgendwann jemand auf.
BEHALTEN = {
    "id": "Der Fremdschluessel-Anker. Ohne ihn verlieren contracts und jobs "
          "ihre Zuordnung, und genau die sind zehn Jahre aufzubewahren.",
    "created_at": "Zeitstempel ohne Inhalt. Wird fuer die Aufbewahrungsfrist "
                  "der zugehoerigen Belege gebraucht.",
    "role": "Kunde oder Anbieter. Bestimmt, wie die aufbewahrten Vertraege zu "
            "lesen sind; ohne sie waere ein Beleg nicht mehr deutbar.",
    "account_type": "Privat oder gewerblich. Entscheidet ueber die "
                    "steuerliche Behandlung der aufbewahrten Vorgaenge.",
    "email_verified_at": "Zeitstempel ohne Inhalt; die Adresse, auf die er "
                         "sich bezieht, ist geleert.",
    "mail_benachrichtigungen": "Ein Wahrheitswert ohne Personenbezug. Nach der "
                               "Loeschung geht ohnehin keine Mail mehr hinaus.",
    "stripe_customer_id": "BEWUSST stehengelassen, damit die Loeschung auf "
                          "Stripe-Seite noch ausgeloest werden kann. So steht "
                          "es auch im Kopf der Funktion. Der Wert ist eine "
                          "Kennung bei Stripe, kein Inhalt.",
    "pstg_revenue": "PStTG-Meldedaten. § 2 PStTG verpflichtet zur Meldung an "
                    "das BZSt; die Zahlen sind bis zur Meldung aufzubewahren.",
    "pstg_tx_count": "wie pstg_revenue",
    "pstg_year": "wie pstg_revenue",
    "pstg_locked": "wie pstg_revenue",
}


def spalten_aus_migrationen(mig: Path) -> set:
    """Alle Spalten von public.profiles, aus create table und alter table."""
    spalten = set()
    for pfad in sorted(mig.glob("*.sql")):
        quelle = pfad.read_text(encoding="utf-8")

        m = re.search(r"create table (?:if not exists )?public\.profiles\s*\((.*?)\n\);",
                      quelle, re.S | re.I)
        if m:
            for zeile in m.group(1).split("\n"):
                t = re.match(r"\s{2,}([a-z_]+)\s+(uuid|text|boolean|timestamptz|integer|numeric|jsonb)",
                             zeile)
                if t:
                    spalten.add(t.group(1))

        # `alter table public.profiles` steht oft in einer eigenen Zeile und
        # haengt mehrere `add column` kommagetrennt darunter. Deshalb wird die
        # ganze Anweisung BIS ZUM SEMIKOLON gelesen — und nur die: in 0180
        # folgt direkt danach ein `alter table public.jobs` mit `address_city`,
        # das sonst als Profilspalte gezaehlt wuerde.
        for anweisung in quelle.split(";"):
            if not re.search(r"alter table (?:only )?public\.profiles\b", anweisung, re.I):
                continue
            for a in re.finditer(r"add column (?:if not exists )?([a-z_]+)", anweisung, re.I):
                spalten.add(a.group(1))
    return spalten


def main() -> int:
    wurzel = Path(__file__).resolve().parent.parent
    mig = wurzel / "supabase" / "migrations"
    fn = wurzel / FUNKTION

    if not mig.is_dir() or not fn.is_file():
        print("ABBRUCH: Migrationen oder delete-account nicht gefunden — falscher Pfad?")
        return 1

    spalten = spalten_aus_migrationen(mig)
    if len(spalten) < 15:
        print(f"ABBRUCH: nur {len(spalten)} profiles-Spalten gefunden (erwartet >= 15). "
              "Hat sich die Schreibweise geaendert? Dann gehoert dieses Skript "
              "angepasst, nicht geloescht.")
        return 1

    quelle = fn.read_text(encoding="utf-8")
    m = re.search(r'\.from\("profiles"\)\s*\n\s*\.update\(\{(.*?)\}\)', quelle, re.S)
    if not m:
        print(f"ABBRUCH: die Pseudonymisierung in {FUNKTION} ist nicht lesbar.")
        return 1
    geleert = set(re.findall(r"([a-z_]+)\s*:", m.group(1)))

    fehler = []
    print(f"{len(spalten)} Spalten · {len(geleert)} geleert · {len(BEHALTEN)} mit Grund behalten\n")
    for s in sorted(spalten):
        if s in geleert:
            print(f"  {s:26} geleert")
        elif s in BEHALTEN:
            print(f"  {s:26} behalten: {BEHALTEN[s][:60]}")
        else:
            print(f"  {s:26} >>> WEDER NOCH <<<")
            fehler.append(s)

    # Ein Grund fuer eine Spalte, die es nicht mehr gibt, ist eine Einladung,
    # ihn spaeter auf etwas anderes zu beziehen.
    for s in BEHALTEN:
        if s not in spalten:
            fehler.append(f"{s}: Grund eingetragen, Spalte existiert nicht (mehr)")

    print()
    for z in fehler:
        print(f"  FEHLER: {z}")
    if fehler:
        print()
        print("Eine Profilspalte, die beim Loeschen weder geleert noch begruendet wird,")
        print("bleibt nach der Kontoloeschung stehen — ohne dass jemand es merkt, denn")
        print("die Funktion laeuft weiter fehlerfrei durch (Art. 17 DSGVO).")
        return 1

    print("Loeschung: jede Profilspalte ist geleert oder mit Grund behalten.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
