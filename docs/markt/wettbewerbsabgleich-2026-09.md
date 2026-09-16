# Wettbewerbsabgleich September 2026: MyHammer, Check24 Profis, Airbnb

Erstellt am 14.09.2026. Vergleichsobjekte in dieser Reihenfolge der Wichtigkeit:
MyHammer (direkter Wettbewerber), Check24 Profis (Handwerk), Airbnb (nur
Vertrauens-Mechanik, andere Branche).

Zweck: Lücken benennen, keine Oberflächen-Kopie. Jede Aussage trägt ihre
Quelle.

## Quellen-Kennzeichnung

| Kennung | Bedeutung |
|---|---|
| **[gesehen]** | Seite oder Datei selbst geladen und gelesen |
| **[Suche]** | Nur aus Suchergebnissen, Seite selbst nicht erreichbar |
| **[Annahme]** | Eigene Schlussfolgerung, nicht belegt |

### Was erreichbar war und was nicht

**MyHammer: die eigenen Seiten waren aus dieser Umgebung NICHT ladbar.**
`robots.txt` erlaubt das Lesen ausdrücklich (nur `/einloggen`, `/_next` und
`*.json` sind gesperrt) **[gesehen]**, aber jeder Abruf von `www.my-hammer.de`
und `www.my-hammer.at` endet mit HTTP 403 und der Cloudflare-Zwischenseite
"Just a moment…". Geprüft mit normalem Abruf, mit Browser-Kennung, mit
TLS-Nachbildung (curl_cffi) und über das Fetch-Werkzeug: Startseite,
`/handwerker`, `/qualitaets-standard`, `/nachweis`,
`/preisinformationen-ueber-auftraege`, alle 403 **[gesehen]**. Die
Schutzmaßnahme wurde nicht umgangen. Alles zu MyHammer in diesem Dokument ist
deshalb **[Suche]**, überwiegend aus Vergleichsportalen und Ratgeberseiten,
nicht aus der Primärquelle. Zahlenangaben dort widersprechen sich teilweise
(200.000 registrierte Betriebe / 700.000 Verzeichnis-Einträge / 1,6 Mio.
registrierte Handwerker je nach Quelle), sie sind daher nur als Größenordnung
brauchbar.

**Check24: erreichbar.** Gelesen wurden `handwerk.check24.de/craftsmen/
handwerker` (Kundenseite), `handwerk.check24.de/craftsmen/dienstleister/
handwerker` (Anbieterseite), `consumer.profis.check24.de/portal/cs/
teilnahmebedingungen-happiness-guarantee` und `consumer.profis.check24.de/
portal/cs/agb` **[gesehen]**.

**Airbnb: erreichbar.** Gelesen wurden die Hilfeartikel 2799 (Off-Platform and
Fee Transparency Policy), 995 (Bewertungsfristen) und 3218 (AirCover für
Gäste) **[gesehen]**. `robots.txt` sperrt davon nichts **[gesehen]**.

**Werkant: vollständig am Quelltext gemessen.** Gelesen wurden
`app/anbieter.tsx`, `app/suche.tsx`, `app/auftrag-aufgeben.tsx`,
`app/(tabs)/index.tsx`, `app/auftrag-detail.tsx`, `app/angebot.tsx`,
`app/bewertung.tsx`, `app/agb.tsx`, `data/categories.ts`, `lib/chatGuard.ts`,
`lib/strikes.ts`, `lib/feeEngine.ts`, `lib/cities.ts`, die Migrationen 0200,
0440, 0560 und `docs/recht/rechts-audit-2026-09-13.md` **[gesehen]**.

Dazu die vorhandene Hausreferenz `.claude/design-references/airbnb/DESIGN.md`
**[gesehen]**: Sie belegt zwei Dinge, die hier zählen. Erstens die
Gästeliebling-Auszeichnung als zentrierte große Bewertungszahl, die Werkant im
Anbieterprofil bereits sinngemäß übernommen hat (Kommentar in
`app/anbieter.tsx`). Zweitens, ausdrücklich unter "Known Gaps": Airbnb liefert
in den untersuchten Oberflächen **keinen Dunkelmodus**, das System beschreibt
nur ein helles Thema.

Keine Konten angelegt, keine Anmeldung, kein Massen-Abruf.

---

## Was die Wettbewerber tun

### MyHammer

- Kunden stellen einen Auftrag kostenlos ein und erhalten bis zu zehn
  unverbindliche Angebote; für private Auftraggeber fallen keine Gebühren an
  **[Suche]**.
- Die Angebotsseite trägt die Kosten: Abo oder Guthaben plus eine Kontaktgebühr
  je Auftrag, genannt werden 8 Euro für Kleinstreparaturen bis über 70 Euro für
  Kernsanierungen. **Das Guthaben wird verbraucht, ob der Auftrag zustande kommt
  oder nicht** **[Suche]**.
- Geprüft wird die Gewerbeanmeldung, bei zulassungspflichtigen Gewerken der
  Meisterbrief, dazu Telefonverifizierung und ein Abgleich des eingetragenen
  Unternehmenszwecks mit den angebotenen Leistungen; sichtbar als Siegel
  "Geprüfter Betrieb" **[Suche]**.
- Kein Käuferschutz im Sinne einer Geld-zurück-Zusage, keine
  Treuhandabwicklung als Regelfall; es gibt eine Schlichtungsstelle **[Suche]**.
