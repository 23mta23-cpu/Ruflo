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
   * Pro-Abo. Bleibt eingefroren (CFO-Entscheidung 27.07., siehe
   * notes/04-Entscheidungen/2026-07-27-Pro-bleibt-eingefroren.md).
   *
   * Auftauen NUR wenn ALLE DREI Kriterien erfüllt sind — nicht eines:
   *   (1) ≥20 Anbieter mit je ≥3 abgeschlossenen Aufträgen in 90 Tagen
   *   (2) ≥5 Anbieter fragen UNAUFGEFORDERT nach einem bezahlten Upgrade
   *   (3) ≥50 bezahlte Aufträge kumuliert
   *
   * Vor dem Auftauen muss das Feature-Set neu geschnitten werden:
   * „Bevorzugte Platzierung" fällt raus. Sie ist ein Nullsummenspiel (der
   * Lead-Pool ist fix, der aggregierte Zusatznutzen ueber alle Pro-Kaeufer ist
   * definitionsgemaess null), sie ist im Code nicht implementiert (is_pro
   * kommt in keiner order()-Klausel vor, nur als Badge), und AGB §2 Abs. 4
   * schliesst bezahlte Platzierung ausdruecklich aus (Art. 5 P2B-VO).
   */
  PRO_ABO: false,
} as const;
