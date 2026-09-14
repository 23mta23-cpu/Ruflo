# Design-Karussell, neun Bilder: was wir nehmen und was nicht

**Datum:** 14.09.2026
**Rolle:** UI/UX-Director
**Anlass:** Der Founder hat neun Folien eines Design-Tipp-Karussells geschickt
(fünf am 13.09., vier am 14.09.) mit der Frage, ob wir diese Designs nutzen
können.
**Verbindlich:** ja. Vorheriger Vergleichsfall:
`Swarm-v7-Design-Direktiven-abgelehnt-2026-07-21.md`.

## Kurzfassung

Die neun Folien zerfallen in zwei Hälften mit gegensätzlichem Ton, und meine
Bewertung der ersten Hälfte gilt nicht für die zweite.

| | Folien | Ton | Urteil |
|---|---|---|---|
| Erste Hälfte | 1 bis 5 | dunkel, glasig, Farbverlauf, Krypto-Dashboard | abgelehnt als Richtung, drei Ideen übernommen |
| Zweite Hälfte | 6 bis 9 | hell, warm, viel Luft, ruhig | **angenommen**, drei Muster konkret |

Ich hatte am 13.09. geschrieben, die Bilder seien „gut für ein
Krypto-Dashboard". Für die vier vom 14.09. stimmt das nicht. Sie sind hell,
warm, großzügig gesetzt, und Folie 6 liegt farblich näher an unserer
Bone-Palette als alles, was wir selbst gebaut haben.

## Der Ist-Zustand, gemessen (13.09.)

| Messung | Wert |
|---|---|
| Bildschirme | 56 |
| `C.`-Token-Verwendungen | 2.953 |
| fest verdrahtete Farben | 6 |
| `useColorScheme` / `Appearance` | 0 |
| `LinearGradient` / `BlurView` | 0 / 0 |
| `ProgressRing` im Einsatz | 1 von 56 |
| `EmptyStateArt` im Einsatz | 3 |

## Angenommen

### A1 — Hochladen mit Fortschritt und Abbruch (Folie 5)

**Ziel:** `app/onboarding-kyc.tsx`, Schritte 3 und 4.

Die Folie zeigt gestrichelte Ablagefläche, ein Zeichen, einen Satz mit der
Anforderung, dann eine Zeile pro Datei mit Name, Format, Größe, Restzeit,
Abbruchkreuz und einem Balken.

Wir haben das Obere bereits: gestrichelte Fläche, Zeichen, „JPG, PNG oder
PDF · max. 10 MB". Was fehlt, ist alles Untere. Beim Hochladen dreht sich ein
`ActivityIndicator` — kein Prozentwert, keine Größe, kein Abbruch. Die Stile
`progressTrack` und `progressFill` existieren, gehören aber der Schrittleiste
oben, nicht dem Hochladen.

**Warum das mehr als Kosmetik ist:** Ein Handwerker fotografiert seinen
Meisterbrief mit dem Telefon. Eine solche Aufnahme liegt bei 6 bis 10 MB, und
er lädt sie im Mobilfunknetz hoch, oft im Keller oder auf der Baustelle. Er
sieht einen sich drehenden Kreis ohne Ende und ohne Ausweg. Das ist der
Bildschirm, an dem wir ihn verlieren, und es ist der Bildschirm, an dem er uns
sein wichtigstes Dokument gibt.

### A2 — Handlungsreihe im Profil (Folie 6)

**Ziel:** `app/anbieter.tsx`.

Vier gleich große, abgerundete Kacheln nebeneinander, jede mit Zeichen und
Beschriftung. Das ist die Stelle, an der ein Kunde entscheidet, ob er diesem
Betrieb 800 € anvertraut.

**Übernommen:** die Kachelreihe, die warme Kopffläche (sie liegt bei unserem
`#F2EFE9`), der Abstand.

**Nicht übernommen:** zwei der vier Handlungen. „Call" und „Private" sind
Messenger-Muster. Eine Telefonnummer vor dem Vertragsschluss ist genau das,
was § 7 unserer AGB und die Umgehungserkennung (`chat_leak_flags` 0340,
`chat_reports` 0700) verhindern sollen. Auch „Last seen recently" fällt weg:
Anwesenheitsdaten sind eine Verarbeitung ohne Zweck bei uns, und
Art. 5 Abs. 1 lit. c DSGVO verlangt Datenminimierung.

