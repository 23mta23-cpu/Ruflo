# Materialkosten: Teil des Preises oder eigener Posten?

**Stand:** 08.09.2026 · **Auftrag:** Founder („was macht am meisten sinn bitte
als co ceo cto und cco und coo prüfen") · **Status:** Empfehlung, Entscheidung
offen

Anlass war ein Fehler, kein Konzept: der Anbieter-Bildschirm versprach bei
230 € Preis und 100 € Material eine Auszahlung von 311,60 €, während der Kunde
230 € zahlt und beim Anbieter 211,60 € ankommen. Behoben in `ca7e780`. Die
Frage dahinter ist aber echt und teurer als der Fehler.

---

## Die eigentliche Frage ist nicht, wo das Material steht

Sie lautet: **worauf wird die Provision erhoben?** Material im Preis heißt
Provision auf Material. Das ist der ganze Streitpunkt.

Gerechnet mit der heutigen Regel (8 % vom Auftragswert, mindestens 3 €,
serverseitig in Migration `0110`):

| Auftrag | Material | Arbeit | Gebühr | Gebühr in % der **Arbeit** |
|--------:|---------:|-------:|-------:|---------------------------:|
| 230 €   | 100 €    | 130 €  | 18,40 €  | 14,2 % |
| 500 €   | 150 €    | 350 €  | 40,00 €  | 11,4 % |
| 1.500 € | 700 €    | 800 €  | 120,00 € | 15,0 % |
| 3.000 € | 1.800 €  | 1.200 €| 240,00 € | **20,0 %** |
| 8.000 € | 5.000 €  | 3.000 €| 640,00 € | **21,3 %** |
| 15.000 €| 10.000 € | 5.000 €| 1.200,00 €| **24,0 %** |

Die beworbenen „nur 8 %" sind bei materialstarken Gewerken faktisch 20 % und
mehr auf die Wertschöpfung. Das ist die Zahl, die ein Dachdecker rechnet.

---

## Die drei Bauformen

**A. Material ist Teil des Angebotspreises** (heute, seit `ca7e780`).
Ein Betrag im Escrow, der Materialanteil wird nur ausgewiesen.

**B. Material ist ein eigener, provisionsfreier Posten.**
Zwei Beträge, zwei Regeln, zwei Wege durch Escrow, Storno und Streitfall.

**C. Material bleibt im Preis, aber die Provision bekommt eine Obergrenze.**
Eine Zahl mehr in der Gebührenformel, sonst ändert sich nichts.

---

## Bewertung aus den vier Rollen

### CTO: B ist keine Spalte, B ist ein zweiter Geldweg

Die Datenbankspalte ist der billigste Teil. Teuer wird, was danach kommt:

- `accept_offer` (0110) müsste zwei Beträge bilden und zwei Auszahlungen
  vorbereiten.
- `release-escrow` müsste teilweise freigeben können.
- `cancel-contract` müsste entscheiden, **ob Material erstattet wird**. Das
  Material ist oft gekauft und zugeschnitten. Es gibt keine richtige Antwort,
  die eine Funktion treffen kann, also wird jeder Storno ein Einzelfall.
- `stripe-webhook` müsste Teilerstattungen und Teil-Chargebacks unterscheiden.

Jede dieser Stellen ist ein Ort, an dem Geld still falsch fließt. Die
Projektgeschichte zeigt, wie oft genau das passiert ist. **Empfehlung: B jetzt
nicht bauen.**

### CFO/CCO: die Gebührenbasis ist der Hebel, nicht der Ort des Materials

Drei Wege, das 20-Prozent-Problem zu lösen:

| Weg | wirkt | manipulierbar | Aufwand |
|---|---|---|---|
| Gebühr nur auf den Arbeitsanteil | ja | **ja** | mittel |
| Gebühr auf alles, mit Kappe | ja | nein | **eine Zeile** |
| Gebühr auf alles wie bisher | nein | nein | keiner |

Der Arbeitsanteil ist **selbst deklariert**. Bei Gebühr null auf Material
heißt jedes Angebot binnen weniger Wochen „3.000 €, davon 2.900 € Material".
Prüfen ließe sich das nur mit Belegen, und Belegprüfung ist ein Geschäft, in
dem Werkant nicht ist. Die Kappe ist der einzige Weg, der wirkt **und** nicht
manipulierbar ist.

Mit einer Kappe von 250 €:

| Auftrag | Gebühr heute | Gebühr mit Kappe | in % der Arbeit |
|--------:|-------------:|-----------------:|----------------:|
| 3.000 € | 240 €        | 240 € (greift nicht) | 20,0 % |
| 8.000 € | 640 €        | **250 €**        | 8,3 % |
| 15.000 €| 1.200 €      | **250 €**        | 5,0 % |

Die Kappe greift ab 3.125 € Auftragswert. Darunter ändert sich nichts, also
auch nichts am Umsatz aus dem heutigen Kerngeschäft.

Zum Vergleich: MyHammer nimmt 8 bis 12 % ohne Kappe plus Lead-Gebühren,
Check24 verlangt 50 bis 120 € **pro Anfrage**, unabhängig vom Ergebnis. 250 €
Deckel bleibt deutlich konkurrenzfähig.

### COO: B erzeugt Handarbeit, die zwei Leute nicht leisten

- **Mit A + Ausweisung** ist die Materialangabe reine Information. Sie macht
  Angebote vergleichbar und beugt der Frage „warum ist das so teuer" vor.
  Kein Vorgang entsteht daraus.
- **Mit B** wird jeder Storno zum Einzelfall: Material gekauft oder nicht,
  rückgabefähig oder nicht, wer trägt die Differenz. Das ist genau die
  Fallart, die eine Zwei-Personen-Mannschaft erstickt.

### CEO: eine Zahl, ein Versprechen

Die Marke steht auf „8 %, keine Überraschungen, alles über die Plattform".

- **B** macht daraus zwei Zahlen und eine Lücke. Die Lücke wird benutzt, der
  Umsatz bricht weg, und das Versprechen wird in die andere Richtung unwahr.
- **A ohne Kappe** lässt das Versprechen bei großen Aufträgen unglaubwürdig
  werden: 24 % auf die Arbeit sind keine 8 %.
- **A mit Kappe** bleibt ein Satz: „8 %, höchstens 250 € pro Auftrag." Das ist
  besser als das, was die Wettbewerber sagen können.

Der strategische Punkt: **eine hohe effektive Rate auf Material erzeugt genau
den Anreiz, der das Kernprodukt zerstört.** Wer 640 € Provision auf ein
Dach zahlen soll, rechnet das Material an der Plattform vorbei. Dann ist der
größere Teil der Summe nicht mehr über Escrow gesichert, der Kunde verliert
den Schutz, und Werkant verliert die Gebühr trotzdem. Die Kappe kauft
Escrow-Abdeckung, sie kostet nicht nur Marge.

---

## Empfehlung

1. **A behalten.** Material bleibt Teil des Angebotspreises und wird
   ausgewiesen. Ist umgesetzt.
2. **Kappe auf die Provision einführen, Startwert 250 €.** Eine Zeile in
   `accept_offer` (`least(greatest(v_price * 0.08, 3.00), 250.00)`) plus die
   Anzeige in `angebot-erstellen.tsx`, `zahlung.tsx`, `rechnung.tsx` und auf
   der Startseite.
3. **B nicht bauen.** Der Nutzen von B (faire Gebührenbasis) entsteht über die
   Kappe ohne die Kosten von B.
4. **Später prüfen: Materialvorschuss.** Der echte Schmerz bei großen
   Aufträgen ist die Vorfinanzierung, nicht die Provision. Ein Teilabruf gegen
   Materialnachweis löst das. **Rechtlicher Vorbehalt:** eine Auszahlung vor
   Leistungserbringung berührt die ZAG-Frage, die ohnehin beim Anwalt liegt.
   Nicht vor dieser Klärung anfassen.

## Was an dieser Empfehlung unsicher ist

Es gibt **null Transaktionsdaten**. Die 250 € sind aus den Gewerkestrukturen
hergeleitet, nicht gemessen. Eine Kappe lässt sich später schwer anheben, ohne
dass es wie eine Preiserhöhung wirkt. Deshalb bewusst ein Wert, der selten
greift.

**Überprüfungspunkt:** nach den ersten 100 abgeschlossenen Aufträgen
auswerten, wie viele über 3.125 € lagen und wie hoch der Materialanteil war.
Erst dann ist die Zahl belegt statt geschätzt.
