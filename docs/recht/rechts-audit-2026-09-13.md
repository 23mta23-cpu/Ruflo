# Rechts-Audit 13.09.2026 — Lücken zwischen Rechtstext und Code

Erstellt vom CCO-Agenten, **stichprobenartig von mir gegengeprüft**. Jeder
Befund nennt eine Fundstelle; wo ich selbst nachgesehen habe, steht es dabei.

**Kein Ersatz für Rechtsberatung.** Die mit ⚖️ markierten Punkte gehören vor
dem Marktstart zu einem Fachanwalt oder Steuerberater.

---

## Von mir selbst am Code nachgeprüft (7 von 7 bestätigt)

| Befund | Fundstelle | Geprüft |
|---|---|---|
| Suche erfindet Stundensätze: `?? 13` | `app/suche.tsx:144`, angezeigt `:380` | ✅ wortgleich |
| „Verifiziert" = Stripe-Onboarding, Text sagt „Gewerbeschein & ID-Prüfung" | `app/suche.tsx:145` / `:471` | ✅ |
| Nachbarschaft-Track ist **standardmäßig an** | `constants/features.ts:21` | ✅ |
| „Renovierung" ohne `MEISTERBRIEF` in `requiredDocs` | `data/categories.ts:41-44` | ✅ |
| `/garantie`: „Ihr Geld verlässt Werkant erst, wenn Sie bestätigen" | `app/garantie.tsx:22` | ✅ |
| Bestellknöpfe ohne „zahlungspflichtig bestellen" | `auftrag-detail.tsx:183`, `angebot.tsx:251`, `vertrag.tsx:314`, `zahlung.tsx:416` | ✅ |
| Beleg addiert 19 % auf die Provision, AGB §6(2) sagt „trägt Werkant" | `app/rechnung.tsx:128-133` gegen `app/agb.tsx:90` | ✅ |

---

## Die vier gefährlichsten Punkte

### 1. ⚖️ Widerrufsbelehrung nennt den falschen Unternehmer

`app/widerruf.tsx:70,74-84` belehrt durchgehend über **Werkant**. Nach den
eigenen AGB (§1(2), §2(3)) ist Werkant **nicht Vertragspartei** — der
Dienstleistungsvertrag besteht zwischen Kunde und Anbieter.

Nach § 355 Abs. 1 BGB ist der Widerruf gegenüber dem **Unternehmer** zu
erklären, dieser schuldet die Rückzahlung und bekommt den Wertersatz
(§ 357a BGB). Eine anbieterbezogene Belehrung existiert im Code **nirgends**.

**Folge:** Ist die Belehrung fehlerhaft, beginnt die Frist nicht zu laufen
(§ 356 Abs. 3 S. 1 BGB) — Widerruf dann bis zu **12 Monate und 14 Tage**
möglich. Und ohne korrekte Belehrung gibt es keinen Wertersatz: der Handwerker
arbeitet im Widerrufsfall umsonst.

Der beweissichere Zustimmungsnachweis aus `0710` hängt damit an einer
Belehrung, die den falschen Unternehmer nennt. **Ein guter Nachweis rettet die
falsche Grundlage nicht.**

### 2. Button-Lösung — § 312j Abs. 3 und 4 BGB

Die Schaltfläche muss „mit nichts anderem als" den Wörtern *zahlungspflichtig
bestellen* (oder einer eindeutigen Entsprechung) beschriftet sein. Sonst
**kommt der Vertrag nicht zustande** (Abs. 4).

Laut AGB §4(1) entsteht der Auftrag mit der Unterzeichnung — also **vor** dem
Zahlungsbildschirm. Der maßgebliche Knopf ist „Angebot annehmen".

**Folge, wenn es schiefgeht:** Geld im Escrow, Arbeit erbracht, kein Vertrag.
Behebbar in einer Stunde.

### 3. ⚖️ PStTG-Schwelle gilt möglicherweise nur für Warenverkauf

Die Freistellung (30 Vorgänge / 2 000 €) knüpft an die Tätigkeit *Verkauf von
Waren* an. Werkant vermittelt **Dienstleistungen** — dort gäbe es keine
Bagatellgrenze, und die Plattform meldete systematisch zu wenig.
**Bußgeld bis 50 000 € (§ 25 PStTG).**