### A3 — Zahl groß, Grafik daneben (Folie 9)

**Ziel:** `app/(provider)/auszahlungen.tsx`, `app/betrieb/statistik.tsx`.

Die Folie löst genau den Einwand auf, den ich am 13.09. gegen „Visualize Your
Numbers" erhoben hatte. Dort steht `$214,831` exakt und groß; der Ring daneben
trägt `$214K` als **zweitrangige** Beschriftung. Die Grafik ersetzt die Zahl
nicht, sie begleitet sie.

Bei Geld ist das die einzig zulässige Reihenfolge. Eine gerundete Zahl als
Hauptaussage wäre bei Preisangaben ein Problem nach § 5 UWG und PAngV, und
genau diese Klasse Fehler räume ich gerade auf (erfundene Stundensätze,
9,52 % im Beleg statt der zugesagten 8 %).

**Übernommen:** die Rangfolge, die waagerecht scrollende Kachelreihe darunter
(sie ist die brauchbare Form von „Compact Data Views" aus Folie 9 der ersten
Hälfte), das Zuwachs-Pill mit Pfeil.

**Nicht übernommen:** der violett-türkise Verlaufsring. `ProgressRing.tsx`
existiert seit Monaten in Markenfarben und wird von genau einem Bildschirm
benutzt. Das ist kein Baustein-Problem, das ist ein Einsatz-Problem.

## Abgelehnt

### R1 — Dunkelmodus (Folie 2 der ersten Hälfte)

Nicht wegen des Geschmacks, wegen der Kosten. `C` ist ein eingefrorenes
Objekt, kein Theme-Kontext. 2.953 Aufrufstellen bekämen eine zweite Bedeutung,
und jede dunkle Fläche braucht ihre eigene Kontrastprüfung nach BFSG. Wir
hatten schon einmal einen Token mit 2,3:1 statt 4,5:1 im Fließtext, über 170
Stellen. Ein schlecht gemachter Dunkelmodus ist schlechter als keiner.

Eine dunkle Fläche haben wir bereits: `HERO` (`#17503A`) auf Landing und
Startseite. Sie ist markengrün, nicht schiefergrau, und das ist der
Unterschied.

### R2 — Glasmorphismus und Farbverläufe

`LinearGradient` und `BlurView` kommen im ganzen Baum null mal vor. Beide
wären neue Abhängigkeiten mit Bündelgröße und Rechenaufwand auf Android.
Die Direktiven-Datei des UI/UX-Directors sagt seit Langem
„calm premium in Werkant brand colors (NOT candy gradients)". Ich sehe keinen
Grund abzurücken, nur weil die Bilder gut aussehen.

### R3 — Verlaufsbalken für Bewertungen (Folie 7)

Der Regenbogenbalken unter „Air Quality Index 72 Moderate" ist für Luftgüte
richtig und für Geld falsch. Ein Balken, der einen Auszahlungsbetrag als
„moderat" einfärbt, ist eine Aussage, die wir nicht belegen können.

### R4 — Abwesende Datenaussagen

Wetterkarte, Nettovermögen, Anlageklassen: schöne Folien über Daten, die wir
nicht haben und nicht erheben sollten.

## Der Maßstab, an dem ich das gemessen habe

Die Skill-Datenbank (`ui-ux-pro-max`) gibt für „local service marketplace"
unabhängig den Stil `Trust & Authority` zurück: Nachweise, Siegel,
Referenzen, WCAG AAA. Nicht Glasmorphismus. Das deckt sich mit dem Produkt:
Wir bitten einen 54-Jährigen, einem Fremden Geld zu geben, der in seine
Wohnung kommt. Vertrauen liest sich hier als ruhige Fläche, exakte Zahl,
echter Name, sichtbarer Nachweis.

## Reihenfolge

A1 zuerst. Es ist als einziges ein **Fehler**, nicht eine Verbesserung: ein
sich drehender Kreis ohne Prozent und ohne Abbruch auf dem Bildschirm, an dem
uns ein Betrieb seinen Meisterbrief gibt. A2 und A3 sind Verbesserungen und
kommen nach den offenen Rechtsbefunden.
