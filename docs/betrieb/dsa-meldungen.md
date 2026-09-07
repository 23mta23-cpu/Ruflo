# Meldungen und Beschränkungen bearbeiten (DSA)

Was die Verordnung von Werkant verlangt, sobald jemand einen Inhalt meldet oder
wir eine Maßnahme ergreifen. Der Code deckt die Speicherung und die
Pflichtbestandteile ab (Migration 0810) — die Bearbeitung ist Handarbeit, und
zwar fristgebunden.

## Einstufung, damit niemand zu viel oder zu wenig baut

Werkant ist eine **Online-Plattform** und ein **Kleinstunternehmen**.

| | |
|---|---|
| Art. 19 | nimmt den **gesamten Abschnitt 3** (Art. 19–28) aus — außer Art. 24 Abs. 3 |
| Art. 29 | nimmt **Abschnitt 4** (Art. 29–32) aus, also auch die Händler-Rückverfolgbarkeit |
| Art. 15 Abs. 2 | kein Transparenzbericht |

**Verbindlich bleiben:** Art. 11, 12, 14 (Abschnitt 1) sowie Art. 16, 17, 18
(Abschnitt 2) und Art. 24 Abs. 3.

Daraus folgt ausdrücklich: **kein** internes Beschwerdemanagement nach Art. 20,
**keine** zertifizierte Streitbeilegungsstelle nach Art. 21. Beides darf auch
nirgends versprochen werden. Fällt die Ausnahme weg — ab 50 Mitarbeitenden oder
10 Mio. € Umsatz —, ändert sich das; dann sind `constants/legal.ts` (Block
`DSA`), AGB §11 und der Rechtsbehelfstext in `beschraenkung_erteilen()` (0810)
zu erweitern.

## Wenn eine Meldung eingeht (Art. 16)

Meldungen landen in `inhalts_meldungen`. Der Eingang wird von der Edge Function
`inhalts-meldung` sofort vermerkt (`bestaetigt_am`) und dem Melder im Formular
quittiert — Art. 16 Abs. 4 ist damit erfüllt.

**Offene Meldungen finden:**

```sql
select id, eingegangen_am, inhalt_art, fundstelle, left(begruendung, 120) as anriss
  from public.inhalts_meldungen
 where entscheidung is null
 order by eingegangen_am;
```

**Zuerst und immer: Straftatsverdacht prüfen.** Art. 18 verlangt eine
Unterrichtung der Strafverfolgungsbehörden bei Verdacht auf eine Straftat, die
eine Gefahr für das Leben oder die Sicherheit einer Person begründet.

```sql
select id, eingegangen_am, begruendung
  from public.inhalts_meldungen
 where straftat_verdacht = true and behoerde_informiert_am is null
 order by eingegangen_am;
```

Nach der Unterrichtung:

```sql
update public.inhalts_meldungen
   set behoerde_informiert_am = now()
 where id = '<id>';
```

**Entscheiden** (Art. 16 Abs. 5). Die Entscheidung muss dem Melder mitgeteilt
werden, samt Hinweis auf Rechtsbehelfe:

```sql
select public.meldung_entscheiden(
  '<id>',
  'entfernt',          -- entfernt | gesperrt | herabgestuft | keine_massnahme | weitergeleitet
  'Das Profil verwendete eine fremde Meisterurkunde. Der Nachweis wurde entfernt.');
```

> **Grenze, die nicht wegzudenken ist:** die Mitteilung an den Melder geht heute
> **nicht** automatisch raus — es gibt kein versendendes Postfach (`health`
> meldet `mail:false`). `meldung_entscheiden()` hält die Entscheidung fest; der
> Versand ist Handarbeit an die Adresse in `melder_email`. Sobald der Mailweg
> steht, gehört der Versand in die Edge Function.

## Wenn wir etwas beschränken (Art. 17)

**Nie** direkt in die Tabelle schreiben. `beschraenkung_erteilen()` setzt den
räumlichen Umfang und die Rechtsbehelfsbelehrung selbst — beides sind
Pflichtbestandteile, und beides ist die Sorte Angabe, die unter Zeitdruck fehlt.

```sql
select public.beschraenkung_erteilen(
  '<profil-id>'::uuid,
  'konto_gesperrt',       -- inhalt_entfernt | inhalt_gesperrt | inhalt_herabgestuft
                          -- konto_gesperrt | konto_beendet | auszahlung_gesperrt
  '30 Tage',
  'Tatsachen: was genau festgestellt wurde, mit Datum und Beleg. Mindestens 40 Zeichen.',
  'agb',                  -- 'agb' oder 'rechtswidrig'
  'AGB §7 Absatz 2 Buchstabe b (Umgehung der Zahlungsabwicklung)',
  'meldung',              -- oder 'eigene_feststellung' / 'behoerdliche_anordnung'
  '<meldung-id>'::uuid);  -- bei 'meldung' PFLICHT
```

**Die Begründung herausgeben** — der Text, den der Betroffene bekommt:

```sql
select public.beschraenkung_begruendung('<beschraenkung-id>');
```

Der Betroffene sieht sie außerdem selbst in der App. Nach dem Zustellen:

```sql
select public.beschraenkung_zustellung_vermerken('<id>', 'E-Mail an a@b.de am 07.09.2026');
```

**Widerspruch stattgegeben** (AGB §7 Absatz 5):

```sql
select public.beschraenkung_aufheben('<id>', 'Widerspruch begründet: der Nachweis lag vor.');
```

## Wenn eine Behörde nach der Nutzerzahl fragt (Art. 24 Abs. 3)

```sql
select * from public.aktive_nutzer_monat(12);
```

**Diese Grenze ist bei jeder Herausgabe mitzunennen:** gezählt werden
angemeldete Nutzer mit Auftrag, Angebot oder Nachricht. Anonyme Besucher der
Webseite sind **nicht** erfasst — dafür gäbe es keine Datengrundlage ohne eine
Reichweitenmessung, die es bewusst nicht gibt. Eine Zahl ohne diese Angabe wäre
falsch.

## Was wo steht

| Pflicht | Ort |
|---|---|
| Art. 11 Kontaktstelle Behörden | `constants/legal.ts` → `DSA`, angezeigt im Impressum |
| Art. 12 Kontaktstelle Nutzer | ebenda |
| Art. 14 Moderationsregeln | AGB §11 |
| Art. 16 Meldeweg | `app/melden.tsx`, Edge Function `inhalts-meldung` |
| Art. 17 Begründung | Migration 0810, `beschraenkung_erteilen()` |
| Art. 18 Straftaten | Feld `straftat_verdacht`, AGB §11 Absatz 8 |
| Art. 24 Abs. 3 Nutzerzahl | `aktive_nutzer_monat()` |