- Kaltstart historisch über ein Verzeichnis mit sehr vielen Einträgen, das
  Betriebe später beanspruchen; Premium-Platzierungen sind kostenpflichtig
  **[Suche]**.
- Wiederkehrende Kritik in Erfahrungsberichten: gelöschte negative Bewertungen
  und Zweifel an der Echtheit von Bewertungen **[Suche, Meinungsquellen,
  nicht belastbar]**. Für uns zählt daran nur eines: **die Bewertungsintegrität
  ist die offene Flanke des Marktführers.**

### Check24 Profis

- Kundenablauf in drei Schritten: "Kostenlose Anfrage stellen", "Angebote
  erhalten & vergleichen", "Handwerker beauftragen" **[gesehen]**.
- Vertrauen wird weitgehend **eingekauft und von außen belegt**: TÜV-Siegel
  "sehr gut", eKomi 4.9/5, ServiceRating-Zertifikat, dazu die Zusage "Nur
  geprüfte Betriebe und echte Bewertungen" **[gesehen]**.
- "Happiness Garantie" bei ausgezeichneten Profis: Erstattung des Auftragswerts
  und damit verbundener Sachschäden **bis 2.000 Euro**, Beschwerde innerhalb von
  30 Tagen, Voraussetzung ist, dass **alle Zahlungen über das Check24
  Online-Zahlungssystem** liefen und die Leistungsinhalte im Check24-Chat
  definiert wurden **[gesehen]**. Die Garantie ist damit gleichzeitig das
  schärfste Umgehungs-Gegenmittel: wer außerhalb zahlt, verliert sie.
- Für Auftraggeber entstehen bei Zahlung über das Online-Bezahlsystem "keine
  zusätzlichen Kosten seitens CHECK24 Profis" **[gesehen]**.
- Anbieterseite: "Keine Grundgebühr, kein Mindestumsatz, Sie zahlen nur für
  echte Kundenkontakte", "Kosten entstehen nur bei bestätigtem Interesse des
  Kunden", bis zu 30 Prozent Rabatt über Qualität und Aktivität, zum Einstieg
  ein **50 Euro Startguthaben** **[gesehen]**.
- Werbeversprechen "Bis zu 58% sparen" und Durchschnittspreise je Leistung
  (Wallbox 600 Euro, Einbauherd 84 Euro, 40 bis 80 Euro je Stunde) **[gesehen]**.
- Rolle: reiner Vermittler und Zahlungsabwickler, "Eine Vertragsbeziehung über
  die Ausführung des Auftrags kommt ausschließlich zwischen dem Auftraggeber und
  dem Auftragnehmer zustande"; bei Verstößen können Vermittlungsprozesse beendet
  und Konten vorübergehend oder endgültig gesperrt werden **[gesehen]**.

### Airbnb

- Off-Platform-Richtlinie (Artikel 2799): verboten sind unter anderem
  "Asking or encouraging users to move current, future, or repeat bookings off
  of Airbnb" und "Requesting, sending, or receiving payments outside of
  Airbnb". Folge: "In the event of repeated or severe violations, we may suspend
  or permanently deactivate a user's listings or account", durchgesetzt "at our
  sole discretion" **[gesehen]**.
- Bewertungen (Artikel 995): 14 Tage Frist ab Auszug, Veröffentlichung "once
  both you and your host have written reviews for each other, or after the
  14-day time limit ends, whichever comes first". Beide Seiten bewerten
  **[gesehen]**.
- AirCover für Gäste (Artikel 3218): in **jeder** Buchung enthalten, greift bei
  Stornierung vor Anreise, nicht erreichbarem Gastgeber oder erheblicher
  Abweichung vom Inserat, ausdrücklich "keine Versicherung" und nicht für
  Kleinigkeiten **[gesehen]**.
- "Gästeliebling" braucht mindestens fünf Bewertungen und einen Durchschnitt
  über 4,9 **[Suche]**.
- In Deutschland gilt das Host-only-Modell, 14 bis 16 Prozent Provision beim
  Gastgeber, der Gast sieht nur den Gesamtpreis inklusive Pflichtgebühren
  **[Suche]**.

---

## Der Abgleich

Legende: **[g]** gesehen, **[s]** nur aus Suchergebnis, **[a]** Annahme.

