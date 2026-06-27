---
typ: spec
status: aktiv
---

# 🔒 Sicherheitsregeln (hart, nicht verhandelbar)

> Diese Regeln gelten für **jede** Code-Änderung. Bei Verstoß: Review blockt.

## Backend / Geld
- `stripe_onboarded` wird **nur** in der `stripe-webhook` Edge Function gesetzt — **nie** client-seitig.
- `contracts.status = 'completed'` **nur** in der `release-escrow` Edge Function — **nie** client-seitig.
- `service_role`-Client umgeht RLS → **nur** in Edge Functions, **nie** in Client-`lib/`-Dateien.
- Alle Geldbeträge in der DB in **Euro**; Edge Functions: `Math.round(feld * 100)` für Stripe-Cents.
- `stripe_sub_id` auf `pro_subscriptions` nur per Webhook (ADR-0004).
- PStTG-Felder (`pstg_tx_count`, `pstg_revenue`, `pstg_locked`) nur in `release-escrow` aktualisieren.

## UI / Design (siehe `DESIGN.md`)
- **Kein Emoji** in UI-Text oder Push-Notifications — nur Ionicons.
- `shadowColor: C.ink` (nie raw `'#000'`).
- `fontWeight` max `'700'` (nie `'800'`/`'900'`).
- `C.green` / `C.greenBg` sind **deprecated** in der App → `C.primary` / `C.primaryBg`.
  - (Im Prototyp `werkr-prototype.html` ist `C.green` lokal noch gültig — anderer Scope.)

## Verweise
- [[Fee-Modell]]
- ADR: `docs/adr/0004-security-and-consent-architecture.md`
- Audit-Befehl: `grep -rn "C\.green\b\|fontWeight.*['\"8][0-9][0-9]['\"']\|shadowColor:.*'#" app/ components/`
