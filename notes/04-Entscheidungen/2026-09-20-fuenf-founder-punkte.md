# Fünf Founder-Punkte vom 20.09.2026 — gemessen, entschieden, behoben

Der Founder schrieb, mit vier Bildschirmfotos:

> „Ich hatte dir desöfteren gesagt gehabt nutze Open Design und ui ux repo
> damit es übersichtlich angeordnet ist, auf der homepage als auch wenn man
> etwas anfragen möchte sind jetzt willkürliche Buttons für Handwerker
> gemischt mit der Nachbarschaftshilfe. Heißt wir entscheiden jede einzelne
> Angelegenheit und haben auch so viel Zeit? Kann man es nicht
> teilautomatisieren und zusätzlich was ist mit dem Datenschutz, wegen den
> chats etc. Zusätzlich auch wegen des Strikes, da gibt es dann keine
> rechtlichen Probleme oder? Wenn ich bei der Dringlichkeit was anwähle kommt
> auf der darauffolgenden Seite wieder so eine abfrage das ist doppelt
> gemoppelt…"

Fünf Punkte. Erst gemessen, dann geantwortet. Vier waren echt; einer war
bereits gebaut und nur nicht sichtbar.

---

## 1. Handwerk und Nachbarschaftshilfe gemischt — ECHT, und schlimmer

Die **Startseite** trennt seit dem 20.07. über Reiter (`activeSegment`,
`CATEGORIES_HANDWERK_GRID` / `CATEGORIES_NACHBARSCHAFT_GRID`). Sauber.

Der **Trichter**, in den ihre Kacheln führen, hat die Trennung nie übernommen.
`app/auftrag-aufgeben.tsx` setzte sein Raster von Hand zusammen:

```
{ id: 'handwerker', label: 'Handwerker', icon: 'construct-outline' }
...die 13 Gewerke...
{ id: 'garten',    label: 'Gartenarbeit' }
{ id: 'reinigung', label: 'Haushaltsreinigung' }
+ alle übrigen Nachbarschafts-Startkategorien
```

Zwanzig Kacheln in EINEM unbeschrifteten Raster, vierzehn Handwerk, sechs
Nachbarschaftshilfe. Drei Fehler darin:

1. **Der Track hing allein am URL-Parameter.** Wer „Wäsche & Bügeln" im
   Handwerks-Trichter wählte, legte einen Auftrag mit `track:'handwerker'` an.
   Ein Nachbarschaftsauftrag, ausgeschrieben an Betriebe, mit Betriebspreisen
   und Betriebsgebühr.
2. **Zwei Beschriftungen gab es nur hier.** Zentral heißen sie „Garten" und
   „Reinigung"; im Trichter „Gartenarbeit" und „Haushaltsreinigung". Dieselbe
   Kachel hieß auf der Startseite anders als eine Seite später.
3. **Die Sammelkachel „Handwerker" erreichte niemanden.** Sie erzeugte
   `category_id:'handwerker'`. Diese Kennung steht in keinem
   `provider_profiles.category_ids` — die kommen aus derselben zentralen
   Konfiguration. `notify-matching-providers` filtert mit
   `.contains("category_ids", [job.category_id])`, filterte also jeden Betrieb
   weg. Die erste, größte, einladendste Kachel führte zu einem Auftrag, den nie
   jemand zu sehen bekam.

**Entschieden und umgesetzt:**
- Schritt 1 zeigt zwei benannte Gruppen („Handwerk" / „Nachbarschaftshilfe"),
  je mit einem Satz, was der Unterschied ist. Dieselbe Trennung wie auf der
  Startseite, nur als Überschriften statt als Reiter — in einem Formular, durch
  das man scrollt, sind Reiter eine versteckte Hälfte.
- Alle Kacheln kommen aus `data/categories.ts`. Keine Liste von Hand mehr.
- Der Track wird aus der GEWÄHLTEN Kategorie abgeleitet (`nbAuftrag`), nicht
  mehr allein aus dem Einstiegs-Parameter.
