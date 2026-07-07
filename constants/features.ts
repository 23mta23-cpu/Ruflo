// Zentrale Feature-Flags — Fokus-Schnitt MVP (Entscheidung 2026-07-03,
// notes/04-Entscheidungen/Fokus-Schnitt-MVP.md).
//
// Eingefrorene Bereiche werden AUSGEBLENDET, nicht gelöscht: der Code bleibt
// vollständig erhalten und wird über genau diese Flags wieder aufgetaut,
// sobald die dokumentierten Wiederauftau-Kriterien erfüllt sind.

export const FEATURES = {
  /**
   * Track „Nachbarschaft" (C2C, €1,99 Werkant-Schutz) — Modell D+:
   * bedarfsgetriebener Fallback im Auftrags-Trichter, KEIN zweiter sichtbarer
   * Marktplatz (docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md).
   *
   * Live geschaltet per Founder-Anweisung 2026-07-06 für die Beta-/Demo-Phase
   * (notes/04-Entscheidungen/Nachbarschaft-Live-Schaltung.md).
   * Kill-Switch: EXPO_PUBLIC_ENABLE_NACHBARSCHAFT=false.
   * Harte Gates unverändert: Meisterpflicht-Ausschluss, B2B-Ausschluss,
   * getrennte Ratings, zagGate; DRV-/Steuer-Klärung bleibt Pflicht vor
   * echtem Geldfluss (Pivot/Stopp-Kriterien der Modell-D-Notiz gelten).
   */
  NACHBARSCHAFT: process.env.EXPO_PUBLIC_ENABLE_NACHBARSCHAFT !== 'false',

  /**
   * Pro-Abo (€29/Monat, Featured-Platzierung, Analytics).
   * Eingefroren bis: ≥20 aktive Anbieter mit regelmäßigen Aufträgen —
   * vorher gibt es nichts, wofür ein Anbieter zahlen würde.
   */
  PRO_ABO: false,
} as const;
