# Werkant — Stand und Vision

*Geschrieben 30.07.2026 als Einstiegspunkt für eine neue Session. `main` steht
auf `d7576f6`.*

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
| Screens | 54 |
| Migrationen | 66 (4-stellige Präfixe, `0010`–`0640`) |
| Edge Functions | 13 |
| Unit-Tests (Jest) | 363 |
| DB-Integrationstests | 85 Assertions über 12 Dateien |

**Was funktioniert und gegen echtes Postgres verifiziert ist:** Registrierung
mit DOI-Gate, Auftrags-Wizard (Entwurf überlebt den Login), Angebots-Flow,
`accept_offer` mit serverseitiger Gebührenberechnung, Escrow-Kette,
Chat pro (Auftrag, Anbieter)-Thread mit Vor-Vertrags-Rückfragen,
Terminvorschläge, Bewertungen, Strike-System, DSGVO-Export und -Löschung,
PStTG/DAC7-Meldegrundlage.

**Der entscheidende Satz zum Reifegrad:** All das ist gegen lokales Postgres,
Unit-Tests und statische Prüfungen abgesichert. **Ein vollständiger Vorgang ist
nie von einem Menschen durchlaufen worden.** Kein echter Auftrag, keine echte
Zahlung, keine echte Auszahlung.

---

## 3. Der eine Blocker

**`RESEND_API_KEY` ist in den Supabase-Secrets nicht gesetzt.**

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
`localhost:3000`-Link in der Bestätigungsmail). Etwa zehn Minuten.

---

## 4. Was vor uns liegt

### Nur der Founder kann das
1. **`RESEND_API_KEY`** + Site-URL — siehe oben. P0.
2. **Stripe Live-Keys** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`),
   Webhook-Endpoint im Dashboard, **Stripe Connect aktivieren**.
   Ablauf: `docs/release/LIVE_CUTOVER_RUNBOOK.md`.
3. **Echte Impressumsdaten** in `constants/legal.ts` (`LEGAL_PLACEHOLDER = true`,
   dort stehen „[Ihr Name]" und „Musterstraße 1"). Für beide App-Stores
   zusätzlich verifizierter Händlerstatus nach DSA — ohne echte Firmendaten
   kommt die Einreichung nicht durch.
4. **Zehn Dashboard-Klicks** aus `docs/security/GO-LIVE-SECURITY-CHECKLIST.md`
   (RLS gegenprüfen, Leaked-Password-Schutz, Passwortlänge, 2FA, Backups …).
5. **Google-/Apple-Login** freischalten (Code fertig, OAuth-Clients fehlen).
6. **Zwei Produktentscheidungen**, die ich bewusst offen gelassen habe:
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
Sechs Blöcke in `docs/SESSION_HANDOFF.md` unter „Warteschlange", einer pro
Loop-Lauf: erstattete Verträge in den Screens sichtbar machen (Q1), Löschfrist
für Betrugsvermerke (Q2), Art.-14-Absatz in der Datenschutzerklärung (Q3),
Anbieter-Screen auf die Meldezahl statt den Zähler (Q4), echter
Nebenläufigkeits-Test per `dblink` (Q5), Quartalswerte nach § 15 PStTG (Q6).

---

## 5. Arbeitsweise — und was diese Woche gelehrt hat

**Neun PRs (#147–#157), db-test von 46 auf 85 Assertions.** Inhaltlich war das
fast durchgehend Reparatur, nicht neue Funktion:

- Erstattetes Geld konnte erneut an den Anbieter ausgezahlt werden.
- Der Kunde zahlte bei 23 Preisen **einen Cent mehr als angezeigt**
  (JS-Fließkomma gegen Postgres-`numeric`).
- Ein Anbieter konnte seine **eigene Steuermeldung abschalten**.
- Der Jahreswechsel löschte die DAC7-Meldegrundlage des Vorjahres.
- Drei Screens zeigten **erfundene Bewertungen**, einer auf dem Profil einer
  echten Person (Anhang zu § 3 Abs. 3 UWG, per se unzulässig).
- Die Testharness konnte **grün melden, ohne zu prüfen**.
- Eine Erstattung nach Abschluss war in der Datenbank unsichtbar.

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

### Der autonome Loop
Täglich 06:00 UTC. Er hat vom 19.–27.07. **still ausgesetzt** und danach drei
Tage nichts produziert, weil ich die Warteschlange selbst geleert und jeden
Block interaktiv abgearbeitet habe. Seit #157: Warteschlange gefüllt, und die
Routine schreibt bei **jedem** Lauf ein Lebenszeichen in
`docs/agents/loop-heartbeat.md`. Ein Wächter-Workflow prüft täglich 10:00 UTC,
ob es jünger als 28 Stunden ist, und mailt sonst.

Fehlt für einen Tag die Zeile, ist die Routine nicht gelaufen — **das ist ein
Befund, keine Kleinigkeit.** Die Fehlerklasse „Automatismus fällt still aus" hat
dieses Projekt zweimal getroffen.

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

Erwartet: tsc 0 Fehler, Jest 363/363, db-test 85/85.

**Drei Regeln, die aus Fehlern dieser Woche stammen:**
1. Vor dem Merge einen Fachagenten prüfen lassen — auch und besonders bei
   eigener Arbeit.
2. Nichts als „geprüft" ausgeben, was gegen Annahmen statt gegen die Realität
   geprüft wurde. Bei jedem Testblock dazuschreiben, was er *nicht* zeigt.
3. Keine Testkonten in der Produktion anlegen (`AGENTS.md`, Standing Test
   Rules). Es lagen einmal ~20 Stück drin.

**Und der eine Satz, der über allem steht:** Solange `RESEND_API_KEY` fehlt,
kann kein Mensch die App benutzen. Jede weitere Zeile Code wird gegen Annahmen
geprüft, nicht gegen die Wirklichkeit.