- Die Sammelkachel „Handwerker" ist ersatzlos entfernt. Wer das Gewerk nicht
  kennt, nimmt „Renovierung": zulassungsfrei, mit eigenem Abgrenzungstext, und
  die Kennung gibt es wirklich.

Nachgehalten in `scripts/trichter-check.py` (CI + `scripts/reisen/run.sh`),
mutationsgeprüft 8/8 (6 Mutationen rot, 2 Gegenproben grün).

## 2. „Entscheiden wir jede einzelne Angelegenheit?" — halb gebaut, nie gesagt

Die Teilautomatisierung existiert seit dem 14.09.:
`lib/pruefung.ts` → `vorpruefen()` liefert Befunde in drei Stufen
(`sperrt` / `ansehen` / `hinweis`) und `freigabeGesperrt()` **sperrt** die
Freigabe hart, wenn der Gewerbeschein fehlt, das Gewerk ungültig ist oder ein
meisterpflichtiges Gewerk ohne Meisterbrief eingereicht wurde. Das Pruef-
Postfach (`app/pruefung.tsx`) zeigt das je Einreichung an.

**Keine KI, und das bleibt so.** Ein Modell, das einen Meisterbrief beurteilt,
holt die Hochrisiko-Pflichten aus Anhang III der KI-VO ins Haus (seit
02.08.2026 geltend): Konformitätsbewertung, Registrierung, Protokollierung,
menschliche Aufsicht, technische Dokumentation. Was dort steht, sind
`if`-Abfragen über Felder, die ohnehin vorliegen — kein KI-System nach Art. 3
Nr. 1. `scripts/ki-einsatz-check.py` wacht darüber.

**Die echte Lücke war eine andere:** niemand sagte dem Betreiber, dass etwas
wartet. `/health` zählt `pruef_offen`, und in der Produktion steht diese Zahl
auf 1 — ein Betrieb wartet, der Mailversand ist aus, er hätte es nie erfahren.
Der Zähler war sichtbar für den, der hinsieht. Das ist keine Benachrichtigung.

**Neu:** `.github/workflows/wartet-jemand.yml`, zweimal täglich. Liest
`/health`, und wenn `pruef_offen > 0`, schlägt der Job fehl — GitHub mailt dem
Repo-Inhaber. Still, solange niemand wartet.

Bewusst ein eigener Workflow und nicht `health.yml`: dessen Zeitplan ist seit
dem 06.08. ausgesetzt, weil er täglich einen ABSICHTSZUSTAND meldete (fehlende
Secrets, die so gewollt sind). Eine Mail über etwas, das man selbst so
entschieden hat, trainiert an, Alarme wegzuklicken. Dieser Lauf meldet einen
Zustand, den zwei Minuten Arbeit beenden.

**Was NICHT automatisiert wird: die Entscheidung.** Wer Gewerbescheine,
Steuer-IDs und Ausweise sieht, wird nicht aus Bequemlichkeit erweitert.
`WERKANT_ADMIN_EMAILS` bleibt das Tor; leere Liste heißt weiterhin „niemand".

## 3. Datenschutz beim Chat — gebaut, und offengelegt

Gemessen gegen `lib/chatGuard.ts`, Migration 0340, 0700 und
`app/datenschutz.tsx`:

- Die Erkennung läuft **auf dem Gerät** (reine Textregeln, keine Datenbank —
  `detectLeak` zieht bewusst nichts nach).
- Gespeichert wird **die Art des Treffers** (`leak_types: text[]`, also
  `phone`/`iban`/`email`), **nicht der Nachrichtentext**.
- `chat_leak_flags` hat **keine** Select-Policy für Angemeldete: weder der
  Absender noch die Gegenseite kann die Vermerke zurücklesen.
- Rechtsgrundlage Art. 6 Abs. 1 lit. f, offengelegt in der
  Datenschutzerklärung unter „Rechtsgrundlagen", zusammen mit dem Zweck.
- Chat-Nachrichten selbst: Löschfrist 6 Monate nach Auftragsabschluss,
  genannt unter „Speicherdauer".

