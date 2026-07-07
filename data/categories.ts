// Zentrale Service-Kategorie-Konfiguration (ADR: Multi-Service-Architektur).
// Neue Dienstleistungen werden hier (später: per DB-Eintrag) hinzugefügt —
// kein neuer Code nötig. Jede Kategorie steuert Pricing-Flow, Pflicht-
// dokumente und die umsatzsteuerliche Behandlung der Plattformgebühr.

export type PricingModel = 'HOURLY' | 'FIXED' | 'QUOTE';

export type Segment = 'B2B' | 'C2C';

export type RequiredDoc =
  | 'GEWERBESCHEIN'
  | 'STEUERNUMMER'
  | 'MEISTERBRIEF'
  | 'ZERTIFIKAT'
  | 'IDENTITAET';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;             // Ionicons name
  segment: Segment;
  pricingModel: PricingModel;
  requiredDocs: RequiredDoc[];
  /** Plattform-Mindestrate in €/h (B2B: marktübliche Minima; C2C: Richtlinie — §1 MiLoG gilt nur für Arbeitnehmer, nicht für Selbstständige) */
  minHourlyRate: number;
  /** true = Anbieter ist i.d.R. Unternehmer → Reverse-Charge-Prüfung / USt-Rechnung */
  vatLikely: boolean;
  active: boolean;
}

export const CATEGORIES: ServiceCategory[] = [
  // — B2B: Profi-Handwerk (Steuernummer + Gewerbeschein Pflicht) —
  { id: 'heizung-sanitaer', name: 'Heizung & Sanitär', icon: 'flame-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 24
    minHourlyRate: 45, vatLikely: true, active: true },
  { id: 'elektro', name: 'Elektro', icon: 'flash-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'],
    minHourlyRate: 45, vatLikely: true, active: true },
  { id: 'renovierung', name: 'Renovierung', icon: 'construct-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'IDENTITAET'],
    minHourlyRate: 40, vatLikely: true, active: true },
  { id: 'maler', name: 'Maler', icon: 'color-palette-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 10 (Meisterpflicht seit 2020)
    minHourlyRate: 38, vatLikely: true, active: true },
  { id: 'tischler', name: 'Tischler', icon: 'hammer-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 27
    minHourlyRate: 42, vatLikely: true, active: true },
  { id: 'fliesen', name: 'Fliesen', icon: 'grid-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 41 (Meisterpflicht seit 2020)
    minHourlyRate: 40, vatLikely: true, active: true },

  // — C2C: Nachbarschaftshilfe / Studenten (nur Identität, §1 MiLoG-Minimum) —
  { id: 'reinigung', name: 'Reinigung', icon: 'sparkles-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'nachhilfe', name: 'Nachhilfe', icon: 'school-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'it-support', name: 'IT-Support', icon: 'laptop-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'garten', name: 'Garten', icon: 'leaf-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'umzugshilfe', name: 'Umzugshilfe', icon: 'cube-outline',
    segment: 'C2C', pricingModel: 'FIXED',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'moebelaufbau', name: 'Möbelaufbau', icon: 'construct-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'einkaufshilfe', name: 'Einkaufshilfe', icon: 'cart-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'tierbetreuung', name: 'Tierbetreuung', icon: 'paw-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'seniorenhilfe', name: 'Seniorenbegleitung', icon: 'heart-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'babysitting', name: 'Babysitting', icon: 'happy-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },
  { id: 'waesche', name: 'Wäsche & Bügeln', icon: 'shirt-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET'],
    minHourlyRate: 13, vatLikely: false, active: true },

  // — Beispiel für späteren Ausbau: per active=true freischalten —
  { id: 'dolmetscher', name: 'Dolmetscher', icon: 'language-outline',
    segment: 'C2C', pricingModel: 'HOURLY',
    requiredDocs: ['IDENTITAET', 'ZERTIFIKAT'],
    minHourlyRate: 25, vatLikely: false, active: false },
];

export const activeCategories = () => CATEGORIES.filter((c) => c.active);

export const MEISTERPFLICHT_IDS = new Set(
  CATEGORIES.filter((c) => c.requiredDocs.includes('MEISTERBRIEF')).map((c) => c.id),
);

export const categoryById = (id: string) =>
  CATEGORIES.find((c) => c.id === id);

/**
 * Modell D — kontrollierte Nachbarschafts-Startkategorien (Founder-Entscheidung,
 * docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md). Nur diese C2C-Kategorien
 * sind im Nachbarschafts-Fallback erreichbar — Single Source of Truth für
 * onboarding-kyc.tsx, nachbarschaft.tsx und auftrag-detail.tsx.
 *
 * Stufe 2 (08.07., notes/04-Entscheidungen/Nachbarschaft-Ausbau-Stufe2.md):
 * um reinigung/it-support/moebelaufbau/tierbetreuung/waesche erweitert —
 * gleiche Kriterien wie die ursprünglichen 3 (physisch/technisch, niedrige
 * Haftungsschwelle, kein Kontakt zu vulnerablen Gruppen). Bewusst weiterhin
 * ausgeschlossen: nachhilfe, seniorenhilfe, babysitting — Kontakt zu
 * Minderjährigen/Senioren erfordert einen Trust-Mechanismus (z. B.
 * Führungszeugnis), der noch nicht existiert.
 */
export const NACHBARSCHAFT_STARTKATEGORIEN = [
  'garten', 'umzugshilfe', 'einkaufshilfe',
  'reinigung', 'it-support', 'moebelaufbau', 'tierbetreuung', 'waesche',
];

/**
 * Kundensichtbare Kategorien (Home-Raster, Suche, Wizard): Profi-Handwerk
 * (B2B) immer; bei aktivem Nachbarschafts-Track zusätzlich NUR die
 * freigegebenen Startkategorien — bewusst nicht alle C2C-Kategorien
 * (Babysitting, Seniorenbegleitung etc. bleiben zurückgestellt, Modell-D-
 * Sicherheitslinie). Single Source of Truth gegen Insellösungen pro Screen.
 */
export const kundenKategorien = (nachbarschaftAktiv: boolean) =>
  activeCategories().filter(
    (c) =>
      c.segment === 'B2B' ||
      (nachbarschaftAktiv && NACHBARSCHAFT_STARTKATEGORIEN.includes(c.id)),
  );

/**
 * Prüft, ob ein Job-Kategorie-Wert (id ODER Anzeigename, z. B. der vom
 * Auftrag-Wizard gespeicherte Label-Text „Gartenarbeit") zu einer der
 * freigegebenen Nachbarschafts-Startkategorien gehört. Toleriert beide
 * Schreibweisen, damit der Fallback in auftrag-detail unabhängig davon
 * funktioniert, ob id oder Label in jobs.category steht.
 */
export function isNachbarschaftsfaehigeKategorie(category: string): boolean {
  const c = category.trim().toLowerCase();
  if (!c) return false;
  return NACHBARSCHAFT_STARTKATEGORIEN.some((id) => {
    const cat = categoryById(id);
    return c === id || c === cat?.name.toLowerCase() || c.startsWith(id);
  });
}

/** Niedrigste zulässige Rate über alle gewählten Kategorien (MiLoG + Markt-Minima) */
export function minRateFor(ids: string[]): number {
  const rates = ids
    .map((id) => categoryById(id)?.minHourlyRate)
    .filter((r): r is number => r !== undefined);
  return rates.length ? Math.max(13, Math.max(...rates)) : 13;
}
