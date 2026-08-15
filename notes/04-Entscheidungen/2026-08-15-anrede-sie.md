# Anrede in der App: durchgehend „Sie"

**Datum:** 2026-08-15 · **Entschieden von:** Claude (CTO-Rolle) · **Umkehrbar:** ja

## Anlass

Die App sprach Nutzer uneinheitlich an. Am deutlichsten am **selben Feld auf
zwei benachbarten Screens**:

| Datei | Text |
|---|---|
| `app/betrieb/profil-bearbeiten.tsx:163` | „Beschreiben **Sie** kurz **Ihre** Leistungen …" |
| `app/betrieb/profil.tsx:356` | „Beschreib**e dein**e Dienstleistungen …" |

Gemessen: Kundenbereich 0 Duz- / 4 Siez-Stellen (einheitlich), Anbieterbereich
10 Duz- / 11 Siez-Stellen (Münzwurf). Dazu 11 weitere Duz-Stellen in
gemeinsamen Screens — darunter **die erste Nachricht nach der Registrierung**
(„Wir haben dir eine Bestätigungs-E-Mail geschickt"), während der gesamte
Registrierungsablauf davor siezt.

Das ist Drift, keine Strategie: eine bewusste Entscheidung wäre nicht innerhalb
desselben Bereichs zufällig verteilt.

## Entscheidung

**Durchgehend „Sie" in der gesamten Produktoberfläche.** 24 Stellen umgeschrieben.

## Begründung

1. Der Kundenbereich war bereits vollständig Sie — die kleinere Änderung.
2. Die Marke ist auf Vertrauen und geprüftes Handwerk positioniert
   („Werkant-geprüft", Escrow, Verifizierung). Siezen trägt das.
3. Das Du hat bereits einen dokumentierten Platz, nur nicht im Produkt:
   `docs/sales/koeln-akquise-startpaket.md` nutzt ausdrücklich die Du-Form für
   die WhatsApp-Erstansprache und die Sie-Form für die E-Mail-Vorlage. Diese
   Trennung nach Kanal bleibt unberührt.

## Wenn der Founder duzen will

Das ist seine Entscheidung, nicht meine. Der Weg dahin:

1. `ERWARTET_SIE = False` in `scripts/anrede-check.py`
2. `python3 scripts/anrede-check.py` listet dann alle Siez-Stellen auf
3. Texte einmal umziehen, CI hält es danach stabil

Der Aufwand ist symmetrisch — die Richtung ist umkehrbar, die Uneinheitlichkeit
war es nicht.

## Absicherung

`scripts/anrede-check.py` läuft in CI. Mutationsprobe: eine Duz-Stelle wieder
eingebaut → Exit 1 mit Datei, Zeile und Text; entfernt → Exit 0.
