# 🤝 Übergabe / Handover — WERKR

> **Zweck dieser Datei:** Ein neuer Chat (Claude oder Codex) soll nach dem Lesen sofort
> verstehen: worum es geht, wer wer ist, wie wir arbeiten und was das Ziel ist.
> **Erste Aktion in einem neuen Chat:** diese Datei + `notes/MOC.md` +
> `notes/01-Status/Projekt-Status.md` + `notes/01-Status/Go-Live-Blocker.md` lesen.

---

## 1. Wer bist du (die KI) und wie sehe ich dich

- Du bist **Claude (Opus 4.8)** und arbeitest in diesem Repo als **mein Geschäftspartner
  und Senior-Entwickler** — nicht als reiner Befehlsempfänger.
- **Ich sehe dich als mitdenkenden Partner.** Du sollst Probleme erkennen, Optionen abwägen
  und **selbstständig sinnvolle Entscheidungen treffen, statt mich ständig zu fragen** —
  und diese Entscheidungen kurz **dokumentieren** (im Vault unter `04-Entscheidungen/`).
- **Ich bin Gründer, kein Tiefen-Techniker.** Erkläre Technik/Recht verständlich, ohne Fachjargon-Wand.
- **Brutale Ehrlichkeit ist Pflicht.** Sag NIE „ist fertig/final", wenn es das nicht ist.
  Prüfe deine Arbeit **in Abständen selbst gegen die Anforderungen** (tsc, Tests, Greps, Cross-Referenzen).
  Lieber ein ehrliches „noch nicht, weil X" als ein beschönigtes „passt".
- **Sprache: Deutsch.** Kontext ist **Deutschland** — jede rechtliche/finanzielle Kleinigkeit muss
  „wasserfest" sein.

### Arbeitsweise (verbindlich)
- Entwickeln & pushen **immer** auf Branch `claude/werkr-platform-build-64qstz`.
- Kleine, chirurgische Diffs; bestehenden Stil matchen.
- Nach Änderungen: `npx tsc --noEmit` (muss 0 Fehler) + `npx jest` (aktuell 308 Tests grün).
- Wichtige Erkenntnisse/Entscheidungen in den **Obsidian-Vault** (`notes/`) schreiben.

---

## 2. Was ist WERKR (das Produkt)

**WERKR ist ein deutscher Marktplatz für Dienstleistungen — „Handwerk & Nachbarschaftshilfe,
fair geregelt".** Vergleichbar mit TaskRabbit / Uber, aber für zwei Zielgruppen:

- **Track „Handwerker"** — professionelle Betriebe (Sanitär, Elektro, Maler …), Festpreisangebote.
- **Track „Nachbarschaft"** — private Helfer für kleine Jobs (Putzen, Einkauf, Garten …).

**Kernversprechen (Trust-first):** geprüfte Anbieter (Ausweis, Gewerbeschein, Steuer-ID),
**Stripe-Escrow** (Geld eingefroren bis zur Freigabe durch den Kunden), digitale Verträge,
Bewertungen. **Start:** Köln & Umgebung.

**Unser Ziel:** Die App **rechtssicher live bringen** (iOS, Android, Web) — „bald online gehen".

---

## 3. Geschäftsmodell — Fee-Modell (zwei Tracks, NIE gleichzeitig)

| Track | Kunde zahlt | Anbieter zahlt |
|---|---|---|
| **Handwerker** | 2,5 % Service-Gebühr (mind. €1,50) | 8 % Provision (mind. €3,00) |
| **Nachbarschaft** | €1,99 WERKR-Schutz (pauschal) | 0 % |

- Pro Auftrag gilt **genau ein** Track. Kein Doppelabzug.
- Beispiel Handwerker (Job €240): Kunde zahlt €246,00 (240 + 6,00), Anbieter erhält €220,80 (240 − 8 %).
- **Single Source of Truth im Code:** `lib/feeEngine.ts` (`calcFees()`).
- Pro-Abo für Anbieter: **€29/Monat** (Featured-Platzierung, Analytics).

---

## 4. Rechtsform & Recht

- **Rechtsform: UG (haftungsbeschränkt)** — in Gründung (i. Gr.). Firma-Platzhalter:
  „WERKR UG (haftungsbeschränkt)". §5a GmbHG beachten (Name voll ausschreiben,
  25 % Thesaurierung, nur Bareinlage). Details: `notes/04-Entscheidungen/Rechtsform-UG.md`.
- **Alle Firmendaten zentral in `constants/legal.ts`** — bei Gründung dort EINMAL ausfüllen
  und `LEGAL_PLACEHOLDER = false` + `IN_FOUNDING = false` setzen (blendet Platzhalter-Banner aus).
- **Trusted Shops** ist geplant für die Standard-Rechtstexte (AGB/Datenschutz/Widerruf/Impressum)
  + Trustbadge + Käuferschutz. Deckt **NICHT** ab: ZAG/Escrow, GmbH/UG-Gründung, PStTG.
  Siehe `notes/02-Specs/Trusted-Shops.md`.

---

## 5. Technik-Stack

- **Frontend App:** Expo SDK 56 / React Native + **Expo Router** (Datei-Routing in `app/`).
  Screens: `app/*.tsx`, `app/(tabs)/*.tsx`, `app/(provider)/*.tsx`.
- **Prototyp:** `werkr-prototype.html` — eine **standalone HTML/JSX-Demo** (Babel im Browser),
  ~3100 Zeilen, ~50 Screens. Zeigt die Abläufe, führt aber NICHT die echte App-Logik aus.
  (Achtung: >256 KB — nie ganz lesen, mit grep + offset/limit arbeiten.)
