#!/usr/bin/env python3
"""Prüft, dass die Oberfläche durchgehend siezt.

ANLASS (15.08.2026): Der Kundenbereich siezte durchgehend, der Anbieterbereich
mischte — 10 Duz- gegen 11 Siez-Stellen. Am deutlichsten am selben Feld auf zwei
benachbarten Screens:

    app/betrieb/profil-bearbeiten.tsx   "Beschreiben Sie kurz Ihre Leistungen …"
    app/betrieb/profil.tsx              "Beschreibe deine Dienstleistungen …"

Das ist Drift, keine Strategie. Wer beim Wechsel zwischen zwei Bildschirmen
plötzlich anders angesprochen wird, merkt das — und es liest sich unfertig.

ENTSCHEIDUNG (von mir getroffen, umkehrbar): durchgehend SIE in der App.
Begründung: der Kundenbereich war bereits vollständig Sie; die Marke ist auf
Vertrauen und Handwerk positioniert; und das Vertriebs-Playbook
(docs/sales/koeln-akquise-startpaket.md) reserviert das Du bereits ausdrücklich
für die informellen Kanäle (WhatsApp) und siezt in der E-Mail. Das Du hat also
einen Platz, nur nicht im Produkt.

Soll das Produkt duzen, ist das eine Founder-Entscheidung: dann ERWARTET_SIE
hier auf False setzen und die Texte einmal umziehen.

WAS DIESER PRÜFER KANN — UND WAS NICHT (16.08.2026, nach drei Fehlschlägen):

Er fängt Rückfälle bei BEKANNTEN Formen. Er kann NICHT beweisen, dass keine
Duz-Stelle mehr existiert. Der Grund ist der Du-Imperativ: er trägt kein
Pronomen, und die Sie-Form ist dieselbe Wurzel plus Endung
(„Kündige per E-Mail" / „Kündigen Sie per E-Mail"). Unterscheidbar ist das nur
an der Verbform, und deutsche Verben lassen sich nicht sinnvoll aufzählen.

Eine morphologische Regel wurde versucht und gemessen: „satzanfängliches Wort
auf -e, nicht gefolgt von Sie" ergab **443 Treffer, nahezu alle Fehlalarme**
(„Meine Aufträge", „Keine Nachrichten", „Alle anzeigen"). Unbrauchbar — und
ein Prüfer mit Fehlalarmen wird beim ersten Mal abgeschaltet und nie wieder
eingeschaltet.

Deshalb eine gepflegte Liste. Sie ist per Konstruktion unvollständig. Wer beim
Lesen eine neue Form findet, trägt sie unten ein — das ist der vorgesehene
Weg, kein Versagen. Bisher so gefunden: „Bitte versuche", „Schreib die erste",
„Kündige per E-Mail".

Ausführen:  python3 scripts/anrede-check.py
Exit 0 = keine BEKANNTE Abweichung, Exit 1 = Abweichung gefunden.
"""
import re
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ERWARTET_SIE = True

# Bewusst konservativ: nur Formen, die sich nicht anders lesen lassen.
# "Sie" am Satzanfang bleibt mehrdeutig (sie = Plural), deshalb zählt für die
# Siez-Seite vor allem der Possessivbegleiter.
DUZ = re.compile(r'\b(?:Du|Dein|Deine[nmrs]?|Dir|Dich|dein|deine[nmrs]?|dich|dir)\b(?!\s+(?:ich|wir))')

