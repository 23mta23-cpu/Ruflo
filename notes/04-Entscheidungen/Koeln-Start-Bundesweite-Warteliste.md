# Entscheidung: Köln operativ, Warteliste bundesweit

**Kontext:** Tayyip hat klargestellt: WERKR startet operativ nur in Köln,
soll aber von Tag 1 an bundesweit Aufmerksamkeit erzeugen (z.B. Köln und
Düsseldorf als genannte Beispielstädte). Direkter Bezug zu
`docs/premortem_werkr.md` Todesursache 1 (Liquiditäts-Verwässerung) — echte
Auftragsbuchung außerhalb der einen tatsächlich lebendigen Stadt hätte leere
Auftragslisten produziert und Vertrauen sofort beschädigt.

## Umgesetzt

1. **`lib/cities.ts`** — `ACTIVE_CITIES = ['Köln']`, `isActiveCity()`
   (umlaut-/case-insensitiver Vergleich).
2. **`supabase/migrations/035_waitlist.sql`** — `waitlist`-Tabelle, offene
   Insert-Policy (kein Login nötig), keine Select-Policy für Clients
   (Admin-Export via service_role).
3. **`lib/waitlist.ts`** — `joinWaitlist()`.
4. **`app/auftrag-aufgeben.tsx`** — vor `createJob()` wird `isActiveCity(city)`
   geprüft. Nicht-Köln → `joinWaitlist()` statt Auftragserstellung, eigener
   Erfolgsbildschirm ("Sie stehen auf der Warteliste").
5. **`app/landing.tsx`** — Hero-Label auf "Start in Köln — bald bundesweit"
   geändert; neue `WaitlistSection` (E-Mail + Stadt, kein Login) vor dem
   Footer für bundesweite Interessenten.

## Bewusst nicht umgesetzt

- Keine automatische Freischaltung weiterer Städte — das ist eine
  Geschäftsentscheidung (Warteliste liefert die Daten dafür).
- Keine Rate-Limitierung auf dem `waitlist`-Insert: es ist ein reiner
  DB-Insert ohne Edge Function, vergleichbar mit einem Newsletter-Signup,
  Risiko/Aufwand-Verhältnis rechtfertigt hier keine eigene Infrastruktur.

## Verifiziert

- `npx tsc --noEmit`: 0 Fehler.
- Alle 35 Migrationen (`001`–`035`) laufen sauber gegen eine frische
  Postgres-Instanz durch (manuelles Supabase-Bootstrap, siehe frühere
  Session-Notizen).
