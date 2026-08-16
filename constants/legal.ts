// Single source of truth for company & legal data across all legal screens
// (Impressum, AGB, Datenschutz, Widerruf, Rechnung, DSGVO-Consent) and Trusted Shops.
//
// GO-LIVE: fill in the real values below, then set LEGAL_PLACEHOLDER to false.
// The amber "Platzhalter"-Banner on every legal screen disappears automatically.
//
// Rechtsform: UG (haftungsbeschränkt) — §5a GmbHG. Die Firma MUSS die Bezeichnung
// "UG (haftungsbeschränkt)" voll ausgeschrieben führen (nicht auf "UG" kürzen).

/** Set to false once real company data is entered below. Controls the placeholder banners. */
export const LEGAL_PLACEHOLDER = true;

/** UG is still being registered ("in Gründung"). Set false after Handelsregister entry. */
export const IN_FOUNDING = true;

/**
 * Alle Postfächer an EINER Stelle.
 *
 * Stand 16.08.2026: Es gibt noch KEIN einziges Postfach. Die App verwies an
 * 16 Stellen auf sechs verschiedene Adressen (support@, kontakt@,
 * datenschutz@, widerruf@, steuer@, verify@) — keine davon empfing Post. Wer
 * dem Impressum oder der Widerrufsbelehrung folgte, schrieb ins Leere.
 *
 * Drei dieser Adressen sind nicht optional:
 *   §5 Abs. 1 Nr. 2 DDG      Impressum braucht einen Weg zur unmittelbaren
 *                            Kommunikation
 *   Art. 13 DSGVO            Kontaktdaten des Verantwortlichen sind
 *                            Pflichtangabe
 *   Art. 246a §1 Abs. 2 EGBGB  Die Widerrufsbelehrung muss eine Adresse
 *                            nennen, an die der Widerruf gehen kann
 *   Art. 11 P2B-VO           Internes Beschwerdemanagement für gewerbliche
 *                            Nutzer (greift, sobald Anbieter gewerblich sind)
 *
 * DESHALB der Schalter unten: Solange es nur EIN echtes Postfach gibt, zeigen
 * alle Wege dorthin. Das ist rechtlich einwandfrei — vorgeschrieben ist eine
 * erreichbare Adresse, nicht ein bestimmter Name davor. Und es ist ehrlicher
 * als sechs Adressen, von denen fünf ins Leere laufen.
 *
 * Sobald echte Postfächer existieren: `EIN_POSTFACH` auf `null` setzen. Dann
 * greifen wieder die sprechenden Adressen — ohne dass irgendein Bildschirm
 * angefasst werden muss.
 */
const EIN_POSTFACH: string | null = 'kontakt@werkant.de';

/**
 * Ob gerade der Ein-Postfach-Betrieb läuft. Exportiert, damit Tests beide
 * Betriebsarten prüfen können statt nur die gerade eingestellte — ein Test,
 * der nach dem Umlegen des Schalters rot wird, wäre beim Umlegen im Weg.
 */
export const EIN_POSTFACH_AKTIV = EIN_POSTFACH !== null;

/** Sprechende Adresse, oder das eine Postfach, solange es nur eines gibt. */
function postfach(lokalteil: string): string {
  return EIN_POSTFACH ?? `${lokalteil}@werkant.de`;
}

export const MAIL = {
  /** Impressum (§5 DDG) und Beschwerden gegen eine Sperrung (AGB §7(5)). */
  kontakt:     postfach('kontakt'),
  /** Auskunft, Löschung, Widerspruch (Art. 15 ff. DSGVO). */
  datenschutz: postfach('datenschutz'),
  /** Widerrufserklärung (Art. 246a §1 Abs. 2 EGBGB). */
  widerruf:    postfach('widerruf'),
  /** Allgemeine Hilfe — keine Pflicht, aber die häufigste Nennung in der App. */
  support:     postfach('support'),
  /** Rückfragen zur PStTG-/DAC7-Meldung. */
  steuer:      postfach('steuer'),
  /** Nachweise zur Anbieter-Verifizierung. */
  verifizierung: postfach('verify'),
} as const;

export const COMPANY = {
  /** Official firm name (Firma) per §5a GmbHG — must carry "UG (haftungsbeschränkt)". */
  name: 'Werkant UG (haftungsbeschränkt)',
  /** Legal-form description. */
  legalForm: 'Unternehmergesellschaft (haftungsbeschränkt)',
  managingDirector: '[Ihr Name]',
  /** Datenschutzbeauftragter (falls bestellt) — Pflicht ab 20 Mitarbeitern oder umfangreicher Datenverarbeitung, §37 BDSG. */
  dpoName: '[Name Datenschutzbeauftragter]',
  street: 'Musterstraße 1',
  postalCode: '50667',
  city: 'Köln',
  country: 'Deutschland',
  registerCourt: 'Amtsgericht Köln',
  /** Handelsregisternummer, e.g. 'HRB 123456'. */
  registerNumber: 'in Beantragung',
  /** USt-IdNr. (§27a UStG), e.g. 'DE123456789'. */
  vatId: 'in Beantragung',
  email: MAIL.kontakt,
  emailPrivacy: MAIL.datenschutz,
  emailWithdrawal: MAIL.widerruf,
  // ACHTUNG: Platzhalter-Nummer. §5 Abs. 1 Nr. 2 DDG verlangt Angaben, die
  // eine "unmittelbare Kommunikation" ermöglichen — eine Nummer, unter der
  // niemand erreichbar ist, erfüllt das nicht und ist schlechter als gar
  // keine. Vor dem Marktstart durch eine echte ersetzen oder streichen; die
  // E-Mail-Adresse allein genügt nach h. M., wenn sie zeitnah beantwortet wird.
  phone: '+49 (0)221 000 000 0',
  phoneHref: 'tel:+492210000000',
} as const;

/** "i. Gr." marker while the UG is in founding, empty once registered. */
const FOUNDING_SUFFIX = IN_FOUNDING ? ' i. Gr.' : '';

/** "Musterstraße 1, 50667 Köln" */
export const COMPANY_ADDRESS_LINE = `${COMPANY.street}, ${COMPANY.postalCode} ${COMPANY.city}`;
/** Firm name incl. founding marker, e.g. "Werkant UG (haftungsbeschränkt) i. Gr." */
export const COMPANY_LEGAL_INLINE = `${COMPANY.name}${FOUNDING_SUFFIX}`;
/** "Werkant UG (haftungsbeschränkt) i. Gr., Musterstraße 1, 50667 Köln" */
export const COMPANY_FULL = `${COMPANY_LEGAL_INLINE}, ${COMPANY_ADDRESS_LINE}`;

/**
 * Trusted Shops integration. Create the account, paste the Trusted Shops ID,
 * then flip `enabled` to true. Nothing renders/loads while `tsId` is empty.
 *
 * Coverage: Trusted Shops Rechtstexte cover the STANDARD distance-selling texts
 * (AGB / Datenschutz / Widerruf / Impressum) plus Trustbadge + Käuferschutz.
 * They do NOT cover the ZAG/Escrow (BaFin) structure or PStTG/DAC7 reporting —
 * those remain separate legal work. See notes/02-Specs/Trusted-Shops.md.
 */
export const TRUSTED_SHOPS = {
  enabled: false,
  /** Trusted Shops ID, e.g. 'X1234567890ABCDEFGHIJKLMNOPQRSTUV'. */
  tsId: '',
  /** Käuferschutz (buyer protection). */
  buyerProtection: false,
  /** eTrusted review collection widget. */
  reviews: false,
} as const;
