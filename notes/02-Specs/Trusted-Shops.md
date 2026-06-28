---
typ: spec
status: vorbereitet
aktualisiert: 2026-06-27
---

# 🛡️ Trusted Shops — Plan & Integration

> Trusted Shops nimmt einen **Teil** des Rechtstext-Blockers ab — aber **nicht alles**.
> Ehrlich abgegrenzt, damit keine falsche Sicherheit entsteht.

## Was Trusted Shops abdeckt ✅
- **Rechtstexte** (anwaltlich gepflegt, auto-aktualisiert): AGB, Datenschutz, Widerruf, Impressum
  für **Standard-Fernabsatz**. Ersetzt für diese Texte den eigenen Anwalt.
- **Trustbadge** (Gütesiegel) — v. a. für die **Web**-Version.
- **Käuferschutz** (Buyer Protection) — Absicherung der Kundenzahlung bis zu einem Limit.
- **Bewertungen** (eTrusted) — Review-Sammlung.

## Was Trusted Shops NICHT abdeckt ❌ (bleibt separat)
- **ZAG / Escrow / BaFin** — die Treuhand-Zahlungs-Konstruktion. Das ist ein *strukturelles*
  Aufsichtsthema, kein Textbaustein. → eigener Anwalt (Bank-/Aufsichtsrecht).
- **GmbH/UG-Gründung**, Gewerbeanmeldung.
- **PStTG/DAC7** — BZSt-Registrierung & Meldung.
- **P2B-Verordnung** (Plattform ↔ Handwerker) — Standard-Shop-Texte decken das nur teilweise;
  prüfen, ob das gewählte TS-Paket Marktplatz/Plattform umfasst.
- **Marktplatz-Spezifika** generell — WERKR ist Vermittler, kein klassischer Shop. TS-Texte ggf. anpassen lassen.

## Vorbereitung im Code (erledigt 2026-06-27) ✅
- **`constants/legal.ts`** = einzige Quelle für Firmendaten + Trusted-Shops-Config.
  - Go-Live: Werte ausfüllen + `LEGAL_PLACEHOLDER = false` → Platzhalter-Banner verschwinden automatisch.
  - `TRUSTED_SHOPS = { enabled, tsId, buyerProtection, reviews }` — nichts lädt, solange `tsId` leer ist.
- Screens `impressum / agb / datenschutz / widerruf` lesen Firmendaten jetzt aus der Config
  (vorher in 4 Dateien verstreut + inkonsistent: „WERKR GmbH" vs. „WERKR Operations GmbH" → vereinheitlicht).
- TypeScript: 0 Fehler.

## Go-Live-Schritte (wenn TS-Account da ist)
1. Trusted-Shops-Vertrag + Paket wählen (auf **Marktplatz/Plattform** achten).
2. Generierte Rechtstexte in die `SECTIONS`-Arrays der Screens einsetzen (bzw. per Anwalt um ZAG/P2B ergänzen).
3. In `constants/legal.ts`: echte Firmendaten eintragen, `LEGAL_PLACEHOLDER = false`.
4. `TRUSTED_SHOPS.tsId` setzen, `enabled = true`; Trustbadge im **Web**-Build einbinden.
5. Käuferschutz nur aktivieren, wenn er **nicht** mit dem eigenen Escrow/WERKR-Schutz kollidiert
   (Doppel-Absicherung klären → siehe [[Fee-Modell]]).

## Verweise
- [[../01-Status/Go-Live-Blocker]] · [[Fee-Modell]] · [[Sicherheitsregeln]]
- Code: `constants/legal.ts`
