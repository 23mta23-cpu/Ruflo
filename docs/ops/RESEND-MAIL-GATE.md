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

Genau fünf aktive Gates (jeweils letzte gültige Definition):

| Aktion | maßgebliche Migration |
|---|---|
| Auftrag anlegen (`jobs` INSERT) | 0400 |
| Angebot abgeben (`offers` INSERT) | **0580** (zuletzt neu definiert) |
| Angebot annehmen (`accept_offer`) | **0530** |
| Rückfrage/Chat als Anbieter (`messages` INSERT) | 0510 |
| Termin vorschlagen (`propose_appointment`) | **0550** |

**NICHT gated:** Zahlung, Escrow-Freigabe, Bewertung, Streitfall, Datenexport.
Ein einmal entsperrtes Konto läuft also komplett durch.

**Ebenfalls nicht gated: das Lesen von Aufträgen.** 0470 hat
`Providers browse open jobs` ohne `auth_email_confirmed()` neu angelegt — der
Deadlock war dort schon einmal sichtbar und wurde punktuell entschärft. Eine
frühere Fassung dieses Runbooks führte „gematchte Aufträge lesen (0410)" als
gesperrt; das ist falsch und wurde entfernt. Eine überschätzte Angabe der
Reichweite ist gefährlich, weil sie in Richtung „Gate lockern" drängt.

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

Der Guard-Trigger blockt das direkte `update` **auch als `postgres`**.

**Nur so ausführen — die Transaktion ist nicht optional:**

```sql
begin;
alter table public.profiles disable trigger trg_guard_email_verified;
update public.profiles
   set email_verified_at = coalesce(email_verified_at, now())
 where id = 'HIER-DIE-USER-UUID-EINSETZEN';
alter table public.profiles enable trigger trg_guard_email_verified;
commit;
```

Zwei Dinge daran sind sicherheitsrelevant, nicht kosmetisch:

1. **`begin; … commit;` ist zwingend.** `alter table … disable trigger` ist in
   PostgreSQL transaktional (lokal verifiziert: in der Transaktion `tgenabled='D'`,
   nach `rollback` wieder `'O'`). Ohne Transaktion bleibt der Trigger dauerhaft
   und lautlos aus, wenn ein Statement fehlschlägt, die Verbindung abbricht oder
   die letzte Zeile übersehen wird. Und das wäre fatal: Die UPDATE-Policy auf
   `profiles` hat als Spaltenschutz wörtlich `and true`
   (`0050_rls_security_hardening.sql:52`) — **der Trigger ist die einzige
   Schutzschicht**. Ist er aus, verifiziert sich jeder angemeldete Nutzer per
   `PATCH /rest/v1/profiles?id=eq.<eigene-id>` selbst, ohne dass irgendwo etwas
   auffällt.
2. **Auf EINE UUID einschränken.** Eine frühere Fassung dieses Runbooks nutzte
   `where email_verified_at is null` und war als „für Testkonten" beschrieben —
   das hätte jedes unverifizierte Konto entsperrt, auch echte Neuregistrierungen.
   Prosa und SQL widersprachen sich.

**Das ist eine Notmaßnahme für Testkonten, kein Ersatz für Schritt 1–4.** Vor
Go-live muss der Versand laufen, sonst ist jede echte Registrierung eine
Sackgasse.

## Warum das Gate nicht einfach entfernt wird

Es ist die einzige Hürde gegen Wegwerf-Konten, die Aufträge und Angebote
erzeugen. Mit aktivem Autoconfirm beweist `auth.users.email_confirmed_at`
nichts (siehe 0430). Das Gate zu lockern wäre eine Änderung der
Sicherheitsposition und ausdrücklich eine Founder-Entscheidung — nicht der
bequeme Weg um einen fehlenden Schlüssel herum.


## Zwei weitere Ausfälle, die derselbe Schlüssel verursacht

### Kein Anbieter erfährt von neuen Aufträgen
`supabase/functions/notify-matching-providers/index.ts:99` liest denselben
`RESEND_API_KEY`. Ohne ihn wird kein Anbieter über passende neue Aufträge
informiert. Das ist **kein** Verifikationsproblem, sondern ein
Liquiditätsproblem des Marktplatzes — praktisch wichtiger als der Gate-Deadlock,
weil ein Auftrag ohne Angebote auch mit entsperrtem Konto nutzlos ist.

### Passwort-Vergessen ist unabhängig davon kaputt
`lib/auth.ts:157` und `app/passwort-vergessen.tsx:29` nutzen
`supabase.auth.resetPasswordForEmail()`. Das läuft über den **Supabase-eigenen
SMTP**, nicht über Resend — also über genau den Versandweg, dessen Limit der
Grund für die Eigenbau-Verifizierung war. Der `RESEND_API_KEY` behebt das
**nicht**.

Fix: In Supabase → Authentication → Emails → **Custom SMTP** auf Resend zeigen
lassen (gleicher Key, gleiche verifizierte Domain). „Confirm email" bleibt dabei
**aus** — sonst greift die Registrierung wieder auf einen Versandweg zurück, der
das Gate nicht bedient (`auth_email_confirmed()` liest nach 0430 ausschließlich
`profiles.email_verified_at`, und den setzt Supabase-Auth nie).

Auch das ist ein Go-live-Blocker: Ein Nutzer, der sein Passwort vergisst, hat
sonst keinen Weg zurück in sein Konto.

## Nach dem Fix prüfen

1. `GET /functions/v1/health` → `{"mail": true, …}` (siehe `supabase/functions/health/`).
2. In der App: Einstellungen → Konto → „Bestätigungs-E-Mail erneut senden" →
   Erfolgs-Toast statt „Versand nicht eingerichtet".
3. Passwort-Vergessen mit einer echten Adresse durchspielen.

Der GitHub-Workflow `.github/workflows/health.yml` prüft Punkt 1 zweimal täglich
und schickt bei Fehlschlag automatisch eine Mail. Das ist der eigentliche
Deadlock-Detektor — nicht dieses Dokument.
