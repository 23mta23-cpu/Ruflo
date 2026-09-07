# Befund: Die Website versprach eine Freigabefrist, die es nicht gibt

**Datum:** 06.09.2026 · **Rolle:** CTO / Mitgründer · **Status:** Website
korrigiert, Mechanismus offen (Founder-Entscheidung)

## Was ich geprüft habe und warum

Aufgabe war eigentlich, den Ton der Website an den der App anzugleichen. Die
Messung (`scripts/ton-check.py`) hat meine eigene Behauptung widerlegt: ich
hatte „41 % gegen 23 % Verneinung" berichtet, gemessen sind es **32 % gegen
29 %**. Der Unterschied ist Rauschen. Die Verneinung auf der Website *arbeitet*
außerdem — die ganze Positionierung ist „anders als beim Lead-Portal zahlen Sie
nicht vorne". Sie herauszunehmen hätte das Argument geschwächt.

Also habe ich stattdessen das geprüft, was an einer Werbeseite gefährlich ist:
**hält der Code, was die Seite verspricht?** Das ist dieselbe Frage, die im
Juli den Widerspruch zwischen AGB §7(3) und dem Strike-Zähler aufgedeckt hat.

## Der Befund

Die Seite versprach an **zwei** prominenten Stellen:

> „Meldet er sich nicht, läuft die Frist ab und die Freigabe erfolgt
> automatisch — Schweigen ist kein Druckmittel gegen Sie."

**Das gibt es nicht.** Nachgewiesen:

- `release-escrow/handler.ts:136` weist jeden ab, der nicht `customer_id` ist.
- Kein `pg_cron`, kein Zeitplan, keine Fristspalte, kein Service-Role-Weg.
- `contracts.status` bleibt bei Schweigen dauerhaft auf `active`.
- Es gibt **keinen Startpunkt** für eine Frist: der Anbieter kann Fertigstellung
  gar nicht melden. `app/auftrag-abschliessen.tsx` ist der Freigabe-Bildschirm
  des **Kunden**.

Für den Handwerker heißt das: bleibt der Kunde still, liegt sein Geld fest —
**schlechter als eine offene Rechnung**, weil er dort wenigstens mahnen und
klagen könnte. Ausgerechnet die Zusage, auf der die ganze „Sie zahlen
hinten"-Positionierung ruht.

Zwei weitere ungedeckte Zusagen im selben Durchgang:

| Zusage auf der Seite | Wirklichkeit |
|---|---|
| „im meisterpflichtigen Gewerk den Meisterbrief" | `meisterbrief_path` ist optional; `data/categories.ts` kennt gar kein Merkmal „meisterpflichtig". Der Riegel (0450) verlangt nur den Gewerbeschein. |
| „Freigabefrist" stehe in den AGB | Steht dort nicht. AGB §(2) sagt sogar das Gegenteil: Auszahlung „erst nach … Freigabe durch den Auftraggeber". |

Geprüft und **in Ordnung**: 8 % / mind. 3 €, 2,5 % / mind. 1,50 €, 1,99 €
Nachbarschaft mit 100 % für den Helfer, Rechenbeispiel 240 → 19,20 → 220,80,
Kunde zahlt 246,00, Stornostaffel 48 h / 24 h (Code, AGB und Seite stimmen
überein), Auszahlung 2 Werktage, PStTG-Meldepflicht, Beschwerdeweg mit
Begründungspflicht.

## Was ich getan habe

Die Website ist korrigiert und neu veröffentlicht — sie war live, und eine
unzutreffende Angabe über ein wesentliches Merkmal ist der Fall des UWG §5.
Die neuen Texte sagen, was heute stimmt (wir gehen der Sache persönlich nach)
und benennen offen, was fehlt. Das passt zur Stimme der Seite, die an anderer
Stelle schon sagt „Hier stehen keine Kundenstimmen. Wir haben noch keine."

## Was ich NICHT entschieden habe — und warum

Die Zusage war **inhaltlich richtig**. Eine Frist gehört gebaut. Ich habe sie
nicht gebaut, weil es kein Timer ist, sondern ein Feature auf dem Geldweg mit
einer rechtlichen Voraussetzung, die dem Founder gehört:

**Rechtsgrundlage wäre § 640 Abs. 2 BGB (fiktive Abnahme).** Der Werkunternehmer
setzt nach Fertigstellung eine angemessene Frist; verweigert der Besteller die
Abnahme nicht innerhalb der Frist **unter Angabe mindestens eines Mangels**,
gilt das Werk als abgenommen. Bei einem Verbraucher (§ 640 Abs. 2 Satz 2) nur,
wenn er auf diese Folge **in Textform** hingewiesen wurde.

Daraus folgt der Bauplan — und dass er ohne AGB-Klausel nicht aktiviert werden
darf:

1. Anbieter meldet Fertigstellung (**existiert heute nicht**)
2. Spalten `fertig_gemeldet_am`, `abnahme_faellig_am` auf `contracts`
3. Hinweis an den Kunden in Textform, mit der Folge ausdrücklich benannt
4. Kunde gibt frei **oder** verweigert unter Angabe eines Mangels → Streitfall
5. Schweigen + Frist abgelaufen → fiktive Abnahme → Freigabe
6. Geplanter Lauf (pg_cron), Service-Role-Weg in `release-escrow`
7. **AGB-Klausel** — ohne sie wäre die automatische Auszahlung fremden Geldes
   nach Schweigen nicht gedeckt, und das wäre schlimmer als die heutige Lücke

Aufwand: ein voller Tag auf dem Geldweg, plus die Klausel, die ein Anwalt
ansehen sollte. Der Geldweg ist der Bereich, für den unsere eigene Regel den
adversarialen Review vorschreibt.

**Kein Zeitdruck:** `zagGate.ts` blockiert Live-Zahlungen ohnehin. Es kann
heute niemand betroffen sein — die Werbung war das akute Problem, und die ist
weg.

## Empfehlung

Bauen, vor dem Start. Ohne die Frist ist „Sie zahlen hinten" für den
Handwerker ein schlechteres Geschäft als eine Rechnung, und genau das ist das
Versprechen, mit dem wir die ersten dreißig Betriebe ansprechen wollen.
