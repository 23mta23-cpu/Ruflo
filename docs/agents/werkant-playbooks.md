# Werkant Betriebs-Playbooks (aus awesome-openclaw-agents adaptiert)

**Stand:** 2026-07-12 · Deep-Dive-Ergebnis (Founder-Auftrag) · Quelle: 205 SOUL-Vorlagen

**So werden sie genutzt:** Kein Telegram-Bot, keine neue Infrastruktur — **Claude
führt diese Playbooks direkt in der Session aus.** Aufruf per Stichwort
(z. B. „Puls bitte" → KPI-Digest). Optional später als wiederkehrende Routine
(wöchentliches Founder-Briefing). Jedes Playbook nutzt NUR echte
Werkant-Datenstrukturen (Schema verifiziert 2026-07-12).

---

## 1) „Puls" — Wöchentlicher KPI-Digest *(aus productivity/metrics)*

Zahlen zuerst, keine Prosa. Vergleich immer: diese Woche vs. Vorwoche.

**Lauffähiges SQL (Supabase → SQL Editor, 1 Copy-Paste):**
```sql
select 'Neue Konten'            as kpi, count(*)::text as wert from profiles          where created_at > now() - interval '7 days'
union all select 'davon Anbieter',      count(*)::text from profiles                  where created_at > now() - interval '7 days' and role = 'provider'
union all select 'Neue Aufträge',       count(*)::text from jobs                      where created_at > now() - interval '7 days'
union all select 'Neue Angebote',       count(*)::text from offers                    where created_at > now() - interval '7 days'
union all select 'Neue Verträge',       count(*)::text from contracts                 where created_at > now() - interval '7 days'
union all select 'GMV (€, 7 Tage)',     coalesce(sum(price_gross),0)::text from contracts where created_at > now() - interval '7 days'
union all select 'Plattform-Umsatz (€)',coalesce(sum(customer_total - provider_payout),0)::text from contracts where created_at > now() - interval '7 days'
union all select 'Warteliste gesamt',   count(*)::text from waitlist
union all select 'Chat-Leak-Flags (7T)',count(*)::text from chat_leak_flags           where created_at > now() - interval '7 days';
```
**Alarm-Schwellen:** 0 neue Konten in 7 Tagen · Angebote/Auftrag < 1 ·
Chat-Leak-Flags > 5/Woche → gezielt nachsehen.

## 2) „Aktivierung" — Anbieter-Funnel *(aus saas/onboarding-flow)*

Werkants Aha-Moment (Anbieter) = **erstes angenommenes Angebot**.
Funnel: Konto → KYC eingereicht → freigeschaltet → 1. Angebot → 1. Vertrag.
```sql
select
  count(*) filter (where role='provider')                                   as anbieter_konten,
  count(*) filter (where pp.kyc_status in ('in_review','verified'))         as kyc_eingereicht,
  count(*) filter (where pp.kyc_status = 'verified')                        as freigeschaltet,
  count(distinct o.provider_id)                                             as mit_angebot,
  count(distinct c.provider_id)                                             as mit_vertrag
from profiles p
left join provider_profiles pp on pp.id = p.id
left join offers o on o.provider_id = p.id
left join contracts c on c.provider_id = p.id
where p.role = 'provider';
```
**Regel:** größten Absprung-Schritt benennen + EINE konkrete Gegenmaßnahme.
Ziel Köln-Beta: ≥ 50 % der freigeschalteten Anbieter geben in 7 Tagen ein Angebot ab.

## 3) „Bestand" — Anbieter-Abwanderungs-Wache *(aus saas/churn-prevention)*

Wöchentlich: verifizierte Anbieter **ohne Angebot in 14+ Tagen** oder mit
`available=false` → Liste mit je einer Reaktivierungs-Maßnahme (persönliche
Nachricht, passenden offenen Auftrag zeigen). Bei < 20 Anbietern (Beta) gilt:
**jeder einzelne** inaktive Anbieter bekommt eine persönliche Ansprache durch
den Founder — kein Automatisierungs-Theater.

## 4) „Wache" — Betrugs- & Missbrauchs-Radar *(aus finance/fraud-detector + data/anomaly-detector)*

Marktplatz-spezifische Signale, wöchentlich prüfen:
- `chat_leak_flags` (Vorbeischleusen an Escrow: Telefonnummern/„zahl bar"-Muster) — Tabelle existiert, Strike-System aktiv.
- Velocity: >3 Verträge zwischen demselben Kunden/Anbieter-Paar in 7 Tagen (Gebühren-Umgehung/Fake-Bewertungs-Farm).
- Bewertungs-Anomalie: Anbieter mit nur 5★ von frisch registrierten Konten.
- Storno-Häufung: >30 % Storno-Quote eines Anbieters.
**Regel (aus fraud-detector übernommen):** nie auto-sperren — Befund + Risiko-
Einstufung + Empfehlung, Entscheidung trifft der Founder.

## 5) „Köln-Akquise" — Anbieter-Gewinnung *(aus marketing/cold-outreach + business/lead-gen)*

**ICP:** Handwerksbetriebe & selbstständige Helfer in Köln + 25 km; priorisiert:
Gewerke mit Meisterpflicht-Badge-Vorteil (Sanitär, Elektro) + hoher Nachfrage
(Reinigung, Umzug). Quellen: Handwerkskammer-zu-Köln-Verzeichnis, Google-Maps-
Profile mit wenigen/alten Bewertungen (= hungrig auf Aufträge), Empfehlungen.

**⚠️ Rechtsrahmen (wichtig, § 7 UWG):** Kalt-**E-Mail** an Betriebe ohne
Einwilligung ist in DE abmahnfähig — auch B2B. Sicher sind: **Telefon bei
laufender Geschäftsbeziehung, Brief/Postkarte, persönlicher Besuch, Antwort
auf öffentliche Inserate.** Empfohlener Kanal fürs Beta: persönlich/Brief +
QR-Code zur Anbieter-Warteliste.

**3-Kontakt-Sequenz (Brief/persönlich):**
1. Nutzen in 1 Satz: „Aufträge aus Ihrem Veedel — Provision nur bei Erfolg
   (8 %), keine Lead-Gebühren wie bei MyHammer."
2. +7 Tage: Beleg — konkreter offener Auftrag in seiner Nähe/seinem Gewerk.
3. +14 Tage: Abschluss — „Gründer-Konditionen für die ersten 20 Kölner
   Betriebe", danach Schluss.
Antworten klassifizieren: interessiert / später / nein — nur „später" nach
90 Tagen erneut.

## 6) „DSGVO-Selbstaudit" — Quartals-Check *(aus compliance/gdpr-auditor)*

Gegen echte Werkant-Features prüfen (jedes Quartal, 30 Min):
- [ ] Löschkonzept funktioniert: `delete-account` pseudonymisiert, HGB-Fristen dokumentiert
- [ ] Consent aktuell: DsgvoConsent-Version vs. tatsächliche Verarbeitungen (Analytics?)
- [ ] AVV-Liste vollständig: Supabase, Stripe, (Resend), GitHub Pages — Verträge/DPAs abgelegt?
- [ ] Datenminimierung: keine neuen Felder ohne Zweck (letzte Migrationen durchsehen)
- [ ] Betroffenenrechte: Auskunft/Export beantwortbar innerhalb 30 Tagen?
- [ ] Drittland-Transfers: US-Dienste über DPF/SCC abgedeckt?
Befund-Format: Lücke → Artikel → Risiko (hoch/mittel/niedrig) → Fix + Aufwand.

## 7) „Vorfall" — Security-Incident-Runbook *(aus security/incident-logger)*

Wenn der Verdacht besteht „wir wurden gehackt" — **Reihenfolge einhalten:**
1. **Eindämmen:** Supabase → betroffene Keys rotieren (Service-Key, ggf. anon),
   verdächtige Sessions global ausloggen, im Zweifel Signups pausieren.
2. **Dokumentieren (ab Minute 1):** Zeitstempel (UTC), was gesehen, was getan,
   wer betroffen — formlos, aber lückenlos (Vorlage: eine Zeile pro Ereignis).
3. **Bewerten:** Sind personenbezogene Daten abgeflossen? Welche, wie viele Nutzer?
4. **72-Stunden-Regel (Art. 33 DSGVO):** Bei Risiko für Betroffene → Meldung an
   die LDI NRW (zuständig für Köln) **innerhalb 72 h** ab Kenntnis. Bei hohem
   Risiko zusätzlich Betroffene informieren (Art. 34).
5. **Aufarbeiten:** Ursache → Fix → Lessons Learned in `docs/security/` versionieren.
Claude übernimmt auf Zuruf: Dokumentation, Bewertungs-Entwurf, Meldungs-Entwurf.

---

## Bewusst NICHT adaptiert (ehrliche Begründung)
- **development/** (code-reviewer, bug-hunter, test-writer, qa …): Das bin ich
  bereits nativ in jeder Session — ein Prompt-File dazwischen macht es schlechter.
- **creative/** (copywriter, brand-designer, ux-researcher): dito — Marke,
  Texte und Design laufen schon als Rollen in unseren Sessions.
- **legal/contract-reviewer, finance/tax-preparer:** Arbeitsweise übernommen
  (Hinweise, nie Rechts-/Steuerberatung — steht so schon in AGENTS.md),
  eigene Dateien unnötig.
- **data/** (sql-assistant, report-generator): in „Puls" aufgegangen.
- **voice/, healthcare/, real-estate/, education/, supply-chain/, ecommerce/
  (bis auf review-responder-Ideen in „Wache"), hr/, freelance/, moltbook/:**
  kein Werkant-Bezug.
- **automation/morning-briefing:** gute Idee als wöchentliche Routine —
  liegt beim Founder (Opt-in), technisch jederzeit aktivierbar.
