# Entscheidung: Open Design als UI/UX-Standard (2026-07-19)

**Kontext:** Auftrag verlangte Analyse von `nexu-io/open-design` (geklont,
v0.13, Apache 2.0) und Nutzung als verbindlichen UI/UX-Standard; Fallback
Radix+Tailwind+shadcn.

**Analyse-Ergebnis:**
- Open Design ist eine Desktop-App/Ökosystem, dessen Kernvertrag das
  `DESIGN.md`-Design-System-Format ist (`design-systems/<brand>/` mit
  `manifest.json` + `DESIGN.md` + `tokens.css`; Achsen DESIGN_VARIANCE /
  MOTION_INTENSITY / VISUAL_DENSITY).
- **Ruflo/Werkant erfüllt den Vertrag bereits:** `DESIGN.md` (445 Zeilen,
  Soft Structuralism, Achsen 6/4/5) + CSS-Tokens (`werkr-design-system-v2.css`)
  + RN-Tokens (`constants/colors.ts`, `typography.ts`, `theme.ts`).

**Entscheidung (Director UI/UX + CTO):**
1. Werkant-`DESIGN.md` bleibt der verbindliche Brand-Contract — er IST
   Open-Design-konform. Keine Doppelpflege.
2. KEIN Umbau auf Radix/Tailwind/shadcn: React-Native/Expo-App, DOM-basierte
   Libraries inkompatibel; Fallback-Klausel griffe nur, wenn Open Design
   nicht analysierbar wäre (war es nicht).
3. Für Marketing-/Sales-Exports (HTML/PDF/PPTX) werden die Werkant-Tokens aus
   `werkr-design-system-v2.css` verwendet — keine Custom-Styles.
