# Betrieb: E-Mail-Versand ist Voraussetzung für ALLE Schreibwege

**Status 26.07.2026: `RESEND_API_KEY` ist in den Supabase-Secrets NICHT gesetzt.
Damit ist die App für jedes nicht manuell freigeschaltete Konto funktionslos.**

## Die Kette

1. Migration `0430_gate_only_own_doi_stamp.sql` hat das Verifikations-Gate
   bewusst auf **eine** Quelle verengt: `profiles.email_verified_at`.
   Grund: Mit deaktiviertem „Confirm email" setzt Supabase
   `auth.users.email_confirmed_at` bei **jedem** Signup sofort — der alte
   OR-Pfad schaltete deshalb alle Neuregistrierungen ungewollt frei.
2. `profiles.email_verified_at` wird **ausschließlich** von der Edge Function
   `verify-email` gesetzt. Ein Guard-Trigger (0400) blockt jeden anderen
   Schreibweg — auch `postgres` im SQL-Editor.
3. `verify-email` bricht ohne `RESEND_API_KEY` mit
   `500 {"error":"Mail service not configured"}` ab.

→ Ohne den Schlüssel kann sich **niemand** verifizieren, und niemand wird es je.

## Was dadurch gesperrt ist (alles `auth_email_confirmed()`)

| Aktion | Migration |
|---|---|
| Auftrag anlegen | 0400 |
| Angebot abgeben | 0400 / 0480 / 0500 |
| Angebot annehmen | 0400 |
| Rückfrage/Chat als Anbieter senden | 0510 |
| Termin vorschlagen | 0520 |
| Gematchte Aufträge lesen | 0410 |

Das Lesen offener Aufträge wurde in 0470 bereits aus dem Gate genommen, weil
Anbieter sonst null Aufträge sahen — der Deadlock war also schon einmal
sichtbar, wurde aber nur an dieser einen Stelle umgangen.

## Behebung (Founder, ~2 Minuten)

1. Resend-Account: API-Key erzeugen (https://resend.com/api-keys).
2. Absender-Domain in Resend verifizieren (SPF/DKIM). Ohne eigene Domain
   funktioniert `onboarding@resend.dev` nur an die eigene Resend-Konto-Adresse.
3. Supabase Dashboard → Project Settings → Edge Functions → Secrets:
   - `RESEND_API_KEY` = der Key
   - `WAITLIST_FROM_EMAIL` = z. B. `Werkant <noreply@werkant.de>`
4. Prüfen: In der App Einstellungen → Konto → „Bestätigungs-E-Mail erneut
   senden". Erwartet: Erfolgs-Toast statt „Versand nicht eingerichtet".

## Sofort-Entsperrung bestehender Testkonten (SQL-Editor)

Der Guard-Trigger blockt das direkte `update` **auch als `postgres`**. Er muss
für die Dauer der Korrektur abgeschaltet werden:

```sql
alter table public.profiles disable trigger trg_guard_email_verified;
update public.profiles
   set email_verified_at = now()
 where email_verified_at is null;
alter table public.profiles enable trigger trg_guard_email_verified;
```

Lokal gegen alle Migrationen verifiziert: ohne das `disable` schlägt das
Statement mit „profiles.email_verified_at is managed by the verify-email Edge
Function only" fehl; mit dem `disable` liefert `auth_email_confirmed()`
anschließend `true`.

**Das ist eine Notmaßnahme für Testkonten, kein Ersatz für Schritt 1–4.** Vor
Go-live muss der Versand laufen, sonst ist jede echte Registrierung eine
Sackgasse.

## Warum das Gate nicht einfach entfernt wird

Es ist die einzige Hürde gegen Wegwerf-Konten, die Aufträge und Angebote
erzeugen. Mit aktivem Autoconfirm beweist `auth.users.email_confirmed_at`
nichts (siehe 0430). Das Gate zu lockern wäre eine Änderung der
Sicherheitsposition und ausdrücklich eine Founder-Entscheidung — nicht der
bequeme Weg um einen fehlenden Schlüssel herum.
