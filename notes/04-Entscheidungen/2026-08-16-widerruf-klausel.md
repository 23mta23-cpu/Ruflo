# Widerrufs-Klausel im Zahlungsschritt: Nachweis gebaut, Wortlaut offen

**Datum:** 2026-08-16 · **Entschieden von:** Claude (CTO-Rolle)
**Umkehrbar:** ja · **Status: TEILWEISE OFFEN — [ANWALT] erforderlich**

## Anlass

Founder am Gerät, beim Zahlungsschritt:

> „Den verzicht habe ich nicht verstanden was steht da und muss das sein?"

Die Stelle: `app/zahlung.tsx`, eine Checkbox mit einem Satz —

> „Ich verzichte auf mein Widerrufsrecht gemäß §356 Abs. 4 BGB und stimme zu,
> dass die Leistung sofort beginnen kann."

Ohne Haken bleibt „Jetzt zahlen & Escrow sperren" gesperrt.

## Was beim Nachsehen zusätzlich auffiel

Etwas, wonach niemand gefragt hatte und das schwerer wiegt als der Wortlaut:

**Die Zustimmung wurde nirgends gespeichert.** `agreed` war ein gewöhnliches
`useState(false)`; `handlePay()` schickte an `create-payment-intent`
ausschließlich `contract_id`. Der Haken sperrte einen Knopf und verschwand mit
dem Bildschirm.

Widerruft ein Kunde nach getaner Arbeit, konnte weder Werkant noch der Anbieter
belegen, dass er der Klausel je zugestimmt hat. Der Haken schützte in genau dem
Moment nicht, für den er gedacht ist.

## Was ich entschieden und gebaut habe

**Migration 0710 `widerruf_consents`.** Festgehalten wird der **Wortlaut**, den
dieser Kunde gesehen hat, samt Fassungskennung — nicht nur ein Häkchen. Eine
Zustimmung zu einem Text, den man später nicht vorlegen kann, ist als Nachweis
wenig wert; Textfassungen ändern sich, und was 2027 im Quelltext steht, ist
nicht, was der Kunde 2026 gelesen hat.

Der Nachweis wird **vor** der Zahlung geschrieben. Schlägt das fehl, wird nicht
bezahlt — eine Zahlung ohne belegte Einwilligung ist genau die Lage, die der
Haken verhindern soll. Der Nachweis ist für Clients weder änderbar noch
löschbar; der Kunde darf ihn lesen (Art. 15 DSGVO).

**Der Wortlaut der Erklärung selbst bleibt inhaltlich unverändert.** Daneben
steht jetzt, was sie bedeutet — drei Sätze, keine Paragrafenkette im ersten:
was Sie aufgeben, warum, und was passiert, wenn Sie **nicht** zustimmen.

Warum diese Trennung: die Klausel verständlich zu **erklären** senkt das Risiko
aus dem Transparenzgebot. Ihre **Substanz** zu ändern, ohne die Rechtslage
sicher zu kennen, könnte sie verschlechtern. Das eine ist meine Entscheidung,
das andere nicht.

## [ANWALT] — offen, vor dem Marktstart zu klären

Ich ersetze keine Rechtsberatung. Diese Punkte sind **Fragen**, keine
Feststellungen:

1. **Ist „Verzicht" überhaupt die richtige Konstruktion?** §356 Abs. 4 BGB
   beschreibt dem Wortlaut nach das **Erlöschen** des Widerrufsrechts nach
   vollständiger Erbringung — nicht einen im Voraus erklärten Verzicht.
2. **§361 Abs. 2 S. 1 BGB** begrenzt Abweichungen zum Nachteil des
   Verbrauchers. Ob eine vorherige Verzichtserklärung daran scheitert, kann ich
   nicht beurteilen.
3. **Wessen Widerrufsrecht ist gemeint?** Laut AGB §1(2) kommt der Vertrag
   zwischen Kunde und Anbieter zustande, Werkant vermittelt nur. Der Text nennt
   keine Gegenseite. Das sollte er.
4. **§305c / §307 BGB** — überraschende Klausel und Transparenzgebot. Dass der
   Founder selbst den Satz nicht verstanden hat, ist ein Signal, kein Beweis.

Bis dahin gilt: der Nachweis läuft, der Wortlaut steht unverändert, und die
Erklärung daneben beschreibt nur, was die App tatsächlich tut.

## Absicherung

`scripts/db-test/widerruf-consent.sql`, 8 Assertions, in CI.
Mutationsproben: Nachweis änderbar gemacht → rot; Unique je Vertrag entfernt →
rot; „im eigenen Namen"-Prüfung entfernt → rot.

Die dritte Probe blieb beim ersten Anlauf **grün** — die zweite Policy-Bedingung
deckte dieselben Fälle mit ab, die erste war also ungeprüft. Erst ein Test für
den Fall, den nur sie abfängt (der echte Vertragskunde erklärt auf **fremden**
Namen), machte sie nachweisbar. Ohne die Mutationsprobe hätte ich eine
ungeprüfte Bedingung für geprüft gehalten.
