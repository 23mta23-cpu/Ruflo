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
  // Meisterpflicht (HwO Anlage A) — Meisterbrief erforderlich.
  // Hinweis: Klassifikation nach HwO-Reform 2020; vor Go-live mit der
  // Handwerkskammer bestätigen (Rechtshinweis, keine Rechtsberatung).
  { id: 'dachdecker', name: 'Dachdecker', icon: 'home-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 4
    minHourlyRate: 50, vatLikely: true, active: true },
  { id: 'zimmerer', name: 'Zimmerer & Holzbau', icon: 'cube-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 3
    minHourlyRate: 48, vatLikely: true, active: true },
  { id: 'maurer', name: 'Maurer & Betonbau', icon: 'business-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 1
    minHourlyRate: 45, vatLikely: true, active: true },
  { id: 'metallbau', name: 'Metallbau & Schlosserei', icon: 'build-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 18
    minHourlyRate: 48, vatLikely: true, active: true },
  { id: 'rollladen', name: 'Rollladen & Sonnenschutz', icon: 'browsers-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'MEISTERBRIEF', 'IDENTITAET'], // HwO Anlage A Nr. 21 (seit 2020 wieder Anlage A)
    minHourlyRate: 42, vatLikely: true, active: true },
  // Zulassungsfrei (HwO Anlage B1) — KEIN Meisterbrief, Gewerbeschein genügt.
  { id: 'bodenleger', name: 'Bodenleger', icon: 'layers-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'IDENTITAET'], // HwO Anlage B1 (zulassungsfrei)
    minHourlyRate: 38, vatLikely: true, active: true },
  { id: 'gebaeudereinigung', name: 'Gebäudereinigung', icon: 'sparkles-outline',
    segment: 'B2B', pricingModel: 'QUOTE',
    requiredDocs: ['GEWERBESCHEIN', 'STEUERNUMMER', 'IDENTITAET'], // HwO Anlage B1 (zulassungsfrei)
    minHourlyRate: 30, vatLikely: true, active: true },

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
 * Der ANZEIGENAME eines Gewerks — nie die rohe Kennung.
 *
 * ANLASS (Founder am Geraet, 07.09.2026): „was sind diese bindestriche schon
 * auf der homepage?" Auf der Startseite stand bei einem Heizungsbetrieb
 * `heizung-sanitaer` statt „Heizung & Sanitär", und wo ein Name fehlte, ein
 * nackter Gedankenstrich. `app/anbieter.tsx` uebersetzte korrekt, die
 * Startseite nicht — dieselbe Uebersetzung an drei Stellen, an einer vergessen.
 *
 * Deshalb steht sie jetzt hier, EINMAL. Der Rueckfall ist bewusst `null` und
 * nicht die Kennung: eine unbekannte Kennung ist ein Datenfehler, und den soll
 * die Oberflaeche verschweigen statt ihn als Gewerk auszugeben. Wer `null`
 * bekommt, zeigt die Zeile gar nicht an.
 */
export function gewerkName(id: string | null | undefined): string | null {
  if (!id) return null;
  return categoryById(id)?.name ?? null;
}

/**
 * Modell D — kontrollierte Nachbarschafts-Startkategorien (Founder-Entscheidung,
 * docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md). Nur diese C2C-Kategorien
 * sind im Nachbarschafts-Fallback erreichbar — Single Source of Truth für
 * onboarding-kyc.tsx, nachbarschaft.tsx und auftrag-detail.tsx.
 *
 * Stufe 2 (08.07., notes/04-Entscheidungen/Nachbarschaft-Ausbau-Stufe2.md):
 * um reinigung/it-support/moebelaufbau/waesche erweitert — gleiche Kriterien
 * wie die ursprünglichen 3 (physisch/technisch, niedrige Haftungsschwelle,
 * kein Kontakt zu vulnerablen Gruppen). Bewusst weiterhin ausgeschlossen:
 * tierbetreuung, nachhilfe, seniorenhilfe, babysitting — Betreuung von
 * Tieren/Minderjährigen/Senioren erfordert einen Trust-Mechanismus (z. B.
 * Führungszeugnis), der noch nicht existiert.
 */