# LÜCKE 3 (16.08.2026): Der Du-Imperativ trägt gar kein Pronomen.
# „Bitte versuche es erneut" wurde deshalb von DUZ nicht gesehen — viermal in
# app/angebot.tsx und app/auftrag-detail.tsx. Die Sie-Form dieser Sätze lautet
# „Bitte versuchen Sie es erneut"; unterscheidbar ist beides nur an der
# Verbform. Deshalb hier die Verben, die in dieser Oberfläche als Aufforderung
# an den Nutzer wirklich vorkommen — kein Versuch, deutsche Morphologie
# allgemein zu lösen, sondern eine Liste, die beim Auftauchen neuer Fälle
# wächst.
DUZ_IMPERATIV = re.compile(
    r'\b(?:[Vv]ersuche|[Ww]ende|[Vv]erbessere|[Gg]ib|[Ww][äa]hle|[Pp]r[üu]fe|[Ss]chreibe'
    r'|[Tt]rage|[Ll]ade|[Nn]utze|[Bb]eachte|[Mm]elde|[Ss]chau|[Kk]licke|[Tt]ippe'
    r'|[Aa]chte|[Ss]ende|[Bb]est[äa]tige|[Ee]rg[äa]nze|[Ee]rz[äa]hle|[Kk]ontaktiere'
    # Nachtrag 16.08.2026, beim Umstellen der Postfaecher gelesen:
    # „Kündige per E-Mail an …" in app/betrieb/pro.tsx. Dazu die Verben, die in
    # einem Marktplatz fuer Auftraege sonst noch als Aufforderung vorkommen.
    r'|[Kk][üu]ndige|[Ss]torniere|[Bb]uche|[Bb]eauftrage|[Aa]ntworte|[Bb]ewerte'
    r'|[Vv]ereinbare|[Ll]oesche|[Ll][öo]sche|[Aa]ktualisiere|[Ww]iderrufe)\b(?!\s+(?:ich|wir))'
)

# Nachtrag 16.08.2026: der Du-Imperativ kommt auch OHNE -e vor.
# Gefunden beim Lesen von app/chat.tsx: "Noch keine Nachrichten. Schreib die
# erste!" -- die -e-Liste oben sieht das nicht. Diese Formen muessen exakt
# stehen (\b an beiden Enden), sonst schlaegt "schreiben Sie" mit an: die
# Sie-Form ist genau dieselbe Wurzel plus Endung.
# Bewusst NICHT in dieser Liste: wähl, tipp, prüf, lad, stell, füg, sag.
# Der erste Entwurf hatte sie drin und meldete prompt fünf Fehlalarme —
# „die Wahl treffen Sie", „Tipp: Zuerst kostenlos anmelden",
# `lower.includes('prüf')`. Das sind Substantive und Code, keine Anrede.
# Ein Prüfer mit Fehlalarmen wird beim ersten Mal abgeschaltet und nie wieder
# eingeschaltet; lieber eine Form übersehen als das.
DUZ_IMPERATIV_KURZ = re.compile(
    r'\b(?:[Ss]chreib|[Gg]ib|[Nn]imm|[Kk]omm|[Mm]ach|[Ll]ass'
    r'|[Gg]eh|[Rr]uf|[Nn]utz|[Kk]lick|[Tt]rag|[Mm]eld)\b(?!\s+(?:ich|wir))'
)

# Fachbegriffe und Zitate, in denen "dein/dich" nicht die Nutzeransprache ist.
#
# „Hiermit widerrufe ich …" ist KEIN Duzen, sondern der gesetzlich
# vorgeschriebene Wortlaut des Muster-Widerrufsformulars (Anlage 2 zu
# Art. 246a §1 Abs. 2 EGBGB). Er steht in der ERSTEN Person und darf nicht
# umgeschrieben werden — ein Prüfer, der ihn anmahnt, verlangt einen
# Rechtsverstoß. Das Lookahead auf „ich/wir" fängt ihn bereits; der Eintrag
# hier steht zusätzlich da, damit der Grund dokumentiert bleibt.
AUSNAHMEN = re.compile(r'Deinstall|deiktisch|Hiermit widerrufe')

# LÜCKE 6 (16.08.2026): `lib` fehlte, und gesucht wurde nur in `*.tsx`.
# Nutzertexte stehen aber auch in .ts-Modulen — `lib/messages.ts` enthielt vier
# Duz-Stellen, darunter die Meldung, die einem gesperrten Anbieter angezeigt
# wird. Der Prüfer meldete trotzdem 0, weil er dort nie hingesehen hat.
VERZEICHNISSE = ['app', 'components', 'lib', 'contexts']
DATEIMUSTER = ['*.tsx', '*.ts']


