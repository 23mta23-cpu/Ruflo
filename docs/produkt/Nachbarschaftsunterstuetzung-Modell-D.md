---
typ: entscheidung
datum: 2026-07-04
status: verbindlich
entscheider: Founder (Tayyip) — Modell D akzeptiert nach kritischer Prüfung
---

# Nachbarschaftsunterstützung — Modell D: bedarfsgetriebener Fallback

## Founder-Entscheidung

Nachbarschaftsunterstützung ist und bleibt Teil der WERKR-Vision. Sie wird **nicht**
als zweiter sichtbarer Marktplatz neben dem Handwerker-Track geführt, sondern als
**bedarfsgetriebener Fallback innerhalb desselben Auftrags-Trichters**. Diese Notiz
ist die verbindliche Grundlage für alle künftigen Sessions zu diesem Thema —
Modell A (zwei gleichwertige sichtbare Tracks) ist damit ausdrücklich **nicht**
die gewählte Integration.

## Warum Nachbarschaft nicht verworfen ist

- Die technische und rechtliche Substanz ist bereits vorhanden und durchdacht:
  eigene Fee-Logik (`lib/feeEngine.ts`), eigenes DB-Schema mit Track-Spalte
  (`jobs`/`contracts`), **bereits getrennte Rating-Aggregation**
  (`032_review_rating_aggregation.sql`: `rating_avg_handwerker` /
  `rating_avg_nachbarschaft`, nie geblendet), B2B-Ausschluss aus
  Scheinselbständigkeits-Gründen (`014_b2b_customer_fields.sql`), vollständiges
  Helfer-Onboarding mit Altersgate 18+ und freier Preiswahl (`onboarding-kyc.tsx`),
  konsistente Rechtstexte (`agb.tsx`, `garantie.tsx`).
- Das war kein schwacher Entwurf, der verworfen wurde — er wurde **eingefroren**,
  weil er gleichzeitig mit dem Handwerker-Track lief, nicht weil das Konzept
  fehlerhaft war (`notes/04-Entscheidungen/Fokus-Schnitt-MVP.md`).
- Handwerker-Aufträge sind hochpreisig, aber selten; Nachbarschaftsaufgaben sind
  niedrigpreisig, aber potenziell häufig — echtes Ergänzungspotenzial für
  Nutzungsfrequenz, wenn die Vermischung der Vertrauenssignale vermieden wird.

## Warum nicht sofort sichtbar als zweiter Track

`docs/premortem_werkr.md` benennt als **Todesursache 1** die Marken-/
Liquiditäts-Kollision: Ein Meisterbetrieb mit €5.000-Aufträgen sieht in derselben
App Studenten für €12/Std. — der professionelle, wirtschaftlich tragende Teil des
Geschäfts verliert zuerst Vertrauen, während der margenschwache Teil den Cash-Burn
nicht auffangen kann. Zusätzlich: Die Handwerker-Anbieter-Akquise beginnt gerade
erst real (0 verifizierte Anbieter, 0 echte Transaktionen, Akquise-Paket
`docs/vertrieb/Anbieter-Akquise-Koeln.md` gerade erst erstellt). Jede sofort
sichtbare zweite Marktplatz-Ebene würde zwei parallele Cold Starts gleichzeitig
finanzieren — genau das Muster, das WERKR bereits einmal in die Fokus-Schnitt-
Korrektur gezwungen hat.

## Modell D: bedarfsgetriebener Fallback

Ein Auftrags-Trichter, zwei Erfüllungswege. Kunde stellt eine Anfrage wie heute
(`auftrag-aufgeben.tsx`, unverändert). Nur für Aufträge in geeigneten Kategorien
(siehe unten) und nur wenn der professionelle Weg innerhalb einer definierten
Frist kein akzeptiertes Angebot liefert, erscheint **im Auftrags-Detail** —
nicht auf der Startseite, nicht als eigener Suchreiter — ein klar abgesetzter
Hinweis auf die Nachbarschaftsoption. Handwerker und Kunde begegnen dem Konzept
nie im selben Blickfeld; die bereits vorhandene getrennte Rating-Anzeige
(Migration 032) macht das technisch trivial.

Helfer-Onboarding bleibt der bestehende 2-Schritt-Flow, aber der Einstiegspunkt
ist keine öffentliche Track-Umschaltung, sondern gezielte Ansprache erst nach
nachgewiesenem Bedarf (siehe Stufenplan).

## Startkategorien

**Zuerst:** Umzugshilfe, Einkaufshilfe, Garten — physisch, niedrige
Haftungsschwelle, keine Berufszulassung, kein Kontakt zu vulnerablen Gruppen.

**Bewusst zurückgestellt:** Kinderbetreuung, Seniorenbegleitung, Babysitting —
höhere Sicherheits-/Background-Check-Anforderungen; erst nach etablierten
Trust-Mechanismen erneut bewerten.

