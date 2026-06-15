import { Platform } from 'react-native';

const base = Platform.select({ ios: 'System', android: 'sans-serif', default: 'Plus Jakarta Sans, system-ui, sans-serif' });

export const T = {
  // Size scale
  xs:   { fontSize: 11, lineHeight: 16 },
  sm:   { fontSize: 13, lineHeight: 19 },
  base: { fontSize: 15, lineHeight: 22 },
  lg:   { fontSize: 17, lineHeight: 25 },
  xl:   { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 38 },

  // Weight helpers
  regular: { fontWeight: '400' as const },
  medium:  { fontWeight: '500' as const },
  semibold:{ fontWeight: '600' as const },
  bold:    { fontWeight: '700' as const },
  black:   { fontWeight: '800' as const },

  // Composite roles
  h1:      { fontSize: 28, lineHeight: 35, fontWeight: '800' as const },
  h2:      { fontSize: 22, lineHeight: 29, fontWeight: '800' as const },
  h3:      { fontSize: 18, lineHeight: 25, fontWeight: '700' as const },
  h4:      { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  label:   { fontSize: 12, lineHeight: 17, fontWeight: '700' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
  body:    { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  bodyMd:  { fontSize: 14, lineHeight: 21, fontWeight: '500' as const },
  btn:     { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  btnSm:   { fontSize: 13, lineHeight: 19, fontWeight: '700' as const },
  price:   { fontSize: 20, lineHeight: 26, fontWeight: '800' as const },
  priceLg: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const },

  fontFamily: base,
} as const;
