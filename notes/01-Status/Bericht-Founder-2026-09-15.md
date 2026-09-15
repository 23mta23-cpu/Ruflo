# Bericht an den Founder, 15.09.2026

Stand: 09:30 Uhr. Gearbeitet seit dem Abend des 13.09. Alles liegt auf
`claude/session-handoff-docs-1qxv3d`, PR #202, zwoelf Commits.

## 1. Deine Frage: Wie prueft Werkant die Dokumente, und musst du das machen?

**Ja, entscheiden musst du.** Aber du sitzt nicht mehr vor einem leeren
Postfach. Es gibt jetzt einen Arbeitsplatz dafuer: `/pruefung` in der App.

So laeuft es:

1. Ein Betrieb laedt Gewerbeschein hoch, bei meisterpflichtigen Gewerken den
   Meisterbrief, dazu Steuernummer und Betriebsdaten.
2. Der Bildschirm `/pruefung` zeigt dir die offenen Faelle, sortiert nach
   Wartezeit, mit Links auf die Dokumente. Die Links gelten fuenf Minuten,
   damit sie nicht in einer Chat-Historie weiterleben.
3. **Vor** deiner Entscheidung laufen feste Vorpruefungen (`lib/pruefung.ts`).
   Drei davon **sperren** die Freigabe, du kannst sie also gar nicht
   uebersehen:
   - kein Gewerbeschein hochgeladen
   - Gewerk existiert nicht in unserer Liste
   - meisterpflichtiges Gewerk ohne Meisterbrief (§ 1 HwO Anlage A)
   Dazu Hinweise ohne Sperre, etwa wenn Betriebsname und Kontoname nicht
   zusammenpassen.
4. Du klickst Freigeben oder Ablehnen. Bei Ablehnung ist eine Begruendung von
   mindestens 20 Zeichen Pflicht, und sie geht als Benachrichtigung an den
   Betrieb. Das ist keine Hoeflichkeit, sondern Art. 4 P2B-VO: gegenueber
   gewerblichen Anbietern bist du begruendungspflichtig.

**Was du noch tun musst, damit es ueberhaupt aufgeht:** in den Supabase
Edge Function Secrets `WERKANT_ADMIN_EMAILS` auf deine Adresse setzen. Ohne
diesen Eintrag sieht **jeder** unter `/pruefung` "Seite nicht gefunden",
auch du. Das ist Absicht: keine Liste, kein Betreiber.

Details: `docs/betrieb/pruef-postfach.md`.

## 2. Deine Frage: Muss das nach dem EU AI Act ausgewiesen werden?

**Nein, und zwar aus einem einfachen Grund: es ist keine KI.**

