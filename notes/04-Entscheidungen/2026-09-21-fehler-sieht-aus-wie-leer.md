# Ein Fehler, der aussieht wie „da ist nichts"

**Datum:** 21.09.2026
**Anlass:** Beim Bauen der Fehlerzustand-Prüfung für die Berührflächen
aufgefallen: der Fehlerzustand von `/betrieb/nachrichten` ließ sich gar nicht
herstellen.

## Die Fehlerklasse

Eine Abfrage schlägt fehl, die Hilfsfunktion fängt den Fehler und gibt den
NEUTRALEN Wert zurück: leere Liste, leeres Objekt, `null`. Der Bildschirm
kann dann nicht mehr unterscheiden zwischen „es gibt nichts" und „ich weiß es
nicht" und sagt das Erste. Der Fehlerzweig, den derselbe Bildschirm sorgfältig
gebaut hat, ist unerreichbar.

Verwandt mit „ein Knopf ohne `onPress`" und mit „eine Prüfung, die den Fehler
nicht sehen kann, den sie verhindern soll". Hier ist es ein Bildschirm, der
den Fehler nicht sehen kann, für den er einen eigenen Zustand hat.

## Drei Stellen, drei Schweregrade

**1. Die Posteingänge (behoben, mit Prüfer).**
`getConversationList` und `getProviderConversationList` hatten beide
`if (error || !data?.length) return []`. In beiden aufrufenden Bildschirmen
steht im `catch` der Kommentar „Netzfehler nicht als ‚Keine Nachrichten'
tarnen". Genau das tat der Code darunter. Für den Nutzer: sein Posteingang
lädt nicht, und die App sagt ihm, niemand habe ihm geschrieben.
Jetzt `if (error) throw error;` vor der Leerprüfung.
Nachgehalten in `scripts/fehler-nicht-als-leer-check.cjs`: die Abfrage
antwortet absichtlich mit 500, und geprüft wird, dass der Fehlertext dasteht
UND der Leer-Text NICHT. Ohne die zweite Hälfte wäre der alte, lügende
Zustand bestanden.

**2. `app/auftrag-abschliessen.tsx` (behoben).**
Der Bildschirm rendert das ganze Formular auch ohne geladenen Vertrag, nur mit
Platzhaltern statt Zahlen. Wer hier vier Haken setzt, bestätigt „vollständig
und mängelfrei" und gibt Geld frei, ohne je gesehen zu haben, worüber. Der
Freigabeknopf hängt jetzt zusätzlich an `contract`, und ein Hinweis oben sagt,
warum nichts geht.

**3. `app/reklamation.tsx` (behoben).**
Eine Reklamation friert den Treuhandbetrag ein (0770). Auch das ging ohne
geladenen Vertrag. Gleiche Behandlung.

## Was bewusst offen bleibt

- **`app/stornierung.tsx` lädt den Vertrag überhaupt nicht.** Die Erstattung
  erscheint erst NACH dem unumkehrbaren Schritt. Das ist keine Fehlerbehebung,
  sondern ein Stück Funktion mit Geldanzeige. Eigener Block.
- **`app/bewertung.tsx`** lässt die Abgabe ohne geladenen Vertrag zu. Geringes
  Risiko, deshalb nicht in denselben Block gepackt.
- **`lib/strikes.ts`** gibt bei Fehler eine leere Liste. Ein Betrieb mit zwei
  Verstößen sieht dann ein sauberes Dashboard. Die Sperre selbst wirkt
  serverseitig, die Warnung fehlt nur.
- **`lib/benachrichtigungen.ts`** gibt bei Fehler 0 zurück. Das ist ABSICHT
  und bleibt: ein Punkt an der Glocke, hinter dem nichts steht, schickt den
  Nutzer auf einen leeren Bildschirm.

## Nebenher: die selbst gebauten Schalter

Zwei Schalter sind aus Views gebaut statt aus dem `<Switch>` von React Native
(Analyse-Einwilligung, „Nur sofort buchbare Anbieter"). Beide trugen
`accessibilityRole="button"`: eine Bedienungshilfe hörte „Knopf" und erfuhr
nie, ob der Schalter an oder aus ist. Bei der Analyse-Einwilligung ist das
eine datenschutzrechtliche Angabe.

Jetzt `role="switch"` mit `accessibilityState` und sprechendem Label.
`scripts/schalter-rolle-check.cjs` drückt den Schalter und prüft, dass
`aria-checked` KIPPT. Ein fest hingeschriebenes `checked` wäre sonst genauso
grün.

## Nachtrag: der neue Prüfer hat sofort meinen eigenen Fix zerlegt

Beim ersten Lauf von `scripts/schalter-rolle-check.cjs`:

```
PASS  meldet sich als Schalter
FAIL  nennt seinen Zustand  -- aria-checked=null
FAIL  der Zustand geht beim Drücken mit  -- null -> null
```

`accessibilityState={{ checked }}` kommt auf react-native-web **überhaupt
nicht** im DOM an. Nachgesehen statt geraten, in
`node_modules/react-native-web/dist/modules/createDOMProps`: die Liste der
durchgereichten Namen kennt `aria-checked` und das veraltete
`accessibilityChecked` — `accessibilityState` steht nicht darin.

Der Schalter hätte also seine Rolle gemeldet und seinen Zustand nie. Genau der
Fall, für den ich den Prüfer geschrieben hatte („eine Angabe lässt sich
hinschreiben, ohne dass sie wirkt") — nur dass ich selbst hineingelaufen bin.
Ein Quelltext-Prüfer hätte die Zeile gesehen und wäre zufrieden gewesen.

**Betroffen waren nicht zwei Stellen, sondern 14.** `accessibilityState` stand
über die ganze App verteilt: Auswahl-Kacheln bei der Registrierung, Gewerke im
Betriebsprofil, Kalendertage, Meldegründe, Haken in `melden.tsx`. Auf dem
ausgelieferten Web-Build (GitHub Pages) hat keine davon je etwas gemeldet.

Alle 14 auf `aria-checked` / `aria-selected` / `aria-disabled` umgestellt. Die
gibt es seit React Native 0.71 auch nativ (hier 0.85) — **eine** Schreibweise
für beide Plattformen statt zwei.

Neu in `scripts/web-untaugliche-api-check.py`, also derselbe Prüfer, der schon
`Alert.alert` und `Share.share` abfängt. Es ist dieselbe Familie: typseitig
gültig, auf dem Gerät richtig, im Web wirkungslos. Mutation (alte Schreibweise
zurück) wird rot, Gegenprobe (das Wort nur im Kommentar) bleibt grün.

## Nachtrag 2: die Gegenprobe zum Posteingang-Fix

`lib/messages.ts` auf die alte Fassung zurückgesetzt, neu exportiert, Prüfer
laufen lassen:

```
FAIL  Posteingang Kunde: nennt den Fehler
FAIL  Posteingang Kunde: behauptet NICHT, es gebe nichts
      -- sagt „Keine Nachrichten", obwohl die Abfrage fehlschlug
FAIL  Posteingang Betrieb: nennt den Fehler
FAIL  Posteingang Betrieb: behauptet NICHT, es gebe nichts
      -- sagt „Noch keine Konversationen", obwohl die Abfrage fehlschlug
```

Vier von vier rot, danach byte-gleich zurückgesetzt. Der Prüfer kann den
Fehler sehen, den er verhindern soll.
