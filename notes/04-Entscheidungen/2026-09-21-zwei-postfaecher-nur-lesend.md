# Zwei Postfächer, ausdrücklich nur lesend

Stand 21.09.2026, morgens. Fortsetzung des Blocks von heute Nacht: dort kam
heraus, dass `disputes` und `inhalts_meldungen` geschrieben und von niemandem
gelesen werden, und dass eine offene Reklamation den Treuhandbetrag einfriert
(0770 bricht die Auszahlung mit `dispute_open` ab).

Die Empfehlung von damals war, `/pruefung` um zwei Postfächer zu erweitern,
**zunächst nur lesend**. Genau das steht jetzt da.

## Was der Betreiber sieht

Unter der Verifizierungsliste zwei Abschnitte:

- **Reklamationen**: Kategorie, Fallnummer, Wartezeit, **der eingefrorene
  Betrag**, ein gekürzter Auszug der Beschreibung, und eine Marke
  „Heute fällig" / „Überfällig" gegen die zugesagten zwei Werktage.
- **Inhalts-Meldungen**: Art, Melder, Wartezeit, Fundstelle, gekürzte
  Begründung, dieselbe Marke gegen 24 Stunden.

Der Betrag ist die Zahl, die handeln lässt: *so viel Geld liegt fest, solange
niemand entscheidet.*

## Was ausdrücklich NICHT dasteht

**Kein Entscheidungsknopf.** Eine Entscheidung über eine Reklamation bewegt
Geld (voll erstatten, teilweise, freigeben); das ist ein Produktentwurf mit
Geldfolgen und gehört dem Founder. Entschieden wird vorerst im
Supabase-Dashboard, und der Bildschirm sagt das auch.

Nachgehalten als Zusicherung D5: *es gibt keinen Entscheidungsknopf in diesen
Abschnitten.* Eine Grenze, die man nur vorhat, ist keine.

## Die Zusicherung, auf die es ankommt

**D0: „Nichts offen" darf nicht dastehen, solange etwas anderes wartet.**

Der Leerzustand hing vorher allein an der Verifizierungsliste. Mit leerer
Liste und einer offenen Reklamation hätte der Bildschirm „Nichts offen"
gemeldet, während 640 € festliegen. Die Mutationsprobe M2 (Leerzustand wieder
blind für die anderen Warteschlangen) macht genau diese Zeile rot.

## Zwei eigene Fehler, beide vom selben Typ

**Mein Rekorder war zu grob.** Teil C der Reise zeichnet auf, welche
Entscheidungen hinausgehen, und sammelte dafür „alles außer `liste`". Mein
neuer Lese-Aufruf `wartendes` landete damit im selben Topf, und C3/C5 sahen
auf den falschen Eintrag. **Ein Rekorder, der „alles außer X" sammelt, fängt
jede spätere Erweiterung mit.** Er hört jetzt auf eine Positivliste.

**Und meine eigene Zusicherung war grün aus dem falschen Grund.** D3 prüfte
„die Reklamation ist als überfällig markiert" gegen den GANZEN Bildschirm. Die
DSA-Meldung darunter war ebenfalls überfällig und erzeugte das Wort. Erst als
ich den Abschnitt herausschnitt, zeigte sich: die Reklamation war mit 96
Stunden je nach Wochentag nur „Heute fällig", nicht überfällig. Zwei Fehler in
einer Zusicherung, und beide hätte ich ohne das Herausschneiden nie gesehen.

Korrigiert: 14 Tage statt 96 Stunden (an jedem Wochentag eindeutig), und die
Prüfung liest nur den Reklamations-Abschnitt.

## Werktage, und warum keine Feiertage

`werktageDazwischen` überspringt Samstag und Sonntag, kennt aber keine
Feiertage. Das ist eine Entscheidung, keine Lücke: ein Feiertagskalender für
16 Bundesländer wäre eine eigene Abhängigkeit, und die Zahl sortiert ein
Postfach, sie berechnet keine Frist vor Gericht. Steht so im Code.

Ohne das Überspringen wäre jede Freitagsmeldung am Montagmorgen „überfällig",
und der Betreiber gewöhnt sich an rote Zeilen, die keine sind. Bei den
DSA-Meldungen ist es umgekehrt: Art. 16 sagt „zeitnah", nicht „an Werktagen" —
dort zählen Stunden, auch am Wochenende.

## Prüfungen

- `__tests__/wartendes.test.ts`: 14 Tests, Mutationsproben **7/7**.
- Reise 7: D0 bis D6 und E1/E2 neu. Mutationsproben am Bildschirm: Abschnitte
  entfernt → 5 rot; Leerzustand blind → D0 rot; Kommentar geändert → grün.
- tsc 0, `deno check` grün, Jest 750 Tests, db-test 353.
