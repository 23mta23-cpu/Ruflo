# Premortem-Analyse: WERKR — Autopsie-Bericht (fiktiv, Stand +2 Jahre)

> **Methodik-Hinweis:** Dies ist eine Premortem-Analyse (Gary Klein) — wir tun so, als sei WERKR
> heute in zwei Jahren bereits gescheitert, und arbeiten rückwärts, warum. Ziel ist nicht
> Schwarzmalerei, sondern das Aufdecken von Risiken, die man im Optimismus des Bauens leicht
> übersieht. Verfasst als unabhängiger, kritischer Risk-Manager — ohne Rücksicht auf bereits
> investierte Arbeit.
>
> **Fiktives Szenario:** WERKR ist gescheitert. Kapital aufgebraucht, Entwicklung gestoppt,
> Nutzer abgewandert. Was ist passiert?

---

## 1. Marktplatz-Dynamik — Das Henne-Ei-Problem (verschärft auf drei Seiten)

Das Standard-Henne-Ei-Problem eines Marktplatzes ("keine Kunden ohne Anbieter, keine Anbieter
ohne Kunden") ist bei WERKR **kein Zwei-, sondern ein Drei-Seiten-Problem**: Handwerker (B2B/B2C,
Festpreis, hohe Ticketgröße), private Nachbarschaftshelfer (C2C, Kleinstjobs) und — laut Prompt —
ein studentisches Micro-Job-Modul obendrauf. Das Standardliquiditätsproblem wurde nicht gelöst,
weil es in Wahrheit **drei separate Marktplätze unter einer Marke** waren, die um dieselbe
Aufmerksamkeit, denselben App-Store-Eintrag und denselben Vertrauens-Score konkurrierten.

**Der tödliche, nicht offensichtliche Mechanismus:** Ein Elektriker mit Meisterbrief, der €5.000-
Aufträge abwickelt, sieht in derselben App Studenten, die für €12/Std. Regale aufbauen, dieselbe
5-Sterne-Bewertungsskala nutzen und mit demselben "WERKR"-Badge auftreten. Das ist kein
kosmetisches Problem — es ist ein **Signalwert-Kollaps**: Professionelle Anbieter mit
Reputation zu verlieren meiden Plattformen, deren Marke durch Laien-Gigs verwässert wird
("Ist das Uber for Professionals oder TaskRabbit für Studenten?"). Gleichzeitig sind Studenten/
Nachbarn durch die auf Handwerker ausgelegte KYC-/Vertrags-/Rechnungs-Schwere abgeschreckt.
**Beide Seiten canceln sich gegenseitig aus**, statt sich zu verstärken — das eigentliche
Henne-Ei-Problem war nicht "zu wenig Angebot", sondern "falsches Angebot im selben Korb".

Verschärft durch **Hyperlokalität**: Ein Marktplatz für Vor-Ort-Dienstleistungen braucht
Dichte auf Stadtteil-Ebene, nicht Stadt-Ebene. "Start Köln" klingt fokussiert, ist aber immer
noch ~1,1 Mio. Einwohner über mehrere Stadtbezirke — die tatsächlich relevante Dichte
(Reaktionszeit < 2 Std. für Nachbarschaftsjobs) wurde nie stadtteilscharf gemessen oder
gesteuert, wodurch beide Seiten das Gefühl hatten, "es passiert hier nichts", obwohl
gesamtstädtische KPIs vielleicht noch akzeptabel aussahen.

---

## 2. Rechtliche & Regulatorische Stolpersteine

### a) ZAG/BaFin — der bereits bekannte, aber unterschätzte Show-Stopper
Bereits in `notes/01-Status/Go-Live-Blocker.md` als P0 markiert: Die Stripe-Connect-Escrow-
Konstruktion (Kundengeld wird bei WERKR/Stripe eingefroren, bis Freigabe) ist nach §1 Abs. 1
ZAG grundsätzlich erlaubnispflichtiges Zahlungsdienstegeschäft. Im Autopsie-Szenario: Die
Gründer haben live gestartet, bevor ein Bank-/Aufsichtsrecht-Anwalt die Konstruktion **schriftlich**
bestätigt hat — entweder weil "es funktioniert doch technisch" mit "es ist rechtlich sauber"
verwechselt wurde, oder weil der Zeitdruck des Investoren-Boards eine informelle
Selbsteinschätzung ausreichen ließ. Eine aufsichtsrechtliche Anordnung der BaFin (Einstellung
des Einlagengeschäfts) kappt sofort alle Zahlungsströme — nicht graduell, sondern binär.
Für einen Marktplatz, dessen einziges Wertversprechen "sicheres Treuhandgeld" ist, ist das
ein Todesurteil ohne Vorwarnzeit.

