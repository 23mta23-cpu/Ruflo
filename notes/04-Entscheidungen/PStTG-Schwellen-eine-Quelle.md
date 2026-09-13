# Die PStTG-Schwelle stand dreimal im Code

*Befund 13.09.2026, beim Durchsehen der Edge Functions ohne ausführbaren Test.*

## Was gefunden wurde

§ 2 Abs. 1 Nr. 1 PStTG legt die Meldeschwelle fest: **30 Vorgänge ODER 2000 Euro**
im Kalenderjahr. Diese Zahlen standen an drei unabhängigen Stellen:

| Stelle | Namen |
|---|---|
| `lib/pstTgThresholds.ts` | `PSTG_TX_THRESHOLD`, `PSTG_REV_THRESHOLD_EUR` |
| `lib/account.ts` | `PSTG_TRANSACTION_THRESHOLD`, `PSTG_EARNINGS_THRESHOLD` |
| `supabase/functions/pstg-annual-report/index.ts` | nochmals als Literale |

Dazu **zwei** Prädikatsfunktionen, die dasselbe tun: `isDac7ThresholdReached`
und `isPStTGThresholdReached`.

Alle Werte waren identisch. Nichts hielt sie zusammen außer einem Kommentar
„keep in sync" — und der nannte zusätzlich `release-escrow`, das die Zahlen
gar nicht (mehr) enthält. **Der Hinweis war selbst veraltet und suggerierte
trotzdem Verlässlichkeit.**

## Warum das keine Kosmetik ist

Laufen die Werte auseinander, warnt die App den Anbieter bei einer anderen
Schwelle, als die BZSt-Meldung tatsächlich verwendet:

- **Zu früh gemeldet** ist eine Datenweitergabe an die Finanzverwaltung ohne
  Rechtsgrundlage.
- **Zu spät gemeldet** ist ein Verstoß gegen die Meldepflicht.

Beides ist falsch, nur in unterschiedliche Richtungen — und beides fiele
niemandem auf, weil jede Seite für sich grün ist. Genau die Klasse, die in
`CLAUDE.md` schon steht: *ein Test kann grün bleiben, weil zwei Werte zufällig
gleich sind.*

## Was getan wurde

1. **`lib/account.ts` führt keine eigenen Zahlen mehr.** Es exportiert die
   Namen von `pstTgThresholds.ts` weiter, damit die Aufrufer unverändert
   bleiben, die Werte aber aus einer Quelle kommen.
2. **`isPStTGThresholdReached` delegiert** an `isDac7ThresholdReached`.
3. **Die dritte Kopie bleibt** — Deno Edge Functions können nicht aus `lib/`
   importieren. Sie wird jetzt mechanisch abgeglichen:
   `scripts/schwellen-check.py` (CI + Browser-Läufer).
4. Beide veralteten Kommentare berichtigt.

## Die Bindung wurde bewiesen, nicht behauptet

Ein grüner Testlauf beweist hier nichts: die Tests blieben auch vor der
Zusammenführung grün. **Mutation:** `PSTG_TX_THRESHOLD` in der Quelle auf 50
gesetzt. Danach rot: `compliance.test.ts` **und** `account.test.ts`. Vorher
hätte dieselbe Änderung `account.test.ts` gar nicht erreicht — es hatte seine
eigene Kopie.

Zweite Mutation für den Prüfer: die Zahl in der Edge Function auf 25 gesetzt,
Prüfer rot, danach zurückgesetzt.

## Grenze, hingeschrieben

Der Prüfer vergleicht die **Zahlen untereinander**, nicht gegen das geltende
Recht. Ändert der Gesetzgeber die Schwelle, meldet er nichts. Dafür gibt es
keinen Automatismus, nur den Termin zur jährlichen Meldung.
