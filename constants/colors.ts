// Werkant 2.0 "Warm Precision" — Premium Utilitarian Minimalism
// Shift: cold Slate-White → warm bone-cream. One accent (forest green), warm neutrals.

export const C = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:             '#F9F8F5',   // warm bone canvas (was cold Slate-White #f8fafc)
  bgWarm:         '#F2EFE9',   // deep warm ivory — card insets, pressed states
  hair:           '#F2EFE9',   // alias for bgWarm
  surface:        '#FFFFFF',
  overlay:        'rgba(15,15,12,0.50)',

  // ── Borders & Dividers ────────────────────────────────────────────────────
  border:         '#E5E1DA',   // warm structural border (was cold #E2E8F0)
  borderSubtle:   '#EDEBE6',   // warm subtle divider

  // ── Typography ────────────────────────────────────────────────────────────
  ink:            '#1A1917',   // warm near-black (was cold Slate-900 #0F172A)
  sub:            '#6C6862',   // warm mid-gray (was cold Slate-600 #475569)
  // 20.09.2026 von #756F66 auf #706A61: gemessen mit scripts/kontrast-check.cjs
  // am gerenderten Bildschirm, nicht aus der Tabelle. Auf bg und surface war
  // der alte Wert in Ordnung (4,68 und 4,97), auf den GETOENTEN Flaechen nicht
  // -- auf goldBg 4,24. Der Kommentar hier sagte deshalb die Wahrheit und
  // trotzdem zu wenig: er nannte die zwei Gruende, auf denen es stimmte.
  // Jetzt auf allen gemessenen Gruenden ueber 4,5.
  muted:          '#706A61',   // warm mid-light-gray, WCAG AA 4.5:1+ auch auf getoenten Flaechen
                                // (was #A8A49C, 2.3:1 — failed contrast; used for real
                                // body text in 170+ call sites, not just placeholders)

  // ── Werkant brand — deep forest green ──────────────────────────────────────
  primary:        '#1B5C40',   // deep forest (more premium than current #1C6B45)
  primaryBg:      '#EBF4EF',   // pale green tint
  primaryBd:      '#BDD9C9',   // green border

  // ── Gold — muted refined amber ────────────────────────────────────────────
  // 20.09.2026 von #8F6B1A auf #876518: Gold auf goldBg lag bei 4,18:1. Das
  // ist das Abzeichen-Muster („Meisterbetrieb", „Loslegen") -- Gold auf seinem
  // eigenen Ton, also genau die Paarung, die niemand nachrechnet.
  gold:           '#876518',   // deep amber (desaturated, was #B8930A)
  goldBg:         '#F6ECD8',
  goldBd:         '#DDD0A8',
  // 20.09.2026 von #9A7020 auf #8C651D: der Preis auf /betrieb/auftraege lag
  // bei 4,46:1 gegen Weiss -- vier Hundertstel unter der Grenze, und damit
  // genau der Fall, den ein Blick nicht findet und eine Messung schon.
  // HINWEIS: amber und gold liegen jetzt sehr nah beieinander. Zwei Marken
  // fuer dieselbe Farbe sind eine zu viel; das Zusammenlegen ist eine
  // Gestaltungsentscheidung und gehoert dem Founder.
  amber:          '#8C651D',
  amberBg:        '#F8F0E0',

  // ── Clay — deep terracotta ────────────────────────────────────────────────
  clay:           '#9B3E25',   // deep rust (desaturated, was #C4622D)
  clayBg:         '#F5E8E3',
  clayBd:         '#E2C0B2',

  // ── Semantic ─────────────────────────────────────────────────────────────
  green:          '#1A7A45',
  greenBg:        '#E4F5EB',
  red:            '#B91C1C',   // slightly deeper red
  redBg:          '#FEE2E2',
  redBd:          '#FECACA',   // red border (new)

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonBase:      '#E5E1DA',   // warm skeleton (was cold #E2E8F0)
  skeletonHighlight: '#F2EFE9',   // warm highlight (was cold #F8FAFC)
} as const;

export type ColorKey = keyof typeof C;

// ── Hero-Palette — dunkles Markengrün für Marken-Momente ────────────────────
// (Landing-Hero, Home-Kopf). Bewusst getrennt von C: helle Screens bleiben
// auf der Bone-Palette, HERO ist nur für dunkle Flächen mit hellem Text.
export const HERO = {
  bg:     '#17503A',               // etwas tiefer als C.primary für mehr Ruhe
  mint:   '#8FD9B0',               // Akzent auf dunklem Grund
  text:   'rgba(255,255,255,0.87)',
  faint:  'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.30)',
} as const;
