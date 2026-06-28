---
typ: entscheidung
datum: 2026-06-27
status: angenommen
---

# Entscheidung: Rechtsform = UG (haftungsbeschränkt)

## Kontext
WERKR braucht eine haftungsbeschränkte Rechtsform für Marktplatz + Zahlungen.
Wahl stand zwischen GmbH (25.000 € Stammkapital) und UG (ab 1 €).

## Entscheidung
**UG (haftungsbeschränkt)** — geringeres Startkapital, schnellerer Start.
Firma-Platzhalter im Code: **„WERKR UG (haftungsbeschränkt)"** (endgültiger Name wird bei Gründung final festgelegt).

## Rechtlich relevant (§5a GmbHG) — bitte beachten
- **Namenspflicht:** Die Firma MUSS „UG (haftungsbeschränkt)" **voll ausgeschrieben** führen —
  nicht auf „UG" kürzen, „(haftungsbeschränkt)" darf nicht weggelassen werden. Sonst persönliche Haftung.
- **Thesaurierungspflicht:** 25 % des Jahresüberschusses müssen als gesetzliche Rücklage einbehalten
  werden, bis 25.000 € erreicht sind (dann optionaler Wechsel zur GmbH).
- **Nur Bareinlage:** Sachgründung ist bei der UG ausgeschlossen.
- **Realistisches Stammkapital:** Trotz 1-€-Minimum für ein Zahlungs-/Treuhandgeschäft höher ansetzen
  (Seriosität ggü. Stripe/Banken/Partnern, Vermeidung sofortiger Überschuldung).
- **„i. Gr."** (in Gründung): bis zur Handelsregister-Eintragung in Geschäftspost führen
  (im Code via `IN_FOUNDING`-Flag automatisch).

## Konsequenzen im Code (erledigt 2026-06-27)
- `constants/legal.ts`: `name = 'WERKR UG (haftungsbeschränkt)'`, `legalForm`, neues `IN_FOUNDING`-Flag
  (steuert den „i. Gr."-Zusatz automatisch).
- Alle Stellen (Impressum, AGB, Datenschutz, Widerruf, **Rechnung**, **DSGVO-Consent**) ziehen aus der Config.
- Frühere Inkonsistenz „WERKR GmbH" / „WERKR Operations GmbH" entfernt.
- TypeScript: 0 Fehler.

## Go-Live
Nach Eintragung: in `constants/legal.ts` echte Daten + `IN_FOUNDING = false` + `LEGAL_PLACEHOLDER = false`.

## Verweise
- [[../01-Status/Go-Live-Blocker]] · [[../02-Specs/Trusted-Shops]]
- Code: `constants/legal.ts`
