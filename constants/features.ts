// Zentrale Feature-Flags — Fokus-Schnitt MVP (Entscheidung 2026-07-03,
// notes/04-Entscheidungen/Fokus-Schnitt-MVP.md).
//
// Eingefrorene Bereiche werden AUSGEBLENDET, nicht gelöscht: der Code bleibt
// vollständig erhalten und wird über genau diese Flags wieder aufgetaut,
// sobald die dokumentierten Wiederauftau-Kriterien erfüllt sind.

export const FEATURES = {
  /**
   * Track „Nachbarschaft" (C2C, €1,99 WERKR-Schutz).
   * Eingefroren bis: Handwerker-Track hat ≥50 echte bezahlte Aufträge UND
   * DRV-Statusfeststellung für die Helfer-Rolle ist eingeleitet.
   *
   * Produktions-Default bleibt false (Wiederauftau-Kriterien unverändert,
   * docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md). Für Test-/Staging-
   * Builds aktivierbar über EXPO_PUBLIC_ENABLE_NACHBARSCHAFT=true — kein
   * Live-Gate wird dadurch umgangen (zagGate etc. unberührt).
   */
  NACHBARSCHAFT: process.env.EXPO_PUBLIC_ENABLE_NACHBARSCHAFT === 'true',

  /**
   * Pro-Abo (€29/Monat, Featured-Platzierung, Analytics).
   * Eingefroren bis: ≥20 aktive Anbieter mit regelmäßigen Aufträgen —
   * vorher gibt es nichts, wofür ein Anbieter zahlen würde.
   */
  PRO_ABO: false,
} as const;
