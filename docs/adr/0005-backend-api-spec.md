# ADR-0005: Backend-API-Spezifikation (Stripe Connect, USt, DAC7, VIES)

**Status:** Vorgeschlagen  
**Datum:** 2026-06-12  
**Kontext:** Alle Kern-Monetarisierungsflows (Zahlungen, Rechnungsstellung, Steuerreporting) erfordern ein Backend. Dieses ADR spezifiziert die Mindest-API-Oberfläche, die vor dem echten Launch implementiert sein muss.

---

## Entscheidung

Das Backend wird als REST-API (Node.js/Express oder ähnlich) mit folgenden Endpunkten implementiert. Die App enthält bereits alle UI-Flows; die Backend-Integration erfolgt durch Ersetzen von Mock-Daten und lokalen AsyncStorage-Werten.

---

## Pflicht-Endpunkte (Launch-Blocker)

### 1. Stripe Connect Express — Anbieter-Onboarding

```
POST /api/stripe/connect/onboard
  Body: { providerId, isBusinessUser, vatId? }
  → { onboarding_url }     // Stripe Account Link (typ: account_onboarding)

GET /api/stripe/connect/status/:providerId
  → { charges_enabled, payouts_enabled, details_submitted }
```

**Implementierungsdetails:**
- `stripe.accounts.create({ type: 'express', country: 'DE', capabilities: { transfers: { requested: true } } })`
- `application_fee_amount` = Bruttopreis × 0,08 (8%) auf jedem PaymentIntent
- `transfer_group` = Auftrags-ID (Escrow-Nachvollziehbarkeit)
- Webhook: `account.updated` → Provider-Status in DB aktualisieren

### 2. Zahlungsabwicklung (Escrow)

```
POST /api/payments/create-intent
  Body: { orderId, grossAmount, providerId }
  → { client_secret }      // an App weitergeben für Stripe SDK

POST /api/payments/release/:orderId
  Body: { releasedBy: 'customer' | 'auto' }
  → { transfer_id, payout_date }

POST /api/payments/refund/:orderId
  Body: { reason }
  → { refund_id }
```

**Escrow-Logik:**
- PaymentIntent mit `capture_method: 'manual'` → Geld gesperrt, nicht abgebucht
- Nach Auftragsabschluss: `stripe.paymentIntents.capture()` → Überweisung an Provider
- Auszahlung: `destination charge` mit `application_fee_amount`

### 3. Umsatzsteuer-Aufspaltung

```
POST /api/invoices/generate
  Body: { orderId, isBusinessUser, vatId?, grossAmount }
  → { invoiceUrl, invoiceNumber, vatAmount, reverseCharge }
```

**USt-Logik (implementiert in `app/rechnung.tsx`, muss Backend spiegeln):**
- B2B (`isBusinessUser=true`): Reverse Charge §13b UStG → 0% USt auf Gebühr; Hinweis auf Rechnung
- C2C (`isBusinessUser=false`): 19% USt auf Plattformgebühr (8% × 1,19); §3a UStG
- USt-IdNr. Validierung via VIES API (EU): `GET /api/vat/validate?vatId=DE123456789`

### 4. VIES USt-IdNr. Validierung

```
GET /api/vat/validate
  Query: { vatId }          // Format: DE + 9 Ziffern
  → { valid, name?, address? }
```

- Weiterleitung an: `http://ec.europa.eu/taxation_customs/vies/services/checkVatService` (SOAP)
- Ergebnis cachen (24h) — VIES hat Rate-Limits
- Bei ungültigem Format: `400 Bad Request` vor VIES-Aufruf

### 5. DAC7 / PStTG Reporting

```
GET /api/tax/dac7/summary/:providerId/:year
  → { totalRevenue, totalTransactions, platformFees, reportable: boolean }

POST /api/tax/dac7/report
  Body: { year, providerIds? }   // null = alle meldepflichtigen
  → { reportId, submittedAt, bzstReference }
```

**Meldeschwellen (§13 PStTG):**
- ≥ 30 Transaktionen ODER ≥ € 2.000 Jahresumsatz → BZSt-Meldung
- Frist: 31. Januar des Folgejahres
- Aktuell in `steuer.tsx` hardcoded → durch diesen Endpunkt ersetzen

### 6. Datenlöschung (DSGVO Art. 17)

```
DELETE /api/users/:userId
  Header: Authorization: Bearer <token>
  → 204 No Content

  Ablauf:
  1. Stripe Connect Account deaktivieren (stripe.accounts.del)
  2. Alle personenbezogenen Daten überschreiben (Name → "Gelöschter Nutzer")
  3. Transaktionsdaten für 10 Jahre aufbewahren (§147 AO, §257 HGB)
  4. Consent-Log aufbewahren (Art. 5 Abs. 2 DSGVO — Rechenschaftspflicht)
  5. Antwort mit Löschungsprotokoll-ID
```

---

## Nicht-funktionale Anforderungen

| Anforderung | Spezifikation |
|---|---|
| Authentifizierung | JWT (RS256), 15min Access + 7d Refresh |
| Datenbankschema | `users`, `orders`, `transactions`, `consent_log`, `service_categories` |
| `service_categories` Tabelle | spiegelt `data/categories.ts` — App lädt Kategorien via `GET /api/categories` |
| Webhook-Signatur | `stripe.webhooks.constructEvent` mit `STRIPE_WEBHOOK_SECRET` |
| Logging | Jede Zahlung mit `orderId`, `amount`, `fee`, `vatAmount`, `timestamp` |
| Staging | Stripe Test-Mode bis Launch; echte BZSt-Meldungen erst ab Produktion |

---

## Abhängigkeiten dieser ADR

- ADR-0004: Security & Consent (Art. 17-Ablauf, Consent-Log)
- ADR-0002: Revenue Model (8%-Gebühr als `application_fee_amount`)
- `data/categories.ts`: Wird Datenbankquelle — App-Config und DB müssen synchron bleiben

---

## Konsequenzen

**Positiv:**
- Klare Schnittstelle zwischen App und Backend — kein Re-Design nötig
- Echtes Geld ab Tag 1 (Stripe Connect bereits in UI vorbereitet)
- DAC7-Compliance automatisierbar sobald echte Transaktionsdaten vorliegen

**Risiken / Offene Punkte:**
- BaFin ZAG-Lizenz: Wenn WERKR selbst Gelder hält (eigenes Escrow), entsteht Lizenzpflicht. Stripe Connect (Destination Charges) umgeht dies, da Stripe der regulierte Zahlungsdienstleister ist.
- Stripe-Gebühren fressen Marge: 1,5% + 0,25€ je Transaktion (DE Karten) → effektive Nettomarge auf 8%: ~6,5%
- Meisterpflichtgewerke (Elektro, Sanitär, Heizung) erfordern zwingend Meisterbrief-Verifikation vor erstem Auftrag — serverseitig zu prüfen
