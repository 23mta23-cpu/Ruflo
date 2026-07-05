# WERKR Analytics — Event-Katalog (Launch-Basis)

_Stand: 2026-07-05. Implementierung: `lib/analytics.ts` (`trackEvent`, `trackError`)._

## Architektur

- **Consent-gated:** Events werden nur erfasst, wenn der Nutzer im DSGVO-Consent
  (`werkr_consent_v1.analytics`) zugestimmt hat; der Einstellungs-Toggle
  (`werkr_prefs_v1.analytics`) überschreibt in beide Richtungen. Default: **aus**.
- **Kein externer Dienst angebunden.** Events landen in einem lokalen
  AsyncStorage-Ringpuffer (`werkr_events_v1`, max. 200) und im Dev-Log.
  Einziger Anschlusspunkt für PostHog/Plausible/Supabase-Events ist
  `flushSink()` in `lib/analytics.ts` — die Aufrufstellen bleiben unverändert.
- **Keine PII:** Props enthalten nur technische Werte (Kategorie-Id, Track,
  Fehler-Kontext, Zählwerte). Niemals Namen, E-Mail, PLZ, Freitext, User-Ids.
- Fire-and-forget: `trackEvent` wird nie awaited und kann die App nie stören.

## Events

| Event | Ort (Datei) | Props | Bedeutung |
|---|---|---|---|
| `app_open` | `app/_layout.tsx` | — | App-/Web-Session gestartet |
| `landing_view` | `app/landing.tsx` | — | Landing gesehen |
| `onboarding_started` | `app/onboarding.tsx` | — | Rollenwahl gesehen |
| `onboarding_completed` | `app/onboarding.tsx` | `role` | Rolle gewählt |
| `login_started` | `app/login.tsx` | — | Login abgeschickt |
| `login_completed` | `app/login.tsx` | `role` | Login erfolgreich |
| `home_view` | `app/(tabs)/index.tsx` | — | Home gesehen |
| `job_wizard_started` | `app/auftrag-aufgeben.tsx` | `track` | Wizard geöffnet (handwerker/nachbarschaft) |
| `job_category_selected` | `app/auftrag-aufgeben.tsx` | `category`, `track` | Kategorie-Kachel gewählt |
| `job_submitted` | `app/auftrag-aufgeben.tsx` | `category` | Handwerker-Auftrag angelegt |
| `nachbarschaft_started` | `app/nachbarschaft.tsx` | — | Nachbarschafts-Browse geöffnet |
| `nachbarschaft_job_submitted` | `app/auftrag-aufgeben.tsx` | `category` | Nachbarschafts-Auftrag angelegt |
| `provider_profile_view` | `app/anbieter.tsx` | — | Handwerker-Profil gesehen |
| `helper_profile_view` | `app/nachbarschaft-profil.tsx` | — | Helfer-Profil gesehen |
| `offer_viewed` | `app/auftrag-detail.tsx` | `count` | Angebote im Auftrag gesehen |
| `offer_accepted` | `app/auftrag-detail.tsx` | `track` | Angebot angenommen |
| `contract_created` | `app/auftrag-detail.tsx` | `track` | Vertrag entstanden |
| `payment_started` | `app/zahlung.tsx` | — | Zahlungsversuch gestartet |
| `payment_failed` | `app/zahlung.tsx` | — | Zahlung fehlgeschlagen/abgelehnt |
| `payment_completed` | `app/zahlung.tsx` | — | Zahlung erfolgreich |
| `fallback_shown` | `app/auftrag-detail.tsx` | — | Nachbarschafts-Fallback angezeigt |
| `error_occurred` | mehrere (`trackError`) | `context` | Fehler an zentraler Stelle (`login`, `job_submit`, `offer_accept`, `reviews_load_all`) |

## Funnel-Auswertung nach Launch

Kern-Funnel Kunde: `landing_view → onboarding_completed → home_view →
job_wizard_started → job_category_selected → job_submitted → offer_viewed →
offer_accepted → contract_created → payment_completed`.

Nachbarschafts-Validierung (Modell D): `fallback_shown` vs.
`nachbarschaft_started` vs. `nachbarschaft_job_submitted` — misst, ob der
bedarfsgetriebene Einstieg genutzt wird.

## Anschluss eines echten Providers (To-do nach Launch-Entscheidung)

1. Provider wählen (PostHog EU-Hosting oder Supabase-Tabelle `analytics_events`).
2. In `flushSink()` den HTTP-Versand ergänzen (batched, fire-and-forget).
3. Consent-Logik bleibt unverändert davor geschaltet.
4. Retention/Löschkonzept in `datenschutz.tsx` ergänzen, bevor extern gesendet wird.
