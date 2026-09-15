# Stil-Audit sichtbarer App-Text, 14.09.2026

Auftrag: Der Founder sagt, manche Texte seien vor Monaten geschrieben worden
und wirkten veraltet. Geprüft wurde der **sichtbare** Oberflächentext aller
`app/**` und `components/**`-Bildschirme, ausgelesen mit
`scripts/sichtbarer_text.py` (`zeichenketten_und_resttext`), nicht der
Quelltext.

**Kein Code geändert.** Diese Datei ist die Analyse.

## Ausgangslage: die vier Prüfer melden grün

| Prüfer | Ergebnis am 14.09. |
|---|---|
| `scripts/anrede-check.py` | 0 Abweichungen |
| `scripts/gedankenstrich-check.py` | 255 Dateien, keine Beanstandung |
| `scripts/ton-check.py` | 12 Bildschirme, keine Beanstandung |
| `scripts/versprechen-check.py` | keine der vier bekannten Falschaussagen zurück |

Befund 6 unten ist ein **echter Rückfall in die Du-Form, den der Anrede-Prüfer
nicht sehen kann**. Das ist genau die Klasse „grüner Haken, der nichts prüft"
aus `CLAUDE.md` (Session 16.08.). Die Prüfer sind also nicht wertlos, aber sie
beweisen nichts über die Klassen, die hier gefunden wurden: Widersprüche
zwischen Bildschirmen, Fachjargon, Floskeln, Aussagen die der eigene Code
widerlegt.

## Wie die Reihenfolge zustande kommt

Ganz oben steht, was nach § 5 UWG angreifbar ist oder was ein Nutzer am Gerät
als Lüge erlebt. Darunter Verständlichkeit für die beiden echten Leser: einen
54-jährigen Kunden, der eine Heizung repariert haben will, und einen
Handwerker, der das auf der Baustelle mit dreckigen Fingern liest. Ganz unten
Floskeln und Uneinheitlichkeit.

## Befunde

