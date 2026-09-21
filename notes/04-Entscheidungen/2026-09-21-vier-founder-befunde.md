# Vier Founder-Befunde vom Gerät, und einer davon war schon behoben

**Datum:** 21.09.2026
**Quelle:** drei Bildschirmfotos von `23mta23-cpu.github.io`, dazu vier Fragen.

## Der wichtigste Befund ist kein Fehler im Code

Die Bildschirmfotos zeigen die **Live-Seite**, und die wird von `main`
ausgeliefert. Auf dem Arbeits-Branch liegen **30 Commits**, die nicht gemergt
sind. Der Founder testet also eine Fassung, die mehrere Arbeitstage alt ist.

Gemessen:

```
origin/main            f74e32f
origin/main..HEAD      30 Commits
"Dringlichkeit" im Branch   0 Treffer
"Dringlichkeit" in main     1 Treffer
```

## 1. Zweimal nach der Dringlichkeit gefragt (bereits behoben, nicht live)

Schritt 2 hatte eine Chip-Reihe „Dringlichkeit" (Nicht dringend / Diese Woche
/ Heute-Morgen), Schritt 3 fragte dasselbe noch einmal als ganze Seite. Das
Feld aus Schritt 2 wurde erhoben, in den Entwurf geschrieben und **nie
abgeschickt**. Entfernt im Trichter-Block, liegt auf dem Branch.

## 2. „Schritt 2 von 4" beim ersten Bildschirm (jetzt behoben)