# LÜCKE 1: JSX-Textknoten stehen NICHT in Anführungszeichen.
#   <Text style={styles.heroLabel}>Dein Fokus heute</Text>
# Der ursprüngliche Prüfer sah ausschließlich Zeichenketten in Quotes und war
# damit für den häufigsten Fall sichtbaren Textes blind. Sechs der zehn am
# 16.08.2026 gefundenen Duz-Stellen standen genau so.


def nutzertexte(pfad: pathlib.Path):
    """Sichtbarer Text — Zeichenketten UND JSX-Textknoten, ohne Kommentare."""
    for nr, zeile in enumerate(pfad.read_text().split('\n'), 1):
        blank = zeile.strip()
        if blank.startswith('//') or blank.startswith('*') or blank.startswith('/*'):
            continue

        gefunden = []
        # LÜCKE 2: die Mindestlänge 10 hat placeholder="Dein Name" (9 Zeichen)
        # durchgelassen. Ein Platzhalter ist sichtbarer Text wie jeder andere.
        # Jetzt 4 — kurz genug für "Dein Name", lang genug, um Bezeichner und
        # Klassennamen draußen zu lassen.
        gefunden += re.findall(r"""['"`]([^'"`]{4,})['"`]""", zeile)

        # LÜCKE 1 + 4: sichtbarer JSX-Text steht NICHT in Anführungszeichen,
        # und bei langen Sätzen auch nicht zwischen ">" und "<" derselben
        # Zeile:
        #     <Text style={styles.warnText}>
        #       Du kannst vorübergehend keine neuen Angebote abgeben.
        #     </Text>
        # Dazu kommen Zeilen, die Prosa und eingebettete Ausdrücke mischen:
        #     Mehrere Kunden waren unzufrieden ({dash?.badReviewCount} …).
        #     Wir prüfen deinen Fall. Status: <Text …>Offen</Text>.
        #
        # Statt drei Sonderfällen deshalb EIN Verfahren: Ausdrücke in
        # geschweiften und Elemente in spitzen Klammern herausnehmen — was
        # übrig bleibt, ist genau das, was der Nutzer liest.
        rest = re.sub(r'\{[^{}]*\}', ' ', zeile)
        rest = re.sub(r'<[^<>]*>', ' ', rest)
        gefunden.append(rest)

        for treffer in gefunden:
            treffer = treffer.strip()
            # Nur Fließtext: mindestens ein Leerzeichen und echte Wörter.
            if ' ' in treffer and re.search(r'[A-Za-zÄÖÜäöüß]{3}', treffer):
                yield nr, treffer


def main() -> int:
    # Dieselbe Zeile wird zwangsläufig mehrfach gefunden (einmal als
    # Zeichenkette, einmal als Resttext). Gemeldet wird pro Fundstelle EINMAL,
    # mit dem kürzesten Treffer — das ist der reine Nutzertext ohne
    # umgebenden Code.
    je_stelle: dict[tuple[str, int], str] = {}
    for verzeichnis in VERZEICHNISSE:
        dateien = sorted(
            f for muster in DATEIMUSTER for f in (WURZEL / verzeichnis).rglob(muster)
        )
        for f in dateien:
            for nr, text in nutzertexte(f):
                if AUSNAHMEN.search(text):
                    continue
                if ERWARTET_SIE and (DUZ.search(text) or DUZ_IMPERATIV.search(text)
                                     or DUZ_IMPERATIV_KURZ.search(text)):
                    stelle = (str(f.relative_to(WURZEL)), nr)
                    if stelle not in je_stelle or len(text) < len(je_stelle[stelle]):
                        je_stelle[stelle] = text

    abweichungen = [(d, n, t[:78]) for (d, n), t in sorted(je_stelle.items())]

    form = 'Sie' if ERWARTET_SIE else 'Du'
    print(f'Erwartete Anrede: {form}. {len(abweichungen)} Abweichung(en).')
    if not abweichungen:
        print('\nDie Oberflaeche spricht Nutzer einheitlich an.')
        return 0
    print('\nABWEICHUNGEN:')
    for datei, nr, text in abweichungen:
        print(f'  {datei}:{nr}  {text}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
