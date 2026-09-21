# Die DAC7-Jahresmeldung ruft niemand auf

**Datum:** 21.09.2026
**Anlass:** Selbst-Check „wer liest das Ergebnis, und auf welchem Bildschirm?"
über alle Edge Functions.

## Befund

`pstg-annual-report` ist die einzige Edge Function, die **niemand** aufruft.
Kein `pg_cron`-Zeitplan, kein GitHub-Workflow, keine Stelle in der Oberfläche.
Ihr eigener Kopfkommentar behauptet „manually by admin POST, or via Supabase
scheduled function (cron) on Jan 1". Den Zeitplan gibt es nicht.

Übrig bleibt: der Founder muss am 1. Januar von sich aus an eine Funktion
denken, die in keiner Liste steht, die er liest.

Daran hängt eine Frist. § 13 Abs. 1 PStTG: Meldung bis zum 31. Januar für das
Vorjahr. § 25 PStTG: Bußgeld bis 50.000 € bei Versäumnis.

Das ist dieselbe Klasse wie die drei Warteschlangen vom 16.09. (gebaut,
richtig, geprüft, ohne Empfänger) und wie `meister_verified`, das nie
geschrieben und nie gelesen wurde.

## Was NICHT gebaut wurde, und warum

Kein automatischer Aufruf. Die Funktion legt nicht nur Zeilen an, sie
**benachrichtigt die betroffenen Anbieter**. Das ist eine Handlung nach außen,
und eine Steuermeldung ist nichts, was eine Überwachungsfunktion nebenbei
auslöst. Die Entscheidung steht als Punkt 6 in
`docs/founder/MEINE-AUFGABEN-PLATZHALTER.md`.

## Was gebaut wurde

`pstg_meldung_status()` (Migration 1010), ausgewiesen in `health`, alarmiert in
`wartet-jemand.yml`.

**Zwei getrennte Kennzeichen, und das ist der Punkt:**

- `lauf_fehlt` -- es gibt meldepflichtige Anbieter, aber keine (oder zu wenige)
  Zeilen in `pstg_reports`. Nichts ist vorbereitet.
- `abgabe_fehlt` -- die Zeilen gibt es, `submitted_at` ist leer. Die
  XML-Meldung ging nie ans BZSt.

Ein einziges Kennzeichen wäre grün, sobald `pstg-annual-report` einmal gelaufen
ist, und die Meldung bliebe trotzdem liegen. Genau diese Verwechslung prüft
PM4.

## Zwei Fallen, in die ich nicht gelaufen bin, weil die Vorarbeit stand

1. **Jahreswechsel.** Migration 0620 hatte die Meldegrundlage schon von den
   laufenden Zählern in `profiles` auf `contracts` umgestellt. Die Zahlen für
   2026 sind auch 2028 noch dieselben.
2. **Vierte Kopie der Schwellen.** `pstg_year_totals` trägt 30/2000 als
   Vorgabewerte. Die Statusfunktion ruft sie **ohne Argumente** auf, statt die
   Zahlen erneut hinzuschreiben.

Ortszeit statt UTC: am 31.12. um 23:30 Berliner Zeit ist es in UTC schon das
neue Jahr, und die Funktion würde einen Tag zu früh ein Jahr verlangen, das
noch läuft.

## Belege

`scripts/db-test/pstg-meldung.sql`, 6 Zusicherungen (353 -> 359).
Fünf Mutationen alle rot:

| Mutation | rot durch |
|---|---|
| `lauf_fehlt := false` | PM3 |
| `abgabe_fehlt := false` | PM4 |
| Meldejahr = laufendes Jahr statt Vorjahr | PM1 |
| Rechte-Entzug entfernt | rechte.sql RA |
| `abgegeben` zählt alle Zeilen statt nur die abgegebenen | PM4 |

Gegenprobe (nur ein Kommentar geändert) blieb grün. Drei der sechs
Zusicherungen sind selbst Gegenproben: kein Alarm im Kaltstart (PM1), kein
Alarm nach der Abgabe (PM5), und die Abgrenzung des Meldejahrs (ein Anbieter
unter der Schwelle und ein Vertrag aus dem laufenden Jahr zählen nicht mit,
PM3).

Im Wächter zählt ein fehlendes Feld als Alarm, nicht als stilles Grün. Der
Ableser für die Tage bis zur Frist liest ausdrücklich auch negative Zahlen; ein
reiner Ziffern-Ableser hätte aus „Frist seit 12 Tagen verstrichen" still eine
12 gemacht.