Wer über eine Kategorie-Kachel einsteigt, überspringt Schritt 1. Das ist
richtig so und geht auf früheres Founder-Feedback zurück („2 Seiten, die
dasselbe zeigen"). Gezählt wurde aber weiter absolut: der erste Bildschirm
meldete sich als „Schritt 2 von 4", und ein Balkensegment war schon grün,
ohne dass der Nutzer etwas getan hatte.

Gezählt wird jetzt ab dem Einstieg: „Schritt 1 von 3" über eine Kachel,
„Schritt 1 von 4" ohne Kategorie. Der Balken zeigt entsprechend 3 oder 4
Abschnitte.

**Beleg:** `scripts/schrittzaehler-check.cjs` misst beide Einstiege, Text UND
Balken. Gegenprobe mit der alten Zählweise: die zwei Zusicherungen für den
Kachel-Einstieg werden rot („steht da: Schritt 2 von 4"), die zwei für den
Einstieg ohne Kategorie bleiben grün. Genau so soll es sein, ein Rundumschlag
wäre hier kein Beleg.

## 3. Gewerbeschein-Zusage für Nachbarschaftshilfe (jetzt behoben)

Der Founder gab „4 Kartons müssen getragen werden" auf, also Umzugshilfe, und
las danach: „Wir leiten Ihre Anfrage an passende Betriebe mit geprüftem
Gewerbeschein weiter."

Auf dem Nachbarschaftsweg legt **niemand** einen Gewerbeschein vor
(`app/onboarding-kyc.tsx`). Geprüft wird die schriftliche
Volljährigkeitserklärung (Migration 0990), danach entscheidet ein Mensch im
Prüf-Postfach. Eine Ausweisprüfung findet bewusst nicht statt (§ 20 PAuswG).

Der Satz stand **zweimal als Literal** im Trichter, ohne jede Unterscheidung,
und ein drittes Mal auf der Startseite in genau dem Satz, der Einkauf und
Gartenhilfe aufzählt. Eine Zusage, die der eigene Code nicht einlöst, ist nach
§ 5 UWG angreifbar, und sie geht zulasten des Kunden: er glaubt, ein Gewerbe
stehe dahinter.

Jetzt `lib/empfaengerText.ts`, zwei Wege, zwei Sätze. Für Nachbarschaft:
„Helferinnen und Helfer aus der Nachbarschaft, die Werkant freigegeben hat."
Das ist belegbar, ohne zu verschweigen, dass geprüft wurde.

**Belege:** `__tests__/empfaengerText.test.ts` (4 Zusicherungen, darunter die
Gegenprobe, dass der Handwerksweg den Gewerbeschein weiterhin nennt, sonst
wäre „nirgends Gewerbeschein" der einfachste grüne Haken).
`scripts/versprechen-check.py` prüft die **Herkunft** im Quelltext, weil ein
Wertvergleich eine Bindung nicht beweisen kann. Zwei Mutationen (Satz bzw.
Hinweis wieder als Literal) werden rot, eine harmlose Umformulierung daneben
bleibt grün.

## 4. „Aufträge nicht anklickbar" (Rückfrage offen)

Gemessen:

- **Kundenseite:** die Auftragskarten unter „Aufträge" sind anklickbar und
  führen zu `/auftrag-detail`. Kein Befund.
- **Betriebsseite:** die Anfragen-Karten in `/betrieb/auftraege` sind **keine**
  Schaltflächen. Anklickbar sind nur „Angebot erstellen" und „Rückfrage
  stellen". Die Beschreibung ist dabei auf zwei Zeilen gekürzt
  (`numberOfLines={2}`), und es gibt **keinen Weg zum vollen Auftragstext**.
  Ein Betrieb entscheidet also über ein Angebot, ohne die ganze Anfrage lesen
  zu können.

Das ist ein echter Mangel, unabhängig davon, was gemeint war. Ob es der
gemeinte ist, ist offen: die Frage lautete „Aufträge im Satz", und das lässt
sich als „in der Suche", „im Chat" oder „in der Liste" lesen. Nicht gebaut,
bis die Stelle feststeht, sonst repariere ich den falschen Bildschirm.

## Nachtrag: die Stornierung erfand einen Auftrag

Beim Aufräumen des vierten Punktes ist der Block „`app/stornierung.tsx` lädt
den Vertrag gar nicht" drangekommen, und dabei kam etwas Schlimmeres heraus
als erwartet.

```ts
const title = jobTitle ?? 'Heizungswartung';
```

Der Bildschirm lud den Vertrag nicht, sondern nahm Titel und Termin aus
URL-Parametern. Fehlte der Titel, stand dort ein **Platzhalter**. Wer die
Adresse direkt aufrief, geteilt, als Lesezeichen oder nach einem Neuladen,
las „Heizungswartung" und stornierte scheinbar etwas, das es nicht gibt.

Dieselbe Klasse wie die erfundene Rechnung vom 16.08.2026. Nur greift
`geldwege-check.cjs` dort nach **Geldbeträgen und Zustandssätzen**, und ein
erfundener Auftragstitel ist keins von beidem. Der Prüfer stand direkt
daneben und konnte den Fall nicht sehen.

**Was jetzt gilt:** der Vertrag wird geladen. Titel und Termin kommen daraus,
die URL ist nur noch die Sofortanzeige, bis er da ist. Ohne Vertragsdaten ist
der Stornieren-Knopf gesperrt, mit Begründung. Und der **voraussichtliche
Betrag** steht jetzt VOR dem Schritt statt erst danach, ausdrücklich als
voraussichtlich gekennzeichnet, weil verbindlich die Edge Function rechnet und
die Stufe an der Zeit hängt.

Kein Befund war dagegen `OHNE_TERMIN_STUNDEN = 72`: das ist eine bewusste
Regel, die mit dem Server übereinstimmt (kein Termin vereinbart heißt volle
Erstattung). Nachgesehen statt angenommen.

**Prüfer erweitert:** `geldwege-check.cjs` liest die Gewerke-Namen aus
`data/categories.ts` (25 Stück, eine Quelle, nicht abgeschrieben) und sichert
zu, dass kein Geld-Bildschirm mit einer Null-Kennung ein Gewerk nennt. Es gibt
dort keinen Vorgang, also auch kein Gewerk, das er betreffen könnte. Eine
Untergrenze im Skript verhindert, dass ein kaputter Auszug still grün wird.

## Nachtrag 2: mein neuer Prüfer sah den Fall nicht, für den ich ihn baute

Die Gewerke-Regel in `geldwege-check.cjs` war die naheliegende Absicherung:
ein Geld-Bildschirm mit einer Null-Kennung darf kein Gewerk nennen. Gemessen
über alle neun Bildschirme: grün, kein Fehlalarm. Mutation mit einem echten
Gewerke-Namen („Elektro"): rot, also keine Attrappe.

**Und trotzdem blieb die eigentliche Mutation grün.** „Heizungswartung" steht
in keiner Gewerke-Liste. Der Prüfer, den ich für genau diesen Platzhalter
gebaut hatte, konnte ihn nicht sehen.

Im Browser ist das auch nicht zu beheben: ein erfundener Auftragstitel ist
dort von einem echten nicht zu unterscheiden. **Im Quelltext schon**, denn
dort ist er ein Rückfall auf ein Literal. Die Bindung prüft jetzt
`versprechen-check.py`: kein Ersatztitel, und der Vertrag muss geladen werden.
Beide Mutationen rot, harmlose Umformulierung grün.

Beide Regeln bleiben. Sie decken verschiedene Fälle ab, und keine ersetzt die
andere.

## Nachtrag 3: der alte Prüfer fand einen Fehler in meinem Fix

Die erste Fassung des Stornierungs-Fixes kannte nur zwei Zustände, geladen und
Fehler, und ließ deshalb dauerhaft „Auftrag wird geladen …" stehen, auch wenn
der Versuch längst gescheitert war. Zwei bestehende Zusicherungen in
`geldwege-check.cjs` wurden dafür zu Recht rot:

```
FAIL  Stornierung: entscheidet sich binnen 9 Sekunden
FAIL  Stornierung: haengende Verbindung blockiert nicht dauerhaft
```

Jetzt drei Zustände (lädt / unbekannt / geladen) und eine Zeitgrenze um den
Ladeversuch, wie sie `app/zahlung.tsx` schon hatte. Ein Bildschirm, der ewig
„wird geladen" sagt, ist auf einem Geld-Weg genau die Unklarheit, die dort
niemand aushalten muss.

## Nachtrag 4: dieselbe Falle beim Angebot, und dort geht es um einen Preis

Nachdem die Stornierung behoben war, habe ich die Klasse systematisch gesucht
statt sie für erledigt zu halten:

```bash
grep -rnE "(title|name|jobTitle|business_name)[^,;]{0,40}\?\?\s*'[A-ZÄÖÜ][^']{3,}'" app/ components/
```

Zwanzig Treffer, und die meisten sind **in Ordnung**: `?? 'Anbieter'`,
`?? 'Auftrag'`, `?? 'Helfer'`, `?? 'Name fehlt'` behaupten nichts Konkretes.
„Anbieter" statt eines Namens sagt ehrlich „ein Anbieter, Name unbekannt".

Einer war es nicht, und er wiegt schwerer als der ursprüngliche Befund:

```ts
// app/betrieb/angebot-erstellen.tsx
<Row label="Leistung" value={job?.title ?? 'Handwerksleistung'} />
```

`getJobById` gibt bei einem Netzfehler `null` zurück, das danebenstehende
`.catch` feuerte deshalb nie, und `isValid` hing nicht am Auftrag. **Ein
Betrieb konnte ein bindendes Angebot mit Preis auf einen Auftrag abgeben, den
er nie gesehen hat.** Auf dem Nachbarschaftsweg ist „Handwerksleistung"
zusätzlich falsch.

Gleiche Behandlung wie dreimal zuvor: laden mit Zeitgrenze, drei Zustände,
kein Ersatztitel, Knopf gesperrt mit Begründung.

**Der Prüfer deckt jetzt die Klasse ab, nicht die Stelle.** Fünf Bildschirme
mit verbindlicher Handlung (stornieren, bieten, freigeben, reklamieren,
zahlen), dazu eine **Positivliste** neutraler Ersatzwörter. Wer ein neues
einführt, trägt es ein, und die Entscheidung wird dadurch sichtbar.

Drei Mutationen rot (beide Platzhalter, Auftrag wird nicht mehr geladen), zwei
Gegenproben grün, darunter ausdrücklich „ein neutrales Ersatzwort bleibt
erlaubt". Ohne diese zweite Gegenprobe wäre „jeder Ersatz ist verboten" der
einfachste grüne Haken gewesen, und zwanzig harmlose Stellen hätten
umgeschrieben werden müssen.

**Nicht behoben, notiert:** `app/vertrag.tsx` zeigt `?? 'Dienstleistung'`.
Generisch, also nach obiger Regel erlaubt, aber in einem **Vertrag** steht
damit kein Leistungsgegenstand. Das ist eine vertragsrechtliche Frage und ein
eigener Block.