| Datei:Zeile | Heutiger Text | Befund | Vorschlag |
|---|---|---|---|
| `app/garantie.tsx:117` | „Sie zahlen erst, wenn Sie zufrieden sind." | **Der eigene Code widerlegt das.** `app/zahlung.tsx:426` beschriftet den Knopf „Jetzt zahlen & Escrow sperren", `:240` sagt danach „… sind sicher hinterlegt. Nach dem Job können Sie die Zahlung freigeben". Der Kunde zahlt **vor** der Arbeit. Dieselbe Klasse wie die vier Aussagen vom 13.09. | „Ihr Geld liegt beim Zahlungsdienstleister, bis Sie die Arbeit abnehmen. Erst dann geht es an den Betrieb." |
| `app/nachbarschaft.tsx:268`, `app/betrieb/profil.tsx:485` | Abzeichen „Ausweis verifiziert" | **Vier andere Bildschirme sagen das Gegenteil:** `garantie.tsx:32`, `landing.tsx:23`, `support-chat.tsx:45`, `datenschutz.tsx:22` je „Ausweiskopien verlangen/erheben wir bewusst nicht". `suche.tsx:493` hält im Kommentar fest: „Ausweispruefung findet bewusst NICHT statt (Migration 0370, § 20 PAuswG)". Das Abzeichen behauptet eine Prüfung, die es nicht gibt. | „Alter bestätigt" (wenn 18+ über Stripe gemeint ist) oder „Zahlung eingerichtet". Wort „Ausweis" streichen. |
| `app/landing.tsx:237` | „**Jeder Anbieter persönlich verifiziert**: Gewerbeschein, in meisterpflichtigen Gewerken der Meisterbrief" | Widerspricht `landing.tsx:23` **auf demselben Bildschirm**: dort prüft „unser Zahlungsdienstleister Stripe" die Identität. „Persönlich" ist die Überhöhung, die am 13.09. schon einmal bei „Verifiziert" abgemahnt-fähig war. | „Gewerbeschein geprüft, in meisterpflichtigen Gewerken zusätzlich der Meisterbrief." Das ist die wahre und stärkere Aussage. |
| `app/support-chat.tsx:42`, `app/landing.tsx:44-48` | „sicher, PCI-DSS-konform und **vollständig DSGVO-konform**"; Abzeichen „PStTG-konform", „DSGVO-konform" | Selbst vergebene Konformitätssiegel. Der eigene `docs/recht/rechts-audit-2026-09-13.md` markiert **beides als offen**: PStTG-Schwelle mit Waage-Symbol (Punkt 3), DSGVO-Lücken in Abschnitt G. Eine Aussage, die das eigene Audit bestreitet, gehört nicht in die Werbung. | Tatsache statt Siegel: „Zahlungen über Stripe. Daten auf Servern in Frankfurt." Die Siegel-Leiste ersetzen durch die drei Sätze, die auf `app/(tabs)/index.tsx:415-417` schon stehen. |
| `app/zahlungsmethoden.tsx:117` | „Ihre Zahlungsdaten werden mit **PCI DSS Level 1 verschlüsselt**." | Sachlich falsch. PCI DSS ist ein Prüfstandard für Dienstleister, kein Verschlüsselungsverfahren. Ein Satz, der Fachlichkeit vortäuscht und dabei etwas Falsches behauptet. Dazu `:199` „IBAN-Eingabe öffnet sich über **Stripe Elements**" und `:69` „**Stripe Checkout** öffnet sich": Entwicklerbegriffe auf dem Kundenbildschirm. | „Ihre Kartendaten liegen bei Stripe, unserem Zahlungsdienstleister. Werkant speichert keine Kartennummern." `:199`: „Die IBAN geben Sie im nächsten Schritt sicher bei Stripe ein." |
| `app/support-chat.tsx:101` | „Ich komme hier nicht weiter. **Nenn mir** bitte ein Stichwort daraus:" | **Hausregelverstoß: Du-Form.** `anrede-check.py` meldet 0 Abweichungen, weil der Kurzimperativ ohne Pronomen und ohne Endung steht, genau die Lücke, die in `CLAUDE.md` (16.08.) beschrieben ist und danach wieder aufgerissen wurde. | „Nennen Sie mir bitte ein Stichwort daraus:" · und `anrede-check.py` um die Kurzform „Nenn" erweitern, sonst passiert es wieder. |
| `app/reklamation.tsx:256` und `:68` · `app/support-chat.tsx:44` · `app/garantie.tsx:59` und `app/reklamation.tsx:173` | „Das Werkant-Eskalationsteam prüft Ihren Fall **innerhalb von 24h**" · „Innerhalb von 24h" · „Unser Team prüft jeden Fall **innerhalb von 2 Werktagen**" · „**ohne festes Zeitversprechen**" | **Drei verschiedene Zusagen, zwei davon im selben Bildschirm** (`reklamation.tsx:256` gegen `:173`). Wer 24 Stunden liest und nach drei Tagen nichts hört, schreibt eine schlechte Bewertung. Die ehrliche Fassung steht schon zweimal im Produkt. | Überall eine Formulierung: „Wir prüfen Ihren Fall und melden uns per E-Mail. Im Beta-Betrieb ohne festes Zeitversprechen." Zusätzlich „Eskalationsteam" streichen, das gibt es nicht. |
| `app/support-chat.tsx:79` gegen `:90` | „verbinde ich Sie jederzeit mit **einem unserer Support-Mitarbeiter**" gegen „Einen **Live-Chat mit Mitarbeitenden gibt es (noch) nicht**." | Widerspruch **in derselben Datei**, im selben Dialog erreichbar. `:90` ist nachweislich die spätere, ehrliche Fassung; `:79` ist stehengeblieben. | `:79`: „Gern geschehen. Kommen wir nicht weiter, leite ich Sie an unseren E-Mail-Support weiter." |
| `app/landing.tsx:171` gegen `:220` | „Beta · **deutschlandweit verfügbar**" gegen „**Geschlossener Testbetrieb**." · dazu `:93` „Werkant ist deutschlandweit offen" und `components/ui/BetaBanner.tsx:27` „**Geschlossene** Beta" | Auf einem Bildschirm steht offen und geschlossen. Der Kunde kann nicht wissen, ob er sich anmelden kann. `BetaBanner.tsx:27` enthält zusätzlich die Tautologie „vermittelt als reiner Plattform-Vermittler". | Eine Wahrheit, überall gleich: „Testbetrieb. Anbieter laden wir nach und nach frei." Tautologie in `BetaBanner` zu „Werkant vermittelt; der Vertrag entsteht zwischen Ihnen und dem Betrieb." |
| `app/landing.tsx:400`, `:402`, `app/einstellungen.tsx:395` | „Werkant UG **i.G.**" · „Werkant UG **(i.G.)**" · „**© 2025** Werkant UG (i.G.) · Köln" | Drei Schreibweisen, **keine davon** ist `COMPANY.name` aus `constants/legal.ts:74` („Werkant UG (haftungsbeschränkt)"). Der Rechtsformzusatz nach § 5a Abs. 1 GmbHG fehlt in allen dreien. `COMPANY_LEGAL_INLINE` (`legal.ts:107`) existiert genau dafür und wird hier nicht benutzt. Dazu ein Jahreszahl-Fehler: 2025 im Jahr 2026. | Beide Stellen an `COMPANY_LEGAL_INLINE` binden, Jahr aus `new Date()`. **Rechtsform-Frage an CCO/Legal**, nicht im Stil-Durchgang selbst entscheiden. |
| `app/zahlungsmethoden.tsx:212` | „Zahlungen werden erst nach Ihrer Auftragsfreigabe an den Anbieter übertragen. **Kein Risiko für Sie.**" | Absolutaussage, die das Produkt nicht halten kann: nach § 640 Abs. 2 BGB gilt die Leistung nach 14 Tagen ohne Meldung als abgenommen und wird ausgezahlt (steht in `support-chat.tsx:42` selbst). Auch eine Reklamation kann gegen den Kunden ausgehen. | Satz ersatzlos streichen. Der erste Satz trägt allein und ist wahr. |
| `app/garantie.tsx:117` | „Werkant sichert jeden Auftrag durch **Escrow**, **KYC-Verifizierung** und digitale Verträge." | Der Vertrauens-Absatz auf dem Vertrauens-Bildschirm besteht aus zwei englischen Fachbegriffen. „Escrow" steht sichtbar auf rund 20 Bildschirmen (u. a. `zahlung.tsx:187/238/426`, `(tabs)/auftraege.tsx:142`, `auftrag-detail.tsx:78-89`, `reklamation.tsx:70`), „KYC" hier zum einzigen Mal für Kunden. Der 54-Jährige liest das nicht, er springt ab. | „Ihr Geld liegt auf einem Treuhandkonto, die Betriebe sind geprüft, der Vertrag steht schriftlich fest." Repoweit **ein** deutsches Wort für Escrow festlegen (Vorschlag: Treuhand) und durchziehen. |
| `app/angebot.tsx:231-233` | „Bis 48 Stunden vor dem Termin sagen Sie kostenlos ab. Danach **behalten wir die Hälfte ein**, in den letzten 24 Stunden den ganzen Betrag." | „Wir" ist die falsche Partei: nach AGB §1(2)/§2(3) ist Werkant nicht Vertragspartei, die Stornopauschale steht dem Betrieb zu. Gelesen wird: die Plattform steckt das Geld ein. Zusätzlich führt `docs/recht/rechts-audit-2026-09-13.md` die Pauschale ohne Nachweisvorbehalt als abmahnbar (§ 309 Nr. 5 BGB). | „… behält der Betrieb die Hälfte, in den letzten 24 Stunden den vollen Betrag." Nachweisvorbehalt ist eine **Legal-Frage**, nicht Text. |
| `app/bewertung.tsx:84` | „Ihre Bewertung hilft anderen Kunden und motiviert **unsere Handwerker** zur **Höchstleistung**." | „Unsere Handwerker" behauptet eine Zugehörigkeit, die die eigenen AGB bestreiten, und ist genau das Wort, das in einem Statusfeststellungsverfahren zitiert wird. „Höchstleistung" ist eine Leerformel. | „Ihre Bewertung hilft anderen Kunden bei der Auswahl." Punkt. |
| `app/garantie.tsx:36` gegen `:37` | Überschrift „Nachbarschaft: 100% **ans Hilfsprojekt**" gegen Fließtext „geht der Betrag zu 100 % **an den Helfer**" | Widerspruch in einer Karte. „Hilfsprojekt" kommt sonst nirgends im Produkt vor, offenbar ein Rest aus einer früheren Fassung. Dazu „100%" ohne Leerzeichen gegen „100 %" im Text darunter. | Überschrift: „Nachbarschaft: 100 % an den Helfer". |
| `app/betrieb/pro.tsx:289` gegen `:144` | FAQ „Wie kündige ich? **Hier in der App jederzeit.**" gegen Kündigen-Dialog „**Kündigen Sie per E-Mail** an …, Betreff: „Pro kündigen"." | Derselbe Bildschirm sagt zwei verschiedene Wege. Der Nutzer tippt auf Kündigen und bekommt eine Mailvorlage. | Eine Wahrheit. Solange nur E-Mail funktioniert: „Schreiben Sie uns eine E-Mail mit dem Betreff „Pro kündigen". Der Zugang bleibt bis zum Ende des bezahlten Monats." (Ob § 312k BGB einen Kündigungsknopf erzwingt: **Frage an CCO/Legal**, Pro-Kunden sind Unternehmer.) |
| `app/anbieter-warteliste.tsx:102` gegen `:104` | „Aufträge aus Ihrem **Veedel**." gegen „Werkant startet **deutschlandweit** mit einer handverlesenen Anbieter-Runde." | „Veedel" ist Kölsch und stammt aus der Köln-Phase. Der Satz direkt darunter widerspricht ihm. Ein Handwerker aus Hamburg versteht die Überschrift nicht, ein Kölner liest ein Versprechen, das der nächste Satz zurücknimmt. | „Aufträge aus Ihrer Nachbarschaft." Oder, falls die Köln-Akquise weiterläuft: ortsabhängig setzen, nicht als feste Überschrift. |
| `app/anbieter-warteliste.tsx:105`, `:92` | „Wir melden uns persönlich **innerhalb von 48 Stunden**." · „Die ersten Betriebe je Gewerk und Region erhalten **Gründer-Konditionen**." | Eine harte Frist, die niemand halten kann, sobald mehr als eine Handvoll Anmeldungen kommt, auf demselben Produkt, das an anderer Stelle bewusst „ohne festes Zeitversprechen" schreibt. „Gründer-Konditionen" ist inhaltsleer und klingt zugleich wie eine Zusage. | „Wir melden uns persönlich bei Ihnen, sobald wir Ihr Gewerk in Ihrer Region freischalten." Und: entweder die Konditionen konkret benennen (z. B. „die ersten zwölf Monate ohne Pro-Gebühr") oder den Begriff streichen. |
| `app/betrieb/pro.tsx:190`, `:188` | „**Alle Premium-Funktionen** für professionelle Handwerker auf einer Plattform." · „**Mehr Aufträge. Mehr Einnahmen.**" | Reine Werbesprache ohne Substanz, und `pro.tsx:135` sagt im selben Bildschirm „Bald verfügbar. Werkant Pro wird in Kürze freigeschaltet." Es wird also ein Versprechen für ein Produkt gegeben, das es noch nicht gibt. | „Bessere Platzierung in der Suche, Anfragen zuerst, mehr Zahlen zu Ihren Aufträgen." Also die drei Dinge nennen, die es tatsächlich tut. |
| `app/betrieb/pro.tsx:48`, `:68`, `:62`, `:57` | „**Conversion-Rate** und Umsatztrends" · „**Kalender-Sync**. Google Kalender & **iCal-Integration**" · „**Pro-Badge**" · „**Prioritäts-Support**" | Vier Anglizismen in einer Vorteilsliste für Handwerker. Der Zielkunde ist ein Meisterbetrieb mit fünf Mitarbeitern, nicht ein SaaS-Einkäufer. | „Wie viele Ihrer Angebote zum Auftrag werden" · „Ihr Kalender, verbunden mit Google oder Apple" · „Pro-Kennzeichen im Profil" · „Ihre Anfragen kommen im Support zuerst dran". |
| `app/stornierung.tsx:133-135` | „**> 48h** vor Termin" · die mittlere Stufe „24 [Halbgeviertstrich] 48h vor Termin" · „**< 24h / No-Show**" | Mathezeichen und ein englischer Begriff in der Stornotabelle, also genau dort, wo es um Geld geht und Verständnis Streit verhindert. | „Mehr als 48 Stunden vorher" · „24 bis 48 Stunden vorher" · „Weniger als 24 Stunden vorher oder niemand da". |
| `app/bewertung.tsx:122` | „Wie war **Ihr Erlebnis**?" | Erlebnis-Sprache aus dem Reise- und Gastro-Bereich. Eine reparierte Heizung ist kein Erlebnis. Der Ton passt zu Airbnb, nicht zu Handwerk und nicht zur eigenen Stimme („ruhig, kompetent"). | „Wie zufrieden sind Sie mit der Arbeit?" |
| `app/garantie.tsx:143` und repoweit | `value="€29/mo"` · Gebührenkasten mit „€1,50", „€1,99", „€29" | „mo" ist die englische Monatsabkürzung, in einer deutschen App. `betrieb/pro.tsx:216-217` schreibt dieselbe Zahl korrekt als „€29" plus „/Monat". Zusätzlich steht das Euro-Zeichen repoweit 69-mal **vor** und 30-mal **nach** der Zahl; deutsch üblich ist „29 €". | „29 € / Monat". Danach eine Regel festlegen und einmal durchziehen, sonst wandert die Uneinheitlichkeit weiter. |
| `app/landing.tsx:262`, `:33`, `:248` | „**Jede Funktion wurde entwickelt, um** Auftraggeber und Anbieter fair zu schützen." · „Strike-System bei Regelverstößen. **Qualität wird belohnt.**" · „**Gebaut für Vertrauen**" | Drei Sätze, die nichts behaupten, was man prüfen könnte, auf der wichtigsten Seite. „Strike-System" ist dazu Jargon: der Kunde weiß nicht, was ein Strike ist. | `:262` streichen, der Abschnitt trägt sich aus den Karten selbst. `:33`: „Wer sich nicht an die Regeln hält, verliert den Zugang." `:248`: „Warum Werkant" reicht als Überschrift. |
| `app/landing.tsx:22`, `:38`, `:184`, `:195` · `app/landing.tsx:286`, `:310`, `app/(tabs)/auftraege.tsx:142`, `app/zahlung.tsx:240` | „Geprüfte **Profis**" · „**Anbieter** finden" · „geprüften **Betrieben**" · „Jetzt **Handwerker** finden" · „In 4 Schritten zum **Job**" · „**Job**-Betrag" · „Freigabe nach **Job**-Abschluss" · „Nach dem **Job**" | Fünf Wörter für dieselbe Sache auf **einem** Bildschirm, dazu „Job" als viertes Wort für „Auftrag" (das sonst 152-mal im Produkt steht). „Zum Job" liest ein deutscher Kunde als Arbeitsstelle. | Ein Wort je Rolle festlegen und in `docs/brand/` festhalten: „Betrieb" für Handwerksbetriebe, „Helfer" für Nachbarschaft, „Anbieter" nur als Oberbegriff in Formularen. „Job" überall durch „Auftrag" ersetzen. |

