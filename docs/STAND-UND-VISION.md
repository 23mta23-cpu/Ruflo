# Werkant — Stand und Vision

*Geschrieben 30.07.2026, überarbeitet 21.08.2026 nach 28 weiteren PRs
(#158–#185 sowie diesem). `main` stand beim Schreiben auf `0335ce6`.*

**Wenn du das als erste Datei liest:** dieses Dokument gibt den Überblick.
`docs/SESSION_HANDOFF.md` (876 Zeilen) ist die Chronik mit allen Details und die
Quelle für die Arbeits-Warteschlange. `CLAUDE.md` und `AGENTS.md` enthalten die
verbindlichen Arbeitsregeln.

---

## 1. Was Werkant ist

Ein Marktplatz, der private Auftraggeber und geprüfte Handwerksbetriebe
zusammenbringt — mit einem Zahlungsweg, bei dem **niemand in Vorleistung gehen
muss**. Der Kunde zahlt bei der Beauftragung ein, das Geld liegt treuhänderisch
bei Stripe, und der Betrieb bekommt es erst nach Abschluss.

Das ist die ganze Idee, und sie richtet sich gegen zwei konkrete Missstände:

- **Lead-Portale** (MyHammer, Blauarbeit) verkaufen Kontakte im Voraus. Der
  Handwerker zahlt, bevor er weiß, ob etwas daraus wird. Werkant nimmt 8 %
  ausschliesslich bei einem **abgeschlossenen und bezahlten** Auftrag,
  mindestens 3 €. Kein Auftrag heißt keine Kosten. Keine Grundgebühr, keine
  Laufzeit.
- **Rechnungen hinterherlaufen.** Der Kunde hat vorab eingezahlt; die
  Auszahlung ist eine Freigabe, kein Mahnprozess.

### Positionierung (Founder-Korrektur 03.07.)
Werkant ist **keine Kleinauftrags-Nische**. B2C *und* B2B, vom kleinen
Reparaturauftrag bis zum größeren Gewerk. Die frühe Engführung auf
„Kleinaufträge" war ein Missverständnis und ist ausdrücklich verworfen.

### Marke
„Werkant" (final, Rebrand von WERKR). Logo „Das Treffen"
(`docs/brand/das-treffen-*.svg`), Siegel „Werkant-geprüft". **Naming-Recherche
nicht wiederholen.** Design: Variante C — Grün bleibt, Bone-Creme-Hintergrund,
kein reines Weiß. Rebrand-Vorschläge wurden mehrfach geprüft und abgelehnt
(`notes/04-Entscheidungen/Kein-Rebrand-*`, `Design-Variante-C-entschieden.md`).

### Zwei Tracks
| | Handwerk | Nachbarschaft |
|---|---|---|
| Wer | Betriebe, Gewerbeschein Pflicht | Privatpersonen |
| Gewerke | 13 aktive B2B-Gewerke, davon **10 meisterpflichtig** | 7 Startkategorien (Modell D) |
| Gebühr Anbieter | 8 %, min. 3 € | 0 % — Helfer bekommt 100 % |
| Gebühr Kunde | 2,5 %, min. 1,50 € | 1,99 € Werkant-Schutz |
| Nachweise | Gewerbeschein, bei Meisterpflicht Meisterbrief | kein Papier, 18+-Selbstauskunft, Identität via Stripe |

Der Nachbarschafts-Track ist **live** (Founder-Anweisung 06.07.,
`Nachbarschaft-Live-Schaltung.md`) — die Einfrierung vom 03.07. ist überholt.
Harte Gates bleiben: Meisterpflicht-Ausschluss, B2B-Ausschluss, getrennte
Ratings, Track-Trennung in der DB (Migration 0480). **DRV-/Steuerklärung bleibt
Pflicht vor echtem Geldfluss** im NB-Track.

Ausdrücklich **eingefroren**: `PRO_ABO` (CFO-Entscheid 27.07. — Platzierung ist
ein Nullsummenspiel, der Lead-Pool ist fix, und die AGB schliessen bezahlte
Platzierung aus). Kein Kaufweg, Code bleibt als toter Pfad.

### Markteintritt
Operativ Köln und Leverkusen, Dichte vor Fläche. Der Städte-Gate im Code ist
bewusst **offen** (`isActiveCity()` lässt jede Stadt durch, `ACTIVE_CITIES`
bleibt für spätere Dichte-Steuerung stehen). Der Pitch ist Ehrlichkeit: es gibt
keine Nutzerbasis, und niemand behauptet eine. Das Angebot an Betriebe lautet
„Gründungspartner werden, 0 € Risiko, weil ohne Auftrag keine Gebühr".

---

## 2. Wo das Produkt technisch steht

Expo/React-Native-Web-App auf GitHub Pages, Supabase (Postgres + Auth + Edge
Functions), Stripe Connect für Zahlungen.

| | |
|---|---|
| Screens | 51 |
| Migrationen | 77 (4-stellige Präfixe, `0010`–`0750`) |
| Edge Functions | 13 |
| Unit-Tests (Jest) | 389 |
| DB-Integrationstests | 166 Assertions über 20 Dateien |
| Browser-Prüfungen | `bash scripts/reisen/run.sh` — tote Links, Gast-Login, Rollen/Routen, Entwurf, Kern-Reise 1+2 |

**Was funktioniert und gegen echtes Postgres verifiziert ist:** Registrierung
mit DOI-Gate, Auftrags-Wizard (Entwurf überlebt den Login), Angebots-Flow,
`accept_offer` mit serverseitiger Gebührenberechnung, Escrow-Kette,
Chat pro (Auftrag, Anbieter)-Thread mit Vor-Vertrags-Rückfragen,
Terminvorschläge, Bewertungen, Strike-System mit Verfall und Begründung,
Anbieter-Verfügbarkeit, DSGVO-Export und -Löschung, PStTG/DAC7-Meldegrundlage,
Widerrufs-Nachweis, Rückbuchungs- und Auszahlungs-Buchführung.

**Der entscheidende Satz zum Reifegrad:** All das ist gegen lokales Postgres,
Unit-Tests und statische Prüfungen abgesichert. **Ein vollständiger Vorgang ist
nie von einem Menschen durchlaufen worden.** Kein echter Auftrag, keine echte
Zahlung, keine echte Auszahlung.

---

## 3. Der Blocker — am 21.08.2026 nachgemessen

Der Health-Endpunkt der Produktionsinstanz gibt Auskunft darüber, welche
Secrets gesetzt sind (`supabase/functions/health/index.ts`, liefert
ausschließlich Booleans). Abfrage vom 21.08.2026:

```
GET https://chnphpmpdpllnpqtvwhx.supabase.co/functions/v1/health
{"ok":false,"mail":false,"mail_from":false,"stripe":false,"stripe_webhook":false,"db":true}
```

**Es ist nichts geschaltet.** Nicht nur der Mailweg fehlt — es ist auch kein
Stripe-Schlüssel hinterlegt, nicht einmal ein Test-Key. In der Produktion kann
also weder jemand mitmachen noch jemand zahlen. Die Datenbank ist das Einzige,
was steht.

**Der erste Teil: `RESEND_API_KEY` ist in den Supabase-Secrets nicht gesetzt.**

Die Kette: Migration 0430 verengt das Verifikations-Gate bewusst auf
`profiles.email_verified_at` (mit Supabase-Autoconfirm beweist
`email_confirmed_at` nichts). Diesen Stempel setzt ausschliesslich die
`verify-email`-Function. Die braucht Resend.

Ohne den Schlüssel kann sich **niemand** verifizieren, und damit sind alle
Schreibwege per RLS gesperrt: Auftrag anlegen, Angebot abgeben, Angebot
annehmen, Rückfrage im Chat, Terminvorschlag. Am Produktionsprojekt
nachgewiesen (`docs/ops/RESEND-MAIL-GATE.md`).

Das Gate wurde bewusst **nicht** gelockert — es ist die einzige Hürde gegen
Wegwerf-Konten, und ein fehlendes Secret rechtfertigt keine dauerhafte
Absenkung des Schutzniveaus (`notes/04-Entscheidungen/2026-07-26-Verifikations-Gate-nicht-lockern.md`).

Aufwand für den Founder: Resend-Konto, Key als Edge-Function-Secret, dazu die
Site-URL korrigieren (Punkt 6 der Security-Checkliste, behebt den
`localhost:3000`-Link in der Bestätigungsmail). Etwa zehn Minuten, plus die
DNS-Verifikation der Domain bei Resend, die länger dauern kann.

**Der zweite Teil: kein Stripe-Schlüssel.** Bis dahin ist der gesamte Geldweg
— Einzahlung, Treuhand, Freigabe, Auszahlung, Erstattung — ausschließlich
gegen lokales Postgres und Testharness geprüft. Ein Test-Key genügt, um den
Weg einmal vollständig live zu durchlaufen; die Live-Keys können danach kommen.

**Der dritte Teil: es existiert kein Postfach.** Bis 16.08. verwies die App an
16 Stellen auf sechs Adressen, von denen keine Post empfing. Der Code führt sie
seit #182 über eine Konstante auf **eine** Adresse zusammen — anzulegen ist
also nur `kontakt@werkant.de` (`docs/betrieb/postfaecher-einrichten.md`).
Pflicht ist das nach § 5 Abs. 1 Nr. 2 DDG, Art. 13 DSGVO und Art. 246a § 1
Abs. 2 EGBGB; ohne Postfach laufen Impressum, Datenschutzerklärung und
Widerrufsbelehrung ins Leere.

---

## 4. Was vor uns liegt

### Nur der Founder kann das
1. **`RESEND_API_KEY`** + `WAITLIST_FROM_EMAIL` + Site-URL — siehe oben. P0.
2. **Ein Postfach `kontakt@werkant.de`** beim Domain-Anbieter. Rechtspflicht,
   und ohne Mailweg zusätzlich die einzige Möglichkeit, einer Strike-Begründung
   nach AGB §7(4) / Art. 4 P2B-VO überhaupt zuzustellen.
3. **Stripe-Keys** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`),
   Webhook-Endpoint im Dashboard, **Stripe Connect aktivieren**.
   Ablauf: `docs/release/LIVE_CUTOVER_RUNBOOK.md`. Test-Keys reichen für den
   ersten vollständigen Durchlauf.
4. **Echte Impressumsdaten** in `constants/legal.ts` (`LEGAL_PLACEHOLDER = true`,
   dort stehen „[Ihr Name]" und „Musterstraße 1"). Für beide App-Stores
   zusätzlich verifizierter Händlerstatus nach DSA — ohne echte Firmendaten
   kommt die Einreichung nicht durch.
5. **Zehn Dashboard-Klicks** aus `docs/security/GO-LIVE-SECURITY-CHECKLIST.md`
   (RLS gegenprüfen, Leaked-Password-Schutz, Passwortlänge, 2FA, Backups …).
6. **Google-/Apple-Login** freischalten (Code fertig, OAuth-Clients fehlen).
7. **Produktentscheidungen**, die ich bewusst offen gelassen habe:
   - **Soll die `offers`-Policy `kyc_status` prüfen?** Heute kann ein Konto
     **ohne ein einziges Dokument** im Elektro-Gewerk bieten — das
     Kernversprechen der Marke ist nicht durchgesetzt. Die Texte sind
     entschärft. Die Policy nachzuziehen sperrt jeden Anbieter aus, bis du ihn
     per Concierge-Review freigibst: eine Betriebsentscheidung, kein Bugfix.
   - **`STRIPE_AUTO_REFUND_ON_FRAUD_WARNING`** — automatische Erstattung bei
     Betrugs-Frühwarnung. Mechanismus gebaut, standardmäßig aus. Einschalten
     ist derzeit ein Fehler: es fehlen AGB-Klausel, Benachrichtigung beider
     Seiten und Art.-22-Konformität. Abwägung in
     `docs/todo/OFFENE-FOUNDER-TODOS.md`.
   - **Gegenangebot ja/nein** — heute kann ein Kunde ein Angebot nur annehmen
     oder ablehnen, nicht darüber verhandeln.
   - **`support@` oder `kontakt@`** als sichtbare Adresse. Der Code lenkt
     inzwischen beides auf ein Postfach; die Frage ist nur noch, welcher Name
     im Produkt steht.

### Dritte
- **Fachanwalt IT-/Vertragsrecht:** „Treuhand" ist aufsichtsrechtlich besetzt
  (§ 1 Abs. 1 ZAG) und das eigene `zagGate.ts` hält Live-Zahlungen genau
  deswegen zu. Dazu: Leistungsversprechen „Werkant Schutz" (was genau ist der
  Auslöser), AGB-Klausel für Betrugsverdacht, P2B-Konformität, F6 P2B-AGB.
- **Steuerberater:** USt-Behandlung der Plattformgebühr in beide Richtungen
  (die Reverse-Charge-Annahme in `feeEngine.ts` ist für DE→DE fraglich), und ob
  die Bagatellgrenze 30 Transaktionen / 2000 € überhaupt gilt — § 4 Abs. 5
  PStTG ist für **Warenverkäufer** geschrieben, Werkant vermittelt
  Dienstleistungen. Fällt die Antwort auf „alle melden", ist das eine Zeile,
  weil die Schwelle ein Parameter ist.
- **EAS-Builds** für die Stores (Push aufs iPhone und Foto-Upload gehen erst
  mit nativem Build).

### Was die KI ohne dich abarbeiten kann
Die Q1–Q6-Warteschlange vom 29.07. ist überholt — die Sitzungen vom 06.–16.08.
haben einen Teil davon miterledigt und andere Befunde nach vorn geschoben.
Maßgeblich ist jetzt die Liste am Kopf von `docs/SESSION_HANDOFF.md`. Offen und
ohne Founder-Klick machbar sind derzeit:

- **Nebenläufigkeit echt testen** (`dblink`): die Idempotenz-Tests laufen bisher
  sequenziell und beweisen kein Verhalten bei gleichzeitigen Webhooks.
- **Quartalswerte nach § 15 PStTG** — gemeldet wird bisher nur die Jahressumme.
- **Löschfrist für Betrugsvermerke** (`fraud_warning_*`, Migration 0640): sie
  stehen unbefristet am Vertrag.
- **Erstattete Verträge in den Screens** kennzeichnen — in der Datenbank
  vollständig erfasst, in der Oberfläche sieht ein erstatteter Vertrag noch aus
  wie ein sauberer.

**Nicht mehr offen:** Anbieter-Verfügbarkeit (Migration 0740, #185),
Strike-Verfall und -Begründung (0720, #181), Speicherdauern gegen die
Datenschutzerklärung (0730, #184), Postfach-Zusammenführung im Code (#182),
Werkzeug für die drei manuellen Verstoßgründe (0750).

---

## 5. Arbeitsweise — und was die Fehler gelehrt haben

### Ende Juli: neun PRs (#147–#157), db-test von 46 auf 85 Assertions
Inhaltlich fast durchgehend Reparatur, nicht neue Funktion:

- Erstattetes Geld konnte erneut an den Anbieter ausgezahlt werden.
- Der Kunde zahlte bei 23 Preisen **einen Cent mehr als angezeigt**
  (JS-Fließkomma gegen Postgres-`numeric`).
- Ein Anbieter konnte seine **eigene Steuermeldung abschalten**.
- Der Jahreswechsel löschte die DAC7-Meldegrundlage des Vorjahres.
- Drei Screens zeigten **erfundene Bewertungen**, einer auf dem Profil einer
  echten Person (Anhang zu § 3 Abs. 3 UWG, per se unzulässig).
- Die Testharness konnte **grün melden, ohne zu prüfen**.
- Eine Erstattung nach Abschluss war in der Datenbank unsichtbar.

### August: 28 PRs (#158–#185), db-test von 85 auf 166
Zwei Themen, beide ausgelöst durch Befunde des Founders am Gerät.

**Erstens: eine grüne Prüfung, die nichts prüfen kann.** Sieben Gerätebefunde
hatten sieben grüne Haken davor — Jest lief in UTC, sodass ein
Zeitzonenfehler unsichtbar war; der Anrede-Prüfer sah nur etwa ein Drittel des
sichtbaren Texts; ein rollen-gesperrter Bildschirm wurde von den Browser-Reisen
nie erreicht; zwei RLS-Bedingungen deckten dieselben Fälle ab. Daraus die
Arbeitsregel, die heute über allem steht: **ein grüner Haken zählt erst, wenn
eine Mutation belegt, dass er rot werden kann** — und zwar für jede Form, in
der der Fehler auftreten kann.

**Zweitens: der Code widersprach den eigenen Dokumenten.** Angestoßen von der
Founder-Frage „wie macht Airbnb das mit Strikes?". Beim Nebeneinanderlegen von
Paragraph und Quelltext kam heraus: AGB §7(3) sagt „3 Strikes innerhalb von 12
Monaten", gezählt wurde ohne jede Datumsgrenze; §7(4) verspricht eine
Begründung nach Art. 4 P2B-VO, gespeichert war ein Integer. Danach dieselbe
Übung für die Datenschutzerklärung (zwei von fünf Speicherdauern stimmten
nicht, ein Consent-Log gab es gar nicht) und für die restlichen AGB-Paragraphen
(drei von zehn waren nicht gedeckt).

**Regel daraus:** Bei jedem Feature mit einer Zusage in AGB, Datenschutz oder
Widerrufsbelehrung den Paragraphen neben den Code legen und Satz für Satz
abgleichen. Fristen, Begründungspflichten und Beschwerdewege sind prüfbare
Zusagen, keine Prosa.

### Die wichtigste Lehre
**Solange ich meine eigene Arbeit selbst abgenommen habe, sind Fehler
durchgegangen** — darunter ein Fix, der einen Geldfehler *unsichtbar* machte
statt ihn zu beheben (#149), und ein Test, der einen Datenverlust zur *Absicht*
erklärte (Z5). Beides fand erst ein Fachagent.

Seit dem 28.07. gilt: **Review durch einen Fachagenten VOR dem Merge**, nicht
danach. Jeder Lauf seitdem hat echte Befunde gebracht — der CCO fand einen
Fehler, der schon vor dem Merge scharf war (Doppelzahlung über den *manuellen*
Erstattungsweg, den ich selbst empfohlen hatte).

Umgekehrt gilt genauso: **ein Agenten-Vorschlag war falsch.** Der Review wollte
Erstattungen von der DAC7-Meldesumme abziehen; das hätte den Anbieter zu niedrig
gemeldet, weil es keine Transfer-Rückabwicklung gibt. Weder meine Arbeit noch
ihre ungeprüft übernehmen.

### Der autonome Loop — abgeschaltet
Die Routine lief täglich 06:00 UTC und hat in ihrer gesamten Laufzeit **nichts
produziert**: erst ein stiller Ausfall vom 19.–27.07., danach eine leere
Warteschlange, weil ich jeden Block interaktiv abgearbeitet habe, statt ihn
einzustellen. Das Lebenszeichen in `docs/agents/loop-heartbeat.md` hat genau
einen Eintrag, den Startwert vom 29.07.

Auf Founder-Anweisung vom 30.07. ist der Loop aus. Der Wächter-Workflow
(`.github/workflows/loop-heartbeat.yml`) ist am 06.08. ebenfalls stillgelegt
worden — er meldete täglich denselben bekannten Zustand, und ein täglicher
Alarm über einen Absichtszustand ist kein Detektor, sondern Rauschen. Der
`schedule`-Block steht auskommentiert im Workflow und ist wieder scharf zu
schalten, sobald die Routine erneut läuft.

Die Arbeit läuft seither interaktiv. Das ist die ehrlichere Beschreibung des
Ist-Zustands: **es gibt derzeit keinen Automatismus, der ohne den Founder
Fortschritt erzeugt.**

---

## 6. Wenn du einen neuen Chat beginnst

Reihenfolge zum Einlesen: dieses Dokument → `docs/SESSION_HANDOFF.md`
(Warteschlange und Chronik) → `CLAUDE.md` + `AGENTS.md` (Arbeitsregeln,
Test-Regeln, CI-Verhalten).

Verifikation vor jedem Commit:

    npx tsc --noEmit && npx jest
    service postgresql start >/dev/null 2>&1; bash scripts/db-test/run.sh
    # bei Änderungen an supabase/functions/**:
    for fn in supabase/functions/*/index.ts; do deno check --node-modules-dir=auto "$fn"; done

Erwartet (Stand 21.08.2026): tsc 0 Fehler, Jest 389/389, db-test 166/166.
Die db-test-Zahl ist in `scripts/db-test/run.sh` als `EXPECTED` fest verdrahtet
und wird geprüft: sinkt sie, ist eine Zusicherung verschwunden — das ist der
Fehler, nicht die Zahl. Nie „passend machen", ohne die Differenz erklärt zu
haben. Dazu die Browser-Prüfungen mit `bash scripts/reisen/run.sh`.

**Fünf Regeln, die alle aus echten Fehlern stammen:**
1. Vor dem Merge einen Fachagenten prüfen lassen — auch und besonders bei
   eigener Arbeit.
2. Nichts als „geprüft" ausgeben, was gegen Annahmen statt gegen die Realität
   geprüft wurde. Bei jedem Testblock dazuschreiben, was er *nicht* zeigt.
3. Ein grüner Haken zählt erst, wenn eine Mutation belegt, dass er rot werden
   kann.
4. Bei jeder Zusage in AGB, Datenschutz oder Widerruf den Paragraphen neben den
   Code legen.
5. Keine Testkonten in der Produktion anlegen (`AGENTS.md`, Standing Test
   Rules). Es lagen einmal ~20 Stück drin.

**Und der eine Satz, der über allem steht:** Solange kein Secret gesetzt ist,
kann kein Mensch die App benutzen und niemand bezahlen. Jede weitere Zeile Code
wird gegen Annahmen geprüft, nicht gegen die Wirklichkeit — und der Abstand
zwischen beidem wächst mit jedem Tag, an dem niemand einen echten Vorgang
durchlaufen hat.
