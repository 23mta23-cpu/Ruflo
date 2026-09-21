# Der öffentliche Statusendpunkt gab Geschäftszahlen aus

**Datum:** 21.09.2026
**Anlass:** Bestandsaufnahme über alle Edge Functions, nachdem meine
Arbeitsliste leer war.

## Was ich gesucht und NICHT gefunden habe

Die stehende Sicherheitsregel in `AGENTS.md` verlangt für jede öffentliche
Edge Function ein Rate-Limit, strikte Eingabeprüfung und eine ausdrückliche
Zugangsprüfung. Gemessen über alle sechzehn:

- **Rate-Limit:** alle haben es, außer `stripe-webhook`. Das ist richtig so,
  ein Webhook darf nicht gedrosselt werden (sonst gehen Ereignisse verloren);
  er authentifiziert über die Signatur.
- **Eingabeprüfung:** acht nutzen `_shared/validate.ts`. Die übrigen lesen
  gar keinen Körper, bis auf `pstg-annual-report`, und die prüft von Hand
  (Typ, Ganzzahl, Bereich 2020 bis 2100). Kein Befund.
- **Zugangsprüfung:** alle außer `health` und `waitlist-doi`. Bei `waitlist-doi`
  ist der Token im Link die Berechtigung, also richtig.

**Ein Messfehler auf dem Weg, und es war ein bekannter:** meine erste Messung
las nur `index.ts` und meldete fünf Funktionen ohne Rate-Limit. Mehrere
delegieren aber an `handler.ts`. Genau diese Falle steht seit Wochen in
CLAUDE.md, und ich bin trotzdem hineingelaufen. Erst die Messung über **alle**
`.ts` je Ordner ergab das richtige Bild.

## Was ich gefunden habe, und es war mein eigener Fehler

`/health` hat `verify_jwt = false` (supabase/config.toml), ist also ohne
Anmeldung erreichbar. In der Antwort standen:

```
pruef_offen, reklamationen_offen, meldungen_offen
```

als **Zahlen**. `reklamationen_offen` und `meldungen_offen` habe ich in
`30b8f50` selbst hinzugefügt, direkt unter meinem eigenen Kommentar:

> Wie überall hier: nur Booleans nach außen, keine Zahlen. Wie viele Verträge
> offen sind, ist Geschäftszahl und geht niemanden an, der den Endpunkt
> aufruft.

Ein Wettbewerber konnte täglich abfragen, wie viele Betriebe auf Freigabe
warten, also das Wachstum der Angebotsseite eines Kaltstart-Marktplatzes
mitlesen.

## Entscheidung

Booleans nach außen (`pruef_wartet`, `reklamationen_warten`,
`meldungen_warten`). Der Wächter `wartet-jemand.yml` verliert die Zahl im
Alarmtext; für seinen Zweck („es wartet jemand") genügt das, und die Zahl
steht ohnehin im Prüf-Postfach, wo der Betreiber hinsieht.

**Nicht gewählt:** den Endpunkt hinter das Admin-Secret legen. `verify_jwt =
false` ist laut Kommentar in `config.toml` zwingend, weil der Health-Workflow
ohne Bearer-JWT aufruft. Ein zweiter Detailgrad mit Secret wäre möglich, würde
aber ein Secret in einen weiteren Workflow bringen, und das ist Founder-Sache.

`pstg_tage_bis_frist` bleibt: das ist ein Datum aus dem Gesetz (31. Januar,
§ 13 PStTG), kein Betriebsgeheimnis. Es steht mit Begründung in der
Ausnahmeliste des Prüfers.

## Beleg

`scripts/health-keine-zahlen-check.py` (CI + run.sh). Geprüft wird das
**Symptom**, nicht eine Namensliste: ein Zähler wird mit `= 0` angelegt, ein
Kennzeichen mit `= false`. Jedes Feld der Antwort, das in der Datei als
`let <feld> = 0` steht, ist ein Zähler.

Zwei Mutationen rot (je ein Feld wieder als Zähler), zwei Gegenproben grün:
ein neues Boolean-Feld ist erlaubt, und ein Zähler, der **nicht** nach außen
geht, auch. Ohne die zweite Gegenprobe wäre „keine Nullen in der Datei" der
einfachste grüne Haken gewesen.