## Was gut ist und bleiben sollte

Diese Stellen sind der Maßstab. Wer den Text überarbeitet, soll sie **nicht**
anfassen, sondern die anderen Bildschirme daran angleichen.

**1. Fehlermeldungen, die ihre eigene Grenze benennen.**
`app/suche.tsx:306` „Anbieter konnten nicht geladen werden. Das heißt nicht,
dass es keine gibt." und `app/(tabs)/index.tsx:467` „Die Verbindung zum Server
hat nicht geklappt. Ob es Anbieter gibt, wissen wir gerade nicht."
Das ist die beste Copy in der App. Sie sagt, was schiefging, und behauptet
nichts über das, was sie nicht wissen kann. Genau das fehlt allen Befunden
oben.

**2. Die ehrliche Fassung des Zeitversprechens.**
`app/garantie.tsx:59` und `app/reklamation.tsx:173`: „im Beta-Betrieb ohne
festes Zeitversprechen". Das ist die Formulierung, die überall gelten sollte
(siehe Befund 7).

**3. Eine Einschränkung, die zu Vertrauen umgedreht wird.**
`app/landing.tsx:23`, `app/garantie.tsx:32`, `app/support-chat.tsx:45`:
„Ausweiskopien verlangen wir bewusst nicht." Ein „wir tun weniger" als Stärke
zu erzählen, ist handwerklich gut und passt zur Marke.

