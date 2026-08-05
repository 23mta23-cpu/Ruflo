# Stripe-Connect-Onboarding — Architekturplan
*Stand 2026-08-05. Read-only-Analyse. Status: **ZURÜCKGESTELLT** (Founder-Entscheidung).*

> **Dieser Plan ist keine Freigabe.** Die Umsetzung ist ausgesetzt, bis die unter
> „Ausstehende Entscheidungen" genannten Punkte entschieden sind — insbesondere
> das Zahlungsmodell, das eine externe rechtliche Prüfung braucht.

---

## 1. Ausgangslage

`app/(provider)/onboarding-stripe.tsx` existiert seit Langem — als **Attrappe**.
Der Knopf ruft kein Backend, sondern zeigt einen Toast: „Stripe-Onboarding noch
nicht live". Es gibt keine Edge Function, kein `accounts.create`, keine Account
Links.

Seit PR #162 existiert `provider_profiles.stripe_account_id` samt Schreibschutz
im Trigger, aber **nichts füllt sie**. Der Auszahlungsweg ist damit vollständig
abgesichert und vollständig unerreichbar.

## 2. Bestätigte Abweichung Dokumentation ↔ Code

**Das implementierte Zahlungsmodell ist „Separate Charges and Transfers", nicht
„Destination Charges".**

Belege im Code:
- `create-payment-intent/index.ts` setzt weder `on_behalf_of` noch `transfer_data`
  → die Belastung läuft vollständig auf das Plattformkonto.
- `release-escrow/handler.ts` ruft `stripe.transfers.create(...)` als separaten,
  späteren Vorgang.

Gegenteilige Aussagen im Bestand — **beide sind falsch und müssen korrigiert
werden**:
- `docs/adr/0005-backend-api-spec.md:53` „Auszahlung: `destination charge` mit
  `application_fee_amount`"
- `docs/adr/0005-backend-api-spec.md:30` „`application_fee_amount` = Bruttopreis
  × 0,08 auf jedem PaymentIntent"
- `app/(provider)/onboarding-stripe.tsx:16-18` (Kommentar, gleiche Behauptung)

### Konsequenzen laut offizieller Stripe-Dokumentation

Bei separaten Charges und Transfers gilt:

| | Separate Charges & Transfers | Destination Charges |
|---|---|---|
| Settlement Merchant | **Plattform** | Plattform |
| Capability des verbundenen Kontos | `transfers` | `transfers` |
| `charges_enabled` nötig? | **nein** | nein |
| Erstattungen zu Lasten von | **Plattform** | Plattform |
| Rückbuchungen zu Lasten von | **Plattform** | Plattform |
| Negativsaldo zu Lasten von | **Plattform** | Plattform |
| Geld liegt vor der Auszahlung | **auf dem Plattform-Saldo** | Plattform-Saldo, sofort weitergeleitet |

Der praktische Unterschied für Werkant: Bei separaten Charges **hält Werkant das
Geld** zwischen Zahlung und Freigabe. Genau das ist das Escrow-Versprechen — und
genau das ist der aufsichtsrechtliche Kern.

## 3. Die ZAG-Begründung im Bestand trägt nicht

`docs/adr/0005-backend-api-spec.md:145` schreibt:

> „BaFin ZAG-Lizenz: Wenn WERKR selbst Gelder hält (eigenes Escrow), entsteht
> Lizenzpflicht. Stripe Connect (Destination Charges) umgeht dies, da Stripe der
> regulierte Zahlungsdienstleister ist."

**Diese Begründung ist für das implementierte Modell nicht anwendbar.** Sie setzt
Destination Charges voraus; implementiert sind separate Charges, bei denen das
Geld auf dem Plattform-Saldo liegt.

**Der Satz darf nicht als gültige rechtliche Freigabe dargestellt oder zitiert
werden.** Er ist eine Annahme über eine andere Architektur als die gebaute. Das
`zagGate.ts` blockiert Live-Zahlungen weiterhin korrekt, bis
`ZAG_LEGAL_SIGNOFF=confirmed` gesetzt ist; dieses Secret darf ohne schriftliche
anwaltliche Freigabe nicht gesetzt werden.

## 4. Empfohlene UI-Richtung (unverändert gültig)

**Stripe-hosted Onboarding über Account Links.** Kein selbst entwickeltes
API-KYC-Formular. Der Account Link wird im **Systembrowser** geöffnet, nicht in
einer eingebetteten WebView.

Fakten aus der aktuellen Stripe-Dokumentation, geprüft am 2026-08-05:

- `accounts.create` verwendet **Controller Properties**, nicht mehr den
  Legacy-Parameter `type`.
