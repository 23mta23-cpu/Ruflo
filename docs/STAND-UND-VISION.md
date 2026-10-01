# Werkant — Vision und Positionierung

*Kern geschrieben 30.07.2026, am 01.10.2026 auf das Dauerhafte gekürzt.*
Der technische Stand und die offenen Punkte stehen in `docs/SESSION_HANDOFF.md`
(kurz, immer aktuell), die Aufgaben des Founders in
`docs/founder/MEINE-AUFGABEN-PLATZHALTER.md`.

## 1. Was Werkant ist

Ein Marktplatz, der private Auftraggeber und geprüfte Handwerksbetriebe
zusammenbringt — mit einem Zahlungsweg, bei dem **niemand in Vorleistung gehen
muss**. Der Kunde zahlt bei der Beauftragung ein, das Geld liegt treuhänderisch
bei Stripe, und der Betrieb bekommt es erst nach Abschluss.

Das ist die ganze Idee, und sie richtet sich gegen zwei konkrete Missstände:

- **Lead-Portale** (MyHammer, Blauarbeit) verkaufen Kontakte im Voraus. Der
  Handwerker zahlt, bevor er weiß, ob etwas daraus wird. Werkant nimmt 8 %
  ausschliesslich bei einem **abgeschlossenen und bezahlten** Auftrag,
  mindestens 3 €. Kein Auftrag heißt keine Kosten. Keine Grundgebühr, keine
  Laufzeit.
- **Rechnungen hinterherlaufen.** Der Kunde hat vorab eingezahlt; die
  Auszahlung ist eine Freigabe, kein Mahnprozess.

### Positionierung (Founder-Korrektur 03.07.)
Werkant ist **keine Kleinauftrags-Nische**. B2C *und* B2B, vom kleinen
Reparaturauftrag bis zum größeren Gewerk. Die frühe Engführung auf
„Kleinaufträge" war ein Missverständnis und ist ausdrücklich verworfen.

### Marke
„Werkant" (final, Rebrand von WERKR). Logo „Das Treffen"
(`docs/brand/das-treffen-*.svg`), Siegel „Werkant-geprüft". **Naming-Recherche
nicht wiederholen.** Design: Variante C — Grün bleibt, Bone-Creme-Hintergrund,
kein reines Weiß. Rebrand-Vorschläge wurden mehrfach geprüft und abgelehnt
(`notes/04-Entscheidungen/Kein-Rebrand-*`, `Design-Variante-C-entschieden.md`).

### Zwei Tracks
| | Handwerk | Nachbarschaft |
|---|---|---|
| Wer | Betriebe, Gewerbeschein Pflicht | Privatpersonen |
| Gewerke | 13 aktive B2B-Gewerke, davon **10 meisterpflichtig** | 7 Startkategorien (Modell D) |
| Gebühr Anbieter | 8 %, min. 3 € | 0 % — Helfer bekommt 100 % |
| Gebühr Kunde | 2,5 %, min. 1,50 € | 1,99 € Werkant-Schutz |
| Nachweise | Gewerbeschein, bei Meisterpflicht Meisterbrief | kein Papier, 18+-Selbstauskunft, Identität via Stripe |

Der Nachbarschafts-Track ist **live** (Founder-Anweisung 06.07.,
`Nachbarschaft-Live-Schaltung.md`) — die Einfrierung vom 03.07. ist überholt.
Harte Gates bleiben: Meisterpflicht-Ausschluss, B2B-Ausschluss, getrennte
Ratings, Track-Trennung in der DB (Migration 0480). **DRV-/Steuerklärung bleibt
Pflicht vor echtem Geldfluss** im NB-Track.

Ausdrücklich **eingefroren**: `PRO_ABO` (CFO-Entscheid 27.07. — Platzierung ist
ein Nullsummenspiel, der Lead-Pool ist fix, und die AGB schliessen bezahlte
Platzierung aus). Kein Kaufweg, Code bleibt als toter Pfad.

### Markteintritt
Operativ Köln und Leverkusen, Dichte vor Fläche. Der Städte-Gate im Code ist
bewusst **offen** (`isActiveCity()` lässt jede Stadt durch, `ACTIVE_CITIES`
bleibt für spätere Dichte-Steuerung stehen). Der Pitch ist Ehrlichkeit: es gibt
keine Nutzerbasis, und niemand behauptet eine. Das Angebot an Betriebe lautet
„Gründungspartner werden, 0 € Risiko, weil ohne Auftrag keine Gebühr".

---

## 2. Reifegrad in einem Satz
Alles ist gegen lokales Postgres, Unit-Tests und Browser-Prüfungen
abgesichert, aber **kein vollständiger Vorgang ist je von einem Menschen
durchlaufen worden**: kein echter Auftrag, keine echte Zahlung, keine echte
Auszahlung. Das ist die Aussage für jedes Gespräch mit Betrieben, Partnern
oder Investoren.
