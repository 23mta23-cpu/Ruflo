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

### Entscheidung: Automatische Erstattung bei Betrugs-Frühwarnung
Der Mechanismus ist gebaut (Migration 0640, `stripe-webhook`), aber **aus**.
Scharf geschaltet wird er mit einem einzigen Edge-Function-Secret:

    STRIPE_AUTO_REFUND_ON_FRAUD_WARNING = true

**Was dafür spricht:** Meldet das Kartennetz eine Frühwarnung
(`radar.early_fraud_warning.created`), folgt daraus meist ein Chargeback. Wer
vorher von sich aus erstattet, verhindert ihn vollständig — keine Dispute-Fee
(~15 €) und, wichtiger, kein Zähler auf der Rückbuchungsquote. Stripe nimmt die
ab 0,75 % zum Anlass für Reserven oder eine Kontosperrung. An einem 300-€-Auftrag
kostet ein verlorener Fall rund 296 €, also etwa zwölf profitable Aufträge.

**Was dagegen spricht:** Eine Frühwarnung ist eine Wahrscheinlichkeitsaussage,
keine Feststellung. Bei einem Fehlalarm storniert die Automatik einem ehrlichen
Kunden unaufgefordert den Auftrag und entzieht dem Anbieter die Arbeit — eine
Geldbewegung ohne menschliche Prüfung.

**Solange das Secret fehlt**, wird jede Frühwarnung nur protokolliert
(Fehler-Ebene, mit Betrag und der Angabe, ob schon an den Anbieter ausgezahlt
wurde) und auf dem Vertrag als `fraud_warning_action = 'offen'` vermerkt. Die
Erstattung von Hand im Stripe-Dashboard wendet den Chargeback genauso ab —
sie muss nur jemand auslösen.

**Empfehlung:** in der Anfangszeit AUS lassen und die Fälle von Hand ansehen;
bei mehr als ein, zwei Fällen pro Woche einschalten.

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

## Social-Login (Apple / Google) freischalten
- Code ist fertig (19.07.): `lib/auth.ts` `signInWithProvider`, Login-Buttons,
  Fehler-/Abbruch-Handling, Redirect-Rückkehr. Web-Flow aktiv, Native kommt
  mit EAS-Build (SIWA-Capability).
- ☐ Supabase Dashboard → Authentication → Providers → **Google**: OAuth-Client
  in der Google Cloud Console anlegen (Web-Client, Authorized redirect URI =
  `https://chnphpmpdpllnpqtvwhx.supabase.co/auth/v1/callback`), Client-ID +
  Secret eintragen.
- ☐ Dito **Apple**: Apple-Developer-Konto nötig (Services ID, Key, Team-ID) —
  ohne Konto Button vorerst so lassen (zeigt saubere Fehlermeldung).
- ☐ Supabase → Authentication → URL Configuration: Web-App-URL(s) als
  zulässige Redirect-URLs eintragen (GitHub-Pages-Domain).

## Sonstige bekannte Blocker (aus SESSION_HANDOFF)
- ☐ `RESEND_API_KEY` als Edge-Function-Secret (E-Mail-Gate blockiert sonst Registrierung).
- ☐ Echte Impressum-Daten in `constants/legal.ts` (LEGAL_PLACEHOLDER).
- ☐ F6 P2B-AGB-Prüfung beim Anwalt.
