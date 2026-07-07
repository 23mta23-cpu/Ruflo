---
typ: entscheidung
datum: 2026-07-07
status: verbindlich (CTO-Entscheidung im Arbeitsmodus; Founder kann überstimmen)
entscheider: Claude (per Founder-Anweisung „wähl selbst eine sinnvolle Option und notier sie")
---

# Marke: Symbol „Das Treffen" (Runde 3) — Siegelform nur noch als Prüf-Badge

> **Revision 07.07. (Runde 3):** Founder-Veto gegen das W-Siegel-Monogramm
> („nur ein W und ein Siegel — schau Apple, Google, Spotify, Airbnb").
> Neue verbindliche Bildmarke: **„Das Treffen"** — zwei Häuser Seite an Seite,
> deren Schnittmenge selbst ein kleines Haus bildet (Mint gefüllt).
> Bedeutungs-Stapelung nach dem Airbnb-Bélo-Prinzip: Nachbarschaft + Zuhause
> (Ort fast jeder Dienstleistung) + Begegnung zweier Seiten + der von Werkant
> fair geregelte Raum dazwischen. Tätigkeitsneutral — trägt Handwerk,
> Nachbarschaft, Dolmetschen, Transporte, Bau gleichermaßen.
> Assets: `docs/brand/das-treffen-logo.svg`, `docs/brand/das-treffen-icon.svg`.
> Siegelring mit Umlaufschrift bleibt ausschließlich als
> „Werkant-geprüft"-Badge erhalten. Der Rest dieser Notiz (Runde 2) ist
> Historie; die OCR-Entscheidung unten gilt unverändert.

# [Historie, Runde 2] Marke: Siegel-System statt Werkzeug-Metaphorik

## Kontext

Founder-Brief 07.07.: Die Marke muss über Handwerk + Nachbarschaft hinaus
tragen — künftig z. B. Dolmetschen, Krankentransport, Autotransport,
Einkaufshilfe, Gartenpflege, Poolreinigung, Hausbau. Zeitlos, vertrauensbildend,
erkennbar („man weiß, wer wir sind").

## Entscheidung

1. **Bildmarke = Siegel** (Ring + W-Monogramm): Das universelle Zeichen für
   „geprüft und geregelt" — funktioniert für jede Dienstleistung, weil es
   nicht die Tätigkeit zeigt, sondern unser Versprechen (fair geregelt,
   digitaler Vertrag, geprüfte Anbieter). Zeitlos (Siegel sind Jahrhunderte
   alt), skaliert bis 16 px, eine Farbe reicht.
2. **Verworfen:** Werkzeug-Richtungen „Gehrung" und „Anriss" (Logo-Runde 1) —
   handwerklich schön, aber zu eng für die Service-Breite. Konserviert im
   Logo-Artifact als Runde 1.
3. **System:** Hauptlogo = Wortmarke + Siegel-Monogramm · App-Icon =
   Siegel-Monogramm auf Hero-Grün · Produkt-Badge „geprüft" = Siegel mit
   Umlaufschrift (bestehende Richtung C, beibehalten).
4. Name bleibt „Werkant" vorbehaltlich DPMA/EUIPO-Check; bei Namenswechsel
   bleibt das komplette Siegel-System, nur Wortzug + Monogramm-Buchstabe
   ändern sich.

## OCR im Verifizierungs-Workflow — bewusst NICHT eingebaut

Founder-Frage 07.07.: „Hast du auch ein OCR reincodiert?" — Nein, Entscheidung:

- OCR liest Text, **prüft aber keine Echtheit**: ein gefälschter Meisterbrief
  besteht jede OCR. Der belastbare Check ist der Abgleich mit der
  Handwerksrolle (HWK-Anruf) bzw. die Sichtprüfung — beides im
  Review-Workflow dokumentiert (docs/verification/REVIEW_WORKFLOW.md).
- Bei 0–50 Anbietern spart OCR Sekunden und kostet Komplexität, Geld und
  erzeugt falsche Sicherheit.
- **Trigger für Automatisierung (Phase 2):** >10 Einreichungen/Woche ODER
  Review-Rückstau >48 h → dann Stripe Identity (Identität/Alter, ~1,50 €/
  Check) + OCR-Vorprüfung (Name/Gewerk-Extraktion als Review-Assistenz,
  nicht als Entscheidung).