| Mechanik | MyHammer | Check24 | Airbnb | Werkant heute | Lücke |
|---|---|---|---|---|---|
| Prüfung der Angebotsseite | Gewerbeanmeldung, Meisterbrief bei Anlage A, Telefon **[s]** | "Nur geprüfte Betriebe" ohne Angabe, was geprüft wird **[g]** | Identität, kein Berufsnachweis **[a]** | `kyc_status='approved'`, Meisterpflicht je Kategorie in `data/categories.ts` **[g]** | Keine. Werkant prüft am tiefsten |
| Siegel | Eigenes "Geprüfter Betrieb" **[s]** | Fremdsiegel TÜV, eKomi, ServiceRating **[g]** | Eigene Auszeichnungen aus Daten **[g]** | Vier Badges im Profil **[g]** | **"Haftpflicht" hat keine Datengrundlage**, Badge hängt an `kycApproved` |
| Belegtiefe je Siegel | Unbekannt **[s]** | Fremdprüfer haftet mit **[g]** | Aus Buchungsdaten abgeleitet **[g]** | Ein Flag trägt drei Badges **[g]** | Kein Prüfdatum, keine Einzelbelege, obwohl `provider_public` schon `has_gewerbeschein` und `has_meisterbrief` liefert |
| Wer darf bewerten | Kritik an Echtheit **[s]** | "echte Bewertungen" **[g]** | Nur nach Aufenthalt **[g]** | Nur Vertragsparteien nach `status='completed'` (Migration 0440) **[g]** | Keine. Das ist heute der stärkste Punkt gegen MyHammer und wird nirgends gesagt |
| Gegenseitigkeit | Einseitig **[s]** | Einseitig **[g]** | Beidseitig, blind, 14 Tage **[g]** | Nur Kunde bewertet Anbieter; die Policy erlaubt beide Richtungen **[g]** | Anbieter zahlt 8 Prozent und hat keine Stimme; kein Schutz vor Bewertungsdruck |
| Antwort auf eine Bewertung | Ja **[s]** | Öffentliche Antwort bei Services **[g]** | Ja **[g]** | Nicht vorhanden, `reviews` hat kein Antwortfeld **[g]** | Ein 1-Stern-Text steht unwidersprochen für immer |
| Geldfluss | Direkt, kein Treuhand **[s]** | Zahlung über Check24 **[g]** | Zahlung über Airbnb **[g]** | Escrow über Stripe, Abnahmefrist 14 Tage nach §640 II BGB **[g]** | Keine. Werkant ist hier vorn |
| Käuferschutz | Kein Geld zurück, Schlichtung **[s]** | Bis 2.000 Euro, 30 Tage **[g]** | AirCover in jeder Buchung **[g]** | Escrow plus Schlichtung, keine Erstattungszusage **[g]** | Bewusst offen, siehe "Bewusst NICHT übernommen" (ZAG) |
| Gebühr Kunde | 0 **[s]** | 0 bei Zahlung über Check24 **[g]** | 0 in DE, im Preis enthalten **[s]** | 2,5 Prozent, mind. 1,50 Euro, bzw. 1,99 Euro Nachbarschaft **[g]** | Werkant ist die einzige der vier, die den Kunden sichtbar zahlen lässt |
| Gebühr Anbieter | Kontaktgebühr 8 bis über 70 Euro **ohne Auftrag** **[s]** | Preis je bestätigtem Kundenkontakt **[g]** | 14 bis 16 Prozent vom Umsatz **[s]** | 8 Prozent auf die Arbeitsleistung, mind. 3 Euro, **nur bei Abschluss** **[g]** | Keine. Das ist das stärkste Akquise-Argument und steht in keinem Kundentext |
| Wann die Gebühr sichtbar wird | Erst im Anbieter-Konto **[s]** | Anbieterseite offen, Kundenseite "keine Kosten" **[g]** | Gesamtpreis vor dem Klick ins Inserat **[s]** | Fußnote in Schritt 4, dann im Angebot **[g]** | Suchkarte und Profil zeigen "ab X Euro/h" ohne Hinweis auf die 2,5 Prozent |
| Umgehungsschutz, Regel | AGB-Verbot **[s]** | Verbot plus Garantieverlust **[g]** | Ausdrückliches Verbot, beide Seiten adressiert **[g]** | AGB §7(2), Strike bei Beauftragung außerhalb **[g]** | Regel adressiert nur den Anbieter |
| Umgehungsschutz, Durchsetzung | Unbekannt **[s]** | Sperrung, Ermessen **[g]** | "repeated or severe", "sole discretion" **[g]** | 3 Feststellungen in 12 Monaten = 1 Strike, 3 Strikes = Sperre, Begründung per E-Mail, Beschwerdeweg, Verfall nach 12 Monaten **[g]** | Keine. Werkant ist härter **und** fairer. Nur weiß das niemand |
| Erkennung | Unbekannt **[s]** | Chat als Beweismittel **[g]** | Nachrichtenanalyse **[a]** | `chatGuard` beim Tippen, `kontaktHinweis` beim Lesen, `chat_reports` als zweiter Weg **[g]** | Der Kunde bekommt keinen Grund, nur der Anbieter eine Drohung |
| Kaltstart Angebotsseite | Verzeichnis mit Fremdprofilen **[s]** | 50 Euro Startguthaben, bis 30 Prozent Rabatt **[g]** | Rang durch erste Bewertungen **[s]** | Warteliste, Köln-Akquise, Rubrik "Neu auf Werkant" **[g]** | Kein geldwerter Anreiz für die ersten Aufträge |
| Kaltstart Nachfrageseite | Bis zu zehn Angebote versprochen **[s]** | "Angebote erhalten & vergleichen" **[g]** | Bestand vorhanden **[a]** | Auftrag ausschreiben, ehrliche Leerzustände **[g]** | Kein Versprechen, das man halten kann, und keine Frist |
| Ortsbezug | PLZ zuerst **[s]** | PLZ zuerst **[g]** | Ort zuerst **[g]** | "Deutschlandweit" auf der Startseite, Umkreisfilter bewusst entfernt, `provider_public` führt keinen Ort **[g]** | Ein Handwerksmarkt ohne Ortsanker wirkt leer, auch wenn er es nicht ist |
| Leerer Zustand Suche | Unbekannt **[s]** | Unbekannt **[s]** | Filter lockern **[a]** | Drei unterschiedene Zustände: Ladefehler, noch keine Anbieter, keine Treffer, je mit Weg **[g]** | Keine. Besser als alles, was hier gemessen wurde |
| Leerer Zustand ohne Angebote | Unbekannt **[s]** | Unbekannt **[s]** | Entfällt **[a]** | "Noch keine Angebote. Sie werden benachrichtigt" **[g]** | Offenes Warten ohne Frist, ohne Zusage, ohne nächste Handlung |

