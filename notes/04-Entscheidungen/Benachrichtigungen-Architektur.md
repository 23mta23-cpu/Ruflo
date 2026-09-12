# Benachrichtigungen: eine Tabelle als Wahrheit, Zustellung messbar

**Stand:** 12.09.2026 · **Status:** A und B erledigt, C und D offen
**Entscheidung von mir**, auf Founder-Anweisung („wähl selbst eine sinnvolle
Option und notier sie, statt mich zu fragen").

## Anlass

Founder-Frage: „Was ist denn mit Benachrichtigungen, Pop-ups und Mails, wenn
eine Anfrage reinkommt, angenommen wird, reingestellt wird? Haben wir dort auch
eine Logik oder müssen wir es bauen?"

Aufgenommen statt geraten. Es ist beides.

## Was schon da war (Bestandsaufnahme 12.09.2026)

Neun Auslöser mit Push, alle über `sendPushToUser` bzw. die Edge Function
`send-push`:

| Ereignis | Quelle |
|---|---|
| Auftrag eingestellt → passende Betriebe | `notifyMatchingProviders` (Push **und** Mail) |
| Angebot abgegeben → Kunde | `app/betrieb/angebot-erstellen.tsx` |
| Angebot angenommen → Betrieb | `lib/offers.ts` |
| Escrow hinterlegt → Betrieb | `stripe-webhook` |
| Fertig gemeldet → Kunde | `app/betrieb/auftraege.tsx` |
| Auszahlung + Abschluss | `release-escrow` |
| Storniert | `cancel-contract` |
| PStTG-Jahresbericht | `pstg-annual-report` |

Der Geldweg ist also abgedeckt. Drei Lücken bleiben.

## Die drei Lücken

**1. Push existiert auf dem Web nicht.** `lib/notifications.ts` gibt bei
`Platform.OS === 'web'` sofort auf, es wird kein Token registriert. Die heute
live stehende App verschickt damit **keine einzige** Push-Nachricht. Alles
oben wirkt erst ab dem ersten nativen Build.

**2. Kein Push bei Chat-Nachricht und Terminvorschlag.** Gemessen: weder
`lib/messages.ts` noch `lib/appointments.ts` enthalten einen Push-Aufruf. Das
ist die häufigste Interaktion überhaupt.

**3. Strikes und DSA-Beschränkungen werden nirgendwohin zugestellt.** Der
ernste Punkt. `strike_zustellung_vermerken()` und
`beschraenkung_zustellung_vermerken()` existieren, und **niemand ruft sie
auf**, weil es keinen Versandweg gibt. Die Begründung wird geschrieben und
bleibt liegen.

Das ist kein Komfortmangel:

- **AGB §7(4)** verspricht dem Anbieter eine Begründung (Art. 4 P2B-VO,
  unmittelbar geltendes EU-Recht).
- **DSA Art. 17 Abs. 1** verlangt, die Begründung dem Betroffenen zu
  **übermitteln**. Ein Text in einer Spalte ist keine Übermittlung.

Der Kommentar in `0750` sagt das sogar selbst („Zustellung ist damit NICHT
erledigt"), und danach hat es niemand gebaut, ich eingeschlossen.

**Zusatzbefund:** Es gibt **keine Tabelle `notifications`**.
`app/benachrichtigungen.tsx` baut die Liste bei jedem Öffnen aus `jobs`,
`messages` und `offers` neu zusammen. `read` steht fest auf `false` im Code,
„als gelesen markieren" lebt nur im Bildschirmzustand. Ereignisse ohne eigene
Zeile (Auszahlung, Strike, Beschränkung) tauchen nie auf.

## Die Entscheidung

**Eine Tabelle `notifications` als einzige Wahrheit darüber, was einem Nutzer
zugestellt werden muss, plus eine messbare Zustellung.**

Drei Eigenschaften, auf die es ankommt:

1. **Die Mitteilung entsteht in derselben Transaktion wie das Ereignis.**
   Ein Strike ohne zugehörige Mitteilung darf es nicht geben können. Deshalb
   ein Trigger auf `provider_strikes` und `beschraenkungen`, nicht ein Aufruf
   aus dem Client. Der Client kann abstürzen, die Transaktion nicht.
2. **Unzugestellte Pflichtmitteilungen sind sichtbar.** `health` meldet einen
   Rückstau, wie schon beim Abnahmefrist-Lauf (`0850`). Solange Resend nicht
   eingerichtet ist, bleibt die Zustellung offen, und **genau das steht dann
   auch da**, statt unsichtbar zu bleiben.
3. **Der Kanal ist austauschbar.** Die Zeile weiß, dass sie zugestellt werden
   muss, nicht wie. Push, Mail oder beides entscheidet der Versender.

### Warum kein reiner Push

Weil Push auf dem Web nicht existiert und ein Strike den Betroffenen auch dann
erreichen muss, wenn er die App nie wieder öffnet. Eine Pflichtmitteilung, die
nur in der App sichtbar ist, ist bei einem gesperrten Konto wertlos.

### Warum nicht alles auf einmal

Blöcke, in dieser Reihenfolge, nach Schwere sortiert und nicht nach Aufwand:

- **A.** Tabelle, RLS, `benachrichtigung_anlegen()`, Trigger für Strike und
  Beschränkung, `health`-Anzeige für den Rückstau. Rechtlich relevant.
- **B.** `app/benachrichtigungen.tsx` liest die Tabelle statt sie nachzubauen;
  echter Gelesen-Status.
- **C.** E-Mail-Versand über Resend für Pflichtmitteilungen und die
  Geld-Ereignisse.
- **D.** Push für Chat und Terminvorschlag — lohnt erst mit dem ersten
  nativen Build, vorher wirkt es nirgends.

## Was bewusst NICHT gebaut wird

**Kein Benachrichtigungs-Fanout für jedes Ereignis.** Die neun bestehenden
Push-Auslöser bleiben, wie sie sind. Sie doppelt in die Tabelle zu schreiben,
brächte eine zweite Wahrheit über denselben Vorgang. In die Tabelle kommt, was
**zugestellt werden muss** (Pflichtmitteilungen) und was **sonst nirgends
steht** (Auszahlung, Strike, Beschränkung).

## Woran das später gemessen wird

- `health` meldet `zustellung_stau: false`, obwohl offene Pflichtmitteilungen
  existieren → der Prüfer sieht seinen eigenen Gegenstand nicht.
- Ein Strike ohne Mitteilungszeile → der Trigger greift nicht.
- Eine Mitteilung, die ein Fremder lesen kann → RLS ist falsch.

Alle drei sind Mutationen, die in `scripts/db-test/` rot werden müssen.

---

## Was gebaut wurde (Nachtrag)

### Block A, Migration 0860

`public.notifications` mit Trigger auf `provider_strikes` und
`beschraenkungen`. Dreizehn Assertions in
`scripts/db-test/benachrichtigungen.sql`.

Fünf Mutationen, je einzeln rot geworden: Stau meldet nie, Strike-Trigger
entfernt, RLS erlaubt alles, Rückstand zählt auch Nicht-Pflichtmitteilungen,
Eindeutigkeit je Vorgang entfernt.

`beschraenkung_begruendung_text()` ist aus `beschraenkung_begruendung` (0810)
herausgezogen, ohne Eigentümerprüfung und für Nutzer gesperrt. Damit verwendet
der Trigger denselben Wortlaut wie die Anzeige. Zwei Textfassungen derselben
Begründung wären im Streitfall das Gegenteil eines Nachweises.

**Beim Selbst-Check aufgefallen:** drei Zusagen aus dieser Notiz waren
unbelegt (Atomarität, Idempotenz, nur Pflichtmitteilungen im Rückstand).
Nachgetragen als BN11 bis BN13. Dabei zeigte sich, dass BN11 auch **ohne**
Trigger grün bliebe. Er beweist nur, dass nicht außerhalb der Transaktion
geschrieben wird. Das steht jetzt so im Test, statt mehr zu behaupten.

### Block B, der Bildschirm

`lib/benachrichtigungen.ts` führt gespeicherte und abgeleitete Mitteilungen
zusammen. Die Regel ist kein Geschmack: **Pflichtmitteilungen zuerst**, darin
die neueste zuerst. Ein Strike darf nicht unter drei Chat-Nachrichten
verschwinden, er trägt eine Frist und einen Beschwerdeweg.

Bei gleicher Kennung gewinnt die gespeicherte Fassung, weil nur sie einen
Gelesen-Status trägt, der das Schließen des Bildschirms überlebt.

**Grenze, ehrlich benannt:** Angebote und Chat-Nachrichten haben keine Zeile in
`notifications`. Ihr Gelesen-Status lebt weiterhin nur im Bildschirmzustand.
Das zu ändern hieße, jeden Vorgang zusätzlich zu spiegeln, also eine zweite
Wahrheit über dieselbe Sache. Für Pflichtmitteilungen hält der Status.

### Was als Nächstes ansteht

**Block C, Versand über Resend.** Ohne ihn bleibt `zustellung_stau` der
ehrliche Zustand: der Text existiert, die Übermittlung schuldet Werkant noch.
Hängt an `RESEND_API_KEY`, der in der Produktion fehlt. Bauen und testen lässt
sich der Versandweg trotzdem schon.

**Block D, Push für Chat und Termin.** Lohnt erst mit dem ersten nativen
Build, weil Push auf dem Web gar nicht existiert.

---

## Der Befund, den erst der Selbst-Check brachte (12.09.2026)

Ich hatte dem Founder geantwortet, für seine Beispiele („Anfrage kommt rein",
„wird angenommen") gebe es neun Push-Auslöser, der Geldweg sei abgedeckt. Das
war richtig gezählt und falsch verstanden. In `send-push` stand:

```ts
if (!token) return { sent: false, reason: "no_token" };
```

Das sieht nach einem harmlosen Sonderfall aus. Es ist für die Web-App der
**Normalfall**: `lib/notifications.ts` registriert bei `Platform.OS === 'web'`
überhaupt keinen Token. Für jeden Nutzer der heute live stehenden App endeten
damit **alle neun Auslöser** in diesem stillen Rückgabewert. Ohne Fehler, ohne
Zustellung, ohne dass es irgendwo auffiel.

Genau die Klasse, die in diesem Projekt schon mehrfach dokumentiert ist: ein
grüner Haken, der seinen Gegenstand nicht sehen kann. Ich hatte die neun
Auslöser gezählt, statt zu prüfen, ob sie ankommen.

### Was daraus folgt

`send-push` weicht auf E-Mail aus, wenn kein Push möglich ist. Damit wirken
alle neun bestehenden Auslöser sofort, ohne dass eine einzige Aufrufstelle
geändert werden musste. Das ist der Hebel, den die Entscheidung oben schon
vorgesehen hatte: **der Kanal ist austauschbar, die Aufrufstelle weiß nichts
davon.**

### Die Einwilligung musste mitwachsen

„Kein Token" heißt **zweierlei**: Web-Nutzer oder bewusst abgeschaltet
(`unregisterPushToken` setzt die Spalte auf null). Ein blinder Rückfall würde
genau denen mailen, die Benachrichtigungen abbestellt haben.

Deshalb `profiles.mail_benachrichtigungen` (0870, Vorgabe an) plus ein
Schalter „Vorgangsmails" in den Einstellungen. Die Push-Abschaltung liegt in
AsyncStorage auf dem Gerät und ist für den Server unsichtbar; diese hier muss
er sehen können.

**Pflichtmitteilungen sind davon ausgenommen** und das steht auch im
Schaltertext: Strike und DSA-Beschränkung schuldet Werkant, sie sind nicht
abbestellbar.

### Reihenfolge der Gründe

`kanalWaehlen()` prüft: erst der Wille des Nutzers, dann seine Daten, zuletzt
unsere Einrichtung. Wer abbestellt hat, soll nicht `mail_nicht_eingerichtet`
lesen. Das wäre eine Ausrede statt einer Auskunft. Sieben Deno-Tests, eine
Mutation rot gemacht.

---

## Nachtrag 12.09.2026 — der Schalter galt nur für die Hälfte der Mails

Selbst-Check gegen die Anforderung, nicht neuer Founder-Wunsch.

Der Founder hatte drei Ereignisse genannt: „wenn eine Anfrage reinkommt,
angenommen wird, reingestellt wird". Nachgemessen sind alle drei abgedeckt:

| Ereignis | Weg |
|---|---|
| Anfrage kommt rein | Chat-Nachricht im (Auftrag, Anbieter)-Thread, `app/chat.tsx` |
| Angebot angenommen | `lib/offers.ts` |
| Auftrag reingestellt | `notify-matching-providers`, gerufen aus `app/auftrag-aufgeben.tsx` |

Dabei fiel aber auf: `notify-matching-providers` verschickt seine Mail auf
`resendKey && profile?.email` — **ohne** `mail_benachrichtigungen` zu fragen.
Der Schalter „Vorgangsmails" hätte also ausgerechnet die Mail nicht
abgeschaltet, die ein Anbieter am häufigsten bekommt („Neuer Auftrag in Ihrer
Nähe"). Dieselbe Klasse wie `provider_profiles.strike_count`: etwas, das sich
setzen lässt und nichts bewirkt.

### Warum die vorhandene Abschaltung nicht genügt

Die Fußnote jener Mail nannte als Ausweg die **Verfügbarkeit**
(`provider_profiles.available`). Die nimmt den Anbieter aber zugleich aus
Suche und Startseite: sie kostet ihn Aufträge. „Unsichtbar werden oder weiter
Mails bekommen" ist keine Wahl, sondern ein Druckmittel. Für eine Mail mit
Werbecharakter muss ein Widerspruch wirken, ohne das Geschäft des
Empfängers zu treffen (§ 7 Abs. 3 Nr. 3 UWG als Maßstab, auch wo die
Verarbeitung auf Vertragserfüllung gestützt wird).

**Entschieden:** derselbe Schalter zählt auch dort; die Fußnote nennt jetzt
ihn statt der Verfügbarkeit; der Hinweistext in den Einstellungen nennt die
Auftrags-Mail ausdrücklich mit.

### Bewusst NICHT `kanalWaehlen()` wiederverwendet

`kanalWaehlen()` ist ein Entweder-oder (Push ODER Mail). Der Auftrags-Fächer
geht an viele Anbieter, und wer ein Gerät hat, bekommt beides. Die Funktion
hier einzusetzen hätte eine Verhaltensänderung eingeschmuggelt, die niemand
entschieden hat. Der Grund steht als Kommentar an der Stelle, damit die
beiden nicht später „vereinheitlicht" werden.

### Geprüft wird die Verdrahtung, nicht der Lauf

`scripts/mailversand-check.py` (CI + `scripts/reisen/run.sh`): jeder
Versand über Resend fragt die Spalte ab oder steht mit Grund in `AUSNAHMEN`
(`verify-email`, `waitlist-doi`, `zustellung`). Die Frage lautet „ist JEDER
Mailweg angebunden?", und die beantwortet kein Test einer einzelnen Funktion.
Mutation gefahren: Bedingung entfernt, Prüfer rot, danach zurückgesetzt.

**Grenze, hingeschrieben:** das Skript sieht, DASS die Spalte vorkommt, nicht
ob die Bedingung richtig herum steht. `=== false` statt `!== false` fällt dort
nicht auf.

## Zweiter Befund an derselben Datei: der Auftragstitel stand roh im HTML

Beim Ändern der Mail fiel auf, dass `${job.title}` und `${job.address_city}`
ungefiltert in das HTML gesetzt wurden. **Den Titel schreibt der Kunde.** Ein
Titel wie

```
Heizung defekt<a href="https://…">Jetzt anmelden</a>
```

hätte einen fremden Link in eine Mail gebracht, die nachweislich von Werkant
kommt und deren Absender-Domain korrekt signiert ist. Skripte filtern die
meisten Mailprogramme; Links und Text filtern sie nicht. Das ist der
wirksamste Phishing-Träger, den eine Plattform verschenken kann.

Vier von fünf Versandwegen maskierten bereits. Diese Stelle war die einzige
Ausnahme, und sie ist zugleich die einzige, in der fremder Nutzertext an
fremde Empfänger geht.

**Aufgeräumt:** `escapeHtml` liegt jetzt in
`supabase/functions/_shared/html.ts`. `send-push/kanal.ts` reicht sie weiter
(die bestehenden Importeure bleiben unverändert), `waitlist-doi` hatte eine
dritte eigene Kopie und benutzt jetzt dieselbe.

**Regel, die der Prüfer erzwingt:** jede Einsetzung im Mail-HTML maskiert
sichtbar an der Stelle (`escapeHtml(...)`) oder heißt auf `…Html`. Beides ist
dort lesbar, wo es zählt. Einzige Ausnahme mit Grund: `confirmUrl` (vom Server
gebaut). Mutation gefahren: `${titelHtml}` zurück auf `${job.title}`, Prüfer
rot, Fehlerzweig einmal ausgeführt, danach zurückgesetzt.

**Grenze:** der Prüfer sieht nur Einsetzungen im `html:`-Feld selbst. Baut eine
Funktion das HTML (wie `zustellung`), schaut er nicht hinein.