Das ist eine Einstufungsfrage, die ich nicht entscheiden kann und der Agent
ausdrücklich auch nicht. **Steuerberater, vor der ersten Meldung.**

### 4. ⚖️ Nachbarschaft-Track läuft, bevor die Abgrenzung geklärt ist

`EXPO_PUBLIC_ENABLE_NACHBARSCHAFT !== 'false'` heißt: **an, solange niemand
aktiv abschaltet.** Die DRV-Statusfeststellung ist offen.

Verschärfend: `data/categories.ts` setzt allen C2C-Kategorien einen
Mindeststundensatz **mit Verweis auf § 1 MiLoG**. Das MiLoG gilt für
Arbeitnehmer. Eine Plattform, die für angeblich Selbständige einen Mindestlohn
begründet, liefert genau das Indiz, das in einem Statusfeststellungsverfahren
gegen sie verwendet wird.

**Empfehlung:** Schalter auf `false`, bis geklärt. Der Track bringt bei 1,99 €
je Auftrag kaum Umsatz und trägt das größte Rechtsrisiko im Produkt.

---

## Vollständige Befundliste

Der Agent hat rund 40 Punkte geliefert, gegliedert nach Angreifbarkeit:

- **A** Bußgeld/Strafbarkeit: PStTG-Schwelle, `/garantie` untergräbt das
  ZAG-Argument der AGB
- **B** Abmahnung: erfundene Preise, „Verifiziert"-Irreführung, unwahre
  Aussagen auf `/garantie` (PDF, EU-Rechenzentren, automatische Sperre),
  Stornopauschale ohne Nachweisvorbehalt (§ 309 Nr. 5 BGB), Haftungsklausel
  ohne Kardinalpflichten-Ausnahme (§ 307 BGB), Zustimmungsfiktion
  (BGH XI ZR 26/20), § 5b Abs. 3 UWG am falschen Ort
- **C** Verbraucherrecht: Widerrufsadressat, fehlende Vertragsbestätigung auf
  dauerhaftem Datenträger (§ 312f Abs. 2 BGB), Button-Lösung, § 312i BGB /
  Art. 246c EGBGB fehlen ganz, Verbraucherbauvertrag (§ 650i ff. BGB) bei
  25 000 € Limit, Widerrufs-Haken auch im C2C-Track
- **D** P2B-VO: Art. 9 (Datenzugang) fehlt vollständig, Art. 8, Art. 4 Abs. 2
  (30 Tage vor Beendigung), Art. 5 nennt Ranking-Parameter, die es im Code
  nicht gibt
- **E** Steuer: § 13b UStG falsch angewandt, USt-Behandlung hängt am
  AsyncStorage des Betrachters, keine fortlaufende Rechnungsnummer,
  **keine Handwerkerrechnung an den Kunden** (§ 14 Abs. 2 S. 1 Nr. 1 UStG und
  § 35a EStG), Kleinunternehmerregelung kommt nicht vor
- **F** Handwerksrecht: „Renovierung" umgeht das Meisterpflicht-Gate
- **G** Datenschutz: Chat-Scan auf Telefonnummern/IBANs wird gespeichert und
  steht **nicht** in der Datenschutzerklärung; Expo (USA) fehlt als Empfänger;
  „Personalausweis-Scan" genannt, wird aber nicht erhoben; `§ JArbSchG` im
  Einwilligungstext ist keine Norm

## Was der Agent nicht prüfen konnte

Keine Live-Daten, kein Stripe-Dashboard, App nicht am Gerät durchlaufen, rund
90 Migrationen nur teilweise. Bei drei Normen hat er ausdrücklich Unsicherheit
markiert statt zu raten.

---

## Nachtrag 14.09.2026 — Umsatzsteuer auf die Plattformgebühr

