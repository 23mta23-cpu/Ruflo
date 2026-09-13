# Reichweite des Anbieter-Matchings: Köln und Leverkusen finden sich nicht

*Befund 13.09.2026, beim Herausziehen des Filters in `notify-matching-providers`.
Kein Codefehler — eine Produktentscheidung, die nie als solche getroffen wurde.*

## Was der Filter tut

`supabase/functions/notify-matching-providers/auswahl.ts` vergleicht die
**ersten zwei Ziffern** der Postleitzahl:

```ts
const plzPrefix = (job.address_plz ?? "").slice(0, 2);
return plzPrefix.length === 2 && plz.startsWith(plzPrefix);
```

## Warum das den Markteintritt trifft

| Ort | PLZ | Region |
|---|---|---|
| Köln-Innenstadt | 50667 | **50** |
| Köln-Nippes | 50733 | **50** |
| Leverkusen | 51373 | **51** |
| Bergisch Gladbach | 51465 | **51** |

Köln und Leverkusen liegen **15 km** auseinander und finden sich über diesen
Filter **nie**. Dasselbe gilt für Bergisch Gladbach, Bergheim (50126 ist
wiederum 50) und weite Teile des direkten Umlands.

Der Markteintritt ist ausdrücklich Köln **und** Leverkusen. Ein Anbieter in
Leverkusen erfährt also nichts von einem Auftrag in Köln-Mülheim, der acht
Minuten entfernt ist, während er jeden Auftrag in Bergisch Gladbach bekommt.

Hinzu kommt: beim Kaltstart ist die Anbieterdichte gering. Ein Filter, der die
Reichweite künstlich halbiert, ist genau dann am teuersten.

## Warum ich es NICHT einfach geändert habe

Die naheliegende Änderung (eine Ziffer statt zwei) macht es schlimmer, nicht
besser: „5" umfasst dann das halbe Rheinland bis Aachen und Siegen. Ein
Handwerker in Aachen bekäme Kölner Aufträge.

Richtig wäre eine **Entfernung**, keine Ziffernfolge — also Geokoordinaten zur
PLZ und ein Radius in Kilometern, den der Anbieter selbst einstellt. Das ist
eine Produktentscheidung mit Datenbedarf (PLZ-Geodaten), einer neuen
Profilangabe und Auswirkungen auf Suche und Startseite, nicht nur auf diese
eine Mitteilung.

**Deshalb hier festgehalten und dem Founder vorgelegt, statt es nachts allein
zu entscheiden.** Die heutige Reichweite ist jetzt wenigstens *bekannt* und in
einem Test benannt (`Leverkusen erfaehrt nichts von einem Koelner Auftrag`),
statt unausgesprochen im Code zu stehen.

## Zwischenlösung, falls es schnell gehen muss

Eine Nachbarschafts-Tabelle für die wenigen Regionen des Markteintritts
(`50 ↔ 51`) wäre zwei Zeilen Code und deckt Köln/Leverkusen/Bergisch Gladbach
ab, ohne das halbe Rheinland zu öffnen. Das ist ein Pflaster, kein Entwurf —
tragfähig genau so lange, wie der Markt zwei Städte groß ist.

## Was ebenfalls auffiel und richtig ist

Fehlt die PLZ am Auftrag, trifft der Filter **niemanden** statt alle. Das ist
die sichere Richtung und jetzt durch einen Test festgehalten: ein Auftrag ohne
Region würde sonst jeden Anbieter im Bestand anschreiben.
