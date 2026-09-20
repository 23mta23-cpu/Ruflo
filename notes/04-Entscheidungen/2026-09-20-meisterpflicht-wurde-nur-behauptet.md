# Die Meisterpflicht wurde behauptet, nicht durchgesetzt

Stand 20.09.2026. Gefunden beim Nachgehen der Frage, was passiert, wenn der
Founder den EINEN wartenden Betrieb freigibt. Gesucht war der Weg bis zum
ersten Angebot. Gefunden wurde, dass auf dem Weg eine Zusage steht, hinter der
nichts war.

## Was der Kunde liest

`app/auftrag-aufgeben.tsx`, Schritt 1, sobald er ein meisterpflichtiges Gewerk
wählt, wörtlich:

> „Ihr Auftrag wird **ausschließlich** an Betriebe mit gültigem Meisterbrief
> weitergeleitet."

Dasselbe steht in `app/landing.tsx`, in `docs/marketing/store-texte.md`
(„Ohne Upload dieser Nachweise lässt sich die Anbieter-Anmeldung nicht
abschliessen"), im Akquise-Leitfaden („kommen nicht durchs Onboarding-Gate")
und im Wettbewerbsabgleich („Werkant prüft am tiefsten").

## Was gemessen dastand

| Stelle | Befund |
|---|---|
| Policies, Checks, Trigger | `meister_verified` kommt als **Bedingung** nirgends vor. Jedes Vorkommen ist ein Schreibschutz oder ein Abzeichen in der Oberfläche. |
| Code-Pfade | **Keiner** setzt `meister_verified` je auf `true`. `pruefung` schreibt bei der Freigabe `kyc_status` und `kyc_verified`, das Meisterfeld nicht. |
| Angebots-Policy (0820) | prüft E-Mail, Strikes, Auftragslage, Eigen-Angebot, Track-Trennung. Meisterpflicht nicht. |
| `notify-matching-providers` | filtert `available` und `category_ids`. Meisterpflicht nicht. |

Die Prüfung gab es also **genau einmal**, beim Onboarding, und sie hängt an
`provider_profiles.trade_id` (`lib/pruefung.ts`, `vorpruefen`). Maßgeblich
fürs Zuleiten und fürs Bieten ist aber `category_ids`. Und die ließ sich
danach in „Mein Profil" frei ändern, ohne dass `trade_id` mitwandert
(`app/betrieb/profil-bearbeiten.tsx` hält beide synchron und sagt im Kommentar
auch warum; `app/betrieb/profil.tsx` schreibt nur `category_ids`).

**Der Weg vorbei, in drei Schritten:** als Bodenleger freigeben lassen
(zulassungsfrei, kein Meisterbrief nötig), danach in „Mein Profil" Elektro
eintragen, Elektro-Aufträge zugeleitet bekommen und darauf bieten.
§ 1 HwO Anlage A.

Dieselbe Fehlerklasse wie der Rest dieser Woche, in ihrer schärfsten Form:
gebaut, geprüft, rechtlich sauber formuliert, und nirgends durchgesetzt. Neu
ist nur, dass hier eine **Zusage an den Kunden** daran hing.

## Was jetzt dasteht (Migration 0980)

1. **Die Liste in der Datenbank.** `meisterpflicht_gewerke`, zehn Gewerke,
   gespiegelt aus `data/categories.ts`. Für Clients vollständig gesperrt, ohne
   jede Policy. Die drei Stellen, die sie brauchen, sind SECURITY DEFINER und
   antworten nur mit ja/nein.
2. **Die Freigabe hält den Meisterbrief fest.** Trigger
   `a_meisterbrief_festhalten`: wer aus `in_review` auf `approved` wechselt,
   ein Anlage-A-Gewerk führt und ein Dokument hinterlegt hat, bekommt
   `meister_verified = true`. Kein Zusatzklick, weil eine Freigabe ohne
   Dokument gar nicht möglich ist (`vorpruefen` sperrt den Knopf). Der Blick
   des Prüfers wird damit festgehalten statt nur getan.
3. **Das Gewerk lässt sich nicht nachtragen.** Trigger
   `trg_gewerk_wechsel_pruefen` weist ein **neu** hinzukommendes Anlage-A-Gewerk
   ohne geprüften Meisterbrief ab. Bewusst ein Trigger und keine zweite Policy:
   Policies werden ODER-verknüpft und hätten nichts gesperrt.
4. **Und das Angebot selbst.** Die Angebots-Policy prüft zusätzlich
   `auftrag_braucht_meister(j.category_id, j.category)`. Der Rückfall auf den
   Anzeigenamen ist kein Luxus: `jobs.category_id` darf seit 0410 NULL sein,
   und genau so eine Zeile wäre sonst der Weg vorbei (Test MP3).
5. **Bestandsübernahme.** Wer bereits freigegeben ist und ein Dokument
   hinterlegt hat, wird nicht ausgesperrt. Wer freigegeben ist, ein
   Anlage-A-Gewerk führt und **kein** Dokument hat, bekommt nichts geschenkt.
   Die Zahl steht als Notice im Migrationsprotokoll, damit sie jemand sieht,
   statt sie zu entdecken.

Dazu, außerhalb der Datenbank:
- `notify-matching-providers` meldet einen Anlage-A-Auftrag nicht mehr an
  Betriebe, die darauf gar nicht bieten dürfen. Eine Benachrichtigung, die in
  eine Sperre führt, ist schlechter als keine.
- „Mein Profil" sperrt die betroffenen Kacheln sichtbar, mit Schloss-Symbol und
  einem Satz, der sagt, was fehlt. Ohne das hätte der Betrieb ausgewählt,
  gespeichert und eine rohe Datenbankmeldung bekommen.

## Was der Prüfstand dabei über sich selbst gelernt hat

- **`rechte.sql` (RG) hat meine erste Fassung sofort rot gemacht**: ich hatte
  der Liste `for select using (true)` gegeben, weil ihr Inhalt öffentliches
  Recht ist. Die Prüfung hatte recht, und die Antwort war nicht eine Ausnahme,
  sondern eine engere Lösung: niemand muss die Tabelle lesen.
- **`rechte.sql` (RA) hat die zweite Fassung rot gemacht**: eine
  SECURITY-DEFINER-Funktion ohne `auth.uid()`, für Angemeldete ausführbar.
  Hier ist es eine begründete Ausnahme mit Präzedenzfall (`ist_anbieter_frei`):
  die Funktion nimmt keine Nutzerkennung entgegen, lässt sich also gar nicht
  auf einen Fremden richten, und ihre Ausgabe steht im Gesetz.
- **Der Zahlenabgleich hat fünf verschwundene Zusicherungen gemeldet.**
  `strike-verfall.sql` ließ seine Anbieter auf einen **Elektro**-Auftrag
  bieten, ohne Meisterbrief. Seit 0980 verboten, die Datei brach ab, fünf
  Zusicherungen dahinter liefen nicht mehr, und der Test war aus dem falschen
  Grund rot: er hätte die Meisterpflicht gemessen und den Strike-Verfall
  genannt. Der Aufbau bildet jetzt ab, was gilt.
- **Und beim Reparieren genau in die nächste Falle**: `meister_verified` im
  `insert` mitzugeben wirkt nicht, weil 0450 es bei jedem Einfügen auf `false`
  setzt. Der Wert verschwand still. Jetzt als `service_role` nachgezogen.

## Mutationsproben

`0980`: dreizehn Proben, zehn rot, drei Gegenproben grün.

Vier blieben im ersten Durchgang grün, und die Unterscheidung war der
eigentliche Ertrag:
- **Zwei waren schwache Mutationen von mir.** Ich hatte die Trigger nur
  UMBENANNT; `drop trigger if exists <alt>` plus `create trigger <neu>` lässt
  den Trigger weiter existieren. Derselbe Fehler wie am selben Tag bei
  `trg_apply_leak_strikes`. Eine Mutation, die nur umbenennt, prüft den Regex
  und nicht die Sache.
- **Zwei waren echte Lücken.** Kein Testfall konnte einen Vermerk ohne
  hinterlegtes Dokument treffen (MP15), und keiner einen entzogenen Vermerk,
  der durch gewöhnliches Speichern zurückkäme (MP16). Dazu kam MP17, weil auch
  die `service_role`-Ausnahme ungeprüft war.

`scripts/meisterpflicht-beleg-check.py`: 6/6.
`__tests__/anbieterAuswahl.test.ts`: 6/6.

## Ein Filter, der zwei Rechtsräume trägt, hatte keinen Test

`auswahl.ts` wurde am 20.07. aus `index.ts` herausgelöst, ausdrücklich mit der
Begründung „ein Filter, der die Trennung zweier Rechtsräume trägt, gehört
ausgeführt". Danach wurde kein Test geschrieben. Zwei Monate lang war er wieder
nur typgeprüft, also genau in dem Zustand, den das Herauslösen beenden sollte.
`npx tsc --noEmit` liest `supabase/functions/` ohnehin nicht.

Jetzt neun Tests, darunter drei Gegenproben.

## Offen

- **Gerätetest steht aus**, wie immer in dieser Umgebung.
- **Die Sperre greift erst nach dem Einspielen.** Migrationen rollen über die
  Supabase-GitHub-Integration mit dem Push auf `main` aus, nicht vom
  Arbeits-Branch.
- **Der Werbetext bleibt trotzdem zu prüfen.** „Werkant prüft am tiefsten"
  (Wettbewerbsabgleich) und „persönlich verifiziert" (Landing) sind eigene
  Fragen; der Stil-Audit vom 14.09. führt sie bereits.
