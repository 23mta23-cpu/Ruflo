---
typ: entscheidung
datum: 2026-07-03
status: umgesetzt
---

# Dark Hero + Deploy-Konsolidierung

## Entscheidung 1 — Eine Deploy-Wahrheit
`deploy-web.yml` (gh-pages-Branch) und die Root-`index.html`
(alte Prototyp-Weiterleitung) wurden gelöscht. GitHub Pages wird
ausschließlich über `.github/workflows/static.yml` (main → Actions)
bedient. Grund: Die Doppel-Pipeline baute alles zweimal und die tote
Weiterleitungsdatei hat zweimal den „alte Website"-Bug bzw. dessen
Diagnose verursacht.

## Entscheidung 2 — Landing-Hero dunkel (Prototyp-Vorbild)
Nav + Hero der Landing tragen jetzt dunkles Markengrün (`#17503A`,
lokale HERO-Palette in `app/landing.tsx`), Text weiß, Akzent Mint
(`#8FD9B0`) auf „fair geregelt.". Die SafeArea trägt dasselbe Grün —
die iOS-Statusleiste verschmilzt mit der Hero statt als heller
Streifen zu stehen (Tayyips Screenshot-Feedback: Prototyp löste den
oberen Rand besser). Nav enthält nur noch „Einloggen" — zwei
Nav-Buttons kollidierten bei 390px mit dem Logo.

## Entscheidung 3 — Ehrliche Social Proof (UWG)
„400+ Handwerker bereits registriert" entfernt — die Zahl war ein
Prototyp-Mock und wäre live irreführende Werbung (§ 5 UWG). Ersetzt
durch die belegbare Aussage „Jeder Anbieter persönlich verifiziert —
Ausweis, Gewerbeschein, Steuer-ID". Echte Zahlen kommen zurück,
sobald es sie gibt.

Verifiziert: tsc 0 Fehler, lokaler Web-Export + Playwright-Screenshot
bei 390×844 (iPhone-Viewport).
