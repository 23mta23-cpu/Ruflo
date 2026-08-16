# Strikes: Vergleich mit Airbnb — und was Werkant übernimmt

**Datum:** 2026-08-16 · **Entschieden von:** Claude (CTO-Rolle) · **Umkehrbar:** ja
**Anlass:** Founder — „Wegen dem Strike, wie ist das bei Airbnb? Bitte
analysieren und dann hier versuchen anzuwenden, wenn es geht."

## Was Airbnb tatsächlich macht (belegt, nicht aus dem Gedächtnis)

Airbnbs **Off-Platform Policy** deckt genau unseren Fall ab: Zahlung und
Kontakt sollen auf der Plattform bleiben. Die veröffentlichte Sanktionsregel
lautet wörtlich:

> „In the event of repeated **or severe** violations, we may suspend or
> permanently deactivate a user's listings or account."
> — [airbnb.com/help/article/2799](https://www.airbnb.com/help/article/2799/)

Erkennung läuft über automatische Schlüsselwortprüfung in Nachrichten vor der
Buchung (Telefonnummern, E-Mail-Adressen, Namen anderer Plattformen). Bei
Kontosperren gibt es eine **Begründung** und ein **Widerspruchsverfahren**
([news.airbnb.com](https://news.airbnb.com/?p=253510)).

**Wichtigster Befund: Airbnb veröffentlicht KEINE Zahl.** Es gibt keinen
öffentlichen Schwellenwert, ab wie vielen Verstößen gesperrt wird. Sekundäre
Quellen beschreiben „erste Verletzung = Warnung, Wiederholung = Sperre", aber
Airbnb selbst bestätigt das nirgends.

## Der eigentliche Befund: Werkant muss nicht abschauen, sondern erst mal die eigenen AGB einhalten

Der Vergleich hat etwas anderes zutage gefördert. **Der Code widersprach den
AGB an drei Stellen.**

| AGB §7 sagt | Code tat |
|---|---|
| (3) „3 Strikes **innerhalb von 12 Monaten**" | zählte über die **gesamte Kontodauer**, `greatest()` ließ Strikes nie sinken |
| (4) Begründung mit den maßgeblichen Tatsachen, per E-Mail | speicherte **eine einzelne Zahl** — daraus lässt sich keine erzeugen |
| (2) vier Verstoßgründe | vergab automatisch nur für **einen** (Chat-Leaks) |

Punkt (3) trifft ausgerechnet **treue Anbieter**: wer einen Fund pro Jahr hat,
wird nach neun Jahren gesperrt, obwohl die AGB ihm ein Zwölf-Monats-Fenster
zusagen. Je länger dabei, desto eher trifft es ihn.

Punkt (4) ist nicht nur eine Selbstverpflichtung, sondern **Art. 4 der
P2B-Verordnung (EU) 2019/1150** — unmittelbar geltendes Recht gegenüber
gewerblichen Nutzern. Die Pflicht war technisch nicht erfüllbar: es gab weder
Zeitpunkt noch Anlass noch Bezug zum auslösenden Vorgang.

## Was übernommen wird

| Airbnb-Prinzip | Umsetzung bei Werkant |
|---|---|
| Aktualität statt Lebenszeit-Konto | Nur Funde und Strikes der letzten 12 Monate zählen (0720) — setzt AGB §7(3) endlich um |
| Begründung bei jeder Maßnahme | Jeder Strike trägt Anlass, Datum, Verfallsdatum und Beschwerdeweg |
| Widerspruch | `aufgehoben_am` hebt einen Strike auf und damit sofort die Sperre |
| Betroffener sieht seinen Stand | Dashboard zeigt die Akte statt „2 von 3" |

## Was bewusst NICHT übernommen wird

**Airbnbs Intransparenz.** Wir behalten die veröffentlichte Zahl („3 Strikes
innerhalb von 12 Monaten"). Für einen kleinen deutschen Marktplatz ist das
besser, nicht schlechter:

- Das deutsche Recht belohnt Transparenz. Eine Sanktionsklausel, deren
  Voraussetzungen der Nutzer nicht erkennen kann, ist unter §307 Abs. 1 S. 2
  BGB (Transparenzgebot) angreifbar — nicht sicherer.
- Airbnb kann sich Opazität leisten, weil dort Millionen Anbieter um Plätze
  konkurrieren. Werkant wirbt in Köln einzeln um Handwerker. „Wir sperren
  irgendwann, sagen aber nicht wann" ist in diesem Gespräch kein Argument.
- Eine konkrete Zahl ist überprüfbar. Genau daran ist der Widerspruch zwischen
  AGB und Code aufgefallen.

**Severity-Stufen** („severe = sofortige Sperre") sind bereits in AGB §7(3)
Satz 2 vorgesehen, aber bewusst **nicht automatisiert**. Was „schwerwiegend"
ist, entscheidet ein Mensch; ein Regex kann das nicht, und eine Sofortsperre
aus einem automatischen Signal wäre der teuerste Fehlalarm im ganzen System.

**Auto-Strike aus Nutzermeldungen** — schon bei 0700 entschieden und hier
bekräftigt: eine Meldung ist frei auslösbar, drei genügten sonst, um einen
Anbieter aus dem Markt zu nehmen.

## Absicherung

`scripts/db-test/strike-verfall.sql` (10 Assertions) und
`__tests__/strikes.test.ts` (7), beide in CI.

Mutationsproben:
- 12-Monats-Fenster wieder entfernt (= Stand vor 0720) → rot
- Verfall ignoriert → rot
- Aufhebung nach Beschwerde ignoriert → rot
- Begründung zur nichtssagenden Floskel gemacht → rot

Beim Umstellen fiel die Gesamtzahl der DB-Assertions von 130 auf 137 statt auf
die erwarteten 139 — der Pflichtabgleich in `run.sh` hat das gefangen. Ursache:
`quality-strikes.sql` setzte `strike_count` direkt auf 3, ohne Akte. Das war
ein Test-Artefakt, aber es hat eine echte Falle sichtbar gemacht: die Spalte
war beschreibbar, **ohne zu wirken**. Wer sie im Supabase-Dashboard auf 3
setzt, erwartet eine Sperre und bekommt keine. Ein Trigger leitet den Wert
jetzt bei jedem Schreibvorgang ab.

## Offen

- **Die drei anderen AGB-Verstoßgründe** (Preiserhöhung, Nichterscheinen,
  falsche Angaben) haben eine Spalte, aber keinen Weg, sie auszulösen. Bis es
  ein Admin-Werkzeug gibt, müssen sie von Hand in die Tabelle — mit
  Begründung, die Spalte erzwingt das.
- **Die Begründung geht noch nicht per E-Mail raus.** AGB §7(4) und Art. 4
  P2B-VO verlangen einen dauerhaften Datenträger; das Dashboard ist keiner.
  Sie steht jetzt wenigstens fest und ist versendbar — der Versand hängt am
  offenen `RESEND_API_KEY`.