Die Vorpruefungen sind feste Wenn-Dann-Regeln, die ich hingeschrieben habe
("Gewerk steht auf der Meisterliste und es liegt kein Meisterbrief vor, also
sperren"). Ein KI-System nach Art. 3 Abs. 1 KI-VO setzt voraus, dass ein
System aus Eingaben ableitet, wie es zu seinen Ergebnissen kommt. Das tut hier
nichts. Ein Taschenrechner faellt auch nicht unter die KI-VO.

Zwei Dinge sind trotzdem wichtig:

- **Die Entscheidung trifft ein Mensch.** Das steht so in den AGB (§ 11 Abs. 4)
  und ist eine Zusage, die wir halten. Wuerden wir spaeter automatisch
  entscheiden, waere es Anhang III Nr. 4 KI-VO (Zugang zu Diensten) und damit
  Hochrisiko. Dann gaebe es echte Pflichten: Risikomanagement, Dokumentation,
  menschliche Aufsicht, Registrierung.
- **Was wir heute schon ausweisen muessen, weisen wir aus**: Art. 17 DSA
  verlangt in jeder Begruendung die Angabe, ob automatisierte Mittel im Spiel
  waren. AGB § 11 Abs. 6 sagt das zu.

Damit das nicht still kippt, laeuft `scripts/ki-einsatz-check.py` in der CI.
Es schlaegt an, sobald im Code etwas nach Modell, Einstufung oder
Wahrscheinlichkeit aussieht. Rechtsstand steht ausgeschrieben in
`docs/recht/ki-vo-und-bfsg.md`.

## 3. Deine Frage: Schaue ich mir Airbnb und aehnliche an?

Ja. `docs/markt/wettbewerbsabgleich-2026-09.md`. Das Ergebnis in drei Saetzen:

- **MyHammer** lebt von Lead-Gebuehren. Der Handwerker zahlt fuer einen
  Kontakt, den er vielleicht nie bekommt. Das ist der meistgehasste Punkt der
  Branche und unser staerkstes Argument. Deshalb steht auf der Startseite jetzt
  "0 EUR Lead-Gebuehr" statt einer erfundenen Bearbeitungszeit.
- **Airbnb** macht zwei Dinge, die wir noch nicht haben: den Kalender als
  Arbeitsflaeche statt als Anzeige (Mehrfachauswahl, Vorlagen), und einen
  Ortsanker von der ersten Sekunde an.
- **Der Ortsanker fehlt uns wirklich.** Mehr dazu unter Punkt 5.

## 4. Was in diesen zwei Naechten gefunden und behoben wurde

Ein Muster zieht sich durch alles: **etwas behauptet einen Zustand, den es nie
geprueft hat.** In Werbetexten, in den AGB, in Tests, sogar in meinen eigenen
Pruefskripten.

**Geld**
- Ein Angebot ueber 1,00 EUR ergab eine negative Auszahlung (8 % Provision,
  mindestens 3,00 EUR). Untergrenze jetzt in der Datenbank (Migration 0910).
- Elf Geldbetraege standen mit Dezimalpunkt statt Komma, darunter der Beleg.
  Jetzt eine Stelle fuer alle: `lib/geld.ts`.

**Aussagen, die der eigene Code widerlegt**
- "Haftpflicht verifiziert": es gibt kein Haftpflicht-Feld. Entfernt.
- "Ihr Geld verlaesst Werkant erst, wenn Sie bestaetigen": das Geld liegt nie
  bei Werkant, und nach Ablauf der Abnahmefrist wird ohne Bestaetigung
  ausgezahlt. Ausgerechnet dieser Satz waere in der offenen ZAG-Frage der, den
  eine Aufsicht zitiert. Entfernt.
- "Eskalationsteam prueft innerhalb von 24h": es gibt kein Team, und drei
  verschiedene Fristen standen im Produkt, zwei davon auf demselben
  Bildschirm. Eine Fassung fuer alle.
- Heute frueh die letzten zwei: "24h Verifizierung" auf der Startseite und
  "innerhalb von 48 Stunden" auf der Warteliste.

**Recht**
- Die AGB nannten "raeumliche Naehe" als Ranking-Parameter. Es gibt im ganzen
  Code keine Entfernungsberechnung. Nach Art. 5 P2B-VO ist ein genannter
  Parameter ohne Code eine Falschangabe. Korrigiert, und dabei eine Luecke
  gefunden, die fuer einen Handwerker wichtiger ist als die Reihenfolge:
  benachrichtigt wird nur, wessen PLZ dieselben zwei ersten Ziffern hat.
  Stand nirgends. Jetzt AGB § 2 Abs. 5.
- Art. 4 Abs. 2 P2B-VO (30 Tage vor einer Beendigung), Art. 8 und Art. 9
  (Beendigung durch den Nutzer, Datenzugang auch nach der Loeschung) waren
  nicht abgebildet. Jetzt §§ 7, 10 und 12.
- Die Zustimmungsfiktion in § 10 ("wer nicht widerspricht, stimmt zu") ist
  gegenueber Verbrauchern nach BGH XI ZR 26/20 unwirksam. Ersetzt.

**Eine Sache, die fast durchgerutscht waere**
Die Edge Function `pruefung` war fertig, getestet, typgeprueft und haette
**nie funktioniert**: sie war nicht in `supabase/config.toml` eingetragen und
waere deshalb nie ausgerollt worden. Gefunden hat es die CI, nicht ich.

## 5. Was ich empfehle, und was du entscheiden musst

**Meine Empfehlung fuer den naechsten Block: der Ortsanker (PLZ).**
Heute fragt die App nach der PLZ erst spaet. Der Kunde sieht Betriebe, die
vielleicht 200 km weg sind, und der Betrieb bekommt nur Anfragen aus seinem
zweistelligen PLZ-Bereich, ohne das zu wissen. Beides ist loesbar, und es ist
die Stelle, an der wir gegen MyHammer am meisten gewinnen.

**Blockierend fuer den Live-Gang, und nur von dir loesbar:**

| Was | Warum es blockiert |
|---|---|
| `WERKANT_ADMIN_EMAILS` setzen | ohne das kann niemand Betriebe freigeben |
| Stripe-Schluessel setzen | `/health` meldet `stripe: false`, es gibt keinen Geldweg |
| `RESEND_API_KEY` + `WAITLIST_FROM_EMAIL` | ohne die kommt keine E-Mail an |
| Impressum mit echten Daten | steht noch `Musterstrasse 1`, `LEGAL_PLACEHOLDER = true` |
| ZAG: Anwalt fragen | strafbewehrt (§ 63 ZAG), drei fertige Fragen in `docs/recht/ki-vo-und-bfsg.md` § 4 |
| Reverse Charge: Steuerberater fragen | betrifft jede Rechnung an einen deutschen Betrieb |
| Zwei Vertraege unter einem Widerrufs-Haken | Anwaltsfrage, steht im Rechts-Audit |
| BZSt-Registrierung, PStTG | Meldepflicht ab dem ersten Umsatz |

**Ein Vermerk in eigener Sache:** die AGB sind von mir geschrieben und nach
bestem Wissen an Gesetz und Code geprueft. Sie ersetzen keine anwaltliche
Pruefung, und der Vermerk dazu steht im Kopf von `app/agb.tsx`.

## 6. Pruefstand

571 Jest-Tests in 28 Suiten, 250 Deno-Tests, 266 Datenbank-Zusicherungen,
`tsc` sauber, acht statische Pruefer gruen. Neu dazugekommen:
`scripts/ranking-check.py` (AGB gegen Code, beide Richtungen) und eine
Zeitzusagen-Regel in `scripts/versprechen-check.py`.

Jeder neue Pruefer wurde mutationsgeprueft: erst wenn eine absichtlich
eingebaute Fehlerstelle ihn rot macht, zaehlt sein gruener Haken. Zwei der
drei neuen Pruefer waren im ersten Anlauf blind fuer genau den Fall, fuer den
ich sie gebaut hatte. Das ist der Grund, warum diese Probe Pflicht ist.
