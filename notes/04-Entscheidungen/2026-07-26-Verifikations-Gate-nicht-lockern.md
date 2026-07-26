# Entscheidung: Verifikations-Gate bleibt, Resend-Key wird nachgetragen

**Datum:** 2026-07-26
**Rolle:** CTO
**Status:** entschieden (ohne Rückfrage beim Founder, gemäß Arbeitsmodus)

## Situation

`RESEND_API_KEY` ist in den Supabase-Secrets nicht gesetzt. Am Produktions-
projekt nachgewiesen: `verify-email` antwortet `500 Mail service not configured`,
`auth_email_confirmed()` liefert `false`.

Migration 0430 verengt das Gate auf `profiles.email_verified_at`; dieser Stempel
kommt ausschließlich von `verify-email`. Ohne Key kann sich niemand verifizieren
→ alle Schreibwege gesperrt (Auftrag anlegen, Angebot abgeben/annehmen,
Rückfrage im Chat, Terminvorschlag).

## Optionen

| Option | Bewertung |
|---|---|
| A: Gate lockern (`email_confirmed_at` wieder akzeptieren) | **Verworfen.** Genau das hat 0430 beseitigt: mit Autoconfirm ist der Wert immer gesetzt, das Gate wäre wirkungslos. Wegwerf-Konten könnten Aufträge und Angebote erzeugen. |
| B: Gate ganz entfernen | **Verworfen.** Gleiche Wirkung wie A, zusätzlich Verlust der DSGVO-/Missbrauchs-Argumentation. |
| C: Key nachtragen, Gate unverändert | **Gewählt.** Behebt die Ursache statt das Symptom. Aufwand für den Founder ~2 Minuten. |

## Begründung (korrigiert nach CTO-Review)

Meine erste Begründung war „einzige Hürde gegen Wegwerf-Konten". Das trägt
nicht: Ein DOI kostet über einen Temp-Mail-Dienst zehn Sekunden. Die tragfähige
Begründung ist **Erreichbarkeit einer zustellbaren Adresse für einen
Vertragspartner** — Escrow, Widerruf, Streitfall und die PStTG-Meldung hängen
daran. Genau deshalb sitzt das Gate an den Schreibwegen, an denen ein Vertrag
entsteht, und nicht am Lesen.

Diese Unterscheidung ist nicht akademisch: Mit der schwachen Anti-Spam-Begründung
sah die Option „24-Stunden-Karenzzeit" attraktiv aus. Mit der richtigen
Begründung ist sie klar schlecht — in der Karenzzeit entstehen Verträge mit
Geldfluss, und nach Ablauf hätte man einen aktiven Vertrag, dessen Partei nicht
mehr schreiben kann. Ein halb gelähmter Vertrag im Money-Core ist schlechter als
ein harter Stop davor.

Ein fehlendes Secret rechtfertigt ohnehin keine dauerhafte Absenkung des
Schutzniveaus.

## Umsetzung

1. Runbook `docs/ops/RESEND-MAIL-GATE.md` — Ursachenkette, vollständige Liste
   der gesperrten Aktionen, Behebung in 4 Schritten.
2. Notfall-Entsperrung für Testkonten (Guard-Trigger kurz deaktivieren) —
   ausdrücklich als Notmaßnahme markiert, kein Ersatz für Schritt 1.
3. Client meldet den echten Grund statt „bitte erneut versuchen"
   (`explainSendFailure`, `verificationMailErrorText`).
4. Drei db-test-Assertions nageln die Deadlock-Klasse fest, damit eine
   Regression von 0430 auffällt.

## Nachträge aus dem CTO-Review (umgesetzt)

- **Health-Check gebaut** statt offen gelassen: `supabase/functions/health/`
  (nur Booleans, keine Secrets, 503 bei fehlendem kritischen Secret) plus
  `.github/workflows/health.yml` (2x täglich; GitHub mailt bei Fehlschlag).
- **Notfall-SQL war gefährlich.** Die UPDATE-Policy auf `profiles` hat als
  Spaltenschutz wörtlich `and true` (0050:52) — der Trigger ist die einzige
  Schutzschicht. Meine erste Fassung schaltete ihn in drei nicht-transaktionalen
  Statements ab; ein Abbruch hätte ihn dauerhaft und lautlos ausgelassen, womit
  sich jeder angemeldete Nutzer selbst verifizieren kann. Behoben in Migration
  0600: Der Guard greift jetzt nur für Client-Rollen (`authenticated`, `anon`),
  administrative Verbindungen dürfen schreiben. Damit ist die Entsperrung ein
  einfaches, gezieltes UPDATE — ohne Trigger-Abschaltung, ohne Bypass-Fenster.
  Gegen einen Superuser schützte der Trigger ohnehin nicht.
- **INSERT-Lücke geschlossen** (0600): Der Guard war `before update`; im
  0380-Szenario (Client legt die eigene Profilzeile an) hätte man
  `email_verified_at` direkt mitsenden können.
- **Runbook-Faktenfehler korrigiert**: „Gematchte Aufträge lesen (0410)" war
  falsch — 0470 hat die Browse-Policy ohne Gate neu angelegt.

## Offen / Folgeentscheidung
- **Go-live-Gate:** Ohne funktionierenden Mailversand ist jede echte
  Registrierung eine Sackgasse. Das ist ein harter Blocker, kein Schönheitsfehler.

## Nachtrag: eigene Fehlkorrektur

Das früher an den Founder gegebene SQL
(`update profiles set email_verified_at = now()`) funktioniert **nicht** — der
Guard-Trigger blockt es auch als `postgres`. Korrigierte, lokal verifizierte
Variante steht im Runbook.


## Zwei weitere Blocker, die derselbe Befund freigelegt hat

1. **Passwort-Vergessen ist unabhängig davon kaputt.** `resetPasswordForEmail`
   läuft über den Supabase-eigenen SMTP, nicht über Resend — der
   `RESEND_API_KEY` behebt das *nicht*. Fix: Custom SMTP in Supabase Auth auf
   Resend zeigen lassen, „Confirm email" bleibt aus.
2. **Kein Anbieter erfährt von neuen Aufträgen.**
   `notify-matching-providers` liest denselben Key. Das ist ein
   Liquiditätsproblem des Marktplatzes und praktisch wichtiger als der
   Gate-Deadlock — ein Auftrag ohne Angebote nützt auch mit entsperrtem Konto
   nichts.

Beides steht im Runbook.
