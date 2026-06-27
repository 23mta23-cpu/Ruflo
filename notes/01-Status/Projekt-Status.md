---
typ: status
aktualisiert: 2026-06-27
---

# 📊 Projekt-Status

> Eine Seite, die immer den aktuellen Stand zeigt. Bei jeder Session aktualisieren.

## Aktueller Stand (Code)
- React-Native-App (Expo SDK 56) + Web-Prototyp (`werkr-prototype.html`).
- TypeScript: 0 Fehler. Edge Functions auditiert und sauber.
- Prototyp & App fachlich abgeglichen (Fees, Stornofristen, Tracks).

## 🚧 Go-Live-Blocker (operativ, nicht Code)
Diese müssen *von dir / Operator* erledigt werden — kein KI-Task:

- [ ] **GmbH / UG Gründung** abschließen (#blocker #recht)
- [ ] **Stripe Production Keys** + Connect live schalten (#blocker #stripe)
- [ ] **Supabase Live-Projekt** anlegen, Migrationen einspielen (#blocker)
- [ ] **WERKR_ADMIN_SECRET** in Produktion setzen (#blocker)
- [ ] **EAS Project ID** für Builds eintragen (#blocker)
- [ ] **Echte Rechtstexte** (AGB, Datenschutz, Impressum, Widerruf) durch Anwalt (#blocker #recht)

## 🟡 Offen / als Nächstes
- [ ] (hier eintragen)

## ✅ Kürzlich erledigt
- [x] Prototyp: Emoji-artige Icons ersetzt (Augen → "Zeigen/Verbergen", Herz → Repeat)
- [x] Fee-Minimums im Prototyp korrigiert (8 % mind. €3,00)
- [x] Stornofrist 24h → 48h vereinheitlicht

## Verweise
- Launch-Details: `docs/go-live-checklist.md`
- Fee-Logik: [[02-Specs/Fee-Modell]]
- Harte Regeln: [[02-Specs/Sicherheitsregeln]]