---

## Acht Empfehlungen

Jede nennt die Zieldatei und den Grund, warum sie **für Werkant** trägt.

### 1. Die erfundene Antwortzeit entfernen

**Zieldatei:** `app/anbieter.tsx` (Statistikleiste im Kopfbereich)

Dort steht fest verdrahtet `~30 Min.` unter der Beschriftung "Antwortzeit",
für jeden Betrieb gleich, auch für einen, der noch nie geantwortet hat
**[gesehen]**. Das ist dieselbe Klasse wie der Stundensatz `?? 13` und die
erfundenen Anbieter, die beide schon entfernt wurden: eine Tatsachenbehauptung
über einen echten Betrieb, die niemand geprüft hat (§ 5 UWG). Entweder aus
`offers.created_at` minus `jobs.created_at` einen Median rechnen und erst ab
drei Messwerten zeigen, oder die Kachel weglassen. Drei echte Kacheln sind
mehr wert als vier, von denen eine erfunden ist.

### 2. Jedes Prüf-Siegel an einen eigenen Nachweis mit Datum binden

**Zieldateien:** `app/anbieter.tsx`, `app/bewerbung-eingegangen.tsx`, neue
Migration, `app/onboarding-kyc.tsx`

Heute: `<VerifiedBadge label="Haftpflicht" ok={kycApproved} />`. Für die
Betriebshaftpflicht gibt es **keine Spalte, kein Feld im Onboarding, keinen
Upload** irgendwo im Repo **[gesehen]**, die Vertriebsunterlagen versprechen
sie trotzdem (`docs/vertrieb/Anbieter-Akquise-Koeln.md`), und
`app/bewerbung-eingegangen.tsx` schreibt dem Kunden "Haftpflicht &
Qualifikation beider Parteien verifiziert". Gleichzeitig liefert
`provider_public` bereits `has_gewerbeschein` und `has_meisterbrief`, die das
Profil gar nicht benutzt. Also: Gewerbeschein und Meisterbrief an ihre eigenen
Flags hängen, für die Haftpflicht ein Upload plus Spalte plus Prüfdatum, und
bis das steht, das Badge entfernen. Grund: Check24 kauft Vertrauen bei TÜV und
eKomi ein, Werkant prüft selbst. Ein selbst vergebenes Siegel ist nur so viel
wert wie der Beleg dahinter, und hier steht der Markenname darunter.

### 3. Den Ortsanker zurückholen, ohne km zu behaupten

**Zieldateien:** `app/suche.tsx`, `app/(tabs)/index.tsx`, Migration für
`provider_public`

Der Umkreisfilter wurde zu Recht entfernt, weil es keine Koordinaten gibt
**[gesehen]**. Der Ausweg braucht auch keine: `profiles.plz` existiert bereits,
`provider_profiles.radius_km` auch. Der PLZ-Bereich (erste zwei Stellen) reicht
für "Arbeitet in Ihrer Region" und eine Sortierung, ohne eine Entfernung zu
behaupten, die man nicht kennt. Heute steht auf der Startseite
"Deutschlandweit" **[gesehen]**, während MyHammer und Check24 mit der PLZ
beginnen. Für einen Handwerksmarkt im Kaltstart ist das doppelt teuer: Der
Kunde sieht keinen lokalen Bezug, und der Köln-Bestand, den der Vertrieb gerade
aufbaut, wird nicht als Dichte sichtbar.

### 4. Dem leeren Angebotszustand eine Frist und eine Handlung geben

**Zieldatei:** `app/auftrag-detail.tsx` (Abschnitt "Noch keine Angebote")

