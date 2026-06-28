// Single source of truth for company & legal data across all legal screens
// (Impressum, AGB, Datenschutz, Widerruf) and the Trusted Shops integration.
//
// GO-LIVE: fill in the real values below, then set LEGAL_PLACEHOLDER to false.
// The amber "Platzhalter"-Banner on every legal screen disappears automatically.

/** Set to false once real company data is entered below. Controls the placeholder banners. */
export const LEGAL_PLACEHOLDER = true;

export const COMPANY = {
  /** Short trading name shown in headings. */
  name: 'WERKR GmbH',
  /** Full legal form. After founding, drop the "(i. Gr.)". */
  legalForm: 'Gesellschaft mit beschränkter Haftung (i. Gr.)',
  managingDirector: '[Ihr Name]',
  street: 'Musterstraße 1',
  postalCode: '50667',
  city: 'Köln',
  country: 'Deutschland',
  registerCourt: 'Amtsgericht Köln',
  /** Handelsregisternummer, e.g. 'HRB 123456'. */
  registerNumber: 'in Beantragung',
  /** USt-IdNr. (§27a UStG), e.g. 'DE123456789'. */
  vatId: 'in Beantragung',
  email: 'kontakt@werkr.de',
  emailPrivacy: 'datenschutz@werkr.de',
  emailWithdrawal: 'widerruf@werkr.de',
  phone: '+49 (0)221 000 000 0',
  phoneHref: 'tel:+492210000000',
} as const;

/** "Musterstraße 1, 50667 Köln" */
export const COMPANY_ADDRESS_LINE = `${COMPANY.street}, ${COMPANY.postalCode} ${COMPANY.city}`;
/** "WERKR GmbH (i. Gr.)" — inline legal name used in AGB / Widerruf prose. */
export const COMPANY_LEGAL_INLINE = `${COMPANY.name} (i. Gr.)`;
/** "WERKR GmbH (i. Gr.), Musterstraße 1, 50667 Köln" */
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
