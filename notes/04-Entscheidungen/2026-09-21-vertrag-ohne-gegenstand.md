# Ein Vertrag ohne Leistungsgegenstand, und zwei Knöpfe übereinander

**Datum:** 21.09.2026
**Anlass:** Der Block, den ich mir selbst notiert hatte: `app/vertrag.tsx`
zeigte `?? 'Dienstleistung'`.

## Der gesuchte Befund

`const jobTitle = contract?.job?.title ?? 'Dienstleistung';`

Der Fall tritt ein, wenn der Vertrag lädt, das eingebettete `job` aber nicht:
gelöscht, oder RLS verbirgt es. Dann steht im Vertrag „Leistung:
Dienstleistung". § 631 BGB verlangt einen **bestimmten** Leistungsgegenstand,
und „Dienstleistung" benennt keinen.

Behoben: kein Ersatzwort mehr, und der Knopf „Vertrag bestätigen & Zahlung
starten" ist gesperrt, solange die Leistung unbekannt ist. Wer zustimmt, stimmt
sonst einem Vertrag zu, dessen Gegenstand er nicht sieht.

## Mein Prüfer war an der wichtigsten Stelle blind

Die erste Mutation („`'Dienstleistung'` zurück") blieb **grün**. Der Grund
stand in meiner eigenen Positivliste: `"dienstleistung"` war dort als
neutrales Ersatzwort eingetragen.

Auf einer Suchliste ist das Wort harmlos. In einem Vertrag ist es eine Aussage
über den Leistungsgegenstand. **Eine Positivliste ist kontextabhängig**, und
meine galt global. Gestrichen; die Liste gilt ohnehin nur für die sieben
Bildschirme mit verbindlicher Handlung, also trifft das Streichen keine
harmlose Stelle anderswo.

## Der eigentliche Fund kam aus einer Zusicherung, die nicht funktionierte

E5 („ein Klick führt nicht zur Zahlung") blieb in der Gegenprobe **grün**,
obwohl der Fix zurückgenommen war. Statt sie zu streichen, habe ich
nachgemessen, warum. Der Klick lief in einen Timeout, und `elementFromPoint`
auf der Mitte des Knopfes traf ein fremdes Element:

```
knopf: [17, 775, 356, 53]
darüber: BUTTON „Auftrag abschließen"  [17, 775, 356, 53]
```

**Zwei Leisten lagen exakt übereinander.** Beide sind
`position: absolute, bottom: 0`, und die Bedingungen schließen sich nicht aus:

```jsx
{lage.zahlbar && (            …Vertrag bestätigen & Zahlung starten… )}
{contract?.status === 'active' && ( …Auftrag abschließen… )}
```

Ein Vertrag mit `status = 'active'` und **ohne hinterlegtes Geld** ist nach
`vertragsLage` zahlbar UND aktiv. Der später gerenderte Knopf lag oben.

Für den Kunden heißt das: er sieht bei einem unbezahlten Vertrag den Knopf zur
**Freigabe des Treuhandbetrags**, und an den richtigen Knopf kommt er gar nicht
heran. Gemessen, nicht vermutet: mit dem Doppelknopf läuft jeder Klick in einen
Timeout, ohne ihn führt derselbe Klick nach `/zahlung`.

`lage` ist seit einem früheren Block die eine Quelle für diesen Bildschirm.
Der zweite Knopf fragte weiterhin den **rohen Status** ab, also genau das
Muster, das diese Datei schon einmal losgeworden war. Jetzt
`!lage.zahlbar && contract?.status === 'active'`.

## Belege

`scripts/reisen/reise5-vertrag-zahlung.cjs`, Teil E, fünf Zusicherungen, alle
einzeln nachgewiesen:

| Zusicherung | wird rot bei |
|---|---|
| E0 Am unteren Rand liegt genau EIN großer Knopf | Doppelknopf zurück („gemessen: 2") |
| E1 Ohne Leistungsgegenstand wird keiner erfunden | Ersatzwort zurück |
| E2 Der Bildschirm sagt, dass die Leistung fehlt | Ersatzwort zurück |
| E4 Ohne Leistungsgegenstand ist er gesperrt | `disabled` entfernt |
| E5 Und ein Klick führt nicht zur Zahlung | `disabled` entfernt |

**Und eine Lehre über die Versuchsanordnung:** im ersten Anlauf habe ich beide
Mutationen gleichzeitig gesetzt. E5 blieb dabei grün, weil der Doppelknopf den
Knopf wieder unklickbar machte, also die eine Mutation die andere maskierte.
Erst einzeln gemessen wurde E5 rot, mit `/zahlung` in der URL. Zwei Mutationen
auf einmal können einander verdecken, genau wie zwei Bedingungen in einer
Policy.