Heute: "Anbieter können jetzt Angebote einreichen. Sie werden benachrichtigt,
sobald eines eingegangen ist" **[gesehen]**. Kein Zeitraum, keine Zusage, keine
Handlung. Der einzige Ausweg daneben ist der Nachbarschafts-Hinweis, und der
hängt an `FEATURES.NACHBARSCHAFT`, das der Rechts-Audit vom 13.09. auf `false`
empfiehlt **[gesehen]**. In den ersten Monaten ist dieser Bildschirm der
Normalfall, nicht der Ausnahmefall. Er braucht drei Dinge: einen ehrlichen
Zeitrahmen, eine Zusage, die man halten kann ("Wenn nach 48 Stunden kein
Angebot da ist, melden wir uns bei Ihnen"), und eine Handlung, die der Kunde
sofort tun kann (Fotos nachreichen, Beschreibung schärfen). MyHammer verspricht
bis zu zehn Angebote **[Suche]**, Check24 verspricht "Angebote erhalten &
vergleichen" **[gesehen]**. Werkant verspricht nichts, und Schweigen liest sich
wie ein leerer Marktplatz.

### 5. Die 2,5 Prozent dort zeigen, wo der Kunde den Preis zuerst sieht

**Zieldateien:** `app/suche.tsx` (Ergebniskarte), `app/anbieter.tsx`
(Abschnitt Leistungen), `app/angebot.tsx`

Die Ergebniskarte zeigt "ab €X/h", das Profil "Stundensatz ab €X", die Gebühr
steht erst als Fußnote in Schritt 4 des Auftragsformulars und dann im Angebot
**[gesehen]**. Werkant ist die einzige der drei Plattformen, bei der der Kunde
überhaupt etwas zahlt: MyHammer 0, Check24 "keine zusätzlichen Kosten",
Airbnb in Deutschland im Preis enthalten **[gesehen, Suche]**. Genau deshalb
darf die Zahl nicht spät kommen. Eine ruhige Zeile neben dem Preis
("zzgl. 2,5 % Werkant-Servicegebühr, mind. 1,50 €, deckt Treuhand und
Abnahme") ist kein Nachteil, sondern der Beleg für die Zusage aus
AGB §6(1) "wird vor Auftragsbestätigung transparent ausgewiesen". Airbnb hat
die Gesamtpreisanzeige erst nach einem europäischen Verfahren eingeführt
**[Suche]**; das ist der Weg, den man nicht zweimal gehen muss.

### 6. Bewertungen gegenseitig machen, mit Fenster und Antwortrecht

**Zieldateien:** `app/bewertung.tsx`, `lib/reviews.ts`, neue Migration
(Felder `reply`, `published_at`)

Die Datenbank kann es schon: Migration 0440 erlaubt beiden Vertragsparteien,
die jeweils andere zu bewerten **[gesehen]**. Die App nutzt nur eine Richtung,
veröffentlicht sofort ("Ihr Feedback wird nach der Bewertung veröffentlicht")
und kennt keine Antwort **[gesehen]**. Airbnb veröffentlicht erst, wenn beide
geschrieben haben oder 14 Tage um sind **[gesehen]**. Für Werkant zählt daran
nicht die Symmetrie, sondern die Wirkung auf die Angebotsseite: Ein Betrieb,
der 8 Prozent abgibt, trägt heute das volle Reputationsrisiko und hat kein
Gegengewicht, wenn ein Kunde mit einem Stern droht. Ein Antwortrecht kostet ein
Textfeld und nimmt der schlimmsten Bewertung die Hälfte ihrer Wirkung. Und der
Punkt, der MyHammers offene Flanke trifft, ist bereits gebaut, nur unbenannt:
bei Werkant kann niemand bewerten, der keinen abgeschlossenen Vertrag hat. Das
gehört als Satz an die Bewertungen ("Nur nach abgeschlossenem Auftrag, geprüft
von Werkant"), nicht in eine Migration.

### 7. Die Umgehungsregel auch dem Kunden erklären, und zwar als Schutz

**Zieldateien:** `lib/chatGuard.ts`, `app/chat.tsx`

`kontaktHinweis()` zeigt dem Absender die Strike-Folge und dem Empfänger nur
"Was Sie außerhalb von Werkant absprechen, deckt der Werkant-Schutz nicht ab"
**[gesehen]**. Die Trennung ist richtig, die Kundenseite ist aber zu schwach:
Sie nennt keinen Nutzen und keine Handlung. Meist ist es der Kunde, der die
Nummer erfragt, und sanktioniert wird nur der Betrieb. Check24 löst das über
den Preis der Umgehung für den Kunden: Die Happiness Garantie greift nur, wenn
**alle** Zahlungen über Check24 liefen **[gesehen]**, Airbnb erklärt dem Gast
den Betrugsschutz **[gesehen]**. Werkants Gegenwert heißt Treuhand, Abnahme,
Beleg und Schlichtung, und der gehört genau in diesen Moment: "Bezahlen Sie
außerhalb, gibt es keinen Treuhandschutz, keine Abnahmefrist und keinen Beleg."
Das ist kein neues Versprechen, nur die Nennung dessen, was der Kunde gerade
aufgibt.

### 8. Den ersten drei Aufträgen eines neuen Betriebs die Provision erlassen

**Zieldateien:** `lib/feeEngine.ts`, `app/betrieb/onboarding-stripe.tsx`,
`docs/vertrieb/Anbieter-Akquise-Koeln.md`

Check24 gibt 50 Euro Startguthaben und bis zu 30 Prozent Rabatt für Qualität
und Aktivität **[gesehen]**, MyHammer verlangt Guthaben schon für den bloßen
Kontakt **[Suche]**. Werkant nimmt 8 Prozent, aber **nur bei Abschluss**. Das
ist in der Akquise das stärkste Argument und kostet im Kaltstart fast nichts,
weil es kaum Abschlüsse gibt. Drei provisionsfreie Aufträge für jeden neu
freigeschalteten Betrieb kosten bei einem Auftragswert von 500 Euro rechnerisch
40 Euro je Betrieb und sind ein Satz, den man am Telefon sagen kann. Bedingung:
Das muss im Anbieterprofil sichtbar sein und darf die Reihenfolge in der Suche
nicht beeinflussen, sonst steht es gegen AGB §2(4) und Art. 5 P2B.

---

## Bewusst NICHT übernommen

**Kontaktgebühr oder Lead-Modell.** MyHammer verbraucht Guthaben je Kontakt,
unabhängig vom Ergebnis **[Suche]**, Check24 verlangt Geld bei "bestätigtem
Interesse" **[gesehen]**. Beides macht die Plattform unabhängig davon, ob der
Handwerker Geld verdient. Werkants 8 Prozent bei Abschluss ist das einzige
Modell der drei, bei dem beide Seiten dasselbe Ziel haben. Das ist kein Detail
der Preisliste, das ist die Position.

**Bezahlte Platzierung und Premium-Ranking.** Bei MyHammer kostenpflichtig
**[Suche]**. AGB §2(4) sagt heute ausdrücklich, dass es das bei Werkant nicht
gibt, und Art. 5 P2B macht die Offenlegung verbindlich. Eine einzige gekaufte
Position würde den Satz zur Falschangabe machen.

**Fremdsiegel einkaufen.** TÜV, eKomi und ServiceRating bei Check24
**[gesehen]**. Das kostet laufend Geld und verschiebt das Vertrauen auf einen
Dritten. Werkant hat ein eigenes Siegel und einen Markennamen, der
"Werkant-geprüft" behauptet. Der richtige Weg ist Empfehlung 2, nicht ein
zweites Logo daneben.

**Geld-zurück-Garantie nach Check24-Vorbild.** 2.000 Euro Erstattung
**[gesehen]** ist wirksam und derzeit für Werkant nicht tragbar: Der Rechts-Audit
vom 13.09. führt die ZAG-Frage als offen mit strafrechtlichem Risiko und weist
bereits `app/garantie.tsx` als Text aus, der das eigene ZAG-Argument
untergräbt **[gesehen]**. Eine Erstattungszusage aus eigener Kasse macht die
Frage schlimmer, nicht besser. Erst nach anwaltlicher Klärung, und dann als
Versicherungsprodukt, nicht als Versprechen der Plattform.

**Preisvergleich als Leitmotiv.** "Bis zu 58% sparen" **[gesehen]** zieht die
Kundschaft an, die den billigsten nimmt, und drückt genau die Betriebe heraus,
die Werkant halten will. Werkants Versprechen ist geprüft, verbindlich,
bezahlt nach Abnahme, nicht billig.

**Verzeichnis mit nicht beanspruchten Fremdprofilen.** Der historische
MyHammer-Kaltstart **[Suche]**. Werkant hat erfundene Anbieter schon einmal
entfernt, samt der Begründung im Quelltext von `app/suche.tsx` und
`app/(tabs)/index.tsx` **[gesehen]**. Ein Profil über einen Betrieb ohne dessen
Zutun ist zusätzlich ein DSGVO- und Wettbewerbsthema. Der ehrliche Leerzustand
bleibt.

**Bildgetriebene Oberfläche nach Airbnb-Art.** Airbnbs System ruht auf
Fotografie, alles andere tritt zurück. Werkant hat keine Objektfotos und soll
keine Stimmung erzeugen, die den fehlenden Bestand überdeckt. Der Vertrauens-
Anker ist der Nachweis, nicht das Bild. Übernommen wird von Airbnb genau
zweierlei: die große Bewertungszahl als ruhiger Vertrauensmoment (steht bereits
in `app/anbieter.tsx`) und die Gegenseitigkeit der Bewertung (Empfehlung 6).

**Dunkelmodus.** Am 14.09.2026 abgelehnt und begründet: 2.953 Aufrufstellen der
Farbtoken. Kein Wettbewerber hier führt ihn im Produkt, Airbnb ausdrücklich
nicht. Die Bone-Palette (#F9F8F5) und Forest (#1B5C40) bleiben die eine
Oberfläche.

---

## Die drei größten Lücken in einem Satz

1. **Vertrauen ohne Beleg:** Ein Haftpflicht-Siegel ohne Daten und eine
   erfundene Antwortzeit stehen im selben Profil, das die Marke tragen soll.
2. **Der leere Zustand ist der Normalzustand,** und er verspricht heute nichts,
   was man halten könnte.
3. **Die guten Regeln sind unsichtbar:** verifizierte Bewertungen, Provision
   nur bei Abschluss und ein begründeter, befristeter Strike sind besser als
   beim Wettbewerb und stehen in keinem Text, den ein Kunde oder ein Betrieb je
   liest.

---

# Nachtrag 16.09.2026: Uber, TaskRabbit, Thumbtack

**Anlass:** Founder-Frage vom 15.09.2026, sinngemäß „schaust du dir Airbnb,
Uber, MyHammer, TaskRabbit auch an?" und „uns unterscheidet dann ich schätze
die Sicherheit". Die erste Fassung dieses Abgleichs deckte MyHammer, Check24
Profis und Airbnb ab. Uber, TaskRabbit und Thumbtack fehlten. Das war eine
Lücke, und sie wird hier geschlossen.

## Quellen-Kennzeichnung

Was hier steht, stammt aus öffentlich erreichbaren Seiten der Anbieter und
aus Fachartikeln (September 2026). **Nicht** aus einem Testkonto: für
TaskRabbit, Thumbtack und Uber gibt es keinen Zugang, und ein Konto bei einem
Wettbewerber anzulegen, um Preise zu messen, wäre die Sorte Abkürzung, die
dieses Projekt sich verboten hat.

Bei den MyHammer-Zahlen ist die Quellenlage **schlecht**: mehrere der
Treffer stehen auf Domains, die thematisch nichts mit Handwerk zu tun haben
(`ruag-ammotec.at`, `eselalm.at`, `mythoskg.at`) und widersprechen sich in der
Kernfrage, ob es zusätzlich eine prozentuale Provision gibt. Belastbar ist
nur: Grundgebühr in der Größenordnung 60 € im Monat plus bezahlte Kontakte.
Wer mit diesen Zahlen in ein Verkaufsgespräch geht, sollte die Quelle
vorher selbst prüfen.

## Thumbtack: das Lead-Modell in Zahlen

Thumbtack ist MyHammers amerikanisches Gegenstück und damit der beste Beleg
dafür, wohin das Lead-Modell führt, wenn man es zehn Jahre laufen lässt.

| Größe | Wert |
|---|---|
| Preis je Kontakt | etwa 15 bis 60 US-Dollar, im Einzelfall dreistellig |
| Kontakte ohne jede Antwort | etwa 75 Prozent |
| Abschlussquote der Betriebe | 20 bis 30 Prozent |
| Tatsächliche Kosten je gewonnenem Auftrag | 50 bis über 200 US-Dollar |
| Beschwerden beim BBB in drei Jahren | über 1 400 |

Der Kern der Beschwerden ist nicht der Preis, sondern die **Richtung des
Risikos**: Bezahlt wird der Kontakt, nicht der Auftrag. Berichtet werden
Abbuchungen für Anfragen, die der angebliche Kunde nie gestellt hat, für
Kontakte außerhalb des Einsatzgebiets, und für Anfragen, die gleichzeitig an
fünf Betriebe gingen. Ein Kontakt, aus dem nichts wird, wird nicht
automatisch erstattet.

**Was das für uns heißt.** Unser Modell dreht genau diese Richtung um: 8 %
auf die Arbeitsleistung, fällig ausschließlich bei einem abgeschlossenen und
bezahlten Auftrag, keine Grundgebühr, keine Laufzeit. Das ist kein
Preisargument, sondern ein Risikoargument, und es ist das stärkere.

Rechenbeispiel, das ein Betrieb nachvollziehen kann (MyHammer-Zahlen mit dem
Vorbehalt oben):

| Monat | MyHammer | Werkant |
|---|---|---|
| kein Auftrag | rund 60 € Grundgebühr plus gekaufte Kontakte | 0 € |
| ein Auftrag über 300 € | Grundgebühr plus Kontakte | 24 € |
| fünf Aufträge über je 300 € | Grundgebühr plus Kontakte | 120 € |

Bei hohem Volumen wird unser Modell teurer, und das gehört in jedes
Verkaufsgespräch, sonst fällt es später auf uns zurück. Der Punkt ist der
schlechte Monat: dort kostet Werkant nichts, und genau dort entscheidet ein
kleiner Betrieb, ob er bleibt.

## TaskRabbit: ein anderes Vertrauensmodell, und warum wir es nicht kopieren

TaskRabbit prüft die **Person**: Identitätsprüfung, Strafregisterabfrage über
den Dienstleister Checkr (national, lokal, Sexualstraftäterregister),
Sozialversicherungsnummer, Adressnachweis. Dazu eine „Trust and Support"-
Gebühr und „TaskProtect", eine nachrangige Absicherung.

Das ist sauber gedacht: Wer in eine fremde Wohnung geht, sollte überprüft
sein. Nur lässt es sich in Deutschland so nicht bauen, und das aus Gründen,
die nicht Bequemlichkeit sind:

1. **Ein Unternehmen bekommt kein Führungszeugnis.** Nach § 30 BZRG
   beantragt es die Person selbst. Wir könnten es nur verlangen und uns
   vorlegen lassen.
2. **Verlangen dürfen wir es nicht ohne Weiteres.** Die Erhebung müsste für
   den Zweck erforderlich sein (Art. 5 Abs. 1 lit. c, Art. 6 DSGVO). Für ein
   angemeldetes Gewerbe ist das schwer zu begründen.
3. **Der Staat prüft die Zuverlässigkeit bereits.** Wer ein Gewerbe anmeldet,
   unterliegt § 35 GewO; bei Unzuverlässigkeit wird das Gewerbe untersagt.
   Ein registrierter Handwerksbetrieb ist damit anders gestellt als ein
   Privatmensch, der bei TaskRabbit Möbel aufbaut.
4. **Ausweiskopien erheben wir bewusst nicht** (§ 20 PAuswG, und es steht an
   vier Stellen im Produkt).

**Unsere Entsprechung ist eine andere und sie ist stärker, wo sie greift:**
Gewerbeschein, bei meisterpflichtigen Gewerken der Meisterbrief (§ 1 HwO
Anlage A), Steuernummer, Identitäts- und Altersprüfung durch den
Zahlungsdienstleister. Das prüft nicht den Menschen, sondern die
**Berechtigung, diese Arbeit zu verkaufen**. Für „Elektroinstallation" ist
das die relevantere Frage als ein Strafregisterauszug.

**Ehrlich dazu, was das nicht leistet:** Im Nachbarschafts-Track sind die
Helfer Privatpersonen ohne Gewerbeschein. Dort prüft nur der
Zahlungsdienstleister die Identität. Das steht seit dem 16.09.2026 so auf
`kosten.html`, und es darf nie wieder als „verifizierte Alltagshelfer"
verkauft werden.

## Uber: die eine Sache, die sich übertragen lässt

Ubers Sicherheitsbausteine sind fast alle fahrtspezifisch (Fahrt teilen,
Kamera im Auto, Notfallknopf). Eines davon ist es nicht:

**Die PIN beim Start.** Der Fahrgast sieht eine vierstellige Zahl in der App
und nennt sie dem Fahrer, bevor die Fahrt beginnt. Das beweist, dass die
richtigen zwei Personen zusammengekommen sind.

Auf Werkant übertragen heißt das: Der Kunde nennt dem Betrieb beim Eintreffen
einen Code aus der App. Das leistet drei Dinge auf einmal:

1. **Sichtbare Sicherheit für den Kunden.** Er lässt niemanden in die
   Wohnung, der den Termin nicht in der App hat. Das ist Sicherheit, die man
   *sieht*, im Unterschied zu einer RLS-Policy.
2. **Ein belegter Arbeitsbeginn.** Heute gibt es keinen Zeitpunkt, an dem
   nachweisbar ist, dass der Betrieb da war. Im Streitfall („er kam nie")
   steht Aussage gegen Aussage.
3. **Ein Beleg gegen die Umgehung.** Wer den Auftrag an der Plattform vorbei
   abwickelt, löst den Code nicht ein. Das ist ein zweites, unabhängiges
   Signal neben dem Chat-Hinweis (`chat_leak_flags`, `chat_reports`) und es
   hängt nicht am Gerät des Absenders.

Dazu gehört die Gegenrichtung, sonst wird es einseitig: Der Betrieb sieht,
dass der Kunde den Code bestätigt hat, und der Kunde kann den Termin mit
einem Angehörigen teilen (Ubers „Fahrt teilen"), bevor ein Fremder kommt.

**Nicht übernommen:** das Verifiziert-Abzeichen für Kunden. Uber lässt
Fahrgäste freiwillig einen Ausweis hochladen. Genau das erheben wir bewusst
nicht, und ein Abzeichen, das fast alle tragen, unterscheidet ohnehin nichts
(dieselbe Begründung wie beim entfernten Nachbarschafts-Abzeichen).

## Antwort auf die Founder-Frage: ist Sicherheit unser Unterschied?

Gemessen an diesen drei Anbietern: **teilweise, und nicht in der Form, in der
sie unsichtbar bleibt.**

- **Sicherheit, die niemand sieht** (RLS, Rechteentzug auf Funktionen,
  Ratenbegrenzung, getrennte Schlüssel) ist eine Eintrittskarte. Sie
  verhindert, dass wir sterben. Sie gewinnt keinen einzigen Kunden, weil
  niemand sie wahrnimmt, und alle drei Wettbewerber haben sie auch.
- **Sicherheit, die man sieht,** gewinnt: das Treuhandkonto (der Kunde sieht,
  wo sein Geld liegt), die PIN beim Start, der begründete und befristete
  Strike, die Bewertung, die an einen abgeschlossenen Auftrag gebunden ist.
- **Der eigentliche Unterschied liegt woanders:** in der Richtung des
  Risikos. Thumbtack und MyHammer lassen den Betrieb für den Kontakt zahlen,
  wir für das Ergebnis. Und in der Ehrlichkeit: Wir behaupten nur, was der
  Code beweisen kann, und seit dem 14.09.2026 gibt es Skripte, die genau das
  erzwingen.

Das Problem ist nicht, dass uns die Unterschiede fehlen. Das Problem ist,
dass sie in keinem Text stehen, den ein Kunde oder ein Betrieb je liest. Das
ist Lücke 3 dieses Dokuments, und sie ist die nächste Arbeit.

## Was daraus folgt, in der Reihenfolge des Nutzens

1. **Die guten Regeln sichtbar machen** (Lücke 3). Ohne Code-Änderung, nur
   Text, und jede Aussage an den Code gebunden. Größter Nutzen je Aufwand.
2. **PIN beim Arbeitsbeginn.** Liefert Sicherheit, Streitbeweis und ein
   Umgehungssignal in einem. **Korrektur vom 16.09.:** hier stand „eine
   Spalte, ein Bildschirm, ein Beleg". Das war zu einfach gedacht. Eine
   Spalte in `contracts` geht nicht, weil der Betrieb die PIN nicht lesen
   darf und Leserechte zeilenweise gelten, nicht spaltenweise pro Person;
   vierstellig ohne Versuchssperre ist in Sekunden durchprobiert; und der
   Vergleich muss auf dem Server stattfinden, sonst liest der Betrieb die
   Zahl im Netzverkehr mit. Entwurf mit allen drei Punkten:
   `docs/produkt/start-pin-entwurf.md`.
3. **Das Risiko-Argument in den Verkauf.** Der Vergleich oben gehört in
   `docs/vertrieb/Anbieter-Akquise-Koeln.md`, mit dem Vorbehalt zur
   Quellenlage und mit dem ehrlichen Hinweis, dass wir bei hohem Volumen
   teurer sind.
4. **Termin teilen** für den Kunden. Klein, billig, und es adressiert die
   Sorge, die eine Person hat, bevor ein Fremder in die Wohnung kommt.

**Bewusst nicht übernommen:** Strafregisterabfragen (rechtlich nicht
tragfähig, siehe oben), eine „Trust and Support"-Gebühr für den Kunden (wir
haben bereits 2,5 %, eine zweite Gebühr mit Vertrauens-Etikett wäre genau die
Sorte Selbstverständlichkeit, die § 5 UWG meint), und eine eigene
Absicherung nach dem Muster TaskProtect, solange die ZAG-Frage offen ist.