**4. Der Beta-Hinweis auf der Startseite.**
`app/landing.tsx:220-223`: „Geschlossener Testbetrieb. Werkant vermittelt und
wickelt die Zahlung ab; der Vertrag kommt zwischen Auftraggeber und Betrieb
zustande. Zahlungen laufen derzeit im Stripe-Testmodus. Es fließt noch kein
echtes Geld." Vier Tatsachen, ruhig, ohne Angstmache. (Nur die Überschrift
`:171` darüber widerspricht ihm, Befund 9.)

**5. Fehlende Funktion ehrlich erklärt und trotzdem nützlich.**
`app/bewertung.tsx:242`: „Bilder zu Bewertungen sind noch nicht freigeschaltet.
Beschreiben Sie das Ergebnis so lange im Text. Der zählt für andere Kunden
ohnehin am meisten." Sagt nein und gibt gleichzeitig einen besseren Weg.

**6. Die Kategorie-Platzhalter im Auftragsformular.**
`app/auftrag-aufgeben.tsx:95-111`, z. B. „z. B. Badezimmer fliesen, ca. 12 m²,
Wandfliesen 20x20cm" oder „z. B. Umzug 3. OG ohne Aufzug, ca. 15 Kartons +
Sofa". Konkret, mit Maßen, in der Sprache der Baustelle. Der beste Text für
beide Zielgruppen im ganzen Produkt.