Beim Beheben des Belegfehlers („Gebühr gesamt 9,52 %") sind zwei weitere
Punkte aufgefallen. Der erste ist behoben, der zweite ist eine Frage an den
Steuerberater und bleibt bewusst unverändert im Code.

### Behoben: die Steuer wurde aufgeschlagen statt herausgerechnet

`lib/feeEngine.ts` rechnete `werkrGross × 19/100` und zog das Ergebnis als
Steuer vom Bruttoerlös ab. Richtig ist `× 19/119`. Bei 10,50 € Bruttoerlös
waren das 2,00 € statt 1,90 €, also rund 19 % zu viel ausgewiesene Steuer und
entsprechend zu wenig Nettoerlös.

Die Richtung ergibt sich zwingend aus dem Geldfluss: Der Kunde zahlt
`Preis + Service-Fee`, der Anbieter erhält `Preis − Provision`. Mehr Geld als
`Provision + Service-Fee` existiert nicht. Die Steuer kann also nur darin
enthalten sein.

Auf dem Anbieter-Beleg stand deshalb `USt. 19 % = Provision × 0,19` und
darunter fett „Gebühr gesamt" mit der Summe. Bei 100 € Auftragswert:
1,52 € Steuer und 9,52 € Gebühr. Einbehalten wurden 8,00 €, geschuldete
Steuer daraus 1,28 €. **§ 14c Abs. 1 UStG:** Wer in einer Rechnung einen
höheren Steuerbetrag gesondert ausweist, als er schuldet, schuldet auch den
Mehrbetrag.

Die Zahlen stehen jetzt nur noch in `anbieterGebuehr()`; der Bildschirm
rechnet nicht mehr selbst.

### ⚖️ Offen: Reverse Charge für **deutsche** Anbieter

`lib/account.ts` beschreibt `isBusinessUser` als „Unternehmer
(Steuernummer/Gewerbe)". Ist der Wert gesetzt, zeigt der Beleg
„Reverse Charge, § 13b UStG" und weist keine Umsatzsteuer aus. Es gibt keine
Unterscheidung zwischen einem deutschen und einem sonstigen EU-Anbieter.

Damit trifft das jeden deutschen Handwerker mit Gewerbeschein, also
praktisch die gesamte Zielgruppe.

Meine Lesart, ausdrücklich keine Steuerberatung:

- Werkant UG ist im Inland ansässig. Die Vermittlungsleistung an einen
  deutschen Unternehmer ist nach § 3a Abs. 2 UStG im Inland steuerbar.
- § 13b Abs. 1 UStG verlagert die Steuerschuld bei Leistungen eines **im
  übrigen Gemeinschaftsgebiet ansässigen** Unternehmers. Werkant ist das
  nicht.
- Eine Plattformprovision steht auch nicht im Katalog des § 13b Abs. 2 UStG.

Wenn das zutrifft, schuldet Werkant auf diese Umsätze 19 % und weist sie
derzeit nicht aus. Das ist die gefährliche Richtung: zu wenig erklärte Steuer,
nicht zu viel.

**Warum ich es nicht selbst geändert habe:** Der Geldfluss bliebe gleich
(8 % werden so oder so einbehalten), aber es entscheidet über Werkants eigene
Umsatzsteuervoranmeldung. Das ist keine Entwicklerentscheidung.

**Frage an den Steuerberater, wörtlich:**

> Werkant UG (haftungsbeschränkt), Sitz in Deutschland, betreibt eine
> Vermittlungsplattform und behält von der Vergütung des Handwerkers 8 %
> Provision ein. Die Handwerker sind ganz überwiegend in Deutschland ansässige
> Unternehmer. Ist auf diese Provision deutsche Umsatzsteuer auszuweisen und
> abzuführen, oder greift § 13b UStG? Falls Umsatzsteuer anfällt: Ist die
> Provision als Brutto- oder als Nettobetrag zu verstehen, und welche Angaben
> nach § 14 Abs. 4 UStG muss der Beleg enthalten, den der Handwerker in der
> App erhält?

Bis zur Antwort bleibt die Weiche unverändert. Ein Kommentar an der
Entscheidungsstelle in `lib/account.ts` verweist auf diesen Abschnitt, damit
sie niemand unbedacht „aufräumt".

---

## Nachtrag 14.09.2026 — Widerrufs-Haken beim Bezahlen

### Behoben: der Haken sprach im Nachbarschafts-Track von einem Handwerker

`lib/widerruf.ts` lieferte EINEN Text für beide Tracks. Im
Nachbarschafts-Track stand damit zweierlei Falsches vor dem Kunden:

- **„der Handwerker"** — dort gibt es keinen. Der Helfer ist eine Privatperson.
- **„Normalerweise könnten Sie einen online geschlossenen Vertrag 14 Tage lang
  widerrufen"** — gegenüber einer Privatperson nicht. §§ 312 ff. BGB setzen
  einen Unternehmer (§ 14 BGB) voraus; zwei Verbraucher untereinander lösen
  kein Widerrufsrecht aus.

Der Kunde erklärte also einen Verzicht auf ein Recht, das er nicht hatte,
gegenüber jemandem, den es nicht gab. Und das wurde nach Migration 0710 als
Nachweis in `widerruf_consents` festgehalten.

Ein Widerrufsrecht besteht dort sehr wohl, nur gegen **Werkant**: Der
Werkant-Schutz ist eine entgeltliche Leistung eines Unternehmers an einen
Verbraucher, online geschlossen (§ 312g Abs. 1 BGB). Es geht aber um den
Schutzbetrag, nicht um den Auftragswert. Genau das steht jetzt da.

### Ebenfalls geändert: „Verzicht" ist nicht die Konstruktion des Gesetzes

Der alte Satz lautete „Ich verzichte auf mein Widerrufsrecht gemäß § 356
Abs. 4 BGB". Das bildete keine der beiden Erklärungen ab, die die Norm
verlangt:

1. die **ausdrückliche Zustimmung** zum Beginn vor Ablauf der Frist,
2. die **Bestätigung der Kenntnis**, dass das Widerrufsrecht bei vollständiger
   Erfüllung erlischt.

Ein Verzicht im Voraus wäre nach § 361 Abs. 2 Satz 1 BGB ohnehin unwirksam,
weil zum Nachteil des Verbrauchers abgewichen wird. Beide Fassungen tragen
jetzt beide Erklärungen; das Wort „Verzicht" kommt nicht mehr vor. Ein Test
hält das fest.

Der Founder hatte am 16.08. gefragt: *„Den verzicht habe ich nicht verstanden
was steht da und muss das sein?"* Damals kam eine Erklärung daneben. Die
Antwort auf „muss das sein?" lautet im Nachbarschafts-Track schlicht nein.

`WIDERRUF_TEXT_VERSION` ist auf `widerruf-2026-09-14` hochgezählt. Alte
Erklärungen bleiben `widerruf-2026-08-16` und damit ihrem damaligen Wortlaut
zugeordnet.

### ⚖️ Offen: zwei Verträge, ein Haken

In **beiden** Tracks bestehen zwei Verträge: der über die Arbeit und der mit
Werkant über Vermittlung beziehungsweise Käuferschutz. Ein Häkchen kann streng
genommen nicht beide abdecken, und Werkant kann eine Erklärung zugunsten des
Handwerkers nicht ohne Weiteres für diesen entgegennehmen.

**Frage an den Anwalt, wörtlich:**

> Auf der Zahlungsseite bestätigt der Kunde mit einem Häkchen, dass er den
> Beginn vor Ablauf der Widerrufsfrist verlangt und das Widerrufsrecht bei
> vollständiger Erfüllung verliert (§ 356 Abs. 4 BGB). Es bestehen zwei
> Verträge: der Werkvertrag mit dem Handwerker und der Vermittlungsvertrag
> mit der Werkant UG. Genügt eine Erklärung für beide, oder sind zwei
> getrennte Erklärungen nötig? Muss die Erklärung gegenüber dem Handwerker
> von diesem selbst eingeholt werden, oder kann die Plattform sie als
> Vertreter entgegennehmen?

### Nebenbefund behoben: Gebührenzeilen mit € 0,00

Die Kostenübersicht zeigte immer beide Zeilen, „Servicegebühr (2,5 %)" und
„Werkant-Schutz". Je nach Track stand eine davon auf € 0,00. Zeilen ohne
Betrag werden jetzt weggelassen.

---

## Nachtrag 14.09.2026 — „Renovierung" am Meisterpflicht-Gate vorbei

`data/categories.ts` führt neun Gewerke mit `MEISTERBRIEF` in den
Pflichtdokumenten. Daneben stand `renovierung` als B2B-Kategorie mit nur
Gewerbeschein, Steuernummer und Identität.

Jedes benannte Gewerk hatte sein Gate. Der Sammelbegriff daneben hatte keins.
Wer ihn wählte, bekam in Schritt 4 des Onboardings einen grünen Haken in
40 px und dazu zwei Sätze:

> „Für Ihr Gewerk ist kein Meisterpflicht-Nachweis erforderlich. Sie können
> direkt starten."
> „Für Renovierung ist keine Meisterpflicht vorgeschrieben. Ihr Gewerbeschein
> ist ausreichend."

Das ist eine Unbedenklichkeitsbescheinigung, die § 1 HwO nicht hergibt, und
sie widerspricht den eigenen AGB (§ 4 Abs. 2: meisterpflichtige Gewerke nur
mit Meistertitel). Renovierungsarbeiten berühren regelmäßig Maler (Anlage A
Nr. 10), Fliesen (Nr. 41), Maurer (Nr. 1) und Tischler (Nr. 27).

### Warum kein Meisterbrief für „Renovierung"

Das wäre der einfache Griff und sachlich falsch. „Renovierung" ist kein
Handwerk der Anlage A, und § 1 Abs. 2 HwO stellt auf **wesentliche
Tätigkeiten** ab. Ein Betrieb, der tapeziert und Kleinreparaturen macht,
braucht keinen Meisterbrief. Ein Pflichtdokument hätte rechtmäßige Anbieter
ausgesperrt.

### Was stattdessen gemacht wurde

Ein neues Feld `abgrenzung` sagt, wo eine Kategorie **aufhört**. Es ist
Pflicht für jede B2B-Kategorie ohne Meisterbrief; ein Test setzt das durch,
auch für jede künftige Kategorie. Der Text nennt die Regel, nicht eine Liste
erlaubter Tätigkeiten, und verweist auf die Handwerkskammer: welche Tätigkeit
im Einzelfall wesentlich ist, entscheidet sie, nicht diese Datei. Ein Test
hält auch das fest.

Drei Kategorien betroffen:

| Kategorie | Grenze |
|---|---|
| Renovierung | kein zulassungspflichtiges Handwerk; Anlage-A-Gewerke brauchen den Meisterbrief |
| Bodenleger | zulassungsfrei (B1), aber **Parkettlegen** ist seit 2020 Anlage A |
| Gebäudereinigung | zulassungsfrei (B1); Arbeiten an Dach und Fassade über das Reinigen hinaus nicht |

Im Onboarding steht die Grenze jetzt unter dem grünen Haken, in Amber, mit
der Überschrift „Wo dieses Gewerk aufhört".

### Nebenbefund behoben: die Warnung nannte immer Elektro und Sanitär

Der Warnkasten für meisterpflichtige Gewerke sagte fest verdrahtet
„Elektro- und Sanitär-/Heizungsarbeiten sind nach §1 HwO zulassungspflichtig",
auch wenn ein Dachdecker, Maurer oder Metallbauer davorsaß. Jetzt steht dort
das gewählte Gewerk.

---

## Nachtrag 14.09.2026 — Datenschutz: drei Lücken, eine davon beinahe von mir vergrößert

### 1. Falsche Norm für die 18-Jahre-Grenze

`lib/dsgvoConsent.ts` sagte „Mindestens 18 Jahre erforderlich (**§ JArbSchG**)"
— ein Paragrafenzeichen ohne Nummer, und das falsche Gesetz dazu. Das
Jugendarbeitsschutzgesetz regelt die **Beschäftigung** Minderjähriger durch
einen Arbeitgeber. Es schließt niemanden von einer Plattform aus, und Werkant
ist kein Arbeitgeber seiner Nutzer.

Der tragende Grund ist ein anderer und ein besserer: Ein Minderjähriger kann
ohne seinen gesetzlichen Vertreter keinen wirksamen Vertrag schließen
(§§ 106, 107 BGB) — ein Auftrag über 800 € wäre schwebend unwirksam.

Diese Zeile steht im **Einwilligungs-Nachweis**. `DSGVO_TEXT_VERSION` ist
deshalb auf `dsgvo-2026-09-14` mitgezählt worden. Dieselbe Stelle stand auch
im Onboarding.

### 2. Expo fehlte in der Empfängerliste

Fünf Edge Functions rufen `https://exp.host/--/api/v2/push/send`. Gerätekennung
und Nachrichteninhalt gehen damit an Expo Inc. (USA) und von dort über Apple
(APNs) bzw. Google (FCM). In der Liste standen Stripe, Supabase, Resend, AWS
und das BZSt — Expo nicht. Art. 13 Abs. 1 lit. e DSGVO, und Drittlandtransfer
nach Art. 44 ff. Jetzt genannt, samt dem Hinweis, wie man es abstellt.

### 3. Die Chat-Prüfung war als Zweck nirgends genannt

`chat_leak_flags` (0340) prüft ausgehende Nachrichten auf Kontaktdaten. Das ist
eine Verarbeitung mit eigenem Zweck; sie stand in keinem Abschnitt.

### Und der Punkt, an dem ich selbst danebengegriffen habe

Ich wollte dazu schreiben: *„Ein Vermerk allein führt zu keiner automatischen
Sperre; über Maßnahmen entscheidet ein Mensch (kein Fall des Art. 22 DSGVO)."*

**Das wäre falsch gewesen.** Ich hatte eine Notiz übertragen, die für
`chat_reports` (0700) gilt. Für `chat_leak_flags` hängt seit 0500/0720 ein
Trigger dran, und die Kette läuft ohne jeden Menschen:

```
3 Funde in 12 Monaten  ->  1 Strike   (Trigger trg_apply_leak_strikes)
3 aktive Strikes       ->  keine neuen Angebote   (offers-INSERT-Policy)
```

Neun Regex-Treffer im Chat, und ein Betrieb kann nicht mehr bieten. Das ist
Art. 22 Abs. 1 DSGVO: eine ausschließlich automatisierte Entscheidung, die
erheblich beeinträchtigt.

**Erfreulich:** Die Sicherungen aus Art. 22 Abs. 3 gibt es bereits, sie waren
nur nicht offengelegt. 0720 speichert zu jedem Strike eine Begründung, lässt
ihn nach 12 Monaten verfallen und kennt `aufgehoben_am` für die Aufhebung nach
Beschwerde (AGB § 7 Abs. 5). Das deckt sich auch mit Art. 4 P2B-VO.

Statt die Automatik zu bestreiten, legt die Datenschutzerklärung sie jetzt
vollständig offen: die Regel, die Zahlen, die Folgen, den Widerspruchsweg, die
Tatsache, dass nur neue Angebote betroffen sind, und dass eine schlechte
Bewertung keinen Strike auslöst.

### Der Prüfer, der mich erwischt hat

Ich hatte die Beschwerdeadresse als Literal `kontakt@werkant.de` in den Text
geschrieben statt an `MAIL.kontakt` zu binden. `scripts/postfach-check.py` hat
das gefunden, mit genau der Begründung, die in seinem Kopf steht: im
Ein-Postfach-Betrieb ist der Wert derselbe, ein Laufzeit-Test bliebe grün, und
sichtbar ist der Rückfall nur im Quelltext.

### Neuer Prüfer: `__tests__/rechtstexte.test.ts`

Ein Prosa-Satz kann aus dem Code herauslaufen, ohne dass irgendetwas rot wird.
Die neue Datei bindet die **Zahlen der Rechtstexte an die Migrationen**: das
12-Monats-Fenster, die drei Funde je Strike, die drei Strikes bis zur Sperre,
den Verfall, und dass `aktive_strikes()` in **genau einer** Policy steht —
sonst wäre der Satz „Es geht allein um neue Angebote" falsch.

Nachgewiesen: `floor(v_funde / 3.0)` → `/ 5.0` in der Migration färbt den Test
rot.

### Nebenbefund, noch offen

`__tests__/compliance.test.ts` bildet die geprüften Funktionen **selbst nach**
(`isOver18`, `calcPlatformFee` und andere stehen in der Testdatei) und schreibt
das im Kopf noch als Vorzug hin. Dieselbe Tautologie wie bei
`rechnung-calc.test.ts`. `calcPlatformFee` dort beweist nichts über
`lib/feeEngine.ts`. Eigener Block, noch nicht angefasst.
