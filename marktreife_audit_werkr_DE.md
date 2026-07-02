# 🇩🇪 Marktreife-Audit WERKR — Deutschland

**Stand:** 2026-07-02 · **Branch:** `claude/werkr-platform-context-b088z6`
**Methodik:** Jede Aussage in diesem Bericht wurde direkt im Code verifiziert (grep/Read/tsc/jest/lokale Postgres-Tests), nicht vermutet. Wo etwas *nicht* prüfbar war, steht das explizit.

> **Transparenz-Hinweis:** Dieses Audit umfasst das eine existierende Repository (`23mta23-cpu/Ruflo`). Es gibt keine weiteren verbundenen Repos — Frontend, Backend (Supabase Edge Functions + Migrationen), Prototyp und Doku leben alle hier. "Headroom" ist ein Kontext-Komprimierungs-Tool, kein separater Audit-Agent.

---

## 🐞 Bug-Report & Fixes (Status der besprochenen Fehler)

| # | Fehler | Status | Commit/Beleg |
|---|---|---|---|
| 1 | **Stripe-Plugin-Crash** — `app.json` ohne `merchantIdentifier`, blockierte JEDEN `expo start`/`prebuild`/EAS-Build | ✅ Gefixt | `e61ec32` |
| 2 | **react-dom-Versionskonflikt** — `^19.2.3` zog 19.2.7, `npm install` schlug fehl (ERESOLVE) | ✅ Gefixt | `0166d33` + `011a480` |
| 3 | **CocoaPods `React-Core-prebuilt` Fehler** — Ursache: Leerzeichen im Ordnernamen "WERKR XCODE" (RN-0.85-Downloader parst Pfade mit Leerzeichen falsch) | ✅ Gelöst (Ordner umbenannt, Build lief: "Build Succeeded, 0 errors") | Terminal-Log 2026-07-02 |
| 4 | **Suche-Screen hängt ewig im Spinner** — `fetchProviders()` ohne Timeout; hängende Verbindung = Spinner für immer | ✅ Gefixt (8s-Timeout + Demo-Fallback) | `4dfa400` |
| 5 | **`mailto:`-Fehler im Simulator** ("Unable to open URL: mailto:support@werkr.de") | ⚪ Kein Bug — Simulator hat keine Mail-App. Auf echtem Gerät funktional. Optional: `canOpenURL`-Guard mit Fallback (siehe 🟡) | — |
| 6 | **CoreHaptics-Logspam** ("hapticpatternlibrary.plist") | ⚪ Kein Bug — Simulator hat keine Haptik-Hardware, betriffft alle Apps im Simulator | — |
| 7 | **Frühere Session-Fixes** (Auswahl): accept_offer-IDOR, contracts-Spalten-Guard, provider_profiles-Trigger-Crash (blockierte JEDE Profil-Änderung + Stripe-Onboarding), Rating-Aggregation fehlte komplett, reviews-RLS-Lücke, WCAG-Kontrast `C.muted` | ✅ Gefixt & gegen echte lokale Postgres-Instanz getestet | Migrationen `029`–`033`, `constants/colors.ts` |

**Wichtig zu alten Chats/Cowork:** Fehler, die nur in früheren (abgelaufenen) Chats oder Cowork gemeldet wurden und nie im Repo dokumentiert waren, sind für diese Session unsichtbar. Konsequenz daraus → siehe 🟡 "Bug-Inbox".

---

## 🔴 Kritische Blocker für den Launch (Legal / Tech)

*Priorität von oben nach unten. Quelle: eigene Prüfung + `notes/01-Status/Go-Live-Blocker.md`.*

### Recht (kein Code kann das lösen — Operator/Anwalt)
1. **UG-Gründung + Gewerbeanmeldung** — ohne Eintragung kein gültiges Impressum (§5 TMG/DDG), keine wirksamen AGB. `constants/legal.ts` enthält aktuell Platzhalter (`[Ihr Name]`, `[Name Datenschutzbeauftragter]`); das Platzhalter-Banner-System ist vorbereitet, Go-Live = eine Datei füllen + `LEGAL_PLACEHOLDER = false`.
2. **ZAG/Escrow anwaltlich absichern** — Treuhand-Zahlungen sind grundsätzlich erlaubnispflichtig (BaFin). Falsch aufgesetzt = §63 ZAG (Straftat). Technischer Schutz existiert bereits: `zagGate.ts` blockiert `sk_live_`-Keys ohne `ZAG_LEGAL_SIGNOFF=confirmed` — aber die Rechtsprüfung selbst steht aus.
3. **AGB / Datenschutz / Widerruf final vom Anwalt** — Screens existieren und sind inhaltlich sauber (§18 MStV korrekt, §356 Abs. 4 BGB korrekt zitiert, Widerrufs-Screen vorhanden), aber P2B-VO (Ranking-Transparenz ggü. Handwerkern) und Verbraucherrecht brauchen anwaltliche Freigabe.
4. **BZSt-Registrierung (PStTG/DAC7)** — Code-Logik fertig (Zähler, Lock, Jahresreport), behördliche Registrierung fehlt.
5. **AVV/DPA unterschreiben** — Stripe, Supabase, Expo (Art. 28 DSGVO). Reiner Verwaltungsakt, 30 Minuten.

### Technik
6. **End-to-End-Test gegen Live-Backend + Echtgeld-Test** — 323 Unit-Tests grün, aber der komplette Fluss Auth → Auftrag → Angebot → Escrow → Freigabe → Auszahlung wurde nie gegen Stripe Live geprüft.
7. **Produktions-Secrets & Live-Projekte** — Supabase-Live (EU-Region), Stripe Live + Connect-KYC, `WERKR_ADMIN_SECRET`, EAS-Secrets. `eas.json` enthält noch `REPLACE_WITH_APPLE_ID`-Platzhalter, `app.json` eine Platzhalter-EAS-Projekt-ID.
8. **Professioneller Pentest** vor echtem Geldfluss (in ADR-0003 als offen markiert). Interne Audits (RLS, IDOR, Trigger) sind gemacht — ersetzen aber keinen externen Test.

