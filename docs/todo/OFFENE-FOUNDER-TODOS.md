# Offene Founder-TODOs (Platzhalter-Index, Stand 2026-07-19)

Nur Verweise — die eigentlichen Checklisten existieren bereits. KEINE
Implementation nötig, alles Founder-Klicks/Externes.

## Stripe (Zahlungsflow live schalten)
- Code ist fertig: `create-payment-intent`, `stripe-webhook` (Signatur-verifiziert),
  `release-escrow`, `list-payment-methods`, `(provider)/onboarding-stripe.tsx`.
- ☐ Stripe-Live-Keys als Edge-Function-Secrets setzen (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`) — Ablauf: `docs/release/LIVE_CUTOVER_RUNBOOK.md`.
- ☐ Webhook-Endpoint im Stripe-Dashboard auf die Live-Function zeigen lassen.
- ☐ Stripe Connect aktivieren (Auszahlungen/KYC Nachbarschafts-Helfer).

## App Store / Play Store
- Vollständige Checkliste: `docs/release/APP_STORE_PLAY_STORE_CHECKLIST.md`.
- ☐ EAS-Projekt anlegen (`docs/eas-setup.md`) — projectId-Platzhalter ersetzen.
- ☐ Screenshots aus echtem Build (6.7"/6.1"; Android Phone/Tablet).
- ☐ Privacy-Policy-URL im Store-Formular eintragen (GitHub-Pages `/datenschutz`).

## Gewerbe / Verifizierung
- Dokumenten-Checkliste + Prüf-Workflow: `docs/verification/REVIEW_WORKFLOW.md`
  (Gewerbeschein, Meisterbrief, Handwerksrolle-Gegencheck HWK Köln 0221 2022-0,
  §7b/§8 HwO-Ausnahmen, PAuswG-Kopierverbot).
- ☐ Concierge-Review-Routine einplanen (10–15 Min/Anbieter, bis ~50 Anbieter).

## Sonstige bekannte Blocker (aus SESSION_HANDOFF)
- ☐ `RESEND_API_KEY` als Edge-Function-Secret (E-Mail-Gate blockiert sonst Registrierung).
- ☐ Echte Impressum-Daten in `constants/legal.ts` (LEGAL_PLACEHOLDER).
- ☐ F6 P2B-AGB-Prüfung beim Anwalt.
