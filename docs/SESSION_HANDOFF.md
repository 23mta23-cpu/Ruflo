# Session-Handoff — Stand 27.07.2026, 12:00 UTC

**Für die nächste Session: Diese Datei zuerst lesen, dann eigenständig
weiterarbeiten. Der Founder ist im Urlaub und bearbeitet seine Punkte
vorerst nicht.**

Arbeitsmodus (aus CLAUDE.md): Normale technische Entscheidungen selbst
treffen und notieren, nicht nachfragen. Entscheidungen nach
`notes/04-Entscheidungen/`. Agenten für Reviews nutzen — sie haben in dieser
Session sieben echte Fehler gefunden, fünf davon in Code, den ich selbst
geschrieben hatte.

---

## 1. Aktueller Stand

- **main = `87dcb90`** (PR #145 gemerged). Arbeitsverzeichnis sauber.
- **Branch für neue Arbeit:** `claude/ruflo-deep-scan-1vr9zk`
  (`git checkout -B claude/ruflo-deep-scan-1vr9zk origin/main`).
- **Baseline, lokal verifiziert:** `tsc` 0 Fehler · `jest` 357/357 ·
  `db-test` 46/46 · `expo export --platform web` ok · `deno check` 13/13.
- **Letzte Migration:** `0600_guard_email_verified_on_insert.sql`.
  Neue Nummer immer per `ls supabase/migrations/ | sort | tail -3` ermitteln.

### In dieser Session gemerged
| PR | Inhalt |
|---|---|
| #142 | Gerätetest-Fixes: Chat-Rolle aus DB, Kundenprofil bearbeitbar, Statistik-Screen, Support-Chat ehrlich, „Werkant Schutz" statt „Garantie", Consent-Fix |
| #143 | Anbieter-Posteingang (Migration 0590) — Rückfrage war nach Auftragsvergabe eine Sackgasse |
| #144 | Verifikations-Deadlock diagnostiziert, ehrliche Fehlermeldungen, Selbst-Angebote gesperrt (0580), Guard-Härtung (0600) |
| #145 | health-Function deployen, AGB-Widerspruch gestrichen, Pro eingefroren, DSGVO-Nachlauf, CI-Guard |

---

## 2. BLOCKER — nur der Founder kann das (höchste Priorität)

**Die App ist für jede neue Registrierung funktionslos.** `RESEND_API_KEY`
ist in den Supabase-Secrets nicht gesetzt. Am Produktionsprojekt nachgewiesen:
`verify-email` → `500 {"error":"Mail service not configured"}`,
`auth_email_confirmed()` → `false`.

Ohne Verifizierung sind **alle fünf Schreibwege** gesperrt: Auftrag anlegen,
Angebot abgeben, Angebot annehmen, Rückfrage im Chat, Terminvorschlag.

Vollständige Ursachenkette, Behebung und Notfall-Entsperrung:
**`docs/ops/RESEND-MAIL-GATE.md`** — dort steht auch, dass Passwort-Vergessen
unabhängig davon kaputt ist (läuft über Supabase-SMTP, braucht Custom SMTP)
und dass `notify-matching-providers` denselben Key braucht (sonst erfährt kein
Anbieter von neuen Aufträgen).

**Der Founder hat vier Testkonten manuell freigeschaltet** und testet damit:
`m.tayyip.ates@gmail.com`, `23mta23@gmail.com`, `tayyip.ates@hotmail.de`,
`mta96@hotmail.de` (+ `tayyip.ates@icloud.com`). Jede NEUE Registrierung ist
wieder gesperrt.

**Erwartet rote CI-Mails:** Der Workflow `.github/workflows/health.yml` läuft
2x täglich und schlägt fehl, solange der Key fehlt. Das ist Absicht, kein
Defekt. Nicht „reparieren".

---

## 3. Offene Arbeit, nach Priorität

### 3.1 Review von PR #145 wurde NICHT abgeschlossen
Drei Review-Agenten (AppSec, Legal, QA) wurden gestartet und sind alle am
**Session-Limit** abgebrochen, bevor sie Ergebnisse lieferten. Der Code ist
gemerged und CI-grün, aber **ungeprüft**. Diese Fragen sind offen und sollten
zuerst beantwortet werden:

1. **`supabase/functions/health/index.ts` ist jetzt öffentlich**
   (`verify_jwt = false`). Er gibt preis, welche Secrets gesetzt sind
   (Booleans). Eigene Vorabprüfung: `stripe_webhook: false` ist NICHT
   ausnutzbar — mit leerem Secret wirft `constructEventAsync` und der Webhook
   antwortet 400, ist also unbrauchbar statt fälschbar. **Trotzdem offen:**
   Reicht das IP-Rate-Limit (60/h)? Sollte der Endpoint nur `ok` + `mail`
   liefern statt aller Detail-Booleans? Letzteres wäre eine billige Härtung
   ohne Funktionsverlust — der Workflow greppt nur nach `"mail":true`.
2. **`app/profil.tsx`:** `isBusiness` ist eine reine Client-Prüfung. Kann ein
   Privatkonto per direktem `PATCH /rest/v1/profiles` trotzdem
   `company_name`/`ust_id` setzen — und kann es `account_type` selbst auf
   'business' ändern? Falls ja: Welche steuerliche Folge hat das
   (Reverse-Charge)? `ust_id` wird ohne Formatprüfung gespeichert.
3. **`delete-account`:** Bewirkt `phone: undefined` in
   `auth.admin.updateUserById` wirklich eine Löschung oder ist es ein No-Op?
   Wenn No-Op, steht die Telefonnummer weiterhin in `auth.users` — derselbe
   DSGVO-Befund, den der Commit zu beheben behauptet. **Ungeprüft.**
4. **AGB §6 Abs. 3** wurde neu formuliert. Offen: Ist „werden vorab
   bekanntgegeben und gesondert vereinbart" ein unzulässiger einseitiger
   Änderungsvorbehalt (§308 Nr. 4 BGB)? Und bezieht sich §6 Abs. 4
   („Preisänderungen … 6 Wochen") noch auf etwas, nachdem Abs. 3 keine Preise
   mehr nennt?

### 3.2 „Datenexport fehlgeschlagen" — Ursache weiterhin unbekannt
Der Founder meldete es; der Spalten-Fix aus #142 erklärt es **nicht**
(supabase-js liefert `{data:null,error}`, `Promise.all` läuft weiter, Antwort
bliebe 200). Die Function ist nachweislich deployt (401). Der Hard-Fail muss
also **vor** dem `Promise.all` liegen: Auth/JWT, Rate-Limit (3/h!) oder das
E-Mail-Gate — oder clientseitig in `app/einstellungen.tsx`. Nicht geklärt.

### 3.3 Teilweise erledigte Founder-Punkte
Aus dem Selbst-Check über die ~20 Gerätetest-Punkte (13 erledigt, 6 teilweise):
- **Punkt 5 (Pro):** Bewusst eingefroren, siehe
  `notes/04-Entscheidungen/2026-07-27-Pro-bleibt-eingefroren.md`. Kein
  Handlungsbedarf, aber die Entscheidung kennen.
- **Punkt 13/15 (Leistungen/Kategorien):** Gewerk-Picker nutzt jetzt
  `kundenKategorien(true)`. Prüfen, ob das für Handwerker sinnvoll ist —
  es enthält auch die Nachbarschafts-Startkategorien.
- **Punkt 14 (Ausweisprüfung):** Es gibt bewusst KEINE Ausweisprüfung
  (`0370:9`, PAuswG §20). Die falschen Zusagen in `garantie.tsx` und
  `support-chat.tsx` sind entfernt. Es fehlt aber weiterhin ein Tooling für
  die KYC-Freigabe — `approved` geht nur manuell per service_role.
- **Punkt 16 (Feld-Asymmetrie):** Erledigt (PLZ/Ort/Firma/USt-IdNr).

### 3.4 Bekannte Altlasten
- **`deploy-touch`-Kommentar** in `supabase/functions/delete-account/index.ts:1`
  stellt eine falsche Diagnose (Aberglaube). Kann entfernt werden.
- **~19 Testkonten in der Produktion** (`werkant.pentest.*`, `werkant.e2e.*`
  usw.). Aufräum-SQL wurde dem Founder gegeben; `b1debug1907@example.com`
  muss bleiben (`scripts/e2e-live.cjs:28`).

---

## 4. Verbindliche Arbeitsregeln (in AGENTS.md, hart erarbeitet)

1. **Edge Functions vor dem Push prüfen.** `npx tsc` prüft
   `supabase/functions/` NICHT. Am 27.07. ist deshalb ein Namenskonflikt
   durchgerutscht, CI rot, Founder bekam die Fehlermail.
   Deno: `curl -fsSL https://deno.land/install.sh | sh`, dann
   `deno check --node-modules-dir=auto` über alle Functions.
2. **Jede neue Edge Function MUSS in `supabase/config.toml` stehen**, sonst
   wird sie nie deployt (live 404). Ein CI-Guard prüft das jetzt.
3. **Tests laufen lokal, nicht gegen die Produktion.** Keine Testkonten in der
   Live-DB. Ausnahme nur für Produktions-Diagnose: ein Konto, Präfix
   `claude-diag-<ts>@example.com`, im selben Arbeitsschritt löschen.
4. **CI-Warten:** `Monitor` mit curl gegen die GitHub-API funktioniert hier
   NICHT (kein Token) — dreimal ergebnislos ausgelaufen. Stattdessen: wenige
   große PRs, dann genau EIN `get_check_runs` nachdem echte Arbeit dazwischen
   lag.
5. **PR-Batching:** 2–4 zusammengehörige Blöcke sammeln, dann ein PR. Headroom
   weist PR-pro-Fix seit Monaten als teuersten Anti-Pattern aus.

---

## 5. Token-Disziplin (Anlass für diesen Handoff)

Der Founder hat 22 % des Wochenbudgets in wenigen Stunden verbraucht. Die
Hauptursache ist nicht die Arbeit, sondern der mitwachsende Kontext plus:
- **große CI-Logs** (`get_job_logs` mit `tail_lines: 200` = ~15k Token) —
  erst mit 40 Zeilen anfragen, nur bei Bedarf erhöhen;
- **`mcp__github__actions_list`** ist riesig, meiden;
- **Screenshots** vor dem Lesen halbieren (PIL im selben Bash-Aufruf);
- **Agenten** kosten je 70–160k Token. Sie lohnen sich für Reviews
  abgeschlossener Blöcke — aber höchstens zwei parallel, mit eng gefasstem
  Auftrag.

---

## 6. Was der Founder als Nächstes von sich aus tun will

Nichts. Er testet mit den freigeschalteten Konten und meldet Befunde.
Resend richtet er später ein.

**Zwei Dinge liegen dauerhaft bei ihm und sind Go-live-Blocker:**
1. `RESEND_API_KEY` + `WAITLIST_FROM_EMAIL` + Custom SMTP (siehe Abschnitt 2).
2. Anwaltliche Prüfung von `app/garantie.tsx` („Werkant Schutz") und
   `app/agb.tsx`. Die Widersprüche sind beseitigt, aber ob die Formulierungen
   tragen, kann keine KI beurteilen.
