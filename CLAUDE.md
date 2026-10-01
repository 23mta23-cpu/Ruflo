@AGENTS.md

## Pruef-Regeln in Kuerze (22.09.2026)

Kurzfassung; Begruendungen und Messwerte in `docs/lehren/CHRONIK.md` (grep).

**1. Ein gruener Haken zaehlt erst, wenn eine Mutation ihn rot machen kann.**
Und eine Gegenprobe gehoert dazu: ein Pruefer mit Fehlalarmen wird
abgeschaltet und nie wieder an.

**2. Ein Beleg muss EINDEUTIG der sein, um den es geht.**
Vier Fundstellen an einem Tag: „Pflicht" steckt in „meisterpflichtigen";
`is_nachbarschaft` steht zweimal in derselben Datei; der erwartete Betrag
stand als Bezugsgroesse daneben; das Etikett kam zweimal auf dem Bildschirm
vor. Wenn ein Anker nicht eindeutig ist, entscheidet nicht das erste
Vorkommen, sondern eine Suche ueber alle.

**3. Auszeichnung und Wirkung sind ZWEI Zusicherungen.**
Der Knopf kann „Weniger anzeigen" sagen und nichts aufklappen; der Bildschirm
kann „Frist abgelaufen" sagen und trotzdem absenden lassen. Immer beides.

**4. Die Rechnung kann gedeckt sein und die Anzeige nicht.**
Jest prueft `feeEngine`, `angebotPreis`, `cancellationRefund`,
`bewertungsFrist` gruendlich. Kein Test hat je gefragt, ob der Bildschirm
diese Zahlen hinschreibt. Und: Bildschirm und erzeugte DATEI sind zwei
verschiedene Texte.

**5. Ein Schritt, der uebersprungen werden KANN, wird zugesichert.**
`if (await feld.count())` hat den Materialfall einer Reise seit ihrer
Entstehung still ausgelassen. Zaehlen und zusichern, nicht in ein `if` packen.

**6. Erst messen, welchen Bildschirm man misst.**
`/` leitet mit Anbieter-Rolle auf `/betrieb/dashboard` um; eine Gegenprobe
bestand dort muehelos, weil es das Gesuchte dort gar nicht gibt.

**7. Herkunft ist eine Quelltext-Frage, Wirkung eine Browser-Frage.**
Ein Wertvergleich beweist keine Bindung, wenn beide Seiten denselben Text
ergeben. Ein Quelltext-Pruefer sieht nicht, ob `undefined` gerendert wird.

**8. Nach einer Textkorrektur den GERENDERTEN Text lesen.**
Die fuenfte und sechste Fundstelle derselben Zusage fand kein Grep, sondern
das Ausgeben des sichtbaren Textes. Ein Literal kann anders formuliert sein
als das, wonach man sucht.

**9. Eine Ausnahmeliste braucht eine Verfallspruefung.**
Sonst ist sie irgendwann eine Liste ohne Eintraege im Produkt und der
Pruefer prueft weniger, als sein Name sagt.

**10. Den Rueckgabewert lesen, nie die PASS-Zahl als Ersatz.**
`run.sh` druckt `EXIT=` selbst. `| tail; echo $?` misst tail.


## Arbeitsmodus (Founder-Anweisung, 2026-07-05)
- Bei normalen technischen Entscheidungen NICHT nachfragen: sinnvolle Option
  selbst wählen und die Wahl im Bericht/Commit notieren.
- Eigene Arbeit in Abständen selbst gegen die Auftrags-Anforderungen prüfen
  (Selbst-Check vor dem Abschlussbericht), gefundene Lücken direkt fixen.
- Rollenverständnis: als Geschäftspartner agieren — CTO, Senior-Entwickler,
  Sales, Marketing, Rechtsberater (nur Hinweise, keine Rechtsberatung ersetzend)
  und Solution-Architekt. Entscheidungen aus der jeweils passenden Rolle
  treffen und begründen.
- Nach Session-Reset/Kontextverlust EIGENSTÄNDIG weitermachen (2026-07-07):
  `docs/SESSION_HANDOFF.md` lesen, offenen Stand fortsetzen, nicht auf
  Rückfragen warten. Zwischenstände reset-fest machen: Entscheidungen nach
  `notes/04-Entscheidungen/`, Marken-Assets nach `docs/brand/`.

## Projekt-Wissen (stabil)
- **Marke:** „Werkant" (final, Rebrand von WERKR live), Logo „Das Treffen"
  (`docs/brand/das-treffen-*.svg`), Siegel „Werkant-geprüft". Naming-Recherche
  NICHT wiederholen.
- **Betriebs-Playbooks:** `docs/agents/werkant-playbooks.md` (Puls-KPI-Digest,
  Aktivierung, Bestand, Wache, Köln-Akquise, DSGVO-Audit, Incident-Runbook) —
  per Stichwort ausführbar. Support-Persona: `docs/agents/werkant-support-SOUL.md`.
- **Security:** `docs/security/GO-LIVE-SECURITY-CHECKLIST.md` (Code-Stand
  verifiziert; offene Punkte = Founder-Dashboard-Klicks).

