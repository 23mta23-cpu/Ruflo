# WERKR — Standing Security Rules

_Stand: 2026-07-05. Normative Quelle: Abschnitt „Standing Security Rules" in
`AGENTS.md` (gilt für jede Session). Diese Datei macht die Regeln im
Security-Ordner auffindbar und ergänzt den Verifikationsstand._

## Die fünf Regeln (verbindlich für jeden neuen Endpoint)

1. **Rate Limiting** — jede public Edge Function ruft `enforceRateLimit` aus
   `supabase/functions/_shared/rateLimit.ts` (per-User und per-IP, graceful
   429 mit `Retry-After`). Limits pro Endpoint: `access-control-matrix.md`.
2. **Strikte Input-Validierung** — Bodies über
   `supabase/functions/_shared/validate.ts`: unerwartete Top-Level-Felder
   ablehnen, Typ/Format (UUID, Stringlänge) auf jedem Feld prüfen, BEVOR
   Datenbank oder Stripe berührt werden.
3. **Secrets** — niemals Secret Keys (Stripe secret, service_role, Admin-
   Secrets) client-seitig oder im Quellcode; nur Supabase Edge Function
   Secrets / EAS Secrets. Publishable/Anon-Keys nur aus Env-Config
   (`.env.example` dokumentiert alle Variablen).
4. **Access Control** — neue Tabellen/Spalten brauchen explizite RLS-Policy
   (deny by default); neue Edge Functions expliziten Auth-Check (User-JWT
   oder Admin-Secret) plus Ownership-Check. Neue Zeile in
   `access-control-matrix.md` im selben PR.
5. **OWASP-Baseline** — jeden neuen Endpoint gegen die OWASP Top 10 prüfen,
   bevor er als fertig gilt.

## Verifikationsstand (Release-Candidate-Prüfung 2026-07-05)

| Funktion | Rate Limit | Input-Validierung | Auth/Ownership |
|---|---|---|---|
| cancel-contract | ✓ | ✓ (validate.ts) | ✓ |
| create-payment-intent | ✓ | ✓ | ✓ + zagGate |
| delete-account | ✓ | JWT-basiert, kein Body-Schema nötig | ✓ (nur self) |
| list-payment-methods | ✓ | JWT-basiert, kein Body-Schema nötig | ✓ (nur eigener Stripe-Customer) |
| pstg-annual-report | ✓ (vor Secret-Check) | Admin-Secret-Header | ✓ |
| release-escrow | ✓ | ✓ | ✓ + zagGate |
| send-push | ✓ | ✓ | ✓ (gemeinsamer Job/Vertrag) |
| stripe-webhook | Signaturprüfung statt RL (Stripe-Standard) | Webhook-Signatur | service_role intern |
| waitlist-doi | ✓ | ✓ | öffentlich by design (Double-Opt-in) |

**Payment-Gates:** Live-Zahlungsabwicklung bleibt hinter `zagGate`
(`_shared/zagGate.ts`, `ZAG_LEGAL_SIGNOFF`-Secret) bis zur anwaltlichen
Freigabe — kein Client-Pfad umgeht das Gate.

**Client:** Keine hartkodierten Secrets im Repo; `EXPO_PUBLIC_*`-Variablen
sind publishable-only (RLS-enforced). Analytics (`lib/analytics.ts`) ist
consent-gated und PII-frei.

## Bekannte, bewusst offene Punkte

- `waitlist-doi` liefert bei fehlendem `RESEND_API_KEY` HTTP 200 und loggt
  serverseitig — der Nutzer erhält dann keine DOI-Mail. Operativer Blocker
  (Key setzen), kein Sicherheitsloch; Verhalten dokumentiert in
  `docs/release/APP_STORE_PLAY_STORE_CHECKLIST.md`.
