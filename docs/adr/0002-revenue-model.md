# ADR-0002: Revenue Model

**Status:** Accepted  
**Date:** 2026-06-11

> **⚠️ Punkt 3 (Nachbarschaftshilfe-Monetarisierung) ist überholt, Stand 2026-07-04.**
> Das hier beschriebene Free-Tier-/€9-Abo-Modell für Nachbarschaftshilfe wurde nie
> implementiert und widerspricht dem tatsächlich umgesetzten Fee-Modell: eine
> pauschale €1,99-„WERKR-Schutz"-Gebühr pro Auftrag, Helfer erhält 100 % (Single
> Source of Truth: `lib/feeEngine.ts`, erklärt in `notes/02-Specs/Fee-Modell.md`).
> Aktueller Produkt- und Integrationsrahmen für Nachbarschaft:
> `docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md`. Punkte 1 (8 % Handwerker-
> Provision) und 2 (Provider Pro, hinter `PRO_ABO`-Flag eingefroren) bleiben
> unverändert gültig. Dieser Hinweis dokumentiert die Korrektur, ohne die
> ursprüngliche Entscheidung zu löschen — siehe Historie unten.

## Decision
1. **8% Transaktionsgebühr** on every completed job (deducted from Escrow payout)
2. **Provider Pro €29/month**: Featured placement in search, analytics dashboard, priority support badge
3. **Nachbarschaftshilfe Free Tier**: Up to 5 jobs/month free, then €9/month

## Rationale
- 8% is below Airbnb (14%) and Fiverr (20%) — competitive differentiation
- Flat subscription eliminates per-job anxiety for active providers (Stammkunden retention)
- Free tier reduces onboarding friction for neighbors / casual helpers

## Profitability checkpoint
- Break-even: ~€50k GMV/month at 8% = €4k platform revenue
- Provider Pro 100 subscribers = €2,900/month
- Target: €100k GMV/month by month 12