**7. Der korrigierte Filter in der Suche.**
`app/suche.tsx:495-496` „Nur sofort buchbare Anbieter / Zahlung über Werkant
eingerichtet". Sagt genau, was der Schalter tut, statt „verifiziert" zu
behaupten. Vorbild für Befund 2 und 3.

**8. Die Gebührenerklärung auf der Startseite.**
`app/landing.tsx:324` „Kunden zahlen den vollen Betrag. Die Gebühr wird vom
Anbieter-Auszahlungsbetrag abgezogen. Weist der Betrieb Materialkosten aus,
bleiben die provisionsfrei." Drei Sätze, jeder prüfbar, kein Marketing.

**9. Die Vertrauensleiste auf der Startseite der App.**
`app/(tabs)/index.tsx:440-442`: „Geprüfte Betriebe · Verbindliche Angebote ·
Geld erst nach Abnahme". Drei kurze Tatsachen ohne ein einziges Fremdwort.
Diese Leiste sollte die Abzeichen-Leiste auf `app/landing.tsx:44-48`
(„PStTG-konform", „Stripe Escrow", „18+ Verifiziert", „DSGVO-konform")
ersetzen, nicht umgekehrt.

**10. Der Hinweis, der nur den Absender trifft.**
`lib/chatGuard.ts:75` `kontaktHinweis(text, binIchDerAbsender)`. Eine Warnung
mit Folgen bekommt nur, wen die Folge trifft. Bitte so lassen.