## Klare Grenzen zu professionellem Handwerk

- Alle §1-HwO-Anlage-A-Gewerke (Elektro, Sanitär/Heizung u. a.) sind **nie** Teil
  des Nachbarschafts-Fallbacks — hartes rechtliches Gate, bereits als
  Meisterpflicht-Liste in `onboarding-kyc.tsx` kodiert.
- Nachbarschaftshilfe bleibt privaten Accounts vorbehalten (Scheinselbständigkeits-
  Risiko bei B2B, bereits umgesetzt in `014_b2b_customer_fields.sql` und in der
  Registrierungs-Copy verankert).
- Rating-, Fee- und Badge-Logik bleiben strikt getrennt (Meister-verifiziert vs.
  Nachbar-verifiziert) — nie in einem gemeinsamen Score dargestellt.

## Rechtliche und steuerliche Prüfbedarfe (extern, keine Scheinsicherheit)

- **Freiwillige DRV-Statusfeststellung** für die Helferrolle
  (Scheinselbständigkeit) — bereits als Wiederauftau-Kriterium in
  `constants/features.ts` benannt; muss vor Skalierung eingeleitet, nicht nur
  erwähnt sein.
- **PStTG/DAC7-Meldemechanik:** Schwellenwerte sind technisch kodiert
  (`lib/pstTg.ts`, 30 Aufträge / €2.000/Jahr), der tatsächliche Melde-/
  Abgabeprozess an die Finanzbehörde braucht steuerliche Prüfung vor echtem
  Geldfluss.
- **§22 Nr. 3 EStG Freigrenze (€256/Jahr):** aktueller Rechtsstand, nicht
  dauerhaft als korrekt annehmen — vor Skalierung erneut prüfen.
- **ZAG/Escrow-Freigabe:** identischer Blocker wie im Handwerker-Track
  (`zagGate`), gilt hier genauso, keine Live-Zahlungsabwicklung ohne
  anwaltliche Freigabe.

## Go-/Pause-/Pivot-Kriterien

- **Go (Stufe 2):** ≥5 dokumentierte Bedarfslücken (Auftrag ohne akzeptiertes
  Angebot in Startkategorien) innerhalb von 4 Wochen laufendem
  Handwerker-Betrieb.
- **Pause:** Handwerker-Anbieter äußern in Akquise-Gesprächsnotizen Vorbehalte
  gegen eine „Gig-Plattform"-Assoziation → Fallback vorerst nur kundenseitig
  sichtbar halten, Handwerker-Kommunikation unverändert lassen.
- **Pivot/Stopp:** Erste Testaufträge im Nachbarschafts-Fallback führen zu
  Streitfällen, Beschwerden oder Reputationsrisiko → sofort zurück auf
  eingefroren, DRV-Klärung nachholen, bevor erneut gestartet wird.

## Stufe-1-Instrumentierung als nächster technischer Schritt

Nächster (noch nicht beauftragter) Implementierungsschritt: ein Read-only-Report
auf Basis der bestehenden `jobs`/`offers`-Tabellen, der für die Startkategorien
(Umzugshilfe, Einkaufshilfe, Garten) Aufträge identifiziert, die seit Erstellung
länger als 48 Stunden ohne akzeptiertes Angebot sind — ohne neue UI, ohne
Feature-Flag-Änderung, ohne Sichtbarkeit für Endnutzer. Erst wenn dieser Report
über mehrere Wochen echte Lücken zeigt, wird Stufe 2 (gezielte Helfer-Akquise +
sichtbarer Fallback für eine enge Testkohorte) beauftragt.

## Hinweis: Feature Flags bleiben unverändert

`constants/features.ts` bleibt unverändert: `NACHBARSCHAFT: false`,
`PRO_ABO: false`. Modell D ändert nichts an den bestehenden Wiederauftau-
Kriterien (≥50 echte bezahlte Handwerker-Aufträge UND eingeleitete
DRV-Statusfeststellung) — es beschreibt lediglich, **wie** die Integration
aussehen wird, wenn diese Kriterien erfüllt sind. Diese Notiz ist keine
Freigabe zur Code- oder Flag-Änderung.

## Referenzen

- Vollständige Analyse: Entscheidungsbericht Modell-A/B/C/D-Vergleich (Session
  2026-07-04, siehe Chat-Historie — Kurzfassung hier verbindlich dokumentiert).
- `notes/04-Entscheidungen/Fokus-Schnitt-MVP.md` — ursprüngliche Einfrierung.
- `docs/premortem_werkr.md` — Todesursache-1-Analyse (Marken-/Trust-Kollision).
- `docs/adr/0002-revenue-model.md` — Nachbarschafts-Monetarisierungsteil dort
  als überholt markiert, diese Notiz ist die aktuelle Quelle.
- `notes/02-Specs/Fee-Modell.md` — aktuelles Fee-Modell (Single Source of Truth:
  `lib/feeEngine.ts`).
