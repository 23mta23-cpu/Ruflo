# Apple HIG, gemessen statt gelesen

Stand 20.09.2026, nachts. Anlass: der Founder schrieb „/apple-hig" und
gleichzeitig, dass ich am Chillen sei. Beides berechtigt. Ich hatte auf einen
Hintergrundlauf gewartet, statt weiterzuarbeiten.

Der Skill selbst ist im Repo nur ein Katalogeintrag ohne Inhalt. Die
Richtlinien sind also anzuwenden, nicht abzulesen, und in diesem Projekt heisst
das: messbar machen.

## Was schon in Ordnung war, gemessen

| HIG-Punkt | Befund |
|---|---|
| Dynamic Type | Niemand schaltet `allowFontScaling` ab. Text skaliert mit der Systemgroesse. |
| Sichere Bereiche | **Jeder** Bildschirm unter `app/` nutzt `SafeAreaView` oder `useSafeAreaInsets`. |
| Keine Emojis als Symbole | Durchgaengig Ionicons (Hausregel, schon vorher). |
| Rollen fuer Bedienungshilfen | `knopf-rolle-check.py` haelt es nach. |

Das ist der langweilige Teil, und er gehoert dazu: ohne ihn waere „HIG
angewandt" wieder eine Behauptung.

## Befund 1: 44 von 164 Berührflächen waren zu klein

Apple nennt 44x44 pt als Untergrenze, WCAG 2.5.5 dieselbe Zahl. Gemessen mit
dem neuen `scripts/beruehrflaeche-check.cjs` am gerenderten Bildschirm:
**27 % aller Berührflächen lagen darunter.**

Die schlimmsten Klassen:

- **Der Zurück-Pfeil, 36x36, in rund 24 Bildschirmen kopiert.** Sechs weitere
  Bildschirme hatten ihn schon auf 44 -- jemand hat das von Hand korrigiert,
  und zwar nicht ueberall. Dieselbe Klasse wie „dieselbe Uebersetzung an drei
  Stellen, an einer vergessen".
- **Die ganze Gewerk-Leiste auf `/suche`, 31 px hoch.** 22 Kacheln. Das ist
  der Hauptweg, mit dem ein Kunde filtert.
- **„Speichern" im Betriebsprofil, 34 px.** Die Hauptaktion des Bildschirms.
- **Das Augen-Symbol im Passwortfeld, 36x24.** Es trug `hitSlop` von 8 -- auf
  dem Geraet also 40, immer noch unter 44, und im Web wirkt `hitSlop` gar
  nicht.
- **Textlinks, die allein in ihrer Zeile stehen** („Vergessen?" 62x16,
  „Noch kein Konto? Jetzt registrieren" 344x19).

Behoben in 30 Dateien. Danach: **164 von 164.**

### Warum der Prüfer die visuelle Größe misst und nicht `hitSlop`

`hitSlop` vergroessert auf dem Geraet die Berührfläche, ohne das Element zu
verändern -- und react-native-web ignoriert es vollständig. Ein Prüfer im
Browser kann es also nicht sehen.

Statt das Problem wegzudefinieren: wo `hitSlop` die einzige Absicherung war,
war sie **ohnehin zu klein** (36+16 = 52 breit, aber 24+16 = 40 hoch). Die
Elemente haben jetzt eine echte 44er Fläche. Das ist strenger als HIG verlangt
und dafür nachprüfbar.

### Die eine Ausnahme, mit Grund

`/betrieb/profil` hat einen `Switch`. react-native-web rendert ihn als
`<input role="switch">` mit 40x20 -- auf dem Gerät ist es der System-Schalter
von iOS (51x31 pt) samt der Berührfläche, die Apple selbst dafür vorsieht.
Ihn zu melden wäre ein **Fehlalarm über das echte Produkt**, und ein Prüfer mit
Fehlalarmen wird abgeschaltet und nie wieder an. Die Ausnahme gilt nur für das
eingebaute `<input>`; ein selbst gebauter Schalter aus Views wird weiter
gemessen.

## Befund 2: fünf Farbpaare unter dem Kontrast

In `constants/colors.ts` stand eine Behauptung in einem Kommentar:
„WCAG AA 4.5:1+ on bg/surface". **Nachgerechnet stimmt sie** -- für genau diese
zwei Gründe (4,68 und 4,97). Sie sagte die Wahrheit und trotzdem zu wenig: auf
den getönten Flächen fällt dasselbe Grau darunter.

Gemessen mit dem neuen `scripts/kontrast-check.cjs` an 442 echten Textstellen,
jede gegen ihren tatsächlichen Hintergrund:

| Paar | Wert | Wo |
|---|---|---|
| `gold` auf `goldBg` | 4,18 | „Meisterbetrieb", „Loslegen" -- das Abzeichen-Muster |
| `muted` auf `goldBg` | 4,24 | „Auftraggeber / Kunde" |
| `amber` auf Weiss | 4,46 | der Preis auf `/betrieb/auftraege` |

Der letzte ist der lehrreichste: **vier Hundertstel unter der Grenze.** Das
findet kein Blick und keine Stichprobe, nur eine Messung.

Behoben durch Abdunkeln um 4 bis 9 Prozent, **ausgerechnet statt geraten**:
`muted` #756F66 → #706A61, `gold` #8F6B1A → #876518, `amber` #9A7020 → #8C651D.
Danach 442 von 442.

**Offen und ausdruecklich Founder-Sache:** `amber` und `gold` liegen jetzt sehr
nah beieinander. Zwei Marken für dieselbe Farbe sind eine zu viel. Das
Zusammenlegen ist eine Gestaltungsentscheidung, keine technische.

## Was ich ausdrücklich NICHT geändert habe

Dreizehn Bildschirme haben eine feste Fussleiste mit `paddingBottom: 28`
statt des echten unteren Sicherheitsrands (iPhone: 34 pt). Das ist eine
geratene Zahl, und HIG sagt, man solle den Sicherheitsrand nehmen.

Es ist aber **kein belegter Fehler**: 28 pt reichen, um über dem Home-Indikator
zu bleiben. Ohne Gerät kann ich es nicht messen, und dreizehn Dateien auf
Verdacht zu ändern ist genau das, wovor die eigene Regel warnt („eine
Vorsichtsmassnahme ohne Messwert gehört wieder raus"). Steht als Geräte-Punkt
im Handoff.

## Mutationsproben

Beide neuen Prüfer wurden gegen den kaputten Zustand gefahren:

- `beruehrflaeche-check.cjs`: Kachelhöhe auf `/suche` zurückgenommen → **22
  Befunde, rot**. Zurückgesetzt (byteweise verglichen) → grün.
- `kontrast-check.cjs`: `gold` auf den alten Wert → **4 Befunde, rot**.
  Zurückgesetzt → grün.

Beide zählen ausserdem eine Mindestmenge (164 bzw. 442) und melden, wie viele
Elemente sie übergangen haben. Ohne das wäre „0 Befunde" mit einer leeren
Auswahl vereinbar -- der Fehler vom 16.09., als ein Erkundungslauf zwei Drittel
aller Knöpfe still verwarf und am Ende „0 ohne Wirkung" meldete.
