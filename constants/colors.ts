// WERKR Calm UI color tokens — "Linear-SaaS" palette.
// Slate-White background, warm ink, bento-grid shadow system.

export const C = {
<<<<<<< HEAD
  // Base
  bg:       '#F6F5F1',
  surface:  '#FFFFFF',
  border:   '#E4E3DE',
  ink:      '#111111',
  sub:      '#5F5F5F',
  muted:    '#A3A3A3',

  // Primary brand — Waldgrün (trust, craft, reliability)
  primary:    '#1C6B45',
  primaryBg:  '#E9F3EE',
  primaryBd:  '#C2E2CF',
  primaryDim: '#155436',

  // Accent — Terrakotta (warmth, German craft tradition)
  clay:    '#C4622D',
  clayBg:  '#FAEAE3',

  // Semantic — kept for backwards compat
  gold:    '#B8930A',
  goldBg:  '#FBF5E4',
  goldBd:  '#E7D49E',
  green:   '#1A7A48',
  greenBg: '#E8F5EE',
  red:     '#C22B2B',
  redBg:   '#FDEAEA',
  amber:   '#C07010',
  amberBg: '#FEF3E2',
=======
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:       '#f8fafc',   // Slate-White (Calm UI base)
  bgWarm:   '#F5F4F0',   // warm ivory — used for input/card insets
  surface:  '#FFFFFF',
  overlay:  'rgba(0,0,0,0.45)',

  // ── Borders & Dividers ────────────────────────────────────────────────────
  border:   '#E2E8F0',   // Slate-200
  borderSubtle: '#F1F5F9', // Slate-100

  // ── Typography ────────────────────────────────────────────────────────────
  ink:      '#0F172A',   // Slate-900
  sub:      '#475569',   // Slate-600
  muted:    '#94A3B8',   // Slate-400

  // ── Brand accent: gold/amber ──────────────────────────────────────────────
  gold:     '#B8930A',
  goldBg:   '#FBF5E4',
  amber:    '#C07010',
  amberBg:  '#FEF3E2',

  // ── Semantic ─────────────────────────────────────────────────────────────
  green:    '#16A34A',   // slightly brighter for Slate-White bg
  greenBg:  '#DCFCE7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonBase:     '#E2E8F0',
  skeletonHighlight:'#F8FAFC',
>>>>>>> main
} as const;

export type ColorKey = keyof typeof C;