### b) Scheinselbstständigkeit beim Studenten-Micro-Job-Modul — der stille, verzögerte Killer
Das ist die **gefährlichste** Kategorie, weil sie nicht sofort sichtbar wird. Wenn WERKR den
studentischen Helfern faktisch vorschreibt: fixe Preise (siehe `instant-preise.tsx`-
Festpreiskatalog — **von der Plattform festgelegt, nicht vom Helfer verhandelt**), Verfügbarkeits-
fenster über den Kalender, Bewertungsdruck, der De-facto-Exklusivität erzeugt, und keine
unternehmerische Preisgestaltung — dann sind das exakt die Kriterien, die die Deutsche
Rentenversicherung in einem **Statusfeststellungsverfahren** (§7a SGB IV) als abhängige
Beschäftigung statt Selbstständigkeit einstuft. Der Killer-Mechanismus: Das passiert nicht beim
Launch, sondern **1–4 Jahre später bei einer Betriebsprüfung**, rückwirkend für den gesamten
Beschäftigungszeitraum — Nachzahlung von Arbeitgeberanteilen zur Sozialversicherung für
potenziell hunderte "Helfer" gleichzeitig, plus Säumniszuschläge. Ein Startup mit dünner
Kapitaldecke übersteht eine mehrere-hunderttausend-Euro-Nachforderung aus heiterem Himmel oft
nicht — genau dann, wenn man sich am sichersten fühlt, weil "es doch schon zwei Jahre gut lief".

### c) Gewährleistung bei Handwerker-Vermittlung — Haftungs-Unschärfe
WERKR vermittelt nur, der Werkvertrag (§631 BGB) besteht zwischen Kunde und Handwerker. Aber:
Wenn WERKR aktiv Festpreise kalkuliert, Termine koordiniert und eine "WERKR Garantie" mit
Deckungssummen bewirbt (siehe `garantie.tsx` — genau dieser Punkt wurde in der letzten
Session bereits als rechtliches Risiko geflaggt), verwischt die Grenze zwischen "reiner
Vermittler" und "faktischer Vertragspartner mit Gewährleistungspflicht". Ein Gericht könnte
WERKR im Streitfall als Mit-Verantwortlichen einstufen — insbesondere wenn Marketingsprache
("WERKR erledigt", "WERKR garantiert") dem widerspricht, was die AGB als reine
Vermittlerrolle beschreiben. Zusätzlich: Meisterpflicht (Anlage A HwO) bei zulassungspflichtigen
Gewerken (Elektro, Gas/Wasser) — wurde die Handwerksrolle/Meisterbrief-Prüfung im KYC-Flow
jemals mit der Handwerkskammer abgeglichen, oder nur als Freitext-Upload vertraut?

### d) DSGVO/PStTG — bekannt, aber die Lücke war eine Attrappe
Bereits in dieser Session entdeckt: Die PStTG/DAC7-Meldelogik (Schwellenwert-Tracking) war
vollständig implementiert, aber die **tatsächliche Übermittlung ans BZSt existierte nie** — nur
eine interne DB-Zeile plus eine (mittlerweile korrigierte) Push-Nachricht, die fälschlich
"übermittelt" behauptete. Im Scheitern-Szenario: Der erste Jahresmeldestichtag (31. Januar)
kommt, kein Scheduler ist eingerichtet, niemand erinnert sich manuell, WERKR meldet nicht —
ein Bußgeld nach §25a PStTG plus Vertrauensverlust bei den eigenen Anbietern, die glaubten,
"WERKR kümmert sich automatisch darum".

---

## 3. Technische & Operative Überladung

Die Kalenderintegration ist **nicht per se komplex** — komplex wird sie durch die Kollision
zweier fundamental unterschiedlicher Zeit-Semantiken in einem Datenmodell: Handwerker-Termine
sind lange geplant (Tage/Wochen im Voraus, feste Slots, Reiseweg-Pufferzeiten,
Material-Vorlaufzeit), Nachbarschafts-/Studenten-Jobs sind spontan (oft "heute noch", flexible
Fenster, keine Reisezeit-Logik nötig). Ein Kalendersystem, das beides gleich gut bedienen soll,
wird für keine der beiden Seiten wirklich gut — es wird ein Kompromiss, der Handwerkern zu
starr und Nachbarn zu bürokratisch vorkommt.

