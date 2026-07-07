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
  email: 'kontakt@werkant.de',
  emailPrivacy: 'datenschutz@werkant.de',
  emailWithdrawal: 'widerruf@werkant.de',
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
