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

## Begründung

Das Gate ist die einzige Hürde gegen Wegwerf-Konten. Es zu lockern wäre eine
Änderung der Sicherheitsposition — und zwar eine, die ich als bequemen Weg um
einen fehlenden Konfigurationsschlüssel herum wählen würde. Das ist der falsche
Grund für eine Sicherheitsentscheidung. Ein fehlendes Secret rechtfertigt keine
dauerhafte Absenkung des Schutzniveaus.

## Umsetzung

1. Runbook `docs/ops/RESEND-MAIL-GATE.md` — Ursachenkette, vollständige Liste
   der gesperrten Aktionen, Behebung in 4 Schritten.
2. Notfall-Entsperrung für Testkonten (Guard-Trigger kurz deaktivieren) —
   ausdrücklich als Notmaßnahme markiert, kein Ersatz für Schritt 1.
3. Client meldet den echten Grund statt „bitte erneut versuchen"
   (`explainSendFailure`, `verificationMailErrorText`).
4. Drei db-test-Assertions nageln die Deadlock-Klasse fest, damit eine
   Regression von 0430 auffällt.

## Offen / Folgeentscheidung

- Ob zusätzlich ein struktureller Health-Check gebaut wird (Startup-Warnung
  oder CI-Prüfung, die fehlende Secrets erkennt), ist noch offen — zur
  Bewertung an den CTO-Agenten gegeben.
- **Go-live-Gate:** Ohne funktionierenden Mailversand ist jede echte
  Registrierung eine Sackgasse. Das ist ein harter Blocker, kein Schönheitsfehler.

## Nachtrag: eigene Fehlkorrektur

Das früher an den Founder gegebene SQL
(`update profiles set email_verified_at = now()`) funktioniert **nicht** — der
Guard-Trigger blockt es auch als `postgres`. Korrigierte, lokal verifizierte
Variante steht im Runbook.