- Für separate Charges braucht das verbundene Konto die Capability **`transfers`**
  — **nicht** `card_payments`, **nicht** `charges_enabled`.
- Ein Account Link ist **einmalig verwendbar** und läuft **nach wenigen Minuten**
  ab. Erneutes Öffnen, Ablauf oder eine Link-Vorschau leiten auf `refresh_url`.
- **`return_url` beweist keinen Abschluss.** Stripe schreibt wörtlich, sie
  bedeute nur, dass der Ablauf „ordnungsgemäß betreten und verlassen" wurde —
  auch „Für später speichern" führt dorthin.
- Der Status ist ausschließlich über `accounts.retrieve` und
  `requirements.currently_due` / `eventually_due` festzustellen, ergänzt durch
  `account.updated`.

### Rückkehr-URLs müssen HTTPS sein

**`return_url` und `refresh_url` müssen über HTTPS laufen.** Ein
Custom-Scheme-Deep-Link wie `werkant://stripe-rueckkehr` ist als Stripe-Return-URL
**nicht** zu verwenden.

Vorgesehener Weg:
1. Stripe leitet auf eine **HTTPS-Rückkehrseite** (z. B. unter der GitHub-Pages-
   bzw. späteren Produktionsdomäne).
2. Diese Seite führt über **Universal Link (iOS)** bzw. **App Link (Android)**
   zurück in die App.
3. Als Rückfallebene ein kontrollierter Deep-Link-Knopf auf derselben Seite,
   falls der Universal Link nicht greift (z. B. Desktop-Browser).

Universal/App Links erfordern `apple-app-site-association` bzw. `assetlinks.json`
auf der Domäne — damit an die endgültige Produktionsdomäne gebunden, offener Punkt.

### Die Rückkehr beweist nichts

Der Rückkehr-Screen darf **keinen Erfolg behaupten**. Er ruft die Edge Function
im Modus „Status abfragen" auf; diese macht `accounts.retrieve` und liefert
`payouts_enabled`, `capabilities.transfers` und `requirements.currently_due`
zurück. Bei offenen Anforderungen wird ein neuer Account Link angeboten.

## 5. ENTSCHEIDUNG AUSSTEHEND

Alle folgenden Punkte sind **nicht entschieden** und dürfen nicht eigenmächtig
festgelegt werden:

- **Finales Zahlungsmodell** — Separate Charges and Transfers (Ist-Zustand)
  gegenüber Destination Charges. Bei Destination Charges flösse das Geld sofort
  an das verbundene Konto; das heutige Escrow-Versprechen wäre technisch ein
  anderes. **Braucht externe rechtliche Prüfung.**
- **Controller Properties** — `controller.fees.payer`,
  `controller.losses.payments`.
- **Gebührenverantwortung.**
- **Verlust- und Negativsaldoverantwortung.**
- **Dashboard-Art** — `controller.stripe_dashboard.type`. Stripe bezeichnet
  diesen Wert ausdrücklich als **unveränderlich**: einmal gesetzt, bleibt er für
  die Lebensdauer des Kontos. Optionen `express`, `none`, `full`.
- **Endgültige Capabilities** über `transfers` hinaus.
- **Rechtliche Freigabe** (ZAG, `ZAG_LEGAL_SIGNOFF`).
- **Produktionsdomäne** für Universal Links / App Links.

## 6. Betroffene Dateien bei späterer Umsetzung

| Datei | Änderung |
|---|---|
| `app/(provider)/onboarding-stripe.tsx` | Attrappe ersetzen; irreführenden Kommentar zu Destination Charges korrigieren |
| `app/_layout.tsx:30-47` | Deep-Link-Handler kennt nur `type=recovery`; Rückkehrpfad ergänzen |
| `package.json` | **`expo-web-browser` fehlt** und ist für den Systembrowser-Weg nötig |
| `app.json` | `scheme` ist bereits `werkant`; Universal-Link-/App-Link-Konfiguration ergänzen |
| `supabase/config.toml` | neue Function deklarieren, sonst wird sie nie deployt |
| `docs/adr/0005-backend-api-spec.md` | Widerspruch aus §2 und die ZAG-Aussage aus §3 korrigieren |
| `docs/security/access-control-matrix.md` | Zeile für die neue Function |
| `supabase/functions/release-escrow/handler.ts` | Verfeinerung: zusätzlich `capabilities.transfers === 'active'` prüfen (heute nur `payouts_enabled`) |

Neue Dateien: `supabase/functions/connect-onboarding/{index,handler}.ts`,
`supabase/tests/connect-onboarding_test.ts`, HTTPS-Rückkehrseite,
`app/(provider)/stripe-rueckkehr.tsx`.

