// Werkant 2.0 "Warm Precision" — Typography, Spacing, Radius, Shadows
// Key change: weight hierarchy (800 everywhere → deliberate scale), warmer shadows,
// tighter letter-spacing on large type, more generous line-heights for body.

import { Platform, TextStyle, ViewStyle } from 'react-native';

// ── Font stacks ──────────────────────────────────────────────────────────────

const fontFamily = Platform.select({
  ios:     'System',           // SF Pro on iOS — premium when used deliberately
  android: 'sans-serif',       // Roboto
  default: "'DM Sans', 'Geist Sans', system-ui, sans-serif",
});

const fontMono = Platform.select({
  ios:     'Menlo',
  android: 'monospace',
  default: "'Geist Mono', 'SF Mono', monospace",
});

// ── Typography scale ─────────────────────────────────────────────────────────
// Hierarchy: display(700) > h1(700) > h2(600) > h3(600) > h4(600) > body(400)
// Old system had 800 on display/h1/h2 — uniform weight = no hierarchy.

export const T: Record<string, TextStyle> = {
  // Display — reserved for hero moments only
  display:   { fontFamily, fontSize: 36, fontWeight: '700', lineHeight: 44, letterSpacing: -0.8 },

  // Headlines
  h1:        { fontFamily, fontSize: 28, fontWeight: '700', lineHeight: 36, letterSpacing: -0.5 },
  h2:        { fontFamily, fontSize: 22, fontWeight: '600', lineHeight: 30, letterSpacing: -0.2 },
  h3:        { fontFamily, fontSize: 17, fontWeight: '600', lineHeight: 24 },
  h4:        { fontFamily, fontSize: 15, fontWeight: '600', lineHeight: 22 },

  // Body — more generous line height (1.6x) for premium readability
  body:      { fontFamily, fontSize: 15, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontFamily, fontSize: 13, fontWeight: '400', lineHeight: 21 },

  // Utility
  semibold:  { fontFamily, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  medium:    { fontFamily, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  sm:        { fontFamily, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  xs:        { fontFamily, fontSize: 11, fontWeight: '400', lineHeight: 15 },

  // Label — sentence case preferred; uppercase only for metadata
  label:     { fontFamily, fontSize: 11, fontWeight: '500', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  caption:   { fontFamily, fontSize: 11, fontWeight: '400', lineHeight: 15 },

  // Mono — code, dates, amounts
  mono:      { fontFamily: fontMono, fontSize: 13, lineHeight: 19 },
  monoSm:    { fontFamily: fontMono, fontSize: 11, lineHeight: 15 },
};

// ── Spacing (4pt grid) ───────────────────────────────────────────────────────

export const S = {
  xxs:   2,
  xs:    4,
  sm:    8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
  hero: 64,
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────
// "Crisp Soft" — 8px base for components, 14px for cards, pill for tags only

export const R = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  14,
  xl:  18,
  full: 9999,
} as const;

// ── Shadows — warm-tinted, ultra-diffuse ─────────────────────────────────────
// Shadow color now uses warm near-black (was cold #0F172A)
// Opacity reduced for premium minimal feel

export const shadow: Record<'none' | 'xs' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {},
  xs: Platform.select({
    ios:     { shadowColor: '#1A1917', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
    android: { elevation: 1 },
    default: { boxShadow: '0 1px 3px rgba(26,25,23,0.04)' } as any,
  }) ?? {},
  sm: Platform.select({
    ios:     { shadowColor: '#1A1917', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    android: { elevation: 2 },
    default: { boxShadow: '0 2px 8px rgba(26,25,23,0.05)' } as any,
  }) ?? {},
  md: Platform.select({
    ios:     { shadowColor: '#1A1917', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16 },
    android: { elevation: 4 },
    default: { boxShadow: '0 4px 16px rgba(26,25,23,0.07)' } as any,
  }) ?? {},
  lg: Platform.select({
    ios:     { shadowColor: '#1A1917', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 28 },
    android: { elevation: 8 },
    default: { boxShadow: '0 8px 28px rgba(26,25,23,0.10)' } as any,
  }) ?? {},
};
