---
typ: spec
status: aktiv
---

# 💶 Fee-Modell — Zwei Tracks

> Single Source of Truth: `lib/feeEngine.ts` (`calcFees()`). Diese Notiz erklärt das *Warum*.

Pro Auftrag gilt **genau ein** Track — **nie beide gleichzeitig**.

| Track | Kunde zahlt | Anbieter zahlt |
|---|---|---|
| **Handwerker** (professionell) | 2,5 % Service-Gebühr (mind. €1,50) | 8 % Provision (mind. €3,00) |
| **Nachbarschaft** (kleine Jobs) | €1,99 WERKR-Schutz (pauschal) | 0 % |

## Warum zwei Modelle?
- **Handwerker:** Auftragswerte hoch (€100–500+). Prozentual fair, Minimum schützt vor Mini-Aufträgen.
- **Nachbarschaft:** Werte niedrig (€15–50). 2,5 % wären < €1 → könnten den Schutz nicht finanzieren. Pauschale €1,99 statt Prozent.

## Wichtig
- Kein Doppelabzug — €1,99 **ersetzt** die Prozent-Gebühr bei Nachbarschaft.
- Alle DB-Beträge in **Euro**. Edge Functions rechnen `Math.round(x * 100)` für Stripe (Cents).
- Track-Erkennung: `job.track === 'nachbarschaft'` (nicht `category`).

## Verweise
- [[Sicherheitsregeln]]
- ADR: `docs/adr/0002-revenue-model.md`
