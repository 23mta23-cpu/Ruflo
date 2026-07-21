# Meine Founder-Aufgaben — Platzhalter zum Ausfüllen

> Alles hier kann NUR der Founder erledigen (externe Konten, echte Firmendaten,
> Secrets). Der Code ist fertig. Trage die echten Werte ein und hake ab.
> Reihenfolge = Priorität. Punkt 1 ist der harte Launch-Blocker.

---

## 1. RESEND_API_KEY — HARTER BLOCKER (5 Min)  ☐
Ohne diesen Key kann NIEMAND seine E-Mail bestätigen → keine Aufträge, keine Angebote.

- [ ] Bei https://resend.com Konto anlegen, Domain `werkant.de` verifizieren
- [ ] API-Key erzeugen → hier eintragen: `RESEND_API_KEY = ______________________`
- [ ] Supabase → Project Settings → Edge Functions → Secrets → Key eintragen
- [ ] Test: in der App registrieren → Bestätigungsmail muss ankommen

## 2. Firmendaten / Impressum  ☐
Trage die echten Werte ein; danach in `constants/legal.ts` übernehmen und dort
`LEGAL_PLACEHOLDER = false` setzen (sagt mir Bescheid, ich mach das Eintragen).

- Firmenname (voll): `Werkant UG (haftungsbeschränkt)` — bestätigt? ☐  sonst: ____________
- Straße + Nr.:       `________________________`
- PLZ + Ort:          `________________________`
- Vertretungsberechtigt (Geschäftsführer): `________________________`
- Registergericht + HRB-Nr. (nach Eintragung): `________________________`
- USt-IdNr. (falls vorhanden): `________________________`
- Kontakt-E-Mail (Impressum): `________________________`
- Kontakt-Telefon: `________________________`
- In Gründung? (noch nicht im Handelsregister) → JA / NEIN

## 3. Stripe — Zahlungsflow live  ☐
Code fertig (`create-payment-intent`, `stripe-webhook`, `release-escrow`).

- [ ] Stripe-Konto verifizieren, Connect aktivieren (Auszahlungen an Anbieter)
- [ ] `STRIPE_SECRET_KEY = sk_live_______________________`
- [ ] `STRIPE_WEBHOOK_SECRET = whsec_______________________`
- [ ] Beide als Supabase Edge-Function-Secrets setzen
- [ ] Webhook-Endpoint im Stripe-Dashboard auf die Live-Function zeigen lassen
- Ablauf im Detail: `docs/release/LIVE_CUTOVER_RUNBOOK.md`

## 4. Geschäftskonto (für die UG)  ☐
- [ ] Business-Bankkonto eröffnen (z. B. für Stripe-Auszahlungen)
- IBAN: `________________________`
- Bank: `________________________`

## 5. Gewerbe / Behörden  ☐
- [ ] UG beim Notar gründen, Handelsregister-Eintrag abwarten
- [ ] Gewerbeanmeldung beim Gewerbeamt
- [ ] (später) Anwalt: AGB-Prüfung P2B-Verordnung — `constants/legal.ts` prüfen lassen

## 6. App Store / Play Store (kann später)  ☐
- Checkliste: `docs/release/APP_STORE_PLAY_STORE_CHECKLIST.md`
- [ ] EAS-Projekt anlegen, Screenshots aus echtem Build
- [ ] Privacy-Policy-URL im Store-Formular eintragen

## 7. Optional: Social-Login freischalten  ☐
- Code fertig, zeigt ohne Freischaltung eine saubere Fehlermeldung.
- [ ] Google/Apple OAuth im Supabase-Dashboard aktivieren (Details:
  `docs/todo/OFFENE-FOUNDER-TODOS.md`)

---

## Danach: EIN kompletter Testdurchlauf durch DICH am iPhone
Ich konnte im Sandbox nicht gegen die echte Datenbank testen — dieser Durchlauf
ist der einzige verlässliche „grün":

1. Registrieren → Bestätigungsmail klicken
2. Als Kunde: Auftrag aufgeben
3. Als Anbieter (2. Konto): Angebot abgeben
4. Als Kunde: Angebot annehmen
5. Chatten (Nachricht hin und her)
6. (nach Stripe) Zahlung + Freigabe

Läuft dieser Durchlauf sauber durch → App ist launch-fähig.
