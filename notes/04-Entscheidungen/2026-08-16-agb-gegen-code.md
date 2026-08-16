# AGB gegen Code: systematischer Abgleich

**Datum:** 2026-08-16 · **Von:** Claude (CTO-Rolle)
**Anlass:** Nachdem an einem Tag zwei Widersprüche zwischen AGB und Code
aufgefallen waren — beide durch Nachfragen des Founders, keiner durch einen
Test —, habe ich alle Paragraphen einzeln gegen den Code gelesen.

## Ergebnis in einem Satz

Von 10 Paragraphen sind **drei** nicht durch den Code gedeckt. Zwei davon
habe ich behoben. Der dritte betrifft **Geld** und ist eine Founder-Entscheidung.

---

## 1. §7(3) — Strike-Frist · BEHOBEN (PR #181)

> „3 Strikes **innerhalb von 12 Monaten** führen zur dauerhaften Sperrung."

Der Code zählte über die **gesamte Kontodauer** und ließ Strikes per
`greatest()` nie wieder sinken. Traf ausgerechnet treue Anbieter. Dazu §7(4):
die zugesagte Begründung (Art. 4 P2B-VO) war technisch unmöglich, weil nur ein
Integer gespeichert war.

---

## 2. §2(4) — Ranking-Transparenz · BEHOBEN (dieser PR)

> „Die Reihenfolge, in der Anbieter in **Suchergebnissen** und Übersichten
> angezeigt werden, richtet sich maßgeblich nach dem Bewertungsdurchschnitt
> und der Anzahl der Bewertungen"

`app/suche.tsx` hatte **gar keine Sortierung** — weder `.order()` noch ein
`sort()`. Die Suche lieferte die Zeilen in der Reihenfolge, in der Postgres
sie zufällig zurückgab.

