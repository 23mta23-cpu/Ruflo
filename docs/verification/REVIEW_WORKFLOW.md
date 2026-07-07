# Anbieter-Verifizierung — Review-Workflow (manuell, Concierge-Phase)

> Stand: 2026-07-07. Gilt bis ~50 Anbieter; danach Automatisierung prüfen
> (Stripe Identity, Admin-UI). Technischer Unterbau: Migration 037,
> `lib/verification.ts`, `app/onboarding-kyc.tsx`.

## Wie der Ablauf funktioniert

1. **Anbieter** durchläuft das KYC-Onboarding, lädt Gewerbeschein (Pflicht)
   und bei Meisterpflicht-Gewerk (§1 HwO Anlage A) den Meisterbrief hoch.
   Dateien landen im privaten Bucket `verification-docs/{user-id}/…`
   (10 MB, JPG/PNG/PDF; nur Owner + service_role lesbar).
2. Beim Abschluss setzt der Client `kyc_status = 'in_review'` — der einzige
   clientseitig erlaubte Übergang (DB-Guard, Migration 037). Alle anderen
   Übergänge kann nur die service_role setzen.
3. **Tayyip prüft** (siehe Checkliste) im Supabase-Dashboard.
4. Freigabe/Ablehnung per SQL (unten). Erst `approved` macht den Anbieter in
   der Suche sichtbar (RLS: `kyc_status = 'approved'`).

## Prüf-Checkliste pro Anbieter (10–15 Min)

**Gewerbeschein (alle):**
- [ ] Name/Firma = Name im Profil?
- [ ] Tätigkeit deckt das gewählte Gewerk ab?
- [ ] Dokument vollständig, lesbar, ohne Manipulationsspuren?

**Meisterbrief (nur Meisterpflicht-Gewerke, z. B. Elektro, Sanitär/Heizung):**
- [ ] Name = Profilname? Gewerk = gewähltes Gewerk?
- [ ] **Handwerksrolle-Gegencheck:** HWK zu Köln, Tel. 0221 2022-0, oder
      Betriebsberater-Auskunft — eintragen lassen, dass Betrieb XY in der
      Handwerksrolle für das Gewerk eingetragen ist. (Es gibt KEINE
      öffentliche API — der Anruf ist der belastbare Weg.)
- [ ] Alternativ akzeptiert: Ausnahmebewilligung §8 HwO / Altgesellen §7b /
      EU-Anerkennung — Dokument gleichwertig prüfen.

**Altersnachweis (Nachbarschafts-Helfer):**
- Läuft NICHT über Dokument-Upload. Selbstauskunft (18+-Gate im Onboarding)
  plus **Stripe-Connect-KYC** (Stripe verifiziert Identität + Geburtsdatum,
  bevor Auszahlungen möglich sind). KEINE Ausweiskopien speichern —
  Kopierbeschränkung §20 PAuswG + unnötiges DSGVO-Risiko.

## Freigabe / Ablehnung (Supabase SQL-Editor, läuft als service_role)

```sql
-- Dokumente ansehen: Storage → verification-docs → Ordner = User-ID

-- FREIGABE (Meisterpflicht-Gewerk: beide Flags)
update provider_profiles
set kyc_status = 'approved', kyc_verified = true, meister_verified = true
where id = '<USER-ID>';

-- FREIGABE (ohne Meisterpflicht)
update provider_profiles
set kyc_status = 'approved', kyc_verified = true
where id = '<USER-ID>';

-- ABLEHNUNG (Grund wird dem Anbieter angezeigt — konkret formulieren)
update provider_profiles
set kyc_status = 'rejected',
    kyc_rejected_reason = 'Gewerbeschein unleserlich — bitte als PDF erneut hochladen.'
where id = '<USER-ID>';
```

Nach Ablehnung kann der Anbieter erneut hochladen und wieder einreichen
(Guard erlaubt `rejected → in_review`).

## DSGVO-Regeln für die Dokumente

- Zweckbindung: nur Verifizierung. Kein Weiterreichen, kein Export.
- Löschung: bei Ablehnung ohne Neueinreichung nach 90 Tagen; bei
  Account-Löschung sofort (in delete-account-Function ergänzen — TODO Phase 2).
- Zugriff: ausschließlich über das Supabase-Dashboard (service_role),
  niemals Links teilen.

## Bewusst verschoben (erst ab echten Signalen)

- Stripe Identity für automatisierte Ausweis-/Altersprüfung (~1,50 €/Check).
- Admin-Review-UI in der App (Dashboard reicht bis ~50 Anbieter locker).
- Automatischer E-Mail-Versand bei Freigabe/Ablehnung (RESEND_API_KEY fehlt).
