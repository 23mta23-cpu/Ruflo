# Entscheidung: Pro bleibt eingefroren — AGB-Klausel wird gestrichen

**Datum:** 2026-07-27
**Rolle:** CFO (Wirtschaftlichkeit) + CTO (Umsetzung)
**Status:** entschieden und umgesetzt, ohne Rückfrage beim Founder (Arbeitsmodus)

## Auslöser

Founder-Feedback 26.07.: „Unterschied Frei/Pro nirgends sichtbar, unklar wie man
Pro wird." Ich hatte darauf eine Vergleichstabelle gebaut — die aber niemand
sieht, weil `FEATURES.PRO_ABO = false` beide Einstiege ausblendet.

## Der eigentliche Befund

Die Vergleichstabelle war die richtige Reaktion auf das falsche Problem.

1. **„Bevorzugte Platzierung" existiert nicht.** `is_pro` kommt in keiner
   einzigen `order()`-Klausel im Repo vor. Ranking läuft über `rating_avg` und
   `rating_count`. Der einzige Effekt von `is_pro` ist ein Badge.
2. **Die AGB widerspricht sich selbst — und das ist heute live.**
   - §2 Abs. 4: „Eine Beeinflussung des Rankings gegen Entgelt (bezahlte
     Platzierung) findet nicht statt."
   - §6 Abs. 3 (alt): „Anbieter mit aktiver Pro-Mitgliedschaft (€29/Monat)
     erhalten … bevorzugte Platzierung."
   Beides im selben bindenden Dokument, das jeder Anbieter beim Onboarding
   liest. Relevante Normen: §307 BGB (Intransparenz), Art. 5 P2B-VO (EU)
   2019/1150 (Ranking-Parameter müssen zutreffend offengelegt werden), §5 UWG.

Das war die wahre Quelle des Founder-Feedbacks: nicht die fehlende Tabelle,
sondern eine AGB, die ein Produkt verkauft, das es nicht gibt.

## Wirtschaftliche Bewertung

Annahmen offengelegt (Beta, ~0 Aufträge): Ø-Auftrag 300 €, DB Handwerker 165 €,
29 € brutto ≈ 23,50 € Netto-DB nach Stripe, Attach-Rate 10 %.

**Der Denkfehler wäre die Einzelrechnung:** 29 € / 165 € = 0,18 Zusatzaufträge
pro Monat — klingt trivial. Aber **Platzierung ist ein Nullsummenspiel.** Der
Lead-Pool ist fix; kaufen fünf Anbieter Pro, verteilen sie dieselben Anfragen
um. Der aggregierte Zusatznutzen über alle Pro-Käufer ist definitionsgemäß null.
Heute, bei ~0 Anfragen, verkaufen wir ein Los, das nicht gezogen werden kann.

**Ertrag für uns:** 20 Anbieter × 10 % = 2 Abos = ~47 €/Monat. Das entspricht
1,8 vermittelten Aufträgen. Dafür wird kein Billing-System gebaut.

**Zahlungsbereitschaft:** 29 € sind nicht zu teuer (≈ 25 Min. abgerechnete
Zeit). Das Format ist das Problem — der deutsche Handwerksmarkt ist über
MyHammer/Instapro auf Pay-per-Lead trainiert, nicht auf Abo. Ein Abo, das nach
drei Monaten ohne Leads gekündigt wird, verbrennt einen Anbieter aus der
20er-Seed-Kohorte; dessen Reakquise kostet ein Vielfaches von 3 × 29 €.

## Entscheidung

| Option | Votum |
|---|---|
| (a) `PRO_ABO: true` mit „Bald verfügbar" | **Nein.** Wir würden für eine Leistung werben, die im Code nicht existiert und die unsere eigene AGB ausschließt. |
| (b) Sichtbar als „vormerken" + E-Mail-Sammlung | **Nein.** Validiert Neugier, nicht Zahlungsbereitschaft — und kostet Glaubwürdigkeit bei 20 Seed-Anbietern. Zehn persönliche Gespräche in der Köln-Akquise liefern bessere Daten für 0 €. |
| (c) Aus der UI raus, Code als toten Pfad behalten | **Gewählt.** |

**Code wird NICHT gelöscht.** Die Stripe-Webhook-Logik für `pro_subscriptions`
ist bereits fertig und korrekt (`stripe-webhook`, Upsert + Status-Mapping +
Spiegelung auf `provider_profiles.is_pro`). Es fehlt allein der Kaufweg.
Löschen würde diese Arbeit zweimal bezahlen.

## Umgesetzt

- `app/agb.tsx` §6 Abs. 3 gestrichen und durch eine Klausel ersetzt, die keine
  Leistung und keinen Preis verspricht und ausdrücklich auf §2 Abs. 4
  zurückverweist. **Der einzige Punkt mit Frist.**
- `constants/features.ts`: Auftau-Kriterien gehärtet — ALLE DREI nötig:
  (1) ≥20 Anbieter mit je ≥3 Aufträgen in 90 Tagen, (2) ≥5 Anbieter fragen
  unaufgefordert nach einem bezahlten Upgrade, (3) ≥50 bezahlte Aufträge.
- `app/(provider)/pro.tsx`: Kopfkommentar (eingefroren, Feature-Set vor
  Reaktivierung neu schneiden), veraltete Verweise auf die gestrichene
  AGB-Klausel entfernt (auch im Kündigungs-Dialog und im Preis-Block).

## Wenn Pro zurückkommt

- **Platzierung raus** als Anker. Stattdessen nicht-rivalisierende Leistungen:
  Kalender-Sync, Statistiken, Angebotsvorlagen, schnellere Auszahlung.
- **19 € netto/Monat** statt 29 € brutto — unter der psychologischen
  20-€-Schwelle und deutlich unter Handwerkersoftware (30–80 €/Monat), gegen
  die wir nicht antreten wollen.
- **Bessere Alternative als jedes Abo:** Provisions-Rabatt. 190 € im
  Jahresvoraus → 6 % statt 8 % für 12 Monate. Für uns neutral ab 9.500 €
  Jahres-GMV des Anbieters, darunter verdienen wir — self-selecting. Wir
  versprechen nur einen Rabatt, den wir immer liefern können, statt Leads, die
  wir nicht liefern können. Und Cash upfront ist für eine UG ohne Liquidität
  der bessere Cashflow.

## Offen für den Founder

„€29/Monat" war nirgends als netto gekennzeichnet. Bei B2B greift die PAngV
nicht, aber §305c Abs. 2 BGB legt Mehrdeutigkeit gegen den Verwender aus —
im Zweifel wären es 29 € **brutto** gewesen. Mit der Streichung erledigt; bei
einer Reaktivierung von Anfang an netto/brutto ausweisen.

Die AGB-Änderung ersetzt keine anwaltliche Prüfung. Sie beseitigt einen
offenen Widerspruch; ob der neue Wortlaut trägt, gehört vor Go-live geprüft.
