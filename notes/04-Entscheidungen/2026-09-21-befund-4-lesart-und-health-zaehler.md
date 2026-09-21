# 21.09.2026 (abends) — Befund 4 gebaut, und ein Zähler, der nach außen ging

Zwei Entscheidungen, beide mit einer Lesart, die ich offenlegen muss.

## 1. Befund 4: gebaut, obwohl die Frage mehrdeutig blieb

Der Founder schrieb: *„Warum kann ich aufträge im satz nicht anklicken? Oder
mscht das kein sinn?"* — mitsamt Selbstzweifel. „Im Satz" ließ sich nicht
sicher auflösen. Drei Lesarten waren möglich: die Liste im Betriebsbereich
(das Bildschirmfoto daneben), der Stundensatz im Profil, oder die Karten auf
der Kundenseite.

**Entscheidung: gebaut, für die Betriebsliste.** Begründung:

- Das mitgeschickte Bildschirmfoto zeigte genau diese Liste.
- Die Messung dahinter ist unabhängig von der Lesart ein Befund: die
  Beschreibung war auf zwei Zeilen geklammert, und die Karte reagierte auf
  nichts. Den ganzen Text sah nur, wer „Angebot erstellen" öffnete — also den
  Bildschirm, der ein **bindendes Angebot** abgibt.
- Die Kundenseite wurde geprüft und ist in Ordnung (Karten sind dort
  Schaltflächen).

**Was ich NICHT gebaut habe:** die ganze Karte zu einer Schaltfläche zu
machen, die in eine Auftrags-Detailseite führt. Dafür gibt es auf der
Betriebsseite keinen Bildschirm, der einen Auftrag ohne Angebotsformular
zeigt, und einen zu bauen wäre über die Frage hinausgegangen (Karpathy 3).
Sollte der Founder die andere Stelle gemeint haben, steht die Antwort hier
und die Arbeit ist trotzdem keine Fehlinvestition.

## 2. Die Fehlerklasse dahinter

Die vom Nachmittag war: *eine verbindliche Handlung ohne die Daten, die sie
beschreibt* (sechs Fundstellen). Diese hier ist die **Umkehrung**: die Daten
gab es, aber der einzige Weg dorthin führte durch die Verpflichtung.

Regel für künftige Bildschirme: bei jeder gekürzten Anzeige (`numberOfLines`,
„…", abgeschnittene Listen) fragen, **wo der vollständige Inhalt steht**.
Führt der einzige Weg dorthin durch einen Bildschirm mit Rechtsfolge, ist das
ein Befund und kein Gestaltungsdetail.

## 3. Die Schwelle ist eine Zeichenzahl, keine gemessene Zeilenzahl

Der naheliegende Weg wäre `onTextLayout` mit `nativeEvent.lines.length`
gewesen. **Auf react-native-web feuert das nicht.** Ein darauf gebauter Knopf
wäre im ausgelieferten Web-Build unsichtbar geblieben, und kein
Browser-Prüfer hätte es gemeldet — dieselbe Familie wie `Alert.alert`,
`Share.share` und `accessibilityState`.

Deshalb `description.length > 120`. Das ist gröber, aber im Prüfstand
messbar: C1 wird rot, wenn die Schwelle auf 0 fällt.

## 4. Gemessen wird die Höhe, nicht der Text

`numberOfLines` setzt in rn-web ein `-webkit-line-clamp`. Der Text ist danach
optisch weg, `innerText` liefert ihn aber weiterhin vollständig. **Eine
Textprobe wäre in beiden Zuständen grün gewesen** — dieselbe Klasse wie
„zwei RLS-Bedingungen, die dieselben Fälle abdecken".

Mutationen (gemessen, nicht vermutet):

| Mutation | Ergebnis |
|---|---|
| Klammer wieder fest auf 2 Zeilen | **C3 rot**, C4 grün |
| Schwelle `> 120` → `> 0` | **C1 rot** (zwei Knöpfe statt einem) |
| Gegenprobe: Zustandsvariable umbenannt | alle fünf grün |

Dass **C4 grün blieb**, während C3 rot wurde, ist der Beleg für die Trennung,
die hier seit Monaten gilt: die Beschriftung kippte („Weniger anzeigen",
`aria-expanded=true`), die Wirkung fehlte. Wer nur die Auszeichnung prüft,
misst eine Attrappe.

## 5. `/health` gab Geschäftszahlen aus, und zwei davon waren von mir

`verify_jwt = false` in `config.toml` macht den Endpunkt ohne Anmeldung
erreichbar. Er nannte `pruef_offen`, `reklamationen_offen`, `meldungen_offen`
als Zahlen. Für einen Wettbewerber ist das ein Ticker für das Wachstum der
Angebotsseite und für die Belastung des Betreibers.

**Zwei der drei hatte ich selbst hinzugefügt** (`30b8f50`), direkt unter
meinen eigenen Kommentar „nur Booleans nach außen, keine Zahlen". Ein
Kommentar ist kein Beleg — das steht seit dem Nachmittag in CLAUDE.md, und ich
bin am selben Tag hineingelaufen.

Jetzt Booleans (`pruef_wartet` usw.), `wartet-jemand.yml` liest Flaggen, und
`scripts/health-keine-zahlen-check.py` misst das Symptom: ein Zähler wird mit
`= 0` angelegt, eine Flagge mit `= false`. Gegenprobe „ein Zähler, der NICHT
nach außen geht, bleibt erlaubt" ist Pflicht, sonst wäre „keine Zahlen im
Code" der einfachste grüne Haken.

## 6. Der Messfehler in meiner eigenen Sicherheitsprüfung

Die Prüfung aller 16 Edge Functions meldete im ersten Lauf **fünf** Funktionen
ohne Ratenbegrenzung. Falsch: mehrere delegieren an `handler.ts`, und ich
hatte nur `index.ts` gelesen. Nach der Neumessung über alle `.ts` je Ordner:
**kein Befund** bei Ratenbegrenzung, Eingabeprüfung und Anmeldung.

Diese Falle steht wörtlich in CLAUDE.md („Read auf `handler.ts` … Treat any
Read of a `supabase/functions/**` file as success"). Sie zu kennen hat nicht
gereicht. Was gereicht hätte: vor dem Messen einmal `ls supabase/functions/*/`
statt anzunehmen, dass eine Funktion eine Datei ist.

## Offen

**PR nach `main`.** 41 Commits liegen vor `main`, und der Founder testet am
Gerät die Live-Seite. Von seinen vier Befunden war einer bereits behoben und
nur nicht ausgeliefert. Das ist die teuerste offene Entscheidung, und sie ist
seine.
