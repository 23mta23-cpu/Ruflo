> **Neu hier? Lies zuerst `docs/STAND-UND-VISION.md`** — Überblick über Vision,
> technischen Stand, die Blocker (Stand 21.08.: es ist KEIN Secret gesetzt,
> weder Mail noch Stripe) und was nach Verantwortung vor uns liegt.
> Diese Datei hier ist die Chronik und die Quelle der Arbeits-Warteschlange;
> maßgeblich ist immer der OBERSTE „Offen"-Abschnitt, nicht ältere Listen.

# Stand 2026-09-23 (früh) — „Zurückgezogen" stand da, gebunden war er trotzdem

## Der Befund

Der Knopf „Zurückziehen" auf dem Betriebs-Dashboard setzte

    update offers set status='declined' where id=? and status='pending'

ab, **las das Ergebnis nicht**, entfernte die Zeile aus der Liste und meldete
„Angebot zurückgezogen". Zwei Ausgänge waren damit nicht unterscheidbar:

1. Ein Fehler (Netz, RLS). Nichts wurde geschrieben, der Betrieb liest
   trotzdem eine Erfolgsmeldung.
2. **Null betroffene Zeilen.** PostgREST meldet dafür keinen Fehler. Genau
   dann hat der Kunde in derselben Sekunde angenommen: es besteht ein
   Vertrag, und der Betrieb hält sich für frei.

Fall 2 ist eine Falschaussage mit Rechtsfolge. Die Policy dazu gibt es seit
Migration 0260 und war seitdem von keinem Test berührt.

## Klasse gemessen, dann entschieden

| | |
|---|---|
| Erfolgsmeldungen in `app/ components/ lib/` | 28 |
| davon nach einem ungeprüften Schreibvorgang | **1** |
| davon Fehlalarme | 0 |

Also ein Prüfer: `scripts/erfolgsmeldung-check.py` (CI + `run.sh`).

Zum Vergleich die Klasse, die aus demselben Grund **keinen** Prüfer bekommen
hat: „catch-Block ohne Meldung an den Nutzer" — 63 Blöcke, 24 stumm, davon
22 mit begründetem Kommentar. Ein Prüfer dafür hätte 22 Fehlalarme erzeugt.

## Was jetzt da ist

- `lib/angebotRueckzug.ts` — reine Regel, drei Ausgänge, jeder mit eigenem
  Satz. Jest: 7 Zusicherungen.
- `app/betrieb/dashboard.tsx` — `.select('id')`, Ergebnis gelesen, bei null
  Zeilen lädt der Bildschirm neu statt Erfolg zu melden.
- `scripts/reisen/reise16-angebot-rueckzug.cjs` — 15 Zusicherungen, drei
  Fälle mit **gleicher Eingabe und nur unterschiedlicher Antwort**.
- `scripts/db-test/angebot-rueckzug.sql` — AR1 bis AR4, die Server-Hälfte.

## Drei Dinge, die ich mir selbst nachweisen musste

1. **Teil F war zuerst ein Freifahrtschein.** Mit `fehlerBei: ['offers']`
   scheiterte auch das GET, es gab keinen Knopf, und die Zusicherung war
   mühelos grün — unter keiner Mutation rot. Jetzt eine eigene Route, die
   nur das SCHREIBEN scheitern lässt.
2. **AR2 und AR3 maßen zuerst die WHERE-Klausel des Tests, nicht die
   Policy.** Sie spiegelten `and status='pending'` und filterten die Zeile
   selbst heraus. Gemessen: mit Spiegelung blieb AR3 auch dann grün, wenn
   die Policy-Bedingung entfernt war.
3. **Die Eigentümer-Bedingung im `using` ist nicht einzeln nachweisbar.**
   Die SELECT-Policy macht ein fremdes Angebot gar nicht erst sichtbar. Sie
   bleibt als zweites Schloss stehen, mit Messwert über AR2.

## Mutationen (gemessen)

| Mutation | Wirkung |
|---|---|
| Ergebnis wieder ungeprüft | Quelltext-Prüfer rot, Reise 16: N2/N3/N4 und F2/F3/F4 rot, Z grün |
| Statusbedingung aus `using` (0260) | AR3 rot |
| Zielstatus aus `with check` (0260) | AR4 rot |
| Gegenprobe: Variable umbenannt | alles grün |
| Gegenprobe: Kommentar umformuliert | alles grün |

## Zahlenstand

| Lauf | PASS | Rückgabewert | Differenz, erklärt |
|---|---|---|---|
| 41 | 689 | 0 | +2 Reise 15 (Auszahlungszeile) |
| 42 | 706 | 0 | +15 Reise 16, +2 Erfolgsmeldungs-Prüfer |

Jest 832 (war 825, +7 `angebotRueckzug.test.ts`), db-test 376 (war 372,
+4 AR1 bis AR4), `tsc` 0. Keine Edge Function berührt, deshalb kein
`deno check` nötig.

## Offen

- **PR nach `main`** — jetzt **77 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, echte Ladungsanschrift (`LEGAL_PLACEHOLDER`), Gerätetest,
  DAC7-Entscheidung.

---

# Stand 2026-09-23 (nachts) — der Statuswert, der Geld bewegt

## Der Befund

`payout_operations.status = 'manual_review'` (0650) kam im ganzen Projekt nur
an zwei Stellen vor: in der Migration, die ihn setzt, und in den Deno-Tests.

Er bedeutet: eine Auszahlung, bei der etwas nicht stimmt. Abweichende
Transfer-ID, falscher Betrag, fremdes Zielkonto, mehrere passende Transfers,
falsche Währung, oder eine Erstattung während der Auszahlung. **In mehreren
dieser Fälle ist der Transfer bei Stripe bereits gelaufen.** Der Kunde hat
freigegeben, das Geld hängt, niemand erfährt es.

## Klasse gemessen, dann entschieden

| | |
|---|---|
| Statuswerte in check-Listen | 71 |
| davon kennt kein Bildschirm | 18 |
| davon Betreiber-Werkzeuge oder Lebenszyklus-Marken | 17 |
| verlangen eine Handlung | **1** |

Also **kein Prüfer für die Klasse** — er hätte 17 Fehlalarme erzeugt. Statt
dessen `auszahlung_status()` (1030) als vierte Zeile im Abschnitt
„Hintergrund-Läufe".

## Die wichtigste neue Regel

**Vor jeder Mutationsprobe fragen, welcher Code im Prüfstand wirklich läuft.**

Die Mutation „`auszahlung_status` wird nicht mehr gerufen" ließ Reise 15
vollständig grün — der Prüfstand ersetzt die Edge Function komplett durch
einen Stub. Damit war die Übergabe Function → Client von gar nichts gedeckt;
ein Tippfehler im Schlüsselnamen wäre durch `tsc`, `deno check`, Jest und die
Reise gefallen. Geschlossen über eine zweite Zusicherung im Prüfer.

## Zwei weitere eigene Fehler

- Die neue Zusicherung war zuerst blind für genau ihren Fall: ihr Regex las
  den **Wert** statt des **Schlüssels**.
- `\b` wurde beim Erzeugen des Prüfers als **Backspace** in die Datei
  geschrieben. Vier Fehlalarme an Code, der stimmte. `grep` zeigt das Zeichen
  nicht.

## Was vom Vortag sofort gegriffen hat

`betriebsauskunft-check.py` meldete `auszahlung_status()` als unabgerufen,
kaum dass die Migration stand — unpräpariert. RJ in `rechte.sql` blieb grün,
weil die neue Funktion die richtigen Rechte hat.

## Zahlenstand

| Lauf | PASS | Rückgabewert | Differenz, erklärt |
|---|---|---|---|
| 40 | 687 | 0 | Reise 15 + E3/E4 in Reise 7 |
| 41 | 689 | 0 | +2 Reise 15 (B4b, B4c für die Auszahlungszeile) |

Jest 825, db-test 372, `tsc` 0, `deno check` 0.

## Offen

- **PR nach `main`** — jetzt **75 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, echte Ladungsanschrift (`LEGAL_PLACEHOLDER`), Gerätetest,
  DAC7-Entscheidung.
- Über `/pruefung` jetzt ablesbar: die pg_cron-Zeitpläne, die DAC7-Frist und
  **hängende Auszahlungen**.

---

# Stand 2026-09-22 (nachts) — die Sichtbarkeit war selbst unsichtbar

## Der Befund

Drei Betreiber-Selbstauskünfte in der Datenbank, und **kein Bildschirm** rief
eine davon auf:

| Funktion | seit | woran sie hängt |
|---|---|---|
| `zustellung_status()` | 0880 | DSA Art. 17, Art. 4 P2B-VO (Übermittlung geschuldet) |
| `abnahme_lauf_status()` | 0850 | Geld bleibt im Treuhandkonto liegen |
| `pstg_meldung_status()` | 1010 | § 13 PStTG (Frist 31. Januar), § 25 (Bußgeld) |

Alle Aufrufe standen in `scripts/db-test/`. Migration 1010 trägt den Namen
„pstg_meldung_sichtbar" — sichtbar war sie nur für einen psql-Aufruf.

Dieselbe Klasse wie „eine Mitteilung ohne Empfänger-Bildschirm" (16.09.),
nur eine Ebene höher: die Sichtbarkeit selbst war unsichtbar.

## Was jetzt da ist

- `lib/betriebsstatus.ts` — reine Regel, drei Stufen, jeder Satz nennt die
  Folge. „ok" bleibt in der Liste: ein Abschnitt, der bei gutem Stand leer
  wäre, sieht aus wie „nicht geladen".
- Edge Function `pruefung`, Aktion `betriebsstatus` — die drei RPCs mit
  `service_role`, **jede einzeln gefangen**. Fällt eine aus, ist sie `null`
  und wird als dringend gemeldet, nicht als „in Ordnung".
- `app/pruefung.tsx` — Abschnitt „Hintergrund-Läufe", drei Zustände.
- `scripts/betriebsauskunft-check.py` (CI + `run.sh`), Reise 15 (18
  Zusicherungen), RJ in `rechte.sql`.

## Drei Dinge, die ich mir selbst nachweisen musste

1. **Mein erster Grep erfand den Befund.** Er durchsuchte
   `app/ lib/ components/ scripts/` und nicht `supabase/functions/`.
   `/health` ruft alle drei — gibt aber nur Booleans an den Wächter-Workflow.
   Die Formulierung ist überall auf „kein Bildschirm" korrigiert.
2. **Der Leerstand verdeckte den Befund.** „Nichts offen" war ein Vollbild
   und ersetzte den neuen Abschnitt genau dann, wenn er am wichtigsten ist.
   Jetzt eine Karte, und sie heißt „Nichts zu entscheiden".
3. **RJ war zuerst nicht nachweisbar.** Drei Mutationen machten RA oder RE
   rot, nie RJ. Erst eine NEUE `probe_status()`, die niemand in RE einträgt,
   trifft genau RJ. Alle vier Messwerte stehen in der Datei.

## Zahlenstand

| Lauf | PASS | Rückgabewert | Differenz, erklärt |
|---|---|---|---|
| 38 | 667 | 0 | Reise 14 + Reise 13 Teil E |
| 39 | 684 | **1** | +18 Reise 15, −1 (E1 in Reise 7 rot) |
| 40 | 687 | 0 | +1 E1 wieder grün, +2 neu (E3, E4) |

**Lauf 39 ist der lehrreiche.** Reise 7 E1 hing am Wortlaut „Nichts offen",
und ich habe ihn im Betriebsstatus-Block geändert, ohne vorher zu prüfen,
ob eine Reise daran hängt. Wortwörtlich die Lehre vom 20.09., die in
CLAUDE.md steht. Sie kostet zwei Sekunden:

```bash
grep -rn "<markante Wendung>" scripts/ __tests__/
```

Die Umbenennung selbst bleibt richtig: „Nichts offen" sagte „es gibt nichts
zu tun", während ein fehlender Zustell-Lauf sehr wohl etwas zu tun gab.

Jest 818, db-test 366, `tsc` 0, `deno check` 0.

## Offen

- **PR nach `main`** — jetzt **72 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, echte Ladungsanschrift (`LEGAL_PLACEHOLDER`), Gerätetest,
  DAC7-Entscheidung.
- **Neu founder-seitig sichtbar:** ob die pg_cron-Zeitpläne
  `zustellung-stuendlich` und `abnahmefrist-taeglich` überhaupt existieren.
  Im Repo legt sie niemand an; `/pruefung` sagt jetzt, ob sie da sind.

---

# Stand 2026-09-22 (spät) — ein Parameter, den niemand gelesen hat

## Der Befund

`app/anbieter.tsx` hat unter jedem Anbieterprofil den Knopf
„Unverbindliche Anfrage stellen" und übergab seit jeher
`params: { providerId: id }` an den Auftrags-Trichter.
`app/auftrag-aufgeben.tsx` hat diesen Parameter **nirgends gelesen**.

Wirkung bis heute: Wer sich ein Profil ansah, den Knopf drückte und einen
Auftrag aufgab, schrieb eine Ausschreibung an ALLE passenden Betriebe im
Postleitzahlenbereich. Der Betrieb, den der Kunde gerade ausgesucht hatte,
erfuhr davon nur zufällig.

Dieselbe Klasse wie „ein Eingang ohne Wirkung ist ein Knopf ohne onPress"
(16.09.) und wie `addressStreet?:` (16.08.).

## Die Klasse zuerst gemessen, dann gebaut

| | |
|---|---|
| Navigationen mit Parameter-Objekt | 55 |
| davon betroffen | 1 |
| Fehlalarme | 0 |

Deshalb `scripts/nav-parameter-check.py` (CI + `run.sh`). Zum Vergleich die
Klasse „unbeschriftetes Symbol" vom selben Tag: 11 Kandidaten, 9 Fehlalarme,
**kein** Prüfer. Die Messung entscheidet, nicht das Bauchgefühl.

## Was jetzt passiert

- **1020**: `jobs.requested_provider_id`, Fremdschlüssel auf
  `provider_profiles` (es muss ein Anbieter sein), `on delete set null`.
  Ein WUNSCH, keine Zuweisung. UPDATE für Angemeldete entzogen.
- **Trichter**: lädt den Betrieb mit Zeitgrenze, drei Zustände
  (lädt / unbekannt / geladen), kein Ersatzname. Gewerk wird vorbelegt.
- **`empfaengerText`**: nennt den Betrieb UND sagt, dass die Anfrage
  unverbindlich bleibt.
- **`notify-matching-providers`**: der Wunschanbieter ist von der REGION
  ausgenommen, nicht von den Rechtsgrenzen. Push und Mail benennen die
  Direktanfrage.
- **Anbieterseite**: „Direkt an Sie gerichtet", ganz oben in der Liste.

## Drei Mutationen, jede in einem eigenen Export

| Mutation | Ergebnis |
|---|---|
| Trichter liest `providerId` nicht mehr | Quelltext-Prüfer rot |
| `requestedProviderId: null` beim Anlegen | **nur S3 rot**, W1–W3 grün |
| Hinweis ohne Bedingung | nur O1 rot |
| `passungText` ohne `direkt` | E1/E3 rot, **E2/E4 grün** |
| Gegenprobe: Variable umbenannt | grün |

Die zweite und die vierte sind die interessanten: einmal sagt der Bildschirm
das Richtige und die gespeicherte Zeile nicht, einmal wirkt die Sortierung
weiter und nur das Etikett fehlt.

## Drei eigene Fehler, alle gemessen statt vermutet

1. **`filter({ hasText: /^Elektro$/ })` findet die Kategorie-Kachel nicht.**
   22 Knöpfe sichtbar, exakter Regex 0 Treffer, `getByText` exakt 1.
   Vier Zusicherungen meldeten einen Produktfehler, den es nicht gab.
2. **„Die Eingabefelder sind da" auf Schritt 1** — dort ist das
   Kategorie-Raster, und das hat keine.
3. **`auth_email_confirmed`** wird vor dem Anlegen gefragt; ohne Antwort im
   Prüfstand bricht das Absenden still ab.

## Zahlenstand

| Lauf | PASS | Rückgabewert | Differenz, erklärt |
|---|---|---|---|
| 36 | 649 | 0 | Beleg-Datei F7 bis F11 |
| 37 | 667 | **1** | Reise 14 (14) + Reise 13 Teil E (4) |
| 38 | 667 | 0 | derselbe Stand, Mail-Befund behoben |

**Lauf 37 ist der lehrreiche:** 667 PASS, 0 FAIL, und trotzdem `EXIT=1`.
`mailversand-check.py` fand zwei rohe Interpolationen im HTML der
Mitteilungsmail — an meinen eigenen Änderungen desselben Tages. Eigene
Literale ohne Nutzertext, aber der Prüfer prüft die INTERPOLATION und nicht
die Herkunft. Das ist richtig so, und es ist zugleich die beste
Mutationsprobe, die es gibt: er hat einen echten Neuzugang gefangen, ohne
dafür präpariert worden zu sein.

Jest 796, db-test 365, `tsc` 0, `deno check` 0.

## Offen

- **PR nach `main`** — jetzt **67 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, echte Ladungsanschrift (`LEGAL_PLACEHOLDER`), Gerätetest,
  DAC7-Entscheidung.

---

# Stand 2026-09-22 (spätnachmittags) — was die App als Dokument herausgibt

## Die Klasse ist abgedeckt

Fünf Bildschirme erzeugen Dokumente über `lib/teilen.ts`. Geprüft wird jetzt
nicht nur, **dass** der Knopf auslöst, sondern **was** herauskommt:

| Dokument | Stand |
|---|---|
| Termin-Weitergabe (`vertrag`) | bestand schon (Reise 12 F3) |
| Widerruf (`widerruf`) | neu: Reise 8 Teil E (E1 bis E7) |
| Beleg (`rechnung`) | neu: Reise 5 F7 bis F11 |
| Anbieterprofil (`anbieter`) | Marketing-Text, keine Rechtsfolge |
| DSGVO-Datenexport (`einstellungen`) | **bewusst nicht gebaut**, siehe unten |

**Der Beleg war der interessante Fall:** `handleShare` baut eine eigene Zeile
aus `priceGross`, `providerPayout` und `providerCommission` — unabhängig von
der Aufstellung, die der Bildschirm rendert. Mutation in der Datei →
**F3 grün (Bildschirm), F10 rot (Datei)**. Bildschirm und Dokument können
auseinanderlaufen.

**Nicht gebaut und warum:** Der Datenexport kommt aus der Edge Function
`export-my-data`, im Prüfstand also aus dem eigenen Stub. Eine Zusicherung
darauf hätte grün gemeldet, was ich selbst hineingeschrieben habe. Zuständig
bleibt `scripts/auskunft-vollstaendig-check.py` (Tabellen gegen RLS-Policies,
mit der dort benannten Grenze: Tabellen, keine Spalten).

## Founder-Punkt aus dem Widerruf

Der Empfänger im erzeugten Widerruf lautet „Werkant UG (haftungsbeschränkt)
i. Gr., **Musterstraße 1**, 50667 Köln". Das ist `LEGAL_PLACEHOLDER = true`
aus `constants/legal.ts`, also der bekannte Go-Live-Punkt, auf den
`berechtigungen-check --gate` bereits sperrt. Kein neuer Fehler — aber es
steht in einem Dokument mit Rechtsfolge (§ 355 BGB). **Ohne echte
Ladungsanschrift geht dieses Formular nicht live.**

## CLAUDE.md hat jetzt einen Kopf

Die Datei ist auf über 1800 Zeilen gewachsen, und dieselben zehn Regeln haben
mich an einem Tag viermal eingeholt. Ganz oben steht jetzt „Prüf-Regeln in
Kürze" — die Kurzfassung mit Verweis auf die datierten Abschnitte, in denen
Begründung und Messwerte stehen. Nichts wurde gelöscht.

## Zahlenstand

| Lauf | PASS | Differenz, erklärt |
|---|---|---|
| 35 | 644 | Widerrufs-Dokument E1 bis E7 |
| 36 | 649 | Beleg-Datei F7 bis F11 |

Alle `EXIT=0`, 0 FAIL. Jest 787, db-test 359, tsc 0.

## Offen

- **PR nach `main`** — **59 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, echte Ladungsanschrift (`LEGAL_PLACEHOLDER`), Gerätetest,
  DAC7-Entscheidung.

---

# Stand 2026-09-22 (nachmittags) — Geld-Bildschirme vollständig, Fristen begonnen

## Die sechs Geld-Bildschirme sind durch

| Bildschirm | Stand |
|---|---|
| `stornierung` | Beträge zugesichert (D4 bis D6) |
| `betrieb/angebot-erstellen` | Gebühr und Netto, mit und ohne Material (B1c bis B1f) |
| `zahlung` | Werklohn, Servicegebühr, Gesamtbetrag (C0a bis C0c) |
| `rechnung` | Beleg mit USt., Belegnummer (F1 bis F6) |
| `betrieb/auftraege` | **echter Befund**, siehe unten (D1 bis D3) |
| `pruefung` | geprüft und richtig, keine Änderung nötig |

**Der Befund:** Im Verdienst-Banner des Betriebs stand „Treuhand (aktiv)" aus
`customer_total` (was der **Kunde** zahlt, 328,00) direkt neben „Ausgezahlt
gesamt" aus `provider_payout` (298,80). Zwei Zahlen nebeneinander auf
verschiedenen Bezugsgrößen; der Betrieb liest die erste als seinen eigenen
Anspruch. Die Differenz ist Geld, das ihm nie zusteht. Beide stehen jetzt auf
der Größe, auf die er Anspruch hat.

## Fristen: dieselbe Lücke wie beim Geld

Im ganzen Prüfstand gab es **eine** fristbezogene Zusicherung, negativ
formuliert. `lib/bewertungsFrist.ts` ist durch Jest gedeckt, also die
Rechnung. Ob der Bildschirm die Frist **nennt** und ob sie **wirkt**, war
ungeprüft, obwohl Migration 0930 nach 14 Tagen serverseitig ablehnt.

Reise 6 Teil D prüft 7 / 13,6 / 20 Tage, je Text und Knopfzustand. In allen
drei Fällen wird vorher ein Stern getippt — sonst sperrt die fehlende
Sternwahl den Knopf und man schreibt die Sperre der Frist zu.

Nebenbefund: die fünf Sterne hatten eine Rolle, aber **keinen Namen**. Eine
Bedienungshilfe las fünfmal „Schaltfläche" ohne Text.

## Das Muster dieser sechs Blöcke

**Die Rechnung war überall gedeckt, die Anzeige nirgends.** Jest prüft
`feeEngine`, `angebotPreis`, `cancellationRefund` und `bewertungsFrist`
gründlich; kein einziger Test hat je gefragt, ob der Bildschirm diese Zahlen
auch hinschreibt. Zwei Mutationen (Gebührenbasis, USt-Satz) machten Jest
**und** die neue Reise rot — das ist der Beleg, dass beide Ebenen nötig sind
und keine die andere ersetzt.

## Zahlenstand

| Lauf | PASS | Differenz, erklärt |
|---|---|---|
| 32 | 625 | Beleg F1 bis F6 |
| 33 | 628 | Verdienst-Banner D1 bis D3 |
| 34 | 637 | Bewertungsfrist D1a bis D3c |

Alle `EXIT=0`, 0 FAIL, jeder Diff der Aufstellung nur mit der neuen Zeile.
Jest 787, db-test 359, tsc 0.

## Offen

- **PR nach `main`** — **56 Commits**.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, Gerätetest, DAC7-Entscheidung.

---

# Stand 2026-09-22 (mittags) — Geldbeträge, die niemand nachgerechnet hat

## Die Zahlen auf den Geld-Bildschirmen waren ungeprüft

Gemessen statt vermutet: Euro-Zusicherungen gab es im ganzen Prüfstand an
**zwei** Stellen. Die Bildschirme, auf denen Geld steht, sind sechs.
Abgearbeitet in drei Blöcken:

| Bildschirm | was jetzt zugesichert ist | Mutation |
|---|---|---|
| `stornierung` | 100 % / 50 % / 0 % als **Betrag**, nicht nur als Stufe | Bezugsgröße auf `price_gross` → D4, D5 rot |
| `betrieb/angebot-erstellen` | Gebühr und Nettobetrag, mit und ohne Material | Gebühr auf den vollen Preis → B1f rot |
| `zahlung` | Werklohn, Servicegebühr, Gesamtbetrag | Gesamtbetrag auf Werklohn → C0c rot |

**Keiner dieser drei Bildschirme war falsch.** Was fehlte, war der Nachweis,
dass sie richtig bleiben. Die Vorgabedaten trennen dafür 328 € (was der Kunde
zahlt) von 320 € (Werklohn) — ohne diesen Unterschied wäre eine vertauschte
Bezugsgröße nicht messbar.

## Ein Schritt, der seit jeher still übersprungen wurde

Reise 4 füllte `input[placeholder="z.B. 55,00"]` als vermeintliches
Materialfeld. Das ist der **Stundensatz**, im Festpreis-Modus gar nicht
vorhanden. Der Ausdruck traf nie etwas, das `if` darum sprang stumm darüber
hinweg, und der Materialfall ist **seit Entstehung der Reise nie gelaufen** —
obwohl AGB § 6 dort die Bemessungsgrundlage zusagt. Die zugehörige
Zusicherung war grün, weil sie `material_cost !== undefined` lautete und 0
das erfüllt.

**Einordnung:** die Rechnung selbst war durch fünf Jest-Tests gedeckt.
Ungedeckt war, ob der Bildschirm sie **anzeigt** und ob der Materialweg
überhaupt **erreichbar** ist.

## Vier eigene Prüf-Fehler an einem Tag, eine Ursache

| Beleg | warum er nichts belegte |
|---|---|
| Teilstring „Pflicht" | steckt in „meisterpflichtigen" |
| `is_nachbarschaft` | steht zweimal in derselben Datei |
| Betrag „irgendwo auf dem Bildschirm" | die Bezugsgröße stand daneben |
| Etikett „Auftragstitel" | steht zweimal auf dem Bildschirm |

**Ein Beleg muss eindeutig der sein, um den es geht — und wenn er es nicht
ist, entscheidet nicht das erste Vorkommen, sondern eine Suche über alle.**

## Zahlenstand

| Lauf | PASS | Differenz, erklärt |
|---|---|---|
| 28 | 609 | leerer Diff (Python-Regel ohne PASS-Zeilen) |
| 29 | 612 | Storno-Beträge D4 bis D6 |
| 30 | 616 | Angebots-Gebühren B1c bis B1f |
| 31 | 619 | Zahl-Aufstellung C0a bis C0c |

Alle `EXIT=0`, 0 FAIL, jeder Diff enthielt ausschließlich die neue Zeile.
Jest 787, db-test 359, tsc 0.

## Noch ungeprüft auf den Geld-Bildschirmen

`app/rechnung.tsx` (Beleg), `app/betrieb/auftraege.tsx`, `app/pruefung.tsx`.
Das ist der nächste Block.

---

# Stand 2026-09-22 — eine Zusage, sechs Fundstellen, und was Greppen nicht findet

## Der Founder-Befund war größer als die Stelle

„Warum benötigen die für Nachbarschaftshilfe geprüfte Gewerbescheine?" Am
21.09. habe ich drei Fundstellen behoben und die Sache für erledigt gehalten.
Es waren **sechs**:

| # | Stelle | gefunden durch |
|---|---|---|
| 1 | Trichter, Erfolgssatz | Founder |
| 2 | Trichter, Hinweis | Grep nach dem Satz |
| 3 | Landing-Hero | Grep |
| 4 | Landing, Vorteils-Kachel | Grep über die GANZE Datei |
| 5 | Landing, Vertrauenszeile | **gerenderten Text gelesen** |
| 6 | Garantieseite, Eingangssatz | **Messung im gerenderten Text** |

Dazu die Umkehrung in `app/anbieter.tsx` (Nachbarschaftshilfe sah aus wie ein
Mangel), die Trefferliste der Suche, die gemerkten Anbieter und der
Vertrauens-Strip der Startseite.

**Die Lehre ist die Reihenfolge:** 4 fand erst ein Grep über die ganze Datei,
5 und 6 fand überhaupt kein Grep. Sie enthalten das Wort „Gewerbeschein"
nicht. Was sie verbindet, ist die FORM: ein absoluter Quantor („jeder",
„alle") im selben Satz wie ein Vertrauens-Verb.

## Zwei neue Prüfer, beide gemessen statt geraten

- `scripts/absolute-zusage-check.cjs` misst diese Form im **gerenderten**
  Text von acht Bildschirmen. Vorher gemessen: 3 Treffer, 2 davon zutreffend.
  Zwei begründete Ausnahmen, null Fehlalarme. **A3 prüft, ob jede Ausnahme
  noch im Produkt vorkommt** — eine Liste mit verschwundenen Einträgen wäre
  ein Prüfer, der weniger prüft als sein Name sagt.
- Dieselbe Regel in `scripts/ausgelieferte-seiten-check.py`, also für die
  öffentlichen HTML-Seiten. Dort gemessen: **0 Treffer**, die Regel ist eine
  Wache, kein Fix.

## Unbeschriftete Zeichen: 11 gezählt, 9 zu Recht stumm

Ein Haken IN einem Kontrollkästchen ist Zierde, den Zustand meldet der
Behälter. **Ein Prüfer für die ganze Klasse hätte neun Fehlalarme erzeugt,
also wurde keiner gebaut** und die Zählung stattdessen festgehalten.
Zwei waren echt: das Ordensband für meisterpflichtige Gewerke (Legende
erklärte das Zeichen mit dem Zeichen) und ein grüner Haken im
Einwilligungs-Blatt, der aussah wie ein eingeschalteter Schalter.

Dazu der schwerste Fund des Tages: in der Trefferliste stand neben jedem Namen
ein goldener Haken, gebunden an `stripe_onboarded` — er bedeutete **Auszahlung
eingerichtet** und las sich als Gütesiegel.

## Die App sagt jetzt, welchen Stand sie zeigt

Fusszeile „Werkant 1.0.0 · Stand \<Commit\> · \<Datum\>", aus
`EXPO_PUBLIC_BUILD` in `static.yml`. Fehlt die Variable, steht
„Entwicklungsstand" da.

## Zahlenstand

| Lauf | PASS | Differenz, erklärt |
|---|---|---|
| 22 | 590 | Fusszeile nennt den Auslieferungsstand |
| 23 | 597 | Nachbarschaftshilfe sieht nicht aus wie ein Mangel |
| 24 | 601 | Trefferliste nennt die Sorte |
| 25 | 605 | Startseite: Meister-Abzeichen und Vertrauens-Strip |
| 26 | 606 | Einwilligungs-Blatt sagt „Pflicht" in Worten |
| 27 | 609 | Keine absolute Zusage ohne Beleg |

Alle sechs Läufe `EXIT=0`, 0 FAIL, und jeder Diff der Aufstellung enthielt
ausschließlich die jeweils neue Zeile. Jest 787, db-test 359, tsc 0.

## Eigene Fehler dieses Tages, alle gemessen

- **Metro spielt einen inlinierten `EXPO_PUBLIC_*`-Wert aus dem
  Zwischenspeicher.** Die erste Gegenprobe war falsch grün; nur `--clear`
  zeigt den echten Zustand.
- **Zweimal ein Teilstring als Beleg:** `is_nachbarschaft` steht zweimal in
  derselben Datei, „Pflicht" steckt in „meisterpflichtigen". Beide
  Zusicherungen blieben unter Mutation grün.
- **Eine Gegenprobe auf dem falschen Bildschirm.** `/` leitet mit der
  Anbieter-Rolle auf `/betrieb/dashboard` um; die Gegenprobe bestand dort
  mühelos. Jeder Browser-Prüfer sichert jetzt zuerst zu, welchen Bildschirm
  er misst.
- `versprechen-check.py` enthielt **84 Zeilen doppelt**, und die Kopie hatte
  durch falsche Einrückung ihre Schutzbedingung verloren.

## Offen

- **PR nach `main`** — **49 Commits**. Sechs Fundstellen einer irreführenden
  Zusage sind behoben und **keine einzige ausgeliefert**. Der Founder testet
  am Gerät die Live-Seite.
- Bewusst nicht gebaut: ein Gast sieht die Fusszeile mit dem Stand nicht
  (`GastLoginHinweis` ersetzt `app/einstellungen.tsx` vollständig).
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, Gerätetest, DAC7-Entscheidung.

---

# Stand 2026-09-21 (abends) — der letzte Founder-Befund, und ein Zähler, der nach außen ging

## Befund 4 ist gebaut, mit offengelegter Lesart

Die Formulierung („Aufträge im Satz nicht anklickbar") blieb mehrdeutig, die
Messung dahinter war es nicht: in `app/betrieb/auftraege.tsx` war die
Beschreibung einer Anfrage auf zwei Zeilen geklammert und die Karte reagierte
auf nichts. Den ganzen Text sah nur, wer „Angebot erstellen" öffnete — also
den Bildschirm, der ein **bindendes Angebot** abgibt.

**Die Fehlerklasse ist die Umkehrung der vom Nachmittag:** dort fehlten die
Daten zu einer verbindlichen Handlung, hier gab es die Daten, aber der einzige
Weg dorthin führte durch die Verpflichtung. Regel: bei jeder gekürzten Anzeige
fragen, wo der ganze Inhalt steht.

Gebaut als Aufklappen ab 120 Zeichen. Die Schwelle steht bewusst als
**Zeichenzahl** und nicht als gemessene Zeilenzahl: `onTextLayout` feuert auf
react-native-web nicht, ein darauf gebauter Knopf wäre im ausgelieferten Build
unsichtbar gewesen. Der Knopf meldet `aria-expanded` (nicht
`accessibilityState`, das ist in rn-web 0.21 wirkungslos).

Reise 13 Teil C misst die **Höhe**, nicht den Text: `numberOfLines` setzt ein
`-webkit-line-clamp`, `innerText` liefert den Text trotzdem vollständig — eine
Textprobe wäre in beiden Zuständen grün gewesen.
Mutationen: Klammer wieder fest → **C3 rot, C4 grün** (die Beschriftung kippt,
die Wirkung fehlt); Schwelle 120 → 0 → **C1 rot**; Gegenprobe (Umbenennung) →
alle fünf grün.

## Der öffentliche Statusendpunkt gab Geschäftszahlen aus

`/health` hat `verify_jwt = false`, ist also ohne Anmeldung erreichbar, und
nannte `pruef_offen`, `reklamationen_offen`, `meldungen_offen` als **Zahlen** —
ein Ticker für das Wachstum der Angebotsseite. Zwei der drei hatte ich selbst
hinzugefügt, direkt unter meinen eigenen Kommentar „nur Booleans nach außen,
keine Zahlen". Jetzt Booleans; `wartet-jemand.yml` liest Flaggen.
`scripts/health-keine-zahlen-check.py` misst das Symptom (ein Zähler wird mit
`= 0` angelegt, eine Flagge mit `= false`); zwei Mutationen rot, zwei
Gegenproben grün.

Die Edge-Function-Prüfung darüber (alle 16) hat **keinen** Befund bei
Ratenbegrenzung, Eingabeprüfung und Anmeldung ergeben — nachdem ich meinen
eigenen Messfehler korrigiert hatte: der erste Lauf las nur `index.ts`, und
mehrere Funktionen delegieren an `handler.ts`. Genau die Falle, die in
CLAUDE.md steht.

## Die App sagt jetzt, welchen Stand sie zeigt

Die Fusszeile trug „Werkant v1.0.0" als Literal, eine Zahl ohne Aussage.
Jetzt `lib/standZeile.ts` + `EXPO_PUBLIC_BUILD` (Commit-Kürzel und Datum aus
`static.yml`). Fehlt die Variable, steht „Entwicklungsstand" da.
Die Kette ist end-to-end **gemessen**: Workflow-Variable → Expo-Inlining (ein
Treffer im ausgelieferten Bundle) → gerenderte Fusszeile.

**Zwei eigene Messfehler dabei**, beide in CLAUDE.md: Metro spielt einen
inlinierten `EXPO_PUBLIC_*`-Wert aus dem Zwischenspeicher (erste Gegenprobe
war falsch grün, nur `--clear` zeigt den echten Zustand), und die erste
Fassung des Quelltext-Prüfers wurde beim blossen Umbrechen des Aufrufs rot.

## Dieselbe Zusage, zwei Bildschirmhöhen weiter

Der Gewerbeschein-Satz stand in `app/landing.tsx` ein zweites Mal, in der
Vorteils-Kachel über dem Hero, den ich nachmittags korrigiert hatte.
Und die Umkehrung in `app/anbieter.tsx`: Nachbarschaftshilfe bekam ein
durchgestrichenes „Gewerbeschein" und „Steuer-ID" zu sehen, obwohl dieser Weg
beides nie abfragt. Nicht zu viel versprochen, sondern zu wenig zugestanden.

**Nebenbefund in der eigenen Arbeit:** `versprechen-check.py` enthielt 84
Zeilen doppelt, und die zweite Kopie hatte durch falsche Einrückung ihre
Schutzbedingung verloren. Gemessen: eine eingebaute Verletzung wurde vorher
zweimal gemeldet, nachher einmal.

## Zahlenstand

| Lauf | PASS | Differenz, erklärt |
|---|---|---|
| 20 | 582 | Ausgangspunkt |
| 21 | 587 | +5 Reise 13 Teil C (Beschreibung aufklappen) |
| 22 | 590 | +3 Fusszeile nennt den Auslieferungsstand |
| 23 | 597 | +7 Nachbarschaftshilfe sieht nicht aus wie ein Mangel |

Alle vier Läufe `EXIT=0`, 0 FAIL, und jeder Diff der Aufstellung enthielt
ausschließlich die jeweils neue Zeile. Jest 771, db-test 359, tsc 0.

`run.sh` druckt seinen Rückgabewert jetzt selbst (`EXIT=`); bei Lauf 21 fehlte
er, weil ich ihn am Aufrufort vergessen hatte, und übrig blieb die PASS-Zahl
als Ersatz. Genau das verbietet die Lehre vom 16.09.

## Offen

- **PR nach `main`** — **44 Commits**. Die wichtigste offene Entscheidung: der
  Founder testet am Gerät die Live-Seite, also `main`. Solange die Commits
  hier liegen, zeigt sein Gerät die alte Fassung, Fusszeile eingeschlossen.
- Bewusst nicht gebaut: ein Gast sieht die Fusszeile nicht
  (`GastLoginHinweis` ersetzt `app/einstellungen.tsx` vollständig) und kann
  den Stand nirgends ablesen.
- Founder-seitig unverändert: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`,
  Stripe Connect, Gerätetest, DAC7-Entscheidung.

---

# Stand 2026-09-21 (nachmittags) — vier Founder-Befunde, und eine Fehlerklasse mit sechs Fundstellen

Volle Fassung in `notes/04-Entscheidungen/2026-09-21-vier-founder-befunde.md`
(mit fünf Nachträgen).

## Die Founder-Befunde vom Gerät

**Der wichtigste war kein Fehler im Code:** die Bildschirmfotos kommen von der
Live-Seite, und die wird von `main` ausgeliefert. Auf dem Branch liegen
inzwischen **36 nicht gemergte Commits**. Der Founder testet am Gerät einen
Stand von vor mehreren Tagen. **Offene Entscheidung: PR nach `main`?**

1. *Zweimal nach der Dringlichkeit gefragt* — im Branch längst behoben, nicht live.
2. *„Schritt 2 von 4" beim ersten Bildschirm* — behoben. Zählt jetzt ab dem
   Einstieg: „1 von 3" über eine Kachel, „1 von 4" ohne Kategorie.
   `scripts/schrittzaehler-check.cjs`.
3. *Gewerbeschein für Nachbarschaftshilfe* — behoben. Dort legt niemand einen
   vor; der Satz stand dreimal als Literal. `lib/empfaengerText.ts`, § 5 UWG.
4. *„Aufträge nicht anklickbar"* — **Rückfrage offen.** Kundenseite ist in
   Ordnung. Auf der Betriebsseite sind die Anfragen-Karten keine Schaltflächen
   und die Beschreibung ist auf zwei Zeilen gekürzt; die volle Beschreibung
   steht aber in `angebot-erstellen`. Nicht gebaut, bis die Stelle feststeht.

## Die Fehlerklasse: eine verbindliche Handlung ohne die Daten, die sie beschreibt

Sechs Bildschirme, alle nach demselben Muster behoben (laden mit Zeitgrenze,
drei Zustände, kein Ersatztitel, Knopf gesperrt mit Begründung):

| Bildschirm | Was passierte |
|---|---|
| `stornierung` | `jobTitle ?? 'Heizungswartung'`, Vertrag gar nicht geladen |
| `betrieb/angebot-erstellen` | `job?.title ?? 'Handwerksleistung'`, bindendes Angebot **mit Preis** ohne gesehenen Auftrag |
| `bewertung` | Frist nie geprüft, Bewertung **unveränderlich** (0930) |
| `auftrag-abschliessen` | Freigabe ohne geladenen Vertrag (früherer Block) |
| `reklamation` | friert Treuhandbetrag ein (früherer Block) |
| `zahlung` | bereits korrekt |

`scripts/versprechen-check.py` prüft die Klasse, nicht die Stelle: die sechs
Bildschirme plus eine **Positivliste** neutraler Ersatzwörter. Drei weitere
Kandidaten (`widerruf`, `konto-loeschen`, `melden`) sind geprüft und mit
Begründung **im Skript** ausgenommen, damit das niemand zweimal durchgeht.

## Zahlenstand

- Reisen: **572 PASS, 0 FAIL, EXIT=0** (drei Läufe hintereinander, die letzten
  beiden mit leerem Diff der Aufstellung).
- Jest 761, db-test 359, tsc 0.
- Die Aufstellung `PASS je Prüfung` hat sich dreimal bezahlt gemacht: 558 → 563
  (+5 Schrittzähler) → 572 (+9 „erfindet keinen Auftrag") → 572 (leerer Diff).

## Offen

- **PR nach `main`** (Founder-Entscheidung, 36 Commits).
- **Rückfrage zu Befund 4** (welche Liste).
- `app/vertrag.tsx` zeigt `?? 'Dienstleistung'`: in einem Vertrag steht damit
  kein Leistungsgegenstand. Eigener, vertragsrechtlicher Block.
- `lib/strikes.ts` gibt bei Fehler eine leere Liste.
- Unverändert beim Founder: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`, Stripe
  Connect, Gerätetest, DAC7-Entscheidung.

---

# Stand 2026-09-21 (mittags) — drei Blöcke: der Geräterand, eine Steuerfrist, und Prüfer, die nie etwas angetippt haben

Blöcke 18 bis 20. Volle Fassungen in
`notes/04-Entscheidungen/2026-09-21-unterer-bildschirmrand.md`,
`…-dac7-meldung-sichtbar.md` und `…-blaetter-und-fehlerzustaende.md`.

## 18. Dreizehn feste Zahlen am unteren Bildschirmrand (`aaf293a`)

Sieben festgeklebte Aktionsleisten und sechs Blätter von unten hatten einen
festen unteren Abstand: 28 px, einmal 32, bei den Blättern 36 bis 40, beim
Filter-Schieber gar keinen. Auf einem iPhone ab X sind unten 34 px für die
Home-Anzeige reserviert; ein Knopf mit 28 px darunter endet INNERHALB des
Streifens, in dem das System die Wischgeste abfängt. Betroffen war jeweils der
wichtigste Knopf des Bildschirms.

`lib/sichererRand.ts` → `aktionsleistenRand(insets.bottom)` = 16 + unterer
Rand. Belegt sind die Rechnung (Jest, 4 Mutationen rot) und die Verdrahtung
(`scripts/sichere-aktionsleiste-check.py`, 3 Mutationen rot, 2 Gegenproben
grün). **NICHT belegt ist die Wirkung am Gerät** — react-native-web meldet den
unteren Rand überall als 0. Dafür braucht es ein iPhone.

## 19. Die DAC7-Jahresmeldung ruft niemand auf (`ab2b08a`)

`pstg-annual-report` ist die einzige Edge Function, die kein Zeitplan, kein
Workflow und keine Stelle in der Oberfläche aufruft. Ihr eigener Kommentar
behauptet einen Cron-Lauf am 1. Januar; den gibt es nicht. Daran hängt § 13
Abs. 1 PStTG (Meldung bis 31. Januar) und § 25 PStTG (Bußgeld bis 50.000 €).

Migration 1010 macht den Stand sichtbar, `health` weist ihn aus,
`wartet-jemand.yml` schlägt Alarm. **Zwei getrennte Kennzeichen**, weil es zwei
Zustände sind: „nichts vorbereitet" und „vorbereitet, aber nie ans BZSt
gegangen". Ein einziges wäre grün, sobald der Lauf einmal stattgefunden hat.

Ausdrücklich NICHT gebaut: ein automatischer Aufruf. Die Funktion
benachrichtigt die betroffenen Anbieter, also eine Handlung nach außen.
**Founder-Entscheidung, jetzt Punkt 6 in
`docs/founder/MEINE-AUFGABEN-PLATZHALTER.md`.**

db-test 353 → 359, fünf Mutationen rot, Gegenprobe grün.

## 20. Die Prüfer hatten nie ein Blatt geöffnet (`f5d1f83`)

`beruehrflaeche-check` und `kontrast-check` laden einen Bildschirm und messen,
was zu sehen ist. Angetippt haben sie nie etwas. Unsichtbar blieben sechs
Blätter von unten samt Filter-Schieber (darunter das Einwilligungs-Blatt, der
erste Bildschirm überhaupt) und sämtliche Fehler- und Leerzustände.

Nachdem sie hinsehen konnten: **38 Berührflächen unter 44x44.** Die drei Zeilen
im Einwilligungs-Blatt 324x23, sein Schalter 38x22, 22 Chips im Filter-Schieber
33 hoch, „Chat"/„Stornieren"/„Fertig" auf jeder Auftragskarte 35 hoch. Alle
behoben, danach 315 gemessen und 0 darunter.

**Der eigentliche Fund kam nebenbei:** der Fehlerzustand von
`/betrieb/nachrichten` konnte gar nicht eintreten. `getConversationList` und
`getProviderConversationList` hatten beide `if (error || !data?.length)
return []` — ein Netzfehler kam als LEERE LISTE beim Bildschirm an, und der
sagte „Noch keine Nachrichten". In beiden `catch`-Zweigen stand der Kommentar
„Netzfehler nicht als ‚Keine Nachrichten' tarnen"; genau das tat der Code
darunter.

## 21. Ein Fehler, der aussieht wie „da ist nichts" (`fe67bd9`)

`lib/messages.ts` gab bei einem Netzfehler eine leere Liste zurück; die
Posteingänge sagten dann „Keine Nachrichten". Dazu: `auftrag-abschliessen` und
`reklamation` ließen ihre unumkehrbare Aktion auch ohne geladenen Vertrag zu.

## 22. `accessibilityState` ist im Web ein No-Op, an 14 Stellen

Der neu gebaute `scripts/schalter-rolle-check.cjs` hat beim ERSTEN Lauf meinen
eigenen Fix zerlegt: `accessibilityRole="switch"` kam im DOM an, `aria-checked`
war `null`. **react-native-web 0.21 liest `accessibilityState` überhaupt
nicht.** Betroffen waren nicht die zwei Schalter, sondern 14 Stellen:
Auswahl-Kacheln bei der Registrierung, Gewerke im Betriebsprofil, Kalendertage,
Meldegründe, Haken in `melden.tsx`. Auf dem ausgelieferten Web-Build hat keine
davon je einen Zustand gemeldet.

Alle auf `aria-checked` / `aria-selected` / `aria-disabled` umgestellt (seit
React Native 0.71 auch nativ, hier 0.85). Neu in
`scripts/web-untaugliche-api-check.py`, bei `Alert.alert` und `Share.share`.

Ein Quelltext-Prüfer hätte die Zeile gesehen und wäre zufrieden gewesen. Nur
der Browser-Prüfer, der den Schalter DRÜCKT, konnte das finden.

## Zahlenstand

- Reisen-Gesamtlauf über `64f800b`: **EXIT=0, 558 PASS, 0 FAIL.**
- Der Lauf davor (`f5d1f83`) stand bei 544. Die +14 sind vollständig benannt:
  9 für „Jeder selbst gebaute Schalter meldet Rolle und Zustand", 5 für
  „Ein Netzfehler sieht nicht aus wie ein leerer Posteingang". Sonst nichts.
- Gegen die zuletzt belegten 529 vom 20.09. waren es +15, davon 13 benannt
  (+9 Reise 7, +2 Reise 4, +1 Berührflächen, +1 Kontrast) und **2 unerklärt**,
  weil vom 529er Lauf kein Protokoll mehr existierte. Genau deshalb druckt
  `run.sh` jetzt `PASS je Prüfung` — der nächste Vergleich ist mechanisch.
- Jest 754, db-test 359, tsc 0.

### Referenz-Aufstellung (21.09.2026, `64f800b`)

Beim nächsten Lauf gegen diese Zahlen diffen. Eine Prüfung mit 0 erzeugt
keine PASS-Zeilen (die Quelltext-Prüfer melden nur eine Zusammenfassung) —
das ist kein Befund, sondern ihr Format.

```
  8  Gast findet ueberall zum Login        276  Alle uebrigen Bildschirme
  7  Rollen und Routen                      19  Kern-Reise 1 (Kunde)
  1  Jede Beruehrflaeche ist 44x44          11  Kern-Reise 2 (Anbieter)
  1  Jeder Text erreicht seinen Kontrast    23  Kern-Reise 4 (Geldweg)
  9  Selbst gebaute Schalter                14  Kern-Reise 5 (Vertrag)
  5  Netzfehler ist kein leerer Eingang     16  Kern-Reise 6 (Abnahme)
  3  Fussleisten verdecken nichts           20  Kern-Reise 7 (Pruef-Postfach)
 25  Beschriftungen brechen nicht           15  Kern-Reise 8 (DSA/Widerruf)
 54  Geld-Bildschirme kalt geoeffnet        13  Kern-Reise 9 (Kalender)
                                             6  Kern-Reise 10 (Betrieb)
                                             6  Kern-Reise 11 (Kunde)
                                            20  Kern-Reise 12 (Start-PIN)
                                             6  Kern-Reise 13 (Anfragen)
                                           558  GESAMT
```

## Offen

- **Der Reisen-Gesamtlauf über den Stand danach ist noch draußen.** Rückgabewert
  wird nachgereicht, nicht die PASS-Zahl.
- Selbst gebaute Schalter melden sich einer Bedienungshilfe als „Knopf" und
  nennen ihren Zustand nicht (zwei Stellen). In Arbeit.
- Unverändert beim Founder: `WERKANT_ADMIN_EMAILS`, `RESEND_API_KEY`, Stripe
  Connect, Gerätetest, und neu die DAC7-Entscheidung.

### Gefunden, bewusst NICHT in diesem Block erledigt

- **`app/stornierung.tsx` lädt den Vertrag gar nicht.** Der Bildschirm nimmt
  nur die `contractId` aus den Parametern und schickt sie an
  `cancel-contract`. Wer storniert, sieht vorher WEDER was er storniert
  (Titel, Betrieb) NOCH welche Erstattung herauskommt — die Zahl erscheint
  erst NACH dem unumkehrbaren Schritt. Das ist keine Fehlerbehebung, sondern
  ein Stück Funktion, und es zeigt Geld an. Eigener Block.
- **`app/reklamation.tsx` und `app/bewertung.tsx`** lassen ihre Aktion auch
  ohne geladenen Vertrag zu. Bei der Reklamation friert das den Treuhandbetrag
  ein. Gleiche Bauart wie der Fehler, den `app/auftrag-abschliessen.tsx` in
  diesem Block losgeworden ist.
- **`lib/strikes.ts` gibt bei einem Fehler eine leere Liste zurück.** Ein
  Betrieb mit zwei Verstößen sieht dann ein sauberes Dashboard. Weniger
  schlimm als beim Posteingang (die Sperre selbst wirkt serverseitig), aber
  dieselbe Klasse.

---

# Stand 2026-09-21 (morgens) — zwei Postfächer, ausdrücklich nur lesend

Siebzehnter Block, und die Umsetzung der Empfehlung aus dem Block davor.
Volle Fassung in
`notes/04-Entscheidungen/2026-09-21-zwei-postfaecher-nur-lesend.md`.

`/pruefung` zeigt jetzt unter der Verifizierungsliste zwei Abschnitte:
Reklamationen (Kategorie, Fallnummer, Wartezeit, **eingefrorener Betrag**,
Auszug, Marke „Heute fällig" / „Überfällig" gegen die zugesagten zwei
Werktage) und Inhalts-Meldungen (Art, Melder, Fundstelle, Auszug, Marke gegen
24 Stunden).

**Kein Entscheidungsknopf**, und das ist als Zusicherung nachgehalten (D5).
Entschieden wird vorerst im Dashboard, und der Bildschirm sagt das.

## Die Zusicherung, auf die es ankommt

**D0: „Nichts offen" darf nicht dastehen, solange etwas anderes wartet.** Der
Leerzustand hing vorher allein an der Verifizierungsliste; mit leerer Liste
und einer offenen Reklamation hätte der Bildschirm „Nichts offen" gemeldet,
während 640 € festliegen.

## Zwei eigene Fehler, beide vom selben Typ

**Ein Rekorder, der „alles außer X" sammelt, fängt jede spätere Erweiterung
mit.** Teil C der Reise zeichnete alle Aufrufe außer `liste` auf und nahm
meinen neuen Lese-Aufruf `wartendes` mit; C3/C5 sahen auf den falschen
Eintrag. Er hört jetzt auf eine Positivliste.

**Und meine eigene Zusicherung war grün aus dem falschen Grund.** D3 prüfte
„die Reklamation ist überfällig" gegen den ganzen Bildschirm — das Wort kam
von der DSA-Meldung darunter. Erst nach dem Herausschneiden des Abschnitts
zeigte sich, dass die Reklamation mit 96 Stunden je nach Wochentag nur „Heute
fällig" war. Jetzt 14 Tage und ein Abschnitts-Schnitt.

**Regel daraus:** eine Zusicherung über EIN Element nie gegen den ganzen
Bildschirm prüfen, wenn ein zweites Element denselben Text erzeugen kann.

## Stand der Prüfungen

Jest 750 Tests (14 neu), db-test 353, tsc 0, `deno check` grün.
Mutationsproben: `wartendes.test.ts` 7/7, Bildschirm 2 rot / 1 Gegenprobe grün.

# Stand 2026-09-21 (nachts, II) — drei Warteschlangen, die niemand liest

Sechzehnter Block. Vierte Anwendung derselben Methode, diesmal nicht auf
Texte, sondern auf **Tabellen**: welche Zeilen warten auf eine Entscheidung,
und wer sieht sie? Volle Fassung in
`notes/04-Entscheidungen/2026-09-21-warteschlangen-die-niemand-liest.md`.

## Der Befund

`disputes`, `inhalts_meldungen` und `chat_reports` werden geschrieben und von
**niemandem** gelesen. Nur `provider_profiles` hat seit dem 14.09. ein
Postfach.

Und bei den Reklamationen hängt Geld daran: **0770 bricht die automatische
Auszahlung mit `dispute_open` ab** (Zeile 263) und lässt solche Verträge auch
aus dem Abnahme-Lauf heraus (Zeile 155). Eine offene Reklamation friert den
Treuhandbetrag ein. Gleichzeitig sagt `reklamation.tsx` dem Kunden eine
Prüfung „innerhalb von 2 Werktagen" zu.

Die Kette: Kunde meldet einen Mangel, Geld friert ein, Bildschirm sagt eine
Frist zu, **niemand erfährt von der Meldung**, das Geld bleibt für beide
Seiten liegen. Unbefristet.

Bei `inhalts_meldungen` ist es Art. 16 DSA.

## Was jetzt dasteht

`/health` zählt beide Warteschlangen samt Stau-Flagge, und
`wartet-jemand.yml` meldet alle drei getrennt. Bei den Reklamationen steht die
Folge im Alarmtext: solange sie offen ist, ist der Treuhandbetrag eingefroren.

`chat_reports` bleibt bewusst draußen: die Tabelle hat keinen
Erledigt-Zustand, ein Zähler, der nur wachsen kann, wird weggeklickt — und
dann ist der ganze Alarm tot.

## Was NICHT gelöst ist, ausdrücklich

**Es gibt keinen Bildschirm, auf dem man eine Reklamation entscheidet.** Der
Betreiber sieht jetzt, DASS etwas wartet; handeln muss er über das
Supabase-Dashboard.

Das ist Absicht: eine Entscheidung über eine Reklamation bewegt Geld. Ein
Betreiber-Bildschirm dafür ist ein Produktentwurf mit Geldfolgen, und den baue
ich nicht nachts allein — dieselbe Linie wie am 16.09. bei
`WERKANT_ADMIN_EMAILS`.

**Empfehlung für den nächsten Block:** `/pruefung` um zwei Postfächer
erweitern, zunächst NUR lesend. Sichtbarkeit ist die Hälfte des Problems und
hat keine Geldfolgen. Die Entscheidungswege danach, mit dem Founder.

# Stand 2026-09-21 (nachts) — eine Obergrenze, die es nur im Text gab

Fünfzehnter Block. Dritte Anwendung derselben Methode: eine Zusagen-Klasse
vollständig auszählen. Nach den Prüf-Behauptungen (62 Stellen) und den
Zeitzusagen (76) nun die Beträge: 180 Stellen, 34 verschiedene Werte. Volle
Fassung in
`notes/04-Entscheidungen/2026-09-21-transaktionsgrenze-ohne-mechanismus.md`.

## Der Befund

`app/garantie.tsx` nannte ein Beta-Limit von 5.000 € je Auftrag **als
Tatsache**. Gemessen gab es keine Grenze: nicht im Client, nicht in einer Edge
Function, nicht in der Datenbank (dort allein `check (price > 0)` aus 0040).
Ein Angebot über 40.000 € wäre durchgegangen, und der Treuhandbetrag hätte in
derselben Höhe auf dem Konto gelegen.

Dieselbe Klasse wie Haftpflicht und Meisterpflicht. Neu ist die Folge: **ein
unbegrenzter Treuhandbetrag verschärft die offene ZAG-Frage.**

Behoben in **Migration 1000** (`check (price <= 5000)`, bewusst `not valid`),
`lib/transaktionsgrenze.ts`, dem Angebotsformular (sagt es vorher, sperrt den
Knopf) und der Garantie-Seite. Die 25.000 € zum Launch sind raus: eine Zahl
für einen Zustand, den es noch nicht gibt.

## Der Weg vorbei war nicht das hohe Angebot

Sondern die **Änderung**: niedrig einstellen, annehmen lassen, dann hochsetzen.
`not valid` verhindert das trotzdem, weil die Bedingung für jede geänderte
Zeile gilt (Test TG4). Ohne diese Zusicherung wäre die Grenze eine Attrappe.

## Prozess-Lehre, und sie ging gegen mich

Beim Geldfristen-Block habe ich committet und **danach** auf den Reisen-Lauf
gewartet. Der war rot: ich hatte „Dies kann nicht rückgängig gemacht werden"
zu „lässt sich nicht zurücknehmen" umformuliert, und Reise 6 (A2) hängt an
diesem Wortlaut. **Ändern musste ich nur die Zeitangabe** — die Umformulierung
daneben war Beiwerk, das ich mitgenommen habe, weil ich den Satz ohnehin
anfasste.

Steht jetzt als Regel in CLAUDE.md: vor dem Umformulieren eines sichtbaren
Satzes `grep -rn "<markante Wendung>" scripts/ __tests__/`, und nicht
committen, bevor der bestätigende Lauf durch ist.

# Stand 2026-09-20 (spät, II) — vier Antworten auf dieselbe Geldfrage

Vierzehnter Block. Dieselbe Methode wie bei den Prüf-Behauptungen, auf die
nächste Zusagen-Klasse angewandt: **jede Zeitzusage im sichtbaren Text**.
76 Stellen, die meisten in Ordnung. Drei nicht.

## Der Befund

Zur Frage „wann ist das Geld da?" standen **vier verschiedene Antworten** im
Produkt, zwei davon auf DEMSELBEN Bildschirm:

| Stelle | Aussage |
|---|---|
| `auftrag-abschliessen.tsx` | „wird der Betrag **sofort** ausgezahlt" |
| `auftrag-abschliessen.tsx` | „in der Regel innerhalb von **1-3 Werktagen**" |
| `betrieb/onboarding-stripe.tsx` | „**2 Werktage** nach Auftragsabschluss" |
| `agb.tsx` §6(3) | „innerhalb von **2 Werktagen** nach Freigabe" |

Dazu zwei weitere Widersprüche: `garantie.tsx` sagte „**Sofort** nach
Schließen der Reklamation", `stornierung.tsx` „innerhalb von **3-5
Werktagen**". Und der Erfolgsbildschirm des Onboardings trug den Titel
„Profil wird geprüft" über dem Satz „Sie können **sofort** Aufträge annehmen"
— was seit 0990 (von mir, am selben Abend) endgültig falsch war.

## Die Lehre, und sie ging gegen mich

Beim Beheben habe ich im ersten Entwurf „1 bis 3 Werktage" gewählt, weil das
der Erfahrungswert von Stripe ist. **Damit hätte die Oberfläche dem Anbieter
eine längere Frist genannt, als die AGB ihm zusichern.** Gefangen hat das erst
der Blick in §6(3) — nicht ein Test, nicht ein Prüfer, sondern die Gewohnheit,
den Paragraphen neben den Code zu legen.

Maßgeblich ist die Zusage, nicht der Erfahrungswert. `lib/geldFristen.ts`
trägt jetzt beides getrennt: die Auszahlung als **eine Zahl** (Zusage aus den
AGB), die Erstattung als **Spanne mit „in der Regel"** (dafür gibt es keine
Zusage).

Nachgehalten in `scripts/geldfristen-check.py` (CI + Läufer), 6/6
mutationsgeprüft — darunter die Mutation „AGB-Frist geändert, Modul nicht".

## Stand der Prüfungen

Jest 44 Suiten / 731 Tests, tsc 0.

# Stand 2026-09-20 (spät) — Apple HIG, gemessen statt gelesen

Dreizehnter Block. Founder: „/apple-hig" und „du bist aber am chillen?".
Beides berechtigt: ich hatte auf einen Hintergrundlauf gewartet statt
weiterzuarbeiten. Volle Fassung in
`notes/04-Entscheidungen/2026-09-20-apple-hig-gemessen.md`.

Der Skill im Repo ist nur ein Katalogeintrag ohne Inhalt. Die Richtlinien sind
also anzuwenden, und in diesem Projekt heisst das: messbar machen.

## Zwei neue Prüfer, zwei echte Befunde

**`scripts/beruehrflaeche-check.cjs`** (Apple HIG 44x44 pt, WCAG 2.5.5):
**44 von 164 Berührflächen lagen darunter**, also 27 %. Der Zurück-Pfeil mit
36x36 in 24 Bildschirmen (sechs weitere hatten ihn schon richtig, von Hand
korrigiert und nicht überall), die ganze Gewerk-Leiste auf `/suche` mit 31 px,
„Speichern" im Betriebsprofil mit 34, das Augen-Symbol im Passwortfeld mit
36x24. Behoben in 30 Dateien, danach 164 von 164.

**`scripts/kontrast-check.cjs`** (HIG / WCAG 1.4.3): 442 echte Textstellen,
jede gegen ihren tatsächlichen Hintergrund. Fünf Farbpaare unter der Grenze.
Behoben durch Abdunkeln um 4 bis 9 Prozent, ausgerechnet statt geraten.

## Drei Lehren

**Ein Kommentar kann wahr sein und trotzdem zu wenig sagen.** In
`colors.ts` stand „WCAG AA 4.5:1+ on bg/surface". Nachgerechnet stimmt das --
für genau diese zwei Gründe. Auf den getönten Flächen fiel dasselbe Grau
darunter. Nicht jede unvollständige Zusage ist eine Lüge, und prüfen muss man
sie trotzdem.

**Vier Hundertstel.** Der Preis auf `/betrieb/auftraege` lag bei 4,46 statt
4,5. Das findet kein Blick und keine Stichprobe, nur eine Messung.

**`hitSlop` ist im Web unsichtbar, und wo es die einzige Absicherung war, war
es ohnehin zu klein.** 36+16 = 52 breit, aber 24+16 = 40 hoch. Deshalb misst
der Prüfer die sichtbare Größe: strenger als HIG verlangt, dafür nachprüfbar.
Die eine Ausnahme ist der System-Schalter von React Native (auf dem Gerät
51x31 pt von Apple selbst) -- ihn zu melden wäre ein Fehlalarm über das echte
Produkt.

## Offen, und zwar als GERÄTE-Punkt

Dreizehn Bildschirme haben eine feste Fussleiste mit `paddingBottom: 28` statt
des echten unteren Sicherheitsrands (iPhone: 34 pt). Eine geratene Zahl, aber
**kein belegter Fehler** -- 28 reichen, um über dem Home-Indikator zu bleiben.
Ohne Gerät nicht messbar, deshalb bewusst nicht auf Verdacht geändert.

Ebenfalls offen, Gestaltungsfrage für den Founder: `amber` und `gold` liegen
nach dem Abdunkeln sehr nah beieinander. Zwei Marken für dieselbe Farbe sind
eine zu viel.

# Stand 2026-09-20 (nachts) — der Nachbarschaftszweig wurde nie geprüft

Zwölfter Block. Entstanden aus der Frage, warum `versprechen-check.py` den
Meisterpflicht-Fund vom Nachmittag nicht gefangen hat. Der Prüfer benennt seine
Grenze selbst: eine NEUE unwahre Behauptung fällt nicht auf. Also die Klasse
einmal von Hand abgefahren, alle 62 Stellen im sichtbaren Text, an denen
Werkant eine Prüfung behauptet. Volle Fassung in
`notes/04-Entscheidungen/2026-09-20-nachbarschaft-nie-geprueft.md`.

## Zwei Befunde, beide im selben Zweig

**Die Selbstauskunft wurde weggeworfen.** `onboarding-kyc.tsx` fragt den
Nachbarschaftshelfer nach dem Geburtsdatum, prüft im Browser und schickt es
beim Absenden NICHT mit. `nbDob` lebte in `useState`. Darunter stand
„Altersnachweis bestätigt", und `nachbarschaft-profil.tsx` sagte dem Kunden
**„18+ verifiziert"**. Dieselbe Klasse wie die Widerrufs-Zustimmung am 16.08.,
nur geht es hier darum, wer in eine fremde Wohnung gelassen wird.

**Es gab keine Prüfung, in die er hätte kommen können.** `submitForReview()`
verlangt einen Gewerbeschein, und der Nachbarschaftszweig ruft die Funktion gar
nicht auf. Ein Helfer blieb dauerhaft auf `kyc_status='pending'`, das
Pruef-Postfach sah ihn nie, eine Entscheidung bekam er nie. Und
`bewerbung-eingegangen.tsx` sagt ihm wörtlich zu, geprüft würden „ihre
Profilangaben + 18+-Selbstauskunft".

Behoben in **0990** (Nachweis-Tabelle ohne Geburtsdatum, Übergang in die
Prüfung ergänzt statt gelockert), dazu `lib/volljaehrigkeit.ts`, der
Nachbarschaftszweig in `vorpruefen()` und ehrliche Texte.

## Was das NICHT löst, und das gehört gesagt

`/nachbarschaft` zeigt weiterhin **niemanden**. Die Abfrage verlangt zusätzlich
`stripe_onboarded = true`, und das schreibt nur der Stripe-Webhook beim
Connect-Onboarding, das nicht gebaut ist. Zweiter, unabhängiger Grund, bleibt
beim Founder.

Der Helfer kann trotzdem Aufträge bekommen und bieten: die Angebots-Policy
verlangt keine Freigabe. **Sichtbar nicht, bieten ja.** Das ist die offene
Founder-Frage aus dem 18.09. und wird durch diesen Block nicht entschieden.

## Die Lehre: zweimal in dieselbe dokumentierte Falle

Zwei Mutationen blieben grün, beide Male wegen meines Tests:
- **VJ7 lief gegen einen belegten Datensatz** — abgewiesen hat der
  Unique-Index, nicht die Policy. Die Regel steht seit 16.08. wörtlich in
  CLAUDE.md, und ich bin trotzdem hineingelaufen.
- **VJ11 scheiterte an der falschen Bedingung** — `fassung: 'v1'` verletzte die
  Längenprüfung an `fassung` statt der an `angezeigter_text`.

Dazu VJ12: eine Bedingung, die durch keine Mutation rot zu bekommen war, weil
der Guard sie ein zweites Mal prüft. Entweder ein Test für den Fall, den nur
sie abfängt, oder die Bedingung gehört weg.

**Eine Regel, an die man sich erinnern muss, ist keine Prüfung.** Beim nächsten
Negativtest gegen eine Policy zuerst fragen: gibt es die Zeile schon, und
welche Bedingung weist hier eigentlich ab?

## Stand der Prüfungen

- `bash scripts/db-test/run.sh`: 348 Assertions.
- Jest 43 Suiten / 727 Tests, tsc 0, `deno check` grün.
- Mutationsproben: 0990 12/12 nach drei Testkorrekturen.

# Stand 2026-09-20 (abends) — die Meisterpflicht wurde behauptet, nicht durchgesetzt

Elfter Block. Kein Founder-Befund, sondern der Weg des EINEN wartenden Betriebs
bis zum ersten Angebot, abgegangen. Volle Fassung mit allen Messwerten in
`notes/04-Entscheidungen/2026-09-20-meisterpflicht-wurde-nur-behauptet.md`.

## Der Befund

Der Auftrags-Trichter sagt dem Kunden wörtlich: „Ihr Auftrag wird
**ausschließlich** an Betriebe mit gültigem Meisterbrief weitergeleitet."

Gemessen:
- `meister_verified` kam als **Bedingung** in keiner Policy, keinem Check und
  keinem Trigger vor. Jedes Vorkommen war ein Schreibschutz oder ein Abzeichen.
- **Kein Code-Pfad setzte es je auf `true`.** `pruefung` schreibt bei der
  Freigabe `kyc_status` und `kyc_verified`, das Meisterfeld nicht.
- Die Angebots-Policy und `notify-matching-providers` prüften es nicht.

Die Prüfung gab es also genau einmal, beim Onboarding, gegen `trade_id`.
Maßgeblich fürs Zuleiten und fürs Bieten ist `category_ids`, und die ließ sich
danach in „Mein Profil" frei ändern. Als Bodenleger freigeben lassen, danach
Elektro eintragen, Elektro-Aufträge bekommen, darauf bieten.

Behoben in **0980** (Liste in der Datenbank, Vermerk bei der Freigabe, Sperre
gegen das Nachtragen, Bedingung in der Angebots-Policy, Bestandsübernahme),
dazu der Filter in `notify-matching-providers` und die sichtbare Sperre in
„Mein Profil".

## Drei Lehren, die über diesen Fall hinausgehen

**Ein Feld, das nichts bewirkt, ist dieselbe Klasse wie ein Knopf ohne
`onPress`.** Am 16.08. war es `strike_count`, das sich setzen ließ und nichts
tat. Hier war es `meister_verified`: es ließ sich nicht einmal setzen, und
geprüft wurde es auch nicht. Bei jedem Abzeichen in der Oberfläche fragen, WER
es schreibt und WER es liest.

**Eine Mutation, die nur umbenennt, prüft den Regex und nicht die Sache.**
Zweimal an einem Tag hineingelaufen (`trg_apply_leak_strikes`,
`a_meisterbrief_festhalten`): `drop trigger if exists <alt>` plus
`create trigger <neu>` lässt den Trigger weiter existieren, und die Probe
bleibt grün. Zum Entfernen die `create trigger`-Anweisung LÖSCHEN.

**Der Prüfstand hat dreimal zugeschlagen, und dreimal zu Recht:** eine
pauschale Lese-Policy (RG), eine SECURITY-DEFINER-Funktion ohne `auth.uid()`
(RA) und fünf verschwundene Zusicherungen im Zahlenabgleich. Die dritte war der
wertvollste Treffer: `strike-verfall.sql` ließ seine Anbieter auf einen
Elektro-Auftrag ohne Meisterbrief bieten und wäre seit 0980 aus dem FALSCHEN
Grund rot gewesen.

## Und wieder ein Filter ohne Test

`supabase/functions/notify-matching-providers/auswahl.ts` wurde am 20.07. aus
`index.ts` herausgelöst, ausdrücklich damit er ausgeführt statt nur typgeprüft
wird. Danach wurde kein Test geschrieben; zwei Monate lang war er wieder genau
in dem Zustand, den das Herauslösen beenden sollte. `npx tsc --noEmit` liest
`supabase/functions/` ohnehin nicht. Jetzt `__tests__/anbieterAuswahl.test.ts`,
neun Tests, drei davon Gegenproben.

## Stand der Prüfungen

- `bash scripts/db-test/run.sh`: 336 Assertions, davon 18 neu in
  `meisterpflicht.sql` (sieben Gegenproben).
- Jest 42 Suiten / 717 Tests, tsc 0, `deno check` grün.
- Mutationsproben: 0980 13/13, `meisterpflicht-beleg-check.py` 6/6,
  `anbieterAuswahl.test.ts` 6/6.

## Offen

- **Die Sperre greift erst nach dem Merge auf `main`.** Migrationen rollen über
  die Supabase-GitHub-Integration mit dem Push auf `main` aus.
- Alles aus dem Block davor bleibt offen (Secrets, Chat-Löschfrist,
  Gerätetest).

# Stand 2026-09-20 — fünf Founder-Punkte, vier davon echt

Zehnter Block. Vier Bildschirmfotos und ein Satz mit fünf Fragen darin. Erst
gemessen, dann geantwortet. Volle Fassung mit allen Messwerten in
`notes/04-Entscheidungen/2026-09-20-fuenf-founder-punkte.md`.

## Der teuerste Fund: eine Kachel, die zu niemandem führte

Die Sammelkachel „Handwerker" im Auftrags-Trichter erzeugte
`category_id: 'handwerker'`. Diese Kennung steht in **keinem**
`provider_profiles.category_ids`, denn die kommen aus `data/categories.ts`.
`notify-matching-providers` filtert mit
`.contains("category_ids", [job.category_id])`, filterte also jeden Betrieb
weg. Die erste, größte, einladendste Kachel im Trichter führte zu einem
Auftrag, den nie jemand zu sehen bekam.

Gefunden nicht durch einen Prüfer, sondern beim Nachmessen einer Frage nach
der ANORDNUNG. Die Anordnung war der Anlass, nicht der Befund.

## Dieselbe Klasse wie die ganze Woche: gebaut, gepflegt, erreicht niemanden

- Die **Vorprüfung** der Verifizierung gibt es seit dem 14.09. und sie sperrt
  hart. Nur sagte niemand dem Betreiber, dass etwas wartet. `/health` zählt
  `pruef_offen`, in der Produktion steht die Zahl auf 1.
  → `.github/workflows/wartet-jemand.yml`, zweimal täglich, still solange
  niemand wartet. **Feuert erst nach dem Merge:** GitHub führt
  `schedule`-Trigger nur aus der Datei auf dem Standard-Branch aus.
- Das Feld **`urgency`** in Schritt 2 wurde erhoben, in den Entwurf gesichert
  und nirgends hingeschickt. Schritt 3 stellte dieselbe Frage noch einmal, und
  nur diese Antwort zählte. Ein Eingang ohne Wirkung.

## Neue Fehlerklasse: der eigene Rechtstext bestreitet den eigenen Code

AGB §8(4) sagte *„Eine automatisierte Entscheidung über Maßnahmen findet nicht
statt"*, während `trg_apply_leak_strikes` den Strike ohne Zutun eines Menschen
vergibt und die Datenschutzerklärung genau das offenlegt. Zwei eigene
Rechtstexte gegeneinander, einer davon unwahr, und Art. 17 Abs. 3 DSA verlangt
an dieser Stelle die Angabe.

Die Umkehrung von 16.08. („der Code widerspricht den eigenen AGB"): dort war
der Text richtig und der Code falsch, hier umgekehrt. **Beide Richtungen
gehören geprüft.** Jetzt in `scripts/agb-automatik-check.py`.

## Zwei Prüfer, die sich selbst gefangen haben

- `agb-automatik-check.py` las beim ersten Lauf nur 0720, fand dort keinen
  `create trigger` (der steht in 0500) und schloss auf „Automatik ist weg".
  Er liest jetzt alle Migrationen. **Eine Automatik besteht aus Funktion UND
  Trigger, und die können in verschiedenen Dateien stehen.**
- Die Mutationsprobe M4 blieb grün, weil sie den Trigger nur UMBENANNTE
  (`trg_apply_leak_strikes_AUS`) und der Regex den Präfix weiter traf. Nicht
  der Prüfer war schwach, die Mutation war es. Regex mit `\b` geschärft,
  Mutation auf einen echt anderen Namen umgestellt, danach rot.

## `icon: string` fängt keinen Tippfehler

`data/categories.ts` typt `icon` als `string`, nicht als
`keyof typeof Ionicons.glyphMap`. Ein Tippfehler rendert eine **leere Kachel**,
und weder tsc noch ein Blick aufs Bildschirmfoto fängt das. Beim Umstellen von
„Möbelaufbau" auf `bed-outline` (es trug dasselbe gekreuzte Werkzeug wie
„Renovierung") von Hand geprüft. Von Hand ist kein Verfahren, also jetzt ein
Test gegen die Glyphentabelle.

## Stand der Prüfungen

- `bash scripts/reisen/run.sh`: 529 PASS, 0 FAIL, Exit 0.
- Jest 41 Suiten / 708 Tests, tsc 0.
- `scripts/trichter-check.py` 8/8, `scripts/agb-automatik-check.py` 6/6
  (Mutationen rot, Gegenproben grün), beide in CI und in `run.sh`.

## Offen

- **Die Datenschutzerklärung sagt „Chat-Nachrichten: 6 Monate nach
  Auftragsabschluss". Es löscht nichts.** Am 16.08. bewusst geparkt
  (`2026-08-16-datenschutz-gegen-code.md` §3, drei offene Fragen). Ich hatte
  das beim Beantworten von Founder-Punkt 3 im ersten Durchgang übersehen und
  „nichts zu beheben" gemeldet; beim Nachmessen gefunden und korrigiert.
  Zwei Wege, beide Founder-Entscheidung: Löschung bauen, oder den Text nach
  Art. 13 Abs. 2 lit. a DSGVO auf **Kriterien** statt fester Dauer umstellen.
- **Gerätetest steht aus.** Der Prüfstand ist `expo export --platform web` +
  Playwright gegen `dist/`. Kein natives Layout, kein Simulator.
- **AGB §7(4)** sagt die Strike-Begründung „per E-Mail (dauerhafter
  Datenträger)" zu. Die Mitteilung wird geschrieben (0860), der Versand ist
  mangels `RESEND_API_KEY` aus. Solange das so ist, wird die Zusage nicht
  eingehalten. Kein Code-Fix, ein Secret.
- **`WERKANT_ADMIN_EMAILS`** bleibt ungesetzt, also ist niemand Betreiber und
  der wartende Betrieb kommt nicht durch. Bleibt beim Founder; die Grenze wird
  nicht aufgeweicht, um einen Blocker zu lösen.

# Stand 2026-09-18 (Abend) — der Kunde nahm Angebote von Namenlosen an

Neunter Block. Gefunden beim Vorbereiten der Entscheidung „darf ein Betrieb
ohne Verifizierung bieten?" — und der Fund macht diese Frage erst sinnvoll.

## Der Befund

Die Angebotskarte in `app/auftrag-detail.tsx` zeigte Preis, Gebühren und
Auszahlung. **Und sonst nichts.** Kein Name, keine Bewertung, kein Hinweis.
Der Bestätigungsdialog sagte *„Möchten Sie das Angebot für 320,00 € annehmen?
Ein verbindlicher Vertrag wird erstellt."* und nannte ebenfalls nur den Betrag.

Der Name taucht erst **nach** der Annahme auf (`contract.provider.business_name`).
Der Kunde entschied also genau in dem Moment blind, in dem die Entscheidung
bindet.

Die Daten gab es die ganze Zeit: `provider_public` (0560) führt
`business_name`, `rating_avg` und `rating_count`, und der Typ
`OfferWithProvider` steht seit Monaten in `database.types.ts`, ohne je benutzt
zu werden. Dieselbe Fehlerklasse wie alles diese Woche: gebaut, gepflegt,
erreicht niemanden.

## Was jetzt dasteht

Name und Bewertung auf der Karte, und der Betrieb im Annahmedialog.

**Der wichtigere Teil ist der fehlende Eintrag.** `provider_public` zeigt nur
freigegebene und verfügbare Betriebe. Fehlt einer, wird KEIN Name erfunden:
„Name nicht öffentlich" plus der Satz *„Dieser Betrieb ist derzeit nicht im
Verzeichnis aufrufbar. Fragen Sie nach, bevor Sie annehmen."* und „Keine
Bewertungen einsehbar". „Anbieter" hinzustellen sah bis 0800 aus wie ein Name
und war keiner.

## Und damit wird die offene Frage konkret

Ob ein Betrieb ohne Verifizierung bieten darf, war bisher eine abstrakte
Frage: der Kunde konnte ohnehin nicht sehen, wer bot. Jetzt sieht er es, und
ein nicht freigegebener Betrieb erscheint sichtbar als „nicht im Verzeichnis
aufrufbar". **Die Entscheidung bleibt beim Founder**, aber ihre Folge ist jetzt
auf dem Bildschirm sichtbar statt verborgen.

## Gemessen

* **Jest** 41 Suites / 707 Tests. Sieben neu.
* **Reise 4** um fünf Zusicherungen erweitert (C2c, C2d, E1 bis E3).
* **Gegenprobe gemessen:** reicht der Bildschirm den Anbieter nicht durch,
  werden C2c und C2d rot, während E1 bis E3 grün bleiben — die prüfen genau
  den Fall ohne öffentlichen Eintrag.
* tsc 0.

---

# Nacht vom 17. auf den 18.09.2026 — zehn Blöcke, in einer Liste

Gebaut, während der Founder schlief. Jeder Block hat seinen eigenen Abschnitt
weiter unten; das hier ist nur der Zugriff darauf.

| # | Commit | Worum es geht |
|---|---|---|
| 1 | `99bf3df` | Der Kunde erfuhr nie, dass ein Betrieb dazugekommen ist (0950) |
| 2 | `6529407` | Start-PIN beim Arbeitsbeginn (0960) |
| 3 | `e81f3b7` | Termin weitergeben, ohne die Zahl mitzugeben |
| 4 | `015d038` | Der Verkaufsleitfaden sagte am Telefon das Gegenteil der App |
| 5 | `aaf79c1` | Die PIN wird gelöscht, wenn sie ihren Zweck erfüllt hat (0970) |
| 6 | `29f99ea` | Das Rechte-Muster aus 0920/0960 hat eine eingebaute Falle |
| 7 | `505d00e` | Die Anfragen-Liste sortiert nach Passung, filtert aber nicht |
| 8 | `13f1301` | Dreizehn Reisen liefen in keinem Workflow |
| 9 | `2ca718e` | Der Kunde nahm Angebote von Namenlosen an |
| 10 | `d1dd587` | Der Bildschirmprüfer maß gegen eine Grenze, die er nicht ließ |

**Fünf davon sind Fehler in meiner eigenen Arbeit derselben Nacht** (2, 5, 6,
7, 10), gefunden beim Nachprüfen. Das ist kein Zufall und kein Grund zur Sorge:
die Mutationsproben sind genau dafür da.

**Bei Block 10 habe ich mich zweimal geirrt, beides steht hier.** Erstens hatte
ich einen Gesamtlauf als grün gemeldet, der es nicht war — er meldete zwei
FAIL am Anbieter-Profil. Zweitens habe ich als Begründung für die Dringlichkeit
geschrieben, die Suite laufe „ab jetzt nächtlich auf einem geteilten Läufer".
Das stimmt nicht: `reisen.yml` liegt auf dem Arbeitszweig, und GitHub startet
`schedule`-Auslöser nur von der Datei auf dem **Standardzweig**. Nächtlich
läuft noch nichts; das beginnt erst nach dem Merge nach `main`. Die Korrektur
am Prüfer bleibt trotzdem richtig — die Rechnung war schon vorher falsch,
unabhängig davon, wo sie läuft. Ursache war nicht das Produkt, sondern die
Zeitrechnung des Prüfers; nachgemessen im ruhigen Einzellauf (276 von 276) und
mit Gegenprobe belegt. Die Korrektur ist Block 10.

## Was ich an Deiner Stelle entschieden habe

Jede dieser Entscheidungen ist umkehrbar und steht mit Begründung in
`notes/04-Entscheidungen/`:

* **Die Start-PIN nennt der Kunde dem Betrieb**, nicht umgekehrt.
* **Wird sie nicht eingelöst, passiert nichts.** Kein Hinweis, kein Strike.
* **Nachbarschaftshilfe bekommt keine PIN.**
* **Die Anfragen-Liste wird sortiert, nicht gefiltert.**
* **`playwright` ist jetzt eine Abhängigkeit.** Damit habe ich eine
  dokumentierte Entscheidung umgedreht; der Grund steht in `scripts/reisen/run.sh`.
* **Fehlt ein Betrieb in `provider_public`, wird kein Name erfunden.** Auf der
  Angebotskarte steht dann „Name nicht öffentlich" mit dem Satz, was das heißt.

## Was NUR Du entscheiden kannst

1. **Darf ein Betrieb ohne abgeschlossene Verifizierung bieten?** Heute darf er
   es. Seit Block 9 sieht der Kunde die Folge: ein solches Angebot trägt
   „Name nicht öffentlich" und den Hinweis, vor der Annahme nachzufragen.
   Vorher war die Frage abstrakt, weil auf der Karte ohnehin niemand stand.
   Empfehlung und Beleg: `notes/04-Entscheidungen/2026-09-17-kaltstart-gegenrichtung.md`.
2. **Provision für die ersten drei Aufträge erlassen?** Empfehlung 8 aus dem
   Wettbewerbsabgleich. Preisentscheidung, nicht meine.

## Was den Betrieb blockiert, unverändert

`/health` sagt am Abend des 18.09. dasselbe wie vor der Nacht: `ok: false`,
`pruef_offen: 1`. Es fehlen `WERKANT_ADMIN_EMAILS` (dringend, ein echter
Betrieb wartet), die Stripe-Schlüssel, `RESEND_API_KEY` +
`WAITLIST_FROM_EMAIL` und die beiden pg_cron-Zeitpläne.

**Kein Block dieser Nacht geht ohne diese vier Klicks in Betrieb.**

---

# Stand 2026-09-18 (Mittag) — dreizehn Reisen, die nirgends automatisch liefen

Achter Block, und der Befund betrifft die ganze Nacht rückwirkend.

## Der Befund

Die dreizehn Kern-Reisen und die Bildschirm-Prüfer laufen **nirgends** in der
CI. `ci.yml` fährt Typecheck, Jest, 26 statische Prüfer, die Edge-Function-
Tests und `scripts/db-test/run.sh` — aber `scripts/reisen/run.sh` kommt in
keinem Workflow vor. Sie liefen ausschließlich, wenn ich sie von Hand startete.

Genau diese Lehre steht seit dem 08.09. im Kopf von `scripts/ton-check.py`:
*„Ein Prüfer, der nur von Hand mit einem Dateipfad läuft, läuft nie."* Dort war
es ein Skript, hier sind es dreizehn Reisen, die unter anderem belegen, dass die
Kalender-Knöpfe nach dem Alert-Fix wirklich etwas tun, dass der gesetzliche
Widerrufsweg nicht mehr stumm scheitert und dass die Pflichtmitteilung den
Betrieb erreicht.

## `.github/workflows/reisen.yml`

Nächtlich um 03:17 UTC und jederzeit von Hand auslösbar. **Nicht** in `ci.yml`:
der volle Lauf dauert gemessen rund 40 Minuten, und ein CI, auf das man eine
Dreiviertelstunde wartet, wird umgangen. `ci.yml` bleibt bei 2 bis 3 Minuten.

## Der schwerere Fund daneben

`playwright` stand **in keiner package.json und in keinem Lockfile**. Es lag nur
in `node_modules` dieser Sandbox. Ein frischer Checkout plus `npm ci` hätte
keine einzige Reise fahren können.

Der Läufer fing das ab, indem er es bei Bedarf mit `npm i --no-save` nachlud —
und genau das stand dort auch als bewusste Entscheidung begründet.

**Ich habe diese Entscheidung umgedreht**, und der Grund steht jetzt an
derselben Stelle in `run.sh`:

1. Die Fassung war nicht festgelegt. Dreizehn Reisen hingen an einem Paket, das
   bei jedem Nachladen eine andere Version sein konnte. Ein Verhaltenswechsel
   darin wäre als Produktfehler erschienen.
2. Ein nächtlicher Lauf, der zuerst ein unbestimmtes Paket aus dem Netz zieht,
   ist kein reproduzierbarer Lauf.

Gemessen, was der alte Einwand kostet: genau zwei Pakete.

## Was gemessen ist, und was nicht

* Ein sauberes `npm ci` aus dem neuen Lockfile in einem leeren Verzeichnis
  installiert `playwright` 1.63.0. **Ausgeführt, nicht angenommen.**
* `chromium.executablePath()` löst auf.
* tsc 0, Jest 40 Suites / 700 Tests, `scripts/reisen/run.sh` 524 PASS Exit 0.
* **NICHT gemessen:** dass der Workflow auf einem GitHub-Läufer grün wird.
  Das lässt sich von hier aus nicht prüfen; `workflow_dispatch` greift erst,
  wenn die Datei auf dem Standardzweig liegt. Der erste nächtliche Lauf nach
  dem Merge ist die Probe. Aus „ich habe einen Workflow geschrieben" folgt
  nicht, dass er läuft — dieselbe Vorsicht wie am 07.09. in der Gegenrichtung.

---

# Stand 2026-09-18 (Vormittag) — die Mitteilung meinte zwei Aufträge, die Liste zeigte zwanzig

Siebter Block, wieder aus der eigenen Arbeit heraus. Migration 0950 schickt dem
Betrieb: *„In Ihrem Postleitzahlenbereich sind N offene Aufträge
ausgeschrieben, die zu Ihren Gewerken passen. Sie finden sie unter Anfragen."*

Die Anfragen-Liste zeigte aber alle offenen Aufträge seines Zweigs, die zwanzig
neuesten, ohne jede Kennzeichnung. Der Betrieb tippt also auf eine Mitteilung,
die zwei bestimmte Aufträge meint, und muss sie dann suchen.

## Sortiert, nicht gefiltert

Ein Filter wäre die bequemere Lösung und die falsche: im Kaltstart ist
Sichtbarkeit für die wenigen Aufträge, die es gibt, mehr wert als Genauigkeit.
Ein Betrieb, der einen Nachbarort mitnehmen würde, soll ihn sehen können.

Sortiert wird nach Passung (Gewerk und Region zuerst, dann Gewerk, dann
Region), und die Passung wird benannt: „Ihr Gewerk, Ihre Region". **Das Gewerk
wiegt schwerer als die Entfernung** — wer Elektro kann, fährt auch in den
Nachbarort; wer es nicht kann, nützt auch nebenan nichts.

Kein „Empfohlen" und kein „Für Sie": das wäre eine Behauptung über eine
Auswahl, die es nicht gibt. Gesagt wird nur, was nachprüfbar ist. Die beiden
Bedingungen sind dieselben wie in `notify-matching-providers/auswahl.ts` und im
Trigger aus 0950 — gehen sie auseinander, sortiert der Bildschirm nach einer
anderen Regel, als die Mitteilung behauptet.

## Gemessen

* **Jest** 40 Suites / 700 Tests. Elf neu; sechs Mutationen gegen
  `lib/anfragenSortierung.ts`, jede macht genau die richtigen Tests rot.
  Darunter „gefiltert statt sortiert" und „Etikett ohne Gegenstand".
* **Reise 13** (neu): sechs Zusicherungen. Gegenprobe gemessen: liest der
  Bildschirm das Betriebsprofil nicht mehr, werden A2 bis A4 rot, während B1
  und B2 grün bleiben (die prüfen genau diesen Fall).

## Ein Fehlalarm im eigenen Prüfer, gleich gemessen und behoben

A3 und A4 meldeten zuerst FAIL an einem Bildschirm, der richtig war:
`T.label` setzt Versalien, und `innerText` gibt in Chromium den GERENDERTEN
Text zurück, also „IHR GEWERK". Mein Regex war schreibungsabhängig. Statt es
zu raten habe ich den gerenderten Text ausgelesen und nachgesehen.

---

# Stand 2026-09-18 (Morgen) — die Falle im eigenen Muster

Sechster Block, wieder ein Selbst-Check. 0920 und 0960 benutzen dasselbe
Muster: `revoke update on <tabelle> from authenticated`, dann eine Schleife,
die jede Spalte AUSSER den geschützten wieder vergibt.

Das Muster hat eine eingebaute Falle: **jede Spalte, die eine spätere
Migration hinzufügt, bekommt das Recht nicht.** Sie ist ab dann für
Angemeldete nicht mehr beschreibbar, und zwar still. Kein Fehler beim
Einspielen, keine rote Prüfung, nur ein Formular, das irgendwann „permission
denied" meldet.

Dass das kein Hirngespinst ist, hat die Mutationsprobe zu 0960 gezeigt: nimmt
man den Rückgabe-Teil weg, scheitert `escrow.sql` mit „permission denied for
table contracts". Das war Glück, der Test stand zufällig davor.

## RH und RI in `scripts/db-test/rechte.sql`

Jetzt wird mechanisch gefragt statt beispielhaft: JEDE Spalte von `jobs` und
`contracts` wird einzeln abgefragt. Kommt morgen eine dazu und jemand vergisst
das Recht, wird die Zusicherung rot, bevor es ein Nutzer merkt.

## Gemessen

Vier Mutationen, jede macht die richtige Zusicherung rot:

| Mutation | rot |
|---|---|
| spätere Migration fügt `contracts`-Spalte ohne Recht hinzu | RI |
| der gesperrte Zeitpunkt wird doch vergeben | RI |
| spätere Migration fügt `jobs`-Spalte ohne Recht hinzu | RH |
| die beiden Zählspalten werden doch vergeben | RH |

Dazu die Gegenprobe: eine neue Spalte MIT Recht bleibt grün. Ohne sie wäre
„alles sperren" der bequemste grüne Haken.

`scripts/db-test/run.sh`: **318 Assertions PASS** (316 vorher).

---

# Stand 2026-09-18 (Morgen) — ein Widerspruch in der eigenen Arbeit

Fünfter Block, und der Anlass war kein Founder-Befund, sondern ein Selbst-Check
auf das, was in derselben Nacht entstanden ist.

## Der Widerspruch

In 0960 ist die Start-PIN bewusst als **Zugangsmittel** behandelt: sie steht
deshalb NICHT in der Auskunft nach Art. 15 DSGVO, sondern unter
`nicht_enthalten`, mit derselben Begründung wie bei `email_verifications`.

Dieselbe Zahl blieb danach aber für immer in der Tabelle stehen. Beides
zusammen geht nicht: was heikel genug ist, um es aus einer Auskunftsdatei
herauszuhalten, ist heikel genug, um es zu löschen, sobald es seinen Zweck
erfüllt hat.

Verschärfend: `delete-account` löscht `contracts` NICHT (HGB § 257, zehn Jahre
Aufbewahrung der Finanzbelege), und `vertrag_start_pins` hängt per
Fremdschlüssel daran. Die Zahl hätte ein gelöschtes Konto um zehn Jahre
überlebt.

## Was 0970 tut

* Die Zahl darf jetzt fehlen (`pin` ist nullable). NULL heißt: erfüllt ihren
  Zweck nicht mehr.
* `arbeit_beginnen()` löscht sie beim Einlösen. Ab da belegt `eingeloest_am`
  alles, was zu belegen ist.
* Ein Trigger löscht sie, sobald der Vertrag abgeschlossen oder storniert ist.
  Auch dann, wenn sie nie eingelöst wurde: ein Auftrag, der vorbei ist, fängt
  nicht mehr an.
* **Was bleibt:** `eingeloest_am`, `fehlversuche`, `gesperrt_bis`. Das ist der
  Beleg, um dessentwillen die ganze Funktion existiert. Er braucht die Zahl
  nicht, nur ihr Ergebnis.

## Ein Folgefehler auf dem Bildschirm, mitgefunden

Der Vertragsbildschirm kannte nur „Zahl" oder „null", und `null` hieß dort
„wird geladen" (vier Punkte). Nach dem Löschen hätten die vier Punkte für
immer dort gestanden: ein Ladezustand, der nie endet. Jetzt drei Zustände, und
bei gelöschter Zahl fällt der Abschnitt ganz weg.

## Gemessen

* `scripts/db-test/run.sh`: **316 Assertions PASS** (313 vorher, drei neu).
* **Fünf Mutationen gegen 0970.** Vier machen genau eine Zusicherung rot.
  Die fünfte („der Bestand wird nicht nachgezogen") bleibt grün, und das steht
  so in der Migration: die Harness legt jeden Vertrag frisch an, es gibt dort
  keinen Bestand. Der Nachzug wirkt nur gegen echte Daten.
* **Reise 12** von 18 auf 20 Zusicherungen. Gegenprobe gemessen: „der
  Abschnitt wird immer gezeigt" macht G1 und G2 rot.
* Jest 39 Suites / 689 Tests, tsc 0.

---

# Stand 2026-09-18 (Morgen) — was am Telefon gesagt wird, bindet auch

Vierter Block der Nacht. Punkt 3 der Reihenfolge nach Nutzen aus
`docs/markt/wettbewerbsabgleich-2026-09.md`: das Risiko-Argument in den
Verkauf. Beim Hineinschreiben kamen vier Befunde heraus, die schwerer wiegen
als der Zusatz selbst.

## Was im Verkaufsleitfaden stand, und was der Code sagt

| Im Leitfaden | Im Code |
|---|---|
| „Wie bekomme ich mein Geld?" → „Direkt vom Kunden, wie heute auch. Für später planen wir eine optionale Treuhand-Abwicklung." | Die Treuhand ist gebaut: `create-payment-intent`, `release-escrow`, `contracts.escrow_captured_at`. |
| „Wer haftet?" → „... inklusive Nachweis der Betriebshaftpflicht." | Am 14.09.2026 aus dem Produkt entfernt, weil Werkant nie eine Police sieht. |
| Aufnahme-Entscheidung, Punkt 3: „Betriebshaftpflicht nachweisbar." | Die App hat dafür kein Feld, keinen Upload, keine Spalte. |
| Achtmal die alte Marke „WERKR" | Die Marke ist seit dem Rebrand „Werkant". |

Dazu im Hausverwaltungs-Pitch, gefunden erst vom neuen Prüfer: zweimal
**„verifizierte Alltagshelfer"** (steht seit dem 16.09. ausdrücklich auf der
Liste der Sätze, die nie wieder verkauft werden dürfen) und eine feste
Stundenzahl für die Erledigung dreier Testaufträge. Beides korrigiert; an die
Stelle der Stundenzahl tritt die Zahl aus 0920: wie viele Betriebe im
Postleitzahlenbereich wirklich angemeldet sind.

## Der Prüfer dazu

`scripts/verkaufstext-check.py` (CI + Läufer) liest `docs/vertrieb/*.md` und
prüft fünf Regeln gegen den Code. Zwei davon sind ABGELEITET: kommt die
Haftpflicht eines Tages ins Onboarding, verstummt die Regel von selbst.

`versprechen-check.py` gibt es seit dem 13.09. genau gegen diese Fehlerklasse,
liest aber nur TSX. Ein Verkaufsgespräch ist Text, den ein Mensch hört, und er
bindet genauso (§ 5 UWG gilt für mündliche Werbung ebenso).

## Zwei Fehler im Prüfer selbst, beide gemessen

* Er übersprang Blockzitate, damit er nicht an der eigenen Erklärung anschlägt.
  Im Hausverwaltungs-Pitch IST das Blockzitat der Text, den der Founder
  vorliest: drei Fundstellen wären durchgerutscht. Die richtige Antwort auf
  „wer nach einem Muster sucht, darf es nicht danebenschreiben" ist, das Muster
  nicht danebenzuschreiben, nicht den Prüfer blind zu machen.
* Die Verneinungs-Ausnahme arbeitete zeilenweise. In einer Markdown-Tabelle
  steht eine ganze Antwort in EINER Zeile, und ein „NICHT" zwei Sätze weiter
  ließ die Mutation durch. Geprüft wird jetzt satzweise.

## Ein Fehlalarm im Anrede-Prüfer, gefunden und behoben

`anrede-check.py` meldete „Ich melde mich, wenn der Termin vorbei ist." als
Duzen. Die vorhandene Ausnahme fing nur „melde ich" (Pronomen NACH dem Verb);
steht es davor, ist es genauso erste Person. Der Prüfer erkennt das jetzt.

Gegengeprüft: „Melde Dich, wenn Du etwas brauchst.", „Dein Handwerkertermin"
und „Ruf mich an" werden weiter gemeldet, eine harmlose Umformulierung nicht.
Die Empfindlichkeit ist also nicht gesunken.

## Gemessen

Fünf Mutationen gegen den neuen Prüfer, jede macht genau ihre Regel rot. Drei
Gegenproben bleiben grün. Dazu drei Mutationen und eine Gegenprobe für den
Anrede-Prüfer.

---

# Stand 2026-09-18 (frueher Morgen) — den Termin weitergeben, ohne die Zahl

Dritter Block der Nacht, direkt auf dem PIN-Block auf. Punkt 4 aus
`docs/markt/wettbewerbsabgleich-2026-09.md`: „Termin teilen fuer den Kunden.
Klein, billig, und es adressiert die Sorge, die eine Person hat, bevor ein
Fremder in die Wohnung kommt."

## Was es tut

Auf dem Vertragsbildschirm kann der Kunde den Termin an eine Vertrauensperson
weitergeben: Leistung, Betrieb, Ort, Zeit, Vertragsnummer. Ueber
`lib/teilen.ts`, also mit der Web-Weiche, die seit dem 16.09. existiert (Share
wo es das gibt, sonst Download, und mit Rueckgabewert statt
Erfolgsbehauptung).

## Die eine Entscheidung, um die es geht

**Die Start-PIN reist NICHT mit.** Und zwar so, dass sie es nicht kann:
`terminWeitergabeText` nimmt gar kein Feld dafuer entgegen. Was man nicht
uebergeben kann, kann auch nicht versehentlich mitgeschickt werden -- dieselbe
Ueberlegung wie bei `meine_aktiven_strikes()` ohne Argument (07.09.).

Auf dem Bildschirm steht der Satz dazu: „Weitergegeben werden Leistung,
Betrieb, Ort und Zeit. Die vier Ziffern bleiben bei Ihnen."

## Gemessen

* **Jest**: 39 Suites / 689 Tests. Sieben neu; fuenf Mutationen gegen
  `lib/terminText.ts` gemessen, jede macht genau den richtigen Test rot.
* **Reise 12** ist von 13 auf 18 Zusicherungen gewachsen. F3 bis F5 fangen den
  echten Download ab und LESEN die Datei: nennt sie den Betrieb, und enthaelt
  sie die Zahl nicht.
* **Gegenprobe gemessen**: „die PIN reist in der Weitergabe mit" macht genau
  F5 rot.

## Ein Fehlalarm im eigenen Test, gleich wieder entfernt

Die erste Fassung von „enthaelt die PIN nicht" suchte nach „vier Ziffern am
Stueck" und schlug am Jahr **2026** an. Ein Pruefer mit Fehlalarmen wird
abgeschaltet und nie wieder an. Geprueft wird jetzt die Eigenschaft (die
Signatur kennt kein Feld, und ein trotzdem mitgegebenes wird nicht ausgegeben),
nicht das Muster.

---

# Stand 2026-09-18 (Nacht) — die Start-PIN, und drei entschiedene Fragen

Zweiter Block der Nacht, nach dem Kaltstart (PR-Stand `99bf3df`). Der Founder
schlaeft; Weckruf alle vier Stunden ist eingerichtet
(Routine `trig_01RPa1JSZJobZcAZd94fk4aL`).

## Was gebaut wurde

`docs/markt/wettbewerbsabgleich-2026-09.md` nennt die PIN beim Arbeitsbeginn
als Punkt 2 nach Nutzen. Der Entwurf lag seit dem 16.09. fertig da und endete
mit drei offenen Fragen. Alle drei sind jetzt entschieden und begruendet
(`notes/04-Entscheidungen/2026-09-18-start-pin.md`):

1. **Der Kunde nennt dem Betrieb die Zahl** (Uber-Muster). Er entscheidet, wer
   seine Tuer passiert.
2. **Wird sie nicht eingeloest, passiert NICHTS.** Kein Hinweis, kein
   Pruefsignal, kein Strike, und genau dieser Satz steht auch auf dem
   Bildschirm. Eine Folge waere eine Zusage, und eine Zusage ohne Mechanismus
   ist eine Luege mit Verzoegerung.
3. **Nachbarschaftshilfe bekommt keine PIN.** Kleine Betraege, die Huerde
   zaehlt mehr als der Beleg.

Technisch (0960):
* `vertrag_start_pins` als eigene Tabelle, nicht als Spalte in `contracts`.
  Der Betrieb darf die Zahl nicht lesen, und Leserechte gelten zeilenweise,
  nicht spaltenweise je Person.
* Der Vergleich liegt in `arbeit_beginnen()` auf dem Server. Wuerde die App
  die Zahl holen und selbst vergleichen, koennte der Betrieb sie im
  Netzverkehr mitlesen.
* Drei Versuche, dann 15 Minuten Sperre, und der Auftraggeber erfaehrt es.
* `contracts.arbeit_begonnen_am` ist nur ueber die Funktion setzbar
  (Spaltenrechte wie in 0920).

## Zwei Dinge, die erst beim Bauen auffielen

**Der dritte Fehlversuch meldet die Sperre, nicht „falsch".** Beides waere
wahr; `falsch` liesse die App sagen „noch ein Versuch", obwohl keiner kommt.

**Der Beleg kommt vom Server, nicht aus der Uhr des Geraets.** Die
Mutationsprobe zeigte, warum das traegt: „jeder Ausgang gilt als Erfolg" macht
KEINE Zusicherung rot, weil der Bildschirm keinen Beginn behaupten kann, den
die Datenbank nicht hat. Erst „Zeitpunkt aus der Uhr des Geraets" macht E1 und
E2 rot.

## Gemessen

* `scripts/db-test/run.sh`: **313 Assertions PASS** (299 vorher, 14 neu).
* **15 Mutationen gegen 0960**: jede der vierzehn Zusicherungen wird rot. Eine
  faengt `rechte.sql` (RA) frueher ab, und das ist gewollt.
* **Reise 12** (neu): 13 Zusicherungen, vier Gegenproben gemessen.
* **Jest**: 38 Suites / 682 Tests; acht davon neu, vier Mutationen gemessen.
* `scripts/startpin-beleg-check.py` (neu, in CI und im Laeufer): bindet die
  Zahlen im Text an die Migration. Beide Zahlenmutationen rot, harmlose
  Umformulierung gruen.
* `constants/regeln.ts`: achte Zusage, mit Beleg in 0960.

## Ausdruecklich NICHT gebaut

Eine Anzeige „Arbeitsbeginn ausstehend" oder ein Hinweis, wenn ohne
Einloesung abgerechnet wird. Beides waere Frage 2 durch die Hintertuer. Der
Beleg existiert jetzt; was daraus folgt, entscheidet der Founder.

---

# Stand 2026-09-17 (Nacht) — der Kaltstart hatte nur eine Richtung

Fortsetzung nach „Jetzt ist alles durch?" (Antwort: der Code ja, der Betrieb
nein) und „Dann weiter ausarbeiten". Branch `claude/session-handoff-docs-1qxv3d`.

## Der Befund

`notify-matching-providers` laeuft genau EINMAL, beim Anlegen des Auftrags.
Danach ruft sie niemand mehr. Der Kundenbildschirm sagte deshalb auf Dauer
„In Ihrer Gegend ist noch kein passender Betrieb dabei" — auch drei Tage
spaeter, wenn laengst einer angemeldet, freigegeben und im PLZ-Bereich war und
den Auftrag sogar in seiner Anfragen-Liste sah.

Dieselbe Fehlerklasse wie die ganze Woche: eine Tatsache wird als aktuell
angezeigt, und kein Mechanismus haelt sie aktuell. 0920 hat die Zahl
eingefuehrt und genau einen Schreiber dafuer gebaut.

## Was gebaut wurde

* **0950** — Trigger `betrieb_betritt_markt` auf `provider_profiles`. Betritt
  ein Betrieb den Markt (Freigabe, Verfuegbarkeit, neues Gewerk), bekommen die
  wartenden Kunden im selben PLZ-Bereich eine Mitteilung, der Betrieb erfaehrt
  wie viel Arbeit wartet, und die Zahl aus 0920 wird nachgezogen.
  Als Trigger, nicht als Edge Function: laeuft in derselben Transaktion wie
  die Freigabe und braucht **kein Secret des Founders**.
* **`job_benachrichtigungen`** — Nachweis, wer ueber welchen Auftrag informiert
  wurde. Die Zahl wird daraus abgeleitet statt hochgezaehlt.
* **Kunden-Glocke mit Zaehler** (`app/(tabs)/index.tsx`). Die des Betriebs
  zaehlt seit PR #208, die des Kunden nicht — und genau dorthin schreibt 0950.
* **`categoryId` ist Pflicht** in `lib/jobs.ts`. Optional haette ihr Wegfall
  den Gewerk-Filter still ausgeschaltet: dann bekaeme JEDER verfuegbare
  Betrieb im PLZ-Bereich die Mitteilung.

## Der Fehler in meinem eigenen Entwurf

Die erste Fassung zaehlte einfach hoch. Beim **Schreiben des Tests** kam
heraus: derselbe Betrieb zaehlt dann zweimal, sobald er spaeter ein Gewerk
dazunimmt. Ich hatte die Zeile `if v_a <> 2` schon hingeschrieben — also fast
den Test an die Implementierung angepasst. Ein Zaehler, der nicht weiss, WEN
er zaehlt, kann Doppelzaehlung nicht verhindern. Daher der Nachweis.

## Was gemessen ist

* `scripts/db-test/run.sh`: **299 Assertions PASS** (285 vorher, 14 in
  `kaltstart.sql`; neun davon Gegenproben).
* **16 Mutationen gegen 0950**, jede einzeln, jede zurueckgesetzt. Zwoelf
  machen genau eine Zusicherung rot. Vier bleiben gruen, und das steht so im
  Code: `if not found` und die Uebergangsbedingung sind Beschleunigungen,
  keine Absicherungen; eine offene Lese-Policy faengt schon `rechte.sql` (RG).
* **Reise 11** (neu): die Kaltstart-Mitteilung erreicht den Kunden.
  Gegenprobe gemessen: Zaehler zurueckgenommen -> genau B1 rot, A1 gruen.
  Der Eingang war die ganze Zeit da, er hat nur nichts angezeigt.
* `npx tsc --noEmit` 0, Jest 37 Suites / 674 Tests, `deno check` 0.

## Offen und beim Founder (unveraendert)

`WERKANT_ADMIN_EMAILS` (dringend, ein echter Betrieb wartet), Stripe-Schluessel,
`RESEND_API_KEY` + `WAITLIST_FROM_EMAIL`, beide pg_cron-Zeitplaene,
Impressum-Echtdaten, drei Anwaltsfragen, BZSt, PStTG-Schwelle.

## Neue offene Frage (beim Bauen gefunden, NICHT entschieden)

Ein Betrieb **ohne** Verifizierung darf heute bieten: die `offers`-Policy
verlangt kein `kyc_verified`, die Weiche im Client prueft nur, ob ueberhaupt
eine `provider_profiles`-Zeile existiert. `provider_public` verlangt es
dagegen — ein Kunde kann also ein Angebot von einem Betrieb bekommen, dessen
Profil er nicht aufrufen kann. Empfehlung und Begruendung:
`notes/04-Entscheidungen/2026-09-17-kaltstart-gegenrichtung.md`.

## Als Naechstes

Die Anfragen-Liste des Betriebs zeigt alle offenen Auftraege des Zweigs, ohne
Filter auf Gewerk oder Region. Im Kaltstart Absicht; ab etwa fuenfzig offenen
Auftraegen gehoert sie sortiert (passende zuerst), nicht gefiltert.

---

# Stand 2026-09-16 (spaeter Morgen) — eine Drohung an den Falschen

PR #203 ist zusammengefuehrt und in Produktion nachgemessen: `reviews.antwort`
(0930) und `jobs.benachrichtigte_betriebe` (0920) sind eingespielt, `/demo`
antwortet mit 404, `/datenschutz.html` ist eine 1 243 Byte grosse
Weiterleitung mit `noindex`. Die zweite Datenschutzerklaerung und der
Prototyp mit der Haftpflicht-Zusage sind damit vom Netz.

## Empfehlung 7, und ein Fehler daneben

`lib/chatGuard.ts` sagte dem Leser einer Nachricht mit Kontaktdaten: *„Was Sie
ausserhalb von Werkant absprechen, deckt der Werkant-Schutz nicht ab."* Ein
Kunde liest das als Regel, die der Plattform ihren Anteil sichert, nicht als
etwas, das IHN schuetzt. Jetzt steht dort, was er wirklich verliert, und zwar
nur Dinge, die es gibt (`constants/regeln.ts`): kein Treuhandkonto, keine
gesperrte Zahlung bei einer Reklamation, keine Bewertung danach.

**Der Fehler daneben:** der Satz „Drei solcher Feststellungen in zwoelf
Monaten ergeben einen Strike" ging an JEDEN Absender — auch an einen Kunden.
Ein Kunde kann gar keinen Strike bekommen, `aktive_strikes` haengt an
`provider_profiles`. Eine Strafandrohung, die es fuer den Angesprochenen nicht
gibt, ist schlimmer als keine; dieselbe Klasse wie die Fassung vom 08.09., in
der der Empfaenger sie las.

`kontaktHinweis` nimmt jetzt die Rolle entgegen. Ohne bekannte Rolle wird die
Folge weggelassen, nicht geraten.

---

# Stand 2026-09-16 (Morgen) — zwei Zusagen im Hilfe-Chat hatten nichts hinter sich

Fortsetzung des Nachtlaufs, gleicher Branch, gleiche PR #203.

## Der Befund

Der Hilfe-Chat sagte dem Nutzer wörtlich: *„Sie haben 14 Tage Zeit, um den
Anbieter zu bewerten. Anbieter können ebenfalls eine Gegenbewertung abgeben.
Alle Bewertungen werden verifiziert. Fake-Bewertungen führen zu einer
Kontosperrung."*

| Zusage | Stand vorher |
|---|---|
| 14 Tage Frist | Gab es nirgends. Weder Regel noch Anzeige; eine Bewertung war ein Jahr später noch möglich. |
| Gegenbewertung | In 0310 erlaubt, aber ohne jeden Eingang in der App. |
| „werden verifiziert" | Stimmte. 0310 verlangt einen abgeschlossenen Vertrag zwischen genau diesen beiden Parteien. |
| „führen zu Kontosperrung" | Kein Mechanismus, und soll keinen bekommen: aus einer Meldung darf kein Auto-Strike folgen, sonst genügen drei Meldungen für eine Sperre. |

Dazu fehlte, was eine öffentliche Bewertung erst erträglich macht: ein
**Antwortrecht**. Ein Handwerker mit drei Bewertungen, davon eine mit einem
Stern, konnte dazu nichts sagen.

## Was gebaut wurde (0930)

- **Bewertungsfrist 14 Tage** ab `contracts.completed_at`. Fehlt der
  Zeitstempel, sperrt die Frist niemanden aus; `lib/bewertungsFrist.ts` sagt
  dasselbe, damit die App nichts verbietet, was der Server erlaubt.
- **Antwortrecht:** genau EINE öffentliche Antwort, nur von der bewerteten
  Person. Das Spaltenrecht lässt dabei nur `antwort` zu, sonst könnte die
  bewertete Person über dieselbe Policy aus einem Stern fünf machen.
- **Eingänge**, die vorher fehlten: der Betrieb erreicht seine eigene
  öffentliche Seite über „Meine Seite & Bewertungen" (Profil), und bewertet
  den Kunden von der Karte eines erledigten Auftrags aus.
- **Der Bildschirm ist jetzt richtungsabhängig** (`lib/bewertungsSicht.ts`).
  Er war durchgehend aus Kundensicht geschrieben: Firmenname, der vom Kunden
  gezahlte Betrag unter „bezahlt", Schlagworte wie „Sauber gearbeitet". Mit
  dem neuen Eingang hätte ein Betrieb seinen eigenen Firmennamen bewertet.

## Der schwerste Befund: eine Reise, die nie gelaufen ist

`scripts/reisen/run.sh` trennt Beschriftung und Befehl am **ersten**
Doppelpunkt. Eine der Beschriftungen hatte selbst einen:

    "Kern-Reise 4 (Geldweg: Angebot und Annahme):node scripts/reisen/reise4-angebot.cjs"

Der Befehl wurde damit zu `Angebot und Annahme):node scripts/...` und brach mit
einem Syntaxfehler ab. **Reise 4 ist seit ihrer Entstehung kein einziges Mal
gelaufen.** Die Zusammenfassung des Nachtlaufs nennt sie trotzdem als Teil der
Abdeckung des Geldwegs.

Am Ende meldete der Läufer `447 PASS, 0 FAIL` und `Exit 1`. Beide Zahlen
stimmten und beide waren irreführend: der Fehlschlag stand nur in einer Zeile
Syntaxfehler und in einem Rückgabewert, den niemand ansah.

Behoben: Trennzeichen ist jetzt `|` (kommt in keiner Beschriftung vor), und
vor jedem Aufruf wird geprüft, dass die Zieldatei überhaupt existiert. Ein
Befehl, der nicht startet, ist kein bestandener Test.

Nachgeholt: Reise 4 einzeln ausgeführt, 16 Zusicherungen, alle grün. Der
Inhalt war also in Ordnung; gelogen hat allein der Prüfstand.

**Das ist dieselbe Klasse wie alles andere in diesem Projekt, diesmal im
eigenen Werkzeug.** Ein Prüfstand braucht dieselbe Skepsis wie das Produkt.

## Der Geometrie-Prüfer sah die Auftragskarten des Betriebs nie

`/betrieb/auftraege` öffnet auf dem Reiter „Anfragen". Die Auftragskarten
liegen hinter den drei anderen Reitern, und der Prüfer tippte keinen davon an.
Der Stub lieferte ohnehin keine Verträge, also war die Liste leer.

Jetzt: Vorgabe-Verträge im Stub (mit einem absichtlich langen Kundennamen) und
ein drittes Feld in der Bildschirmliste, das nach dem Laden einen Reiter
antippt. **63 statt 54 Messungen.**

**Und ein Befund gegen mich selbst:** ich hatte dem Kundennamen vorher
`numberOfLines={1}` und `flexShrink: 1, minWidth: 0` gegeben, weil er in einer
`space-between`-Zeile neben einem Abzeichen steht. Gemessen bei 360 px mit dem
langen Namen: **es lief nichts über den Rand, auch ohne**. Der Name bricht um,
das Abzeichen bleibt im Rahmen. Die Mutation „Stil wieder entfernt" blieb grün.
Beides ist deshalb wieder raus. Was sich nicht belegen lässt, gehört nicht in
den Code, auch wenn es nach einer guten Vorsichtsmaßnahme aussieht.

## Zwei Befunde aus der Mutationsprobe selbst

Beide sind hier festgehalten statt weggelassen, weil sie die Klasse betreffen,
um die es in diesem Projekt geht:

- **Die Trigger-Bedingung „eine Antwort lässt sich nicht ändern" war
  unbelegt.** Für Angemeldete fängt die Policy denselben Fall schon ab. Erst
  BA10 über den `service_role`, der RLS umgeht und den Weg der Edge Functions
  nimmt, macht sie nachweisbar. Die Mutation war vorher vollständig grün.
- **Das `with check` der Update-Policy ist derzeit unerreichbar.** Die Mutation
  `with check (true)` blieb in der ganzen Suite grün. Es bleibt stehen, aber
  der Grund und die Grenze stehen in der Migration, damit es niemand für
  geprüft hält.

Dieselbe Klasse im Frontend: „Frist rundet ab statt auf" blieb grün, weil alle
Testfälle glatt aufgingen. Erst ein angebrochener Tag (6,5 vorbei, 7,5 übrig)
macht den Unterschied sichtbar.

## Was als Nächstes ansteht

1. **PIN beim Arbeitsbeginn** (aus dem Uber-Abgleich): sichtbare Sicherheit,
   belegter Arbeitsbeginn, zweites Umgehungssignal. Entwurf liegt fertig in
   `docs/produkt/start-pin-entwurf.md`, **nicht gebaut**. Die frühere
   Schätzung „eine Spalte, ein Bildschirm" ist dort ausdrücklich korrigiert:
   es braucht eine eigene Tabelle (der Betrieb darf die PIN nicht lesen),
   eine Versuchssperre (vierstellig ist sonst in Sekunden durchprobiert) und
   einen Vergleich auf dem Server. Vorher zu entscheiden: welche Folge es
   hat, wenn niemand die PIN einlöst. Hat sie eine, ist das eine Zusage und
   braucht einen Mechanismus.
2. Empfehlungen 7 und 8 aus `docs/markt/wettbewerbsabgleich-2026-09.md`
   (Umgehungsregel dem Kunden als Schutz erklären; erste drei Aufträge ohne
   Provision — das ist eine Founder-Entscheidung, keine technische).

---

# Stand 2026-09-16 (Nachtlauf) — der Geldweg ist erstmals durchgehend geprüft

**PR #203** auf `claude/session-handoff-docs-1qxv3d`, elf Blöcke. Jede
Korrektur mutationsgeprüft, jeder neue Prüfer zusätzlich mit Gegenproben.

## Der Satz, auf den es ankommt

Vor dieser Nacht stand in `scripts/reisen/README.md`: *„Ungeprüft und
ausdrücklich nicht behauptet: offene Aufträge sehen, Angebot abgeben, Annahme,
Vertrag aktiv, Escrow, Auszahlung. Das ist der halbe Marktplatz."*

Jetzt decken fünf neue Reisen (4 bis 8) diese Strecke ab, soweit sie ohne
Stripe und ohne nativen Build erreichbar ist: 60 Zusicherungen über Angebot,
Annahme, Vertrag, Zahlungsriegel, Abnahme, Reklamation, Prüf-Postfach, DSA-
Meldeweg und Widerruf.

## Was dabei gefunden wurde

| Befund | Kern |
|---|---|
| **Der Prototyp war live** | `werkr-prototype.html` wurde als `/demo` ausgeliefert und trug „Haftpflicht & Qualifikation beider Parteien verifiziert" — die Zusage, die am 14.09. aus der App flog. Dazu 24× die alte Marke. |
| **Zwei Datenschutzerklärungen** | `/datenschutz.html` (Stand Juni, 6 472 Zeichen) neben der App-Fassung (12 131). Im Streitfall gilt die, die der Betroffene erreicht hat. |
| **Der wichtigste Knopf war keiner** | „Angebot annehmen" hatte kein `accessibilityRole`, „Frage stellen" und „Ablehnen" daneben schon. 198 von 326 Berührflächen betroffen (WCAG 4.1.2). |
| **Negative Auszahlung** | Bei Preis 0 zeigte das Angebotsformular „Ihr Nettobetrag: −3,00 €" und ließ sich absenden; 0910 weist das in der Datenbank ab. |
| **Erstattungssatz eingefroren** | `/stornierung` las die Stunden aus einem gerundeten URL-Parameter, der Server rechnet live. Bei 48,4 h zeigte der Client 50 %, der Server erstattete 100 %. |
| **Freigabe verschwieg ihre Sperre** | Der Knopf hatte kein `disabled`, nur keinen Handler. Für eine Bedienungshilfe ein benutzbarer Knopf, der wortlos nichts tut. |
| **„Escrow" lebte in `lib/`** | Der Prüfer las nur `*.tsx`. Der Hinweis beim Tippen einer Telefonnummer sagte weiter „Escrow-Schutz". |
| **Die guten Regeln unsichtbar** | Sieben Zusagen (keine Lead-Gebühren, Treuhand, verifizierte Bewertungen, befristete Verstöße) standen in keinem Text. Jetzt `constants/regeln.ts`, jede mit Beleg im Code. |
| **Gebühr achtmal hingeschrieben** | Derselbe Satz „2,5 %" an acht Stellen, siebenmal als Literal. |
| **Leerer Zustand schwieg** | „Sie werden benachrichtigt" ohne Zahl und ohne Handlung. Jetzt die Tatsache aus 0920: wie viele Betriebe benachrichtigt wurden, und bei null die Wahrheit. |

## Neue Mechanismen (CI + `scripts/reisen/run.sh`)

| Prüfer | Fängt |
|---|---|
| `ausgelieferte-seiten-check.py` | Zusagen, alte Marke und Gedankenstriche in den ausgelieferten HTML-Dateien; zweite Fassungen von Pflichttexten. Liest die Dateiliste aus `static.yml`. |
| `verwaiste-seiten-check.py` | Bildschirme ohne jeden Eingang. |
| `regeln-beleg-check.py` | Jede Zusage in `constants/regeln.ts` braucht eine Stelle im Code, die sie durchsetzt, eindeutig und nicht im Kommentar. |
| `knopf-rolle-check.py` | Berührflächen mit `onPress` ohne `accessibilityRole`. |
| `ranking-check.py` (14.09.) | AGB §2 gegen den Code, in beide Richtungen. |

Erweitert: `versprechen-check.py` (Zeitzusagen, „geprüft" ohne Gegenstand),
`fachwort-check.py` (liest jetzt auch `lib/` und `constants/`),
`agb-code-check.py` (Stornostufen auch in der Edge Function).

## ⚖️ Offen beim Founder — unverändert, und einer ist dringend

**Dringend, weil es gerade passiert:** `/health` meldet `pruef_offen: 1,
pruef_stau: true`. Ein Betrieb wartet auf seine Freigabe, und niemand kann ihn
freigeben, weil `WERKANT_ADMIN_EMAILS` nicht gesetzt ist.

Ebenfalls offen: Stripe-Schlüssel (`stripe: false`), `RESEND_API_KEY` +
`WAITLIST_FROM_EMAIL` (`mail: false`), beide pg_cron-Läufe, Impressum mit
echten Daten (`LEGAL_PLACEHOLDER = true`, auf `/widerruf` sichtbar), die drei
Anwaltsfragen (ZAG, Reverse Charge, zwei Verträge unter einem Widerrufs-Haken),
BZSt-Registrierung und die PStTG-Schwelle.

## Was als Nächstes ansteht

1. **Ortsanker (PLZ).** Der Kunde erfährt jetzt, wie viele Betriebe in seinem
   Bereich benachrichtigt wurden. Was fehlt: dem Betrieb sagen, dass er nur
   Aufträge aus seinem zweistelligen PLZ-Bereich bekommt, und ihm erlauben,
   den Bereich zu weiten.
2. **PIN beim Arbeitsbeginn** (aus dem Uber-Abgleich): sichtbare Sicherheit,
   belegter Arbeitsbeginn, zweites Umgehungssignal. Empfohlen, nicht gebaut.
3. Empfehlungen 6 bis 8 aus `docs/markt/wettbewerbsabgleich-2026-09.md`.

## Die harte Grenze, die man kennen muss

`app/zahlung.tsx` bricht bei `Platform.OS === 'web'` ab. **Auf der Web-Fassung
kann niemand bezahlen, unabhängig von den Stripe-Schlüsseln.** Die Website ist
das Schaufenster, der Laden ist die App. Reise 5 hält das als Zusicherung fest.

---

# Stand 2026-09-14 — Rechts-Audit abgearbeitet, plus der Geldweg

**PR #200** auf `claude/session-handoff-docs-1qxv3d`, acht Blöcke. Alles
mutationsgeprüft: jede Korrektur hat eine Mutation, die rot färbt.

## Was in dieser Sitzung behoben wurde

| Befund | Kern |
|---|---|
| **Umsatzsteuer** | Beleg wies 9,52 % statt der zugesagten 8 % aus; `feeEngine` rechnete `× 19/100` statt `× 19/119`. § 14c Abs. 1 UStG: wer zu viel ausweist, schuldet den Mehrbetrag. |
| **Widerruf** | Der Haken sprach im Nachbarschafts-Track von einem „Handwerker" und von 14 Tagen Widerrufsrecht — beides gibt es dort nicht. „Verzicht" ersetzt durch die zwei Erklärungen aus § 356 Abs. 4 BGB. |
| **Meisterpflicht** | „Renovierung" verlangte nur den Gewerbeschein und bekam einen grünen Haken. Neues Pflichtfeld `abgrenzung` für jede B2B-Kategorie ohne Meisterbrief. |
| **Werbeaussagen** | Vier Sätze, die der eigene Code und die eigenen AGB widerlegen. |
| **Datenschutz** | Falsche Norm (JArbSchG), Expo fehlte als Empfänger, die automatisierte Strike-Entscheidung war verschwiegen (Art. 13 Abs. 2 lit. f / Art. 22 DSGVO). |
| **Geldweg** | „€840,00 wurden ausgezahlt" erreichte **keinen Web-Nutzer**: vier Functions mit eigenem `sendPush` und `if (!tokens.length) return;`. Zustellung jetzt an einer Stelle. |
| **Hochladen** | Spinner ohne Name, Größe, Abbruch oder Ende — auf dem Bildschirm, an dem ein Betrieb seinen Meisterbrief hergibt. |
| **Design** | Neun Folien bewertet, drei Muster angenommen, drei abgelehnt. `notes/04-Entscheidungen/Design-Karussell-9-Bilder-2026-09-14.md`. |

## ⚖️ Offen beim Founder — blockiert den Marktstart

1. **ZAG-Anwaltsfrage** (§ 63 ZAG, strafrechtlich). `docs/recht/ki-vo-und-bfsg.md` §4.
2. **Reverse Charge für deutsche Anbieter** — NEU am 14.09. `isBusinessUser`
   löst „§ 13b UStG" aus, ohne zwischen deutschen und sonstigen EU-Anbietern zu
   trennen. Betrifft praktisch jeden deutschen Handwerker mit Gewerbe, und die
   Richtung ist die gefährliche: zu wenig erklärte Steuer. Frage wörtlich
   ausformuliert in `docs/recht/rechts-audit-2026-09-13.md`.
3. **Zwei Verträge, ein Widerrufs-Haken** — Anwaltsfrage, ebenda.
4. **Impressum echte Daten** (`LEGAL_PLACEHOLDER = true`, „Musterstraße 1").
5. **Secrets**: Stripe (ohne sie gibt es KEINEN Geldweg), `RESEND_API_KEY`,
   `WAITLIST_FROM_EMAIL`. Ohne Mailversand greift auch der neue Rückfall nicht:
   `benachrichtigen` zählt dann `ohneWeg`, und niemand wird erreicht.
6. **Zwei pg_cron-Zeitpläne**, **BZSt-Registrierung**, **PStTG-Schwelle**,
   **Nachbarschaft/DRV-Status**.

## Als Nächstes im Code

- `__tests__/compliance.test.ts` bildet die geprüften Funktionen **selbst nach**
  (`isOver18`, `calcPlatformFee` …) und schreibt das im Kopf als Vorzug hin.
  Dieselbe Tautologie wie bei `rechnung-calc.test.ts`, das am 14.09. ersetzt
  wurde. `calcPlatformFee` dort beweist nichts über `lib/feeEngine.ts`.
- P2B-VO Art. 8 und 9 (Klauseln).
- Design A2 (Handlungsreihe im Anbieter-Profil) und A3 (Zahl exakt und groß,
  Grafik daneben) — nach den Rechtsbefunden.

---


# Stand 2026-08-21 — nachgemessen statt erinnert, und das Strike-Werkzeug

**Nach drei Wochen Pause.** Erste Handlung war nicht Weiterarbeiten, sondern
Nachmessen — der Kenntnisstand aus der letzten Sitzung war 28 PRs alt.

## Der Befund, auf den es ankommt

Der Health-Endpunkt der Produktionsinstanz, abgefragt am 21.08.2026:

```
{"ok":false,"mail":false,"mail_from":false,"stripe":false,"stripe_webhook":false,"db":true}
```

**Es ist nichts geschaltet.** Nicht nur der Mailweg fehlt — es liegt auch kein
Stripe-Schluessel vor, nicht einmal ein Test-Key. In der Produktion kann also
weder jemand mitmachen noch jemand zahlen. Das war mir so nicht bewusst: das
Vision-Dokument nannte seit dem 30.07. nur `RESEND_API_KEY` als Blocker und
fuehrte Stripe unter „Live-Keys setzen", was nahelegt, es gebe Test-Keys.

Der Engpass ist damit seit Wochen nicht der Code. Es sind drei Founder-Klicks
(Resend, Postfach, Stripe), und keine Menge lokaler Tests ersetzt den einen
Vorgang, den noch nie ein Mensch durchlaufen hat.

## Die Warteschlange war an zwei Stellen veraltet

- **Anbieter-Verfuegbarkeit** (Punkt 5 der Liste unten) ist seit #185 erledigt:
  Migration 0740 speichert die Stunden, `app/betrieb/kalender.tsx` schreibt sie,
  `app/chat.tsx` liest sie beim Terminvorschlag. Nicht erneut anfangen.
- **Q1–Q6 vom 29.07.** ist als Ganzes ueberholt. Massgeblich ist die Liste
  unter „Offen" in diesem Abschnitt.

## Gearbeitet: Werkzeug fuer Strikes von Hand (Migration 0750)

Punkt 6 der Liste unten. 0720 hatte alle vier AGB-Verstossgruende in der Spalte
`grund`, vergeben wurde automatisch aber nur einer. Beim Nachsehen, was ein
Strike von Hand tatsaechlich bewirkt, kamen drei Luecken heraus — jede laesst
den Vorgang aussehen wie erledigt:

| Luecke | Wirkung |
|---|---|
| `recompute_strike_count()` lief nur aus `apply_leak_strikes` | Strike von Hand → Sperre greift, angezeigter Zaehler bleibt auf 0 |
| CHECK verlangt 20 Zeichen — auf dem ZUSAMMENGESETZTEN Text | schuetzt faktisch nichts; „Verstoss." waere durchgegangen |
| Zustellung nirgends festgehalten | §7(4)/Art. 4 P2B-VO im Streitfall nicht nachweisbar |

Behoben durch: Trigger auf `provider_strikes` (der Zaehler folgt der Akte auf
JEDEM Weg), `strike_erteilen()` (setzt AGB-Grundwortlaut, Frist und
Beschwerdeweg selbst davor, verlangt 40 Zeichen Tatsachen), `strike_aufheben()`
fuer §7(5), `strike_zustellung_vermerken()` plus zwei Spalten fuer den
Nachweis. Alle drei Funktionen sind fuer `authenticated` ausdruecklich
gesperrt — ohne das koennte sich jeder Angemeldete selbst freistellen oder
einen Mitbewerber belegen (per Mutation nachgewiesen: die Funktion war ohne
`revoke` tatsaechlich ausfuehrbar).

Ablauf fuer den Founder: `docs/betrieb/strike-erteilen.md`.

**Ehrliche Grenze:** Werkant verschickt die Begruendung nicht. Ohne Mailweg und
ohne Postfach ist die Zustellung Handarbeit, und das Betriebs-Dashboard ist
kein dauerhafter Datentraeger im Sinne von Art. 4 P2B-VO. Deshalb der
Zustellvermerk — er macht sichtbar, welche Massnahmen formal unvollstaendig
sind.

## Gegenprobe: vier Mutationen, vier Mal rot

Nach der Hausregel („ein gruener Haken zaehlt erst, wenn eine Mutation belegt,
dass er rot werden kann"):

| Mutation | Ergebnis |
|---|---|
| Zaehler-Nachfuehrung im Trigger entfernt | V6 rot (Zaehler blieb 0) |
| Tatsachen-Schwelle 40 → 20 (so scharf wie der CHECK) | V1 rot |
| `revoke` auf `strike_erteilen` entfernt | V10 rot — Aufruf gelang |
| Verfallsdatum im Text getrennt gerechnet (6 statt 12 Monate) | V5 rot |

Der V1-Testtext wurde dafuer eigens auf 28 Zeichen gesetzt: zwischen den 20 des
CHECKs und den 40 des Werkzeugs, sonst koennte der Test nicht unterscheiden,
welche der beiden Schranken gegriffen hat.

**Grenze von V5, damit ihm niemand zu viel zutraut:** er faellt bei einer
abweichenden FRIST, nicht bei zweimaliger Berechnung desselben Ausdrucks —
`now()` ist innerhalb einer Transaktion fest, beide Werte waeren zufaellig
gleich. Dass beide aus einer Variablen kommen, ist eine Quelltext-Frage.

Stand: DB-Test **166** Assertions (20 Dateien), Jest **389**, tsc 0.

## Offen, in dieser Reihenfolge

**Founder — blockiert alles andere:**
1. `RESEND_API_KEY` + `WAITLIST_FROM_EMAIL` + Site-URL (`docs/ops/RESEND-MAIL-GATE.md`).
2. Postfach `kontakt@werkant.de` (`docs/betrieb/postfaecher-einrichten.md`).
3. Stripe-Keys, mindestens Test (`docs/release/LIVE_CUTOVER_RUNBOOK.md`).
4. Entscheidungen: Gegenangebot ja/nein · `support@` oder `kontakt@` als
   sichtbarer Name · `offers`-Policy gegen `kyc_status`.
5. [ANWALT] Widerrufs-Klausel — `notes/04-Entscheidungen/2026-08-16-widerruf-klausel.md`.

**Danach, und nur danach sinnvoll:** der erste vollstaendige Vorgang live —
Auftrag, Angebot, Annahme, Einzahlung, Freigabe. Nach den Standing Test Rules
mit genau einem `claude-diag-`-Konto, im selben Arbeitsschritt wieder entfernt.

**Ohne Founder-Klick machbar:**
- Nebenlaeufigkeit echt testen (`dblink`) — die Idempotenz-Tests laufen
  sequenziell und beweisen kein Verhalten bei gleichzeitigen Webhooks.
- Quartalswerte nach § 15 PStTG (gemeldet wird bisher nur die Jahressumme).
- Loeschfrist fuer die Betrugsvermerke aus 0640 (stehen unbefristet am Vertrag).
- Erstattete Vertraege in den Screens kennzeichnen (in der DB vollstaendig
  erfasst, in der Oberflaeche sieht ein erstatteter Vertrag aus wie ein sauberer).
- Werkzeug fuer die uebrigen Verstossgruende in der Oberflaeche statt im
  SQL-Editor — erst sinnvoll, wenn es mehr als eine Handvoll Faelle gibt.

---

# Stand 2026-08-16 (vormittags) — Strikes: Code widersprach den AGB (PR #181)

**PR #180 ist gemergt.** Danach: `claude/strikes-nach-agb` → **PR #181**.

Anlass war die Founder-Frage "wie macht Airbnb das mit Strikes?". Die
Recherche ergab, dass Airbnb **keine Zahl veroeffentlicht** ("repeated or
severe violations"). Uebertragen liess sich davon wenig — der Vergleich hat
stattdessen aufgedeckt, dass **der Code den eigenen AGB widersprach**:

| AGB §7 | Code bis 16.08. |
|---|---|
| (3) 3 Strikes **innerhalb von 12 Monaten** | zaehlte ueber die gesamte Kontodauer, `greatest()` liess Strikes nie sinken |
| (4) Begruendung (Art. 4 P2B-VO (EU) 2019/1150) | speicherte einen Integer — daraus laesst sich keine erzeugen |
| (2) vier Verstossgruende | automatisch nur einer |

Migration **0720** `provider_strikes`: Akte je Strike mit Anlass, Begruendung,
Verfallsdatum, Aufhebung. Sperre prueft `aktive_strikes()` statt der Spalte
(ein Strike verfaellt durch Zeitablauf — dabei schreibt niemand).
`strike_count` ist nur noch abgeleitet und wird per Trigger ueberschrieben.

**Bewusst NICHT von Airbnb uebernommen:** die Intransparenz. Die
veroeffentlichte Schwelle bleibt — §307 Abs. 1 S. 2 BGB spricht dafuer, und
eine konkrete Zahl ist ueberpruefbar (genau daran ist der Widerspruch
aufgefallen). Begruendung in
`notes/04-Entscheidungen/2026-08-16-strikes-airbnb-vergleich.md`.

**Der Anrede-Pruefer hatte eine sechste Luecke:** er sah `lib/` und
`contexts/` gar nicht an, und nur `*.tsx`. Fuenf Duz-Stellen standen dort,
darunter die Meldung an einen GESPERRTEN Anbieter. Jetzt vier Verzeichnisse,
`*.ts` und `*.tsx`.

Stand: DB-Test **139** Assertions, Jest **385**, Browser 7/7, Anrede 0.

## Offen, unveraendert in dieser Reihenfolge

1. **`RESEND_API_KEY`** — groesster Punkt. Ohne ihn keine Registrierung, und
   jetzt zusaetzlich: die Strike-Begruendung kann nicht per E-Mail zugehen,
   was AGB §7(4)/Art. 4 P2B-VO aber verlangt (dauerhafter Datentraeger; ein
   Dashboard ist keiner).
2. **[ANWALT] Widerrufs-Klausel** — `notes/04-Entscheidungen/2026-08-16-widerruf-klausel.md`.
3. **Founder: Gegenangebot** ja/nein.
4. **Founder: support@ vs kontakt@** — im Produkt gemischt (11x/5x). Welche
   Postfaecher real existieren, weiss ich nicht.
5. ~~**Anbieter-Verfuegbarkeit** wird weiterhin nicht gespeichert.~~ ERLEDIGT mit #185 (Migration 0740).
6. ~~**Die drei anderen AGB-Verstossgruende** haben eine Spalte, aber kein
   Werkzeug zum Ausloesen.~~ ERLEDIGT mit Migration 0750, siehe oben.

---

# Stand 2026-08-16 — sieben Geraete-Befunde des Founders (PR #180)

**Branch:** `claude/adresse-erheben` · **PR #180**, sieben Bloecke.
Vorher gemergt: **#179** (Rand-Ueberstand, `min-width: auto`).

## Der rote Faden dieser Sitzung

Jeder der sieben Befunde hatte eine gruene Pruefung, die nichts geprueft hat.
Das ist die eigentliche Lehre, nicht die einzelnen Fehler:

| Befund | Was gruen meldete | Was tatsaechlich war |
|---|---|---|
| Adresse fehlte | `tsc` gruen | `addressStreet` war OPTIONAL — Weglassen war kein Fehler |
| Kalender nur eine Woche | Browser-Lauf gruen | Bildschirm ist rollen-gesperrt, wurde nie erreicht |
| Zeitzonen-Fehler | Jest gruen | Jest lief in UTC, Fehler existiert nur ausserhalb |
| Anrede uneinheitlich | Pruefer meldete 0 | sah nur ~1/3 des sichtbaren Texts |
| Widerrufs-Policy | alle Tests gruen | zwei Bedingungen deckten dieselben Faelle |
| Stornotext | niemand prueft Text | Text war unvollstaendig ZULASTEN des Kunden |
| Melden fehlte | Strike-Weg existiert | haengt am Geraet des Taeters |

**Arbeitsregel daraus:** ein gruener Haken zaehlt erst, wenn eine Mutation
belegt, dass er rot werden KANN — und zwar fuer jede Form, in der der Fehler
auftreten kann.

## Was jetzt anders ist

- `jest.config.js` setzt **TZ=Europe/Berlin**. Ohne das verschwinden
  Datumsfehler, die nur ausserhalb von UTC auftreten — also alle echten.
- `scripts/anrede-check.py` liest jetzt auch JSX-Textknoten, kurze
  Zeichenketten, Imperative ohne Pronomen und umgebrochene Prosa.
- `scripts/db-test/run.sh`: **130 Assertions** (vorher 115), neu
  `chat-reports` und `widerruf-consent`.
- Neue Migrationen: **0700** `chat_reports`, **0710** `widerruf_consents`.
- Neue reine Module: `lib/kalenderWoche.ts`, `lib/chatReport.ts`,
  `lib/widerruf.ts` — ausgelagert, damit das Pruefbare pruefbar ist.

## Offen, in dieser Reihenfolge

1. **`RESEND_API_KEY`** — unveraendert der groesste Punkt. Ohne ihn kann sich
   niemand registrieren, und die halbe Marktplatz-Strecke (Angebot → Annahme →
   Vertrag → Escrow → Auszahlung) bleibt ungetestet. Founder-Klick, kein Code.
2. **[ANWALT] Widerrufs-Klausel** — siehe
   `notes/04-Entscheidungen/2026-08-16-widerruf-klausel.md`. Der NACHWEIS
   laeuft jetzt; ob die Klausel inhaltlich richtig ist, ist offen.
3. **Founder-Entscheidung Gegenangebot** — Produktentscheidung, keine
   Fehlerbehebung.
4. **Anbieter-Verfuegbarkeit wird nicht gespeichert.** Der Kalender kann
   blaettern, aber Frei/Gesperrt ueberlebt nur die Sitzung. Es gibt keine
   Tabelle dafuer; "Urlaub eintragen" sagt selbst, dass es fehlt.
5. **Kunden-Strikes?** Bisher tragen nur Anbieter `strike_count`. Ob Kunden
   ebenfalls sanktioniert werden sollen, ist unentschieden.

## Bewusst NICHT gebaut (mit Begruendung, nicht vergessen)

- **Systemnachricht "Strike 1" im Chat.** Der Thread gehoert beiden. Dem
  Kunden anzuzeigen, dass sein Handwerker einen Strike hat, waere eine
  Rufschaedigung durch die Plattform — auf Grundlage eines Regex-Treffers.
  Der Anbieter sieht seinen Stand im eigenen Dashboard.
- **Auto-Strike aus einer Meldung.** Eine Meldung ist frei ausloesbar; drei
  wuerden genuegen, um einen Anbieter aus dem Markt zu nehmen.

---

# Session-Handoff (Stand 2026-07-13, abends)

## Infra-Erkenntnisse heute (WICHTIG für alle künftigen Sessions)
- Supabase-GitHub-Integration aktiv: wendet Migrationen aus supabase/migrations
  bei Push auf main AUTOMATISCH an und deployt Edge Functions — aber NUR
  Functions, die in supabase/config.toml deklariert sind (alle 10 jetzt drin).
  Kein manuelles SQL/Dashboard-Deploy mehr noetig!
- Geld-Fluss + Registrierung waren mehrfach kaputt und sind repariert
  (PR #41 accept_offer, #42 Verifikations-Gate, #45 Schema-Grants nach
  drop-schema-Reset + Erst-Deploy aller Functions, #46 Autoconfirm-Gate-Loch).
- Verifikation: eigenes DOI via verify-email Function (Resend);
  Gate = profiles.email_verified_at, DB-erzwungen (0400/0430).
- OFFEN: RESEND_API_KEY als Edge-Function-Secret (Founder, resend.com) —
  bis dahin gehen keine Bestaetigungs-/Wartelisten-Mails raus.


## Zuletzt geliefert (alles gemerged + live)
- 14.07.: Deutschlandweit frei (PR #48). Anbieter-Lead-Flow geschlossen:
  Dashboard zeigt jetzt offene Auftraege ("Neue Auftraege" -> Angebot
  abgeben) statt eigene Angebote als Fake-"Anfragen"; eigene Angebote als
  "Deine offenen Angebote" mit Zurueckziehen. Suche: Skeleton statt Spinner.
  zahlung.tsx ohne contractId sauber abgefangen.
- PR #38: Grouped-Settings-Stil auf Einstellungen + Anbieter-Dashboard
  (Kennzahlen-2er-Raster, gruppierte „Heute geplant"-Liste, Reveal-Staffelung;
  Konto-Tab-Referenz 248a362 war schon in main). tsc 0 · Jest 337/337 ·
  Playwright-verifiziert.
- Hinweis Founder „Motions nicht sichtbar": Reveal respektiert iOS
  „Bewegung reduzieren" — Einstellung prüfen, bevor wir Motion debuggen.
- PR #33/#34/#35/#36: Login-Fix (Backfill 0380 + Selbstheilung), Motion-Layer
  (Reveal), ProgressRing (Auftragsstatus), Gewerke-Katalog 13 + Progressive
  Disclosure, NB-Freitextfeld, Anbieter-Warteliste (statt totem KYC-Funnel),
  illustrierte Empty States (EmptyStateArt), totes app/nachrichten.tsx-Duplikat
  gelöscht, Security-Checkliste, 7 Betriebs-Playbooks, CLAUDE.md −51 %.
- Deploys #34/#35 im Live-Bundle verifiziert; #36 gemerged (Deploy-Pipeline
  lief heute 3/3 — nicht erneut pollen, Founder lädt App einfach neu).

## Offen (nächste Session)
1. Founder-Feedback vom iPhone-Test einsammeln (Warteliste, Ring, Empty States).
2. Login-Test alter Account: Fehlermeldung nennt jetzt echten Grund in Klammern.
3. Security-Dashboard-Klicks des Founders (GO-LIVE-SECURITY-CHECKLIST.md 1–4).
4. Optional als Nächstes: Motion auf Auftrag-Wizard; Skeleton statt Spinner in
   suche.tsx; Wochen-Briefing-Routine (Founder hat noch nicht ja gesagt).
5. Transaktionaler Kern (Angebot→Vertrag→Zahlung) weiterhin ungetestet live.

## Token-Disziplin (Founder: Budget knapp!)
- Kurze Antworten, keine Re-Reads (82 % der Read-Verschwendung), Fixes bündeln,
  EIN Verifikations-Pass pro Feature, Deploy nicht pollen wenn Pipeline grün.

## Update 2026-07-16 (branch claude/grouped-settings-style-xpvyu6, noch offen)
- Zugeschnittenes Werkant-Team als statische Agenten angelegt:
  `.claude/agents/werkant--*.md` (CTO, Director Software/Solution Architect,
  Senior Test Expert, Director UI/UX, Sales, Marketing, CCO, CFO, Principal
  Senior Project Manager). Bewusst statisch = token-sparsam + reset-fest.
  Entscheidung: `notes/04-Entscheidungen/Werkant-Agenten-Team.md`.
- Gast-Reise-Fix: Wizard-Entwurf wird vor der Anmeldung in AsyncStorage
  (`werkr_job_draft_v1`) gesichert und beim nächsten Öffnen wiederhergestellt
  (Toast), dann gelöscht. Behebt „danach muss ich alles neu angeben".
- Touch-Targets: auftrag-detail Quick-Action-Bar (Vertrag/Problem/Bezahlen/
  Abschließen) von ~40px auf minHeight 48 (BFSG/WCAG 2.5.5) — „Kacheln zu klein".
- tsc 0 Fehler. OFFEN: PR öffnen/mergen für diesen Branch; nächste Sequenz laut
  Principal PM: Reise-2 (Anbieter→Angebot) + Reise-3 (Rollenwechsel) End-to-End.

## Update 2026-07-16 (abends) — Robustheits-Runde solo, alles gemergt
- PR #67: Werkant-Agenten-Team (`.claude/agents/werkant--*.md`) + Gast-Entwurf
  (`werkr_job_draft_v1`, sichern vor Login/wiederherstellen) + Tap-Targets
  auftrag-detail (minHeight 48).
- PR #68: Reise 3 — „Zum Anbieter-Bereich wechseln" nur noch für
  `role === 'provider'` (reiner Kunde landete sonst im Provider-Dashboard →
  „vermischt sich mit den Handwerker").
- PR #69: Crash-Klasse — 5 Screen-`.single()` → `.maybeSingle()`
  (dashboard/angebot/profil/chat×2), damit fehlende Zeilen (verwaistes Konto,
  fehlende Anbieter-Meta, Chat vor Vertrag) nicht die ganze Ladung abbrechen.
- Geprüft ohne Fix nötig: Reise 2 (accept_offer 2-arg intakt) + Geld-Pfad-
  Screens haben alle finally/Timeout-Guards (kein Endlos-Spinner).
- Merges: mache ich ab jetzt SELBST (Founder-Anweisung 16.07.), squash → main.
- OFFEN = nur noch Founder-Inputs fürs Go-Live-Gate: echte Impressum-Daten
  (`constants/legal.ts` LEGAL_PLACEHOLDER), `RESEND_API_KEY`-Secret, Stripe-Live.

## Update 2026-07-16 (nachts) — Robustheits-Sweep solo, alles gemergt (#72–#78)
Systematische Härtung gegen die „App ist fehleranfällig"-Klassen:
- **#72/#73**: Gast-Reise komplett — Entwurf überlebt Login UND leitet zurück
  in den Wizard (inkl. Nachbarschafts-Track); Unit-Test `__tests__/jobDraft.test.ts`.
- **#74**: Anbieter-Fake-Erfolg — „Angebot gesendet" ohne echtes Angebot behoben.
- **#75**: Escrow-Freigabe ohne Vertrag klar abgefangen (Guard wie zahlung/storno).
- **#76**: profil-bearbeiten (Profil-Überschreibgefahr) + bewertung Rejection.
- **#77**: nachrichten + meine-anbieter — Ladefehler nicht mehr als „leer" getarnt.
- **#78**: rechnung + zahlungsmethoden — dito.
- **Geprüft ohne Fund** (bewusst nichts geändert): Geld-/Zustands-Kette (8 Handler
  melden Erfolg nur nach echter Operation), Geld-Pfad-Spinner (finally/Timeout),
  `.single`→`maybeSingle` (#69), `.toFixed` (alle `?? 0`), Design-Tokens, Legal-Gate.
- **Merges macht die KI jetzt selbst** (Founder-Anweisung), squash → main.
- **OFFEN = nur Founder-Inputs** (Go-Live-Runbook in GO-LIVE-SECURITY-CHECKLIST.md):
  Impressum-Daten (`constants/legal.ts`), `RESEND_API_KEY`, Stripe-Live.
- **Nächste sinnvolle Blöcke**: (a) Premium-Landing NACH Go-Live (Founder-Wunsch,
  in Werkant-Marke, nicht Kino-Luxus); (b) echter E2E-Lauf statt Static-Audit,
  wenn Budget da ist.

## Smoke-Test-Werkzeug (reset-fest, seit 17.07.)
`scripts/smoke.cjs` — besucht 12 Kern-Routen im Headless-Chromium und sammelt
uncaught Exceptions/console.error (Netzwerk-Fehler gefiltert, Sandbox hat kein
Supabase). VOR jedem größeren Merge fahren:
1. `npx expo export --platform web`
2. `python3 <scratchpad>/spa-server2.py` (dist/ auf :8745; Script ggf. neu anlegen)
3. `cd <scratchpad>` (playwright-core liegt dort in node_modules) →
   `node /home/user/Ruflo/scripts/smoke.cjs` — Erwartung: „ALLE ROUTEN SAUBER".
Stand 17.07.: alle 12 Routen sauber; Build + tsc + Jest 342/342 ebenfalls grün.

## Update 2026-07-17 — Autonom-Loop aktiv
- Routine „Werkant Autonom-Loop" (alle 3h, trig_01N5QntdavznGj7jRej15KS7) weckt
  diese Session und arbeitet je EINEN Block ab (Fix + Verify + Commit/Push).
  Geweckte Läufe haben evtl. keine GitHub-PR-Tools → Commits landen auf dem
  Branch, Abschnitt „Bereit zum Merge" hier listet Offenes; nächstes volles
  Fenster merged. Stoppen: Founder sagt „Loop stoppen" (delete_trigger).
- Smoke-Test erweitert: scripts/smoke.cjs prüft jetzt 28 Routen (alle Gast-
  Flows + Detail-Screens ohne Pflicht-Param). Stand: ALLE ROUTEN SAUBER.
  Ausführung: Server+Test im SELBEN Bash-Call (Hintergrundprozesse sterben
  zwischen Calls); pkill immer als eigener Call (Exit 144 = gutartig).

## Update 2026-07-17 (nachmittags) — Device-Befunde + Tester-Agent-Runde, alles gemerged
- #88: 3 Founder-Befunde (stale Aufträge-Tab → useFocusEffect; Meisterpflicht-
  Badge nur noch als Banner nach Auswahl; Reveal 420→300ms + Delays komprimiert).
- #89/#90: Stale-Tab-Klasse 5/5 komplett (nachrichten, home, dashboard,
  provider-auftraege, kalender). Kalender dabei idempotent umgebaut + echten
  Wochen-Mapping-Bug gefixt (Termin nächster Woche erschien diese Woche).
- #91: Senior-Test-Expert-Interaktionslauf (7/7 PASS, 0 JS-Fehler; frühere
  Founder-Schmerzpunkte verifiziert sauber). Seine 3 Befunde gefixt:
  safeBack() in lib/nav.ts (toter Zurück-Pfeil bei Cold-Deep-Links, Sweep über
  36 Screens), Switch-thumbColor C.surface, Filter-Drawer slide→fade.
- Arbeitsmuster ab jetzt: Tester-Agent-Interaktionslauf VOR größeren Merges
  (Szenarien-Skripte: Scratchpad journey*.cjs; Harness-Regeln siehe oben).
- OFFEN (Code): NUR noch F6 P2B-AGB (Anwalt); native EAS-Builds nach Go-Live.
  F8 erledigt (#94). Security-Re-Audit 10/10 Functions (#96). Smoke-Vollabdeckung
  41/41 Routen (#97). KEINE offenen Code-Blöcke — Loop-Läufe sollen bei diesem
  Stand mit 1-Zeilen-Status enden statt Arbeit zu suchen. OFFEN (Founder): Impressum-Daten, RESEND_API_KEY, Stripe live.

## Update 2026-07-17 (abends) — CI + F8 + Sales-Kit + Learn
- #93 CI-Workflow live (tsc+jest je PR/Push, erster main-Lauf grün 1:57 Min).
- #94: F8 Datenschutz (Art. 13 Abs. 2 lit. e) → 7/8 CCO-Befunde fertig (nur F6
  P2B beim Anwalt); Köln-Akquise-Startpaket docs/sales/ (Director-Sales-Agent,
  §7-UWG-konform, Gebühren gegen feeEngine verifiziert) — dem Founder als Datei
  zugestellt.
- headroom learn gelaufen → Git/PR-Disziplin-Learnings in CLAUDE.md (PR-Bündelung
  statt PR-pro-Fix, auch für Loop-Läufe verbindlich).

## Update 2026-07-18 — Migrations-Replay verifiziert (lokal, 47 Migrationen)
- **Fresh-Replay = was Supabase in Produktion macht: SAUBER** (alle 47 in Reihe,
  lokaler PG16 + auth/storage/realtime-Stubs). Ein neues Environment / ein Reset
  würde korrekt deployen.
- **Idempotenz (2. Lauf):** die JUNGEN Migrationen (0400/0410/0440 mit
  `drop policy if exists`, 0390/0430/0450 mit `create or replace`) sind alle
  idempotent. Nur die Ur-Schema-Dateien (0010 ff.) haben keine drop-Guards vor
  `create policy` — kein neuer Bug, bereits live angewandt, NICHT nachträglich
  editieren (Supabase re-runt angewandte Migrationen ohnehin nicht).
- Harness reset-fest: `/tmp/auth_stub.sql` (auth.uid/role/jwt/email, storage.*,
  supabase_realtime-Publication, pgcrypto) + Migrations nach /tmp kopieren
  (postgres-User kommt nicht in den Repo-Pfad), dann 2× durchlaufen.

## Update 2026-07-18 (spät) — Money-Core-Integrationstest gegen echtes Postgres
- Reproduzierbare Harness: `scripts/db-test/run.sh` (+ auth_stub.sql, money-core.sql).
  Replayt alle Migrationen + testet accept_offer gegen lokales PG16.
- Verifiziert (beide PASS): Gebühren-Mathematik (100€ → Kommission 8, Service 2,50,
  Total 102,50, Auszahlung 92 = feeEngine.ts), BEIDE Vertragssignaturen gesetzt,
  Konkurrenz-Angebot auto-declined, Job→active, UND Impersonation blockiert
  (Fremder kann fremden Auftrag nicht annehmen → 'Not the job owner').
- Damit ist der Geld-Kern nicht nur per Unit-Test (feeEngine), sondern gegen eine
  echte DB end-to-end abgesichert — die Prüfung, die vorher „nur am Live-System".

## Update 2026-07-18 — RLS-Datenisolation gegen echtes Postgres verifiziert
- scripts/db-test/rls-isolation.sql (in run.sh): prüft unter echter
  authenticated-Rolle (RLS aktiv), dass Kunde A den Job von Kunde B NICHT sieht
  und Kunde B den Vertrag von A NICHT sieht. Beide PASS.
- Damit ist der OWASP-#1-Kern (Broken Access Control) nicht nur per Policy-Text,
  sondern gegen eine echte DB abgesichert. Voller Lauf: bash scripts/db-test/run.sh
  → Money-Core (2 PASS) + RLS-Isolation (2 PASS).

## Update 2026-07-18 — Offer-Lifecycle + E-Mail-Gate DB-getestet
- scripts/db-test/offer-lifecycle.sql (in run.sh): E-Mail-Gate (unbestätigter
  Nutzer kann KEINEN Job anlegen, bestätigter schon) + decline_offer (Owner ja,
  Fremder 'Not the job owner'). Alle PASS.
- Voller Lauf `bash scripts/db-test/run.sh` = 8 Assertions PASS (Money-Core 2,
  RLS 2, Lifecycle 4). Der E-Mail-Gate-Test beweist konkret, warum
  RESEND_API_KEY der echte Registrierungs-Blocker ist.

## Update 2026-07-19 — Deep-Scan-Session (C-Level-Swarm-Auftrag)
- **Fix Push-Abmeldung (Blindspot real):** Einstellungs-Toggle war rein lokal —
  `profiles.push_token` blieb gesetzt, send-push sendete weiter. Jetzt:
  `unregisterPushToken()` nullt Token serverseitig; `registerPushToken()` prüft
  Opt-out zentral (App-Start/Sign-in re-registrieren nicht mehr ungewollt).
  Dateien: `lib/notifications.ts`, `app/einstellungen.tsx`. tsc 0, Jest 347/347.
- **Branch-Archiv:** 7 alte `claude/*`-Branches nach
  `archive/legacy-2026-07-19/…` kopiert (Inventar: `docs/BRANCHES.md`).
  Originale ließen sich nicht löschen (Git-Proxy blockt Deletes) — Kosmetik,
  Founder kann via GitHub-UI aufräumen.
- **Open Design geprüft:** Werkant-DESIGN.md ist bereits Open-Design-konform;
  kein Umbau (Entscheidung: `notes/04-Entscheidungen/Open-Design-Analyse-2026-07-19.md`).
- **Platzhalter-Index:** `docs/todo/OFFENE-FOUNDER-TODOS.md` (Stripe-Live,
  Stores, Gewerbe, RESEND, Impressum — alles Verweise auf bestehende Docs).
- **Coverage-Messung:** lib/ ~20 % Zeilen → Risk-Accept (Geld-Kern+RLS
  DB-getestet, Smoke 41/41; UI-Fläche bewusst ungezählt).
- Blindspot-Status: Doppelbuchung (for update ✓), GDPR-Löschung ✓,
  Brute-Force (RateLimit ✓), Storno ✓, Bewertungs-Löschung: kein Self-Service
  (bewusst, §Bewertungsintegrität), Offline-Modus: nur Fehlerzustände (P2),
  Dark Mode: nicht vorhanden (bewusste Markenentscheidung, P2-Kandidat).

## Update 2026-07-19 (2. Lauf) — 8 Screenshot-Bugs gefixt (Bugfix & Polish)
- **Stack-Reset-Klasse (Bugs 1+7):** `resetTo()` in lib/nav.ts (dismissAll+
  replace). Ursache „Zurück landet auf Schritt 4": alte Wizard-Instanz blieb
  unter Login/Success im Stack. Angewandt: Wizard-Success-Buttons,
  login.tsx (Passwort- UND OAuth-Pfad), registrierung.tsx. safeBack hat
  jetzt Fallback-Param (auftrag-detail → /(tabs)/auftraege).
- **OAuth (Bug 4):** signInWithProvider (Web-Redirect-Flow, supabase-js
  detectSessionInUrl); Login-Screen: Rücksprung-Weiterleitung + error_description-
  Anzeige + Abbruch graceful. Native zeigt klare Ansage bis EAS-Build.
  OFFEN (Founder): Provider im Supabase-Dashboard aktivieren (TODO-Doc).
- **Home (Bugs 3+5+6):** „Deine Aufträge"-Sektion (Airbnb Your Trips,
  horizontal, Status-Badges) direkt nach Hero; „Top bewertet" von unten nach
  oben verschoben (horizontal scrollbar); Kategorie-Kacheln 3→2 Spalten,
  minHeight 88, Gap 16, Icon 44 (Touch-Targets). Skeletons statt Spinner.
- **Fehler-States (Bugs 2+8):** auftraege.tsx + nachrichten.tsx zeigen bei
  leerem Erststand echten Fehler-Screen mit „Erneut versuchen"-Button statt
  Toast/getarntem Empty-State.
- **Bewusst NICHT gebaut:** Tab-Badge „ungelesene Nachrichten" — messages hat
  kein read_at (bräuchte Migration+RLS) → P1-Kandidat, kein Bugfix.
- tsc 0 · Jest 347/347. Smoke/Screenshot-Verifizierung siehe Commit.

## Update 2026-07-19 (3. Lauf) — v2-Runde: 12-Bug-Liste des C-Level-Swarms
Bugs 1–4/10 waren schon mit PR #110 live (nicht doppelt gefixt). Neu:
- **Top bewertet zurück unter Trust-Strip** (Founder-Revert der v1-Position),
  bleibt horizontal; Kacheln jetzt 2-spaltig minHeight 100/Gap 20/Text 15.
- **BUG 12:** Migration 0460 (jobs UPDATE-Policy für Owner bei status=open +
  cancel_reason); lib/jobs updateOpenJob/cancelOpenJob; auftrag-detail:
  Bearbeiten-Modal (Titel/Beschreibung) + Storno-Dialog mit Grund,
  Anbieter mit Angeboten bekommen Push. DB-Replay 2× grün.
- **Anbieter-Funnel (6/7/8):** Warteliste raus aus dem Hauptflow — Gast
  „Ich biete Hilfe an" → registrierung?role=anbieter → nach Signup direkt
  onboarding-kyc (Dokumente/Gewerk/Preis → Prüf-Queue). Registrierung hat
  Rollen-Auswahl (Kunde/Anbieter/beides, Checkbox-Cards) in Schritt 3.
  Login-Tabs „Als Kunde/Anbieter" entfernt (EIN Login, Rolle aus Profil).
  Chips → Auswahl-Kacheln mit Icon+Checkbox (KYC-NB-Skills, Warteliste).
- **BUG 9:** Edge Function notify-matching-providers (Owner-Check, RateLimit
  10/h user + 20/h IP, strikte Validation, Push via Expo + Mail via Resend
  wenn Key gesetzt; Matching = category_id ∩ category_ids + PLZ-Präfix(2)).
  createJob persistiert jetzt category_id; Aufruf fire-and-forget nach
  Submit. Provider-Tab-Badge „Aufträge" zählt offene passende Aufträge ohne
  eigenes Angebot (Realtime auf jobs/offers-INSERT). Access-Matrix-Zeile neu.
- Verifiziert: tsc 0 · Jest 347/347 · db-test 8/8 · deno check neue Function.

## Update 2026-07-19 (4. Lauf, spät) — B1/B2-WURZELN gefunden + 6 P0-Bugs
- **B1 „Aufträge konnten nicht geladen werden" (endlich reproduziert, via
  Test-User gegen Produktion): PGRST200** — alle Embeds
  `provider_profiles!provider_id` (contracts/offers) scheiterten, weil der
  FK nur auf profiles zeigt. Betroffen: Kunden-Aufträge-Tab, Home „Zuletzt
  gebucht", Nachrichten, Benachrichtigungen, meine-anbieter, Vertrags-Detail.
  Fix: **Migration 0470** — zusätzliche FKs (NOT VALID) auf
  provider_profiles + `notify pgrst, 'reload schema'`.
- **B2 „Anbieter sieht keine Aufträge":** Browse-Policy verlangte
  auth_email_confirmed(), aber ohne RESEND_API_KEY kann sich NIEMAND
  bestätigen → alle Anbieter sahen 0 Aufträge. 0470 nimmt das Gate nur
  vom LESEN offener Aufträge; alle Schreibwege bleiben gated (db-test 8/8).
- **B5 „Konto löschen nicht klickbar":** einstellungen.tsx nutzte natives
  Alert.alert = No-op im Web → showAlert. B3: Storno „Anderer Grund" mit
  Freitext-Modal. B4: Steuer-Tab ausgeblendet (href:null) — PStTG-Backend
  bleibt (gesetzliche Meldepflicht, Compliance-Entscheid). B6/Chips:
  Leistungen ((provider)/profil) + Hauptkategorie (profil-bearbeiten) auf
  Checkbox-/Radio-Kacheln umgestellt.
- **Rebrand-Forderung des Swarm-Prompts (kein Grün, neue Fonts) ABGELEHNT**
  — notes/04-Entscheidungen/Kein-Rebrand-trotz-Swarm-Prompt-2026-07-19.md.
  Dark Mode als P2-Vorschlag an Founder.
- NACH Merge prüfen: Test-User-Curl gegen contracts-Embed muss 200 liefern
  (Schema-Cache-Reload). Founder-Test: Aufträge-Tab lädt, Anbieter-Dashboard
  zeigt offene Aufträge.

## Update 2026-07-20 — Founder im Urlaub, Design wartet auf A/B/C
- Founder-Anweisungen: autonom weiterarbeiten, Design entscheidet ER (A/B/C-
  Vorlage zugestellt, s. notes/04-Entscheidungen/OFFEN-Design-Variante-A-B-C.md),
  Tokens sparen, headroom learn am Ende.
- Erledigt: Steuer-Screen komplett entfernt (UI; PStTG-Backend bleibt,
  Compliance), assets/categories/-Fallback-Struktur + docs/design/ASSETS-TODO.md
  (13 Bild-Prompts für Founder).
- NÄCHSTER LAUF: Auf Founder-Antwort A/B/C warten → dann Token-Swap-Block.

## Update 2026-07-20 — Design C + systematischer Screen-Audit
- Founder-Entscheid: Variante C (Grün bleibt, Bone-Creme-Hintergrund, KEIN
  reines Weiß). Umgesetzt: Bild-Kachel-Verdrahtung (CATEGORY_IMAGES-Fallback),
  schwebende Tab-Bar beide Bereiche. Emojis: nur Ionicons (Regel bestätigt;
  ui-ux-pro-max-Skill genutzt, dessen Lila-Vorschlag verworfen).
- Systematischer Audit über 39 Routen (scratchpad audit.cjs, DOM-Heuristiken:
  JS-Fehler, H-Overflow, undefined/NaN-Texte, Touch-Targets, Mojibake):
  0 JS-Fehler, 0 Overflow, 0 Text-Fehler. 16 zu kleine Zurück-/Share-Buttons
  auf 44px-Minimum gehoben (hitSlop wirkt im Web NICHT — echte Fläche nötig).
- OFFEN (Founder): 13 Kategorie-Bilder (docs/design/ASSETS-TODO.md); RESEND,
  Stripe-Live, Impressum wie gehabt.

## Update 2026-07-20 (mittags) — Eingeloggter E2E gegen Produktion
- Kachel-Label-Fix (#114, „Renovierung" lief an den Rand) gemergt+live.
  Founder: KEINE Kategorie-Bilder geplant — Icon-Fallback ist Normalzustand.
- **E2E-Datenebene (Test-User b1debug1907@example.com gegen Prod-REST):**
  contracts-Embed, jobs+offers(count), Conversations-Basis alle 200;
  E-Mail-Gate beim Job-Insert 403 ✓; notify-matching-providers mit fremder
  job_id 403 ✓. UI-Ebene (Gast): Gate-Meldung im Wizard, Konto-löschen-
  Dialog, Tabs — alles OK (scripts/e2e-live.cjs, gegen :8745 laufen lassen).
- **Sandbox-Grenze dokumentiert:** Headless-Chromium kommt NICHT zu Supabase
  raus (auch nicht mit Proxy-Args) — Browser-Login-E2E geht in dieser Sandbox
  nicht; Datenebene per REST-Token ist der belastbare Ersatz.

## Update 2026-07-20 (vormittags) — Anbieter-Flow-Runde (Founder-Screenshots)
- **„Angebot konnte nicht gesendet werden":** Ursache wurde vom Einheits-Catch
  verschluckt. Jetzt: echte Fehlermeldung (RLS→„Auftrag nicht mehr offen/E-Mail
  unbestätigt", FK 23503→„Verifizierung abschließen"), plus Pre-Check auf
  provider_profiles mit Weg zu /onboarding-kyc. WICHTIG: Client- und DB-Gate
  prüfen dieselben Felder — wenn es wieder auftritt, zeigt die Meldung nun WAS.
- **Doppelte Registrierung:** KYC befüllt Basisdaten aus profiles vor und
  springt (Handwerk-Track) direkt zu Schritt 2; Header heißt jetzt
  „Anbieter-Verifizierung" statt „Registrierung"; Toggle „Handwerk" wie Home.
- **Anbieter sieht Anfragen jetzt auch im Aufträge-Tab:** neuer erster Tab
  „Anfragen" (offene Jobs, CTA „Angebot erstellen") — dorthin zeigt auch der
  Badge. Angebot-Screen: Hinweis „Nur Preis ist Pflicht … nach Annahme öffnet
  sich der Chat".
- Success-Screen-Buttons (Auftrag eingereicht) auf volle Breite.

## Update 2026-07-20 (15 Uhr) — Angebots-Blocker final erklärt
- Neue Fehlermeldung griff und zeigte: RLS lehnt ab. Wurzel: Client-Gate
  akzeptierte noch user.email_confirmed_at (durch Autoconfirm IMMER gesetzt),
  DB-Gate zählt seit 0430 NUR profiles.email_verified_at → Client ließ bis
  Submit durch. Fix: requireVerifiedEmail prüft jetzt exakt wie die DB.
- KONSEQUENZ (P0, nur Founder kann das lösen): Ohne RESEND_API_KEY kann sich
  NIEMAND verifizieren → keine Angebote, keine Auftraege. Workaround für
  Founder-Tests: im Supabase-Dashboard (SQL-Editor)
  `update profiles set email_verified_at = now() where email = '<eigene@mail>';`

## Update 2026-07-20 (nachts) — Track-Trennung Nachbarschaft/Handwerk
- Founder-Befund: NB-Helfer sah Handwerks-Anfragen + konnte bieten (§1-HwO-
  Risiko) und bekam den Handwerks-Text „Dokumentenprüfung". Fixes:
  Migration 0480 (offers-Policy: NB-Anbieter nicht auf Handwerks-Jobs),
  Track-Filter in Anfragen-Tab/Dashboard/Badge/notify-Function,
  bewerbung-eingegangen mit NB-Variante (geprüft werden: Profilangaben +
  18+-Selbstauskunft; Identität via Stripe — keine Dokumente).

## 2026-07-21 — Finalisierung Block 1+2 (Branch claude/ruflo-finalisierung)

- **Datenexport Art. 20 DSGVO LIVE verdrahtet:** neue Edge Function
  `export-my-data` (JWT, Rate-Limit 3/h User + 6/h IP, alle Queries uid-scoped,
  Matrix-Zeile ergänzt) + Einstellungen-Row lädt JSON direkt herunter
  (Web: Blob-Download; Native: Share-Sheet). Toter Toast entfernt.
- **Zahlungsmethoden-Row** führt jetzt zu /zahlungsmethoden statt Toast.
- **Nachrichten-Ungelesen-Status:** Migration 0490 (`messages.read_at` +
  security-definer RPC `mark_messages_read`, Partei-Check serverseitig, kein
  direktes UPDATE-Recht). Chat markiert beim Öffnen + bei Realtime-Eingang als
  gelesen; Kunden-Nachrichtenliste zeigt Grün-Badge + fette Preview.
  Provider-seitig gibt es keine Konversationsliste (Chat via Auftragsdetail) —
  Badge dort bewusst nicht gebaut.
- **Swarm-Prompt v7:** Design-Direktiven (kein Grün, Redesign, Dark Mode)
  abgelehnt — Founder-Entscheidung „Weiterhin C" gilt. Siehe
  notes/04-Entscheidungen/Swarm-v7-Design-Direktiven-abgelehnt-2026-07-21.md.
- Offen (Founder-only): RESEND_API_KEY (P0), Stripe-Live-Keys, Impressum-Daten.

## 2026-07-21 (Founder im Urlaub) — Autonome Testabsicherungs-Runde (#125)
- Ausgangslage: Code Founder-gated (RESEND/Stripe/Impressum), keine offenen
  Code-Bugs. Principal-PM-Agent-Plan → Fokus „jüngste, am schwächsten
  abgesicherte Logik testen".
- **Block 1 (#125): DB-Regressionstests** `scripts/db-test/track-messages.sql`
  (in run.sh): 0480 NB-Track-Trennung (NB-Anbieter kann NICHT auf Handwerks-
  Jobs bieten, wohl auf NB-Jobs) + 0490 mark_messages_read Partei-Check
  (Fremder=No-op, Empfänger markiert). Voller Lauf jetzt **12/12** (vorher 8/8).
- **Block 2 (#125): Unit-Tests** resetTo (lib/nav.ts, Stack-Reset inkl. throw-
  Fall) + isPushOptedOut/registerPushToken (lib/notifications.ts, Push-Opt-out
  schreibt Token nicht neu). Jest **357/357** (vorher 347), 10 Suites.
- **Block 3: Verifikation ohne Fund** — deno check + Security-Matrix-Abgleich
  der zwei neuesten Edge Functions (notify-matching-providers, export-my-data):
  Auth/RateLimit(user+IP 20//6)/Validation/Ownership vollständig, Matrix akkurat.
  Kein Fix nötig (bestätigt 10/10-Standard).
- Baseline auf frischem main verifiziert: tsc 0 · Jest 357/357 · db-test 12/12.
- **Noch offen aus PM-Plan (nicht gemacht, Budget-Disziplin):** Block 4
  Leverkusen-Sales-Paket (analog Köln), Block 5 Marketing-Textbausteine.
  Beides reine Content-Produktion, Founder will Voice evtl. selbst prägen.
- Go-Live-Gate unverändert (nur Founder): RESEND_API_KEY · Stripe-Live · Impressum.

## 2026-07-22 — Founder-Gerätetest: 3 Fixes + Strike/Qualitäts-System
- **#127 iOS-Zoom + Pflichtfeld-Sternchen:** Eingabefelder waren 14px → iOS
  Safari zoomte beim Fokus rein; public/index.html erzwingt jetzt ≥16px
  (input/textarea/select, !important, Pinch-Zoom bleibt). Rote * an Pflicht-
  feldern in auftrag-aufgeben + angebot-erstellen (konsistent zu #120).
- **#128 Strike-System Option C + Schlecht-Bewertungs-Banner** (Founder-
  Entscheid): Migration 0500 — chat_leak_flags→Strike-Trigger (je 3 Versuche
  = 1 Strike, Einzeltreffer nicht), bad_review_count (rating<=2) im Rating-
  Trigger, Sperre bei 3 Strikes in offers-Policy. Dashboard: 3 Banner oben
  (Sperre rot / Strike-Warnung amber / Qualitäts-Info amber). db-test 16/16.
  Bewusste Grenze: Bewertungen lösen KEINEN Auto-Strike (subjektiv/rechtlich).
- **Erklärt (kein Code):** Push aufs iPhone geht nur mit nativem EAS-Build
  (Web-Push auf iOS nur als PWA, eingeschränkt) — Code fertig, wartet auf Build.
- **OFFEN (Founder-Input nötig):** Chat „wie Airbnb" — Chat existiert (Realtime,
  Lesehaken, Anti-Leak); Founder soll sagen, was konkret fehlt (Fotos senden,
  Terminvorschläge im Chat, System-Nachrichten, Push bei neuer Nachricht).
- Go-Live-Gate unverändert Founder-only: RESEND_API_KEY · Stripe-Live · Impressum.

## 2026-07-22 — Chat-Rückfragen vor dem Angebot (#130)
- Founder-Wunsch: Anbieter/NB-Helfer soll unklaren Auftrag schnell nachfragen
  können, OHNE verbindliches Angebot. Migration 0510: messages.provider_id →
  Konversation = (job, provider)-Thread. RLS: Anbieter schreibt auf OFFENEM
  Auftrag im eigenen Thread (verifiziert/nicht gesperrt/Track passend), Kunde
  sieht+beantwortet alle Threads, Anbieter B sieht Anbieter A's Thread NICHT.
  mark_messages_read thread-scoped (p_provider_id 2. Arg).
- lib/messages nach Thread; getConversationList nachrichten-basiert (Rückfragen
  in Kunden-Inbox). chat.tsx: Anbieter=eigener Thread, Kunde=Param-Thread,
  Realtime client-gefiltert. auftraege.tsx: „Rückfrage stellen" an offener Anfrage.
- db-test 21/21 (5 neu, inkl. Datenschutz Anbieter-B). tsc 0, Jest 357/357.
- OFFEN am Chat (Founder kann priorisieren): Fotos senden, Terminvorschläge im
  Chat, System-Nachrichten. Push aufs iPhone weiterhin erst mit EAS-Build.

## 2026-07-22 — Terminvorschläge im Chat (#132) + Architektur-Review
- Founder: Terminvorschläge annehmen/ablehnen, Workflow richtig, Agenten drüber
  schauen lassen. Migration 0520: appointment_proposals + 2 security-definer-RPCs
  (propose_appointment/respond_appointment), messages.type (text/system/appointment).
  Chat: Terminkarten in Timeline, „Termin vorschlagen"-Modal, System-Nachrichten.
- **Director-Software-Architect-Agent-Review** fand echte Fehler (jetzt gefixt):
  K1 (kritisch: Job-Termin wurde aus jedem Anbieter-Thread gesetzt → nur noch
  zugewiesener Anbieter), H1 (konkurrierende Vorschläge → 'superseded'), H2
  (for-update-Lock), M1 (Europe/Berlin in to_char). Vorher hatte der DB-Test
  schon einen Auth-Hole gefangen (jeder als „Anbieter"). db-test 27/27.
- **Foto-Empfehlung an Founder:** Auftrags-Foto-Upload ist auch nur Platzhalter
  (native Build nötig); Bilder → Supabase Storage (nicht Postgres). Fotos
  (Auftrag+Chat) zusammen mit EAS-Build, nicht jetzt.
- OFFEN (Founder wollte, klein): System-Nachrichten „Angebot angenommen" /
  „Zahlung hinterlegt" (accept_offer-RPC + stripe-webhook); Nachrichten-Tab-Badge.
  Push aufs Handy erst mit nativem Build.

## 2026-07-22 — Swarm-Lauf: System-Nachrichten + Tab-Badge + Test-Befunde (#PENDING)
- Founder-Kritik „nutzt die Agenten": npx-Swarm-Daemon hängt in Sandbox; stattdessen
  2 Agenten parallel via Task-Tool (nicht-überlappend).
- **Director Software Architect (Implementierung):** Migration 0530 (accept_offer
  + System-Nachricht „Angebot angenommen"), stripe-webhook System-Nachricht
  „Zahlung hinterlegt (Escrow)", Nachrichten-Tab-Badge app/(tabs)/_layout.tsx
  (Summe ungelesener, Realtime INSERT+UPDATE). Money-Core unverändert (db-test grün).
- **Senior Test Expert (Review):** fand 2 Regressionen aus dem 0510-Umbau (jetzt gefixt):
  H1 = Angebots-Benachrichtigung routete /chat OHNE providerId → Kunde in totem
  Demo-Chat, Nachricht ging still verloren (benachrichtigungen.tsx job-basiert +
  providerId in allen Routen; chat.tsx: kein stilles Fake-Zustellen mehr).
  H2 = doppelte React-Keys in Inbox bei mehreren Anbieter-Threads/Job
  (nachrichten.tsx key = job:provider). M1 = Center zeigt jetzt Vor-Vertrags-
  Rückfragen. M2 = Terminkarte fest Europe/Berlin.
- OFFEN (niedrig, notiert): N1 System-Text als Inbox-Vorschau; N2 job-lose
  Direktchats (nachbarschaft) laufen weiter in lokalen Demo-Modus (vorbestehend).
- Verify: tsc 0 · Jest 357/357 · db-test 28/28.

## 2026-07-22 — Swarm-Vollcheck: Pentest + QA + GTM + Vision (4 Agenten) + Fixes
- Founder: „testen, härten, penetrieren, marketing/sales/vision prüfen, headroom learn".
  4 read-only Fach-Agenten parallel + headroom learn --apply gelaufen.
- **Link-Audit (selbst):** alle push/replace/href-Ziele lösen auf existierende
  Routen auf; keine leeren onPress. Nur bewusste Platzhalter (Impressum/Fotos/
  Pro/„keine Anbieter"-Vorschau). Web-Export baut (dist erzeugt).
- **GEFIXT (dieser PR):**
  - H1 (KRITISCH, Security): provider_profiles exponierte via anon-Key
    unauthentifiziert phone/steuer_id/psttg_revenue/gewerbeschein. Migration 0540:
    Tabellen-Grant für anon entzogen, nur öffentliche Suchfelder spaltenweise
    neu granted. db-test beweist: anon kann steuer_id NICHT, business_name schon.
  - BUG1 (HIGH, QA): Nachbarschaft „Anfragen"/„Nachricht senden" öffnete jobless
    Chat → stiller Nachrichtenverlust. Jetzt → Buchungsweg. chat.tsx: Senden bei
    !jobId deaktiviert (Defense-in-Depth).
  - BUG2 (QA): auftrag-detail zeigte bei totem Deep-Link fingierten „In
    Bearbeitung"-Auftrag → jetzt echter Not-Found-Zustand.
  - L3 (Security, Geld): cancel-contract refund ohne idempotencyKey → Doppel-
    Refund bei Race möglich → idempotencyKey ergänzt.
  - §37a-TKG-Falschzitat in garantie.tsx entfernt (CCO-Befund).
- **OFFEN / dokumentiert (nicht in diesem PR):**
  - H1-VOLL + M1 (Security, mittel): eingeloggter Nutzer kann sensible Spalten
    fremder Anbieter noch lesen; jobs.address_street für alle Anbieter sichtbar.
    Saubere Lösung = Security-Barrier-View für Public-Browse + Basistabellen-
    Policy auf Eigen-Zeile/Vertragspartei. Siehe GO-LIVE-SECURITY-CHECKLIST.
  - L1 (niedrig): export-my-data kann für Anbieter fremde Vor-Vertrags-Threads
    enthalten (provider_id-Filter fehlt).
  - L2 (niedrig): propose_appointment Kunden-Zweig ohne Beteiligungs-Check.
  - AGB §6(3) „Pro 29€" widerspricht §2(4) (keine bezahlte Platzierung) →
    Anwalt/Founder: Klausel streichen oder Feature bauen.
  - Anbieter-Value-Prop im Onboarding dünn; „Werkant-geprüft"-Badge uneinheitlich
    (Marketing, nach Go-Live).
- **CTO-Urteil:** startklar für kontrollierten Köln-Softlaunch (Handwerk-Track)
  sobald Founder-Inputs + Dashboard-Security-Klicks erledigt. Zwei Bedingungen:
  (1) erster echter Vorgang = Founder-Selbsttest mit echter Karte; (2) NB-Track
  im Geld-Pfad gegated lassen bis DRV/PStTG/ZAG geklärt. Reihenfolge: RESEND +
  Site-URL-Fix → Impressum → Dashboard-Security → Stripe Live+Connect → 1-2
  Kölner Anbieter per Concierge → Selbsttest → externe Nutzer.
- Verify: tsc 0 · Jest 357/357 · db-test 30/30 · deno check ok.

## 2026-07-22 (spät) — Pentest-Härtung autonom abgearbeitet (#137, #138)
- **#137 (L1/L2/L4):** propose_appointment Kunden-Zweig-Guard (kein unsolicited
  Kontakt), export-my-data Anbieter-Thread-Isolation, pstg-annual-report Admin-
  Secret timing-safe.
- **#138 (H1-voll):** View provider_public (nur öffentliche Felder + has_*-Flags),
  Public-Read-Policy auf provider_profiles entfernt → Basistabelle nur Eigen-Zeile;
  8 Browse/Counterparty-Reads auf die View umgestellt. **Director-Software-
  Architect-Review** fand 6 übersehene PostgREST-FK-Embeds (Verträge/Meine
  Anbieter kundenseitig leer) → mit lib/providerPublic.ts (fetchPublicProviders,
  .in()+Merge) gefixt; View um `where kyc_status='approved'` ergänzt.
  db-test 33/33 (eingeloggter Fremder sieht Anbieter-Basiszeile NICHT), Web-Build ok.
- **headroom learn --apply** gelaufen (MEMORY.md aktualisiert).
- **OFFEN — letzter Security-Punkt M1** (mittel): jobs.address_street ist für
  alle browsenden Anbieter vor Vergabe sichtbar. Gleiche View-Technik wie H1-voll
  auf die jobs-Browse anwenden (öffentliche Job-Felder ohne Straße; Straße erst
  dem gematchten Anbieter). Nebenbefund: index 'Neu'-Provider-Query nutzte
  provider_profiles.created_at (existiert nicht) — in der View auf profiles.created_at.

## 2026-07-22 (spät nacht) — M1 geschlossen (#140), alle Pentest-Befunde erledigt
- M1: Kundenadresse (Straße) in Tabelle job_addresses ausgelagert (RLS: nur
  Kunde + zugewiesener Anbieter), aus jobs entfernt → Bieter sehen vor Vergabe
  nur Stadt/PLZ. Ansatz B (schmal): keine Browse-Query angefasst; createJob
  schreibt getrennt, Dashboard liest als zugewiesener Anbieter. db-test 36/36
  (browsender Anbieter sieht Straße NICHT). tsc 0, Jest 357/357, Web-Build ok.
- Damit alle Security-Pentest-Befunde geschlossen: H1 (#135), H1-voll (#138),
  L1/L2/L4 (#137), M1 (#140). Kein offener Härtungspunkt mehr.
- GO-LIVE-SECURITY-CHECKLIST: M1-Eintrag ist damit erledigt (nur noch
  Founder-Dashboard-Klicks + RESEND/Stripe/Impressum offen).

## 2026-07-26/27 — nachgetragen: #142–#145 (waren nicht im Handoff)
Dieser Abschnitt schließt die Lücke zwischen dem letzten Eintrag (22.07.) und
dem Stand von `main` (87dcb90). Fünf gemergte PRs fehlten hier komplett — wer
nach einem Reset nur dieses Dokument liest, hätte fünf Tage Arbeit nicht
gekannt und Fehler doppelt gesucht.

- **#142 Gerätetest-Fixes:** Chat-Rolle aus DB-Wahrheit (`jobs.customer_id`)
  statt lokalem `isProvider`-Flag; Kundenprofil bearbeitbar; neuer Screen
  `app/(provider)/statistik.tsx`; Gewerk-Taxonomie vereinheitlicht
  (profil-bearbeiten pflegte eigene IDs → überschrieb still die Meisterpflicht-
  Zuordnung); Support-Chat eskaliert gestaffelt statt derselben Rückfallantwort;
  falsche SLA-Zusagen entfernt; Consent auf Web synchron in localStorage.
- **#143 Anbieter-Posteingang:** Nach Vergabe an einen ANDEREN verschwand der
  Auftrag für den Rückfrage-Anbieter komplett (Policy-Lücke: weder „browse
  open" noch „parties"). Migration 0590 + neuer Tab
  `app/(provider)/nachrichten.tsx`. Merke: `exists (select 1 from messages …)`
  direkt in der jobs-Policy erzeugt Endlos-Rekursion → security-definer-Funktion.
- **#144 Verifikations-Deadlock:** „Chat sendet nicht" und „Mail kommt nicht"
  haben EINE Ursache — `RESEND_API_KEY` fehlt in den Supabase-Secrets. Ohne den
  Schlüssel kann sich niemand verifizieren, damit sind ALLE Schreibwege
  gesperrt. Gate bewusst NICHT gelockert (CTO-Entscheid). Doku:
  `docs/ops/RESEND-MAIL-GATE.md`. Außerdem: Geld falsch angezeigt
  (`provider_commission` statt `provider_payout` — Anbieter sah ~1/12 seines
  Umsatzes), rollenabhängige Fehlerdiagnose, Migration 0600 (Guard präzisiert).
- **#145:** `health`-Function war nie deployt (nicht in `config.toml`) und der
  Workflow wertete 404 als Warnung → der Detektor war selbst tot. Neuer
  CI-Guard: jedes Verzeichnis unter `supabase/functions/` muss deklariert sein.
  AGB-Widerspruch §2(4) vs. §6(3) gestrichen; Pro bleibt eingefroren
  (CFO-Entscheid, Platzierung ist Nullsummenspiel); DSGVO-Nachlauf
  (`auth.users.email` wird beim Löschen ersetzt, nicht nur `profiles.email`).

## 2026-07-27 — Datenexport: stiller Teil-Export beseitigt
Offener Punkt aus #145 war „Ursache des gemeldeten ‚Datenexport fehlgeschlagen'
bleibt offen". Die Function KONNTE die Ursache nicht nennen: jeder Query-Fehler
wurde mit `?? []` verschluckt, die Antwort blieb 200. Ein Nutzer bekam dann eine
Datei, die wie eine vollständige Auskunft aussah, aber Kategorien stillschweigend
ausließ — bei einem Auskunftsersuchen schlimmer als ein klarer Fehler.

- `export-my-data`: Fehler werden pro Kategorie gesammelt; schlägt eine fehl,
  schlägt der ganze Export fehl (500 + `failed_categories`, Details nur ins
  Server-Log). Client nennt den echten Grund (401 = Sitzung abgelaufen,
  500 = betroffene Kategorien) statt „bitte später erneut versuchen".
- **Export war zusätzlich unvollständig** — seit er geschrieben wurde, kamen
  Tabellen dazu, die niemand nachgetragen hat: `job_addresses` (0570),
  `appointment_proposals` (0520), `disputes`, `pro_subscriptions`,
  `pstg_reports`, `waitlist`. Alle jetzt drin, jeweils eigen-gescoped.
- Bewusst NICHT enthalten, im Export selbst benannt (Art. 15 Transparenz):
  `email_verifications` (enthält gültigen Token = Zugangsmittel),
  `chat_leak_flags` (abgeleitete Missbrauchserkennung, nicht Art. 20 Abs. 1).
- iOS-Safari-Download: Anchor hängt jetzt im Dokument, Blob-URL wird nicht mehr
  im selben Tick widerrufen (Safari bricht den Download sonst ab).
- **Regressionsnetz** `scripts/db-test/data-export.sql`: spiegelt JEDEN Filter
  der Function gegen echtes Postgres. Genau diese Bugklasse hat schon zugeschlagen
  (#142: `reviews` über nicht existierende Spalten). Benennt eine Migration eine
  Spalte um, schlägt jetzt der Test fehl statt die Kategorie leer zu liefern.
  Prüft zusätzlich die Isolation: Anbieter bekommt weder die Kundenadresse (M1)
  noch den Thread eines konkurrierenden Anbieters (L1).
- Verifiziert: tsc 0 · Jest 357/357 · **db-test 49/49** (3 neu) · deno check ok.

### Offen (Stand 27.07., unverändert Founder-Sache)
1. **`RESEND_API_KEY`** — P0, blockiert JEDE Schreibaktion (siehe #144).
2. Stripe Live + Connect, Impressum-Daten (`constants/legal.ts`).
3. Security-Dashboard-Klicks (`docs/security/GO-LIVE-SECURITY-CHECKLIST.md`).
4. F6 P2B-AGB beim Anwalt; native EAS-Builds (Push + Foto-Upload) nach Go-Live.

**Wenn der Founder „Datenexport fehlgeschlagen" erneut meldet:** die Meldung
nennt jetzt den Grund. Bei 500 stehen die betroffenen Kategorien in der Meldung
und die Ursache (Spalte/Policy) im Function-Log des Supabase-Dashboards.

## 2026-07-27 — Founder im Urlaub: Arbeitsvorrat für den Autonom-Loop
Founder-Entscheid 27.07.: EIN Block pro Tag, KI mergt selbst (wie 16.07.),
Fokus nur auf Absicherung/Tests + Marketing-Textbausteine. Leverkusen-Sales
bewusst NICHT beauftragt (Tonalität will der Founder selbst prägen).

**Befund beim Aufsetzen:** die alte Routine „Werkant Autonom-Loop" hat zuletzt
am **19.07.** gefeuert und danach still nichts mehr getan — sie zeigte auf den
toten Branch `claude/grouped-settings-style-xpvyu6` und eine alte Session.
Gleiche Klasse wie die tote health-Function aus #145: ein Automatismus, der
ausfällt, ohne dass es jemand merkt. Ersetzt durch eine Routine, die pro Lauf
eine FRISCHE Session startet und ihren Auftrag aus dieser Datei zieht.

### Warteschlange (der Reihe nach, EIN Block pro Lauf)
Reihenfolge = absteigender Wert. Ist ein Block erledigt, hier abhaken und den
Lauf beenden — nicht zwei Blöcke in einem Lauf.

- [x] **A1 Geldpfad-Zustandsmaschine gegen echtes Postgres.** ERLEDIGT 27.07.
  (`scripts/db-test/escrow.sql`, db-test 49 -> 58). Ergebnis: die Gebuehren sind
  ZWEIMAL implementiert (`lib/feeEngine.ts` und nochmal in plpgsql in
  `accept_offer`, 0530:41-52) und `money-core.sql` prueft nur Handwerker/100 EUR
  — dort greift keine der beiden Mindestgebuehren und kein Rundungsfall; die
  `greatest(...)`-Zweige und der ganze Nachbarschafts-Track waren nie geprueft.
  Jetzt Paritaet an den Grenzfaellen (20/60/101 EUR + NB 50 EUR), plus
  0300-Guard (weder Kunde noch Anbieter kann Freigabe/Status/Betrag selbst
  setzen), RLS gegen Unbeteiligte und der status-CHECK als letzte Instanz.
  Gegengeprueft, dass der Test eine echte Divergenz faengt (Mindestgebuehr nur
  in SQL entfernt -> rot). Kein Fehler im aktuellen Stand gefunden.

- [x] **A2 Doppelzustellung beim stripe-webhook.** ERLEDIGT 27.07.
  (`scripts/db-test/webhook-idempotency.sql`, db-test 58 -> 63). **Echter
  Geld-Bug gefunden und behoben:** der Handler fuer `payment_intent.succeeded`
  schrieb bedingungslos `status='active'` + frischen `escrow_captured_at`. Eine
  Doppel- oder Wiederholungszustellung (Stripe liefert dasselbe Event
  ausdruecklich mehrfach und wiederholt bis zu 3 Tage nach einer 500) setzte
  damit auch einen bereits STORNIERTEN Vertrag zurueck auf 'active' — mit noch
  leerem `escrow_released_at`. cancel-contract hatte da schon erstattet, also
  passierten alle drei Vorbedingungen von release-escrow und Werkant haette dem
  Anbieter Geld ueberwiesen, das der Kunde zurueckbekommen hat. Fix:
  Compare-and-Swap (`.eq('status','pending').is('escrow_captured_at', null)`),
  bei 0 Treffern 200 ohne Folgewirkung (kein Push, keine doppelte
  System-Nachricht). Gegenprobe Y5 im Test fuehrt die alte Anweisung aus und
  zeigt die Wiederbelebung.

- [x] **A3 PStTG-Zähler-Grenzfälle.** ERLEDIGT 27.07. (Migration 0610,
  `scripts/db-test/psttg-counter.sql`, db-test 63 -> 71). **Zwei echte Befunde:**
  (1) **Umgehung möglich, schwerer als der ursprüngliche Auftrag:**
  `guard_profile_sensitive_cols` schützte `pstg_locked` und `pstg_year`, aber
  NICHT `pstg_tx_count`/`pstg_revenue`; die WITH-CHECK der Policy ist an der
  Stelle wörtlich `and true` (0050:52). Ein `update profiles set
  pstg_tx_count = 0, pstg_revenue = 0 where id = auth.uid()` genügte, um aus
  der DAC7-Meldung zu verschwinden — `pstg-annual-report` wählt die zu
  meldenden Anbieter ausschliesslich über diese beiden Spalten aus, nicht über
  `pstg_locked`. Meldepflicht und Bußgeld treffen die Plattform (§§ 13, 25
  PStTG). Jetzt gesperrt.
  (2) **Race behoben:** die Fortschreibung wanderte aus `release-escrow` in die
  atomare RPC `pstg_record_transaction` (Jahreswechsel, Hochzählen, Schwelle,
  Sperre in EINER Anweisung), nur für `service_role` ausführbar.
  Nebenbei: die Rollenprüfung im Guard folgt jetzt dem Muster aus 0600 (nur
  Client-Rollen blocken statt nur service_role erlauben) — der alte Test
  blockierte auch SECURITY-DEFINER-Funktionen und Admin-Verbindungen, was beim
  Schreiben des Tests sofort zuschlug.
  Getestet: 29 vs. 30 Transaktionen, 1999.99 vs. exakt 2000.00 EUR,
  Jahreswechsel (Zähler UND Sperre), Umgehungsversuch (mit Gegenprobe, dass
  harmlose Profilfelder änderbar bleiben), Verlustfreiheit über 50
  Fortschreibungen, kein Client-Aufruf der RPC.

- [x] **M1 Store-Texte.** ERLEDIGT 27.07. — `docs/marketing/store-texte.md`.
  App Store (Name/Untertitel/Werbetext/Beschreibung/Keywords/Was-ist-neu) und
  Play (Titel/Kurz-/Vollbeschreibung), deutsch, Stimme wie im Köln-Startpaket.
  Zeichengrenzen maschinell geprüft, alle Felder passen (längstes: Keywords
  94/100). Enthält eine **Verbotsliste** mit Begründung — genau die Fehlerklasse
  (erfundene SLAs, „Trust-Team", Ausweisprüfung) ist in #142/#144 schon zweimal
  live gegangen — plus eine Belegstellen-Tabelle: jede Zahl im Text zeigt auf
  die Datei, aus der sie stammt.
- [x] **M2 Anbieter-Value-Prop im Onboarding.** ERLEDIGT 27.07. Befund war
  „dünn" — sie fehlte tatsächlich ganz: der Betrieb landete nach der
  Registrierung ohne einen einzigen Satz direkt im Dokumenten-Upload. Jetzt drei
  belegte Punkte auf Schritt 1, je Track unterschiedlich (Handwerk: 8 % nur bei
  Erfolg / Escrow / Meisterbrief zählt — Nachbarschaft: keine Provision /
  Escrow / kein Papierkram), plus ein ehrlicher Absatz statt eines Versprechens.
  Kein Redesign, nur bestehende Tokens (Variante C).
  **Nicht verifizierbar in der Sandbox:** ein Screenshot des Screens geht nicht,
  er liegt hinter dem Login und Headless-Chromium kommt hier nicht zu Supabase
  durch. Geprüft sind tsc, Web-Build und die Design-Regeln (keine Emojis, keine
  deprecated Tokens, fontWeight max 700). Optischer Abgleich beim nächsten
  Gerätetest des Founders.

> **Stand 29.07.: die Warteschlange ist WIEDER GEFÜLLT.** Sie stand zwei Tage
> leer, weil ich sie nach M2 selbst als leer markiert und danach jeden neuen
> Block interaktiv abgearbeitet habe, statt ihn hier einzutragen. Die Routine
> hat in dieser Zeit nachweislich **null** Branches erzeugt — alle neun
> `claude/autonom-*`-Branches stammen aus interaktiven Sitzungen. Founder-Ansage
> vom 29.07.: das soll sich ändern.

### SCHRITT 0 JEDES LAUFS — Lebenszeichen (verbindlich, auch bei leerer Liste)
Vor allem anderen eine Zeile an `docs/agents/loop-heartbeat.md` anhängen und
committen:

    <ISO-Datum+Uhrzeit UTC> | Lauf gestartet | offene Blöcke: <n>

Und am Ende des Laufs eine zweite Zeile mit dem Ergebnis:

    <ISO-Datum+Uhrzeit UTC> | <Block-ID erledigt / nichts offen / abgebrochen: Grund>

**Warum das nicht optional ist:** Dieses Projekt hat die Fehlerklasse
„Automatismus fällt still aus" bereits zweimal getroffen — die `health`-Function,
die nie deployt war und deren Workflow 404 als Warnung wertete (#145), und diese
Routine selbst, deren Ausfall vom 19.–27.07. niemandem auffiel, weil
„nichts getan" und „nicht gelaufen" von außen identisch aussehen. Ein
Heartbeat macht den Unterschied sichtbar. Ohne ihn ist jede Aussage über die
Routine eine Vermutung.

### Warteschlange (der Reihenfolge nach, EIN Block pro Lauf)
Alle sechs sind in sich abgeschlossen, lokal verifizierbar und brauchen KEINE
Founder-Entscheidung. Reihenfolge = absteigender Wert.

- [ ] **Q1 — Erstattete Verträge sehen aus wie saubere.** Seit 0630/0640 stehen
  `customer_refunded_amount`, `refunded_at`, `dispute_state` und
  `dispute_funds_withdrawn` auf `contracts`, aber KEIN Screen wertet sie aus.
  Ein `completed`-Vertrag mit zurückgeflossenem Geld ist in jeder Liste von
  einem sauber abgeschlossenen nicht zu unterscheiden. `app/rechnung.tsx` zeigt
  weiterhin den vollen `customer_total` als „du zahlst".
  Zu tun: Korrekturzeile auf der Rechnung („Erstattet: −X,XX €", Restbetrag),
  Hinweis in der Auftragsliste und im Anbieter-Dashboard.
  **Den `status` dabei NICHT ändern** — das würde den Vertrag aus der
  DAC7-Meldung nehmen, obwohl die Vergütung geflossen ist (Begründung in 0630).
  Grenze: ob eine Erstattung umsatzsteuerlich eine Rechnungsberichtigung nach
  § 14c/§ 17 UStG auslöst, ist Steuerberater-Frage — eine schlichte
  Erstattungszeile ist immer richtig und nie schädlich.

- [ ] **Q2 — Betrugsvermerke haben keine Löschfrist.** `fraud_warning_at` und
  `fraud_warning_action` (0640) stehen auf `contracts` und überleben damit die
  Kontolöschung unbegrenzt: `delete-account` pseudonymisiert nur `profiles`.
  `contracts` unterliegt zwar 10 Jahren (HGB § 257 / AO § 147) — ein
  Betrugsvermerk ist aber kein Handelsbuchbeleg, ihn so lange mitzuschleppen ist
  ein Zweckbindungsproblem (Art. 5 Abs. 1 lit. e DSGVO).
  Zu tun: Migration mit einer Funktion, die beide Spalten nach ~13 Monaten
  (Chargeback-Frist) nullt, plus Aufruf in `delete-account`. db-test dazu.

- [ ] **Q3 — Art. 14 DSGVO: die Betrugswarnung fehlt in der
  Datenschutzerklärung.** `app/datenschutz.tsx` nennt Stripe als *Empfänger*,
  nicht als *Quelle einer Bewertung*. Eine vom Kartennetz gemeldete
  Betrugswahrscheinlichkeit ist ein Datum aus fremder Quelle über eine
  identifizierbare Person. Rechtsgrundlage (Art. 6 Abs. 1 lit. f, Betrugsabwehr)
  steht schon dort — die Verarbeitung selbst nicht.
  Zu tun: Absatz ergänzen, Quelle, Zweck, Speicherdauer (siehe Q2), und der
  Hinweis, dass daraus KEINE automatisierte Entscheidung folgt, solange
  `STRIPE_AUTO_REFUND_ON_FRAUD_WARNING` nicht gesetzt ist.

- [ ] **Q4 — Der Anbieter sieht den Zähler statt der Meldezahl.**
  `lib/pstTg.ts` liest `profiles.pstg_*`. Das ist seit 0620 nur noch der
  Live-Stand für das laufende Jahr und die Sperre; gemeldet wird aus
  `contracts` (`pstg_year_totals`). Für abgelaufene Jahre gehört `pstg_reports`
  gelesen. Der Minimalfix (`.eq('pstg_year', y)`, damit nie ein falsches Jahr
  beschriftet wird) ist drin, der Umbau nicht.

- [ ] **Q5 — Echter Nebenläufigkeits-Test per `dblink`.** Z7 in
  `scripts/db-test/psttg-counter.sql` läuft sequenziell und beweist keine
  Nebenläufigkeit; das steht ehrlich im Testkopf, ist aber eine Lücke.
  `dblink 1.2` ist in der Harness verfügbar, kein Docker nötig. Rezept
  (vorgeführt, funktioniert): `dblink_connect` s1/s2 → `dblink_exec('s1','begin')`
  → `dblink('s1','select * from pstg_record_transaction(…)')` →
  `dblink_send_query('s2', …)` → `pg_sleep(1)` + `dblink_is_busy('s2')=1` als
  Blockier-Nachweis → `dblink_exec('s1','commit')` → `dblink_get_result` —
  **zweimal rufen**, sonst scheitert der folgende commit.
  Gegenprobe mit dem alten Lesen-Rechnen-Schreiben muss eine Fortschreibung
  verlieren, sonst beweist der Test nichts.

- [ ] **Q6 — § 15 PStTG verlangt die Vergütung je QUARTAL.** `pstg_reports`
  (0220) speichert nur Jahreswerte. Aus `contracts` ist die Quartalsaufteilung
  seit 0620 trivial ableitbar (`escrow_released_at` in Europe/Berlin), aus dem
  alten Zähler war sie es nie. Gehört zum BZSt-XML.
  Zu tun: `pstg_quarter_totals(jahr)` analog zu `pstg_year_totals`, vier Zeilen
  je Anbieter, Schwelle als Parameter, nur für `service_role`. Tests wie Z9-Z12.

**Ist die Liste abgearbeitet:** Heartbeat-Zeile „nichts offen" schreiben und
enden. NICHT selbst neue Blöcke erfinden — neue Arbeit trägt der Founder ein
oder eine volle Session nach ausdrücklichem Auftrag.

### Regeln für jeden Lauf (verbindlich)
1. **Ist die Liste leer: Einzeiler-Status, Ende.** Keine Arbeit suchen, keine
  Features erfinden. Das ist ausdrücklich erwünscht, nicht Faulheit.
2. Verifikation vor Commit: `tsc` · `jest` · `bash scripts/db-test/run.sh` ·
  bei `supabase/functions/**` zusätzlich `deno check` (siehe AGENTS.md).
3. Merge selbst (squash → main), CI muss grün sein. EIN `get_check_runs`
  nach echter Arbeit — kein Sleep-Polling (AGENTS.md).
4. Diesen Abschnitt aktualisieren: Block abhaken, Ergebnis in einem Satz.
5. **Nicht anfassen ohne den Founder:** Design (Variante C gilt), Preise/
  Take-Rate, AGB/Recht, Rebrand, Pro-Feature (eingefroren, CFO-Entscheid).

### Was der Loop NICHT lösen kann
Jeder verbleibende Go-Live-Punkt ist ein Founder-Klick oder ein Dritter:
`RESEND_API_KEY` (P0 — ohne ihn ist JEDER Schreibweg gesperrt), Stripe Live +
Connect, Impressum, Google/Apple-OAuth, EAS/Store, Anwalt (P2B-AGB), die 10
Dashboard-Klicks der Security-Checkliste. Solange RESEND fehlt, lässt sich
nichts davon end-to-end verifizieren — deshalb ist der Vorrat oben bewusst
Absicherung und Text, nicht neue Features.

## 2026-07-28 — Agenten-Review über die Arbeit vom 27.07. (3 Fachagenten)

Founder-Kritik am Morgen: „ich dachte, du arbeitest autonom mit den Agenten".
Berechtigt — die Blöcke A1–A3 und M1/M2 hatte ich alle selbst geschrieben UND
selbst gemergt. Drei read-only Fachagenten (Director Software Architect,
Senior Test Expert, Werkant CCO) haben nachgeprüft und Substanzielles gefunden.
Muster wie bei #134/#138: Agenten-Review über fremden Code findet, was der
Autor nicht sieht.

**Gefixt in #152** (Details dort): Zahlung ohne DB-Spur (Gegenstück zu meinem
CAS aus #149), 1-Cent-Differenz zwischen angezeigtem und abgebuchtem Betrag
(23 Preise zwischen 1 und 500 EUR, am echten accept_offer verifiziert),
Testharness meldete grün bei leerem Migrationspfad, falsch grüner Export-Test
der eine Art.-15-Lücke verdeckte, sechs Zusagen die der Code nicht einlöst.

### OFFEN — Founder-Entscheidung nötig (nicht einseitig entscheidbar)

1. **„Ohne Nachweis kein Angebot" ist nicht durchgesetzt.** Die INSERT-Policy
   in 0580 prüft E-Mail, Strikes, Track und Job-Status — aber NICHT
   `kyc_status`. `angebot-erstellen.tsx:97` prüft nur, ob eine
   provider_profiles-Zeile existiert, und die legt der Signup-Trigger (0020)
   automatisch an. **Ein Konto ohne ein einziges Dokument kann heute im
   Elektro-Gewerk bieten.** Das ist das Kernversprechen der Marke.
   Die Texte sind vorerst entschärft (#152). Die Policy nachzuziehen
   (`and exists (… kyc_status = 'approved')`) sperrt jeden Anbieter aus, bis du
   ihn per Concierge-Review freigibst — das ist eine Betriebsentscheidung, kein
   Bugfix. Solange sie offen ist, darf die Zusage nirgends wieder auftauchen.

2. ~~Jahreswechsel löscht den Vorjahresstand vor der DAC7-Meldung.~~
   **ERLEDIGT 28.07.** (Migration 0620, db-test 71 -> 74). Die Meldung kommt
   jetzt aus `contracts` — `provider_payout` bei abgeschlossenen, freigegebenen
   Verträgen, gruppiert nach dem Jahr von `escrow_released_at` (Europe/Berlin).
   Diese Zahlen sind unveränderlich: für 2026 stehen sie auch 2028 noch so da.
   `profiles.pstg_*` bleibt Anzeige- und Sperr-Cache, hängt aber nicht mehr an
   der Meldung — ein ausgefallener oder verspäteter Cron-Lauf kann keine
   Meldedaten mehr verlieren. Test Z9 spielt genau den nachgestellten Ausfall
   durch (Zähler steht auf 2027, Meldung für 2026 bleibt vollständig).
3. ~~Demo-Anbieter mit erfundenen Bewertungen.~~ **ERLEDIGT 28.07.** (#153) —
   betraf drei Screens, nicht einen; Details im PR.
   (ursprünglicher Befund:) `app/(tabs)/index.tsx:55-61`
   zeigt bei 0 echten Anbietern `DEMO_TOP_PROVIDERS` — „Marcus Berger, 4,9
   (87)". Erfundene Bewertungen stehen im Anhang zu § 3 Abs. 3 UWG (Nr. 23b/c),
   per se unzulässig, ohne Interessenabwägung. Landen sie auf Store-Screenshots,
   kommt Apple 2.3.3 dazu. Entfernen ändert die Optik einer leeren Startseite —
   deine Entscheidung, aber vor dem ersten echten Nutzer.

4. ~~Steuer-ID wird erhoben und verworfen.~~ **ERLEDIGT 28.07.** (#153) — wird
   gespeichert, bleibt aber optional (GmbH/UG und ausländische Betriebe melden
   nicht über die 11-stellige IdNr). Das IBAN-Feld ist entfernt, sein Wert ging
   nirgendwohin. (ursprünglicher Befund:) `onboarding-kyc.tsx:227-233`
   übergibt `hwSteuerID` nirgends an `updateProviderProfile`. Ausserdem erhebt
   das Formular die Steuer-ID (11-stellig, § 139b AO), nicht die Steuernummer —
   verschiedene Nummern. Für die DAC7-Meldung steht sie damit nicht bereit.
   Entscheidung nötig: Feld wirklich speichern oder Erhebung streichen
   (Datenminimierung). Die Erfolgsmeldung behauptet sie inzwischen nicht mehr.

5. **Nachbarschafts-Flag vor der Store-Einreichung festlegen.** Die
   Release-Checkliste sagt „NACHBARSCHAFT aus in Produktion", `eas.json` setzt
   die Variable aber nicht, und `constants/features.ts:21` ist `!== 'false'` →
   der Produktionsbuild hätte den Track faktisch AN. Ein Sechstel der
   Store-Beschreibung hängt daran.

6. **Anwalt / Steuerberater** (kein Code): „Treuhand" ist aufsichtsrechtlich
   besetzt (§ 1 Abs. 1 ZAG) und das eigene `zagGate.ts` hält Live-Zahlungen
   genau deswegen zu — der Begriff darf nicht ins Store-Marketing, bevor
   gezeichnet ist. Dazu: Leistungsversprechen „Werkant Schutz" (was genau ist
   der Auslöser), USt-Behandlung der Plattformgebühr in beide Richtungen
   (Reverse-Charge-Annahme in feeEngine.ts:13 ist für DE→DE fraglich),
   Trader-/DSA-Status mit echten Impressumsdaten für beide Stores.

### Neu offen aus dem DAC7-Vor-Merge-Review (28.07.)
- ~~Erstattung nach Abschluss lässt die gemeldete Summe zu hoch stehen.~~
  **ERLEDIGT 28.07.** (Migration 0630, db-test 75 -> 79) — **aber anders als
  der Review vorschlug, und das ist der wichtige Teil.** Der Vorschlag lautete,
  den erstatteten Betrag von der DAC7-Summe abzuziehen
  (`sum(provider_payout - refunded_amount)`). Das wäre falsch gewesen: es gibt
  im gesamten Code **keine** Transfer-Rückabwicklung (kein
  `transfers.createReversal`, keine Verrechnung). Nach `release-escrow` liegt
  das Geld auf dem Connect-Konto des Anbieters und bleibt dort — eine
  Erstattung zahlt Werkant aus eigener Tasche. Die Vergütung des Anbieters
  (§ 3 Abs. 5 PStTG, „gezahlt oder gutgeschrieben") ist unverändert. Ein Abzug
  hätte den Anbieter ZU NIEDRIG gemeldet: derselbe Fehlertyp wie der, den 0620
  gerade beseitigt hat, nur in die andere Richtung.
  Gebaut wurde stattdessen: `charge.refunded` und `charge.dispute.*` im
  stripe-webhook, `contracts.customer_refunded_amount` (kumuliert gesetzt, also
  idempotent) + `refunded_at` + `dispute_state`, alle vier durch den
  0300-Guard gesperrt. Eine Erstattung NACH Auszahlung wird auf Fehler-Ebene
  protokolliert — sie ist ein echter Verlust für Werkant und nur manuell
  zurückzuholen.
  **`provider_clawback_amount` ist reserviert und bleibt 0.** Wird je ein
  Rückholmechanismus gebaut, MUSS `pstg_year_totals` genau um diesen Wert
  vermindert werden — und nur um diesen, nie um die Kundenerstattung.
- **Der Anbieter-Screen sollte die Meldezahl zeigen, nicht den Zähler.** Der
  Zähler hat seit 0620 nur noch eine legitime Aufgabe: `pstg_locked` für das
  laufende Jahr. Für abgelaufene Jahre gehört `pstg_reports` gelesen. Der
  Minimalfix (`.eq('pstg_year', y)`, damit nie ein falsches Jahr beschriftet
  wird) ist drin; der Umbau des Screens nicht.
- **§ 15 PStTG will die Vergütung je QUARTAL**, `pstg_reports` (0220) speichert
  nur Jahreswerte. Aus `contracts` ist das jetzt trivial ableitbar, aus dem
  Zähler war es das nie. Gehört zum BZSt-XML.
- **Steuerberater-Frage:** die Bagatellgrenze 30/2000 (§ 4 Abs. 5 Nr. 4 PStTG)
  ist für WARENverkäufer geschrieben. Werkant vermittelt persönliche
  Dienstleistungen (§ 5 Abs. 1 Nr. 2), für die es diese Freistellung so
  möglicherweise nicht gibt — dann wäre JEDER Anbieter mit Auszahlung zu
  melden. Die Schwelle ist deshalb bewusst ein Parameter von
  `pstg_year_totals`: fällt die Antwort auf "alle melden", ist das eine Zeile.
- **Kein Index auf `contracts` nötig** (gemessen, 200.000 Verträge): ohne Index
  73 ms, der naheliegende Partial-Index macht es mit 84 ms *langsamer*, nur ein
  Ausdrucks-Index auf das Berlin-Jahr bringt 26 ms. Bei einem Lauf pro Jahr ist
  das spekulativ — bewusst ohne Index gemergt. Erst nötig, wenn die Funktion
  quartalsweise oder aus einem Dashboard gerufen wird.

### Aus dem CFO-Review zu #155 (28.07.) — Folgeaufgaben
- ~~`radar.early_fraud_warning.created` behandeln.~~ **ERLEDIGT 29.07.**
  (Migration 0640, db-test 81 -> 84). Zusammen mit `charge.refund.updated`
  (fehlgeschlagene Erstattung korrigiert den Stand) und
  `charge.dispute.funds_withdrawn`/`funds_reinstated` (die tatsächlichen
  Cash-Bewegungen, getrennt vom Status).
  **WICHTIG — die Automatik ist bewusst AUS.** Der Mechanismus ist gebaut, aber
  eine Frühwarnung ist eine Wahrscheinlichkeitsaussage, keine Feststellung;
  automatisch zu erstatten hiesse, einem womöglich ehrlichen Kunden
  unaufgefordert zu stornieren und dem Anbieter die Arbeit zu entziehen. Das ist
  eine Geldbewegung ohne menschliche Prüfung und damit Founder-Entscheidung.
  Scharf schalten mit dem Secret `STRIPE_AUTO_REFUND_ON_FRAUD_WARNING=true`;
  Abwägung steht in `docs/todo/OFFENE-FOUNDER-TODOS.md`. Solange es fehlt, wird
  jede Warnung auf Fehler-Ebene protokolliert (mit Betrag und der Angabe, ob
  schon an den Anbieter ausgezahlt wurde) und als `fraud_warning_action='offen'`
  vermerkt — eine Erstattung von Hand im Dashboard wendet den Chargeback genauso ab.
- **`app/rechnung.tsx`:** zeigt nach einer Erstattung unverändert den vollen
  `customer_total` als „du zahlst". Eine Zeile „Erstattet: −X,XX €" ist immer
  richtig. Ob das umsatzsteuerlich eine Rechnungsberichtigung nach § 14c/§ 17
  UStG auslöst, hängt daran, ob Werkant für die Leistung selbst abrechnet oder
  nur für die Provision — **Steuerberater**.
- **Kontotyp der Connect-Konten dokumentieren.** Es gibt im Repo kein
  `accounts.create` — die Konten entstehen offenbar per Hand im Dashboard.
  Damit hängt der Kontotyp (und mit ihm das Haftungsregime) an einer
  Klick-Entscheidung ohne Codebeleg. Gehört nach `notes/04-Entscheidungen/`,
  sonst ist in zwei Jahren nicht mehr rekonstruierbar, unter welchem Regime die
  Altfälle liefen.
- **Steuerberater-Frage zu `provider_clawback_amount`:** wird je zurückgeholt,
  korrigiert das dann das *Meldejahr der ursprünglichen Zahlung* oder mindert es
  das *Jahr der Rückholung*? Auslegung zu § 15 PStTG, entscheidet nicht der Code.

### Aus dem CCO-Review zu #156 (29.07.) — offen
- **Die Betrugs-Automatik darf NICHT eingeschaltet werden**, bis AGB-Klausel,
  Benachrichtigung beider Seiten und Art.-22-Konformität stehen. Details und
  Begründung in `docs/todo/OFFENE-FOUNDER-TODOS.md` — der Eintrag las sich
  vorher wie eine Abwägung, tatsächlich wäre Einschalten heute ein Fehler.
- **Speicherdauer der Betrugsvermerke ungeregelt.** `contracts` unterliegt
  10 Jahren (HGB §257 / AO §147), aber ein Betrugsvermerk ist kein
  Handelsbuchbeleg — ihn 10 Jahre mitzuschleppen ist ein Zweckbindungsproblem
  (Art. 5 Abs. 1 lit. e). `delete-account` pseudonymisiert nur `profiles`,
  `fraud_warning_*` überlebt die Kontolöschung damit unbegrenzt. Vorschlag des
  CCO: eigene Löschfrist, ~13 Monate (an der Chargeback-Frist orientiert).
- **Art. 14 DSGVO:** die Verarbeitung einer vom Kartennetz gemeldeten
  Betrugswahrscheinlichkeit steht nicht in `app/datenschutz.tsx` — Stripe ist
  dort als Empfänger gelistet, nicht als Quelle einer Bewertung.
- **UI wertet die neuen Spalten nicht aus.** Ein `completed`-Vertrag mit
  zurückgeflossenem Geld sieht in jeder Liste aus wie sauber abgeschlossen.
  `status` dafür zu ändern wäre falsch (es würde den Vertrag aus der
  DAC7-Meldung nehmen, obwohl die Vergütung geflossen ist) — der richtige Weg
  ist, `customer_refunded_amount`/`dispute_state` in den Screens zu zeigen.
  Betrifft `app/rechnung.tsx` (bestehender Eintrag) und die Auftragslisten.

### Nächster sinnvoller Testblock (nicht angefangen)
Echter Nebenläufigkeits-Test per `dblink` (in der Harness verfügbar, kein
Docker): zwei Sessions, S1 hält den Row-Lock, S2 blockiert nachweislich
(`dblink_is_busy = 1`), danach commit und `dblink_get_result` — zweimal rufen,
sonst scheitert der folgende commit. Der Test-Experten-Agent hat damit bereits
gezeigt, dass der ALTE Code eine Fortschreibung verliert und der neue nicht.

## Bereit zum Merge
Hier trägt der Autonom-Loop fertige, aber ungemergte Branches ein (er hat in
seinen Läufen keine GitHub-Tools). Format: Branchname — was drin ist —
Verifikations-Ergebnisse. Die nächste volle Session mergt und leert die Liste.

(leer — Stand 27.07., #147 wurde direkt gemergt)

## Update 2026-08-03 — Stripe-Webhook ausführbar testbar + P0-2 behoben

**Warum:** Der gesamte Geldpfad war nie ausgeführt worden — CI prüfte Edge
Functions nur mit `deno check`. 634 Zeilen Stripe-Logik ohne einen einzigen
Testlauf.

- **Extraktion:** `stripe-webhook/handler.ts` (neu) enthält die komplette
  Eventverarbeitung; `index.ts` schrumpft 634 → 57 Zeilen auf Client-Erzeugung,
  Signaturprüfung und Delegation. Der Kernblock ist maschinell als zeichengleich
  zum Vorzustand nachgewiesen (Z. 60–633 des alten `index.ts`).
- **Test-Doubles** (`_shared/testing/`): bewusst KEIN PostgREST-/Stripe-Nachbau.
  Sie protokollieren Aufrufe und liefern skriptierte Antworten. Filter werden
  NICHT ausgewertet — die reale CAS-Wirkung bleibt in
  `scripts/db-test/webhook-idempotency.sql` gegen echtes Postgres belegt.
- **Tests:** `supabase/tests/stripe-webhook_test.ts`, 13 Fälle, kein
  `--allow-none`, kein skip/ignore/todo.

**Behobener Geldfehler (P0-2), zuvor als roter Test reproduziert:**
`charge.refunded` schrieb `customer_refunded_amount` aus dem Event-*Snapshot*.
Folge (a) zwei Teilerstattungen in umgekehrter Zustellreihenfolge senkten den
Stand von 50 auf 30; Folge (b) nach berechtigtem Reset auf 0 durch ein
fehlgeschlagenes Refund hob eine verspätete Wiederholung ihn zurück auf 100 —
der Guard in `release-escrow` sperrte dann dauerhaft: Kunde ohne Geld, Anbieter
nie auszahlbar. `max(alt, neu)` löst (b) NICHT.
**Fix:** autoritativer Stand per `stripe.charges.retrieve()` statt Snapshot,
Schreiben mit CAS auf `customer_refunded_amount` und max. 3 Versuchen. Schlägt
der autoritative Abruf fehl → 500, keine DB-Änderung (Stripe wiederholt).
Mutationsprobe: Rückbau auf den Snapshot lässt genau die zwei Befund-Tests
fallen — die Tests sind nachweislich diskriminierend.

**Beweisgrad — wichtig:** Geprüft ist unsere eigene Handlerlogik gegen
Test-Doubles. Stripe selbst wurde NICHT getestet; es gibt bewusst keine
Stripe-Konfiguration (Founder-Entscheidung). Die Annahmen über Stripe
(kumuliertes `amount_refunded`, Snapshot-Semantik, keine Reihenfolgegarantie)
sind offizielle Semantik, nicht von uns verifiziert. Verifikation gegen den
echten Stripe-Testmodus steht aus.

**Baseline:** deno test 13/13 · deno check 13/13 Functions · tsc 0 · Jest
363/363 · db-test 85/85. `tsconfig.json` musste `supabase/tests/**` ausschließen
(sonst zieht der Import die Deno-Datei in die TS-Prüfung).

### Agenten-Reviews zu PR #159 — behoben und offen

Drei read-only Reviews (Security/adversarial, QA/Testkritik, Solution-Architect).
Jeder Befund vor Übernahme selbst am Code verifiziert.

**Behoben** (im geänderten Umfang, Tests 13→18):
- fail-open nach drei erfolglosen CAS-Versuchen: Kommentar sagte „nicht
  stillschweigend 200", Code tat genau das. Jetzt 500. „Kein Vertrag zum
  PaymentIntent" davon sauber getrennt (dort bleibt 200, Wiederholen hilft nicht).
- `charge.refund.updated` schrieb ohne CAS und konnte den frisch verbuchten Wert
  wieder überschreiben — dieselbe Schreibinversion über den Nachbarzweig.
- Test 10 war **falsch grün**: `upd.length === 0 ? 0 : …` liess „gar nicht
  geschrieben" als „korrekt 0 geschrieben" durchgehen (per Mutation nachgewiesen).

**OFFEN — ausserhalb des Umfangs von #159, nächste Blöcke:**
- **P0** `charge.dispute.funds_withdrawn`/`funds_reinstated`: Update-Ergebnis wird
  ohne `error`-Prüfung entgegengenommen, danach 200. Geld hat den Plattform-Saldo
  real verlassen, die DB weiss nichts davon, Stripe wiederholt nie. Bankauszug und
  Buchführung driften ohne Alarm auseinander.
- **P0** `contracts.stripe_payment_intent` speichert nur den LETZTEN PaymentIntent.
  Erstattung oder Chargeback auf einen älteren PI findet keine Zeile und
  hinterlässt weder Spur noch Alarm. Braucht eine Schemaänderung (Migration).
- **P1** Subscription-Zweige schreiben ebenfalls ohne `error`-Prüfung.
- **P2** `dispute_state` wird unbedingt überschrieben (verspätete `created`-
  Zustellung nach `closed` setzt zurück auf `open`); `dispute_fee` nur bei Fee > 0.

**Beweisgrad unverändert:** Doubles, nicht Stripe. Kein Stripe-Aufruf ausgeführt.

## Update 2026-08-03 — Webhook-Tests in CI (Block 2)

Neuer Schritt „Stripe-Webhook-Tests ausfuehren" im bestehenden `edge-check`-Job
(Deno ist dort schon eingerichtet — minimale Änderung, keine anderen Workflows).
Bewusst streng, gleiche Fehlerklasse wie bei `scripts/db-test/run.sh`:
expliziter Dateipfad statt Verzeichnis, kein `--allow-none`, Mindest-Testanzahl
wird geprüft statt nur gedruckt. Lokal alle vier Fälle nachgestellt: Normallauf
grün (18), fehlende Datei rot, zu wenige Tests rot, echter Testfehler rot in 2 s
ohne Wiederholung. Ein Review fand keinen Weg zu falschem Grün.

## Update 2026-08-03 — account.updated spiegelt jetzt beidseitig (Block 3)

`stripe_onboarded` war als Spiegel des Connect-Zustands dokumentiert, folgte aber
nur nach oben: einmal `true`, immer `true`. Sperrt Stripe ein Konto nachträglich
(`charges_enabled`/`payouts_enabled` fallen auf false), blieb der Anbieter in der
App voll onboardet — sichtbar auf der Startseite, in der Nachbarschaftsliste und
mit „verifiziert"-Abzeichen in der Suche. Jetzt wird der berechnete Zustand in
beide Richtungen geschrieben; die Sperrung landet auf Fehler-Ebene im Log.
Tests 18–21, vor dem Fix drei davon rot. CI-Mindestzahl 18 → 22.

**Weiterhin offen, gehört zu Block 4:** `release-escrow` prüft `stripe_onboarded`
NICHT — es verlangt nur, dass `stripe_account_id` existiert. Eine Auszahlung an
ein gesperrtes Konto wird also weiterhin versucht.

**Nachtrag Block 3 (Security-Review):** Dadurch, dass jetzt auch `false`
geschrieben wird, entstand eine NEUE Reihenfolge-Lücke — ein verspätetes altes
„gesperrt"-Event hätte einen wieder freigeschalteten Anbieter dauerhaft
unsichtbar gemacht. Gelöst wie beim Erstattungsstand: `stripe.accounts.retrieve()`
liefert den massgeblichen Zustand, Fehlschlag → 500 ohne DB-Änderung.
Tests 22/23. Mindestzahl 24.

## Update 2026-08-03 — release-escrow ausführbar testbar (Block 4)

Extraktion wie beim Webhook: `release-escrow/handler.ts` (neu) enthält die
Logik, `index.ts` schrumpft 256 → 38 Zeilen. Kernblock (207 Z.) maschinell als
zeichengleich nachgewiesen. 23 Tests, CI-Mindestzahl 43 → 47.

**Behoben (eindeutiger Zählfehler):** Das Vertrags-Update war bedingungslos.
Die Guards davor sind Read-then-Act — zwei gleichzeitige Anfragen kommen beide
durch. Der Idempotency-Key schützt den Stripe-Transfer, aber NICHT den
PStTG-Jahreszähler: der stieg zweimal für eine Auszahlung. Zu hoch gezählt
meldet den Anbieter dem BZSt mit einer Vergütung, die er nie erhalten hat
(§ 3 Abs. 5 PStTG). Jetzt CAS auf `escrow_released_at`; wer das Rennen
verliert, zählt nicht und benachrichtigt nicht.

**OFFEN — P0, NICHT behoben, Merge bewusst zurückgehalten:**
Der Stripe-Transfer läuft VOR dem Vertrags-Update. Schlägt das Update fehl
(DB-Timeout), ist das Geld beim Anbieter, `escrow_released_at` bleibt leer, und
der Kunde bekommt 500. Alle Guards lassen einen erneuten Versuch zu. Innerhalb
24 h schützt der Idempotency-Key; danach verwirft Stripe ihn und ein zweiter
echter Transfer ist möglich — **doppelte Auszahlung**. Es gibt keine lokale
Spur der Transfer-ID unabhängig von der `contracts`-Zeile.
Beide denkbaren Lösungen sind Architekturentscheidungen: (a) Ledger-Tabelle vor
dem Transfer (Migration, neue Tabelle, RLS) oder (b) Reihenfolge umkehren
(erst reservieren, dann überweisen) — (b) erzeugt den umgekehrten Fehler, wenn
der Transfer nach der Reservierung scheitert. Der sichere Sollzustand ist
NICHT eindeutig → dokumentiert statt eigenmächtig behoben.

**Ebenfalls offen (Founder-Entscheidung):** `release-escrow` prüft
`stripe_onboarded` nicht. Test 12 hält den Ist-Zustand fest.

## Update 2026-08-03 — Payout-Ledger (Migration 0650), P0 aus #162 geschlossen

**Founder-Entscheidung:** Option A in präzisierter Form — dauerhafte lokale
Auszahlungsoperation mit Reconciliation. Option B (erst completed, dann Transfer)
wurde abgelehnt.

Ablauf: `payout_claim` (atomar, unique auf contract_id, `for update` auf den
Vertrag) → Abgleich bei Stripe über `transfer_group` → nur bei 0 Treffern
`accounts.retrieve` (`payouts_enabled` muss true sein) → `transfers.create` mit
dem in der Operation gespeicherten Idempotency-Key → Transfer-ID festhalten →
`payout_finalize` (Operation, Vertrag, Auftrag, PStTG in EINER Transaktion).
Jeder Teilfehler ist fail-closed und wiederaufnehmbar.

### ZWEI SCHEMA-/CODE-ABWEICHUNGEN beim Replay gefunden — beide gravierend
1. **`provider_profiles.stripe_account_id` existierte NICHT.** Keine Migration
   legte sie an; `release-escrow` las sie (`.select`) und `stripe-webhook`
   filterte darauf (`.eq`). Folge: **jede Auszahlung scheiterte** mit „Provider
   Stripe account not found", und `stripe_onboarded` konnte **nie** true werden
   — womit die Sichtbarkeitsfilter auf Startseite und in der Suche niemanden
   zeigten. Spalte in 0650 ergänzt, mit Schreibschutz im Trigger (sonst könnte
   ein Anbieter sein eigenes Auszahlungsziel bestimmen).
2. **`jobs.completed_at` existiert nicht**, wurde aber geschrieben. Damit
   scheiterte der GESAMTE Update — der Auftrag blieb nach einer Auszahlung auf
   `active`. Der Fehler war nur geloggt.

**Achtung:** Punkt 1 macht Auszahlungen NICHT funktionsfähig. Es gibt im ganzen
Repo **keinen Connect-Onboarding-Pfad**, der die Spalte je füllen würde. Der
Fehler wandert von „unbekannte Spalte" zu einem ehrlichen
„provider_without_stripe_account". Das Onboarding zu bauen ist eine eigene
Aufgabe und berührt Stripe-Konfiguration.

### Reviews (drei, alle Befunde selbst reproduziert und behoben)
- **P0** Ein rückabgewickelter Transfer (`reversed`) galt beim Abgleich als
  passend — der Vertrag wäre als bezahlt geschlossen worden, der Anbieter hätte
  nichts. Jetzt Sperre.
- **P1** Der Sperr-Vermerk (`manual_review`) prüfte keinen Fehler; schlug er
  fehl, entstand nie ein Datensatz für den Support.
- **P1** Das `transferred`-Update konnte eine gleichzeitig gesetzte Sperre
  zurückdrehen. Jetzt `.neq("status","manual_review")`.
- **P2** Der Abgleich blätterte nicht (`has_more`) — jetzt fail-closed.
- **TOCTOU** `payout_finalize` prüft Erstattung und Rückbuchung erneut: zwischen
  Beanspruchen und Finalisieren liegt der Stripe-Aufruf, und in diesem Fenster
  kann ein `charge.refunded` eintreffen.
- **Falsch grün in meinem eigenen Test:** Die beiden `dblink`-Aufrufe liefen
  nacheinander, nicht überlappend — der Test blieb grün, wenn man `for update`
  entfernte. Jetzt `dblink_send_query` (echt gleichzeitig) plus ein Test, der
  eine offene Fremdtransaktion nachstellt. Gegenprobe: ohne `for update` bricht
  er mit einer Unique-Verletzung ab.

Baseline: deno test 62 (24 + 38, Mindestzahl je Datei in CI) · deno check 13/13 ·
tsc 0 · Jest 363/363 · db-test 98. Kein echter Stripe-Aufruf.

## Update 2026-08-05 — cancel-contract testbar, Doppelerstattung geschlossen

Extraktion wie zuvor: `cancel-contract/handler.ts` (neu), `index.ts` 222 → 36 Z.
Kernblock (187 Z.) zeichengleich; einzige Ausnahme ist der injizierte `sendPush`
statt eines inline-`fetch` (sonst löste jeder Testlauf eine echte Netzanfrage aus).
36 Tests.

**Behoben — Doppelerstattung (drei Wege):** Der Handler las **nie**, ob bereits
Geld zurückgeflossen ist. Eine Dashboard-Erstattung, eine Support-Erstattung oder
die proaktive Erstattung nach einer Betrugs-Frühwarnung waren unsichtbar; die
Stornierung erstattete den vollen Quotenbetrag ein zweites Mal. Jetzt Abgleich per
`refunds.list(payment_intent)` vor jeder Erstattung, nur die Differenz wird
erstattet; `failed`/`canceled` zählen nicht; `has_more` → 409; Abgleich-Fehler →
503 ohne DB-Änderung.

**KEINE `refund_operations`-Tabelle gebaut.** Begründung: Anders als beim Transfer
(wo die `transfer_group` erst von der Anwendung gesetzt wird) ist der
PaymentIntent bereits ein dauerhafter Anker auf `contracts`. `refunds.list` liefert
denselben Wiederaufnahme-Schutz ohne Schemaänderung.

**Zwei P0 aus den Reviews:**
1. *Selbst eingebaute Regression:* Ich hatte den Differenzbetrag in den
   Idempotency-Key aufgenommen. Kunde (50 %) und Anbieter (100 %) haben
   unterschiedliche Quoten — mit Betrag im Schlüssel wären es zwei Schlüssel,
   Stripe hätte nicht dedupliziert und 150 % erstattet. Schlüssel wieder
   vertragsweit.
2. Der `unrecordedCapture`-Zweig ließ `escrow_captured_at` leer. Genau darauf
   prüft `stripe-webhook/handler.ts:191` und erstattet bei einem verspäteten
   `payment_intent.succeeded` **nochmals voll**, unter eigenem Schlüssel. Jetzt
   wird die erfasste Zahlung vermerkt.

**Fachlich unverändert und weiterhin offen:** Erstattungsquoten (100/50/0 %),
Stornofristen, Anbieterentschädigung, und wem das bei Null-Erstattung
einbehaltene Geld zusteht. Die Tests halten den Ist-Zustand fest, ohne ihn zu
bestätigen.

**Offen (dokumentiert, nicht behoben):** Erstattung gelaufen, DB-Update
gescheitert, Nutzer bricht ab → Vertrag bleibt aktiv mit erstattetem Geld; ohne
Ledger oder Abgleich-Job findet das niemand ohne erneuten Aufruf. `pending`
gezählte Erstattungen, die später fehlschlagen, werden nicht nachgereicht.

Beweisgrad: mit Doubles getestet. **Kein echter Stripe-Aufruf.**
Baseline: deno test 98 (24+38+36) · deno check 13/13 · tsc 0 · Jest 363 · db-test 98.

## Update 2026-08-05 — offene Webhook-Geldfehler geschlossen (Block 2)

Vier bestätigte Fälle, alle zuerst als roter Test reproduziert:

1./2. **`charge.dispute.funds_withdrawn` / `funds_reinstated`** nahmen das
   Update-Ergebnis ohne Fehlerprüfung entgegen und antworteten 200. Geld hatte
   den Plattform-Saldo real verlassen oder war gutgeschrieben worden, die DB
   wusste nichts davon — und Stripe wiederholte nie. Jetzt 500 bei DB-Fehler;
   „kein Vertrag gefunden" bleibt 200 (Wiederholen hilft dort nicht).
3. **Subscription-Zweige** (drei Schreibvorgänge) prüften ihre Fehler nicht.
   Der Billing-Zustand konnte dauerhaft auseinanderlaufen. Jetzt 500.
4. **`dispute_state` konnte rückwärts.** Ein verspätetes `created` nach einem
   verarbeiteten `closed` setzte den Zustand auf `open` — und `release-escrow`
   sperrt die Auszahlung, solange der offen ist. Ein gewonnener Dispute hätte
   den Anbieter dauerhaft blockiert. Jetzt Bedingung
   `dispute_state.is.null,dispute_state.eq.open` beim Setzen auf `open`;
   Endzustände überschreiben weiterhin unbedingt.

**Zusätzlich, angekündigte Umfangserweiterung — P0 des Architektur-Reviews:**
`release-escrow` blockierte nur `dispute_state === 'open'`, nicht `'lost'`. Bei
einer verlorenen Rückbuchung hat die Bank des Kunden den Betrag endgültig
eingezogen; dabei entsteht **kein** Refund-Objekt, `customer_refunded_amount`
bleibt 0, der Guard darüber griff nicht. Die Auszahlung wäre der zweite Verlust
gewesen. `'won'` und `'closed_other'` blockieren bewusst nicht.

**Falsch grün in eigener Arbeit (QA-Review):** Test 31 prüfte nur, dass
*irgendein* `.or()` den Teilstring `dispute_state` enthält — eine semantisch
verkehrte Bedingung wäre durchgerutscht. Jetzt exakter Vergleich, **und** die
Wirkung ist gegen echtes Postgres belegt (`webhook-idempotency.sql`, 99
Assertions).

**Offen, dokumentiert:** `messages.insert` und das `fraud_warning_at`-Update
prüfen ihre Fehler weiterhin nicht (beide P2, keine Geldbewegung).
`dispute_funds_withdrawn` ist ein Boolean — der Betrag steht nur im Log, für den
Kontenabgleich über zehn Jahre wäre eine Spalte nötig (P1).

Baseline: deno test 111 (34+41+36) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 99. Beweisgrad: Doubles plus echtes Postgres. Kein echter Stripe-Aufruf.

## Update 2026-08-05 — PaymentIntent-Historie: Plan (Block 3, read-only)

`docs/architecture/PAYMENT-INTENT-HISTORY-PLAN.md`. Kein Code geändert.

Kern: `contracts.stripe_payment_intent` speichert nur den letzten Intent; acht
Lesewege im Webhook filtern darauf. Ein Ereignis zu einem älteren Intent findet
keine Zeile und hinterlässt weder Spur noch Alarm. Vorgeschlagen ist eine
additive Tabelle `contract_payment_intents` mit dem Intent als Primärschlüssel
und einem partiellen Unique-Index für „genau einer ist aktuell"; die alte Spalte
bleibt als Spiegel. **Günstigster Zeitpunkt:** Es gibt keine Produktionsdaten —
Stripe ist nicht eingerichtet, es existierte nie ein PaymentIntent.

Zwei Punkte sind ausdrücklich **nicht** entschieden: was bei einer erkannten
Doppelbelastung geschehen soll, und ob `cancel-contract` beim Abgleich alle
Intents statt nur des letzten heranziehen soll. Beides verändert tatsächlich
fliessendes Geld und ist damit fachlich.

## Update 2026-08-06 — PaymentIntent-Historie umgesetzt (Migration 0660)

Der Plan aus dem letzten Block ist umgesetzt. `contract_payment_intents` hält
**alle** Intents je Vertrag, nicht nur den letzten; der Intent ist
Primärschlüssel, ein partieller Unique-Index erzwingt „genau einer ist aktuell".
`contracts.stripe_payment_intent` bleibt als Spiegel und wird von der RPC
mitgepflegt. Alle acht Webhook-Lesewege lösen jetzt über die Historie auf — ein
Ereignis zu einem **älteren** Intent findet damit seinen Vertrag statt spurlos zu
verschwinden.

**Zwei Entscheidungen, die im Plan offen waren — selbst getroffen und hier
notiert, damit sie umkehrbar bleiben:**
1. *Erkannte Doppelbelastung → sperren, nicht automatisch erstatten.* Eine
   automatische Geldbewegung ohne menschliche Prüfung ist genau das, was bei der
   Betrugs-Frühwarnung bewusst eingefroren wurde.
2. *`cancel-contract` gleicht über alle Intents ab.* Hat der Kunde auf einem
   älteren Intent bereits Geld zurückbekommen, hat er es für diesen Vertrag
   bekommen. Mitzuzählen macht die Differenz kleiner — die sichere Richtung. Die
   Quote selbst bleibt unverändert.

**P0 aus dem Architektur-Review, an der Wurzel behoben:** War ein Intent bereits
`succeeded` (bezahlt, Webhook noch ausstehend), erzeugte
`create-payment-intent` einen **zweiten** — eine Doppelbelastung des Kunden, und
der Spiegel zeigte danach auf einen unbezahlten Intent, während das Geld auf dem
alten lag. Eine spätere Stornierung hätte gegen den falschen Intent erstattet.
Jetzt 409 statt zweitem Intent.

**Falsch grün in eigener Arbeit (QA-Review):** Mein dblink-Nebenläufigkeitstest
blieb auch ohne `for update` grün — der Schutz kommt vom partiellen Unique-Index.
Assertion verschärft (beide Registrierungen erfolgreich, genau zwei Zeilen), und
Kommentar in Test **und** Migration korrigiert, statt mehr zu behaupten.

**Offen, dokumentiert:** Bei zwei real bezahlten Intents am selben Vertrag ist
`customer_refunded_amount` eine Vertragsspalte, wird aber je Charge gesetzt —
ein Ereignis auf dem alten Intent überschreibt den Stand des aktuellen (P1). Eine
erkannte Doppelbelastung ist nur im Log sichtbar, nicht als Datensatz (P1).

Baseline: deno test 134 (40+41+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 107. Beweisgrad: Doubles plus echtes Postgres inkl. echter
Nebenläufigkeit. Kein echter Stripe-Aufruf.

---

## Block: Rückbuchungsbetrag + INSERT-Sperre auf `contracts` (2026-08-07)

**Ausgangspunkt** war eine kleine, rein additive Buchhaltungslücke: `contracts.
dispute_funds_withdrawn` ist ein Boolean. Ob Geld geflossen ist, stand in der
Datenbank — wie viel und wann, nur in einer `console.error`-Zeile. Nach der
Log-Rotation ist der Abgleich zwischen Bankauszug und Buchführung aus der
Datenbank allein nicht mehr rekonstruierbar, und zwar über zehn Jahre
Aufbewahrung (HGB § 257).

**Migration 0670** ergänzt `dispute_amount_cents`, `dispute_funds_moved_at` und
`stripe_dispute_id` samt Guard-Blöcken. Der Handler schreibt sie im
Rückbuchungs-Zweig. Drei Entscheidungen, die ich selbst getroffen habe:

1. *Cent als `integer`, obwohl die übrigen Geldspalten `numeric`-Euro sind.*
   Stripe liefert ganze Cent; jede Umrechnung wäre eine Rundungsgelegenheit.
   Präzedenzfall ist `contract_payment_intents.amount_cents` (0660). Geprüft:
   kein Konsument summiert Vertragsspalten generisch, die Spalte kann nirgends
   versehentlich als Euro mitgezählt werden.
2. *Zeitstempel aus `event.created`, nicht aus der eigenen Uhr.* Maßgeblich ist,
   wann Stripe das Geld bewegt hat, nicht wann der Handler das Ereignis
   verarbeitet. Bei einer Zustellwiederholung Stunden später fiele der
   Unterschied sonst genau in die Zeile, die den Bankauszug erklären soll.
3. *Fehlt `dispute.amount`, wird `null` geschrieben statt der alte Wert
   stehengelassen.* Ein alter Betrag neben einem neuen Zeitpunkt wäre eine
   Buchung, die es nie gab — schlimmer als eine erkennbare Lücke.

**Der eigentliche Fund dieses Blocks war ein anderer (P0, Migration 0680).**
Das Security-Review fragte, ob der Guard-Trigger für die neuen Spalten
ausreicht. Er reicht nicht — und zwar für keine der geschützten Spalten:
`trg_guard_contracts_sensitive_cols` ist `before update` und feuert bei INSERT
nie. Die einzige INSERT-Schranke war die RLS-Policy aus 0050, und die prüft nur
`auth.uid() = customer_id` plus Job-Eigentümerschaft, nichts über Spaltenwerte.

Gegen einen frischen Migrations-Replay verifiziert: ein angemeldeter Kunde legt
eine Vertragszeile mit `provider_payout = 9999`, `customer_total = 0.01`,
`status = 'active'`, gesetztem `escrow_captured_at` und erfundenem
`stripe_payment_intent` an. Kein Trigger, keine Policy hält das auf. Und weil
`release-escrow` den PaymentIntent **nicht** gegen Stripe prüft, sondern
`status`, `escrow_captured_at` und `provider_payout` aus der Zeile liest, wäre
daraus ein echter Transfer vom Plattform-Saldo geworden. Geld raus, ohne dass je
Geld reinkam.

0680 entzieht `authenticated` und `anon` das INSERT-Recht. Das kostet keine
Funktionalität: es gibt keinen einzigen clientseitigen `contracts`-Insert, jeder
legitime Vertrag entsteht in `accept_offer()`, und die Funktion ist
`security definer`. Test Z2 sichert genau das ab — ein Fix, der den Annahme-Weg
mitnimmt, wäre kein Fix.

**Zusätzlich:** `export-my-data` listete die neuen Spalten nicht (Art. 15/20
DSGVO) — nachgezogen.

**Alarm-Mails abgestellt (Founder-Anliegen).** Zwei Quellen, nicht eine:
`health.yml` (2×/Tag, rot seit dem 27.07., weil RESEND/Stripe-Secrets bewusst
nicht gesetzt sind) und `loop-heartbeat.yml` (1×/Tag). In beiden ist der
Zeitplan auskommentiert, `workflow_dispatch` bleibt, mit Anleitung zum
Wiederscharfschalten in der Datei. Begründung dort notiert: ein täglicher Alarm
über einen absichtlich herbeigeführten Zustand ist kein Detektor, sondern
Rauschen — und trainiert genau die Alarmblindheit, gegen die diese Workflows
gebaut wurden. Nebeneffekt, der ehrlich dazugehört: solange der Zeitplan aus
ist, bliebe auch ein *neuer* 404 der health-Function unbemerkt.

**Offen, bewusst nicht in diesem Block:**
- *Guard-Trigger deckt weiterhin nur UPDATE ab.* 0680 schließt den Weg dorthin,
  aber ein künftiger pauschaler `grant insert on all tables` (0420 war einer)
  öffnet ihn wieder. Der Trigger auf `before insert or update` zu erweitern ist
  nicht trivial: bei INSERT ist `OLD` nicht zugewiesen, ein Vergleich
  `new.x is distinct from old.x` läuft auf einen Fehler, und `accept_offer`
  schreibt geschützte Spalten legitim. Eigener Block mit eigenem Rot-Test.
- *`release-escrow` prüft den PaymentIntent nicht gegen Stripe.* Nach 0680 fehlt
  der Einstieg, aber die Prüfung selbst wäre die eigentliche Tiefenverteidigung.
- *Keine Reihenfolgesicherung im Rückbuchungs-Zweig (P2, vorbestehend).* Ein
  außer der Reihe zugestelltes `funds_withdrawn` kann ein späteres
  `funds_reinstated` überschreiben. Betrifft `dispute_funds_withdrawn` seit je;
  die neuen Spalten erben es. Ein CAS über `dispute_funds_moved_at` wäre der
  Weg, braucht aber die Unterscheidung „veraltetes Ereignis" (200) von „Zeile
  fehlt" (500) und damit einen eigenen Test.

Baseline: deno test 141 (47+41+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 111. Sechs Mutationen geprüft (Betrag weg, Vorgangs-ID weg, eigene Uhr
statt Stripe-Uhr, `undefined` statt `null`, Guard weg, `revoke` weg) — jede
macht ihren Test rot. Beweisgrad: Test-Doubles plus echtes Postgres. Kein echter
Stripe-Aufruf, keine Produktionsänderung.

---

## Block: Guard-Trigger deckt INSERT ab (0690) — 2026-08-09

Der im vorigen Block dokumentierte oberste offene Punkt, jetzt geschlossen.

`0680` hatte Client-Rollen das INSERT-Recht auf `contracts` entzogen und damit
einen verifizierten P0 versperrt. Das war aber **nur eine Rechtevergabe**, und
`0420` enthält `grant select, insert, update, delete on all tables in schema
public to anon, authenticated` — eine weitere Migration dieser Art dreht `0680`
lautlos zurück, und dann greift nichts mehr, weil der Guard seit `0300`
`before update` ist und bei INSERT gar nicht feuert.

`0690` erweitert ihn auf `before insert or update`.

**Zwei Dinge, die der Test aufgedeckt hat und die den Entwurf geändert haben:**

1. *`security definer` machte die Unterscheidung unmöglich.* In einer
   security-definer-Funktion ist `current_user` immer deren Eigentümer — der
   Zweig „ist das ein Client oder `accept_offer`?" hätte nie gegriffen. Über die
   GUC `role` geht es nicht, denn die bleibt auch innerhalb von `accept_offer`
   auf `authenticated`. Lösung: der Trigger ist jetzt **invoker**. Unbedenklich,
   weil er keine Tabelle liest oder schreibt — die erhöhten Rechte hatte er nie
   gebraucht.
2. *Spaltenweiser INSERT-Schutz ist eine Illusion.* Der erste Entwurf verbot
   jede der 25 Spalten einzeln. `status` hat einen Spalten-Default, ist also bei
   JEDEM Insert gesetzt, und der Trigger warf immer dort — die übrigen 24
   Prüfungen wurden nie erreicht und ließen sich einzeln entfernen, ohne dass
   ein Test rot wurde. Ein Schutz, den kein Test von seinem Fehlen unterscheiden
   kann, ist keiner. Jetzt wird der ganze Vorgang abgelehnt: Client-Rollen legen
   nie Verträge an, jeder legitime entsteht in `accept_offer()`.

**Falsch grün in eigener Arbeit, zweimal in Folge gefunden:** Meine erste
Z4-Fassung setzte alle Spalten auf einmal — sie belegte nur, dass *irgendeine*
Prüfung feuert. Die zweite prüfte spaltenweise, fing aber jeden Fehler ab; da
die meisten Spalten `NOT NULL` sind, scheiterte der Minimal-Insert ohnehin, und
der Test blieb grün, obwohl die Prüfung entfernt war. Erst die dritte Fassung
verlangt den Fehler **des Triggers** und dass er `0690` nennt.

**Vier Mutationen geprüft, jede macht den Test rot:** Trigger zurück auf
`before update`; zurück auf `security definer`; INSERT-Zweig entschärft;
INSERT-Zweig entfernt. Die letzte bricht zusätzlich `accept_offer` (38 statt 113
Assertions) — das belegt, dass der Zweig nicht nur schützt, sondern die
Auftragsannahme überhaupt erst durchlässt.

Baseline: deno test 141 · deno check 13/13 · tsc 0 · Jest 363 · db-test 113.
Kein echter Stripe-Aufruf, keine Produktionsänderung.

**Offen, unverändert:** `release-escrow` prüft den PaymentIntent nicht gegen
Stripe. Nach 0680/0690 fehlt der Einstieg, aber die Prüfung selbst wäre die
eigentliche Tiefenverteidigung — nächster Block. Ebenfalls offen: keine
Reihenfolgesicherung im Rückbuchungs-Zweig (P2, vorbestehend).

---

## Block: release-escrow fragt bei Stripe nach (2026-08-09)

Der letzte offene Punkt der Geldpfad-Kette aus 0680/0690.

Bis hierher glaubte die Auszahlung ausschließlich der eigenen Zeile:
`status='active'`, `escrow_captured_at` gesetzt, `provider_payout` — fertig,
Transfer raus. Die Zeile ist seit 0680/0690 gegen direktes Anlegen gesperrt,
aber die gesamte Geldsicherheit an einer einzigen Schranke aufzuhängen ist
genau die Konstruktion, die beim ersten Fehler bricht. Jeder Weg, der je
wieder eine Vertragszeile schreiben kann — ein zurückgedrehter Rechte-Entzug,
ein Fehler in einer Edge Function, ein Datenimport — wäre sofort echter
Geldabfluss.

`release-escrow` prüft jetzt **vor dem Beanspruchen und vor jedem Transfer**:

1. Der Vertrag trägt überhaupt eine PaymentIntent-ID.
2. Stripe kennt sie.
3. `status === 'succeeded'`.
4. `amount_received >= round(customer_total * 100)` — `amount_received`, nicht
   `amount`: letzteres ist nur der angeforderte Betrag und wäre bei einer
   Teilzahlung zu optimistisch.
5. `metadata.contract_id` zeigt auf genau diesen Vertrag — sonst wäre das
   Eintragen einer echten, bezahlten fremden Zahlung der bequemste Weg, alles
   Übrige zu erfüllen.

Nach außen wird zwischen diesen Gründen bewusst **nicht** unterschieden; das
wäre ein Hinweis darauf, wie nah ein Fälschungsversuch dran war. Der Grund
steht im Log.

**Reihenfolge:** Die Prüfung liegt vor `payout_claim`. Sie ist rein lesend, und
eine gescheiterte Prüfung soll keine Auszahlungs-Operation hinterlassen, die
später jemand von Hand auflösen muss.

**Fail-closed bei Stripe-Ausfall:** Ob Stripe die ID nicht kennt oder gerade
nicht erreichbar ist, lässt sich von hier aus nicht sicher unterscheiden (die
Fehlerform hängt an der Bibliothek). Beides führt zu 409 und einem lauten Log.
Im Zweifel kein Geld raus.

**Vier bestehende Tests mussten angepasst werden**, weil sich das Verhalten
echt geändert hat: Test 1 und 27 prüfen exakte Stripe-Aufrufreihenfolgen, 23
und 24 hießen „kein Stripe-Aufruf" und heißen jetzt „kein Transfer" — es gibt
dort genau einen lesenden Aufruf. Angepasst, weil das Verhalten anders ist,
nicht um Rot grün zu machen.

**Falsch grün in eigener Arbeit (Mutationsprobe M3):** Nimmt man die
`status !== 'succeeded'`-Prüfung heraus, blieb die Suite grün — Test 43
scheitert schon am Betrag. Test 48 schließt das. Dort ist ausdrücklich
vermerkt, dass NICHT verifiziert ist, ob Stripe die Kombination „voller Betrag
eingegangen, Status nicht succeeded" real erzeugt; die Prüfung ist an der
Stelle Gürtel-und-Hosenträger.

**`deno check` hat einen echten Fehler gefangen:** Beim Einfügen der
Meldungskonstante ist das `export` von `CORS` abgetrennt worden. `tsc` prüft
`supabase/functions/` nicht — ohne den Deno-Lauf vor dem Commit wäre das rot
in CI gelandet.

Baseline: deno test 148 (47+48+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 113. Sechs Mutationen geprüft, jede macht ihren Test rot.

**Stripe-Kategorie:** Die Semantik von `amount_received`, `status` und
`metadata` ist Annahme aus der offiziellen Stripe-Dokumentation (Kategorie 1).
Die eigene Handler-Logik ist mit Doubles belegt (Kategorie 2). Gegen echtes
Stripe-Testmodus ist nichts davon geprüft (Kategorie 3, offen).

**Offen:** Keine Reihenfolgesicherung im Rückbuchungs-Zweig des Webhooks (P2,
vorbestehend).

---

## Block: H1-VOLL nachgewiesen + Reihenfolge im Rückbuchungs-Zweig (2026-08-15)

### H1-VOLL war längst behoben — die Checkliste war veraltet

Der Pentest-Befund vom 22.07. („ein eingeloggter Nutzer kann `phone`,
`steuer_id`, die PStTG-Felder fremder Anbieter lesen") stand noch als offen in
`GO-LIVE-SECURITY-CHECKLIST.md`. Gegen einen frischen Migrations-Replay geprüft:
`0560` hat ihn geschlossen — auf `provider_profiles` ist nur noch die Policy
„Providers read own profile" übrig, der Browse läuft über die
Security-Definer-View `provider_public`. `jobs.address_street` liegt inzwischen
in `job_addresses` mit eigener RLS und ist in `rls-isolation.sql` getestet.

**Ich hätte fast vier redundante Assertions eingebaut.** Erst der Lauf zeigte,
dass `rls-isolation.sql` die Basistabellen-Fälle bereits abdeckt (Zeilen 90 und
102). Zurückgenommen, und nur die eine wirklich fehlende ergänzt:

*Die View führt keine sensible Spalte.* Die beiden bestehenden Assertions
belegen, dass die **Basistabelle** dicht ist. Der zweite Weg zu denselben Daten
ist die View, und die läuft als `security definer`, umgeht die RLS also
bewusst. Ein späteres `select pp.*` beim Erweitern hätte alles auf einmal
wieder geöffnet, ohne dass eine Policy angefasst wurde — und keine bestehende
Assertion hätte das gemerkt. Geprüft wird deshalb das **Schema** der View, nicht
ein Beispielwert. Mutationsprobe: `steuer_id` und `phone` in die View
aufgenommen → `FAIL: provider_public fuehrt sensible Spalten: phone, steuer_id`.

### P2: Reihenfolge der Rückbuchungs-Ereignisse

Stripe garantiert die Zustellreihenfolge nicht. Ein wiederholt zugestelltes
`funds_withdrawn` überschrieb bisher ein späteres `funds_reinstated` — die
Buchführung behauptete danach eine Abbuchung, die längst zurückgenommen war.

Das Update trägt jetzt
`dispute_funds_moved_at.is.null,dispute_funds_moved_at.lt.<Ereigniszeit>`.
Der Vergleich funktioniert nur, weil dort seit `0670` die **Stripe-Zeit** steht
(`event.created`) und nicht die eigene — sonst wäre „älter" keine sinnvolle
Aussage. Der `is.null`-Teil ist nicht kosmetisch: `spalte < wert` ist bei leerer
Spalte NULL, die allererste Buchung ginge sonst verloren. Genau das zeigt die
DB-Mutation.

Trifft das Update keine Zeile, wird jetzt unterschieden: veraltetes Ereignis →
200 (Stripe soll aufhören zu wiederholen, ein 500 baute hier eine
Endlosschleife); Ursache unklar → 500 (Stripe soll wiederholen).

### Ein stilles 200 als Sollverhalten festgeschrieben — von mir

Test 26 hieß „funds_withdrawn ohne zugehörigen Vertrag — 200" und prüfte in
Wahrheit etwas anderes: der Vertrag *wird* aufgelöst (die RPC liefert `c1`), nur
das Update traf keine Zeile — und das ging kommentarlos als Erfolg durch. Genau
die Klasse, die in diesem Projekt seit Wochen systematisch entfernt wird, stand
als Testerwartung im Repo. Der echte „kein Vertrag"-Fall ist in Test 39
abgedeckt. Test 26 ist umgeschrieben.

### Beweisgrad, sauber getrennt

Die Edge-Tests (49–51) belegen, dass die Bedingung **dasteht** und die richtige
Zeit trägt — der Supabase-Doppelgänger wertet Filter nicht aus. Ob sie
**wirkt**, zeigt `Y17` in `webhook-idempotency.sql` gegen echtes Postgres:
Einzug (t1) → Gutschrift (t2) → erneuter Einzug (t1) trifft null Zeilen, Stand
bleibt bei der Gutschrift.

Fünf Mutationen geprüft, jede macht ihren Test rot: `or`-Bedingung weg;
`is.null`-Teil weg; Altersvergleich entschärft; veraltet → 500; unklar → 200.
Dazu die DB-Mutation (`is null` aus Y17 → erste Buchung geht verloren).

Baseline: deno test 151 (50+48+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 115. Kein echter Stripe-Aufruf, keine Produktionsänderung.

---

## Block: Anbieter-Routen bekommen ein eigenes Pfad-Segment (2026-08-15)

Die Wurzel des Befunds aus #172, nicht mehr die Abmilderung.

`auftraege`, `nachrichten` und `profil` existierten in **beiden** Routen-Gruppen.
Gruppen erzeugen kein Adress-Segment, also beanspruchten je zwei Dateien
dieselbe sichtbare Adresse. Wer abgemeldet ein Lesezeichen öffnete, bekam unter
`/auftraege` das Handwerker-Dashboard.

`app/(provider)/` → `app/betrieb/`. Die Adressen sind damit eindeutig:
`/betrieb/dashboard`, `/betrieb/auftraege`, `/betrieb/nachrichten`.

**Warum `betrieb` und nicht `anbieter`:** `app/anbieter.tsx` gibt es bereits
(die öffentliche Anbieter-Detailseite) — genau dieselbe Kollision wäre wieder
entstanden.

**Das Ergebnis ist besser als die Abmilderung.** Vorher leitete der Rollen-Riegel
`/auftraege` zur Anmeldung um. Jetzt ist `/auftraege` eindeutig die
Kundenansicht und zeigt „Meine Aufträge · Nicht angemeldet" mit Einloggen-Knopf.
Der Riegel bleibt trotzdem — er hält jetzt den Fall ab, dass ein angemeldeter
**Kunde** `/betrieb/dashboard` öffnet.

**Drei Edge Functions verschickten Push-Nachrichten mit `/(provider)/…`-Zielen**
(`notify-matching-providers`, `cancel-contract`, `pstg-annual-report`). Ohne
Mitziehen hätte jede Benachrichtigung ins Leere gezeigt.

**Dabei aufgefallen:** `pstg-annual-report` verschickte `screen:
"/(provider)/steuer"` — diese Route hat es **nie gegeben**. Der Deeplink der
PStTG-Schwellen-Benachrichtigung zeigte seit jeher ins Leere. Korrigiert auf
`/einstellungen`, wo die PStTG-/DAC7-Daten tatsächlich liegen.

### Falsch grün in eigener Arbeit — die Mutationsprobe hat es aufgedeckt

Erster Lauf der Mutation (Verzeichnis zurück in die Routen-Gruppe):
**alle 6 Routen PASS**, obwohl der gesamte Anbieterbereich nicht mehr
erreichbar war. Grund: `/betrieb/dashboard` lieferte „Unmatched Route | Page
could not be found" — lang genug, um nicht als „leere Seite" zu gelten, und
ohne Anbieter-Marker. Der Test prüfte nur, was er *nicht* sehen wollte, nie ob
die Adresse überhaupt auflöst.

Nach der Verschärfung (tote Adressen zählen als Fehler): dieselbe Mutation →
**3 FEHLER**. Ohne diesen zweiten Lauf hätte ich einen Test committet, der
einen kompletten Bereichsausfall durchwinkt.

Baseline: tsc 0 · Jest 363 · deno test 151 · deno check 13/13 · db-test 115 ·
Routen 6/6 · Gast-Login 7/7 · Entwurf PASS.

**Offen bleibt:** Kein Gerätetest. Die Anbieter-Reise ab „Angebot abgeben" ist
weiterhin ungeprüft — sie hängt am KYC-Upload und damit an einer benutzbaren
Datenbank-Umgebung.

---

## Session 06.09.2026 — Kalt-Durchlauf aller 44 Bildschirme

Founder-Ansage: „Es gibt kein feature freeze jetzt ich will die app perfekt
haben." „Perfekt" in endliche Arbeit übersetzt: jeden Bildschirm einmal so
öffnen, wie ein Push, ein Deep-Link oder ein Lesezeichen ihn öffnet — ohne
Sitzung, mit Parametern, die auf nichts zeigen. Dieselbe Methode hatte am
16.08. bei den Geld-Bildschirmen drei erfundene Vorgänge gefunden.

**Neuer Prüfer:** `scripts/alle-screens-check.cjs`, in `scripts/reisen/run.sh`
eingehängt. 44 Bildschirme, 6 Prüfpunkte je Bildschirm, 264 gesamt.

### Der Befund: /anbieter hing bei totem Netz endlos

`/anbieter?id=<unbekannt>` zeigte eine weiße Fläche mit **einem** Zeichen Text
— nach elf Sekunden immer noch. Ursache: der Bildschirm ist öffentlich und
fragt sofort ab, statt wie die übrigen erst die Anmeldung zu verlangen.

**Der Unterschied, um den es geht:** Ein *fehlgeschlagener* Aufruf löst den
catch-Block aus, der Bildschirm zeigt seine Meldung. Ein Aufruf, der *nie
antwortet*, tut nichts davon — `finally` wird nie erreicht, `loading` bleibt
für immer true. Funkloch, Aufzug, Hotel-WLAN mit Anmeldeseite.

### Die Ursache saß tiefer als der eine Bildschirm

supabase-js hat **keine eingebaute Zeitgrenze**. Das war der dritte Befund
derselben Klasse (16.08.: /rechnung, /vertrag). Geflickt war es bisher je
Bildschirm mit `mitZeitgrenze()` — 4 von 17 Bildschirmen hatten es. Die
übrigen 13 laden nur im angemeldeten Zustand und sind mit dem Browser-
Durchlauf gar nicht nachweisbar; auf 13 Einzelfixes ohne Prüfung zu warten
hätte den Fehler nur unsichtbar gelassen.

**Deshalb eine Stelle statt dreizehn:** `lib/fetchZeitgrenze.ts` hängt eine
Zeitgrenze (20 s) in den `global.fetch` des Supabase-Clients. Aus „hängt ewig"
wird ein abgelehntes Promise — also genau der Fall, für den jeder bestehende
catch-Block geschrieben wurde.

**Ausgenommen: `/storage/v1/`.** Ein Gewerbeschein darf 10 MB groß sein
(`MAX_DOC_BYTES`); über eine schwache Mobilverbindung sind das viele Minuten.
Eine Zeitgrenze hätte ausgerechnet den Schritt abgeschnitten, an dem die
Bewerbung eines Handwerkers hängt.

### Zwei eigene Fehler, beide von der Gegenprobe aufgedeckt

**1. Der Prüfer war zu einem Drittel Fehlalarm.** Erster Lauf: 16 Fehler,
**13 davon meine Schuld**. Der Selektor `button,a,[role=button]` sieht
react-native-web nicht, das `Pressable` als `<div tabindex="0">` rendert — er
meldete auf dem Anmelde-Bildschirm „0 bedienbare Elemente", obwohl dort neun
stehen. Ein Prüfer mit Fehlalarmen wird abgeschaltet und nie wieder an.
Außerdem lief er **ohne Abfangen gegen die Produktion** (gegen die stehende
Test-Regel in AGENTS.md); jetzt 22 abgefangene Aufrufe je Lauf.

**2. Ein Test, der nichts prüfen konnte.** Die Mutation „Uploads bekommen doch
eine Grenze" ließ den Upload-Test **grün**. Grund: ein einzelnes
`await Promise.resolve()` reicht nicht — die Ablehnung muss erst durch
`.finally()` und dann durch `.catch()` wandern. Mit einem Tick blieb
`entschieden` immer false, egal was der Code tat. Nach dem Ersetzen durch eine
echte Mikrotask-Leerung bricht dieselbe Mutation **zwei** Tests.
Verwandte Schwäche im selben Zug gefunden: Test 1 prüfte nur, *dass*
abgebrochen wird, nicht *wann* — eine Grenze von 1 ms wäre durchgegangen.

### Gegenproben (alle nachgewiesen rot)

| Mutation | Wirkung |
|---|---|
| Zeitgrenze ganz entfernt | 1 Test rot |
| Uploads bekommen doch eine Grenze | 2 Tests rot |
| Grenze auf 1 ms verkürzt | 1 Test rot |
| Mitgegebenes Abbruch-Signal verworfen | 1 Test rot |
| Uhr wird nicht aufgeräumt | 1 Test rot |
| Bedienelemente entfernt (Browser) | 9 → 0, rot |

Baseline: tsc 0 · Jest 394 · db-test 173 · Bildschirme 264/264.

**Offen / ehrlich benannt:** Geprüft ist der **abgemeldete** Zustand. Was ein
angemeldeter Nutzer beim Laden sieht, ist weiterhin nicht durch einen
Browser-Durchlauf belegt — dafür bräuchte es Testkonten, und die dürfen laut
AGENTS.md nicht in der Produktion entstehen. Die globale Zeitgrenze deckt
diese Bildschirme jetzt trotzdem ab; sie zeigen im schlimmsten Fall nach 20 s
ihre eigene Fehlermeldung statt einer weißen Fläche. Kein Gerätetest.

---

## Session 06.09.2026 (nachmittags) — Abnahmefrist gebaut

Founder-Freigabe: „Go" auf die Empfehlung, die Frist zu bauen.

**Was jetzt existiert (Migration 0770):** Der Anbieter meldet Fertigstellung
→ 14-Tage-Frist läuft → Kunde gibt frei ODER meldet einen Mangel ODER
schweigt → nach Fristablauf fiktive Abnahme nach § 640 Abs. 2 BGB und
Auszahlung.

**Die drei Regeln, die aus dem Gesetz kommen und nicht verhandelbar sind:**
1. Ohne gemeldete Fertigstellung läuft keine Frist.
2. **Ohne gespeicherten Hinweistext keine fiktive Abnahme.** Der Hinweis nach
   § 640 Abs. 2 Satz 2 ist Tatbestandsmerkmal. Gespeichert wird der Wortlaut
   samt Fassungskennung (`abnahme_hinweis`, `abnahme_hinweis_fassung`) —
   dieselbe Lehre wie bei den Widerrufs-Zustimmungen (0710).
3. Ein offener Mangel hält die Frist an (`disputes.status <> 'resolved'`).

**Architektur-Entscheidung:** EIN Geldweg. `release-escrow` bekam einen
zweiten zulässigen Aufrufer (Admin-Secret), keine zweite Auszahlungsfunktion —
dort hängen Stripe-Abgleich, Erstattungs- und Rückbuchungssperren. Die
Berechtigung prüft aber die **Datenbank** (`payout_claim`, unter derselben
Zeilensperre wie die Auszahlung), nicht die Function: zwischen dem
Zusammenstellen der Fälligkeitsliste und dem Aufruf kann der Kunde noch einen
Mangel gemeldet haben.

**Ausdrücklicher Parameter `p_fiktive_abnahme` statt „p_caller ist null"** —
ein still durchgereichtes `null` (etwa eine undefinierte `user.id`) würde
sonst unbemerkt den automatischen Weg öffnen.

### OFFEN und kritisch: der geplante Lauf ist nicht eingerichtet

Die Datenbank kennt die Frist, führt aber von sich aus kein Geld ab. Ohne den
`pg_cron`-Auftrag passiert die automatische Freigabe **nicht** — und die
Website verspricht sie wieder. Anleitung: `docs/betrieb/abnahmefrist-lauf.md`,
Go-Live-Checkliste Punkt 11. **Das ist der Punkt, an dem die Zusage still
wieder brechen kann.**

### Zwei Tests, die nichts geprüft haben (beide von der Mutation gefunden)

- `now()` ist in Postgres die **Transaktionszeit**. Der Idempotenz-Test rief
  zweimal auf und verglich — beide Aufrufe berechneten dieselbe Frist, der
  Test konnte nicht rot werden. Jetzt wird die Frist zwischendurch verschoben.
- Die Längenprüfung des Admin-Secrets war unbelegt: kein Test verglich
  unterschiedlich lange Zeichenketten. Genau dort ist das Loch — richtiges
  Präfix plus Anhang kommt sonst durch.

Baseline: tsc 0 · Jest 394 · db-test 188 · deno test 158 · deno check 13/13 ·
Browser 264/264. 13 Mutationen nachgewiesen rot (8 DB, 5 Edge).

**Weiterhin offen:** Kein Gerätetest. ZAG-Frage ungeklärt (`zagGate` blockiert
Live-Zahlungen). UG nicht gegründet. Der Meisterbrief ist weiterhin optional —
`data/categories.ts` kennt kein Merkmal „meisterpflichtig"; die Website sagt
deshalb jetzt korrekt „können Sie hinterlegen".

---

## Session 07.09.2026 — Founder-Screenshots vom Gerät, PR #188

Zwei Tage Befund-Arbeit, ausgelöst durch Screenshots vom echten Gerät. 15
Commits, PR https://github.com/23mta23-cpu/Ruflo/pull/188.

### Der schwerste Befund: die App war live kaputt

Sechs Dateien bauten sich die Server-Adresse selbst zusammen
(`process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''`) — ohne den Rückfall aus
`lib/supabase.ts`. In der veröffentlichten Fassung ist die Variable leer
(`static.yml`: `secrets.… || ''`).

**Am Live-Bundle nachgemessen**, nicht vermutet: die Konstante ist `""`, die
App rief `https://23mta23-cpu.github.io/functions/v1/release-escrow` auf,
GitHub Pages antwortet mit **405**.

Kaputt waren: Freigabe des Treuhandbetrags, Stornierung beider Seiten,
Kontolöschung (Art. 17 DSGVO), Datenauskunft (Art. 15 DSGVO). **Sichtbar war
nichts** — die Knöpfe waren alle da.

Jetzt `SUPABASE_FUNCTIONS_URL` an einer Stelle. Bewacht von
`scripts/eine-adresse-check.py` — bewusst ein **Quelltext**-Prüfer: mit
gesetzter Umgebungsvariable ergeben beide Varianten denselben Wert, ein
Laufzeittest wäre grün.

### Das Muster hinter fast allem

Die App zeigte Zustände an, die sie nicht geprüft hatte:

- „Betrag eingefroren" wurde grün, sobald **unterschrieben** war
- Ein Vertrag hieß gleichzeitig „Aktiv", „Ausstehend" und bot „Zahlung starten"
- „Führt automatisch zu einem Strike" — gibt es nicht und soll es nicht geben
- Der Vertrag nannte seine Gegenseite nicht (die Abfrage lädt sie gar nicht)
- „Echte Bewertungen" / „Top bewertet" ohne eine einzige Bewertung
- Ein Termin blieb ewig „bestätigt", zehn Tage nachdem er vorbei war

Gegenmittel jeweils: **eine** Ableitung in `lib/`, mit Jest prüfbar
(`vertragsLage.ts`, `chatTage.ts`, `dauer.ts`).

### Der teuerste Bedienfehler

Der Anbieter-Kalender kannte nur Wochenschritte, und die einzige Sammelaktion
hieß „Woche sperren" — bei einer Vorgabe, in der ohnehin alles gesperrt ist.
**77 Tipper pro Woche**, um buchbar zu werden. Ohne freie Stunden ist kein
Betrieb buchbar, ohne buchbare Betriebe hat der Marktplatz kein Angebot.

### Vier neue Prüfer für vier blinde Flecken

| Prüfer | Findet |
|---|---|
| `alle-screens-check.cjs` | 44 Bildschirme kalt, auch bei totem Netz |
| `eine-adresse-check.py` | eigene Basisadressen (Verdrahtung) |
| `wortumbruch-check.cjs` | Wortbrüche mitten im Wort |
| `fussleisten-check.cjs` | klebende Leisten über dem Inhalt |

### Eigene Fehler, nur durch Mutationen gefunden

- **`now()` ist Transaktionszeit** — ein Idempotenz-Test konnte nicht rot werden
- Die **Längenprüfung des Admin-Secrets** war unbelegt (Präfix + Anhang kam durch)
- `detectLeak` war **nie getestet**: `chatGuard.ts` ließ sich wegen eines
  supabase-Imports in Jest gar nicht laden
- „seit 1 Monat" war ein **unerreichbarer Zweig**
- Eine Mutation ließ die Testzahl still von 447 auf 420 fallen, **ohne dass
  etwas rot wurde** — die Suite ließ sich nicht übersetzen

Baseline: tsc 0 · Jest 447 · db-test 202 · deno test 159 · deno check 13/13 ·
Browser 264/264, 3/3 Fußleisten, 25/25 Beschriftungen, 0 Adress-Abweichungen.

### OFFEN — das Wichtigste zuerst

1. **Geplanter Lauf für die Abnahmefrist ist NICHT eingerichtet.**
   `docs/betrieb/abnahmefrist-lauf.md`, Go-Live-Punkt 11. Ohne ihn kennt die
   Datenbank die Frist, führt aber von sich aus kein Geld ab — und die Website
   verspricht sie. Vault-Secrets sind gesetzt, `pg_cron`/`pg_net` noch nicht.
2. **Kein Gerätetest.** Alles über `dist/`-Export und Playwright geprüft.
3. Weiterhin: ZAG ungeklärt (`zagGate` blockiert Live-Zahlungen), UG nicht
   gegründet, `data/categories.ts` kennt kein Merkmal „meisterpflichtig".
4. **Null freigeschaltete Anbieter, Aufträge warten seit sechs Wochen.** Das
   ist die eigentliche Zahl — alles oben ist Kosmetik daneben.

---

## Session 07.09.2026 (abends) — Launch-Fähigkeit: DSA, Rechte, Store

**Auftrag des Founders:** „Die App muss stehen, damit wir diese auf appstore und
adroid publizieren können." Ausdrücklich gefragt nach dem EU AI Act.

### Die Antwort auf die AI-Act-Frage

**Nicht einschlägig, gemessen.** 139 Produktdateien: kein LLM, kein ML-Modell,
keine Embeddings, keine KI-Werbeaussage. Das Matching in
`notify-matching-providers` ist ein `.filter()`, die Chat-Warnung sind reguläre
Ausdrücke. Kein KI-System nach Art. 3 Nr. 1 KI-VO.

`scripts/ki-einsatz-check.py` (CI) schlägt an, sobald sich das ändert.
Dossier: `docs/recht/ki-vo-und-bfsg.md`.

**Einschlägig war der DSA — und der kam im Code überhaupt nicht vor.**

### Was gebaut wurde

| | |
|---|---|
| **0810** | Art. 16 `inhalts_meldungen`, Art. 17 `beschraenkungen` + `beschraenkung_erteilen/_begruendung/_aufheben`, Art. 18 `straftat_verdacht`, Art. 24(3) `aktive_nutzer_monat()` |
| **0820** | Ausführungsrechte von „erlaubt" auf „verboten" gedreht (Pentest-Befund) |
| `app/melden.tsx` | Meldeweg **ohne Anmeldung** (Art. 16 Abs. 1) |
| `supabase/functions/inhalts-meldung` | anonymer Endpunkt, Rate-Limit 5/h je IP, 10/Tag je E-Mail |
| AGB **§11** | Art. 14 Moderationsregeln |
| Impressum | Art. 11/12 Kontaktstellen + Meldeweg + Löschseite |
| `app/konto-loeschen.tsx` | Pflichtseite für Google Play |
| `deploy-supabase.yml` | Migrationen und Edge Functions ausrollen, von Hand, mit Probelauf |
| `docs/store/einreichung.md` | App Privacy / Data Safety vollständig |
| `docs/recht/verarbeitungsverzeichnis.md` | Art. 30 DSGVO aus dem echten Datenmodell |

### DSA-Einstufung — nicht neu herleiten

Online-Plattform, Kleinstunternehmen. **Art. 19** nimmt Abschnitt 3 (19–28) aus,
außer **Art. 24 Abs. 3**. **Art. 29** nimmt Abschnitt 4 (29–32) aus. **Art. 15
Abs. 2**: kein Transparenzbericht. Verbindlich: **11, 12, 14, 16, 17, 18,
24 Abs. 3** — alle umgesetzt.

**Kein Art. 20, kein Art. 21.** Nirgends versprechen. Fällt die Ausnahme weg
(50 Mitarbeitende oder 10 Mio. €), sind `constants/legal.ts` (`DSA`), AGB §11
und der Rechtsbehelfstext in `beschraenkung_erteilen()` zu erweitern.

### Pentest — der ernsteste Befund der Sitzung

`0420` setzte `alter default privileges … grant execute on functions to
authenticated`, und PostgreSQL vergibt zusätzlich bei **jeder** neuen Funktion
`EXECUTE` an `PUBLIC`. 15 SECURITY-DEFINER-Funktionen waren offen ohne
`auth.uid()`-Prüfung. Zwei ausnutzbar:

- **`check_rate_limit`** — beliebiger Schlüssel abrufbar. Vier Aufrufe, der
  vierte `false`: gezielter Denial-of-Service gegen eine einzelne Person oder
  IP, beim Opfer nur als normale 429 sichtbar.
- **`aktive_strikes(p_provider)`** — Disziplinardaten jedes Anbieters,
  durchzählbar.

Behoben in 0820, nachgehalten in `scripts/db-test/rechte.sql` (RA–RE).
`meine_aktiven_strikes()` ohne Argument ersetzt den Client-Aufruf.

### Fallen, die beim Härten aufgetaucht sind — nicht erneut hineinlaufen

1. **`revoke … from authenticated` wirkt nicht.** Das Recht kommt über
   `PUBLIC`. Immer `from public, anon, authenticated`.
2. **`revoke … on all functions in schema public` ist zu grob.** Trifft
   uuid-ossp und pgcrypto; `uuid_generate_v4()` steckt in Spalten-Vorgaben →
   jedes Einfügen scheitert. Schleife mit `pg_depend … deptype = 'e'` benutzen.
3. **RLS-Policies laufen mit den Rechten des Aufrufers**, Trigger nicht. Die
   Angebots-Policy rief `aktive_strikes()` — nach dem Widerruf hätte **kein
   Anbieter mehr bieten können**. Gefangen von `strike-verfall` Z-b.
4. **Negativtest an der falschen Schranke:** DS-B blieb unter Mutation grün,
   weil `melder_name = 'X'` an der Namenslänge scheiterte, nicht an der
   geprüften Bedingung. Alle übrigen Felder gültig machen.
5. **Drei Migrationen waren nicht wiederholbar** (0650, 0760, 0780). Der zweite
   Lauf steht jetzt in `run.sh`, ab `0380` (zwölf ältere sind es bewusst nicht).

### Baseline

tsc 0 · Jest 447 · **db-test 223** · deno check 14/14 ·
Prüfer: tote Links, tote Knöpfe, a11y, Postfach, AGB-Zusagen 19/19, Anrede 0,
**Berechtigungen**, **KI-Einsatz**.

### OFFEN — nach Wirkung sortiert

`notes/01-Status/Go-Live-Blocker.md` ist am 07.09. neu **gemessen** worden:

```
health: {"ok":false,"mail":false,"stripe":false,"db":true}
```

**Heute kann sich niemand bestätigen lassen und niemand bezahlen.** Der Code ist
nicht der Engpass. Fünf Punkte bestimmen das Datum, alle beim Founder:
UG gründen · ZAG anwaltlich klären · Postfach · Resend · Stripe.

Danach sofort: **Migrationen 0770–0820 und die Edge Functions ausrollen**
(`Actions → Deploy Supabase`, erst Probelauf) — beides liegt nur im Repo.
Reihenfolge in `docs/betrieb/migrationen-einspielen.md`.

Weiterhin offen: kein Gerätetest, kein freigeschalteter Anbieter.

---

## Richtigstellung 08.09.2026 — das Ausrollen läuft automatisch

Im Abschnitt oben („Session 07.09.2026") steht mehrfach, kein Workflow rolle
Migrationen oder Edge Functions aus. **Das ist falsch.**

Das Ausrollen macht die **Supabase-GitHub-Integration** (Prüfung „Supabase
Preview" an jedem PR), nicht ein Workflow in `.github/workflows/`. Push auf
`main` spielt Migrationen **und** Edge Functions ein.

Am 08.09. gegen die Produktion gemessen, lesend:

| Prüfung | Ergebnis | Bedeutung |
|---|---|---|
| `POST /functions/v1/inhalts-meldung` | 400 + eigene Prüfmeldung | ausgerollt |
| `POST /functions/v1/gibt-es-nicht` | 404 `NOT_FOUND` | Gegenprobe |
| `GET /rest/v1/inhalts_meldungen` | 200 `[]` | 0810 eingespielt |
| `GET /rest/v1/gibtesnicht_xyz` | 404 `PGRST205` | Gegenprobe |
| `POST /rpc/aktive_strikes` | 401 `permission denied` | 0820 wirkt |
| `POST /rpc/meine_aktiven_strikes` | 401 statt „nicht gefunden" | existiert |

**Alles aus PR #188 und #189 war live, ohne dass jemand etwas von Hand
eingespielt hat.** Der Founder hat unnötig eine SQL-Datei zum Einfügen bekommen.

**Die Lehre, die über diesen Fall hinausgeht:** aus „ich finde keinen Workflow"
folgt nicht „es passiert nichts". Zwei `curl`-Aufrufe gegen die Produktion
kosten nichts und hätten den ganzen Irrweg gespart — samt einer „Korrektur"
eines Kommentars in `ci.yml`, der von Anfang an richtig war.

Was daraus NICHT folgt: `deploy-supabase.yml` bleibt sinnvoll — als Rückfallweg
von Hand, falls die Integration abgeschaltet wird. Nur ist es nicht der Weg.

**Offen bleibt in Abschnitt B nur noch der nächtliche Abnahmefrist-Lauf**
(`pg_cron`/`pg_net` + `cron.schedule`, `docs/betrieb/abnahmefrist-lauf.md`).

---

## 08.09.2026 (abends) — Gedankenstriche: die Anweisung galt nur für mich

Der Founder schickte fünf Bildschirmfotos der Startseite: „Bindestriche? „-„ ?
Wor hatten doch was dazu gesagt?!"

Gesagt hatte er es einen Tag vorher, zusammen mit dem Hinweis auf die
Wissensdatenbank zu Human Writing, Sales und Marketing. Ich hatte die Anweisung
befolgt — **in meinen eigenen Antworten**. Die Texte der App blieben unberührt:
**309 Gedankenstriche in sichtbarem Text**, 25 davon allein auf der Startseite,
die er fotografiert hat.

Das ist dieselbe Fehlerklasse, die in dieser Datei schon zweimal steht: eine
Zusage gilt dort, wo sie leicht einzuhalten ist, und nicht dort, wo sie
gebraucht wird.

### Was geändert wurde

Alle 309 Stellen, dazu neun in Edge Functions (Push-Texte, E-Mail-Vorlagen,
Bestätigungsseiten). Ersetzt wurde jeweils durch das, was der Satz meint:

| vorher | nachher | Regel |
|---|---|---|
| `Nur 8% — keine Überraschungen` | `Nur 8%, keine Überraschungen` | Nachtrag → Komma |
| `sichere Zahlung — alles in einem Vertrag` | `sichere Zahlung: alles in einem Vertrag` | Aufzählung → Doppelpunkt |
| `nicht entgegen — die Identität prüft Stripe` | `nicht entgegen. Die Identität prüft Stripe` | zwei Aussagen → Punkt |
| `Frei — für Buchungen verfügbar` | `Frei · für Buchungen verfügbar` | Beschriftung → Trennzeichen |
| `'—'` als Platzhalter | `'…'` | fehlender Wert |

Der Platzhalter-Strich (`if (!iso) return '—'`) ist typografisch üblich, aber es
ist ein Strich, den der Founder auf dem Gerät sieht. `…` sagt dasselbe und liest
sich als „kommt noch".

### Warum das kein Geschmacksthema ist

1. Der lange Gedankenstrich ist ein Erkennungszeichen maschinell geschriebener
   Texte. Auf Seiten, die Vertrauen aufbauen sollen, ist das der falsche
   Beiklang.
2. Der deutsche Gedankenstrich ist ohnehin der Halbgeviertstrich „–", nicht der
   englische Geviertstrich „—". Der Code benutzte durchgängig den englischen.

### Der Prüfer, damit es nicht zurückkommt

`scripts/gedankenstrich-check.py`, verdrahtet in der CI und in
`scripts/reisen/run.sh`. Er prüft, was ein Nutzer liest, und **nicht**
Quelltext-Kommentare oder `console.*`-Zeilen in Edge Functions.

Der Textauszug liegt jetzt in `scripts/sichtbarer_text.py` — eine Quelle für
`ton-check.py` und den neuen Prüfer. Zwei Kopien desselben Auszugs heißt, dass
eine davon irgendwann veraltet.

**Mutationen, die ihn rot gemacht haben** (vier Klassen, je einzeln geprüft):
Geviertstrich in einer Zeichenkette, Geviertstrich in JSX-Text,
Halbgeviertstrich mit Leerzeichen, Bindestrich mit Leerzeichen.
**Gegenprobe grün geblieben:** `3–5 Werktage` (Bis-Strich), `Lead-Gebühren`
(Bindewort), `${30 - 5}` (Rechnung), ein Gedankenstrich im Kommentar, ein
Gedankenstrich in `console.error`.

**Zwei eigene Fehler dabei, beide durch Messen gefunden:**
- Erste Fassung ersetzte `${…}` durch ein **Leerzeichen** — aus `}-${` wurde
  ` - `, und der Prüfer meldete seine eigene Ersetzung. Acht Fehlalarme.
- `ohne_console()` verschluckte Zeilenumbrüche, dadurch zeigte ein Befund in
  einer Edge Function auf Zeile 3 statt 5.

### Nebenbefunde beim Durchgehen

- `app/nachbarschaft.tsx` trug noch „Nutzung auf eigene Gefahr" — denselben
  Satz, den ich am Vortag von der Startseite genommen hatte. Gegenüber
  Verbrauchern ist ein pauschaler Haftungsausschluss nach § 309 Nr. 7 BGB
  unwirksam; er kostet Vertrauen, ohne zu schützen. Jetzt dort ebenfalls weg.
- `lib/offers.ts` verschickte eine Push-Nachricht mit `fuer` statt `für`.
- Die Bildschirmfotos zeigen den alten Stand, weil GitHub Pages erst bei einem
  Push auf `main` neu baut (`.github/workflows/static.yml`). Kein Fehler, aber
  der Grund, warum der Founder die Korrektur vom Vortag noch nicht sah.

**Keine Änderung an `WIDERRUF_ZUSTIMMUNG`** (dem Wortlaut, der als Nachweis in
`widerruf_consents.angezeigter_text` landet). Geändert wurde nur
`WIDERRUF_ERKLAERUNG`, die daneben steht und nirgends gespeichert wird — die
Fassungskennung bleibt deshalb richtig.

---

## 08.09.2026 (später) — Fünf Befunde vom Gerät, davon drei unsichtbar für jede bisherige Prüfung

Der Founder schickte fünf Bildschirmfotos aus der laufenden App und stellte
neun Fragen. Vier waren echte Fehler, drei Erklärungen, einer war schon
erledigt.

### 1. „3 neue Auftrage wartet"
```
`${n} neue${n === 1 ? 'r' : ''} Auftrag${n === 1 ? '' : 'e'} wartet`
```
Ein angehängtes „e" erzeugt keinen Umlaut, und das Verb blieb im Singular.
**Deutsche Mehrzahl ist aus der Einzahl nicht ableitbar.** Neu:
`lib/mengenText.ts` (`anzahlText(n, einzahl, mehrzahl)`), beide Formen
ausgeschrieben, vier Tests.

**Gegengeprüft, ob es woanders auch steht:** `vor 2 Monaten`, `3 Angebote`,
`2 Termine` sind alle richtig, weil dort die Mehrzahl ein glattes -e/-en ist
und die Zahl nie 0 wird. Nicht angefasst. Das Muster bleibt trotzdem fragil.

### 2. Das ⓘ war kein Knopf
Founder: „Was wenn da ein i ist und man drauf drücken kann?" Genau das war der
Fehler: es sah aus wie einer.
**Klasse: ein Bedienelement, das etwas verspricht, was es nicht tut.**

> **Korrektur 12.09.2026.** Hier stand „Jetzt antippbar (44 px) mit der vollen
> Rechnung". Das ist falsch, und ich habe es beim Nachmessen selbst gefunden:
> es gibt in der ganzen App **kein** antippbares ⓘ. Gebaut wurde etwas anderes
> und Besseres — die Gebührenrechnung steht in `angebot-erstellen.tsx`
> dauerhaft sichtbar in der Karte „Preisübersicht" (Leistungspreis, davon
> Material, Arbeitsleistung, Gebühr, Auszahlung). Eine Erklärung, die immer
> dasteht, ist einer hinter einem Tippen überlegen.
>
> **Appweit nachgemessen:** 22 Info-Symbole, alle entweder in einem Knopf oder
> neben ihrem eigenen Erklärtext. Kein einziges verspricht etwas, das es nicht
> hält. Der Befund ist erledigt — nur eben anders, als ich aufgeschrieben
> hatte.
>
> Die Lehre ist dieselbe wie bei den Prüfern: **auch ein Bericht kann grün
> melden, ohne nachgesehen zu haben.** Einen Fix zu beschreiben, den man plant,
> statt den, den man gebaut hat, führt die nächste Sitzung in die Irre.

### 3. Der Kalender blieb auf der Woche stehen, in der er geöffnet wurde
Founder: „Wird kalender immer aktualisiert?" Nein.
`wochenTage()` las das aktuelle Datum, aber das Ergebnis lag in einem
`useMemo`, das nur am Blätter-Versatz hing, und Reiter-Bildschirme bleiben in
expo-router dauerhaft eingehängt. Über das Wochenende offen gelassen zeigte er
am Montag die Vorwoche, überschrieben mit „Diese Woche".

Neu: ein **Anker** (der Tag, auf den sich der Versatz bezieht) plus
`kalenderStandNachFokus()` in `lib/kalenderWoche.ts`. Zurückgesetzt wird nur
bei echtem Tagwechsel. Heute-Markierung und Monatsspringer hängen am selben
Anker.

**Fallstrick beim Einbau, den die Typprüfung nicht sieht:** `loadBooked` hängt
nur an `user`, der Fokus-Effekt wird also nicht neu gebaut, wenn sich der
Anker ändert. Über den Abschluss gelesen sähe er beim nächsten Fokus den alten
Anker und setzte eine geblätterte Woche **jedes Mal** zurück. Deshalb liegt der
Anker zusätzlich in einem `useRef`.

### 4. „Ihre Leistung ist nicht dabei?" ohne nächsten Schritt
Die Karte sagte, was nicht geht, und ließ den Anbieter dann stehen. Der Weg,
den es heute gibt, steht jetzt dabei. **Kein Freitext-Gewerk**: das hätte keine
Gebührenregel, keine Meisterpflicht-Prüfung (§1 HwO Anlage A) und kein
Matching.

### 5. Der Kontakt-Hinweis nannte die Folge nicht
Founder unter seiner eigenen Nachricht: „Es sollte doch gestriket werden?!"
Die Folge gibt es (0720: drei Feststellungen in zwölf Monaten = ein Strike mit
Begründung; ein Einzeltreffer nie), sie stand nur im Hinweis **beim Tippen**.
`kontaktHinweis(text, binIchDerAbsender)` nennt sie jetzt dem Absender, dem
Empfänger ausdrücklich nicht.

### Was das über die Prüfabdeckung sagt

Drei der vier Fehler lagen in `app/betrieb/*`, hinter Anmeldung **und**
Anbieter-Rolle. Der Sitzungs-Ersatz (`scripts/lib/anbieter-sitzung.cjs`) bringt
die Bildschirme in den Browser-Lauf, aber mit **leeren Listen**: „3 neue
Aufträge" entsteht nur, wenn drei Anfragen da sind, und ein Kalender, der über
Mitternacht stehen bleibt, braucht zwei Tage. Beides ist ein Geometrie-Prüfstand
nicht in der Lage zu sehen.
**Der Hebel bleibt derselbe wie am 16.08.: reine Logik nach `lib/` ziehen und
mit Jest prüfen.** Genau das ist hier dreimal passiert (`mengenText`,
`kalenderStandNachFokus`, `kontaktHinweis`).

### Zurücksetzen nach Mutationsproben: `git checkout --` war hier falsch
Zwei der drei mutierten Dateien trugen unveröffentlichte Änderungen, die dritte
war überhaupt nicht in git. `git checkout -- <dateien>` hätte die Arbeit
mitgenommen; der Befehl brach mit „pathspec did not match" ab, **bevor** er
etwas anfasste. Zurückgesetzt wurde mit der Gegenersetzung.
**Regel: vor `git checkout --` prüfen, ob die Datei überhaupt in git ist und ob
sie außer der Mutation noch etwas Ungespeichertes trägt.**

---

## 12.09.2026 — Benachrichtigungen: die Zählung stimmte, die Zustellung nicht

Founder-Frage: „Was ist denn mit Benachrichtigungen, Pop-ups und Mails, wenn
eine Anfrage reinkommt, angenommen wird? Haben wir dort auch eine Logik oder
müssen wir es bauen?" Danach: selbst entscheiden, notieren, nicht fragen, und
die Nacht durcharbeiten.

Entscheidung und vollständige Begründung:
`notes/04-Entscheidungen/Benachrichtigungen-Architektur.md`

### Der Fehler, den ich zuerst gemacht habe

Ich habe geantwortet: neun Push-Auslöser, der Geldweg ist abgedeckt. Richtig
gezählt, falsch verstanden. Erst der Selbst-Check brachte es:

```ts
// supabase/functions/send-push/index.ts, bis 12.09.2026
if (!token) return { sent: false, reason: "no_token" };
```

`lib/notifications.ts` registriert bei `Platform.OS === 'web'` **überhaupt
keinen Token**. Für jeden Nutzer der live stehenden Web-App endeten damit
**alle neun Auslöser** in diesem stillen Rückgabewert. Ohne Fehler, ohne
Zustellung.

**Die Lehre, über diesen Fall hinaus:** Auslöser zu zählen ist nicht dasselbe
wie zu prüfen, ob sie ankommen. Bei jeder Frage „haben wir das?" den Weg bis
zum Empfänger durchgehen, nicht bis zum Aufruf.

### Zweiter Befund, schwerer: Pflichtmitteilungen ohne Versandweg

`strike_zustellung_vermerken()` (0750) und
`beschraenkung_zustellung_vermerken()` (0810) existierten, und **niemand rief
sie auf**. Es gab keinen Versandweg. AGB §7(4) verspricht dem Anbieter eine
Begründung (Art. 4 P2B-VO), DSA Art. 17 verlangt die **Übermittlung**. Ein
Text in einer Spalte ist keine Übermittlung. Der Kommentar in 0750 sagte das
sogar selbst.

### Was gebaut wurde

| Migration | Inhalt |
|---|---|
| `0860` | `notifications` + RLS, Trigger auf `provider_strikes` und `beschraenkungen`, `zustellung_status()`, `zustellung_quittieren()` |
| `0870` | `profiles.mail_benachrichtigungen` |

- **Trigger, nicht Client-Aufruf:** einen Strike ohne Mitteilung darf es nicht
  geben können. Der Client kann abstürzen, die Transaktion nicht.
- **Keine update-Policy** auf `notifications`: dürfte der Empfänger die Zeile
  ändern, könnte er `zugestellt_am` selbst setzen und den Nachweis löschen.
- **`send-push` weicht auf E-Mail aus.** Damit wirken alle neun bestehenden
  Auslöser sofort, ohne dass eine Aufrufstelle geändert wurde.
- **Einwilligung musste mitwachsen:** „kein Token" heißt Web-Nutzer **oder**
  abbestellt. Schalter „Vorgangsmails" in den Einstellungen; Pflicht-
  mitteilungen sind ausgenommen und das steht im Schaltertext.
- **`health`** meldet `zustellung_stau`, solange eine Pflichtmitteilung länger
  als 24 Stunden unzugestellt liegt. Ohne `RESEND_API_KEY` bleibt das rot, und
  das ist der ehrliche Zustand.

### Prüfstand

252 DB-Assertions (15 neue), 485 Jest-Tests, 7 neue Deno-Tests (in der CI mit
Mindestzahl), acht statische Prüfer. **Neun Mutationen** einzeln rot gemacht.

### Zwei eigene Fehler, beide vom Prüflauf gefangen

1. **BN15 gegen einen leeren Bestand.** BN13 und BN14 hatten alles quittiert,
   es war nichts mehr offen. Dieselbe Falle wie bei AL2 am 10.09. Ein Test
   gegen einen leeren Bestand prüft nichts.
2. **BN11 bewies weniger als sein Name.** Er bliebe auch ohne Trigger grün.
   Steht jetzt so im Test, statt mehr zu behaupten.

### Was offen bleibt

- **Block D:** Push für Chat und Terminvorschlag. Lohnt erst mit dem ersten
  nativen Build.
- **Resend** ist weiterhin nicht eingerichtet. Bis dahin ist der Versandweg
  gebaut und ungenutzt, sichtbar an `zustellung_stau`.
- **Zweiter geplanter Lauf** (`zustellung-stuendlich`) in
  `docs/betrieb/abnahmefrist-lauf.md` dokumentiert, Einrichtung beim Founder.

### Zweite Selbst-Check-Runde in derselben Nacht (Blöcke E und F)

Der Founder hatte gesagt: „prüfe deine arbeit in abständen selbst gegen die
anforderungen." Die zweite Runde fand drei Dinge, die die erste übersehen hat.

**1. Der Schalter galt nur für die Hälfte der Mails.**
`notify-matching-providers` verschickte auf `resendKey && profile?.email`, ohne
`mail_benachrichtigungen` (0870) zu fragen — ausgerechnet bei der Mail, die ein
Anbieter am häufigsten bekommt. Die im Fußtext genannte Abschaltung
(Verfügbarkeit) nimmt den Anbieter zugleich aus Suche und Startseite:
**unsichtbar werden oder weiter Mails bekommen ist keine Wahl.**

**2. Der Auftragstitel stand roh im HTML.** `${job.title}` kommt vom KUNDEN.
Ein Titel mit angehängtem `<a href="…">` hätte einen fremden Link in eine Mail
gebracht, die nachweislich von Werkant kommt und korrekt signiert ist. Vier von
fünf Versandwegen maskierten bereits; `escapeHtml` liegt jetzt in
`supabase/functions/_shared/html.ts` (`waitlist-doi` hatte eine dritte Kopie).

**3. Fehlender Zustell-Zeitplan war unsichtbar.** 0850 prüft beim
Abnahmefrist-Lauf Zeitplan UND Symptom; 0860 nur das Symptom. `zustellung_stau`
schlägt erst an, wenn eine Pflichtmitteilung existiert UND 24 h alt ist —
passiert wochenlang kein Strike, läuft der erste echte Fall in eine Frist, die
Werkant schuldet. 0880 nimmt `zeitplan_vorhanden` dazu, `/health` gibt es als
`zustellung_lauf` aus.

### Was dabei über das Prüfen selbst gelernt wurde

- **Der Pflicht-Wiederholungslauf hat sich zum dritten Mal bezahlt.** 0860 legte
  `zustellung_status()` mit dem alten Rückgabetyp wieder an und brach im zweiten
  Lauf ab („cannot change return type"). Ein `drop function if exists` davor.
- **Ein YAML-Name mit Doppelpunkt bricht den ganzen Workflow.**
  `- name: Mailversand: …` — die Gegenprobe mit `yaml.safe_load` fing es vor dem
  Push. In `scripts/reisen/run.sh` gilt dasselbe aus anderem Grund:
  `NAME="${pruefung%%:*}"` schneidet am ERSTEN Doppelpunkt.
- **Ein laufendes bash-Skript darf man nicht bearbeiten.** Mitten im
  Browser-Durchlauf hatte ich eine Zeile in `scripts/reisen/run.sh` eingefügt.
  Bash liest die Datei nach dem aktuellen Befehl per Byte-Versatz weiter — die
  Änderung hätte den Rest des Laufs verschieben können. Zurückgenommen, nach dem
  Lauf erneut eingefügt.
- **Mein Python-Helfer hat wieder teilweise geschrieben und dann abgebrochen.**
  Erst die `.sql` geändert, dann an der `run.sh`-Assertion gescheitert — und die
  erste Änderung stand trotzdem da. Genau der Fehler, der schon einmal notiert
  ist. **Nach jedem abgebrochenen Mehrdatei-Skript den Ist-Zustand messen, nicht
  annehmen.**
- **„Hängt" ist eine Messung, keine Vermutung.** `alle-screens-check.cjs` sah
  zweimal nach dem bekannten Hänger aus (gleiche PID, Log wächst nicht). Es
  puffert nur seine Ausgabe: 46 Bildschirme × 11 s zweiter Durchgang ≈ 13 min.
  Nachgewiesen über `utime` in `/proc/<pid>/stat` und die Zahl der Ziele im
  Skript, statt zu raten.

### Gegenproben, die gefahren wurden (jeweils rot gesehen, dann zurückgesetzt)

| Was | Mutation | Ergebnis |
|---|---|---|
| Einwilligungs-Prüfer | Bedingung entfernt | rot |
| Maskierungs-Prüfer | `${titelHtml}` → `${job.title}` | rot |
| BN16 | `zeitplan_vorhanden` fest auf `true` | rot |
| Strike-Trigger (Block A) | Trigger entfernt | BN1 rot, 237 statt 253 |

Der letzte war eine offene Frage aus der ersten Runde: BN11 beweist den Trigger
nicht, BN1 schon.

### Dritte Runde: DSGVO-Lücken und ein Produktbefund (Blöcke G bis I)

**Art. 15 — acht Tabellen fehlten in der Auskunft.** `notifications` war nicht
im Export; beim Nachmessen ALLER Tabellen kam heraus, dass acht mit
select-own-Policy fehlten (eigene Verstöße, DSA-Beschränkungen, Einwilligungen,
Widerrufserklärungen). Kriterium, das jetzt
`scripts/auskunft-vollstaendig-check.py` durchsetzt: **zeigt RLS die Zeile
ohnehin, enthält die Auskunft sie auch.**

**Art. 17 — `ON DELETE CASCADE` greift bei diesem Konto-Löschen nie.**
`delete-account` pseudonymisiert das Profil (HGB §238), löscht es nicht. Wer
sich auf die Kaskade verlässt, lässt die Zeilen stehen. Zustellkopien werden
jetzt ausdrücklich gelöscht — zulässig nur, weil `zustellung_quittieren()` den
Nachweis doppelt schreibt, auch in den Ursprungsvorgang.

**Die Zustell-Schleife und die HwO-Trennung laufen jetzt.** Beide waren
`deno check`-grün und nie ausgeführt. `zustellung/handler.ts` (7 Tests) und
`notify-matching-providers/auswahl.ts` (8 Tests), Muster von
`stripe-webhook/handler.ts`.

### Produktbefund für den Founder: Köln und Leverkusen finden sich nicht

Der Anbieter-Filter vergleicht die ersten **zwei** PLZ-Ziffern. Köln ist „50",
Leverkusen „51". 15 km auseinander, über diesen Filter nie ein Treffer — ebenso
Bergisch Gladbach. Der Markteintritt ist ausdrücklich Köln **und** Leverkusen,
und beim Kaltstart ist eine halbierte Reichweite am teuersten.

Nicht allein geändert: eine Ziffer statt zwei macht es schlimmer („5" ist das
halbe Rheinland bis Aachen). Richtig wäre ein Radius in Kilometern über
PLZ-Geodaten — eine Produktentscheidung mit Datenbedarf.
`notes/04-Entscheidungen/Reichweite-Anbieter-Matching.md`.

### Zwei Lehren übers Prüfen aus dieser Runde

**Eine Mutation, die ein anderer Test zuerst fängt, beweist über den eigenen
Test nichts.** BN17 sollte zeigen, dass der Zustellnachweis das Löschen der
Kopie überlebt. Die naheliegende Mutation (doppelte Schreibung entfernen)
machte BN14 rot — BN17 kam gar nicht mehr dran und wäre unbewiesen geblieben.
Erst die Mutation, gegen die er wirklich gebaut ist (ein Trigger, der beim
Löschen der Kopie den Ursprung mitnimmt), machte ihn rot bei grünem BN14.

**Auch ein Bericht kann grün melden, ohne nachgesehen zu haben.** Mein Eintrag
vom 08.09. behauptete ein antippbares ⓘ, das es nirgends gibt. Korrigiert, und
appweit nachgemessen: 22 Info-Symbole, alle entweder in einem Knopf oder neben
ihrem eigenen Erklärtext.

## 13.09.2026 — Gegen die Produktion nachgemessen

Nach dem Merge von #195 (`b928c2a`) lesend geprüft, ohne Konto anzulegen.
**Die Methode taugt nur mit Kontrollprobe** — ohne sie beweist ein leeres
Ergebnis nichts:

| Prüfung | Ergebnis | Bedeutet |
|---|---|---|
| `POST /functions/v1/zustellung` | **401** | ausgerollt (Gateway will einen Header) |
| `POST /functions/v1/gibtsnicht-xyz` | **404** | **Kontrollprobe**: nicht Ausgerolltes gibt wirklich 404 |
| `GET /rest/v1/notifications` | `[]` | Tabelle da → **0860 durch** |
| `GET /rest/v1/profiles?select=mail_benachrichtigungen` | `[]` | Spalte da → **0870 durch** |
| `?select=gibtsnicht_xyz` | `42703 column does not exist` | **Kontrollprobe**: eine erfundene Spalte fehlert wirklich |

`0880` ändert nur eine Funktionssignatur und ist über REST nicht zeigbar —
nicht bewiesen, nur wahrscheinlich (gleicher Push, geordnete Reihenfolge).

### Der Betriebsstand aus `/health`

```json
{"ok":false,"mail":false,"mail_from":false,"stripe":false,"stripe_webhook":false,
 "db":true,"admin_secret":true,"abnahme_lauf":false,"abnahme_stau":false,
 "zustellung_lauf":false,"zustellung_stau":false}
```

Dass `zustellung_lauf` überhaupt im Rumpf steht, beweist nebenbei, dass die
neue `health`-Fassung live ist.

**Der schwerste Punkt darin ist nicht meiner:** `stripe: false` und
`stripe_webhook: false`. Ohne diese Secrets gibt es in der Produktion **keinen
Geldweg** — keine Zahlung, kein Escrow, keine Auszahlung. Das ist unabhängig von
allem, was diese Nacht gebaut wurde, und es steht seit Längerem so da, ohne dass
es jemand benannt hätte.

`mail: false` erklärt zugleich, warum `zustellung_stau` auf `false` steht: es
gibt schlicht noch keine Pflichtmitteilung. Der Wert ist also **kein grüner
Haken**, sondern eine noch nicht gestellte Frage.

### Founder-seitig offen, nach Gewicht

1. **Stripe-Secrets** — ohne sie kein Geldweg.
2. `RESEND_API_KEY` + `WAITLIST_FROM_EMAIL` — ohne sie keine Zustellung von
   Pflichtmitteilungen (AGB §7(4), DSA Art. 17).
3. Zwei pg_cron-Zeitpläne (`abnahmefrist-taeglich`, `zustellung-stuendlich`),
   SQL in `docs/betrieb/abnahmefrist-lauf.md`.

## 13.09.2026 (vormittags) — Edge Functions, die nur typgeprüft waren

Fortsetzung nach #195. Drei PRs (#196, #197 gemergt), Thema durchgehend:
**`deno check` prüft Typen, keine Zusagen.**

### Was gefunden wurde

| Funktion | Zusage im Text | Stand im Code |
|---|---|---|
| `verify-email` | „oder ist abgelaufen" | **kein Ablauf**, `sent_at` nie gelesen |
| `waitlist-doi` | „oder abgelaufen" | **kein Ablauf**, nur `confirmed_at is null` |
| `pstg-annual-report` | „keep in sync" | Schwelle stand **dreimal** im Baum |
| `adminSecret` | „Konstantzeit-Vergleich" | **dreimal** kopiert |
| `export-my-data` | Fäden-Trennung (L1) | nie ausgeführt |
| `delete-account` | leert die PII-Spalten | Aufzählung ohne Abgleich |
| `health` | `ok` heißt „Secrets sitzen" | nie ausgeführt |

### Drei Lehren übers Prüfen, die diesmal dazukamen

**1. Ein Test, der die Mutation nicht sehen kann, ist kein Test — und er sieht
aus wie einer.** Beim `health`-Test verglich ich `Object.keys` eines Literals,
das ich selbst im Test geschrieben hatte. Die Mutation (`&& !s.stau`) blieb
grün. Erst als das Stau-Signal **tatsächlich übergeben** wurde, wurde er rot.

**2. Manche Zusagen sind gar keine Laufzeitfrage.** Der frühe Ausstieg im
Secret-Vergleich ist funktional identisch und ließ alle sechs Tests grün — er
unterscheidet sich nur in der Laufzeit. Die Konstantzeit ist deshalb eine
**Quelltext**-Frage: ein siebter Test liest die Datei und verlangt, dass in der
Vergleichsschleife kein `return` steht. Eine Laufzeitmessung wäre in einer
geteilten Umgebung unzuverlässig, und ein Prüfer mit Fehlalarmen wird
abgeschaltet und nie wieder an.

**3. `git checkout --` setzt eine noch nicht eingecheckte Datei NICHT zurück.**
Danach fand meine Gegenersetzung nichts und tat stillschweigend nichts —
„Mutation 2" lief in Wahrheit noch unter Mutation 1 und war nie geprüft.
Aufgefallen nur, weil ich den Ist-Zustand gemessen habe statt ihn anzunehmen.
Verwandt mit der Notiz vom 08.09., aber die andere Richtung: dort nahm
`git checkout --` zu viel mit, hier zu wenig.

### Zwei Prüfer, die eine Aufzählung mechanisch aktuell halten

`auskunft-vollstaendig-check.py` und `loeschung-vollstaendig-check.py`. Beide
Funktionen zählen einzeln auf, was sie anfassen; eine Aufzählung veraltet
lautlos, ohne dass irgendetwas rot wird.

**Die Spaltenliste stammt aus der Datenbank, nicht aus einer Annahme.** Der
erste Auszug fand 13 von 21 Profilspalten — aufgefallen nur, weil der Prüfer
eine Untergrenze hat und abbricht, statt eine zu kurze Liste für vollständig zu
halten.

### Produktionsstand unverändert

`stripe: false` und `stripe_webhook: false`. **Kein Geldweg in der Produktion.**
Das ist der schwerste offene Punkt und stammt nicht aus dieser Arbeit.

## 13.09.2026 (mittags) — Der Prüfstand reparierte den Fehler, den er finden sollte

Der schwerwiegendste Fund des Tages, weil er eine Sicherheitszusage entwertete,
die das Projekt für gegeben hielt.

**`0820` ist ein Stichtag, keine Regel.** Die Schleife dort dreht die
Ausführungsrechte im Schema `public` auf „verboten" — aber nur für das, was es
zu ihrem Zeitpunkt gab. Jede später angelegte Funktion bekommt die Vorgaben aus
`0420` zurück plus das `EXECUTE`, das PostgreSQL **jeder** neuen Funktion an
`PUBLIC` gibt.

`0860` legte zwei SECURITY-DEFINER-Trigger an. In der Produktion waren sie für
`anon` und `authenticated` ausführbar.

### Warum `rechte.sql` das nicht gesehen hat

Er lief am Ende, **nach** dem Idempotenz-Durchgang. Der zweite Lauf spielt auch
`0820` erneut, und dessen pauschale Widerrufsschleife räumt dabei die Rechte
aller Funktionen auf — auch der später angelegten. In der Produktion passiert
das nie: dort laufen Migrationen genau **einmal** und der Reihe nach.

> Der Prüfstand reparierte den Fehler, den er finden sollte, und meldete
> anschließend grün.

**`rechte.sql` läuft jetzt direkt nach dem ersten Migrationslauf.** Er ist der
einzige Test, dessen Ergebnis vom **Durchgang** abhängt und nicht nur vom
Schema. Wer ihn zurück in die Hauptliste schiebt, macht ihn wieder blind.

### Die Lehre, über diesen Fall hinaus

Ausnutzbar war es kaum — beide geben `trigger` zurück, ein direkter Aufruf
scheitert von selbst. Das ist ein Zufall der Rückgabeart, kein Schutz.
**Die Gefahr war nie diese eine Funktion, sondern die Blindheit:** jede
künftige SECURITY-DEFINER-Funktion nach `0820` mit normalem Rückgabetyp wäre
genauso offen gewesen.

Mein Fehler in `0860`: aus „Trigger **brauchen** kein `EXECUTE`" (richtig)
geschlossen, dass man ihnen keines **entziehen** muss. Das folgt nicht.

Vollständig in `notes/04-Entscheidungen/Pruefstand-verdeckte-Rechte-Drift.md`.

### Zwei Achsen ohne Befund, und das ist das Ergebnis

- **AGB gegen Code:** die Gebührenbasis wurde mit #193 korrekt nachgezogen,
  §6(2) und §4(3) nennen die Materialkosten-Ausnahme ausdrücklich.
- **Löschfristen der Datenschutzerklärung:** IP (7 Tage) und Consent-Log
  (3 Jahre) sind umgesetzt; die Chat-Löschung ist seit 16.08. bewusst geparkt
  und als OFFEN geführt.

Beides bestätigt frühere Arbeit, statt etwas zu finden. Lieber so berichtet,
als einen Befund zu konstruieren.