## 7. Vorgesehener Ablauf

1. Anbieter tippt „Mit Stripe verbinden".
2. App ruft `POST /functions/v1/connect-onboarding` mit dem eigenen JWT.
   **Kein Body-Feld für eine Konto-ID** — die Identität kommt ausschliesslich aus
   dem JWT.
3. Function: Auth, Rate-Limit, ZAG-Gate. Dann `stripe_account_id` lesen.
4. Fehlt sie: **erst bei Stripe abgleichen** (`accounts.list` nach
   `metadata.user_id`), dann `accounts.create` mit
   `idempotencyKey = connect-acct-<user_id>` und `metadata.user_id`. Die ID wird
   **serverseitig** per `service_role` geschrieben; der Trigger aus 0650 sperrt
   jeden Client-Weg.
5. `account_links.create` mit `type: 'account_onboarding'` und den HTTPS-URLs aus
   §4. Die URL wird **nur zurückgegeben** — nie gespeichert, nie geloggt, nie
   per E-Mail versendet. Sie ist ein Zugangsschlüssel zu personenbezogenen Daten.
6. App öffnet sie im **Systembrowser**.
7. Stripe leitet nach Abschluss **oder nach „Für später speichern"** auf die
   HTTPS-Rückkehrseite, diese führt zurück in die App.
8. Der Rückkehr-Screen behauptet nichts, sondern fragt den Status serverseitig ab.
9. Bei offenen Anforderungen: neuer Account Link. Bei `refresh_url`: identisch,
   ohne Nutzerinteraktion.
10. Parallel pflegt `account.updated` den Cache `stripe_onboarded` — dieser Weg
    existiert bereits und spiegelt seit PR #161 in beide Richtungen.

## 8. Bekannte Risiken für die Umsetzung

- **Doppeltes Konto bei parallelen Anfragen.** Der Idempotency-Key auf
  `accounts.create` deckt 24 Stunden ab. Danach — oder wenn das Schreiben der ID
  scheitert — könnte ein zweites Konto entstehen. Dieselbe Fehlerklasse wie der
  P0 aus PR #162. Gegenmittel: Abgleich per `metadata.user_id` **vor** dem
  Erstellen; das kommt ohne Migration aus.
- **Konto ohne DB-Spur:** `accounts.create` gelingt, das Schreiben scheitert.
  Deshalb muss `metadata.user_id` gesetzt und der Abgleich vorgeschaltet sein.
- **Account Link als Zugangsschlüssel** — einmalig, wenige Minuten gültig, nicht
  persistieren, nicht loggen, auch nicht in Fehlermeldungen.
- **Rückkehr-URL als Erfolgsbeweis** wäre der klassische Fehler; ausgeschlossen
  durch Schritt 8.
- **Deep-Link-Kapern:** Ein anderes Programm kann `werkant://` registrieren. Da
  kein Geheimnis fliesst und der Status serverseitig geprüft wird, bleibt der
  Schaden begrenzt; Universal Links sind zusätzlich domänenverifiziert.

## 9. Testbarkeit

**Mit Doubles prüfbar:** erstes Onboarding · Wiederverwendung vorhandener
Konto-ID · parallele Anfragen mit gleichem Idempotency-Key · Fehlschlag von
`accounts.create`, ID-Schreiben, `account_links.create` und `accounts.retrieve`
(fail-closed) · Statusabfrage mit/ohne offene Anforderungen · fremder Nutzer ·
fehlender JWT · `account_id` im Body abgewiesen · Rate-Limit · Link nicht in DB
oder Log · ZAG-Gate bei `sk_live_`.

**Erst mit echtem Stripe-Testmodus beweisbar:** ob `accounts.create` mit den
gewählten Controller Properties durchgeht · ob Stripe bei gleichem
Idempotency-Key dasselbe Konto liefert · die tatsächliche Lebensdauer des Links ·
ob `account.updated` bei Abschluss und späterer Einschränkung so feuert wie
angenommen · ob der Systembrowser auf iOS und Android sauber zurückkommt · ob ein
Testkonto `payouts_enabled` und `capabilities.transfers = active` erreicht.

## 10. Nächster Schritt

Keiner — bis die Punkte aus §5 entschieden sind. Insbesondere das Zahlungsmodell
und die anwaltliche ZAG-Prüfung. Danach: `connect-onboarding` als Edge Function
nach dem Muster von `release-escrow`, dünnes `index.ts`, gesamte Logik in
`handler.ts`, zwei Modi (`start`, `status`).
