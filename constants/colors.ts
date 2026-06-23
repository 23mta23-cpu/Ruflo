// WERKR 2.0 "Warm Precision" — Premium Utilitarian Minimalism
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
  muted:          '#A8A49C',   // warm light-gray (was cold Slate-400 #94A3B8)

  // ── WERKR brand — deep forest green ──────────────────────────────────────
  primary:        '#1B5C40',   // deep forest (more premium than current #1C6B45)
  primaryBg:      '#EBF4EF',   // pale green tint
  primaryBd:      '#BDD9C9',   // green border

  // ── Gold — muted refined amber ────────────────────────────────────────────
  gold:           '#8F6B1A',   // deep amber (desaturated, was #B8930A)
  goldBg:         '#F6ECD8',
  goldBd:         '#DDD0A8',
  amber:          '#9A7020',
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
