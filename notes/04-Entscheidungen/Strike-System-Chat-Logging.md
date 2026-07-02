# Entscheidung: Strike-System-Signal auch im Chat

**Kontext:** Nutzerwunsch: das Strike-System (AGB §7 — 3 Strikes = Sperrung,
u.a. für "Beauftragung außerhalb der Plattform") soll auch im Chat spürbar
sein. Der Chat hatte bereits einen client-seitigen Leak-Detektor
(`lib/chatGuard.ts`, `detectLeak()`), der bei Telefonnummer/IBAN/E-Mail eine
weiche Erinnerung einblendet — das Signal wurde bisher aber nirgends
gespeichert. `provider_profiles.strike_count` (Migration 019) existierte
bereits mit dem Kommentar "Managed by admin/audit flows", aber dieser Flow
existierte nicht.

## Umgesetzt

1. **`supabase/migrations/034_chat_leak_flags.sql`** — neue Tabelle
   `chat_leak_flags` (job_id, sender_id, leak_types, created_at). Insert
   nur durch den Sender selbst für Jobs, an denen er beteiligt ist. Keine
   Select-Policy für Clients — reines Admin-Audit-Signal.
2. **`lib/chatGuard.ts`** — `logLeakEvent()` (fire-and-forget Insert);
   `LEAKAGE_NUDGE`-Text erweitert um den Hinweis auf mögliche Strike-Folgen.
3. **`app/chat.tsx`** — beim Senden einer Nachricht mit erkanntem Leak wird
   `logLeakEvent()` aufgerufen (zusätzlich zur bestehenden Push-Notification-
   Anonymisierung).

## Bewusst NICHT umgesetzt: automatische Strike-Vergabe

Ein einzelner Regex-Treffer ist kein Beweis für eine tatsächliche
Umgehung der Plattform (False positives möglich, Client-Erkennung ist
umgehbar) — automatische Sanktionierung auf Basis eines unzuverlässigen
Signals wäre unfair gegenüber legitimen Nutzern und rechtlich riskant
(automatisierte Sperrung ohne menschliche Prüfung). Stattdessen: Signale
werden persistiert, damit wiederholte Muster für eine manuelle
Admin-Prüfung sichtbar sind, bevor ein Strike vergeben wird — passend zum
bereits vorhandenen Kommentar auf `strike_count`.

## Verifiziert

- `npx tsc --noEmit`: 0 Fehler.
- Migration 034 läuft sauber gegen eine frische Postgres-Instanz.
