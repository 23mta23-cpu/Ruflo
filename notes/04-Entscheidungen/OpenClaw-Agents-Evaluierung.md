# Entscheidung: awesome-openclaw-agents — was Werkant davon nutzt

**Datum:** 2026-07-12 · **Rolle:** CTO · **Auftrag:** Founder („schauen was wir sinnvoll nutzen können")

## Was das Repo ist
205 `SOUL.md`-Persona-Vorlagen (System-Prompts) + ein 45-Zeilen-Telegram-Bot
(`quickstart/bot.js`: SOUL.md als System-Prompt → Anthropic API → Telegram).
Kein Framework, keine Magie — sauber strukturierte Prompts. Stark beworben
wird der Bezahldienst crewclaw.com (brauchen wir nicht).

## Verifiziert (2026-07-12, Sandbox)
- `npm install` ✓ · SOUL.md lädt (Orion, 2.053 Zeichen) ✓ · Telegram-/
  Anthropic-Clients instanziieren ✓
- Live-Betrieb erfordert `TELEGRAM_BOT_TOKEN` (@BotFather) + `ANTHROPIC_API_KEY`
  — Founder-Credentials, aus der Sandbox nicht erzeugbar.
- Korrigiert: bot.js Fail-fast mit klarer .env-Anleitung statt endlosem
  polling_error-Spam; `.env.example` ergänzt (lokal im Scratchpad-Klon).

## Entscheidung: 1× übernehmen, 1× verschieben, Rest verwerfen

### ✅ Übernommen: SOUL-Muster für unseren Support-Chat
`app/support-chat.tsx` ist heute Keyword-Matching mit Fertigantworten.
Das „Compass"-Muster (Triage → Antwort aus Wissensbasis → Eskalationsregeln)
ist genau das richtige Upgrade-Gerüst. **Erledigt:** Werkant-eigene SOUL
verfasst (`docs/agents/werkant-support-SOUL.md`, Persona „Anker") mit echten
Werkant-Fakten (Gebühren, Escrow, Fristen) + harten Leitplanken (keine
Rechtsberatung, Eskalationspflichten, Datenschutz).
**Umsetzung später** als Edge Function `support-assistant` (API-Key nur
serverseitig, Rate-Limit + Validierung nach Standing Security Rules).
Bewusst NACH Go-Live: laufende API-Kosten + Missbrauchsfläche erst, wenn
echter Support-Traffic da ist.

### ⏸ Verschoben: CEO-Telegram-Bot (Orion)
Technisch trivial lauffähig (Anleitung im Scratchpad-Klon). Aber: Diese
Claude-Sessions erfüllen die Orion-Rolle (Koordination, Briefings) bereits
ohne zusätzliche Infrastruktur/API-Kosten. WERK_OS-Kostendisziplin →
erst wieder anfassen, wenn der Founder Push-Briefings aufs Handy will.

### ❌ Verworfen
Die restlichen ~200 Personas (E-Commerce, HR, Healthcare …) und der
Docker-Stack: kein Bezug zum Marktplatz-Kern, jede weitere laufende
Komponente = Kosten + Wartung + Angriffsfläche.

---

## Korrektur nach Deep Dive (2026-07-12, Founder-Einspruch berechtigt)

Der erste Pass („1× übernehmen, Rest verwerfen") war zu grob. Nach Lektüre
aller 205 Rollen: **7 weitere Playbooks adaptiert** →
`docs/agents/werkant-playbooks.md`:
Puls (KPI-Digest, SQL gegen lokales Postgres validiert), Aktivierung
(Anbieter-Funnel), Bestand (Churn-Wache), Wache (Fraud/Abuse-Radar auf
chat_leak_flags & Co.), Köln-Akquise (inkl. §7-UWG-Rechtsrahmen!),
DSGVO-Selbstaudit (Quartals-Check), Vorfall (Incident-Runbook mit
Art.-33-72h-Frist).

Kern-Erkenntnis: Der Wert liegt in den **Betriebs-Playbooks**, nicht in der
Bot-Infrastruktur — Ausführung durch Claude in Sessions (Aufruf per Stichwort),
keine neuen Kosten. development/creative/data bleiben verworfen (macht Claude
nativ), Nischen-Branchen ohne Werkant-Bezug ebenso.
