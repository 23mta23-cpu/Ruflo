# Köln-Akquise-Startpaket — Anbieter-Gewinnung Köln + Leverkusen

Direkt einsetzbares Arbeitsmaterial für die manuelle Anbieter-Akquise.
Grundlage: `docs/agents/werkant-playbooks.md` (Playbook 5 „Köln-Akquise"),
Gebührenmodell aus `lib/feeEngine.ts`.

**Fakten, die in jeder Ansprache stimmen müssen (CCO-Regel — nichts anderes behaupten):**

- Handwerker-Track: 8 % Provision vom Auftragswert, mindestens 3 €, **nur bei
  erfolgreich abgeschlossenem, bezahltem Auftrag**. Keine Grundgebühr, keine
  Lead-Gebühren, keine Laufzeit.
- Nachbarschaft-Track (C2C-Helfer): 0 % Provision, der Kunde zahlt 1,99 €
  Werkant-Schutz pro Auftrag.
- Escrow: Der Kunde zahlt bei Beauftragung ein, das Geld liegt treuhänderisch
  fest — **Auszahlung erst bei Abschluss**. Kein Hinterherlaufen bei Rechnungen.
- „Werkant-geprüft"-Siegel: Verifizierung des Betriebs; Gewerke mit
  Meisterpflicht (z. B. Elektro, Heizung & Sanitär, Maler, Dachdecker) nur mit
  Meisterbrief-Nachweis.
- **Ehrlichkeit als Pitch:** Werkant startet gerade. Es gibt noch keine
  Nutzerbasis und keine Auftragszahlen, die man versprechen könnte. Das Angebot
  ist: Gründungspartner werden — 0 € Risiko, weil ohne Auftrag keine Gebühr.

**Rechtsrahmen (§ 7 UWG, verbindlich):** Kalt-E-Mail und Kalt-WhatsApp an
Betriebe **ohne Einwilligung sind abmahnfähig** — auch B2B. Erlaubt und
genutzt: persönlicher Besuch, Brief/Postkarte, **Antwort auf öffentliche
Inserate** (Kleinanzeigen, Facebook-Posts „Suche Aufträge"), Telefon bei
bestehendem Geschäftskontakt, sowie E-Mail/WhatsApp **nachdem** der Betrieb
seine Nummer/Adresse für die Kontaktaufnahme gegeben hat (z. B. QR-Code →
Anbieter-Warteliste, Rückruf-Bitte, Visitenkartentausch). Die Vorlagen unten
nur in diesen Fällen einsetzen.

---

## 1) Ziel-Liste: 5 Gewerke zuerst

| Prio | Gewerk (`data/categories.ts`) | Warum zuerst |
|---|---|---|
| 1 | Heizung & Sanitär (`heizung-sanitaer`) | Dauerhaft hohe Nachfrage (Notfälle, Bäder), Meisterpflicht → „Werkant-geprüft" + Meisterbrief-Badge ist echtes Differenzierungsmerkmal. Betriebe sind selten vertraglich an Portale gebunden. |
| 2 | Elektro (`elektro`) | Gleiches Muster: Meisterpflicht-Badge-Vorteil, hohe Nachfrage (Wallboxen, Smart Home, Altbau Köln). Viele Kleinbetriebe ohne eigene Online-Präsenz. |
| 3 | Maler (`maler`) | Höchstes Volumen an Privatkunden-Aufträgen, niedrige Einstiegshürde für den ersten Test-Auftrag. Viele Solo-Selbstständige, die Lead-Portale wegen Vorkasse-Gebühren meiden — genau unser Gegenmodell. |
| 4 | Reinigung / Gebäudereinigung (`reinigung`, `gebaeudereinigung`) | Hohe, wiederkehrende Nachfrage; schnelle erste Abschlüsse (kleine Auftragswerte, kurze Entscheidungswege). Kaum Portal-Bindung. |
| 5 | Umzugshilfe (`umzugshilfe`) | Köln/Leverkusen = ständige Umzüge (Studierende, Pendler). Escrow löst das branchentypische Bar-und-weg-Problem. Viele Anbieter inserieren öffentlich → rechtssicher ansprechbar. |

**Begründung der Auswahl insgesamt:** Kombination aus (a) belegbar hoher
Alltagsnachfrage, (b) geringer vertraglicher Bindung an MyHammer/Blauarbeit
(Lead-Kauf-Modelle ohne Exklusivität — Wechselkosten null), (c) bei Prio 1–3
zusätzlich der Meisterpflicht-Badge-Vorteil, den Lead-Portale so nicht zeigen.

### Wo Betriebe finden

1. **Handwerkskammer zu Köln** — öffentliche Betriebsdatenbank
   (hwk-koeln.de → Betriebssuche), filterbar nach Gewerk und Ort. Deckt Köln
   und Leverkusen ab. Liefert: Firmenname, Inhaber, Adresse.
2. **Google Maps** — Suche „[Gewerk] Köln [Veedel]" / „… Leverkusen".
   Priorisieren: Profile mit **wenigen oder alten Bewertungen** (= hungrig auf
   Aufträge) und ohne eigene Website. Liefert: Telefonnummer, Öffnungszeiten.
3. **Lokale Facebook-Gruppen** — z. B. „Handwerker Köln", Veedel-Gruppen
   (Ehrenfeld, Nippes, Kalk …), „Leverkusen — Biete/Suche". Wer dort öffentlich
   „Suche Aufträge" postet, darf direkt beantwortet werden (rechtssicher).
4. **Kleinanzeigen, Rubrik Dienstleistungen** (Köln/Leverkusen) — öffentliche
   Inserate von Malern, Umzugshelfern, Reinigungskräften. Antwort auf Inserat
   = zulässige Erstansprache, auch per Nachricht.
5. **nebenan.de** — für den Nachbarschaft-Track (Helfer ohne Meisterpflicht).

### Tabellen-Template zum Abarbeiten

Als Tabelle in einer eigenen Datei/Tabelle führen (eine Zeile pro Betrieb):

| # | Betrieb | Gewerk | Ort/Veedel | Quelle | Kontaktweg (rechtssicher) | Kontakt 1 (Datum) | Kontakt 2 (+7 T) | Kontakt 3 (+14 T) | Status | Notiz |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | HWK / Maps / FB / Kleinanz. | Besuch / Brief / Antwort auf Inserat / Tel. | | | | interessiert / später / nein | |

**Regeln:** Status „nein" → nie wieder kontaktieren. „Später" → Wiedervorlage
nach 90 Tagen. Pro Gewerk 10 Betriebe listen, bevor Kontakt 1 startet.

---

## 2) WhatsApp-Erstansprache (max. 300 Zeichen, Du-Form)

**Nur verwenden als:** Antwort auf ein öffentliches Inserat, oder wenn der
Betrieb seine Nummer für die Kontaktaufnahme gegeben hat (QR-Warteliste,
Rückruf-Bitte, persönlicher Kontakt).

> Hallo [Name], hier ist [Founder-Name] aus Köln. Ich baue Werkant, eine neue
> Plattform für Aufträge aus deinem Veedel. Keine Grundgebühr, 8 % nur wenn du
> bezahlt wirst, Geld liegt bis Abschluss sicher fest. Wir suchen 20
> Gründungsbetriebe. Hast du diese Woche 10 Min für ein Telefonat?

(≈ 290 Zeichen inkl. Leerzeichen bei eingesetzten kurzen Namen — vor dem
Senden einmal zählen.)

---

## 3) E-Mail-Vorlage (Sie-Form, ~120 Wörter)

**Nur verwenden mit** Einwilligung (Warteliste/QR-Code), bestehendem Kontakt
oder als Antwort auf ein Inserat mit E-Mail-Adresse. Keine Kalt-E-Mail (§ 7 UWG).

**Betreff:** Aufträge aus Ihrem Veedel — Gebühr nur bei Erfolg

> Guten Tag [Herr/Frau Nachname],
>
> vielen Dank für Ihr Interesse an Werkant [bzw.: danke für das Gespräch am
> …]. Kurz zusammengefasst, was wir Kölner und Leverkusener Betrieben bieten:
>
> - Keine Grundgebühr, keine Lead-Gebühren. 8 % Provision (mind. 3 €) fallen
>   nur an, wenn ein Auftrag abgeschlossen und bezahlt ist.
> - Der Kunde zahlt bei Beauftragung auf ein Treuhandkonto ein — Sie sehen vor
>   Arbeitsbeginn, dass das Geld da ist.
> - Mit Meisterbrief erhalten Sie unser „Werkant-geprüft"-Siegel.
>
> Ehrlich gesagt: Wir starten gerade und können keine Auftragszahlen
> versprechen. Deshalb suchen wir 20 Gründungsbetriebe zu Sonderkonditionen —
> ohne Risiko, denn ohne Auftrag zahlen Sie nichts.
>
> Passt Ihnen ein kurzes Telefonat diese Woche?
>
> Mit freundlichen Grüßen
> [Founder-Name], Gründer Werkant, Köln — [Telefon] · [Website]

---

## 4) Telefon-Leitfaden

**Zulässig bei:** Rückruf-Bitte, bestehendem Geschäftskontakt, Antwort auf
Inserat mit Telefonnummer. Bei B2B genügt zudem mutmaßliche Einwilligung —
im Zweifel restriktiv auslegen und zuerst Brief/Besuch nutzen.

### 30-Sekunden-Pitch

> „Guten Tag, [Founder-Name], ich rufe aus Köln an — ich bin Gründer von
> Werkant, einer neuen Plattform für Handwerksaufträge hier aus der Region.
> Anders als bei MyHammer zahlen Sie bei uns nichts für Kontakte: keine
> Grundgebühr, keine Lead-Gebühr. Nur wenn ein Auftrag zustande kommt und
> bezahlt wird, nehmen wir 8 Prozent. Und das Geld des Kunden liegt ab
> Beauftragung auf einem Treuhandkonto — Sie fangen keine Arbeit mehr an, ohne
> zu wissen, dass es bezahlt wird. Wir starten gerade und suchen die ersten 20
> Betriebe als Gründungspartner. Haben Sie zwei Minuten?"

### Die 3 häufigsten Einwände — ehrliche Antworten

**1. „Was kostet das?"**
> „Nichts, solange nichts reinkommt. Keine Anmeldegebühr, kein Abo. Wenn Sie
> über Werkant einen Auftrag abschließen und der Kunde bezahlt hat, behalten
> wir 8 Prozent, mindestens 3 Euro. Kein Auftrag, keine Kosten — das ist das
> ganze Modell."

**2. „Dafür habe ich keine Zeit."**
> „Verstehe ich — deshalb dauert die Einrichtung keine 10 Minuten: Profil,
> Gewerke, Umkreis, Meisterbrief fotografieren, fertig. Danach müssen Sie
> nichts pflegen. Wenn eine Anfrage kommt, entscheiden Sie am Handy, ob sie
> sich lohnt. Wenn nie etwas Passendes kommt, haben Sie 10 Minuten verloren
> und keinen Cent."

**3. „Noch so ein Portal — MyHammer hat mir nur Geld gekostet."**
> „Genau deshalb rufe ich an. Dort zahlen Sie für Kontakte, egal ob ein
> Auftrag daraus wird. Bei uns ist es umgekehrt: Gebühr nur bei bezahltem
> Auftrag. Und ich bin ehrlich: Wir sind neu, ich kann Ihnen heute keine
> Auftragszahlen zeigen. Ich kann Ihnen nur ein Modell zeigen, bei dem Sie
> nichts riskieren — und den Status als Gründungsbetrieb der ersten Stunde."

**Gesprächsende immer mit klarem nächsten Schritt:** Termin für Onboarding
(10 Min, gemeinsam am Telefon) ODER Einwilligung für eine E-Mail mit dem Link
ODER sauberes „Nein" in die Liste.

---

## 5) Onboarding-Versprechen

### Was der Betrieb nach 10 Minuten hat

- Vollständiges Anbieter-Profil: Betriebsname, Gewerke, Einsatzgebiet
  (Köln/Leverkusen + Umkreis), Beschreibung, Foto.
- Meisterbrief hochgeladen → Verifizierung für das „Werkant-geprüft"-Siegel
  angestoßen (Pflicht bei Meisterpflicht-Gewerken).
- Sichtbarkeit für alle passenden Auftragsanfragen im Einsatzgebiet ab dem
  Moment, in dem sie eingestellt werden — als einer der ersten Betriebe, also
  praktisch ohne Konkurrenz auf der Plattform.
- Auszahlungsweg eingerichtet (Konto verknüpft), damit die erste Auszahlung
  nicht am Papierkram scheitert.
- Direkten Draht zum Gründer (Handynummer) — kein Support-Ticket-System.

### Was Werkant NICHT verspricht (und warum das das Verkaufsargument ist)

- **Keine Auftrags- oder Nutzerzahlen.** Es gibt noch keine Nutzerbasis —
  jede Zahl wäre erfunden. Wird ein Betrieb später enttäuscht, weil wir
  geflunkert haben, ist er für immer weg und erzählt es weiter.
- **Keine Garantie auf den ersten Auftrag in Zeitraum X.**
- Stattdessen das ehrliche Angebot: **„Gründungspartner werden, 0 Risiko."**
  Kein Auftrag = keine Kosten. Früher Platz auf der Plattform, Siegel,
  Gründungskonditionen für die ersten 20 Kölner/Leverkusener Betriebe — und
  wenn Werkant nichts bringt, hat es genau 10 Minuten gekostet.

---

## 6) Wochenplan Founder — Woche 1–2 (max. 5 h/Woche)

### Woche 1 — Liste bauen, erste Kontakte (5 h)

| Tag | Dauer | To-do |
|---|---|---|
| Mo | 1,5 h | Ziel-Liste füllen: je 10 Betriebe für Heizung & Sanitär und Elektro aus HWK-Datenbank + Google Maps in die Tabelle (Abschnitt 1). Kontaktweg pro Betrieb festlegen. |
| Di | 1 h | 10 Maler-Betriebe listen. Kleinanzeigen + Facebook-Gruppen durchgehen: alle offenen „Suche Aufträge"-Inserate (alle 5 Gewerke) markieren — die dürfen direkt angeschrieben werden. |
| Mi | 1 h | Alle markierten Inserate beantworten (WhatsApp-/Nachrichten-Vorlage, Abschnitt 2). Ziel: 5–8 versendete Antworten. |
| Do | 1 h | Brief/Postkarte Kontakt 1 an die Top 10 der Sanitär/Elektro-Liste (1-Satz-Nutzen + QR-Code zur Anbieter-Warteliste). |
| Fr | 0,5 h | Rückläufe verarbeiten: Status in Tabelle pflegen, Telefontermine für Woche 2 legen. |

### Woche 2 — Gespräche führen, erste Onboardings (5 h)

| Tag | Dauer | To-do |
|---|---|---|
| Mo | 1 h | Telefontermine abarbeiten (Leitfaden Abschnitt 4). Ziel: 3 Gespräche. |
| Di | 1 h | 2 persönliche Besuche im Veedel (Betriebe ohne Reaktion, aber mit Ladenlokal/Werkstatt): kurzer Pitch + Karte mit QR-Code dalassen. |
| Mi | 1 h | Reinigung + Umzugshilfe: je 10 Anbieter listen (Kleinanzeigen/nebenan.de), öffentliche Inserate direkt beantworten. |
| Do | 1,5 h | Onboardings durchführen: mit jedem interessierten Betrieb die 10 Minuten gemeinsam am Telefon durchgehen (Profil, Meisterbrief, Auszahlung). Ziel Woche 2: 2–3 fertige Profile. |
| Fr | 0,5 h | Wochenreview: Tabelle aktualisieren, Kontakt-2-Briefe (+7 Tage) für Woche-1-Betriebe vorbereiten, „Später"-Fälle mit Wiedervorlagedatum versehen. |

**Erfolgskriterium nach 2 Wochen (realistisch, keine Vanity-Metrik):**
50 Betriebe in der Liste, ≥ 15 rechtssichere Erstkontakte, ≥ 5 geführte
Gespräche, 2–3 vollständig onboardete Gründungsbetriebe. Erst wenn 5 Betriebe
in 2 Gewerken live sind, beginnt die Nachfrage-Seite (Warteliste aktivieren).
