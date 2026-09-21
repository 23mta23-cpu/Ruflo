# Die Prüfer hatten nie ein Blatt geöffnet und nie einen Fehler gesehen

**Datum:** 21.09.2026
**Anlass:** Founder-Anweisung `/apple-hig`, Fortsetzung.

## Zwei blinde Flecken, beide seit es die Prüfer gibt

`beruehrflaeche-check.cjs` und `kontrast-check.cjs` laden einen Bildschirm und
messen, was zu sehen ist. Sie haben nie etwas angetippt. Damit blieben
unsichtbar:

1. **Sechs Blätter von unten und ein Filter-Schieber.** Darunter das
   Einwilligungs-Blatt, der erste Bildschirm, den überhaupt jemand sieht. Alle
   anderen Prüfer räumen es per `localStorage` weg, um an den Bildschirm
   dahinter zu kommen.
2. **Fehler- und Leerzustände.** Mit Sitzungs-Ersatz antwortet der Prüfstand
   brav, ohne ihn steht „Nicht angemeldet" da. Der Zweig mit
   „Erneut versuchen" war auf keinem Weg erreichbar.

Dieselbe Klasse wie am 16.09.: „Ein Prüfer, der einen Reiter nie antippt,
sieht die Hälfte nicht."

## Was gemessen wurde, nachdem sie hinsehen konnten

**38 Berührflächen unter 44x44** (Apple HIG, WCAG 2.5.5):

| Ort | Größe | Was |
|---|---|---|
| Einwilligungs-Blatt | 324x23 | die drei Zeilen „Notwendig", „Analyse", „PStTG / DAC7" |
| Einwilligungs-Blatt | 38x22 | der selbst gebaute Schalter |
| Filter-Schieber `/suche` | 33 hoch | 17 Gewerke-Chips und 5 Bewertungsknöpfe |
| Filter-Schieber `/suche` | 84x16 | „Zurücksetzen" (das `hitSlop` daran wirkt im Web nicht) |
| `/betrieb/auftraege` | 35 hoch | „Chat", „Stornieren", „Fertig" auf jeder Auftragskarte |
| `/betrieb/profil` | 22x24 | das Schließen-Kreuz im Bearbeiten-Blatt |
| vier Bildschirme | 40 bis 42 hoch | die „Erneut versuchen"- und Leerzustand-Knöpfe |

Alle behoben. Danach: 315 Berührflächen gemessen, 0 darunter. Der Schalter im
Einwilligungs-Blatt darf klein AUSSEHEN; HIG trennt Aussehen und Trefferfläche,
also sitzt er jetzt in einer 44x44-Fläche.

Kontrast: 650 Textstellen gemessen (vorher rund 400), 0 unter der Grenze. Die
Blätter waren also farblich in Ordnung.

## Der Fund, der kein Prüfer-Thema war

Auf dem Weg zum Fehlerzustand von `/betrieb/nachrichten` stellte sich heraus:
**der Fehlerzustand konnte gar nicht eintreten.**

`getProviderConversationList` und `getConversationList` in `lib/messages.ts`
hatten beide `if (error || !data?.length) return [];`. Ein Netzfehler kam damit
als LEERE LISTE beim Bildschirm an. Beide Bildschirme haben einen
Fehlerzustand samt „Erneut versuchen", und in beiden steht im `catch` der
Kommentar „Netzfehler nicht als ‚Keine Nachrichten' tarnen". Genau das tat der
Code darunter.

Für den Nutzer heißt das: sein Posteingang lädt nicht, und die App sagt ihm,
niemand habe ihm geschrieben. Bei einem Marktplatz ist das die teuerste
denkbare Falschaussage.

Jetzt `if (error) throw error;` vor der Leerprüfung. Der Fehlerzustand ist
danach im Prüfstand nachweisbar erreichbar (gemessen: „Erneut versuchen"
187x46 statt „Aufträge ansehen").

## Wie die neue Abdeckung abgesichert ist

- `scripts/lib/blatt-oeffnen.cjs` ist EIN Baustein für beide Prüfer. Zwei
  Kopien hätten bedeutet, dass eine irgendwann an einer Fehlerklasse
  vorbeisieht.
- Nach dem letzten Antippen wird gezählt, ob wirklich etwas aufgegangen ist.
  Ohne diese Prüfung meldet der Prüfer den Bildschirm DAHINTER als grün, und
  das Blatt bliebe ungemessen. Gegengeprobt mit einer erfundenen Beschriftung:
  der Lauf wird rot („nicht antippbar"), nicht still grün.
- `alsAnbieter(ctx, { fehlerBei: [...] })` lässt einzelne Abfragen mit 500
  antworten. Nur so ist ein Fehlerzustand erreichbar.
- Die Untergrenzen sind GEMESSEN, nicht geschätzt: 290 (bei 315) und 580 (bei
  650). Eine geratene Zahl baut sich einen Fehlalarm ein.

## Nebenbefund, nicht behoben

Die selbst gebauten Schalter (Einwilligungs-Blatt, `/suche`) melden sich einer
Bedienungshilfe als „Knopf", nicht als Schalter, und nennen ihren Zustand
nicht. Das ist ein eigener Block über mehrere Stellen, kein Größenproblem, und
deshalb hier bewusst nicht mit erledigt.
