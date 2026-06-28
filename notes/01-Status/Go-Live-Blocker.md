---
typ: status
aktualisiert: 2026-06-27
zweck: Lebende Checkliste — der komplette Weg bis zum Launch (Apple/Google/Web)
---

# 🚦 Go-Live-Blocker — bis Apple / Google / Web

> **Verdikt Stand 2026-06-27: NICHT launchbereit.** Code ist solide (TS 0 Fehler,
> Edge Functions auditiert), aber rechtliche & operative Bausteine fehlen.
> Reihenfolge ist **bewusst** so — Recht vor Technik, sonst baut man auf Sand.
>
> Legende: ⬜ offen · 🟡 in Arbeit · ✅ erledigt · 👤 Operator (du) · ⚖️ Anwalt · 💼 Steuerberater · 🤖 KI/Code
>
> Quellen: `docs/go-live-checklist.md`, `docs/adr/0003-legal-compliance.md`.
> Disclaimer: Diese Liste ersetzt **keine** Rechtsberatung.

---

## P0 — Rechtliches Fundament (blockiert ALLES andere)

- ⬜ 👤💼 **UG (haftungsbeschränkt) gründen** — Rechtsform steht fest ([[../04-Entscheidungen/Rechtsform-UG]]). Ohne Eintragung kein gültiges Impressum, keine Verträge. #blocker #recht
- ⬜ 👤 **Gewerbeanmeldung** nach Gründung. #blocker #recht
- ⬜ ⚖️ **ZAG / Escrow absichern** — KRITISCH. Treuhand-Zahlungen sind in DE grundsätzlich
  erlaubnispflichtiger Zahlungsdienst (BaFin). Stripe-Connect-Konstruktion muss anwaltlich
  bestätigt werden (Geldhaltung bei Stripe, ggf. §2 ZAG-Ausnahme). Falsch = §63 ZAG (Straftat). #blocker #recht #stripe
- 🟡 ⚖️ **AGB final prüfen** — Fernabsatz/Verbraucherrecht (§312 ff. BGB), **P2B-VO** (EU 2019/1150:
  Ranking-Transparenz + Kündigungsfristen ggü. Handwerkern). → tlw. via **Trusted Shops** ([[../02-Specs/Trusted-Shops]]), P2B/Marktplatz separat prüfen. #blocker #recht
- 🟡 ⚖️ **Datenschutzerklärung prüfen** — DSGVO Art. 13/14, Rechtsgrundlagen, Speicherfristen. → tlw. via Trusted Shops. #blocker #recht #dsgvo
- 🟡 ⚖️ **Widerrufsbelehrung** exakt nach gesetzlichem Muster (Anlage EGBGB). → tlw. via Trusted Shops. #blocker #recht
- ⬜ 👤 **AVV/DPA unterschreiben** — Stripe (stripe.com/dpa), Supabase (supabase.com/dpa), Expo (Art. 28 DSGVO). #blocker #dsgvo
- ⬜ 🤖 **Verarbeitungsverzeichnis** (Art. 30 DSGVO) erstellen. #recht #dsgvo

## P1 — Echte Daten in den Code (nach Gründung)

> ✅ **Vorbereitet (2026-06-27):** Alle Firmendaten jetzt zentral in **`constants/legal.ts`**.
> Go-Live = **eine Datei** ausfüllen + `LEGAL_PLACEHOLDER = false`. Platzhalter-Banner verschwinden automatisch.

- ⬜ 👤 **`constants/legal.ts` ausfüllen**: Name, Adresse, Geschäftsführer, HRB, USt-IdNr., Telefon. #blocker
- ⬜ 👤 `LEGAL_PLACEHOLDER = false` setzen (nach Gründung). #blocker
- ⬜ 🤖 Prototyp `werkr-prototype.html` ebenfalls auf echte Daten ziehen (Konsistenz). #offen

## P2 — Behörden & Sicherheit

- ⬜ 👤 **BZSt-Registrierung (PStTG/DAC7)** als Plattformbetreiber + Meldeweg (Code-Logik existiert, behördl. Teil fehlt). #blocker #recht
- ⬜ 🤖👤 **Penetrationstest** durchführen (ADR-0003 offen) — `ruflo-security-audit`. #blocker
- ⬜ 👤 **Verbraucherschlichtung (VSBG)** — Entscheidung + Hinweis in AGB/Impressum, ob Teilnahme. #recht

## P3 — Produktions-Infrastruktur

- ⬜ 👤 **Supabase Live-Projekt** (EU-Region!) + Migrationen `supabase db push`. #blocker
- ⬜ 👤 **Stripe Live** aktivieren + Connect-KYC (ersetzt Mock-IBAN). #blocker #stripe
- ⬜ 👤 **Secrets setzen**: EAS, Supabase Edge Functions, GitHub Actions (Details in `docs/go-live-checklist.md` §4–6). #blocker
- ⬜ 👤 **WERKR_ADMIN_SECRET** in Produktion. #blocker

## P4 — App-Store-Einreichung

- ⬜ 👤 **Apple Developer Program** (99 $/Jahr) + App-Record in App Store Connect. #blocker
- ⬜ 👤 **Google Play Account** (25 $) + App-Eintrag `de.werkr.app`. #blocker
- ⬜ 👤 **EAS Project ID** echt setzen (`npx eas-cli init`). #blocker
- ⬜ 👤 `eas.json`-Platzhalter füllen (appleId, appleTeamId, ascAppId). #blocker
- ⬜ 👤 **Store-Assets**: Screenshots (6.5" iPhone), Beschreibungstexte, Content-Rating, Privacy Nutrition Labels. #offen
- ⬜ 👤 **Echtgeld-Test** Stripe Live (kleiner Betrag + Refund) auf echtem Gerät via TestFlight / Play Internal. #blocker

---

## ✅ Bereits erledigt / im Code vorhanden (Basis)
- ✅ TypeScript 0 Fehler, Edge Functions auditiert.
- ✅ Sicherheit: Escrow-Freigabe & `stripe_onboarded` nur server-seitig.
- ✅ Compliance im Code vorbereitet: Alterscheck (JArbSchG), MiLoG, PStTG-Logik, 14-Tage-Widerruf, DSGVO-Consent, In-App-Kontolöschung.
- ✅ Prototyp ↔ App fachlich abgeglichen (Fees, Stornofristen 48h, Tracks).

## Verweise
- [[Projekt-Status]] · [[../02-Specs/Fee-Modell]] · [[../02-Specs/Sicherheitsregeln]]
- `docs/go-live-checklist.md` (technische Schritt-für-Schritt-Befehle)
- `docs/adr/0003-legal-compliance.md`
