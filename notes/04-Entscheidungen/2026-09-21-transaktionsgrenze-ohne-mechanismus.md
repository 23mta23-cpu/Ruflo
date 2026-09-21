# Eine Obergrenze, die es nur im Text gab

Stand 21.09.2026, nachts. Dritte Anwendung derselben Methode: eine
Zusagen-Klasse vollständig auszählen und jede Stelle gegen den Code halten.
Nach den Prüf-Behauptungen (62 Stellen) und den Zeitzusagen (76 Stellen) nun
die **Beträge und Prozentsätze**: 180 Stellen, 34 verschiedene Werte.

## Der Befund

`app/garantie.tsx` sagte als Tatsache:

> „Im Beta liegt das Transaktionslimit bei 5.000 € pro Auftrag, beim Launch
> bei 25.000 € (mit Gewerbeschein-Verifizierung beim Anbieter)."

Gemessen gab es **keine Grenze**:

| Stelle | Befund |
|---|---|
| `lib/offers.ts`, `angebot-erstellen.tsx` | keine Obergrenze |
| `create-payment-intent/handler.ts` | nimmt `contract.customer_total` und belastet es, ohne Obergrenze |
| Datenbank | allein `check (price > 0)` aus 0040 |

Ein Angebot über 40.000 € wäre durchgegangen, und der Treuhandbetrag hätte in
derselben Höhe auf dem Konto gelegen.

Dieselbe Klasse wie die Haftpflicht (14.09.) und die Meisterpflicht (20.09.):
eine Zusage über eine Schutzvorrichtung, die es nicht gab. Hier kommt ein
zweites hinzu: **ein unbegrenzter Treuhandbetrag verschärft die offene
ZAG-Frage.** Je größer der gehaltene Betrag, desto näher liegt die Einordnung
als erlaubnispflichtiges Zahlungsgeschäft.

## Was jetzt dasteht

- `lib/transaktionsgrenze.ts` mit der Zahl, dem Text und `ueberGrenze()`.
- **Migration 1000**: `check (price <= 5000)` auf `offers`, bewusst als
  `not valid`. Die Bedingung gilt ab sofort für jedes neue **und jedes
  geänderte** Angebot, aber der Bestand wird nicht rückwirkend ungültig: ein
  Vertrag, der unter der alten Lage zustande kam, soll nicht daran scheitern,
  dass Werkant später eine Grenze eingezogen hat.
- Das Angebotsformular sagt es **vorher** und sperrt den Knopf. Ohne das hätte
  der Betrieb gesendet und einen rohen Datenbankfehler bekommen. Genau dieses
  Muster steht seit dem 16.09. im Kommentar daneben: „Die Oberfläche darf
  nicht großzügiger sein als die Datenbank." Jetzt gilt es auch nach oben.
- Die Garantie-Seite holt die Zahl aus dem Modul.

**Die 25.000 € zum Launch sind ersatzlos raus.** Eine Zahl für einen Zustand,
den es noch nicht gibt, ist wieder eine Zusage ohne Mechanismus.

## Der eigentliche Weg vorbei war nicht das hohe Angebot

Sondern die **Änderung**: niedrig einstellen, annehmen lassen, dann hochsetzen.
`not valid` verhindert das trotzdem, weil die Bedingung für jede geänderte
Zeile gilt. Das prüft TG4, und ohne diese Zusicherung wäre die Grenze eine
Attrappe.

## Prüfungen

- `scripts/db-test/transaktionsgrenze.sql`: 5 Assertions, davon 3
  Gegenproben (genau auf der Grenze, ein gewöhnliches Angebot, das Ändern
  unterhalb). Gesamt 353.
- `scripts/transaktionsgrenze-check.py`: hält Code und Datenbank aneinander,
  5/5 mutationsgeprüft.
- `__tests__/transaktionsgrenze.test.ts`: 5 Tests, darunter der Rand
  (einschließlich 5.000) und `NaN` aus einem leeren Feld.
- Reise 4 prüft jetzt, dass das Formular es **vorher** sagt und den Knopf
  sperrt (B0, B0b).

## Und ein Beleg, den ich zuerst aus der falschen Datei geholt habe

Für „die Edge Functions prüfen nichts" hatte ich
`create-payment-intent/index.ts` durchsucht: 27 Zeilen, und der Grep lief ins
Leere. Aus einem leeren Grep folgt aber nichts — die Datei delegiert
ausdrücklich an `handler.ts`, und **genau diese Falle steht in CLAUDE.md**
(„nicht nur `index.ts`").

Beim Nachsehen im richtigen File stand die Antwort dann wirklich da: Zeile 150
nimmt `contract.customer_total`, rechnet in Cent und belastet den Betrag —
ohne jede Grenze. Das Ergebnis hat sich also nicht geändert, aber ich hatte es
vorher **geraten und nicht gewusst**. Ein richtiger Befund aus einer falschen
Messung ist ein Zufall, und beim nächsten Mal fällt er andersherum aus.

## Der Fehlalarm, den ich fast gemeldet hätte

Mein Muster las „2,5%" aus den AGB als „5%" und meldete einen Widerspruch zur
Provision. Es gibt keinen: 2,5 % ist die Servicegebühr des **Kunden**, 8 % die
Provision des **Anbieters**, und beide sind über `feeEngine` gebunden. Ein
Befund aus einem schlampigen Regex ist keiner, und ihn ungeprüft zu melden
hätte Vertrauen gekostet, das ein Prüfer braucht.