**Der eigentliche Killer ist organisatorisch, nicht technisch:** Jede Sprint-Priorisierungs-
Entscheidung wurde zum Nullsummenspiel zwischen "Rechnungsstellung/Steuer-Export für Profis
polieren" und "Onboarding für Studenten auf unter 90 Sekunden drücken". Ein kleines Team kann
nicht gleichzeitig Enterprise-Grade-Vertrauen (Rechnungen, DAC7, Meisterbrief-Verifizierung,
Stornofristen-Staffeln) UND Casual-Gig-Geschwindigkeit (Ein-Klick-Buchung, sofortige
Verfügbarkeit) exzellent bauen. Das Resultat im Scheitern-Szenario: Ein Produkt, das für
Handwerker "zu basic für professionelle Nutzung" und für Studenten "zu schwerfällig für einen
Neben-Job" wirkt — man verliert an beiden Fronten gegen fokussierte Wettbewerber (ein reines
MyHammer/Instapro für Profis, ein reines TaskRabbit-Klon für Gigs), die jeweils nur ein Problem
exzellent lösen.

Zusätzlich, aus dem heutigen Code-Audit bereits sichtbar: Zwei kritische Sicherheitslücken
(fehlender Spalten-Schutz auf `contracts`, IDOR in `accept_offer()`) blieben über mehrere
Entwicklungs-Sessions unentdeckt, weil Feature-Tempo Vorrang vor systematischer
Sicherheitsverifikation hatte. Im Scheitern-Szenario eskaliert genau das: Ein realer
Exploit (gefälschte Vertragsbeträge, gekaperte Fremd-Accounts) wird publik, Presse/
Verbraucherschützer berichten, Vertrauen kollabiert schneller als jedes Wachstum es
aufbauen kann.

---

## 4. Trust & Quality — Bewertungssystem als Bruchstelle

Zwei separate, sich verstärkende Probleme:

**a) Strukturelle Manipulierbarkeit war real, nicht hypothetisch.** Im heutigen Code (vor dem
Fix in dieser Session) prüfte die `reviews`-INSERT-Policy nur `auth.uid() = reviewer_id` —
**nicht**, ob überhaupt ein echter, abgeschlossener Vertrag zwischen Bewerter und Bewertetem
bestand. Jeder authentifizierte Nutzer hätte gegen jede beliebige `contract_id` eine Bewertung
posten können. Im Scheitern-Szenario wurde genau das ausgenutzt — koordinierte Fake-Bewertungen
(Konkurrenz-Sabotage oder gekaufte 5-Sterne-Ketten) untergruben die eine Ressource, die ein
Vertrauens-Marktplatz nicht verlieren darf: glaubwürdige Signale.

**b) Selbst ohne Manipulation: undifferenzierte Bewertungsskala zerstört Signalqualität.**
Eine 5-Sterne-Bewertung für "Nachbar hat pünktlich Einkäufe gebracht" und eine 5-Sterne-
Bewertung für "Elektriker hat fachgerecht die Verteilung erneuert" sind **nicht dieselbe
Information**, werden aber technisch identisch gespeichert und dargestellt (`reviews`-Tabelle,
ein `rating`-Feld 1–5, kein Track-Kontext in der UI). Für einen B2B-Kunden, der einen
Handwerker für einen €10.000-Auftrag sucht, ist ein Vertrauens-Score, der mit
Studenten-Kleinstjobs vermischt ist, **wertlos bis irreführend** — er kann nicht unterscheiden,
ob 4,8 Sterne "zuverlässiger Meisterbetrieb" oder "netter Nachbar, aber unklare Fachkompetenz"
bedeuten. Genau die Zielgruppe mit dem höchsten Umsatz pro Buchung (Handwerker-Track: 8%+2,5%
Provision vs. Nachbarschaft: pauschal €1,99) verliert zuerst das Vertrauen — und damit bricht
der wirtschaftlich tragende Teil des Geschäftsmodells zuerst weg, während der margenschwache
Teil (Nachbarschaft) den Cash-Burn allein nicht decken kann.

---

## Die 5 wahrscheinlichsten Todesursachen — und was wir HEUTE dagegen tun

