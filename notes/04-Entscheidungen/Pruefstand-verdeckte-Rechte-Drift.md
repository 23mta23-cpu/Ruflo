# Der Prüfstand hat eine ganze Fehlerklasse verdeckt

*Befund 13.09.2026, beim Nachziehen von `rechte.sql` gegen die seit `0820`
dazugekommenen Funktionen. Der schwerwiegendste Fund des Tages, weil er eine
Sicherheitszusage entwertete, die das Projekt für gegeben hielt.*

## Was passiert ist

`0820` hat die Ausführungsrechte im Schema `public` von „erlaubt" auf
„verboten" gedreht — als Reaktion auf einen Pentest-Befund vom 07.09., bei dem
15 SECURITY-DEFINER-Funktionen für jeden Angemeldeten aufrufbar waren.
`scripts/db-test/rechte.sql` hält das seitdem mechanisch nach.

**Die Schleife in `0820` erfasst aber nur, was es zu ihrem Zeitpunkt gab.**
Jede später angelegte Funktion bekommt wieder:

- die Vorgaben aus `0420` (`alter default privileges … grant execute on
  functions to authenticated, service_role`), und
- das `EXECUTE`, das PostgreSQL **jeder** neuen Funktion an `PUBLIC` gibt.

`0860` legte zwei SECURITY-DEFINER-Trigger an. In der Produktion waren sie
damit für `anon` **und** `authenticated` ausführbar.

## Warum es niemand gemerkt hat

`rechte.sql` lief am Ende, zusammen mit allen anderen Tests — also **nach** dem
Idempotenz-Durchgang. Und der zweite Lauf spielt auch `0820` erneut. Dessen
pauschale Widerrufsschleife räumt dabei die Rechte **aller** Funktionen auf,
auch der später angelegten.

In der Produktion passiert das nie: dort laufen Migrationen genau **einmal**
und der Reihe nach.

> Der Prüfstand reparierte den Fehler, den er finden sollte — und meldete
> anschließend grün.

Gemessen, nicht geschlossen: gegen den einmaligen Stand wurden RA und RB sofort
rot; nach einem zweiten Migrationsdurchgang derselben Datenbank wurden sie
grün.

## Die zwei Korrekturen

**Die Produktion** (`0900`): Ausführungsrecht für beide Trigger-Funktionen
entzogen. Bewusst **kein** `grant … to service_role` hinterher — Trigger
brauchen überhaupt kein `EXECUTE`, PostgreSQL prüft es beim Auslösen nicht.
Was niemand aufrufen kann, kann auch nicht missbraucht werden.

**Der Prüfstand**: `rechte.sql` läuft jetzt direkt nach dem ersten
Migrationslauf, vor dem Idempotenz-Durchgang. Er ist der einzige Test, dessen
Ergebnis vom **Durchgang** abhängt und nicht nur vom Schema.

## Ausnutzbarkeit, ehrlich

Gering. Beide Funktionen geben `trigger` zurück, und ein direkter Aufruf
scheitert an „trigger functions can only be called as triggers".

**Das ist aber ein Zufall der Rückgabeart, kein Schutz.** Die eigentliche
Gefahr war nie diese eine Funktion, sondern die Blindheit: **jede künftige
SECURITY-DEFINER-Funktion, die nach `0820` dazukommt und einen normalen
Rückgabetyp hat, wäre genauso offen gewesen — und der Prüfstand hätte es
genauso wenig gesehen.**

## Mein Fehler beim Schreiben von 0860

Aus „Trigger-Funktionen **brauchen** kein `EXECUTE`" (richtig) habe ich
geschlossen, dass man ihnen keines **entziehen** muss. Das folgt nicht. Die
Grundregel aus `0820` ist Verbot; eine Ausnahme, die nur deshalb harmlos ist,
weil PostgreSQL zufällig dazwischengeht, bleibt eine Ausnahme.

## Gegenprobe

`0900` entfernt → RA und RB rot, mit genau den zwei Funktionsnamen. `0900`
zurück → 258 Assertions grün. **Vor** der Umstellung von `run.sh` blieb
derselbe Zustand grün; das ist der Beweis, dass die Umstellung wirkt und nicht
nur die Reihenfolge kosmetisch ändert.

## Was daraus für die Zukunft folgt

Eine Migration, die ihre Rechte pauschal über alle vorhandenen Objekte setzt,
ist ein **Stichtag**, keine Regel. `0820` bleibt richtig für alles bis `0820`;
jede spätere Migration muss ihre eigenen Funktionen selbst widerrufen. Das tut
`0860` für die aufrufbaren Funktionen bereits — nur bei den Triggern hatte ich
es für entbehrlich gehalten.

---

## Nachtrag: dieselbe Frage für Tabellen gestellt

Der Befund oben ist ein Muster, kein Einzelfall: **`0420` vergibt Vorgaben, und
was danach entsteht, erbt sie.** Also dieselbe Frage für Tabellen statt
Funktionen.

`0420` setzt `grant select, insert, update, delete on tables to anon,
authenticated`. Der **einzige** Schutz einer neuen Tabelle ist damit ihre RLS.
Wer `alter table … enable row level security` vergisst, legt eine Tabelle an,
die für jeden mit dem öffentlichen `anon`-Schlüssel les- **und schreibbar** ist
— ohne Fehlermeldung, ohne roten Test.

Schwerer als der Funktionsfall: dort ging es um Aufrufbarkeit, hier um
Datenzugriff.

**Gemessen: alle Tabellen hatten RLS.** Es gab nur keinen Wächter. Jetzt RF.

Dazu RG für die verwandte Frage: keine SELECT-Policy lässt pauschal jeden durch
(`using (true)`). Einzige Ausnahme mit Grund: `reviews_select` — Bewertungen
sind ein öffentliches Reputationssignal, ein Kunde muss sie vor der
Beauftragung sehen können.

Beide Mutationen bilden den echten Hergang nach, nicht das Wegnehmen einer
Zeile: eine neue Tabelle ohne RLS, und eine neue Tabelle mit pauschaler
Lese-Policy. Beide rot.

### Was beim Messen sonst noch auffiel

Die vier Tabellen mit RLS und **ohne** Policy (`contract_payment_intents`,
`payout_operations`, `rate_limits`, `email_verifications`) sind gewollt:
Default-Deny, so auch in der Zugriffsmatrix. Sie fallen in die sichere
Richtung und brauchen keinen Wächter.

**`waitlist_insert_anyone` hat `with check (true)`** — die offene Anmeldung auf
der Startseite, gewollt und dokumentiert. Dabei ist aber etwas zu beachten, das
dem Founder gehört:

`lib/waitlist.ts` fügt **direkt** in die Tabelle ein und stößt die
Bestätigungsmail erst danach über die Edge Function an. Begrenzt ist damit nur
die **Mail** (3 pro Stunde je Adresse), nicht der **Eintrag**. Wer den
öffentlichen anon-Schlüssel hat, kann die Tabelle mit Einträgen fluten.

- **Kein Mail-Bombing:** die Mail läuft über die Edge Function und ist dort
  begrenzt.
- **Keine Werbemail an Müll-Einträge:** sie bleiben unbestätigt und fallen
  damit aus `warteliste_versand` heraus (0890).
- **Aber:** eine rohe Zeilenzahl von `waitlist` wäre als Nachfrage-Signal
  schönfärberisch. Die ehrliche Zahl steht in der Versand-Ansicht.

Nicht eigenmächtig geändert: den Eintrag über die Edge Function zu leiten oder
ein Captcha davorzusetzen ist eine Produktentscheidung mit Wirkung auf die
Anmeldestrecke der Startseite.
