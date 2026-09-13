# Rechts-Audit 13.09.2026 — Lücken zwischen Rechtstext und Code

Erstellt vom CCO-Agenten, **stichprobenartig von mir gegengeprüft**. Jeder
Befund nennt eine Fundstelle; wo ich selbst nachgesehen habe, steht es dabei.

**Kein Ersatz für Rechtsberatung.** Die mit ⚖️ markierten Punkte gehören vor
dem Marktstart zu einem Fachanwalt oder Steuerberater.

---

## Von mir selbst am Code nachgeprüft (7 von 7 bestätigt)

| Befund | Fundstelle | Geprüft |
|---|---|---|
| Suche erfindet Stundensätze: `?? 13` | `app/suche.tsx:144`, angezeigt `:380` | ✅ wortgleich |
| „Verifiziert" = Stripe-Onboarding, Text sagt „Gewerbeschein & ID-Prüfung" | `app/suche.tsx:145` / `:471` | ✅ |
| Nachbarschaft-Track ist **standardmäßig an** | `constants/features.ts:21` | ✅ |
| „Renovierung" ohne `MEISTERBRIEF` in `requiredDocs` | `data/categories.ts:41-44` | ✅ |
| `/garantie`: „Ihr Geld verlässt Werkant erst, wenn Sie bestätigen" | `app/garantie.tsx:22` | ✅ |
| Bestellknöpfe ohne „zahlungspflichtig bestellen" | `auftrag-detail.tsx:183`, `angebot.tsx:251`, `vertrag.tsx:314`, `zahlung.tsx:416` | ✅ |
| Beleg addiert 19 % auf die Provision, AGB §6(2) sagt „trägt Werkant" | `app/rechnung.tsx:128-133` gegen `app/agb.tsx:90` | ✅ |

---

## Die vier gefährlichsten Punkte

### 1. ⚖️ Widerrufsbelehrung nennt den falschen Unternehmer

`app/widerruf.tsx:70,74-84` belehrt durchgehend über **Werkant**. Nach den
eigenen AGB (§1(2), §2(3)) ist Werkant **nicht Vertragspartei** — der
Dienstleistungsvertrag besteht zwischen Kunde und Anbieter.

Nach § 355 Abs. 1 BGB ist der Widerruf gegenüber dem **Unternehmer** zu
erklären, dieser schuldet die Rückzahlung und bekommt den Wertersatz
(§ 357a BGB). Eine anbieterbezogene Belehrung existiert im Code **nirgends**.

**Folge:** Ist die Belehrung fehlerhaft, beginnt die Frist nicht zu laufen
(§ 356 Abs. 3 S. 1 BGB) — Widerruf dann bis zu **12 Monate und 14 Tage**
möglich. Und ohne korrekte Belehrung gibt es keinen Wertersatz: der Handwerker
arbeitet im Widerrufsfall umsonst.

Der beweissichere Zustimmungsnachweis aus `0710` hängt damit an einer
Belehrung, die den falschen Unternehmer nennt. **Ein guter Nachweis rettet die
falsche Grundlage nicht.**

### 2. Button-Lösung — § 312j Abs. 3 und 4 BGB

Die Schaltfläche muss „mit nichts anderem als" den Wörtern *zahlungspflichtig
bestellen* (oder einer eindeutigen Entsprechung) beschriftet sein. Sonst
**kommt der Vertrag nicht zustande** (Abs. 4).

Laut AGB §4(1) entsteht der Auftrag mit der Unterzeichnung — also **vor** dem
Zahlungsbildschirm. Der maßgebliche Knopf ist „Angebot annehmen".

**Folge, wenn es schiefgeht:** Geld im Escrow, Arbeit erbracht, kein Vertrag.
Behebbar in einer Stunde.

### 3. ⚖️ PStTG-Schwelle gilt möglicherweise nur für Warenverkauf

