# Migrationen in die Produktion bringen

## Der Irrtum, wegen dem diese Seite existiert

Am 07.09.2026 habe ich dem Founder nach dem Merge von PR #188 geschrieben, die
Migrationen 0770–0800 „laufen in die Datenbank". Das war falsch.

**Kein Workflow spielt Migrationen ein.** `.github/workflows/` enthält
`ci.yml`, `health.yml`, `loop-heartbeat.yml`, `static.yml` und
`supabase-keep-alive.yml` — `static.yml` baut und veroeffentlicht die Web-App,
sonst nichts. Auch Edge Functions werden von keinem Workflow ausgerollt.

Ein Merge nach `main` aktualisiert also die **App**, nicht die **Datenbank**.
Wer das verwechselt, hat eine App im Netz, die Spalten und Funktionen aufruft,
die es dort nicht gibt.

## Weg 1 — SQL-Editor (ohne Werkzeuge, aus dem Browser)

Der praktikable Weg, solange keine Supabase-CLI eingerichtet ist.

1. Supabase Dashboard -> Projekt -> **SQL Editor** -> New query.
2. Die neuen Migrationsdateien **in numerischer Reihenfolge** einfuegen.
   Mehrere in einem Rutsch ist in Ordnung, solange die Reihenfolge stimmt.
3. **Run**.
4. Nachsehen, ob es angekommen ist — nicht darauf vertrauen, dass es lief:

```sql
select 'tabelle X' as was,
       case when to_regclass('public.X') is not null then 'ok' else 'FEHLT' end;
-- fuer Funktionen: to_regprocedure('public.name(argumenttypen)')
```

Eine solche Pruefabfrage gehoert an das Ende jedes Blocks, den jemand von Hand
einfuegt. Ein leerer Erfolgsbildschirm im SQL-Editor ist kein Nachweis.

## Weg 2 — Supabase CLI (der eigentliche Weg)

```bash
supabase login
supabase link --project-ref chnphpmpdpllnpqtvwhx
supabase db push
supabase db diff        # muss danach leer sein
```

`db push` fuehrt Buch darueber, was schon gelaufen ist. Weg 1 tut das **nicht**
— dort ist die Reihenfolge Handarbeit, und deshalb muss jede Migration einen
zweiten Lauf unbeschadet ueberstehen (siehe unten).

## Warum jede Migration idempotent sein muss

Beim Einfuegen von Hand bricht ein Skript mittendrin ab (Zeitueberschreitung,
Fehler in einer spaeteren Anweisung, versehentlich zweimal auf Run). Der
normale naechste Schritt ist: denselben Block noch einmal einfuegen. Ist eine
Anweisung nicht wiederholbar, bekommt man dann einen Fehler statt eines
Ergebnisses — und weiss nicht, wie weit der erste Lauf gekommen war.

Muster im Repo:

| Objekt | wiederholbar durch |
|---|---|
| Tabelle, Spalte, Index | `if not exists` |
| Policy | `drop policy if exists … on …;` davor |
| Trigger | `drop trigger if exists … on …;` davor |
| Funktion | `create or replace` — **ausser** wenn sich der Rueckgabetyp aendert, dann `drop function if exists …(argumente);` davor |
| `comment on function` | immer **mit Argumentliste**, sobald es mehrere Signaturen gibt |

Geprueft wird das in `scripts/db-test/run.sh`: dort werden alle Migrationen ab
`0380` ein **zweites Mal** gespielt. Zwoelf aeltere Dateien (0010, 0020, 0021,
0030, 0050, 0130, 0200, 0220, 0240, 0300, 0320, 0370) sind das nicht und werden
bewusst nicht nachtraeglich umgeschrieben — sie sind in der Produktion laengst
eingespielt, und ein `drop policy` auf `profiles` oder `contracts` waere ein
echter Eingriff in laufende Zugriffskontrolle, um ein Problem zu loesen, das
dort nicht auftritt.

## Edge Functions

Ebenfalls von keinem Workflow ausgerollt:

```bash
supabase functions deploy <name>
```

Wer eine Datei unter `supabase/functions/**` aendert und nur mergt, hat die
Aenderung im Repo und nicht in der Produktion. Das betrifft aktuell
`release-escrow` (zweiter zulaessiger Aufrufer ueber `x-admin-secret`, PR #188)
— ohne Ausrollen laeuft der geplante Abnahmefrist-Lauf ins Leere.
