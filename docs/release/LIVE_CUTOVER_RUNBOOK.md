# WERKR — Live-Cutover-Runbook (escrow-loser Concierge-Start Köln)

_Stand: 2026-07-05. Quelle: CEO-Review S1/S4/S6 (`notes/04-Entscheidungen/CEO-Review-Live-Test-Plan.md`)._
_Verbindungsstand verifiziert: `lib/supabase.ts` nutzt das Prod-Projekt
`chnphpmpdpllnpqtvwhx.supabase.co` als Fallback; `static.yml` injiziert
`EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` aus GitHub-Secrets in den Web-Build._

## Reihenfolge (zwingend)

1. Backend verifizieren → 2. Smoke-Test → 3. Beta-Copy anpassen → 4. Anbieter onboarden → 5. Demand aktivieren.
**Kein Anbieter-Onboarding vor bestandenem Smoke-Test.**

## Schritt 1 — Backend-Verifikation (Tayyip, ~15 Min.)

- [ ] Supabase-Dashboard → SQL: Migrations-Stand prüfen. Alle Dateien aus
  `supabase/migrations/` (001…036) müssen eingespielt sein — insbesondere
  025 (rate_limits), 029 (accept_offer-IDOR-Fix), 032 (Track-Rating-Split).
  Schnelltest: `select count(*) from information_schema.tables where table_schema='public';`
- [ ] Auth → URL Configuration: `https://23mta23-cpu.github.io/Ruflo/` als
  Site-URL/Redirect (Passwort-Reset-Mails landen sonst ins Leere).
- [ ] Edge Functions deployed? Für den escrow-losen Start werden
  create-payment-intent/release-escrow NICHT gebraucht (zagGate bleibt zu);
  `waitlist-doi` optional (RESEND-Key fehlt weiterhin — bekannter P2).
- [ ] GitHub-Secrets `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  gesetzt (Settings → Secrets → Actions)? Falls nein: Fallback greift zwar,
  aber Secrets setzen ist der saubere Weg (Security-Regel 3).

## Schritt 2 — Smoke-Test gegen Prod (Tayyip + ein Zweitgerät, ~20 Min.)

Kompletter Durchstich mit ZWEI echten Accounts (Kunde + Test-Anbieter):

- [ ] Kunde registrieren (echte E-Mail) → Login klappt.
- [ ] Auftrag anlegen: Kategorie Garten, Kölner PLZ → erscheint unter „Aufträge".
- [ ] Test-Anbieter registrieren → KYC-Flow durchlaufen (Dummy-Gewerbeschein-Upload).
- [ ] Anbieter-Profil im Dashboard manuell auf verifiziert setzen (Supabase-Row).
- [ ] Angebot auf den Auftrag abgeben → Kunde sieht Angebot inkl. korrekter
  Gebührenaufschlüsselung (2,5 % / 8 %).
- [ ] Angebot annehmen → Vertrag entsteht (`contracts`-Row mit korrekten Fees).
- [ ] Chat zwischen beiden Accounts funktioniert.
- [ ] Danach: Testdaten löschen oder klar als Test benennen („TEST — bitte ignorieren").
- [ ] KPI-Queries funktionieren (Messgrundlage des Live-Tests):
  `select count(*) from jobs; select count(*) from offers; select count(*) from contracts;`

**Abbruchkriterium:** Schlägt ein Schritt fehl → NICHT onboarden, Fehler zuerst fixen.

## Schritt 3 — Beta-Copy-Anpassung (Code, 1 Commit — erst NACH bestandenem Smoke-Test)

- [ ] `app/landing.tsx` Beta-Hinweis: „Alle Zahlungen laufen im Stripe-Testmodus"
  ersetzen durch ehrliche Beschreibung des Concierge-Modells, z. B.:
  „Geschlossener Testbetrieb (Beta). WERKR ist reiner Vermittler; Vertrag und
  Bezahlung erfolgen direkt zwischen den Parteien."
- [ ] Gleicher Check in Onboarding/Home, falls der Testmodus-Satz dort auftaucht:
  `grep -rn "Testmodus" app/`
- [ ] `npx tsc --noEmit` + Jest + Push auf main → Deploy per Bundle-Marker
  verifizieren (`Testmodus` = 0 im Bundle).

## Schritt 4 — Anbieter-Onboarding (pro Betrieb, ~30 Min.)

- [ ] Verifizierungs-Checkliste aus `docs/vertrieb/Anbieter-Akquise-Koeln.md` §6.
- [ ] Dokumente NUR über den App-KYC-Upload (DSGVO — CEO-Review S3). Keine
  Gewerbescheine in WhatsApp-Verläufen.
- [ ] Provisionsregel aktiv kommunizieren: 8 % nur auf BEZAHLTE Aufträge (S2).
- [ ] Profil erst nach vollständiger Prüfung auf verifiziert/available setzen.

## Schritt 5 — Demand aktivieren (parallel zu Schritt 4, Akquise-Paket §10)

- [ ] 3 Seed-Aufträge aus persönlichem Umfeld einstellen (echte Aufgaben, echte Zahlung).
- [ ] 2 kostenlose Kanäle bespielen (Kleinanzeigen, Veedel-Gruppen).

## Concierge-Eskalation (Betrieb des Live-Tests)

| Ereignis | Reaktion |
|---|---|
| Auftrag 48 h ohne Angebot | Tayyip ruft passenden Anbieter direkt an, vermittelt telefonisch, Angebot wird in der App nachgezogen |
| Anbieter erscheint nicht | Kunde → Storno-Flow (`stornierung.tsx`); Ersatzanbieter anrufen; Vorfall in Gesprächsnotiz |
| Streit über Leistung | `reklamation.tsx`-Flow + persönliche Moderation; kein Schlichtungsversprechen abgeben |
| Kunde zahlt Betrieb nicht | Betriebsrisiko wie im Direktgeschäft; WERKR-Provision entfällt (S2); Kunde intern sperren |

## Rollback

- App: Revert-Commit auf main → static.yml deployt automatisch (~5–7 Min.).
- Marktplatz: Anbieter-Profile auf `available=false` → App zeigt ehrlichen Demo-Modus.
- Kommunikation: alle aktiven Parteien persönlich anrufen, bevor irgendetwas abgeschaltet wird.

## Explizit NICHT Teil dieses Cutovers

Escrow/Live-Stripe (zagGate bleibt zu bis ZAG-Freigabe) · Nachbarschaft
(Flag bleibt aus, Modell-D-Kriterien) · Store-Releases · RESEND-Mail
(nur Warteliste betroffen, nicht Köln-Kernpfad).