Hier war nichts zu beheben. Der Punkt, der daran hing, ist Nummer 4.

## 4. Strikes — ECHT, und zwar als Widerspruch zwischen zwei eigenen Rechtstexten

Der Strike-Mechanismus selbst ist in Ordnung und seit dem 16.08. an den AGB
ausgerichtet: 12-Monats-Fenster (`verfaellt_am`), Pflicht-Begründung
(20–2000 Zeichen, Art. 4 P2B-VO), Aufhebung nach Beschwerde, drei Funde je
Strike, Einzeltreffer folgenlos, keine Strikes aus Bewertungen.

Der Befund lag im **Text**:

| Stelle | Aussage |
|---|---|
| `app/agb.tsx` §8(4) | „Eine automatisierte Entscheidung über Maßnahmen findet nicht statt." |
| 0500/0720 | Trigger `trg_apply_leak_strikes` vergibt den Strike ohne Zutun eines Menschen |
| `app/datenschutz.tsx` | legt genau diese Automatik als Art.-22-Entscheidung offen |

Die beiden eigenen Rechtstexte sagten das Gegenteil voneinander, und der
AGB-Satz war schlicht unwahr. Art. 17 Abs. 3 DSA verlangt die Angabe, ob
automatisierte Mittel eingesetzt wurden — §8(4) ist die Stelle dafür und
bestritt es.

Dieselbe Klasse wie „der Code widerspricht den eigenen AGB" (16.08.), nur
andersherum: hier war der Code richtig und der Text falsch.

**Behoben:** §8(4) benennt die eine automatische Entscheidung, nennt Schwelle,
Folge, Verfall, Begründungspflicht und das Recht auf Überprüfung durch einen
Menschen, und verweist auf die Datenschutzerklärung. Nachgehalten in
`scripts/agb-automatik-check.py` (CI + `run.sh`), mutationsgeprüft 6/6.

**Offen, founder-seitig:** AGB §7(4) sagt Begründung „per E-Mail (dauerhafter
Datenträger)" zu. Die Mitteilung wird geschrieben (0860), der Mailversand ist
mangels `RESEND_API_KEY` aus. Solange das so ist, wird die Zusage nicht
eingehalten. Kein Code-Fix — ein Secret.

## 5. Dringlichkeit doppelt — ECHT, und der erste Durchgang war wirkungslos

Schritt 2 hatte „Dringlichkeit" mit drei Chips. Schritt 3 fragt dasselbe
(„Wann soll der Auftrag stattfinden?") mit drei Karten.

Schlimmer als doppelt: `urgency` stand in `useState`, wurde in den Entwurf
gesichert — und **nirgends sonst**. Nicht in `createJob`, nicht in der
Zusammenfassung (die liest `selectedTime`), nicht in der Prüfung
(`step3Valid = selectedTime !== ''`). Der Kunde beantwortete die Frage zweimal,
und die erste Antwort wurde weggeworfen.

Ein Eingang ohne Wirkung, dieselbe Klasse wie ein Knopf ohne `onPress`.

**Behoben:** Schritt 2 fragt nicht mehr. Schritt 3 bleibt — das ist die Frage,
die gespeichert wird und die Pflicht ist. `urgency` ist vollständig entfernt
(State, Entwurf, Props, Optionsliste). Nachgehalten in
`scripts/trichter-check.py`.

---

## Was offen bleibt

- **Gerätetest steht aus.** Der Prüfstand ist `expo export --platform web` +
  Playwright gegen `dist/`. Er prüft Logik und Navigation zuverlässig, kein
  natives Layout. Kein Simulator, kein Gerät in dieser Umgebung.
- **`wartet-jemand.yml` feuert erst nach dem Merge.** GitHub führt
  `schedule`-Trigger nur aus der Datei auf dem Standard-Branch aus. Auf einem
  Arbeits-Branch läuft er nur von Hand über „Run workflow".
- **Der Mailversand** (Punkt 4, letzter Absatz) bleibt beim Founder.