---

## 🟡 Optimierungspotenzial (Sales / Marketing / UX)

1. **Bug-Inbox einführen (Prozess-Fix, wichtigster Punkt dieser Kategorie):** Gemeldete Fehler aus Chats/Cowork gingen nachweislich verloren, weil sie nirgends persistiert wurden. Ab jetzt: jeder gemeldete Bug landet sofort in `notes/00-Inbox/Bug-Inbox.md` (wurde mit diesem Audit angelegt) mit Status offen/gefixt/kein-Bug. Jede neue Session liest diese Datei zuerst.
2. **`mailto:`/`tel:`-Links absichern:** `Linking.openURL` ohne `canOpenURL`-Guard wirft unbehandelte Promise-Rejections (im Simulator sichtbar als roter Fehler). Fix: Guard + Fallback ("E-Mail: support@werkr.de" als kopierbarer Text). Kleiner Aufwand, verhindert peinliche Fehlermeldung beim Apple-Review-Tester.
3. **Android `WRITE_EXTERNAL_STORAGE` entfernen:** In `app.json` deklariert, aber seit Android 11 (API 30) wirkungslos/deprecated und triggert Play-Store-Rückfragen. Kamera-/Fotozugriff läuft über Scoped Storage.
4. **Conversion — Warteliste ist da, aber ohne Double-Opt-In:** Für E-Mail-Marketing an Wartelisten-Einträge ist in DE Double-Opt-In faktisch Pflicht (UWG §7). Vor der ersten Kampagne DOI-Flow ergänzen (Supabase Edge Function + Bestätigungslink).
5. **Suche/Entdecken-UX bei leerem Markt:** Demo-Banner ("Vorschau — noch keine Anbieter") ist ehrlich und gut. Für Conversion besser: direkt im Empty-State einen Warteliste-CTA statt nur Information ("Benachrichtigen lassen →").
6. **Ladezeiten:** JS-Bundle 1573 Module / ~16s Erst-Bundling im Dev-Modus ist normal; für Produktion Hermes ist aktiv (gut). Kein Handlungsbedarf, aber nach Launch: Bundle-Analyse, Lazy-Loading für selten genutzte Screens (steuer, pstg-Report).
7. **Störender Dev-Toast** ("Open debugger to view warnings") erscheint nur im Dev-Build — im Release-Build automatisch weg. Kein Fix nötig, nur Wissen.

---

## 🟢 Ready to go (Was bereits exzellent ist)

- **TypeScript 0 Fehler · 323/323 Tests grün** (verifiziert diese Session).
- **Alle 13 DB-Tabellen mit RLS**, Spalten-Guards für sensible Felder (`stripe_onboarded`, Escrow-Timestamps, PStTG-Felder) mit service_role-Bypass — live gegen echte Postgres-Instanz getestet, inkl. Exploit-Nachstellung.
- **Alle 8 Edge Functions:** Auth + Ownership-Checks + Rate-Limiting + strikte Input-Validierung + generische Fehlermeldungen (keine `err.message`-Leaks). Stripe-Idempotency-Keys gegen Doppel-Auszahlung.
- **Keine Tracking-SDKs im Bundle** → keine ATT-Pflicht, einfache Privacy Nutrition Labels, kein Cookie-Consent-Banner in der App nötig (TTDSG-relevantes Tracking findet nicht statt). Das ist ein echter Compliance-Vorteil.
- **Kein Social Login** → "Sign in with Apple" ist NICHT verpflichtend (Apple verlangt es nur, wenn Dritt-Logins wie Google/Facebook angeboten werden). E-Mail/Passwort via Supabase ist review-sicher.
- **iOS `Info.plist`-Erklärungen vollständig** (Kamera, Fotos, Mikrofon, Standort — alle mit präzisen deutschen Begründungen), `ITSAppUsesNonExemptEncryption=false` gesetzt, PrivacyManifest (`NSPrivacyAccessedAPICategoryUserDefaults`) vorhanden.
- **Apple-Pflicht „In-App-Kontolöschung"** erfüllt (`einstellungen.tsx` → `delete-account` Edge Function mit Pseudonymisierung).
- **DSGVO-Consent im Signup**, Widerrufs-Screen, AGB/Impressum/Datenschutz-Screens vorhanden und rechtlich korrekt zitiert (§18 MStV, §356 Abs. 4 BGB).
- **Fee-Engine mathematisch konsistent** über App + Prototyp (8 %/min. 3 € Provision, 2,5 %/min. 1,50 € Servicegebühr, 1,99 € WERKR-Schutz) inkl. §13b-UStG-Reverse-Charge-Logik.
- **Köln-Gating + bundesweite Warteliste** implementiert (Premortem-Todesursache 1 adressiert).
- **npm audit: 0 high/critical im Runtime-Bundle** (10 moderate ausschließlich in Build-Tooling).

---

## Nächste konkrete Schritte (Empfehlung, sortiert)

1. **Tayyip:** UG-Gründung starten (Notartermin) — blockiert alles Rechtliche.
2. **Tayyip + Anwalt:** ZAG-Kurzgutachten zur Stripe-Connect-Konstruktion einholen.
3. **Claude (Code):** `mailto:`-Guard + Android-Permission-Bereinigung + Warteliste-DOI (je < 1 h).
4. **Gemeinsam:** Sobald Stripe-Live-Zugang existiert → End-to-End-Echtgeld-Test via TestFlight.