export const NACHBARSCHAFT_STARTKATEGORIEN = [
  'garten', 'umzugshilfe', 'einkaufshilfe',
  'reinigung', 'it-support', 'moebelaufbau', 'waesche',
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

/**
 * Der harte Boden. Darunter wird nicht gespeichert.
 *
 * Orientiert am gesetzlichen Mindestlohn, ohne ihn zu behaupten: das MiLoG
 * gilt für Arbeitnehmer, nicht unmittelbar für selbständige Betriebe.
 */
export const MINDESTPREIS_BODEN = 13;

/**
 * Der marktübliche Satz für die gewählten Gewerke. EIN HINWEIS, KEINE SPERRE.
 *
 * ANLASS (Founder am Gerät, 08.09.2026): „warum muss es mindestens 50€ die
 * stunde sein das ergibt sich mir nicht?"
 *
 * Die Frage war berechtigt, und beim Nachgehen war die Antwort schlechter als
 * die Meldung. Drei Gründe, warum die Sperre weg ist:
 *
 *   1. Sie wirkte fast nicht. Geprüft wurde nur das PROFILFELD
 *      `min_hourly_rate`. Der tatsächliche Angebotspreis läuft über
 *      app/betrieb/angebot-erstellen.tsx und wird nirgends dagegen geprüft;
 *      bei einem Festpreis gibt es überhaupt keinen Stundensatz. Die Hürde
 *      kostete den Anbieter Zeit beim Einrichten und verhinderte kein
 *      einziges Dumping-Angebot.
 *   2. Rechtlich heikel. Werkant ist reiner Vermittler (§ 2 Abs. 1 Nr. 1
 *      PStTG), der Vertrag entsteht zwischen Kunde und Betrieb. Eine
 *      Plattform, die unabhängigen Anbietern Mindestpreise VORSCHREIBT,
 *      bewegt sich Richtung Preisbindung (§ 1 GWB, Art. 101 AEUV).
 *      Ein Hinweis ist davon nicht erfasst, eine Sperre schon eher.
 *   3. Sie traf die Falschen. `min_hourly_rate` ist EIN Wert pro Betrieb.
 *      Wer Dachdecker (50) und Gartenarbeit (13) anbietet, konnte für den
 *      Garten keine 20 €/h setzen. Bestraft wurden also gerade die breit
 *      aufgestellten Betriebe.
 *
 * Was bleibt: der Boden von 13 €/h als Sperre, und dieser Satz als sichtbare
 * Empfehlung mit Begründung („marktüblich für Dachdecker"). Wer bewusst
 * darunter geht, darf das; er sieht nur, dass er darunter geht.
 *
 * Gibt null zurück, wenn kein gewähltes Gewerk mehr als den Boden nahelegt.
 */
export function empfohlenerSatz(ids: string[]): { rate: number; kategorie: string } | null {
  let rate = MINDESTPREIS_BODEN;
  let kategorie: string | null = null;
  for (const id of ids) {
    const cat = categoryById(id);
    if (cat && cat.minHourlyRate > rate) {
      rate = cat.minHourlyRate;
      kategorie = cat.name;
    }
  }
  return kategorie ? { rate, kategorie } : null;
}

/** Warum dieser Satz nicht gespeichert werden kann, oder null. */
export function satzFehler(satz: number): string | null {
  if (!Number.isFinite(satz)) return 'Bitte einen Stundensatz eintragen.';
  if (satz < MINDESTPREIS_BODEN) {
    return `Der Mindestpreis liegt bei €${MINDESTPREIS_BODEN},00/h.`;
  }
  return null;
}