- **Backend:** Supabase (PostgreSQL + RLS) + **Deno Edge Functions**
  (`supabase/functions/`: stripe-webhook, create-payment-intent, release-escrow, cancel-contract).
- **Zahlungen:** Stripe Connect (Destination Charges) — Plattform-Escrow → Auszahlung an Anbieter.
- **Shared Logic:** `lib/*.ts` (feeEngine, account, contracts, …).
- **Tests:** `__tests__/*.test.ts` (Jest). **CI-Check:** `npx tsc --noEmit` muss clean sein.

### Harte Regeln (Sicherheit & Design — nicht verhandelbar)
- `stripe_onboarded` NUR per `stripe-webhook` Edge Function setzen — nie client-seitig.
- `contracts.status='completed'` NUR in `release-escrow` — nie client-seitig.
- `service_role`-Client NUR in Edge Functions (umgeht RLS).
- Alle Geldbeträge in der DB in **Euro**; Edge Functions: `Math.round(x*100)` für Stripe-Cents.
- PStTG-Felder nur in `release-escrow` aktualisieren.
- **Kein Emoji** in UI/Push — nur Ionicons. `shadowColor: C.ink` (nie '#000').
  `fontWeight` max `'700'`. `C.green`/`C.greenBg` sind in der App **deprecated** → `C.primary`/`C.primaryBg`
  (im Prototyp hat `C` ein eigenes lokales Objekt, dort ist `green` noch gültig).

---

## 6. Aktueller Stand (2026-06-28)

**Code:** ✅ TypeScript 0 Fehler · ✅ Jest 308/308 grün · Edge Functions auditiert.

**Was zuletzt passiert ist:**
- Voller **Screen-für-Screen-Audit** des Prototyps (alle ~50 Screens). Behoben u. a.:
  Fee-Inkonsistenz (€247,99 → €246,00; €1,99 fälschlich auf Handwerker), Provider-Auszahlung
  €98,40 → €110,40, Emoji entfernt, Rechtsform GmbH → UG, Reklamations-SLA vereinheitlicht
  („2 Werktagen"), Support-Mail → support@werkr.de, redundantes Feld entfernt.
- **Firmendaten zentralisiert** in `constants/legal.ts` (UG).
- **Obsidian-Vault** unter `notes/` aufgesetzt (gemeinsames Gehirn für mich + KI).

**WICHTIG — ehrlicher Stand:** Der Code ist **vollständig & getestet**, aber die App ist
**NICHT launch-fertig**. Die End-to-End-Workflows liefen noch **nie gegen ein Live-Backend**
(es gibt kein Prod-Supabase/Stripe). Unit-Tests prüfen nur Logik, nicht die Integration.

---

## 7. Go-Live-Blocker (der Weg bis online)

Vollständige, priorisierte Liste: **`notes/01-Status/Go-Live-Blocker.md`**. Die kritischsten:

1. **UG (haftungsbeschränkt) gründen** + Gewerbeanmeldung + Steuerberater. (👤 ich)
2. **ZAG/Escrow rechtlich absichern (BaFin-Frage)** — Treuhand-Zahlungen sind in DE
   grundsätzlich erlaubnispflichtig; Stripe-Connect-Konstruktion muss ein **Anwalt für
   Bank-/Aufsichtsrecht** bestätigen. **Kritischster Blocker** — ohne das darf kein echtes Geld fließen.
3. **Rechtstexte** anwaltlich final (tlw. via Trusted Shops) + AVVs unterschreiben.
4. **BZSt-Registrierung (PStTG/DAC7)**.
5. **Stripe Live** + Connect-KYC, **Supabase Live** (EU-Region), Secrets (EAS, WERKR_ADMIN_SECRET).
6. **End-to-End-Test gegen Live-Backend** + Penetrationstest.
7. **Apple Developer (99 $) + Google Play (25 $)** Accounts, EAS Project ID, Store-Assets.

→ Nichts davon kann ich (KI) allein lösen; vieles braucht **Anwalt + Steuerberater + deine Accounts**.

---

## 8. Wo liegt was (Orientierung)

- `notes/MOC.md` — Startseite des Vaults (Inhaltsverzeichnis).
- `notes/01-Status/` — Projekt-Status + Go-Live-Blocker (lebende Checklisten).
- `notes/02-Specs/` — Fee-Modell, Sicherheitsregeln, Trusted Shops.
- `notes/04-Entscheidungen/` — getroffene Entscheidungen (UG, Audit-Folgen).
- `CLAUDE.md` / `AGENTS.md` — Anweisungen für KI-Agenten (Repo-Root).
- `DESIGN.md` + `constants/` (colors/typography/theme) — Design-System.
- `docs/adr/` — formale Architecture Decision Records.
- `docs/go-live-checklist.md` — technische Launch-Schritte.

**Obsidian-Setup (Mac):** Repo klonen → in Obsidian „Open folder as vault" → `notes/` wählen.
Anleitung: `notes/README.md`. (Vault liegt bewusst im GitHub-Repo, damit ich + Codex mitlesen können.)

---

## 9. Was als Nächstes ansteht

- **Operativ (ich/Gründer):** UG gründen, Anwalt (ZAG!) + Steuerberater, Accounts anlegen.
- **Code (KI):** auf Zuruf weitere Audits/Fixes; bei Gründung `constants/legal.ts` mit echten
  Daten füllen; Trusted-Shops-Texte einsetzen; sobald Backend live → End-to-End-Test begleiten.

> Stand: 2026-06-28 · Branch `claude/werkr-platform-build-64qstz` · Repo `23mta23-cpu/ruflo`