## Design System
**Imports:** `import { C } from '../../constants/colors'` · `import { T } from
'../../constants/typography'` (NICHT theme.ts) · `import { shadow, S, R } from
'../../constants/theme'`

**Farben (C):** bg `#F9F8F5` · bgWarm/hair `#F2EFE9` · surface `#FFF` · border
`#E5E1DA` · ink `#1A1917` · sub `#6C6862` · muted `#A8A49C` · primary `#1B5C40`
· primaryBg `#EBF4EF` · gold `#8F6B1A` · goldBg `#F6ECD8` · clay `#9B3E25` ·
red `#B91C1C` · **C.green/C.greenBg DEPRECATED → primary/primaryBg**

**Typo (T):** h1 28/35/700 · h2 22/29/700 · h3 18/25/700 · body 14/21/400 ·
btn 15/22/700 · label 12/17/700 upper · caption 11/16/500

**Harte Regeln:** fontWeight max '700' · shadowColor immer C.ink (nie '#000')
· keine Emojis in UI/Push (nur Ionicons) · Motion-Baustein: `components/ui/
Reveal.tsx` (reduce-motion-aware); Daten-Viz: `components/ui/ProgressRing.tsx`.
Audit: `grep -rn "C\.green\b\|C\.greenBg\|fontWeight.*['\"8][0-9][0-9]['\"']\|shadowColor:.*'#" app/ components/`

**App-Struktur:** Screens `app/*.tsx`, `app/(tabs)/`, `app/betrieb/` ·
Edge Functions `supabase/functions/*/index.ts` · Logik `lib/*.ts` ·
Typecheck: `npx tsc --noEmit 2>&1 | head -20`

## Lehren und Übergabe
- Datierte Lehren: `docs/lehren/CHRONIK.md`. Nicht ganz lesen, gezielt
  suchen (`grep -n -i "<stichwort>" docs/lehren/CHRONIK.md`). Neue Lehren dort
  anhängen, nicht hier; was bei JEDER Aufgabe gilt, zusätzlich als Satz oben
  in die Kurzfassung.
- Aktueller Stand: `docs/SESSION_HANDOFF.md`. Kurz halten: am Blockende den
  Inhalt überschreiben, nicht oben anbauen.

<!-- headroom:learn:start -->
## Arbeitsweise in dieser Umgebung (aus headroom learn, am 01.10.2026 verdichtet)
*Erzeugt von `headroom learn`, von Hand auf das noch Gültige gekürzt. Ein neuer
Lauf (`headroom learn --apply --target CLAUDE.md`) ersetzt diesen Block.*

- **Benachrichtigungen:** `ReadNotifications` nur, wenn ein Hinweis kommt; nie
  pollen.
- **Dateien:** einmal mit großem Bereich lesen und wiederverwenden. Drei oder
  mehr Änderungen an einer Datei: ein `python3`-Ersetzungslauf mit
  `assert text.count(alt) == 1`. Neue Dateien per `cat > datei <<'EOF'`.
  Ein `Read` auf `supabase/functions/**` mit `runtime_error` hat trotzdem
  den Inhalt: nicht wiederholen.
- **Server und Läufe:** Server per PID beenden
  (`ps -eo pid,args | grep "[s]pa-server" | awk '{print $1}' | xargs -r kill`),
  nie Befehle nach `pkill` verketten (Exit 144). `scripts/reisen/run.sh`
  startet seinen Server selbst; einmal pro Block, Ausgabe in eine Datei,
  warten mit `until grep -q "^EXIT=" log; do sleep 25; done`. Nach einem
  Abbruch erst Kindprozesse suchen und beenden.
- **Tests:** jede Suite einmal pro Block; Ergebnis mit
  `grep -E "FAIL|ERROR|EXIT"` lesen, nicht mit `tail`. Postgres in jedem
  Aufruf mit `service postgresql start >/dev/null 2>&1;` starten; SQL in
  `/tmp` braucht `chmod 644`. Fehlt `node_modules`: `npm ci --no-audit --no-fund`.
- **Mehrere Mutationen:** in EINEM Export bündeln, wenn sie verschiedene
  Stellen und unterscheidbare Texte betreffen.
- **Git:** einmal am Ende jedes Blocks pushen, mit Wiederholschleife; nie bis
  zum PR warten (der Container ist flüchtig). PRs nur auf Founder-Wunsch und
  gebündelt; CI-Warten wie in `AGENTS.md` (ein `get_check_runs`, kein Polling).
- **Edge Functions:** vor dem Push `deno check`; danach `git diff --stat
  deno.lock`, reines Rauschen mit `git checkout -- deno.lock` verwerfen.
- **Subagenten:** für kleine Änderungen EIN kombinierter Review statt drei
  Agenten; das volle Panel nur bei Geldfluss, Escrow und Webhooks.
- **Bildschirmfotos:** schon beim Aufnehmen auf höchstens 800 px verkleinern.
- **Live-URL:** nur für einen lesenden Abschluss-Rauchtest; geprüft wird
  gegen `dist/` auf Port 8744.
- **Werkzeug-Aussetzer** („temporarily unavailable"): denselben Aufruf
  wiederholen, nicht umbauen.
<!-- headroom:learn:end -->
