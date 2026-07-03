---
typ: entscheidung
datum: 2026-07-03
status: verbindlich für alle UI-Arbeit
---

# Design-Sprache: Skill-Leitplanken + bewusste Abweichungen

Tayyip hat `/ui-ux-pro-max` und `/minimalist-ui` installiert. Beide sind ab
sofort **Pflicht-Leitplanken vor jeder UI-Neugestaltung** (in der Session
laden, nicht aus dem Gedächtnis zitieren). Diese Notiz hält fest, was wir
übernehmen und wo wir bewusst abweichen — damit Abweichung Entscheidung
ist, nicht Vergessen.

## Was die Skills bestätigen (und wir bereits tun)
- **Marketplace-Pattern** (ui-ux-pro-max): „Search/Task bar is the CTA" →
  genau die neue Home (Was brauchen Sie? → Auftrag beschreiben);
  Sektionsfolge Hero → Kategorien → Listings → Trust → Anbieter-CTA
  entspricht Home + Landing.
- **Trust & Authority Style**: Badges, Zertifikate, Verifizierungs-Signale
  prominent — unser Kernversprechen. Anti-Pattern „versteckte Kontaktinfo /
  keine Zertifikate" vermeiden.
- **Minimalist-Grundregeln**: warme Bone-Palette (#F9F8F5 ✓), 1px-Hairline-
  Borders (#E5E1DA ✓), flache Karten, Radius ≤ 12–14, keine Gradients, kein
  Glassmorphism, keine Emojis (✓ harte WERKR-Regel), keine schweren
  Schatten (unsere shadow-Opacity ≤ 0.2, meist ≤ 0.05), Text nie #000
  (C.ink #1A1917 ✓), Sekundärtext gedämpft (C.sub ✓), großzügiger
  Weißraum, keine Pill-Formen für große Container.
- **Checkliste vor Lieferung**: 4.5:1-Kontrast, 44px-Targets, sichtbare
  Focus-States, 150–300ms-Transitions, responsive 375px+.

## Bewusste Abweichungen (mit Begründung)
1. **Dunkelgrüner Marken-Kopf** (Landing-Hero, Home-Kopf) — minimalist-ui
   verbietet großflächige Primärfarben. Abweichung gewollt: Tayyips
   explizites Feedback („Prototyp war besser") + Marken-Wiedererkennung;
   begrenzt auf GENAU diese zwei Marken-Momente, alle übrigen Screens
   bleiben Bone/Weiß. HERO-Palette zentral in `constants/colors.ts`.
2. **Ionicons statt Phosphor/Radix** — harte Bestandsregel im gesamten
   Produkt (Konsistenz + RN-Support schlägt Skill-Präferenz).
3. **System-Fonts statt Lexend/Serif-Hero** — React Native ohne Custom-Font-
   Setup; Font-Einführung wäre Invest ohne Validierungs-Nutzen (Phase D).
   Typo-Kontrast erreichen wir über Größe/Gewicht (T-Skala, max '700').
4. **Farbvorschlag Lila verworfen** — Markenfarben sind entschieden:
   Grün/Creme/Weiß (Tayyip, mehrfach bestätigt).

## Arbeitsregel ab jetzt
Vor jedem Screen-Redesign: (1) minimalist-ui-Protokoll gegen den Entwurf
prüfen, (2) bei Bedarf gezielte ui-ux-pro-max-Suche (`--domain ux` etc.),
(3) Abweichungen nur mit Eintrag in dieser Notiz.
