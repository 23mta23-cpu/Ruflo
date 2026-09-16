# Kern-Reisen

Die drei Wege, die ein Mensch durch Werkant tatsächlich geht. Sie standen seit
Wochen in der Agentendefinition (`.claude/agents/werkant--senior-test-expert.md`)
und waren **nie gelaufen** — deshalb liegen sie jetzt hier als Skript und nicht
als Vorsatz.

## Ausführen

```bash
bash scripts/reisen/run.sh          # Export + Server + alle Prüfungen
SKIP_EXPORT=1 bash scripts/reisen/run.sh   # wenn dist/ aktuell ist
```

Der Läufer startet den Server nach dem Export selbst neu. Das ist nicht
Bequemlichkeit: der Export legt `dist/` neu an, ein laufender Server verliert
sein Arbeitsverzeichnis und stirbt mit `FileNotFoundError: os.getcwd()`.

## Stand der Abdeckung

| Reise | Abgedeckt | Grenze |
|---|---|---|
| **1 — Kunde** | vollständig bis zum wiederhergestellten Entwurf | — |
| **2 — Anbieter** | bis Verifizierung Schritt 2 | Gewerbeschein-Upload braucht Supabase Storage |
| **3 — Rollenwechsel** | nur Routen-Ebene (`rollen-routen-check.cjs`) | echter Wechsel braucht ein Konto mit `role='provider'` |
| **4 — Geldweg** | offenen Auftrag sehen, Angebot abgeben, Angebot sehen, Annahme | nur die **Verdrahtung**, siehe unten |

**Seit 16.09.2026 geprüft** (Reise 4): Der Betrieb sieht den offenen Auftrag,
das Angebotsformular setzt beim Klick wirklich ein `INSERT` auf `offers` ab
(mit `job_id`, Preis, getrenntem Material und Status `pending`), der Kunde
sieht das Angebot mit seinem Preis, und die Annahme ruft `accept_offer` mit
beiden Kennungen auf.

**Was Reise 4 NICHT prüft, und das gehört danebengeschrieben:**

| Frage | Wo sie beantwortet wird |
|---|---|
| Legt `accept_offer` wirklich einen Vertrag an? | `scripts/db-test/offer-lifecycle.sql` |
| Greifen die RLS-Policies? | `scripts/db-test/rls-isolation.sql` |
| Hält Stripe das Geld und gibt es wieder her? | gar nicht, lokal nicht möglich |
| Stimmt das Layout auf einem echten Gerät? | gar nicht, siehe unten |

Die Daten kommen aus `scripts/lib/anbieter-sitzung.cjs` (`opts.daten`), die
abgesetzten Schreibaufrufe stehen danach in `ctx.__aufrufe`. Geprüft wird also
die Klasse „Knopf ohne `onPress`" und „Feld, das nirgends ankommt" — beides
gab es in diesem Projekt schon.

**Ungeprüft und ausdrücklich nicht behauptet:** „Vertrag aktiv", Zahlung,
Escrow, Abnahme, Auszahlung. Das hängt an Stripe, nicht an diesen Skripten.

**Kein Gerätetest.** Alles läuft auf react-native-web gegen den lokalen Export.
Ein Fehler wie `flex: 1` in einer ScrollView (auf dem Gerät unsichtbar, auf Web
nicht) ist von hier aus grundsätzlich nicht zu sehen — siehe `CLAUDE.md`.

## Warum die Reisen so aussehen

Jede Zusicherung steht für einen Fehler, der schon einmal da war oder teuer
wäre:

- **Entwurf überlebt die Anmeldung** — der Hinweis „ohne dass Eingaben verloren
  gehen" tat bis zum 15.08. das Gegenteil. Wer eine lange Beschreibung tippt und
  sie verliert, kommt nicht wieder.
- **Einwilligung landet nicht im Entwurf** — sie muss aktiv erteilt werden, nicht
  aus einem Zwischenspeicher wiederauferstehen.
- **Kein Geisterentwurf** — nach dem Wiederherstellen ist der Zwischenspeicher
  leer, sonst taucht der alte Auftrag beim nächsten Mal wieder auf.
- **Leere Verifizierungs-Schritte kommen nicht durch** — vor dem 20.07. landeten
  dadurch leere Bewerbungen in der Prüf-Queue.
- **18+ greift beim Tippen, nicht erst beim Absenden** — vorher zeigte das Feld
  auch Minderjährigen „bestätigt". Rechtlich verbindlich (JArbSchG).
- **Gegenprobe volljährig** — ein Riegel, der alle aussperrt, wäre kein Schutz,
  sondern ein Ausfall.
- **Jeder Aufruf Richtung Produktion wird abgefangen und gezählt** — der
  Web-Build zielt ohne gesetzte `EXPO_PUBLIC_SUPABASE_URL` auf die
  Produktions-Instanz.

## Fallen beim Schreiben solcher Skripte

Drei Fehler, die hier schon gemacht wurden — jeder hätte den Test wertlos
gemacht:

1. **Immer `:visible`.** expo-router lässt inaktive Screens im DOM stehen. Ein
   blankes `input` greift sonst das E-Mail-Feld des Anmelde-Screens ab.
2. **`isDisabled()` trifft bei react-native-web den Text *im* Knopf**, nicht den
   Knopf. Die Wirkung prüfen (ein Klick, der nichts auslöst), nicht die
   Auszeichnung.
3. **Sofort ausgeben, nicht sammeln.** Bricht das Skript ab, ist ein am Ende
   gedruckter Bericht verloren, und aus einem klaren Befund wird ein Stacktrace.

Und: **`pkill` nie mit weiteren Befehlen in einem Aufruf verketten.** Das SIGTERM
bricht die Kette ab — ein `cp`-Wiederherstellen danach läuft nicht mehr, und
eine Mutation bleibt unbemerkt im Arbeitsbaum stehen.

## Was die Geometrie-Prüfer sehen — und was nicht

`rand-ueberstand-check.cjs` misst, ob etwas über den **Bildschirmrand** läuft,
bei 390, 375 und 360 px. Er sieht **nicht**, ob eine Beschriftung *innerhalb*
ihrer Kachel abgeschnitten wird: `numberOfLines={1}` kürzt im Kasten, und über
den Rand läuft dabei nichts.

Am 14.09.2026 hat er deshalb „54 Messungen, nichts läuft über den Rand"
gemeldet, während „Bewertungen" im Anbieter-Profil bei 375 px und 360 px
abgeschnitten war: 73 px Text in einer 69- beziehungsweise 66-px-Kachel.
Dieselbe Blindheit wie am 07.09. bei der Reiter-Leiste, eine Ebene tiefer.

`kachel-text-check.cjs` misst genau das (`scrollWidth > clientWidth`) und
läuft seitdem im selben Durchgang. Seine eigene Grenze steht in seinem Kopf:
er prüft die **namentlich eingetragenen** Beschriftungen. Eine neue Kachel
fällt nicht auf, solange sie niemand einträgt — deshalb prüft er die erwartete
**Anzahl** mit und wird rot, wenn sie nicht stimmt.