Das ist keine Kleinigkeit: Art. 5 der P2B-Verordnung (EU) 2019/1150 verlangt
diese Offenlegung ausdrücklich, und was dort steht, muss stimmen. Die
Startseite („Top-Anbieter") sortierte bereits richtig — ausgerechnet die Suche,
die der AGB-Satz **zuerst** nennt, nicht.

**Nebenwirkung, die der Founder kennen sollte:** Wer nach Bewertung sortiert,
stellt neue Anbieter ohne Bewertung hinten an. Für die Kölner Akquise ist das
unbequem. Der AGB sieht dafür schon eine eigene Rubrik nach Registrierungsdatum
vor — die gibt es auf der Startseite, aber **nicht in der Suche**. Wer neue
Anbieter auch in der Suche sichtbar machen will, muss den AGB-Text erweitern,
nicht die Sortierung heimlich ändern.

---

## 3. §4(6) — Ausfallentschädigung · OFFEN, FOUNDER-ENTSCHEIDUNG

> „Der nicht erstattete Anteil wird dem **Anbieter als Ausfallentschädigung
> ausgezahlt**."

**Er wird es nicht.** Nachgeprüft:

- `cancel-contract/handler.ts` erstattet dem Kunden `refundPct`, setzt den
  Vertrag auf `cancelled`, öffnet den Auftrag neu und schickt eine Push. Eine
  Auszahlung an den Anbieter kommt darin nicht vor.
- `release-escrow/handler.ts` verlangt `status === "active"`. Ein stornierter
  Vertrag steht auf `cancelled` und kann damit **nie** ausgezahlt werden.
- Es gibt keinen Trigger und keinen Cron, der stornierte Verträge auszahlt.
- Suche nach „Ausfall"/„Entschädigung"/„compensation" im gesamten Code:
  **ein einziger Treffer — der AGB-Satz selbst.**

Der nicht erstattete Betrag bleibt im Stripe-Guthaben der Plattform.

**Der schlimmste Fall:** Storniert der Kunde weniger als 24 Stunden vor dem
Termin, bekommt er 0 % zurück, der Anbieter bekommt 0 %, und Werkant behält
den vollen Betrag. Genau das schließt der AGB-Satz aus.

Dazu passt die Push an den Anbieter: *„Kunde hat … storniert. Keine
Rückerstattung."* Aus seiner Sicht klingt das nach guter Nachricht — er bekommt
trotzdem nichts.

### Zwei Wege, beide nicht meine Entscheidung

**A. Die Zusage einlösen.** Bei Stornierung den nicht erstatteten Anteil per
Stripe-Transfer an den Anbieter auszahlen. Das ist die kaufmännisch richtige
Regel — wer einen Termin freigehalten hat, wird für die kurzfristige Absage
entschädigt — und es ist das, was in den AGB steht. Es bewegt aber echtes Geld
und braucht deine ausdrückliche Freigabe; ich habe daran nichts implementiert.

**B. Den AGB-Text an die Wirklichkeit anpassen.** Schneller, aber: eine Klausel
zum eigenen Vorteil zu streichen, nachdem man gemerkt hat, dass man sie nicht
einhält, ist kein guter Zug — weder gegenüber Anbietern noch, falls es je
jemand prüft.

**Meine Empfehlung: A.** Nicht aus Rechtsvorsicht, sondern weil die Regel
richtig ist. Ein Handwerker, der einen halben Tag blockiert hat und zwei
Stunden vorher abgesagt wird, hat einen echten Schaden. Solange die Plattform
diesen Betrag einbehält, verdient sie an genau dem Vorfall, der ihren Anbieter
trifft — das hält keinem Gespräch in Köln stand.

**Bis zur Entscheidung** darf keine Stornierung unter 48 Stunden in Produktion
laufen, ohne dass jemand den einbehaltenen Betrag von Hand an den Anbieter
weiterleitet.

---

## Geprüft und in Ordnung

| Paragraph | Zusage | Befund |
|---|---|---|
| §3(1) | Mindestalter 18 | greift, Browser-Reise 2 prüft es |
| §4(5) | Anbieter storniert → 100 % an den Kunden | `refundPct = 1.0`, unabhängig vom Zeitpunkt |
| §4(6) | >48 h = 100 %, 24–48 h = 50 %, <24 h = 0 % | deckungsgleich |
| §6(1) | 2,5 % mind. 1,50 € · Schutz 1,99 € | deckungsgleich |
| §6(2) | 8 % mind. 3,00 € · Nachbarschaft 0 % | deckungsgleich |
| §7(2) | vier Verstoßgründe | alle vier in der Tabelle (drei noch ohne Auslöser) |
| §7(5) | Beschwerdeweg | im Dashboard und in der Sperrmeldung |

## Nicht mechanisch prüfbar, deshalb hier notiert

- **§4(3)** „Auszahlung … innerhalb von 2 Werktagen nach Freigabe" — hängt an
  Stripes Auszahlungsrhythmus, nicht an unserem Code. Vor dem Marktstart im
  Stripe-Dashboard gegenprüfen.
- **§6(4)/§10(1)** Ankündigungsfrist von 6 Wochen für Preis- und
  AGB-Änderungen — es gibt keinen Mechanismus, der eine Fassung datiert oder
  eine Zustimmung festhält. Solange sich nichts ändert, ist nichts verletzt;
  bei der ersten Änderung wird es gebraucht.
- **§3(4)** „Ein Nutzer darf nur ein Konto führen" — nicht durchgesetzt. Als
  Nutzerpflicht formuliert, nicht als Plattformzusage; keine Sofortmaßnahme.

## Absicherung

`scripts/agb-code-check.py` prüft in CI die **bezifferten** Zusagen (14 Stück):
Gebührensätze, Mindestbeträge, Stornoschwellen, Strike-Frist, Sortierung.
Läuft eines auseinander, wird es rot — egal auf welcher Seite jemand
geschraubt hat.

Mutationsproben: Provision auf 10 % → rot; Such-Sortierung entfernt → rot;
12-Monats-Fenster entfernt → rot.

**Grenze:** Zusagen, die *Verhalten* beschreiben statt Zahlen („wird
ausgezahlt", „wird per E-Mail mitgeteilt"), lassen sich so nicht prüfen. Genau
dort lag Befund 3. Diese Sätze gehören bei jedem Feature einzeln gegen den
Paragraphen gelesen — dafür gibt es keine Abkürzung.
