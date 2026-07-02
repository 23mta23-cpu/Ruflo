---
typ: entscheidung
datum: 2026-07-02
status: angenommen
---

# Sicherheits-/Compliance-Audit mit den Agency-Agents (2026-07-02)

Tayyip: "lass sie laufen ... jede Kleinigkeit soll geprüft werden, wir wollen bald online gehen."
4 der neu installierten Agenten parallel gegen den echten Code laufen lassen (Security
Architect, Application Security Engineer, Compliance Auditor, Legal Compliance Checker),
jeden Fund selbst gegen den Code verifiziert, teils mit einer echten lokalen Postgres-Instanz
funktional bewiesen (nicht nur gelesen).

## Kritisch — behoben & bewiesen

**1. IDOR in `accept_offer()`** (Application Security Engineer) — die RPC nahm eine vom Client
mitgeschickte `p_customer_id` entgegen statt `auth.uid()` zu prüfen. Jeder eingeloggte Nutzer
hätte per direktem RPC-Aufruf ein fremdes Angebot annehmen und einen bindenden Vertrag für
einen anderen Kunden erzeugen können. **Migration 029** — Funktion nimmt nur noch
`(p_offer_id, p_job_id)`, Identität kommt aus `auth.uid()`. Live gegen echte Postgres getestet:
alter Angriffspfad existiert nicht mehr, neuer lehnt Identitätsspoofing korrekt ab.

**2. Fehlender Spalten-Schutz auf `contracts`** (Security Architect) — `profiles` und
`provider_profiles` haben seit Migration 005 Trigger, die Client-Schreibzugriffe auf sensible
Spalten blocken; `contracts` bekam nie einen. Jede Vertragspartei hätte Betrag, Status,
Auszahlungssumme oder sogar `customer_id`/`provider_id` selbst überschreiben können.
**Migration 030** — neuer Trigger `guard_contracts_sensitive_cols`, exakt nach dem
bewährten Muster. Live getestet: Betrugsversuch (`customer_total` auf €0,01, `provider_id`
kapern) schlägt jetzt mit Fehler fehl, echte Nutzer & Edge Functions funktionieren normal.

## Mittel — behoben

**3. `reviews`-Tabelle ohne echten Vertragsbezug** (Compliance Auditor) — jeder hätte eine
Bewertung gegen einen beliebigen `contract_id` posten können, ohne dass ein echter,
abgeschlossener Vertrag zwischen den beiden Parteien bestand. **Migration 031** — INSERT-
Policy verlangt jetzt `status='completed'` + reviewer/reviewed als tatsächliche Vertragsparteien.

**4. Falsche Behauptung "WERKR übermittelt automatisch ans BZSt"** (Compliance Auditor) —
stand an 4 Stellen im Code (Push-Text, 2× in `steuer.tsx`), obwohl nirgends eine echte
BZSt/ELSTER-Anbindung existiert (kein Scheduler, keine API, kein PDF, keine Bestätigungs-Mail).
Texte auf das ehrlich Vorhandene reduziert (automatische Schwellenwert-Verfolgung), ohne die
nicht existierende Behörden-Übermittlung zu versprechen.

## Niedrig — behoben

- Falsche Gesetzesangabe §356 Abs. 5 → Abs. 4 BGB (`zahlung.tsx`)
- Verweis auf aufgehobenen RStV → §18 MStV (`impressum.tsx`)
- DPO-Name war unsichtbarer Freitext-Platzhalter, nicht am `LEGAL_PLACEHOLDER`-Mechanismus
  angeschlossen → nach `constants/legal.ts` verschoben
- Interne Fehlerdetails wurden an Aufrufer geleakt (`pstg-annual-report`) → generische Meldung

## Bewusst NICHT verändert (braucht Tayyip / einen Anwalt, kein Code-Fix)

- **`lib/supabase.ts` hartcodierter Anon-Key/URL-Fallback**: verstößt technisch gegen unsere
  eigene Standing Rule, aber `deploy-web.yml` übergibt bewusst einen leeren String, wenn kein
  GitHub-Secret gesetzt ist — der Live-Web-Deploy hängt aktuell an genau diesem Fallback. Ohne
  echten Deploy-Test riskiere ich damit die laufende Demo-Seite. Braucht: GitHub-Secret-Status
  prüfen, dann fail-fast umstellen.
- **`zahlung.tsx`-Checkbox-Formulierung/-Flow**: ist als unbedingter Verzicht beim
  Zahlungszeitpunkt formuliert statt als bedingte Zustimmung nach dem zweistufigen
  §356-Abs.-4-Test, den AGB/Widerruf beschreiben; wird auch bei Terminen in Wochen unverändert
  gezeigt. Braucht Anwalt + evtl. UX-Änderung, nicht nur Textkorrektur.
- **"WERKR Garantie"-Branding/FAQ**: Formulierungen ("Deckungssumme €5.000/€25.000",
  "WERKR prüft Evidenz und erstattet") lesen sich wie ein Versicherungsprodukt, unabhängig
  von der schon bekannten ZAG-Escrow-Frage. Braucht separate Anwaltsprüfung (VAG-Risiko).
- **ODR-Plattform-Link** (Impressum/AGB): laut Auditor evtl. 2025 abgeschafft — nicht sicher
  genug verifiziert, braucht Anwaltsbestätigung.
- **PAngV Netto/Brutto beim Handwerker-Festpreis**: kein Feld erfasst, ob der Provider-Preis
  netto oder brutto ist, keine Kleinunternehmer-Kennzeichnung — Marktplatz-Sorgfaltspflicht-
  Frage für den Anwalt.

## Verifikation
Jede Code-Änderung: `npx tsc --noEmit` 0 Fehler, `deno check` sauber, `npx jest` 323/323 grün.
Migrationen 029–031: komplette Kette (33 Dateien) gegen echte lokale Postgres-Instanz
verifiziert; beide kritischen Fixes zusätzlich mit echtem Exploit-Versuch vor/nach dem Fix
bewiesen (nicht nur Code gelesen).
