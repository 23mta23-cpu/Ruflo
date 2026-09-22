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
from sichtbarer_text import sichtbarer_text_tsx, zeichenketten_und_resttext


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

    # Dieselbe abgeleitete Form fuer den AUSWEIS.
    #
    # ANLASS (14.09.2026): Zwei Bildschirme zeigten „Ausweis verifiziert".
    # Werkant erhebt bewusst KEINE Ausweiskopien (§ 20 PAuswG), und vier
    # andere Bildschirme sagen das ausdruecklich. Im Nachbarschafts-Bereich
    # hing das Abzeichen zusaetzlich an `meister_verified` — dem Meisterbrief,
    # bei Privatpersonen.
    hat_ausweisfeld = feld_vorhanden(
        w, r"ausweis_(pfad|path|geprueft|verifiziert)|id_document|personalausweis_")
    ausweis = re.compile(
        r"ausweis[^.!?]{0,40}(verifiziert|geprüft|geprueft|nachgewiesen)"
        r"|(verifiziert|geprüft|geprueft)[^.!?]{0,20}ausweis", re.I)
    if not hat_ausweisfeld:
        for datei, sichtbar in gesamter_sichtbarer_text(w):
            for zeile in sichtbar.split("\n"):
                m = ausweis.search(zeile)
                if m:
                    fehler.append((
                        f"{datei}: " + " ".join(m.group(0).split()),
                        "Gibt den Ausweis als geprueft aus. Werkant erhebt "
                        "bewusst keine Ausweiskopien (§ 20 PAuswG); die "
                        "Altersgrenze prueft Stripe. Vier Bildschirme sagen "
                        "das ausdruecklich."))

    # Werbung mit Selbstverstaendlichkeiten (§ 5 Abs. 1 UWG).
    #
    # ANLASS (14.09.2026): Auf der Startseite standen „PStTG-konform" und
    # „DSGVO-konform" als Vertrauens-Abzeichen. Beides sind gesetzliche
    # Pflichten, keine Leistungen; als Siegel gesetzt lesen sie sich wie eine
    # Zertifizierung. Der eigene Rechts-Audit fuehrt zu beiden offene Punkte.
    #
    # GEPRUEFT WIRD DER QUELLTEXT, nicht der Textauszug. Die erste Fassung
    # dieser Regel las den sichtbaren Text und filterte auf „kurze Zeilen" —
    # `sichtbarer_text_tsx` liefert eine Datei aber als EINE einzige Zeile,
    # also uebersprang der Filter alles. Die Mutation „Siegel wieder einbauen"
    # blieb gruen. Mein eigener Filter war die blinde Stelle.
    #
    # Eine Beschriftung ist ohnehin eine Quelltext-Frage: entscheidend ist,
    # ob die Zeichenkette GANZ aus der Konformitaets-Aussage besteht. Ein
    # erklaerender Satz im Fliesstext faellt damit nicht auf, und das ist
    # gewollt.
    siegel = re.compile(
        r"""['"`]\s*(?:DSGVO|PStTG|DAC7|BFSG|DSA|UWG|GwG|TTDSG|TDDDG)"""
        r"""[\s-]?konform(?:it(?:ä|ae)t)?\s*['"`]""", re.I)
    for ordner in ("app", "components"):
        basis = w / ordner
        if not basis.is_dir():
            continue
        for datei in basis.rglob("*.tsx"):
            for nr, zeile in enumerate(datei.read_text(encoding="utf-8").split("\n"), 1):
                if zeile.strip().startswith(("//", "*", "/*")):
                    continue
                m = siegel.search(zeile)
                if m:
                    fehler.append((
                        f"{datei.relative_to(w)}:{nr} " + m.group(0).strip(),
                        "Wirbt mit der Einhaltung einer gesetzlichen Pflicht wie "
                        "mit einer Leistung. Als Beschriftung gesetzt liest sich "
                        "das wie eine Zertifizierung (§ 5 Abs. 1 UWG), und der "
                        "eigene Rechts-Audit fuehrt dazu offene Punkte."))

    # Der Auftrags-Trichter bedient BEIDE Wege im selben Bildschirm.
    #
    # ANLASS (Founder am Geraet, 21.09.2026): „Warum benoetigen die fuer
    # Nachbarschaftshilfe geprüfte Gewerbescheine?" Er hatte „4 Kartons
    # muessen getragen werden" aufgegeben -- Umzugshilfe, also der
    # Nachbarschaftsweg -- und las danach: „Wir leiten Ihre Anfrage an
    # passende Betriebe mit geprüftem Gewerbeschein weiter."
    #
    # Der Satz stand zweimal als Literal in app/auftrag-aufgeben.tsx, ohne
    # jede Unterscheidung. Auf dem Nachbarschaftsweg legt niemand einen
    # Gewerbeschein vor (app/onboarding-kyc.tsx); geprueft wird die
    # Volljaehrigkeitserklaerung (0990) und danach entscheidet ein Mensch.
    # Eine Zusage, die der eigene Code nicht einloest: § 5 UWG.
    #
    # Geprueft wird die HERKUNFT, nicht der Wortlaut: ein Wertvergleich kann
    # eine Bindung nicht beweisen, wenn beide Seiten denselben Text tragen
    # (dieselbe Klasse wie COMPANY.email gegen MAIL.kontakt, 16.08.2026).
    trichter = w / "app" / "auftrag-aufgeben.tsx"
    if not trichter.is_file():
        print("ABBRUCH: app/auftrag-aufgeben.tsx nicht gefunden — falscher Pfad?")
        return 1
    trichter_text = trichter.read_text(encoding="utf-8")
    for nr, zeile in enumerate(trichter_text.split("\n"), 1):
        if zeile.strip().startswith(("//", "*", "/*")):
            continue
        if re.search(r"gepr(ü|ue)ftem\s+Gewerbeschein", zeile, re.I):
            fehler.append((
                f"app/auftrag-aufgeben.tsx:{nr} " + " ".join(zeile.split())[:70],
                "Der Trichter bedient beide Wege. Ein fester Satz ueber den "
                "Gewerbeschein gilt dann auch fuer Nachbarschaftshilfe, wo "
                "niemand einen vorlegt. Gehoert nach lib/empfaengerText.ts."))
    if "empfaengerSatz(" not in trichter_text or "empfaengerHinweis(" not in trichter_text:
        fehler.append((
            "app/auftrag-aufgeben.tsx",
            "Nennt den Empfaenger nicht mehr ueber lib/empfaengerText.ts. "
            "Ohne diese Herkunft laeuft der Satz wieder auseinander."))

    # Ein Bildschirm mit verbindlicher Handlung darf den Vorgang nicht ERFINDEN.
    #
    # ANLASS (21.09.2026): In app/stornierung.tsx stand
    # `const title = jobTitle ?? 'Heizungswartung'`. Der Bildschirm lud den
    # Vertrag gar nicht; fehlte der URL-Parameter, las der Nutzer
    # „Heizungswartung" und stornierte scheinbar etwas, das es nicht gibt.
    #
    # Beim Nachsehen, ob es das noch einmal gibt: ja, und schlimmer.
    # app/betrieb/angebot-erstellen.tsx zeigte `job?.title ?? 'Handwerksleistung'`
    # und liess den Knopf frei. Ein Betrieb konnte ein bindendes Angebot MIT
    # PREIS auf einen Auftrag abgeben, den er nie gesehen hat.
    #
    # WARUM HIER UND NICHT IM BROWSER: geldwege-check.cjs prueft, dass kein
    # Geld-Bildschirm mit einer Null-Kennung ein GEWERK nennt. Die Mutation
    # „Platzhalter zurueck" blieb dort GRUEN -- „Heizungswartung" steht in
    # keiner Gewerke-Liste. Ein erfundener Titel ist im Browser nicht von
    # einem echten zu unterscheiden; im Quelltext schon, denn dort ist er ein
    # Rueckfall auf ein Literal.
    #
    # ERLAUBT sind Ersatzwoerter, die NICHTS behaupten: „Anbieter" statt eines
    # Namens sagt ehrlich „ein Anbieter, Name unbekannt". Verboten ist alles,
    # was eine konkrete Leistung benennt. Die Liste ist bewusst eine
    # Positivliste: wer ein neues Ersatzwort einfuehrt, traegt es ein, und die
    # Entscheidung wird damit sichtbar.
    NEUTRAL = {
        "auftrag", "auftragsdetails", "anbieter", "betrieb", "kunde", "helfer",
        "unbekannt", "wird geladen …", "wird geladen ...",
        # „Dienstleistung" stand hier bis zum 21.09.2026 und machte die Regel
        # an der wichtigsten Stelle blind: die Mutation „Leistungsgegenstand
        # wieder auf ‚Dienstleistung'" blieb GRUEN. Auf einer Suchliste ist
        # das Wort harmlos, in einem VERTRAG ist es eine Aussage ueber den
        # Leistungsgegenstand -- und § 631 BGB verlangt einen bestimmten.
        # Die Positivliste gilt nur fuer die Bildschirme unten, also trifft
        # das Streichen keine harmlose Stelle anderswo.
        "name fehlt", "anonym", "ohne betriebsnamen", "dieses gewerk",
        # Eine Zustandsangabe behauptet nichts. Aufgenommen am 21.09.2026
        # fuer app/vertrag.tsx: dort steht sie statt eines erfundenen
        # Leistungsgegenstands.
        "konnte nicht geladen werden",
    }
    VERBINDLICH = [
        ("app/stornierung.tsx", "storniert und loest eine Erstattung aus"),
        ("app/betrieb/angebot-erstellen.tsx", "gibt ein bindendes Angebot mit Preis ab"),
        ("app/auftrag-abschliessen.tsx", "gibt den Treuhandbetrag frei"),
        ("app/reklamation.tsx", "friert den Treuhandbetrag ein"),
        ("app/zahlung.tsx", "loest die Zahlung aus"),
        # Eine abgegebene Bewertung laesst sich nicht mehr aendern
        # (`revoke update on public.reviews from authenticated`, 0930)
        # und ist oeffentlich. Also dieselbe Klasse.
        ("app/bewertung.tsx", "gibt eine oeffentliche, unveraenderliche Bewertung ab"),
        # Nachgetragen am 21.09.2026. Meine erste Einschaetzung war, der
        # Bildschirm gehoere nicht dazu, weil die Zahlung auf /zahlung
        # passiert. Das ist zu eng gedacht: der Knopf „Vertrag bestaetigen"
        # IST die Zustimmung, und ohne Leistungsgegenstand stimmt der Kunde
        # einem Vertrag zu, dessen Gegenstand er nicht sieht. § 631 BGB.
        ("app/vertrag.tsx", "laesst den Vertrag bestaetigen (§ 631 BGB)"),
    ]
    # GEPRUEFT UND BEGRUENDET NICHT IN DER LISTE (21.09.2026), damit das
    # niemand ein zweites Mal durchgeht:
    #   app/widerruf.tsx      -- der Nutzer TIPPT die Angaben selbst ein
    #                            (Formular nach Anlage 2 zu Art. 246a EGBGB).
    #                            Es wird kein Vorgang geladen, also auch
    #                            keiner erfunden.
    #   app/konto-loeschen.tsx -- oeffnet nur eine E-Mail, keine Handlung im
    #                            Produkt.
    #   app/melden.tsx        -- die Fundstelle kommt aus Parametern oder wird
    #                            getippt; der Melder beschreibt selbst, worum
    #                            es geht.
    ERSATZ = re.compile(
        r"(?:jobTitle|job\?\.title|job\.title|title)\s*(?:\?\?|\|\|)\s*'([^']{3,})'")
    for rel, was in VERBINDLICH:
        datei = w / rel
        if not datei.is_file():
            print(f"ABBRUCH: {rel} nicht gefunden — falscher Pfad?")
            return 1
        inhalt = datei.read_text(encoding="utf-8")
        for nr, zeile in enumerate(inhalt.split("\n"), 1):
            if zeile.strip().startswith(("//", "*", "/*")):
                continue
            for m in ERSATZ.finditer(zeile):
                if m.group(1).strip().lower() in NEUTRAL:
                    continue
                fehler.append((
                    f"{rel}:{nr} Ersatztitel „{m.group(1)}\"",
                    f"Dieser Bildschirm {was}. Ein erfundener Vorgangsname "
                    "gehoert dort nicht hin: fehlen die Daten, muss er das "
                    "sagen und die Handlung sperren."))

    # Und: die beiden Bildschirme, die ihre Daten SELBST laden muessen. Ohne
    # das stehen Titel, Termin und Preis wieder auf URL-Parametern, die
    # fehlen koennen.
    for rel, ruf in [("app/stornierung.tsx", "getContractByIdFull("),
                     ("app/bewertung.tsx", "getContractByIdFull("),
                     ("app/betrieb/angebot-erstellen.tsx", "getJobById(")]:
        if ruf not in (w / rel).read_text(encoding="utf-8"):
            fehler.append((
                rel,
                f"Ruft {ruf.rstrip('(')} nicht mehr auf. Dann stehen die "
                "Angaben zum Vorgang wieder auf URL-Parametern."))

    # Die Vorteils-Kachel auf der Startseite gilt fuer BEIDE Wege.
    #
    # NACHTRAG 21.09.2026 (nachts): Am Nachmittag habe ich den Satz im Hero
    # korrigiert und die Kachel drei Bildschirmhoehen weiter oben uebersehen.
    # Dort stand unter einem Schild-Symbol „Gewerbeschein und Meisterbrief
    # geprueft" und darunter „Anbieter weisen ihren Gewerbeschein nach" --
    # als Aussage ueber ALLE Anbieter, obwohl auf dem Nachbarschaftsweg
    # niemand einen vorlegt. Dieselbe Fehlerklasse, dieselbe Datei, zwei
    # Bildschirmhoehen entfernt. § 5 UWG.
    landing = w / "app" / "landing.tsx"
    if not landing.is_file():
        print("ABBRUCH: app/landing.tsx nicht gefunden — falscher Pfad?")
        return 1
    landing_text = landing.read_text(encoding="utf-8")
    if "pruefungTitel(" not in landing_text or "pruefungSatz(" not in landing_text:
        fehler.append((
            "app/landing.tsx",
            "Die Pruefungs-Kachel haengt nicht mehr an lib/empfaengerText.ts. "
            "Ein fester Text dort gilt auch fuer den Nachbarschaftsweg."))
    for nr, zeile in enumerate(landing_text.split("\n"), 1):
        if zeile.strip().startswith(("//", "*", "/*", "{/*")):
            continue
        if re.search(r"Gewerbeschein und Meisterbrief\s+gepr(ü|ue)ft", zeile, re.I):
            fehler.append((
                f"app/landing.tsx:{nr} " + " ".join(zeile.split())[:70],
                "Steht wieder als Literal da und gilt damit auch fuer "
                "Nachbarschaftshilfe. Gehoert nach lib/empfaengerText.ts."))

    # Die Trefferliste mischt beide Wege.
    #
    # ANLASS (22.09.2026): `app/suche.tsx` listet Handwerksbetriebe und
    # Nachbarschaftshilfe gemeinsam (`kundenKategorien(FEATURES.NACHBARSCHAFT)`
    # nimmt die Nachbarschafts-Startkategorien ausdruecklich auf), waehlte
    # `is_nachbarschaft` aber gar nicht aus. Fuer den Kunden waren beide
    # Karten identisch -- bei verschiedenem Pruefumfang, verschiedener
    # Gebuehr und verschiedener Rechtslage.
    #
    # Ausserdem stand neben dem Namen ein goldener Haken, gebunden an
    # `stripe_onboarded` („Auszahlung eingerichtet"). Neben einem Namen liest
    # sich das als Guetesiegel, und eine Beschriftung trug er nicht. § 5 UWG,
    # dieselbe Klasse wie der Haken an „Haftpflicht" (14.09.2026).
    for rel in ("app/suche.tsx", "app/meine-anbieter.tsx"):
        datei = w / rel
        if not datei.is_file():
            print(f"ABBRUCH: {rel} nicht gefunden — falscher Pfad?")
            return 1
        inhalt = datei.read_text(encoding="utf-8")
        if "anbieterArt(" not in inhalt:
            fehler.append((
                rel,
                "Nennt die Sorte des Anbieters nicht mehr ueber "
                "lib/empfaengerText.ts. Dann sind Handwerksbetrieb und "
                "Nachbarschaftshilfe in der Liste nicht zu unterscheiden."))
        # Die blosse Zeichenkette genuegt NICHT: `is_nachbarschaft` steht in
        # beiden Dateien zweimal, einmal in der Spaltenliste und einmal beim
        # Abbilden der Zeile. Die Mutation „aus der Abfrage entfernt" blieb
        # damit gruen (gemessen am 22.09.2026) -- wieder eine Pruefung, die
        # den Fehler nicht sehen kann, den sie verhindern soll.
        # Geprueft wird deshalb die SPALTENLISTE selbst.
        spaltenlisten = [m for m in re.findall(r"'([^'\n]{20,400})'", inhalt)
                         if "business_name" in m]
        if not spaltenlisten:
            fehler.append((
                rel,
                "Keine Spaltenliste mit business_name gefunden. Abfrage "
                "umgebaut? Dann muss diese Pruefung mit umgebaut werden."))
        for liste in spaltenlisten:
            if "is_nachbarschaft" not in liste:
                fehler.append((
                    f"{rel}: {liste[:60]}…",
                    "Die Abfrage holt is_nachbarschaft nicht. Ohne das "
                    "Merkmal kann die Karte die Sorte gar nicht nennen."))

    # Ein Geld-Bildschirm darf keinen Auftrag ERFINDEN.
    #
    # ANLASS (21.09.2026): In app/stornierung.tsx stand
    # `const title = jobTitle ?? 'Heizungswartung'`. Der Bildschirm lud den
    # Vertrag gar nicht; fehlte der URL-Parameter, las der Nutzer
    # „Heizungswartung" und stornierte scheinbar etwas, das es nicht gibt.
    #
    # WARUM HIER UND NICHT IM BROWSER: geldwege-check.cjs prueft seit heute,
    # dass kein Geld-Bildschirm mit einer Null-Kennung ein GEWERK nennt. Die
    # Mutation „Platzhalter zurueck" blieb dort GRUEN -- „Heizungswartung"
    # steht in keiner Gewerke-Liste. Ein erfundener Titel ist im Browser
    # nicht von einem echten zu unterscheiden; im Quelltext schon, denn dort
    # ist er ein Rueckfall auf ein Literal.
    #
    # Geprueft wird deshalb die HERKUNFT: der Titel kommt aus dem geladenen
    # Vertrag, nicht aus einem Ersatzwert.
    storno = w / "app" / "stornierung.tsx"
    if not storno.is_file():
        print("ABBRUCH: app/stornierung.tsx nicht gefunden — falscher Pfad?")
        return 1
    storno_text = storno.read_text(encoding="utf-8")
    for nr, zeile in enumerate(storno_text.split("\n"), 1):
        if zeile.strip().startswith(("//", "*", "/*")):
            continue
        m = re.search(r"(jobTitle|job\?\.title)\s*\|\|\s*'([^']{4,})'"
                      r"|(jobTitle|job\?\.title)\s*\?\?\s*'([^']{4,})'", zeile)
        if m:
            ersatz = m.group(2) or m.group(4)
            fehler.append((
                f"app/stornierung.tsx:{nr} Ersatztitel „{ersatz}\"",
                "Faellt auf einen erfundenen Auftragstitel zurueck. Der Titel "
                "gehoert aus dem geladenen Vertrag; fehlt der, muss der "
                "Bildschirm das sagen statt etwas zu behaupten."))
    if "getContractByIdFull(" not in storno_text:
        fehler.append((
            "app/stornierung.tsx",
            "Laedt den Vertrag nicht mehr. Dann stehen Titel, Termin und "
            "Erstattung wieder auf URL-Parametern, die fehlen koennen."))

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

    # ── Abgeleitete Regel: harte Zeitzusagen ueber die EIGENE Bearbeitung ──
    #
    # ANLASS (15.09.2026): app/landing.tsx warb mit „24h / Verifizierung" und
    # app/anbieter-warteliste.tsx mit „innerhalb von 48 Stunden", waehrend
    # app/support-chat.tsx im selben Produkt sagt: „Ein festes Zeitversprechen
    # gibt es im Beta-Betrieb nicht." Geprueft wird von Hand, von einer Person.
    # Am 14.09. war dieselbe Klasse schon einmal aufgeraeumt worden (drei
    # verschiedene Reklamationsfristen, siehe constants/legal.ts) — sie kam an
    # anderer Stelle zurueck. Genau dafuer ist ein Skript da.
    #
    # Die Regel trifft NUR Zeitangaben neben einer Handlung von WERKANT
    # (melden, pruefen, antworten, verifizieren, freischalten). Fristen
    # zwischen Kunde und Betrieb (Storno: „Bis 48 Stunden vor dem Termin") und
    # die Auszahlungsfrist aus AGB §4(3) sind ausdruecklich nicht gemeint —
    # sie stehen in den AGB und werden dort zugesagt.
    #
    # Ausnahme: Zahlen, die aus constants/legal.ts kommen. Wer eine Frist
    # zusagen will, legt sie dort ab; dann steht sie an EINER Stelle.
    zeitspanne = r"\b\d{1,3}\s*(?:h\b|Stunden|Werktag\w*|Tage?n?\b|Minuten)"
    handlung = (r"melden\s+uns|melden\s+wir|pr(ü|ue)fen\s+wir|wir\s+pr(ü|ue)fen"
                r"|antworten\s+wir|Verifizierung|verifizieren|freischalt\w*"
                r"|R(ü|ue)ckmeldung|Antwortzeit|Bearbeitungszeit")
    zeitzusage = re.compile(
        r"(?:%s)[^.!?]{0,40}(?:%s)|(?:%s)[^.!?]{0,40}(?:%s)"
        % (handlung, zeitspanne, zeitspanne, handlung), re.I)

    for ordner in ("app", "components"):
        basis = w / ordner
        if not basis.is_dir():
            continue
        for datei in sorted(basis.rglob("*.tsx")):
            roh = datei.read_text(encoding="utf-8")
            # Aus der Konstante gespeiste Zahlen sind gewollt.
            if "REKLAMATION_FRIST_WERKTAGE" in roh:
                continue
            for zeile in sichtbarer_text_tsx(roh).split("\n"):
                m = zeitzusage.search(zeile)
                if m:
                    fehler.append((
                        f"{datei.relative_to(w)}: " + " ".join(m.group(0).split()),
                        "Harte Zeitzusage ueber die eigene Bearbeitung. Geprueft "
                        "wird von Hand, von einer Person; app/support-chat.tsx "
                        "sagt im selben Produkt, dass es im Beta-Betrieb kein "
                        "festes Zeitversprechen gibt. Eine Zusage, die man "
                        "bricht, ist schlechter als eine vorsichtige. Soll sie "
                        "bleiben, gehoert die Zahl nach constants/legal.ts."))

    # ── Abgeleitete Regel: „geprueft/verifiziert" ohne Gegenstand ─────────
    #
    # ANLASS (16.09.2026): In app/auftrag-detail.tsx stand „Gepruefte
    # Nachbarschaftshilfe fuer diese Aufgabe". Nachbarschaftshelfer sind
    # Privatpersonen ohne Gewerbeschein; geprueft wird bei ihnen nichts ausser
    # der Identitaet durch den Zahlungsdienstleister. Dieselbe Klasse wie
    # „Haftpflicht verifiziert", nur an einer Stelle, die keine der bisherigen
    # Regeln las.
    #
    # Was Werkant wirklich prueft, steht in lib/pruefung.ts: Gewerbeschein,
    # bei meisterpflichtigen Gewerken der Meisterbrief. Das sind Gegenstaende.
    # „Gepruefte Profis" ist keiner: es sagt nicht, was geprueft wurde.
    #
    # Zulaessig bleibt die Form MIT Gegenstand („geprueftem Gewerbeschein",
    # „geprueften Meisterbrief"). Sonst muesste man die wahre Aussage
    # umschreiben, um dem Pruefer zu gefallen.
    ohne_gegenstand = re.compile(
        r'\b(gepr(ü|ue)ft\w*|verifiziert\w*)\s+'
        r'(Profis?|Handwerker\w*|Betriebe\w*|Anbieter\w*|Alltagshelfer\w*|'
        r'Helfer\w*|Nachbarschaftshilfe|Nachbarn|Partner\w*)\b', re.I)
    #
    # GEMESSEN AM 16.09.2026: die erste Fassung las `sichtbarer_text_tsx`, und
    # der klebt Zeichenketten und Resttext zu EINEM Strom zusammen. Die
    # Ueberschrift „Gewerbeschein und Meisterbrief geprueft" und der Fliesstext
    # darunter („Anbieter weisen ihren Gewerbeschein nach") standen damit
    # nebeneinander, und der Ausdruck fand „geprueft Anbieter" ueber die Grenze
    # hinweg. Ein Fehlalarm aus dem eigenen Auszug — dieselbe Klasse wie die
    # acht Fehlalarme aus einem Leerzeichen am 08.09. Deshalb wird jede
    # Zeichenkette EINZELN geprueft und nie der zusammengefasste Strom.
    for ordner in ("app", "components"):
        basis = w / ordner
        if not basis.is_dir():
            continue
        for datei in sorted(basis.rglob("*.tsx")):
            ketten, rest = zeichenketten_und_resttext(datei.read_text(encoding="utf-8"))
            # Einmal je Fundstelle: dieselbe Zeile steht sonst zweimal da,
            # einmal als Zeichenkette und einmal im Resttext.
            gesehen: set = set()
            for _, stueck in ketten + rest:
                m = ohne_gegenstand.search(stueck)
                if m and " ".join(m.group(0).split()).lower() not in gesehen:
                    gesehen.add(" ".join(m.group(0).split()).lower())
                    fehler.append((
                        f"{datei.relative_to(w)}: „" + " ".join(m.group(0).split()) + "\"",
                        'Geprueft oder verifiziert ohne Gegenstand. Geprueft wird '
                        'der Gewerbeschein, bei meisterpflichtigen Gewerken der '
                        'Meisterbrief (lib/pruefung.ts). Nachbarschaftshelfer sind '
                        'Privatpersonen ohne Gewerbeschein. Den Gegenstand nennen, '
                        'etwa mit geprueftem Gewerbeschein, oder das Wort streichen.'))

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