### Todesursache 1: Marken-/Liquiditäts-Kollision (professionelle vs. Gig-Identität)
Die Vermischung von Handwerker-Trust-Signalen und Studenten-Gig-Signalen unter einer Marke/
einem Bewertungssystem hat beide Seiten gegenseitig abgeschreckt, bevor kritische Masse
erreicht wurde.

**Präventivmaßnahme heute:** Track-getrennte Vertrauens-Identität durchsetzen — nicht nur
kosmetisch (unterschiedliche Farben/Icons, teils schon vorhanden), sondern strukturell: Reviews,
Ratings und öffentliche Profile pro Track (`handwerker` vs. `nachbarschaft`, DB-Feld existiert
bereits) getrennt aggregieren und **nie** in einem gemeinsamen Score anzeigen. Zusätzlich:
Cowork's eigener Sprint-01-Vorschlag ("Nachbarschaft zuerst validieren, Handwerker folgt nach
Liquiditätsnachweis") explizit als formale Entscheidung fixieren, nicht nur als Empfehlung
im Raum stehen lassen — siehe Präventivmaßnahme 5.

### Todesursache 2: ZAG/BaFin-Verstoß führt zu aufsichtsrechtlicher Zwangsabschaltung
Live-Start der Zahlungsabwicklung ohne verbindliche anwaltliche Freigabe der Escrow-
Konstruktion — die BaFin stoppt den Zahlungsfluss abrupt und ohne Vorwarnung.

**Präventivmaßnahme heute:** Technisches Gate statt Vertrauen auf Prozessdisziplin einbauen:
Eine explizite Konfigurationssperre (z. B. Edge-Function-Secret `ZAG_LEGAL_SIGNOFF=confirmed`,
das `create-payment-intent`/`release-escrow` beim Fehlen hart verweigern), sodass ein
Live-Zahlungsstart **strukturell unmöglich** ist, bevor die anwaltliche Bestätigung
dokumentiert vorliegt — kein "wir starten mal im Testmodus und schalten später um"-Risiko
mehr, das versehentlich live geht.

### Todesursache 3: Scheinselbstständigkeit bei studentischen Helfern, rückwirkend aufgedeckt
Ein DRV-Statusfeststellungsverfahren Jahre nach Launch stuft die Helfer-Rolle rückwirkend als
abhängige Beschäftigung ein — Nachzahlung von Arbeitgeberanteilen für den gesamten Zeitraum
trifft das Startup ohne Vorwarnung, oft wenn die Kapitaldecke am dünnsten ist.

**Präventivmaßnahme heute:** Vor Skalierung des Nachbarschafts-/Studenten-Moduls ein
**freiwilliges** Statusfeststellungsverfahren für die Helfer-Rolle bei der DRV einholen —
Rechtssicherheit vor Wachstum, nicht danach. Parallel produktseitig entschärfen: Den
Festpreiskatalog (`instant-preise.tsx`) für die Nachbarschaft-Rolle prüfen — von der Plattform
diktierte Fixpreise sind ein klassisches Scheinselbstständigkeits-Indiz; Helfer sollten
Preise innerhalb einer Spanne selbst setzen können, um unternehmerisches Handeln nachweisbar
zu halten.

### Todesursache 4: Trust-Kollaps durch manipulierbare/undifferenzierte Bewertungen
Fake-Reviews (strukturell möglich) plus vermischte Track-Ratings zerstören zuerst das
Vertrauen der margenstarken Handwerker-Kundschaft — der wirtschaftlich tragende Teil des
Geschäfts bricht weg, bevor der margenschwache Teil genug Volumen aufbaut, um das zu tragen.

**Präventivmaßnahme heute:** Der in dieser Session bereits umgesetzte Fix (Reviews nur bei
echtem, abgeschlossenem Vertrag zwischen den tatsächlichen Parteien) ist der Anfang, nicht das
Ende — ergänzend: sichtbares "Verifizierter Auftrag"-Badge auf jeder Bewertung (Kopplung an
die jetzt geschützte `contract_id`, fälschungssicher), sowie getrennte, klar beschriftete
Rating-Anzeigen pro Track in jedem Profil (kein gemeinsamer Gesamt-Score).

