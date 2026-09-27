#!/usr/bin/env python3
"""Jede zugesagte Aufbewahrungsfrist hat ihren Mechanismus im Code.

ANLASS (27.09.2026). `app/datenschutz.tsx` nennt im Abschnitt „Speicherdauer"
fuenf Fristen. Gemessen, wer sie damals einhielt:

    Konto-/Profildaten  bis Kontoloeschung   delete-account          OK
    Transaktionsdaten   10 Jahre             aufbewahrt (HGB/AO)     OK
    IP-Adressen (Logs)  7 Tage               0730, check_rate_limit  OK
    Chat-Nachrichten    6 Monate             NICHTS
    Consent-Log         3 Jahre              NICHTS

Fuenf Zusagen, zwei ohne jeden Mechanismus, null Fehlalarme -- deshalb dieser
Pruefer. Heute faellt das nicht auf, weil die Plattform juenger ist als die
laengste dieser Fristen; genau deshalb wird es still falsch, sobald sie es
nicht mehr ist (Art. 5 Abs. 1 lit. e DSGVO, und eine unwahre Angabe in einer
veroeffentlichten Erklaerung).

WIE GEPRUEFT WIRD, und warum in BEIDE Richtungen:
  1. Jede Zeile der Tabelle unten muss WOERTLICH in der Datenschutzerklaerung
     stehen. Wer die Frist im Text aendert und den Code vergisst, wird rot.
  2. Jede Zeile muss ihren Beleg im Code haben. Wer den Mechanismus
     herausnimmt oder die Frist dort aendert, wird ebenfalls rot.
  3. Der Abschnitt darf keine Frist nennen, die hier NICHT steht. Ohne das
     waere eine spaeter ergaenzte sechste Zusage stillschweigend ungeprueft --
     dieselbe Klasse wie eine Ausnahmeliste ohne Verfallspruefung (22.09.).

GRENZE: Geprueft wird die Existenz des Mechanismus und die Zahl darin, NICHT
ob er je laeuft. pg_cron ist in dieser Instanz nicht eingerichtet; dass ein
Rueckstand sichtbar wird, sichert `aufbewahrung_status()` und Reise 15 zu.
"""
import pathlib
import re
import sys

ERKLAERUNG = pathlib.Path("app/datenschutz.tsx")

# (Zusage im Text, Datei mit dem Mechanismus, Beleg darin, Begruendung)
FRISTEN = [
    (
        "Konto-/Profildaten: bis Kontolöschung",
        "supabase/functions/delete-account/index.ts",
        r"pseudonymisier|anonymisier|null",
        "Die Kontoloeschung leert die Profilspalten; welche genau, prueft "
        "loeschung-vollstaendig-check.py.",
    ),
    (
        "Transaktionsdaten: 10 Jahre (§147 AO, §257 HGB)",
        "supabase/functions/delete-account/index.ts",
        r"147|257|zehn Jahre|10 Jahre",
        "Hier ist die Zusage AUFBEWAHRUNG, nicht Loeschung: die Belege "
        "bleiben stehen, wenn das Konto geht. Eine Obergrenze nach zehn "
        "Jahren gibt es noch nicht und hat vor 2036 keinen Anwendungsfall.",
    ),
    (
        "Chat-Nachrichten: 6 Monate nach Auftragsabschluss; bei einem offenen "
        "Streitfall bis zu dessen Abschluss (Art. 17 Abs. 3 lit. e DSGVO)",
        "supabase/migrations/1040_aufbewahrung_chat_und_consent.sql",
        r"interval '6 months'",
        "chat_aufbewahrung_anwenden(), mit der Ausnahme fuer offene "
        "Streitfaelle (Art. 17 Abs. 3 lit. e DSGVO).",
    ),
    (
        "Consent-Log: 3 Jahre (Art. 5 Abs. 2 DSGVO Rechenschaftspflicht)",
        "supabase/migrations/1040_aufbewahrung_chat_und_consent.sql",
        r"interval '3 years'",
        "consent_aufbewahrung_anwenden().",
    ),
    (
        "IP-Adressen (Logs): 7 Tage (Sicherheit)",
        "supabase/migrations/0730_ip_aufbewahrung_und_consent_log.sql",
        r"interval '7 days'",
        "Bewusst ohne Scheduler: haengt an jedem check_rate_limit-Aufruf.",
    ),
]

# Eine Zeile im Abschnitt „Speicherdauer" nennt eine Frist, wenn sie eine Zahl
# mit Zeiteinheit traegt -- oder ausdruecklich an ein Ereignis gebunden ist.
NENNT_FRIST = re.compile(
    r"\d+\s*(Tag|Tage|Monat|Monate|Jahr|Jahre)|bis Kontolöschung", re.IGNORECASE
)


def abschnitt_speicherdauer(text: str) -> str:
    """Der content-String des Abschnitts mit der id 'speicherdauer'."""
    m = re.search(r"id:\s*'speicherdauer'.*?content:\s*'(.*?)',\n", text, re.S)
    return m.group(1) if m else ""


def main() -> int:
    if not ERKLAERUNG.exists():
        print(f"FAIL {ERKLAERUNG} gibt es nicht")
        return 1
    text = ERKLAERUNG.read_text(encoding="utf-8")
    abschnitt = abschnitt_speicherdauer(text)
    if not abschnitt:
        print("FAIL der Abschnitt 'speicherdauer' war nicht zu finden -- "
              "der Auszug ist kaputt, nicht das Produkt")
        return 1

    fehler = 0

    # 1./2. jede Zusage im Text UND ihr Beleg im Code
    for zusage, datei, beleg, grund in FRISTEN:
        if zusage not in abschnitt:
            print(f'FAIL die Zusage \u201e{zusage}\u201c steht so nicht mehr in der Datenschutzerklaerung')
            fehler += 1
            continue
        pfad = pathlib.Path(datei)
        if not pfad.exists():
            print(f'FAIL {datei} gibt es nicht (Beleg fuer \u201e{zusage}\u201c)')
            fehler += 1
            continue
        if not re.search(beleg, pfad.read_text(encoding="utf-8")):
            print(f'FAIL \u201e{zusage}\u201c: kein Beleg in {datei} ({beleg})')
            print(f"     erwartet wäre: {grund}")
            fehler += 1
            continue
        print(f'PASS \u201e{zusage}\u201c <- {datei}')

    # 3. keine Frist im Abschnitt, die hier nicht steht
    bekannt = [z for z, _, _, _ in FRISTEN]
    for zeile in abschnitt.split("\\n"):
        zeile = zeile.strip().lstrip("•").strip()
        if not zeile or not NENNT_FRIST.search(zeile):
            continue
        if zeile not in bekannt:
            print(f'FAIL die Erklaerung nennt eine Frist, die dieser Pruefer nicht kennt: \u201e{zeile}\u201c')
            fehler += 1
    if fehler == 0:
        print(f"PASS alle {len(FRISTEN)} zugesagten Fristen haben ihren Mechanismus")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
