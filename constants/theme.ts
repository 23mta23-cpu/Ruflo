// WERKR Design System — Calm UI / Linear-SaaS
// Typography: Inter / Plus Jakarta Sans (system fallback)
// Spacing: 4pt grid
// Shadows: soft bento-grid elevation

import { Platform, TextStyle, ViewStyle } from 'react-native';

// ── Typography ───────────────────────────────────────────────────────────────

const fontFamily = Platform.select({
  ios:     'System',   // SF Pro on iOS
  android: 'sans-serif',
  default: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
});

export const T: Record<string, TextStyle> = {
  display:   { fontFamily, fontSize: 36, fontWeight: '800', lineHeight: 42, letterSpacing: -0.5 },
  h1:        { fontFamily, fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.3 },
  h2:        { fontFamily, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  h3:        { fontFamily, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  h4:        { fontFamily, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body:      { fontFamily, fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontFamily, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  label:     { fontFamily, fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  caption:   { fontFamily, fontSize: 11, fontWeight: '400', lineHeight: 15 },
  mono:      { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, lineHeight: 19 },
};

// ── Spacing (4pt grid) ───────────────────────────────────────────────────────

export const S = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:  12,
  base:16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl:48,
} as const;

// ── Border radius ────────────────────────────────────────────────────────────

export const R = {
  xs:   4,
  sm:   8,
  md:  10,
  lg:  14,
  xl:  18,
  full:9999,
} as const;

// ── Shadows (bento-grid soft look) ───────────────────────────────────────────
// iOS: shadow* props  |  Android: elevation  |  Web: boxShadow

export const shadow: Record<'none' | 'xs' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {},
  xs: Platform.select({
    ios:     { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
    android: { elevation: 1 },
    default: { boxShadow: '0 1px 2px rgba(15,23,42,0.04)' } as any,
  }) ?? {},
  sm: Platform.select({
    ios:     { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
    android: { elevation: 2 },
    default: { boxShadow: '0 2px 8px rgba(15,23,42,0.06)' } as any,
  }) ?? {},
  md: Platform.select({
    ios:     { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
    default: { boxShadow: '0 4px 16px rgba(15,23,42,0.08)' } as any,
  }) ?? {},
  lg: Platform.select({
    ios:     { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 },
    android: { elevation: 8 },
    default: { boxShadow: '0 8px 32px rgba(15,23,42,0.12)' } as any,
  }) ?? {},
};
