---
typ: entscheidung
datum: 2026-07-08
status: verbindlich (Entscheidung im Arbeitsmodus; Founder kann überstimmen)
entscheider: Claude, Rolle: Solution-Architekt + Rechtsberater-Hinweis
  (per Founder-Anweisung "wähl selbst eine sinnvolle Option und notier sie")
---

# Nachbarschaftshilfe: Stufe-2-Ausbau der Startkategorien

## Auftrag

Founder-Feedback 08.07.: "Ich finde es sind zu wenige Nachbarschaftsthemen,
wir hatten mehr." Anweisung: Rolle klären, selbst entscheiden, dokumentieren.

## Rolle, aus der entschieden wird

**Solution-Architekt:** Single Source of Truth ist `data/categories.ts`
— alle 11 C2C-Kategorien existieren dort bereits vollständig konfiguriert
(Preismodell, Mindestlohn, Pflichtdokumente). Nur `NACHBARSCHAFT_STARTKATEGORIEN`
entscheidet, welche davon im Produkt sichtbar sind. Ausbau heißt: Liste
erweitern, nicht neue Kategorien bauen.

**Rechtsberater-Hinweis (keine Rechtsberatung):** `docs/produkt/
Nachbarschaftsunterstuetzung-Modell-D.md` hat 3 Kategorien ausdrücklich aus
Sicherheitsgründen zurückgestellt: *"Kinderbetreuung, Seniorenbegleitung,
Babysitting — höhere Sicherheits-/Background-Check-Anforderungen; erst
nach etablierten Trust-Mechanismen erneut bewerten."* Diese Einschränkung
gilt unverändert fort — kein neuer Trust-Mechanismus wurde seither gebaut.

## Befund

Von 11 zentral konfigurierten C2C-Kategorien waren nur 3 live:
`garten`, `umzugshilfe`, `einkaufshilfe`. Acht weitere lagen fertig
konfiguriert, aber unsichtbar in `data/categories.ts`:
`reinigung`, `nachhilfe`, `it-support`, `moebelaufbau`, `tierbetreuung`,
`seniorenhilfe`, `babysitting`, `waesche`.

## Entscheidung: 5 weitere freigeben, 3 bleiben zurückgestellt

**Neu freigegeben** (gleiche Kriterien wie die ursprünglichen 3: physisch/
technisch, niedrige Haftungsschwelle, keine Berufszulassung, kein Kontakt
zu strukturell vulnerablen Gruppen):
- `reinigung` (Haushaltsreinigung)
- `it-support` (IT-Support)
- `moebelaufbau` (Möbelaufbau)
- `tierbetreuung` (Tierbetreuung)
- `waesche` (Wäsche & Bügeln)

**Weiterhin zurückgestellt** (unverändert, keine neue Prüfung ohne
Trust-Mechanismus):
- `seniorenhilfe`, `babysitting` — Modell-D-Text trifft wörtlich zu.
- `nachhilfe` — **zusätzlich vom Solution-Architekten aus demselben Grund
  zurückgestellt**, obwohl im Modell-D-Text nicht explizit genannt:
  Nachhilfe bedeutet typischerweise Einzelbetreuung eines minderjährigen
  Kindes — dieselbe Risikokategorie (Kontakt zu vulnerablen Gruppen) wie
  Babysitting, nur mit anderem Etikett. Aufnahme ohne Background-Check-
  Mechanismus wäre inkonsistent mit der eigenen Modell-D-Begründung.

## Was NICHT geändert wird

- `constants/features.ts` (`FEATURES.NACHBARSCHAFT`) — unverändert an.
- Die Modell-D-Mechanik (Fallback im Trichter, kein zweiter Marktplatz,
  getrennte Ratings) — unverändert, gilt für alle 8 Startkategorien gleich.
- DRV-/Steuer-Prüfpflicht vor echtem Geldfluss — unverändert, betrifft
  jetzt 8 statt 3 Kategorien in gleicher Weise.

## Technische Umsetzung

`NACHBARSCHAFT_STARTKATEGORIEN` in `data/categories.ts` um die 5 IDs
erweitert. Da Home-Raster, Suche-Filter und Wizard-Kategorien bereits
zentral aus dieser Liste + `kundenKategorien()` ableiten (Konsolidierung
vom 07.07.), zieht die Erweiterung automatisch durch — keine Änderung an
drei Stellen einzeln nötig.

## Eskalation

Falls der Founder Seniorenbegleitung/Babysitting/Nachhilfe trotzdem will:
das ist eine Entscheidung, die einen echten Trust-Mechanismus voraussetzt
(z. B. Führungszeugnis-Upload, verstärkte KYC-Stufe) — kein reines
Flag-Update. Bitte explizit beauftragen, nicht stillschweigend erwarten.

---

## Nachtrag 08.07. (Founder): Tierbetreuung zurückgestellt

Founder-Anweisung: "Tierbetreuung bitte raus." Umgesetzt — aus
`NACHBARSCHAFT_STARTKATEGORIEN` entfernt (jetzt 7 statt 8).
Begründung (Solution-Architekt/Rechtsberater-Hinweis): Tierbetreuung
trägt eine eigene Haftungsdimension (verletztes/entlaufenes Tier,
Tierhalterhaftung §833 BGB), die nicht in dieselbe niedrige
Haftungsschwelle wie Garten/Umzug/Einkauf fällt. Konsistent mit der
Modell-D-Linie: nur Kategorien mit niedriger Haftungsschwelle und ohne
besonderes Risiko im Startset. Kategorie bleibt in `data/categories.ts`
konfiguriert (reaktivierbar), nur nicht mehr im Startset.