### Todesursache 5: Ressourcen-Fragmentierung zwischen zwei inkompatiblen Produkt-Philosophien
Ein kleines Team versucht gleichzeitig Enterprise-Grade-Vertrauen (Rechnungen, DAC7,
Meisterbrief-Verifizierung) und Casual-Gig-Tempo (Sekunden-Onboarding) zu bauen — und liefert
für keine der beiden Zielgruppen ein exzellentes, fokussiertes Produkt, während fokussierte
Wettbewerber jeweils eine Seite exzellent bedienen.

**Präventivmaßnahme heute:** Eine formale, dokumentierte Sequenzierungs-Entscheidung treffen
(nicht nur als Empfehlung im Raum stehen lassen): Welcher Track wird in den nächsten X Wochen
mit voller Team-Kapazität validiert, welcher wird bewusst eingefroren? Diese Entscheidung
gehört nach `notes/04-Entscheidungen/` — mit explizitem Freigabe-Kriterium, wann der zweite
Track wieder Kapazität bekommt (z. B. "X echte bezahlte Transaktionen im ersten Track"), statt
dass Engineering implizit zwischen beiden Roadmaps hin- und herspringt.

---

## Schlussbemerkung

Diese Autopsie ist fiktiv — aber jede der fünf Todesursachen hat im heutigen Code oder in den
heutigen offenen Entscheidungen bereits eine **reale, nachweisbare Spur**: die ZAG-Frage ist
in `Go-Live-Blocker.md` als P0 dokumentiert, der Reviews-Bug wurde diese Session tatsächlich
gefunden und gefixt, die PStTG-Übermittlungslücke war real, der Festpreiskatalog existiert im
Code. Das ist kein Zufall — Premortems sind am nützlichsten, wenn sie nicht abstrakte
Startup-Klischees ("zu wenig Kapital", "Markt zu klein") reproduzieren, sondern konkrete,
bereits im System angelegte Bruchstellen sichtbar machen, bevor sie zu Schadensfällen werden.

---

## Status der Präventivmaßnahmen (laufend aktualisiert)

| # | Todesursache | Status | Umsetzung |
|---|---|---|---|
| 1 | Marken-/Liquiditäts-Kollision | 🟡 Teilweise | Track-getrennte Ratings umgesetzt (Migration 032). Getrennte UI-Darstellung in Profil-/Suche-Screens noch offen. |
| 2 | ZAG/BaFin-Zwangsabschaltung | ✅ Technisches Gate umgesetzt | `supabase/functions/_shared/zagGate.ts` — `create-payment-intent`/`release-escrow` verweigern Live-Zahlungen ohne `ZAG_LEGAL_SIGNOFF=confirmed`-Secret. Ersetzt nicht die eigentliche Anwaltsprüfung, macht nur den versehentlichen Live-Start strukturell unmöglich. |
| 3 | Scheinselbstständigkeit Studenten-Helfer | 🔴 Offen, braucht Tayyip | DRV-Statusfeststellungsverfahren muss real beantragt werden — kann ich nicht für dich tun. Produktseitig: Festpreiskatalog (`instant-preise.tsx`) für die Nachbarschaft-Rolle auf Preisspanne statt Fixpreis umstellen — noch nicht umgesetzt, ist eine Preismodell-Entscheidung, keine reine Code-Änderung. |
| 4 | Trust-Kollaps durchs Bewertungssystem | ✅ Kernfix umgesetzt | Migration 031 (Reviews nur bei echtem Vertrag) + Migration 032 (Ratings werden jetzt überhaupt berechnet, track-getrennt). "Verifizierter Auftrag"-Badge in der UI noch offen. |
| 5 | Ressourcen-Fragmentierung | 🔴 Offen, braucht Tayyip | Formale Sequenzierungs-Entscheidung (welcher Track bekommt jetzt volle Kapazität) ist eine strategische Entscheidung, die ich nicht für dich treffen sollte — Vorschlag: Cowork's Sprint-01-Empfehlung ("Nachbarschaft zuerst") übernehmen? |

**Zusätzlicher, unerwarteter Fund beim Umsetzen von Maßnahme 4:** Ein kritischer, unabhängiger
Bug — der Datenbank-Trigger auf `provider_profiles` hätte **jedes** Update auf diese Tabelle
zum Absturz gebracht, inklusive des Stripe-Webhooks beim Freischalten der Anbieter-Auszahlung.
Kein Anbieter hätte je Geld erhalten können. Gefunden und gefixt (Migration 033), live gegen
eine echte Datenbank bewiesen.