Die Freistellung (30 Vorgänge / 2 000 €) knüpft an die Tätigkeit *Verkauf von
Waren* an. Werkant vermittelt **Dienstleistungen** — dort gäbe es keine
Bagatellgrenze, und die Plattform meldete systematisch zu wenig.
**Bußgeld bis 50 000 € (§ 25 PStTG).**

Das ist eine Einstufungsfrage, die ich nicht entscheiden kann und der Agent
ausdrücklich auch nicht. **Steuerberater, vor der ersten Meldung.**

### 4. ⚖️ Nachbarschaft-Track läuft, bevor die Abgrenzung geklärt ist

`EXPO_PUBLIC_ENABLE_NACHBARSCHAFT !== 'false'` heißt: **an, solange niemand
aktiv abschaltet.** Die DRV-Statusfeststellung ist offen.

Verschärfend: `data/categories.ts` setzt allen C2C-Kategorien einen
Mindeststundensatz **mit Verweis auf § 1 MiLoG**. Das MiLoG gilt für
Arbeitnehmer. Eine Plattform, die für angeblich Selbständige einen Mindestlohn
begründet, liefert genau das Indiz, das in einem Statusfeststellungsverfahren
gegen sie verwendet wird.

**Empfehlung:** Schalter auf `false`, bis geklärt. Der Track bringt bei 1,99 €
je Auftrag kaum Umsatz und trägt das größte Rechtsrisiko im Produkt.

---

## Vollständige Befundliste

Der Agent hat rund 40 Punkte geliefert, gegliedert nach Angreifbarkeit:

- **A** Bußgeld/Strafbarkeit: PStTG-Schwelle, `/garantie` untergräbt das
  ZAG-Argument der AGB
- **B** Abmahnung: erfundene Preise, „Verifiziert"-Irreführung, unwahre
  Aussagen auf `/garantie` (PDF, EU-Rechenzentren, automatische Sperre),
  Stornopauschale ohne Nachweisvorbehalt (§ 309 Nr. 5 BGB), Haftungsklausel
  ohne Kardinalpflichten-Ausnahme (§ 307 BGB), Zustimmungsfiktion
  (BGH XI ZR 26/20), § 5b Abs. 3 UWG am falschen Ort
- **C** Verbraucherrecht: Widerrufsadressat, fehlende Vertragsbestätigung auf
  dauerhaftem Datenträger (§ 312f Abs. 2 BGB), Button-Lösung, § 312i BGB /
  Art. 246c EGBGB fehlen ganz, Verbraucherbauvertrag (§ 650i ff. BGB) bei
  25 000 € Limit, Widerrufs-Haken auch im C2C-Track
- **D** P2B-VO: Art. 9 (Datenzugang) fehlt vollständig, Art. 8, Art. 4 Abs. 2
  (30 Tage vor Beendigung), Art. 5 nennt Ranking-Parameter, die es im Code
  nicht gibt
- **E** Steuer: § 13b UStG falsch angewandt, USt-Behandlung hängt am
  AsyncStorage des Betrachters, keine fortlaufende Rechnungsnummer,
  **keine Handwerkerrechnung an den Kunden** (§ 14 Abs. 2 S. 1 Nr. 1 UStG und
  § 35a EStG), Kleinunternehmerregelung kommt nicht vor
- **F** Handwerksrecht: „Renovierung" umgeht das Meisterpflicht-Gate
- **G** Datenschutz: Chat-Scan auf Telefonnummern/IBANs wird gespeichert und
  steht **nicht** in der Datenschutzerklärung; Expo (USA) fehlt als Empfänger;
  „Personalausweis-Scan" genannt, wird aber nicht erhoben; `§ JArbSchG` im
  Einwilligungstext ist keine Norm

## Was der Agent nicht prüfen konnte

Keine Live-Daten, kein Stripe-Dashboard, App nicht am Gerät durchlaufen, rund
90 Migrationen nur teilweise. Bei drei Normen hat er ausdrücklich Unsicherheit
markiert statt zu raten.
