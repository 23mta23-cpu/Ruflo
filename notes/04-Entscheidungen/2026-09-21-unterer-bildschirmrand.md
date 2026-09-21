# Fester Abstand am unteren Bildschirmrand ersetzt (Apple HIG)

**Datum:** 21.09.2026
**Anlass:** Founder-Anweisung `/apple-hig`.

## Befund

Dreizehn Bauteile sitzen auf dem unteren Bildschirmrand und hatten dort eine
feste Zahl stehen:

| Bauform | Bildschirm | Wert vorher |
|---|---|---|
| Aktionsleiste | vertrag, zahlung, bewertung, stornierung, anbieter, auftrag-abschliessen | 28 |
| Aktionsleiste | angebot | 32 |
| Blatt von unten | chat (Meldung) | 28 |
| Blatt von unten | betrieb/profil | 36 |
| Blatt von unten | betrieb/auftraege, betrieb/dashboard | 40 |
| Blatt von unten | DsgvoConsent | 36 |
| Blatt von unten | suche (Filter) | keiner |

Alle dreizehn tragen den wichtigsten Knopf des jeweiligen Bildschirms: zahlen,
Angebot senden, Auftrag abschliessen, bewerten, stornieren, Vertrag
bestaetigen, Anfrage stellen, Filter anwenden, Einwilligung erteilen.

## Warum jede dieser Zahlen falsch ist

Der geschuetzte Bereich unten ist geraeteabhaengig:

- iPhone mit Hausknopf, Android mit drei Knoepfen: **0**. Die 28 bis 40 px
  sind dann tote Flaeche.
- iPhone ab X, Android mit Gestensteuerung: **34 px**. Wer 28 setzt, laesst
  den Knopf INNERHALB des Streifens enden, in dem das System die Wischgeste
  abfaengt. Apple HIG („Layout", Safe Areas) sagt dazu ausdruecklich: keine
  Bedienelemente in den Bereich der Home-Anzeige.

Der Filter-Schieber in `suche` hatte gar keinen Abstand -- „Filter anwenden"
endete buendig am Bildschirmrand.

## Entscheidung

`lib/sichererRand.ts` -> `aktionsleistenRand(insets.bottom)`:
`16 + unterer Rand`, mit 16 als Boden. Die 16 ist derselbe Wert, den die
Leisten ohnehin als `padding` tragen -- auf einem Geraet ohne geschuetzten
Bereich wird die Leiste damit rundum gleich, statt unten schwer zu sein.

Die Leiste bleibt bewusst AUSSERHALB einer `SafeAreaView` mit unterer Kante:
sonst entstuende unter ihr ein Streifen Hintergrund, und sie reichte nicht
mehr bis zum Rand. Der Abstand gehoert in die Leiste selbst.
`app/chat.tsx` macht es mit `edges={['top','bottom']}` anders und richtig --
dort liegt die Eingabezeile im Fluss, nicht absolut.

## Wie das belegt ist, und wie nicht

- **Rechnung:** `__tests__/sichererRand.test.ts`, 4 Zusicherungen.
  Vier Mutationen (Rand ersetzt statt addiert, Grundabstand 0, Schutz gegen
  unsinnige Werte entfernt, alter Festwert 28 zurueck) werden alle rot.
- **Verdrahtung:** `scripts/sichere-aktionsleiste-check.py` (CI + run.sh).
  Drei Mutationen rot, zwei harmlose Gegenproben gruen. 13 Bauteile gefunden;
  eine Untergrenze im Skript verhindert, dass „0 Befunde" mit einer leeren
  Auswahl vereinbar ist.
- **NICHT belegt: die Wirkung am Geraet.** react-native-web meldet
  `useSafeAreaInsets().bottom` ueberall als 0. Der reparierte und der kaputte
  Zustand sind im Browser-Pruefstand nicht unterscheidbar. Dafuer braucht es
  ein iPhone mit Home-Anzeige. Ein Wertvergleich kann eine Verdrahtung nicht
  beweisen, wenn beide Seiten denselben Wert liefern -- deshalb der
  Quelltext-Pruefer und nicht noch eine Browser-Zusicherung.

## Sichtbare Nebenwirkung im Web

Auf Web und Desktop (kein geschuetzter Bereich) wird der Abstand unter den
Leisten kleiner: 28 bis 40 werden zu 16. Das ist gewollt. Der bisherige Wert
war eine grobe Schaetzung des geschuetzten Bereichs und auf jedem Geraet ohne
Home-Anzeige schlicht Leerraum.