## Nicht anfassen, gesetzlich fixiert

Die folgenden Stellen sind **kein** Stil-Material. Der Wortlaut ist
vorgeschrieben oder hängt an einer laufenden rechtlichen Klärung. Wer hier
„verständlicher" schreibt, erzeugt einen Rechtsverstoß.

| Fundstelle | Warum fix |
|---|---|
| `app/widerruf.tsx:14`, `:34` ff. | **Muster-Widerrufsformular**, Anlage 2 zu Art. 246a § 1 Abs. 2 S. 1 Nr. 1 EGBGB. Der Wortlaut ist gesetzlich vorgegeben. `scripts/anrede-check.py` nimmt diese Stelle bereits ausdrücklich aus (Vermerk im Skriptkopf, 16.08.). |
| `app/widerruf.tsx:15`, `:64-84` | **Widerrufsbelehrung**, § 312d BGB i. V. m. Art. 246a § 1 EGBGB. Achtung: `docs/recht/rechts-audit-2026-09-13.md` Punkt 1 hält fest, dass sie den **falschen Unternehmer** nennt (Werkant statt Anbieter). Das ist ein offener Rechtspunkt für CCO/Legal, **keine** Textaufgabe. Gemeldet, nicht geändert. |
| `app/impressum.tsx:49-88`, `:147` | **Pflichtangaben** nach § 5 DDG und § 18 Abs. 2 MStV. Die Werte kommen aus `constants/legal.ts` (`COMPANY`), das ist die richtige Bindung. Der Fließtext drumherum darf ruhiger werden, die Angaben selbst nicht. |
| `app/datenschutz.tsx` (ganze Datei) | **Informationspflichten** nach Art. 13 und 14 DSGVO. Kürzen nur mit Rechtsprüfung. Der Rechts-Audit führt hier offene Punkte (Abschnitt G), die inhaltlich zu lösen sind, nicht stilistisch. |
| `app/agb.tsx` (ganze Datei) | Vertragstext. `scripts/agb-code-check.py` und der Rechts-Audit vergleichen den **Code gegen diesen Wortlaut**. Wer den Wortlaut ändert, verschiebt den Maßstab. |
| `app/rechnung.tsx:264` „§ 13b UStG … Reverse Charge" | Der Nachtrag vom 14.09. in `docs/recht/rechts-audit-2026-09-13.md` markiert die Anwendung auf **deutsche** Anbieter ausdrücklich als offene Frage an den Steuerberater und lässt den Code bewusst unverändert. Nicht anfassen. |
| `app/nachbarschaft.tsx:322` „§22 Nr. 3 EStG" | Die Norm stimmt; die Einordnung des ganzen Nachbarschaft-Tracks ist aber der größte offene Rechtspunkt (Rechts-Audit Punkt 4, DRV-Statusfeststellung). Änderbar ist hier **nur** die Typografie („§ 22" mit Leerzeichen). Die Aussage selbst gehört zu CCO/Legal. |
| `components/ui/DsgvoConsent.tsx:33-34` (PStTG/DAC7, 30 Vorgänge / 2.000 €) und `app/nachbarschaft.tsx:295` | Die **Zahlen** stehen im Gesetz und dürfen nicht „gerundet" werden. Ob die Schwelle für Dienstleistungen überhaupt gilt, ist offen (Rechts-Audit Punkt 3). Sprachlich einfacher formulieren ist erlaubt, die Schwellen zu verändern nicht. |
| `app/einstellungen.tsx:126` „Art. 17 DSGVO", „HGB §238" | Die Fristen und Pflichten sind fix. Änderbar ist nur die Schreibweise der Fundstelle („§ 238 HGB" statt „HGB §238"). |

## Was dieses Audit nicht geprüft hat

Damit ihm niemand zu viel zutraut:

- **Nur sichtbarer Text**, ausgelesen über `scripts/sichtbarer_text.py`.
  Push-Texte in `supabase/functions/**` und E-Mail-Vorlagen sind **nicht**
  geprüft. Dort liegt erfahrungsgemäß dieselbe Fehlerklasse.
- **Kein Gerätetest.** Ob ein Text in seinen Knopf passt oder umbricht, sagt
  diese Analyse nicht.
- **Keine Rechtsberatung.** Die Verweise auf UWG, GmbHG und BGB sind Hinweise
  auf Prüfbedarf, die Entscheidung liegt bei CCO/Legal.
- **Die Prüfer bleiben blind für die Klassen oben.** Sie finden Rückfälle bei
  bekannten Formen, nicht Widersprüche zwischen Bildschirmen. Nach den
  Korrekturen wäre je ein kleiner Prüfer sinnvoll für: (a) Kurzimperative in
  der Du-Form (Befund 6), (b) Euro-Zeichen vor der Zahl (Befund 23),
  (c) „Job", „Escrow", „KYC", „No-Show", „Conversion" im sichtbaren Text.
